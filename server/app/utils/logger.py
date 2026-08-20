"""日志工具

对应 TypeScript 版 server/src/utils/logger.ts（winston）
生产环境写入文件，开发环境额外输出彩色控制台。
"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from ..config import config

# Windows 控制台默认 GBK，无法输出 emoji 等字符；宽容处理避免日志打印直接崩溃
if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")
        except Exception:
            pass

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

LEVEL = getattr(logging, str(config.log_level).upper(), logging.INFO)

logger = logging.getLogger("shiju")
logger.setLevel(LEVEL)
logger.propagate = False

_fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
_json_fmt = logging.Formatter('{"time":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}')

# 文件输出
error_handler = RotatingFileHandler(os.path.join(LOG_DIR, "error.log"), maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(_json_fmt)
logger.addHandler(error_handler)

combined_handler = RotatingFileHandler(os.path.join(LOG_DIR, "combined.log"), maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
combined_handler.setLevel(LEVEL)
combined_handler.setFormatter(_json_fmt)
logger.addHandler(combined_handler)

# 开发环境控制台输出
if config.node_env != "production":
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(LEVEL)
    console.setFormatter(_fmt)
    logger.addHandler(console)
