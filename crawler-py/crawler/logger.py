"""日志

对应 TypeScript 版 crawler/src/logger.ts（winston）。
文件输出 logs/crawler-error.log / logs/crawler-combined.log，
非生产环境额外输出控制台（参考 server-py/app/utils/logger.py）。
"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from .config import config

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

LEVEL = getattr(logging, str(config.log_level).upper(), logging.DEBUG)

logger = logging.getLogger("shiju.crawler")
logger.setLevel(LEVEL)
logger.propagate = False

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

_error_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "crawler-error.log"),
    maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
_error_handler.setLevel(logging.ERROR)
_error_handler.setFormatter(_fmt)
logger.addHandler(_error_handler)

_combined_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "crawler-combined.log"),
    maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
_combined_handler.setLevel(LEVEL)
_combined_handler.setFormatter(_fmt)
logger.addHandler(_combined_handler)

# 开发环境控制台输出
if config.node_env != "production":
    _console = logging.StreamHandler(sys.stdout)
    _console.setLevel(LEVEL)
    _console.setFormatter(_fmt)
    logger.addHandler(_console)
