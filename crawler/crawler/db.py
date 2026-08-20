"""数据库访问

对应 TypeScript 版 crawler/src/db.ts（PrismaClient）。
复用 server 的 SQLAlchemy 模型，连同一个数据库（默认 server/data/dev.db），
不另建数据库。crawler 非常驻 web 服务，每次操作自行开 Session、用完即关。
"""
import os
import sys

_SERVER_PY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "server"))
if _SERVER_PY not in sys.path:
    sys.path.insert(0, _SERVER_PY)

from app.database import SessionLocal, engine  # noqa: E402
from app.models import (CrawlRecord, CrawlSource, CrawlTask, OriginalText,  # noqa: E402
                        Quote, QuoteCategory, Category, CrawlSchedule)
import app.models  # noqa: E402,F401  确保所有模型注册到 Base.metadata


def get_session():
    """获取一个新的数据库 Session，调用方负责关闭"""
    return SessionLocal()


__all__ = [
    "SessionLocal",
    "engine",
    "CrawlRecord",
    "CrawlSource",
    "CrawlTask",
    "OriginalText",
    "Quote",
    "QuoteCategory",
    "Category",
    "CrawlSchedule",
    "get_session",
]
