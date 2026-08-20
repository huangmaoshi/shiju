"""HTTP 客户端

对应 TypeScript 版 crawler/src/engine/http_client.ts（got）。
使用 httpx 同步 Client：超时 / 重试 / 随机 UA / 跟随重定向。
"""
import random
import time

import httpx

from ..config import config
from ..logger import logger

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
]

# 与 got retry.statusCodes 一致
RETRY_STATUS_CODES = {408, 429, 500, 502, 503, 504}
# backoffLimit: 5000ms
BACKOFF_LIMIT_MS = 5000

DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def random_ua() -> str:
    return random.choice(USER_AGENTS)


def random_delay(delay_min: int = None, delay_max: int = None) -> None:
    """随机休眠（毫秒）"""
    if delay_min is None:
        delay_min = config.delay_min
    if delay_max is None:
        delay_max = config.delay_max
    ms = random.randint(delay_min, max(delay_min, delay_max))
    time.sleep(ms / 1000.0)


def sleep(ms: int) -> None:
    """对应 TS sleep(ms)"""
    time.sleep(ms / 1000.0)


_client: httpx.Client | None = None


def get_client() -> httpx.Client:
    """惰性创建共享的 httpx Client（对应 TS got.extend）"""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.Client(
            timeout=config.timeout,
            follow_redirects=True,
            verify=False,  # 对应 TS https.rejectUnauthorized: false
            headers=dict(DEFAULT_HEADERS),
        )
    return _client


def close_client() -> None:
    global _client
    if _client is not None and not _client.is_closed:
        _client.close()
    _client = None


class HttpResponse:
    """对应 TS HttpResponse 接口"""

    def __init__(self, url: str, status_code: int, text: str, headers: dict):
        self.url = url
        self.status_code = status_code
        self.text = text
        # 兼容 TS 的 body 字段命名
        self.body = text
        self.headers = headers

    def json(self):
        import json
        return json.loads(self.text)


def fetch(url: str, timeout: int = None, headers: dict = None) -> HttpResponse:
    """GET 请求，带重试（对应 TS fetch）

    失败重试 config.max_retry 次，可重试状态码：408/429/500/502/503/504。
    每次请求随机 UA。
    """
    logger.debug(f"HTTP GET {url}")
    client = get_client()
    request_headers = dict(headers or {})
    retries = 0

    while True:
        request_headers["User-Agent"] = random_ua()
        try:
            response = client.get(url, headers=request_headers, timeout=timeout)
            if response.status_code in RETRY_STATUS_CODES and retries < config.max_retry:
                raise httpx.HTTPStatusError(
                    f"HTTP {response.status_code}",
                    request=response.request, response=response)
            return HttpResponse(
                url=str(response.url),
                status_code=response.status_code,
                text=response.text,
                headers=dict(response.headers),
            )
        except Exception as err:
            if retries < config.max_retry:
                retries += 1
                backoff = min(1000 * (2 ** (retries - 1)), BACKOFF_LIMIT_MS)
                logger.warning(f"HTTP 请求失败（第 {retries} 次重试） {url}: {err}")
                sleep(backoff)
                continue
            logger.error(f"HTTP 请求失败 {url}: {err}")
            raise


def fetch_with_delay(url: str, timeout: int = None, headers: dict = None,
                     delay_min: int = None, delay_max: int = None) -> HttpResponse:
    """随机延迟后再请求（对应 TS fetchWithDelay）"""
    random_delay(delay_min, delay_max)
    return fetch(url, timeout=timeout, headers=headers)
