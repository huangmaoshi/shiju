"""拾句后端 Python 版 - 配置加载

对应 TypeScript 版 server/src/config/index.ts
"""
import os

from dotenv import load_dotenv

# 从 server-py/.env 或项目根 .env 加载环境变量
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


class Config:
    port: int = _get_int("PORT", 3000)
    node_env: str = os.getenv("NODE_ENV", "development")
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_expires_in: str = os.getenv("JWT_EXPIRES_IN", "2h")
    database_url: str = os.getenv("DATABASE_URL", "")
    log_level: str = os.getenv("LOG_LEVEL", "info")
    admin_key: str = os.getenv("ADMIN_KEY", "")


config = Config()

# 默认 SQLite 数据库路径（server-py/data/dev.db），与 Node 版 server/data/dev.db 对应
if not config.database_url:
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)
    config.database_url = f"sqlite:///{os.path.join(data_dir, 'dev.db')}"
