"""拾句后端 Python 版 - 启动入口

用法：
    python run.py            # 开发模式（自动重载）
    python run.py --no-reload
等价于：
    uvicorn app.main:app --host 0.0.0.0 --port 3000
"""
import argparse
import os
import sys

import uvicorn

from app.config import config


def _fix_console_encoding() -> None:
    """Windows GBK 控制台无法输出 emoji 等非 GBK 字符，宽容处理避免 UnicodeEncodeError 崩溃。"""
    if sys.platform == "win32":
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(errors="replace")
            except Exception:
                pass


_fix_console_encoding()


def main() -> None:
    parser = argparse.ArgumentParser(description="拾句后端 Python 版")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=config.port)
    parser.add_argument("--no-reload", action="store_true", help="关闭自动重载")
    args = parser.parse_args()

    reload_enabled = not args.no_reload and config.node_env != "production"
    print(f"拾句后端启动: http://localhost:{args.port}  (reload={reload_enabled})")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=reload_enabled,
    )


if __name__ == "__main__":
    sys.exit(main())
