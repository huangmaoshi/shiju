"""名言通 Provider

对应 TypeScript 版 crawler/src/providers/mingyan_provider.ts。
"""
from typing import List

from ..engine.deduper import compute_fingerprint, compute_sim_hash
from ..engine.http_client import fetch_with_delay
from ..engine.parser import load
from ..logger import logger
from .base_provider import BaseProvider, EnrichedQuote, RawQuote

CATEGORIES = {
    "life": "/shenghuo/",
    "love": "/aiqing/",
    "work": "/zhichang/",
    "study": "/xuexi/",
    "friendship": "/youqing/",
    "family": "/qinqing/",
    "success": "/chenggong/",
    "time": "/shijian/",
}


def _first_text(el, selector: str) -> str:
    """等价 TS $el.find(selector).first().text().trim()"""
    found = el.select(selector)
    if not found:
        return ""
    return found[0].get_text().strip()


class MingyanProvider(BaseProvider):
    """对应 TS MingyanProvider"""

    code = "mingyan"
    name = "名言通"
    baseUrl = "https://www.mingyantong.com"

    def fetch_list(self, page: int) -> List[RawQuote]:
        items: List[RawQuote] = []

        for category_key, path in CATEGORIES.items():
            url = f"{self.baseUrl}{path}list-{page}.html"
            logger.info(f"[{self.code}] 抓取列表: {url}")

            try:
                resp = fetch_with_delay(url)
                soup = load(resp.body)

                # 对应 TS $(".quote-item, .list-item, .mingyu-list li").each(...)
                for el in soup.select(".quote-item, .list-item, .mingyu-list li"):
                    content = _first_text(el, ".quote-content, .content, p")
                    author = _first_text(el, ".quote-author, .author, .source")
                    a = el.find("a")
                    href = (a.get("href") or "") if a is not None else ""

                    if content and len(content) > 5:
                        item: RawQuote = {
                            "content": content,
                            "source": self.name,
                            "url": href if href.startswith("http") else f"{self.baseUrl}{href}",
                            "categoryType": category_key,
                            "tags": [category_key],
                        }
                        if author:
                            item["author"] = author
                        items.append(item)

                if not items:
                    # 对应 TS 兜底 $("article, .quote, .item")
                    for el in soup.select("article, .quote, .item"):
                        content = el.get_text().strip()
                        if content and 10 < len(content) < 500:
                            items.append({
                                "content": content,
                                "source": self.name,
                                "url": f"{self.baseUrl}{path}",
                                "categoryType": category_key,
                                "tags": [category_key],
                            })
            except Exception as err:
                logger.error(f"[{self.code}] 列表抓取失败 {url}: {err}")

        return items

    def fetch_detail(self, raw: RawQuote) -> EnrichedQuote:
        content = raw.get("content") or ""
        sim_hash = compute_sim_hash(content)
        fingerprint = compute_fingerprint(content)

        enriched: EnrichedQuote = dict(raw)  # type: ignore[assignment]
        enriched["simHash"] = sim_hash
        enriched["fingerprint"] = fingerprint
        enriched["wordCount"] = len(content)
        return enriched
