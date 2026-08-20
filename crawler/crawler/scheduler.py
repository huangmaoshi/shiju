"""调度器

对应 TypeScript 版 crawler/src/scheduler.ts（node-cron）。
使用 APScheduler BackgroundScheduler + CronTrigger.from_crontab。
"""
import threading
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import config
from .db import CrawlSchedule, CrawlSource, CrawlTask, get_session
from .logger import logger
from .processors.db_writer import write_quote
from .providers.factory import get_provider

# 对应 TS scheduledTasks: Map<string, cron.ScheduledTask>
_scheduled_tasks: dict = {}
_scheduler: BackgroundScheduler | None = None
_lock = threading.Lock()


def execute_schedule(source_code: str) -> None:
    """对应 TS executeSchedule"""
    db = get_session()
    try:
        source = db.query(CrawlSource).filter(CrawlSource.code == source_code).first()
        if not source:
            logger.error(f"[scheduler] CrawlSource 不存在: {source_code}")
            return

        schedule = db.query(CrawlSchedule).filter(CrawlSchedule.sourceId == source.id).first()
        if not schedule or schedule.enabled != 1:
            logger.warning(f"[scheduler] 未找到有效调度配置: {source_code}")
            return
    finally:
        db.close()

    provider = get_provider(source_code)
    if provider is None and source.type == "github":
        # 数据集类源（如 github_chinese_poetry_*）复用 GithubDatasetProvider
        from .providers.github_dataset_provider import GithubDatasetProvider
        provider = GithubDatasetProvider(remark=source.remark)
    if provider is None:
        logger.error(f"[scheduler] Provider 未注册: {source_code}")
        return

    provider.remark = source.remark or getattr(provider, "remark", None)

    logger.info(f"[scheduler] 开始执行 {source_code} (pagesPerRun={schedule.pagesPerRun})")

    db = get_session()
    try:
        task = CrawlTask(
            sourceId=source.id,
            url=source.baseUrl,
            status="running",
            priority=source.priority,
            maxRetry=3,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
    finally:
        db.close()

    inserted = 0
    skipped = 0

    for page in range(1, schedule.pagesPerRun + 1):
        try:
            raw_list = provider.fetch_list(page)
            if not raw_list:
                logger.info(f"[{source_code}] 第 {page} 页无数据，停止翻页")
                break

            for raw in raw_list:
                try:
                    enriched = provider.fetch_detail(raw)
                    result = write_quote(enriched, source.id, task.id)
                    if result["status"] == "inserted":
                        inserted += 1
                    else:
                        skipped += 1
                except Exception as err:
                    logger.error(f"[{source_code}] 单条处理失败: {err}")
        except Exception as err:
            logger.error(f"[{source_code}] 第 {page} 页采集失败: {err}")
            db = get_session()
            try:
                db.query(CrawlTask).filter(CrawlTask.id == task.id).update(
                    {"status": "failed", "lastError": str(err)})
                db.commit()
            finally:
                db.close()
            return

    db = get_session()
    try:
        db.query(CrawlTask).filter(CrawlTask.id == task.id).update(
            {"status": "success", "recordCount": inserted,
             "lastRunAt": datetime.now(), "duration": 0})
        db.commit()
    finally:
        db.close()

    db = get_session()
    try:
        source_row = db.query(CrawlSource).filter(CrawlSource.id == source.id).first()
        if source_row is not None:
            source_row.lastCrawlAt = datetime.now()
            source_row.totalCrawled = (source_row.totalCrawled or 0) + inserted + skipped
            db.commit()
    finally:
        db.close()

    logger.info(f"[scheduler] {source_code} 完成: 新增 {inserted}, 跳过 {skipped}")


def _sync_schedules() -> None:
    """对应 TS startScheduler 里的每分钟同步任务"""
    try:
        db = get_session()
        try:
            schedules = db.query(CrawlSchedule).filter(CrawlSchedule.enabled == 1).all()
        finally:
            db.close()

        for sched in schedules:
            db = get_session()
            try:
                source = db.query(CrawlSource).filter(CrawlSource.id == sched.sourceId).first()
            finally:
                db.close()
            if not source:
                continue

            task_key = source.code
            if task_key in _scheduled_tasks:
                continue

            try:
                trigger = CronTrigger.from_crontab(sched.cronExpr)

                def _run(code=source.code):
                    try:
                        execute_schedule(code)
                    except Exception as err:
                        logger.error(f"[scheduler] {code} 执行异常: {err}")

                job = _scheduler.add_job(_run, trigger, id=f"crawl_{task_key}")
                _scheduled_tasks[task_key] = job
                logger.info(f"[scheduler] 注册定时器 {source.code}: {sched.cronExpr}")
            except Exception as err:
                logger.error(f"[scheduler] 注册失败 {source.code} ({sched.cronExpr}): {err}")
    except Exception as err:
        logger.error(f"[scheduler] 同步调度配置失败: {err}")


def start_scheduler() -> None:
    """对应 TS startScheduler（幂等：先停再启）"""
    global _scheduler
    stop_scheduler()

    with _lock:
        _scheduler = BackgroundScheduler()
        # 对应 TS cron.schedule("* * * * *", ...)：每分钟同步一次调度配置
        _scheduler.add_job(_sync_schedules, CronTrigger.from_crontab("* * * * *"), id="_sync")
        _scheduler.start()

    logger.info("[scheduler] 调度器已启动")


def stop_scheduler() -> None:
    """对应 TS stopScheduler（幂等）"""
    global _scheduler
    with _lock:
        _scheduled_tasks.clear()
        if _scheduler is not None:
            try:
                if _scheduler.running:
                    _scheduler.shutdown(wait=False)
            except Exception:
                pass
            _scheduler = None
    logger.info("[scheduler] 调度器已停止")


def list_scheduled_tasks() -> list:
    """对应 TS listScheduledTasks"""
    return list(_scheduled_tasks.keys())


def run_once(source_code: str) -> None:
    """对应 TS runOnce"""
    execute_schedule(source_code)


# 保留 config 引用（与 TS 保持一致的导入面）
_ = config
