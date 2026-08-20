"""古诗文网 Provider

对应 TypeScript 版 crawler/src/providers/guwenwen_provider.ts。
"""
import re
from typing import List

from ..engine.deduper import compute_fingerprint, compute_sim_hash
from ..engine.http_client import fetch_with_delay
from ..engine.parser import load
from ..logger import logger
from .base_provider import BaseProvider, EnrichedQuote, RawQuote

CATEGORIES = {
    "mingju": {"path": "/mingju/", "type": "古诗文名句"},
    "shige": {"path": "/shige/", "type": "古诗"},
    "ci": {"path": "/ci/", "type": "宋词"},
    "wenyanwen": {"path": "/wenyanwen/", "type": "文言文"},
}


class GuwenwenProvider(BaseProvider):
    """对应 TS GuwenwenProvider"""

    code = "guwenwen"
    name = "古诗文网"
    baseUrl = "https://www.gushiwen.cn"

    def fetch_list(self, page: int) -> List[RawQuote]:
        items: List[RawQuote] = []

        for category_key, meta in CATEGORIES.items():
            url = f"{self.baseUrl}{meta['path']}default.aspx?page={page}"
            logger.info(f"[{self.code}] 抓取列表: {url}")

            try:
                resp = fetch_with_delay(url)
                soup = load(resp.body)

                # 对应 TS $(".sons .cont, .typecont .cont").each(...)
                for el in soup.select(".sons .cont, .typecont .cont"):
                    yizhu = el.select_one(".yizhu")
                    content_text = ""
                    if yizhu is not None:
                        content_text = yizhu.get_text().strip()
                    if not content_text:
                        p = el.find("p")
                        if p is not None:
                            content_text = p.get_text().strip()

                    b = el.find("b")
                    title = b.get_text().strip() if b is not None else ""

                    source_el = el.select_one(".source")
                    author_src = ""
                    if source_el is not None:
                        author_src = re.sub(r"[〔〕]", "", source_el.get_text()).strip()

                    a = el.find("a")
                    href = (a.get("href") or "") if a is not None else ""

                    if content_text and len(content_text) > 5:
                        item: RawQuote = {
                            "content": re.sub(r"^(译|注)", "", content_text).strip(),
                            "source": title or meta["type"],
                            "url": href if href.startswith("http") else f"{self.baseUrl}{href}",
                            "categoryType": meta["type"],
                            "tags": [category_key, meta["type"]],
                        }
                        if title:
                            item["title"] = title
                        if author_src:
                            item["author"] = author_src
                        items.append(item)
            except Exception as err:
                logger.error(f"[{self.code}] 列表抓取失败 {url}: {err}")

        return items

    def fetch_detail(self, raw: RawQuote) -> EnrichedQuote:
        detail_content = raw.get("content") or ""

        try:
            url = raw.get("url") or ""
            if url and url.startswith("http"):
                resp = fetch_with_delay(url)
                soup = load(resp.body)
                full_text = ""
                cont = soup.select_one(".contyishu .cont")
                if cont is not None:
                    full_text = cont.get_text().strip()
                if not full_text:
                    wencont = soup.select_one(".wencont")
                    if wencont is not None:
                        full_text = wencont.get_text().strip()
                if full_text and len(full_text) > len(detail_content):
                    detail_content = full_text
        except Exception as err:
            logger.warning(f"[{self.code}] 详情抓取失败 {raw.get('url')}: {err}")

        sim_hash = compute_sim_hash(detail_content)
        fingerprint = compute_fingerprint(detail_content)

        enriched: EnrichedQuote = dict(raw)  # type: ignore[assignment]
        enriched["content"] = detail_content
        enriched["simHash"] = sim_hash
        enriched["fingerprint"] = fingerprint
        enriched["wordCount"] = len(detail_content)
        return enriched
