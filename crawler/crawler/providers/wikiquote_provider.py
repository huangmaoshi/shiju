"""维基语录 Provider

对应 TypeScript 版 crawler/src/providers/wikiquote_provider.ts。
使用 MediaWiki API（allpages + parse wikitext）。
"""
import json
import re
from typing import List
from urllib.parse import urlencode

from ..db import CrawlSource, get_session
from ..engine.deduper import compute_fingerprint, compute_sim_hash
from ..engine.http_client import fetch_with_delay
from ..logger import logger
from .base_provider import BaseProvider, EnrichedQuote, RawQuote

API_PATH = "/w/api.php"
DEFAULT_HOST = "zh.wikiquote.org"
EN_HOST = "en.wikiquote.org"


class WikiquoteProvider(BaseProvider):
    """对应 TS WikiquoteProvider"""

    code = "wikiquote"
    name = "维基语录"
    baseUrl = f"https://{DEFAULT_HOST}"

    def get_remark(self) -> dict:
        """对应 TS getRemark：从 CrawlSource.remark 读 JSON 配置"""
        try:
            db = get_session()
            try:
                source = db.query(CrawlSource).filter(CrawlSource.code == self.code).first()
                if source is not None and source.remark:
                    return json.loads(source.remark)
            finally:
                db.close()
        except Exception as err:
            logger.warning(f"[{self.code}] 读取 CrawlSource remark 失败: {err}")
        return {}

    def resolve_host(self, lang: str = None) -> str:
        return EN_HOST if lang == "en" else DEFAULT_HOST

    def build_api_url(self, host: str, query: dict) -> str:
        params = urlencode({k: str(v) for k, v in query.items()})
        return f"https://{host}{API_PATH}?{params}"

    def fetch_list(self, page: int) -> List[RawQuote]:
        remark = self.get_remark()
        host = self.resolve_host(remark.get("lang"))
        initial_offset = remark.get("offset", "")

        if isinstance(initial_offset, (int, float)):
            offset = str(int(initial_offset) + (page - 1) * 20)
        elif page == 1:
            offset = str(initial_offset)
        else:
            offset = initial_offset

        url = self.build_api_url(host, {
            "action": "query",
            "list": "allpages",
            "aplimit": 20,
            "apoffset": offset,
            "apnamespace": 0,
            "format": "json",
        })

        logger.info(f"[{self.code}] 抓取列表: {url}")

        items: List[RawQuote] = []

        try:
            resp = fetch_with_delay(url)
            data = json.loads(resp.body)
            pages = ((data or {}).get("query") or {}).get("allpages") or []

            for p in pages:
                title = p.get("title", "")
                items.append({
                    "title": title,
                    "content": "",
                    "source": self.name,
                    "url": f"https://{host}/wiki/{_encode_component(title)}",
                    "tags": [self.name, remark.get("lang") or "zh"],
                })
        except Exception as err:
            logger.error(f"[{self.code}] 列表抓取失败: {err}")

        return items

    def fetch_detail(self, raw: RawQuote) -> EnrichedQuote:
        content = raw.get("content") or ""

        if raw.get("title"):
            remark = self.get_remark()
            host = self.resolve_host(remark.get("lang"))

            url = self.build_api_url(host, {
                "action": "parse",
                "page": raw["title"],
                "prop": "wikitext",
                "format": "json",
            })

            try:
                resp = fetch_with_delay(url)
                data = json.loads(resp.body)
                wikitext = ((data or {}).get("parse") or {}).get("wikitext", {}).get("*", "")
                content = self.extract_quotes(wikitext)
            except Exception as err:
                logger.warning(f"[{self.code}] 详情抓取失败 {raw['title']}: {err}")

        sim_hash = compute_sim_hash(content)
        fingerprint = compute_fingerprint(content)

        enriched: EnrichedQuote = dict(raw)  # type: ignore[assignment]
        enriched["content"] = content
        enriched["simHash"] = sim_hash
        enriched["fingerprint"] = fingerprint
        enriched["wordCount"] = len(content)
        return enriched

    def extract_quotes(self, wikitext: str) -> str:
        """对应 TS extractQuotes"""
        lines = wikitext.split("\n")
        quotes: List[str] = []
        in_blockquote = False
        blockquote_buf: List[str] = []

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue

            if (re.search(r"<blockquote[\s>]", line, re.I)
                    or re.match(r"\{\{quote", line, re.I)
                    or re.match(r"\{\{quotation", line, re.I)):
                in_blockquote = True
                blockquote_buf = []
                inner = re.sub(r"^.*?<blockquote[^>]*>", "", line, flags=re.I)
                inner = re.sub(r"^\{\{[a-zA-Z]+\|?", "", inner)
                if inner and not re.match(r"^</blockquote", line, re.I):
                    blockquote_buf.append(inner)
                continue

            if in_blockquote:
                if re.search(r"</blockquote", line, re.I) or (
                        re.match(r"^\}\}", line) and not line.startswith("{{")):
                    tail = re.sub(r"</blockquote.*$", "", line, flags=re.I)
                    tail = re.sub(r"^\}\}", "", tail)
                    if tail:
                        blockquote_buf.append(tail)
                    cleaned = self.clean_wiki_markup(" ".join(blockquote_buf))
                    if cleaned and len(cleaned) > 3:
                        quotes.append(cleaned)
                    in_blockquote = False
                    blockquote_buf = []
                else:
                    blockquote_buf.append(line)
                continue

            if re.match(r"^\*{1,4}\s", line):
                body = re.sub(r"^\*{1,4}\s*", "", line)
                cleaned = self.clean_wiki_markup(body)
                if cleaned and len(cleaned) > 5 and not self.is_meta_line(cleaned):
                    quotes.append(cleaned)

        if not quotes:
            cleaned = self.clean_wiki_markup(wikitext)
            sentences = re.split(r"[。！？.!?\n]{1,}", cleaned)
            for s in sentences:
                trimmed = s.strip()
                if 10 < len(trimmed) < 500 and not self.is_meta_line(trimmed):
                    quotes.append(trimmed)

        unique = list(dict.fromkeys(quotes))
        return "\n".join(unique)

    def is_meta_line(self, text: str) -> bool:
        """对应 TS isMetaLine"""
        lowered = text.lower()
        return (
            lowered.startswith("维基语录")
            or lowered.startswith("本条目")
            or lowered.startswith("参见")
            or lowered.startswith("外部链接")
            or lowered.startswith("参考文献")
            or "category:" in lowered
            or bool(re.match(r"^\[\[分类:", text))
        )

    def clean_wiki_markup(self, text: str) -> str:
        """对应 TS cleanWikiMarkup"""
        result = text

        result = re.sub(r"<ref[^>]*>[\s\S]*?</ref>", "", result, flags=re.I)
        result = re.sub(r"<ref[^>]*/?>", "", result, flags=re.I)
        result = re.sub(r"<nowiki>[\s\S]*?</nowiki>", "", result, flags=re.I)
        result = re.sub(r"<!--[\s\S]*?-->", "", result)

        result = re.sub(r"</?(?:div|span|blockquote|p|br|hr|li|ul|ol)[^>]*>", "", result, flags=re.I)

        def _link_repl(m):
            target = (m.group(2) or "").strip()
            if target.startswith(("Image:", "File:", "Category:")):
                return ""
            return target

        result = re.sub(r"\[\[([^\|\]]*\|)?([^\]]*)\]\]", _link_repl, result)

        result = re.sub(r"\{\{[^{}]*\}\}", "", result)
        result = re.sub(r"\{\|[^}]*\|\}", "", result)

        result = result.replace("'''", "")
        result = result.replace("''", "")

        result = re.sub(r"^\s*[|!].*$", "", result, flags=re.M)
        result = re.sub(r"^\s*[:*#]{1,5}\s*", "", result, flags=re.M)
        result = re.sub(r"^\s*\{\|.*$", "", result, flags=re.M)
        result = re.sub(r"^\s*\|\}.*$", "", result, flags=re.M)

        result = re.sub(r"\s+", " ", result).strip()

        return result


def _encode_component(value: str) -> str:
    """对应 TS encodeURIComponent"""
    from urllib.parse import quote
    return quote(value, safe="!'()*-._~")
