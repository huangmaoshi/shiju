"""定时采集调度服务（基于 cron 表达式调度 CrawlSchedule）

对应 TypeScript 版 server/src/services/cron_service.ts
- 使用 APScheduler BackgroundScheduler + CronTrigger.from_crontab
- start()/stop() 幂等，server 启动时调用 start()
- 每次任务执行在独立后台线程（apscheduler job 线程池），
  内部通过 SessionLocal() 新建独立会话（后台线程不允许复用请求注入的 session）
"""
import re
import threading
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..database import SessionLocal
from ..models import CrawlSchedule, CrawlSource, CrawlTask
from ..utils.crawl_url import resolve_github_raw_url
from ..utils.logger import logger
from .github_import_service import import_from_github_raw

_JSON_URL_RE = re.compile(r"\.json(?:$|\?)", re.IGNORECASE)


def _validate_cron(expr: str) -> bool:
    try:
        CronTrigger.from_crontab(expr)
        return True
    except Exception:
        return False


def compute_next_run(cron_expr: str):
    """估算下次运行时间（与 TS 版一致：下次触发时刻取 +1 分钟整分）"""
    try:
        if not _validate_cron(cron_expr):
            return None
        d = datetime.now() + timedelta(minutes=1)
        return d.replace(second=0, microsecond=0)
    except Exception:
        return None


def _run_schedule(schedule_id: int) -> None:
    """执行一次定时采集任务（后台线程，独立 db session，try/except 兜底不崩线程）"""
    db = SessionLocal()
    try:
        schedule = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
        if not schedule or not schedule.enabled:
            return

        schedule.lastRunStatus = "running"
        schedule.lastRunAt = datetime.now()
        schedule.lastError = None
        db.commit()

        source = db.query(CrawlSource).filter(CrawlSource.id == schedule.sourceId).first()
        if not source:
            schedule.lastRunStatus = "failed"
            schedule.lastError = "采集源不存在"
            db.commit()
            return

        raw_url = resolve_github_raw_url(source.remark, source.baseUrl)
        if not raw_url or not _JSON_URL_RE.search(raw_url):
            schedule.lastRunStatus = "failed"
            schedule.lastError = f"URL 无效: {raw_url or '(空)'}"
            db.commit()
            return

        task = CrawlTask(
            sourceId=source.id,
            url=raw_url,
            provider=source.type,
            status="running",
            startAt=datetime.now(),
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        try:
            result = import_from_github_raw(db, {
                "rawUrl": raw_url,
                "taskId": task.id,
                "sourceId": source.id,
                "sourceName": source.name,
                "complianceTag": source.complianceTag,
                "protocol": source.protocol,
                "provider": source.type,
                "categoryType": source.categoryType,
            })

            task.status = "success"
            task.endAt = datetime.now()
            task.totalCount = result.get("totalFetched", 0)
            task.newCount = result.get("totalInserted", 0)
            task.recordCount = result.get("originalTextsInserted", 0)
            skipped = result.get("totalSkipped", 0)
            task.lastError = (
                f"去重跳过 {skipped} 条 (MD5={result.get('skippedReason', {}).get('md5', 0)}, "
                f"SimHash={result.get('skippedReason', {}).get('simhash', 0)})"
                if skipped > 0
                else None
            )
            db.commit()

            source.lastRunAt = datetime.now()
            source.lastCrawlAt = datetime.now()
            source.totalCrawled = (source.totalCrawled or 0) + result.get("originalTextsInserted", 0)
            db.commit()

            schedule.lastRunStatus = "success"
            schedule.lastRunCount = (schedule.lastRunCount or 0) + result.get("originalTextsInserted", 0)
            schedule.nextRunAt = compute_next_run(schedule.cronExpr)
            db.commit()
        except Exception as err:
            db.rollback()
            task.status = "failed"
            task.endAt = datetime.now()
            task.lastError = str(err)[:500]
            db.commit()
            schedule.lastRunStatus = "failed"
            schedule.lastError = str(err)[:500]
            schedule.nextRunAt = compute_next_run(schedule.cronExpr)
            db.commit()
            logger.error(f"[CronScheduler] schedule #{schedule_id} error: {err}")
    except Exception as err:
        logger.error(f"[CronScheduler] schedule #{schedule_id} fatal: {err}")
    finally:
        db.close()


class CronScheduler:
    """cron 调度器（对应 TS cronScheduler）。start/stop 幂等。"""

    def __init__(self):
        self._scheduler = None
        self._jobs = {}

    # ---- 生命周期（幂等） ----

    def start(self) -> None:
        if self._scheduler and self._scheduler.running:
            return
        self._scheduler = BackgroundScheduler()
        self._scheduler.start()
        self._reload_from_db()

    def start_all(self) -> None:
        self.start()

    def stop(self) -> None:
        if self._scheduler and self._scheduler.running:
            self._scheduler.shutdown(wait=False)
        self._scheduler = None
        self._jobs = {}

    def stop_all(self) -> None:
        self.stop()

    # ---- 内部 ----

    def _reload_from_db(self) -> None:
        db = SessionLocal()
        try:
            schedules = db.query(CrawlSchedule).filter(CrawlSchedule.enabled == 1).all()
            for s in schedules:
                self.register(s.id)
            logger.info(f"[CronScheduler] loaded {len(schedules)} schedules")
        finally:
            db.close()

    # ---- 对外操作 ----

    def register(self, schedule_id: int) -> None:
        """注册（或重新注册）一个定时任务，覆盖同 id 旧任务"""
        self.unregister(schedule_id)
        if not self._scheduler or not self._scheduler.running:
            logger.warning("[CronScheduler] scheduler not running, skip register")
            return
        db = SessionLocal()
        try:
            schedule = db.query(CrawlSchedule).filter(CrawlSchedule.id == schedule_id).first()
            if not schedule or not schedule.enabled:
                return
            if not _validate_cron(schedule.cronExpr):
                logger.warning(f'[CronScheduler] invalid cron "{schedule.cronExpr}" for schedule #{schedule.id}')
                return
            job = self._scheduler.add_job(
                _run_schedule,
                CronTrigger.from_crontab(schedule.cronExpr),
                args=[schedule.id],
                id=f"crawl_schedule_{schedule.id}",
                replace_existing=True,
                misfire_grace_time=3600,
            )
            self._jobs[schedule.id] = job
            logger.info(f"[CronScheduler] schedule #{schedule.id} (source {schedule.sourceId}) registered: {schedule.cronExpr}")
        finally:
            db.close()

    def unregister(self, schedule_id: int) -> None:
        job = self._jobs.pop(schedule_id, None)
        if job is not None and self._scheduler and self._scheduler.running:
            try:
                self._scheduler.remove_job(job.id)
            except Exception:
                pass

    def trigger_now(self, schedule_id: int) -> None:
        """手动触发一次（后台线程执行，不阻塞调用方）"""
        threading.Thread(target=_run_schedule, args=(schedule_id,), daemon=True).start()

    def list(self) -> list:
        return list(self._jobs.keys())


cron_scheduler = CronScheduler()


def start() -> None:
    cron_scheduler.start()


def stop() -> None:
    cron_scheduler.stop()
