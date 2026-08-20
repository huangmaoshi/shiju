# 拾句爬虫 Python 版（crawler）

金句/作文素材采集爬虫，由 `crawler/`（Node.js/TypeScript）完整转换而来。
复用 `server` 的 SQLAlchemy 模型，连接同一个数据库（默认 `server/data/dev.db`），不另建数据库。

## 依赖安装

```bash
pip install -r requirements.txt
```

## 三种运行方式

在 `crawler` 目录下执行（使用项目根的 `.venv`）：

```bash
# 1. 列出可用 Provider 与数据库 CrawlSource
python -m crawler.index --list

# 2. 立即采集：--run 可带源代码（注册的 provider 或数据库 github_* 数据集源），可不带（跑全部）
python -m crawler.index --run github_chinese_poetry_shijing --pages 1
python -m crawler.index --run guwenwen --pages 3
python -m crawler.index --run

# 3. 守护模式：启动 APScheduler 调度器（读取 CrawlSchedule 表），Ctrl+C 优雅退出
python -m crawler.index
```

`--pages N` 默认 5 页。

## 目录结构

```
crawler/
  crawler/
    config.py        # 配置（对应 TS config.ts）
    db.py            # 数据库（sys.path 复用 server 模型，对应 TS db.ts）
    logger.py        # 日志（对应 TS logger.ts）
    scheduler.py     # 调度器（APScheduler CronTrigger，对应 TS scheduler.ts）
    index.py         # CLI 入口（对应 TS index.ts）
    engine/          # deduper / http_client(httpx) / parser(BeautifulSoup)
    processors/      # content_cleaner / db_writer / sensitive_checker
    providers/       # base / factory / github_dataset / guwenwen / mingyan / wikiquote
  requirements.txt
  README.md
```

## 说明

- HTTP：httpx 同步 Client，超时默认 30s（`CRAWL_TIMEOUT`），失败重试 3 次，随机 UA + 随机延迟。
- 去重：复用 `server/app/utils/dedup.py`（MD5 + SimHash）；重复内容更新 `CrawlRecord.auditStatus=3` 后跳过。
- 敏感词：本地词表，命中则 `auditStatus=2` 标记、不入正式 Quote 表。
- 环境变量：`CRAWL_LOG_LEVEL` / `CRAWL_CONCURRENCY` / `CRAWL_TIMEOUT` / `CRAWL_MAX_RETRY` / `CRAWL_DELAY_MIN` / `CRAWL_DELAY_MAX`，读取 `crawler/.env`。
