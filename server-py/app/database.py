"""拾句后端 Python 版 - 数据库连接与 Session

对应 TypeScript 版 PrismaClient。SQLite（开发）/ PostgreSQL / MySQL（生产）
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import config

# SQLite 需要 check_same_thread=False 供 FastAPI 线程池使用
connect_args = {}
if config.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    config.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI 依赖：提供一个数据库 Session，请求结束后关闭"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """创建所有表（等价于 prisma db push）"""
    from . import models  # noqa: F401  确保模型全部注册

    Base.metadata.create_all(bind=engine)
