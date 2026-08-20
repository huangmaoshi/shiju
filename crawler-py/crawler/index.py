"""CLI 入口

对应 TypeScript 版 crawler/src/index.ts。
三种运行方式：
  python index.py --list                     列出 provider 与数据库 CrawlSource
  python index.py --run [sourceCode] [--pages N]   立即采集（--run 可带值可不带值）
  python index.py                            守护模式（启动调度器，SIGINT/SIGTERM 优雅退出）
"""
import signal
import sys
import threading
from datetime import datetime

from .config import config
from .db import CrawlSource, CrawlTask, get_session
from .engine.http_client import close_client
from .logger import logger
from .processors.db_writer import write_quote
from .providers.factory import get_all_providers, get_provider, list_providers
from . import scheduler


def parse_args(argv=None) -> dict:
    """对应 TS parseArgs：--key value 或 --key（flag）"""
    args = {}
    raw = sys.argv[1:] if argv is None else argv

    i = 0
    while i < len(raw):
        token = raw[i]
        if token.startswith("--"):
            key = token[2:]
            nxt = raw[i + 1] if i + 1 < len(raw) else None
            if nxt and not nxt.startswith("--"):
                args[key] = nxt
                i += 1
            else:
                args[key] = True
        i += 1
    return args


def cmd_list() -> None:
    """对应 TS cmdList"""
    providers = list_providers()
    print("\n可用 Provider 列表:")
    for code in providers:
        p = get_provider(code)
        if p:
            print(f"  - {code:<20} {p.name} ({p.baseUrl})")

    db = get_session()
    try:
        sources = db.query(CrawlSource).all()
    finally:
        db.close()

    if sources:
        print("\n数据库 CrawlSource 列表:")
        for s in sources:
            print(f"  [{s.id}] {s.code:<40} {s.name}  status={s.status}  total={s.totalCrawled}")


def resolve_provider(source_code: str):
    """根据 code 解析 provider：先查注册表，再回退数据库 CrawlSource（github 数据集源）"""
    provider = get_provider(source_code)
    if provider is not None:
        return provider

    db = get_session()
    try:
        source = db.query(CrawlSource).filter(CrawlSource.code == source_code).first()
    finally:
        db.close()

    if source is not None and source.type == "github":
        from .providers.github_dataset_provider import GithubDatasetProvider
        return GithubDatasetProvider(remark=source.remark)

    return None


def cmd_run(source_code: str = None, pages: str = None) -> None:
    """对应 TS cmdRun"""
    page_count = int(pages) if pages else 5

    if source_code:
        provider = resolve_provider(source_code)
        if provider is None:
            print(f"Provider 不存在: {source_code}")
            print(f"可用: {', '.join(list_providers())}")
            sys.exit(1)
        run_provider(provider, page_count, source_code)
    else:
        for p in get_all_providers():
            run_provider(p, page_count)


def run_provider(provider, pages: int, source_code: str = None) -> None:
    """对应 TS runProvider"""
    if provider is None:
        return

    source = ensure_crawl_source(provider, source_code)

    print(f"\n===== 开始采集 [{provider.code}] {provider.name} ({pages} 页) =====")

    inserted = 0
    skipped = 0
    failed = 0

    db = get_session()
    try:
        task = CrawlTask(
            sourceId=source.id,
            url=provider.baseUrl,
            status="running",
            maxRetry=config.max_retry,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
    finally:
        db.close()

    for page in range(1, pages + 1):
        try:
            raw_list = provider.fetch_list(page)
            if not raw_list:
                print(f"  第 {page} 页无数据，停止")
                break

            print(f"  第 {page} 页获取 {len(raw_list)} 条")

            for raw in raw_list:
                try:
                    enriched = provider.fetch_detail(raw)
                    result = write_quote(enriched, source.id, task.id)
                    if result["status"] == "inserted":
                        inserted += 1
                    else:
                        skipped += 1
                except Exception as err:
                    failed += 1
                    logger.error(f"处理失败: {err}")
        except Exception as err:
            failed += 1
            logger.error(f"第 {page} 页失败: {err}")

    db = get_session()
    try:
        db.query(CrawlTask).filter(CrawlTask.id == task.id).update(
            {"status": "success", "recordCount": inserted, "lastRunAt": datetime.now()})
        db.commit()
    finally:
        db.close()

    db = get_session()
    try:
        source_row = db.query(CrawlSource).filter(CrawlSource.id == source.id).first()
        if source_row is not None:
            source_row.lastCrawlAt = datetime.now()
            source_row.lastRunAt = datetime.now()
            source_row.totalCrawled = (source_row.totalCrawled or 0) + inserted + skipped
            db.commit()
    finally:
        db.close()

    print(f"  结果: 新增 {inserted}, 跳过 {skipped}, 失败 {failed}")


def ensure_crawl_source(provider, source_code: str = None):
    """对应 TS ensureCrawlSource（按 code 查找，不存在则自动创建）"""
    code = source_code or provider.code
    db = get_session()
    try:
        source = db.query(CrawlSource).filter(CrawlSource.code == code).first()
        if source is None:
            source = CrawlSource(
                name=provider.name,
                code=provider.code,
                baseUrl=provider.baseUrl,
                type="quote",
                status=1,
                qpsLimit=config.concurrency,
            )
            db.add(source)
            db.commit()
            db.refresh(source)
            logger.info(f"自动创建 CrawlSource: {provider.code}")
        return source
    finally:
        db.close()


def start_daemon() -> None:
    """对应 TS startDaemon：守护模式 + SIGINT/SIGTERM 优雅退出

    环境变量 CRAWL_NO_SCHEDULE=1 时只挂起等待信号、不启动调度器
    （用于 run.py 一键启动场景：采集调度已由 server 内建 cron 承担，避免双跑）。
    """
    import os as _os

    no_schedule = _os.getenv("CRAWL_NO_SCHEDULE", "") == "1"
    if no_schedule:
        print("守护模式（调度器已禁用，CRAWL_NO_SCHEDULE=1）\n")
    else:
        print("以守护模式启动，调度器已激活\n")
        scheduler.start_scheduler()

    stop_event = threading.Event()

    def _handle_signal(signum, frame):
        print(f"\n收到信号 {signum}，正在退出...")
        if not no_schedule:
            scheduler.stop_scheduler()
        close_client()
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    stop_event.wait()


def main() -> None:
    """对应 TS main"""
    args = parse_args()

    try:
        if args.get("list"):
            cmd_list()
            return

        if "run" in args:
            run = args["run"]
            source_code = run if isinstance(run, str) else None
            pages = args.get("pages") if isinstance(args.get("pages"), str) else None
            cmd_run(source_code, pages)
            return

        start_daemon()
    finally:
        close_client()


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as err:
        print(f"[crawler] 启动失败: {err}")
        sys.exit(1)
