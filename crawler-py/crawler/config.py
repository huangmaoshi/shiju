"""配置加载

对应 TypeScript 版 crawler/src/config.ts
"""
import os

from dotenv import load_dotenv

# 读取 crawler-py/.env（与 TS 版读取 crawler/.env 对应）
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(_BASE_DIR, ".env"))
load_dotenv()  # 兼容从项目根目录运行


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class Config:
    node_env = os.getenv("NODE_ENV", "development")
    database_url = os.getenv("DATABASE_URL", "")

    log_level = os.getenv("CRAWL_LOG_LEVEL", "debug")

    concurrency = _get_int("CRAWL_CONCURRENCY", 2)
    # 超时（秒），httpx 使用
    timeout = _get_int("CRAWL_TIMEOUT", 30)
    max_retry = _get_int("CRAWL_MAX_RETRY", 3)
    delay_min = _get_int("CRAWL_DELAY_MIN", 1000)  # 毫秒
    delay_max = _get_int("CRAWL_DELAY_MAX", 3000)  # 毫秒

    simhash_threshold = 3
    fingerprint_length = 64


config = Config()
