"""crawler 入口 shim：支持 `python index.py --list` / `--run ...` 直接运行"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from crawler.index import main  # noqa: E402

if __name__ == "__main__":
    main()
