"""采集源 URL 解析与连通性检查

对应 TypeScript 版 server/src/utils/crawl_url.ts
"""
import re
import time
from typing import Optional
from urllib.parse import quote

import httpx

_GITHUB_TAIL_RE = re.compile(r"^[\w.\-%\u4e00-\u9fa5]+/[\w.\-%\u4e00-\u9fa5]+/.+$")
_ASCII_SEG_RE = re.compile(r"^[\w.\-%]+$")
_HTTP_RE = re.compile(r"^https?://", re.IGNORECASE)


def resolve_github_raw_url(remark: Optional[str], base_url: str) -> Optional[str]:
    """解析 GitHub 直链 URL，解析失败返回 None"""
    remark = (remark or "").strip()
    base = (base_url or "").strip()

    if remark and _HTTP_RE.match(remark):
        return remark

    if base and _HTTP_RE.match(base):
        tail = remark
        if not tail:
            return base
        if _GITHUB_TAIL_RE.match(tail):
            sep = "" if base.endswith("/") else "/"
            encoded_tail = "/".join(
                seg if _ASCII_SEG_RE.match(seg) else quote(seg, safe="")
                for seg in tail.split("/")
            )
            return f"{base}{sep}{encoded_tail}"
    return None


def check_url_reachable(raw_url: str, timeout_ms: int = 10000) -> dict:
    """HEAD + GET 回退连通性检查。返回 { url, ok, status, statusText, latencyMs }"""
    started_at = time.time()

    def attempt(method: str) -> dict:
        try:
            r = httpx.request(
                method,
                raw_url,
                headers={"User-Agent": "ShiJu-Crawler/1.0"},
                follow_redirects=True,
                timeout=timeout_ms / 1000.0,
            )
            if method == "GET":
                # 只读首块，避免下载过大文件
                try:
                    r.read()
                except Exception:
                    pass
            return {"ok": r.is_success, "status": r.status_code, "statusText": r.reason_phrase or ""}
        except httpx.TimeoutException:
            return {"ok": False, "status": 0, "statusText": f"请求超时({timeout_ms}ms)"}
        except Exception as e:
            return {"ok": False, "status": 0, "statusText": str(e)[:120]}

    r = attempt("HEAD")
    # 部分 CDN 不支持 HEAD，退回 GET
    if not r["ok"] and r["status"] not in (404, 403):
        r2 = attempt("GET")
        if r2["ok"] or r2["status"] in (404, 403):
            r = r2

    return {
        "url": raw_url,
        "ok": r["ok"],
        "status": r["status"],
        "statusText": r.get("statusText") or "",
        "latencyMs": int((time.time() - started_at) * 1000),
    }
