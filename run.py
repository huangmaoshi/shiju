"""拾句项目一键启动器

同时启动：
  1. server  —— FastAPI 后端（默认 0.0.0.0:6010）
  2. crawler  —— 爬虫守护进程（默认启用调度器）

用法：
    python run.py                          # 同时启动后端 + 爬虫
    python run.py --port 3001              # 指定后端端口
    python run.py --no-crawler             # 只启动后端
    python run.py --no-server              # 只启动爬虫
    python run.py --crawler-no-schedule    # 爬虫只挂起不跑调度（调度交给 server 内建 cron）
    python run.py --no-reload              # 后端关闭热重载

Ctrl+C 优雅退出两个进程。
"""
import argparse
import os
import signal
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SERVER_PY = ROOT / "server"
CRAWLER_PY = ROOT / "crawler"

# Windows GBK 控制台宽容处理，防止输出 emoji 等字符时崩溃
if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        try:
            _stream.reconfigure(errors="replace")
        except Exception:
            pass


# ---------- 解释器 / 工作目录 ----------

def find_python() -> str:
    """优先使用项目根 .venv 的解释器；找不到则用当前解释器。"""
    candidates = [
        ROOT / ".venv" / "Scripts" / "python.exe",   # Windows
        ROOT / ".venv" / "bin" / "python",           # macOS / Linux
    ]
    for cand in candidates:
        if cand.exists():
            return str(cand)
    if os.getenv("VIRTUAL_ENV"):
        venv_py = Path(os.environ["VIRTUAL_ENV"])
        for cand in (venv_py / "Scripts" / "python.exe", venv_py / "bin" / "python"):
            if cand.exists():
                return str(cand)
    return sys.executable


# ---------- 子进程输出打前缀 ----------

def _prefix_reader(stream, prefix: str, level: str) -> None:
    """把子进程 stdout/stderr 逐行加上 [server]/[crawler] 前缀打印出来。"""
    try:
        for line in iter(stream.readline, ""):
            text = line.rstrip("\r\n")
            if text:
                print(f"{prefix} {text}", flush=True)
    except Exception:
        pass
    finally:
        try:
            stream.close()
        except Exception:
            pass


def spawn(args: list, cwd: Path, prefix: str, env: dict | None = None) -> subprocess.Popen:
    """启动子进程并挂上输出前缀线程，返回 Popen 对象。"""
    full_env = dict(os.environ)
    # 强制子进程以 UTF-8 输出（覆盖父进程继承的 PYTHONIOENCODING），
    # 避免 Windows GBK 控制台编码崩溃；父进程按 utf-8 读管道
    full_env["PYTHONIOENCODING"] = "utf-8"
    if env:
        full_env.update(env)
    proc = subprocess.Popen(
        args,
        cwd=str(cwd),
        env=full_env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    threading.Thread(
        target=_prefix_reader, args=(proc.stdout, prefix, "out"), daemon=True
    ).start()
    threading.Thread(
        target=_prefix_reader, args=(proc.stderr, prefix, "err"), daemon=True
    ).start()
    return proc


# ---------- 主流程 ----------

def main() -> int:
    parser = argparse.ArgumentParser(description="拾句项目一键启动（server + crawler）")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"), help="后端监听地址")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "6010")), help="后端端口")
    parser.add_argument("--no-reload", action="store_true", help="后端关闭热重载（默认开发模式开启）")
    parser.add_argument("--no-server", action="store_true", help="不启动后端")
    parser.add_argument("--no-crawler", action="store_true", help="不启动爬虫")
    parser.add_argument(
        "--crawler-no-schedule",
        action="store_true",
        help="爬虫只挂起不启动调度器（采集调度交给 server 内建 cron，避免双跑）",
    )
    args = parser.parse_args()

    python = find_python()
    if not SERVER_PY.exists() and not CRAWLER_PY.exists():
        print(f"[run] 错误：找不到 server 或 crawler 目录（当前根目录 {ROOT}）")
        return 1

    procs: list[tuple[str, subprocess.Popen]] = []

    if not args.no_server:
        if not SERVER_PY.exists():
            print("[run] 警告：server 目录不存在，跳过后端")
        else:
            print(f"[run] 启动后端: {python} run.py --host {args.host} --port {args.port}"
                  f"{'' if args.no_reload else ' (reload)'}")
            procs.append((
                "[server]",
                spawn(
                    [python, "-u", "run.py", "--host", args.host, "--port", str(args.port)]
                    + (["--no-reload"] if args.no_reload else []),
                    cwd=SERVER_PY,
                    prefix="[server]",
                ),
            ))

    if not args.no_crawler:
        if not CRAWLER_PY.exists():
            print("[run] 警告：crawler 目录不存在，跳过爬虫")
        else:
            mode = "守护模式(调度器禁用)" if args.crawler_no_schedule else "守护模式(调度器启用)"
            print(f"[run] 启动爬虫: {python} -m crawler.index  ({mode})")
            env = {"CRAWL_NO_SCHEDULE": "1"} if args.crawler_no_schedule else None
            procs.append((
                "[crawler]",
                spawn([python, "-u", "-m", "crawler.index"], cwd=CRAWLER_PY, prefix="[crawler]", env=env),
            ))

    if not procs:
        print("[run] 没有可启动的进程（同时指定了 --no-server 与 --no-crawler？）")
        return 1

    # ---------- 信号处理：把 Ctrl+C 转给子进程，优雅退出 ----------

    def _shutdown(signum=None, _frame=None):
        print("\n[run] 收到退出信号，正在关闭子进程...")
        for name, proc in procs:
            if proc.poll() is None:
                try:
                    proc.terminate()
                except Exception:
                    pass
        # 等 5 秒，超时强杀
        import time

        deadline = time.time() + 5
        for name, proc in procs:
            try:
                proc.wait(timeout=max(0.1, deadline - time.time()))
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    signal.signal(signal.SIGINT, _shutdown)
    try:
        signal.signal(signal.SIGTERM, _shutdown)
    except (ValueError, OSError):
        pass  # Windows 上 SIGTERM 不可用

    # ---------- 等待：任一子进程退出则整体退出 ----------

    try:
        while True:
            for name, proc in procs:
                code = proc.poll()
                if code is not None:
                    print(f"[run] {name} 已退出 (code={code})，整体退出")
                    _shutdown()
                    return code if code is not None else 0
            import time

            time.sleep(0.5)
    except KeyboardInterrupt:
        _shutdown()
        return 0


if __name__ == "__main__":
    sys.exit(main())
