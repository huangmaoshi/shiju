"""GitHub 开源数据集 Provider

对应 TypeScript 版 crawler/src/providers/github_dataset_provider.ts。
从 GitHub raw JSON 拉取数据集（chinese-poetry 等），
remark 为 "owner/repo/branch/path/to.json"，拼到 baseUrl 之后。
"""
import json
from typing import List, Optional

from ..engine.deduper import compute_fingerprint, compute_sim_hash
from ..engine.http_client import fetch
from ..logger import logger
from .base_provider import BaseProvider, EnrichedQuote, RawQuote


def extract_content(item: dict) -> Optional[str]:
    """对应 TS extractContent：依次取 content/quote/text

    扩展：content 为字符串数组时扁平化（用换行拼接，如 chinese-poetry 的诗经数据集）。
    """
    for key in ("content", "quote", "text"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list):
            parts = [p for p in v if isinstance(p, str) and p.strip()]
            if parts:
                return "\n".join(p.strip() for p in parts)
    return None


def extract_author(item: dict) -> Optional[str]:
    """对应 TS extractAuthor：author 或 作者"""
    author = item.get("author")
    if isinstance(author, str) and author.strip():
        return author.strip()
    author_cn = item.get("作者")
    if isinstance(author_cn, str) and author_cn.strip():
        return author_cn.strip()
    return None


def extract_tags(item: dict) -> Optional[List[str]]:
    """对应 TS extractTags"""
    tags = item.get("tags")
    if isinstance(tags, list) and len(tags) > 0:
        return [t for t in tags if isinstance(t, str)]
    category_type = item.get("categoryType")
    if isinstance(category_type, str) and category_type.strip():
        return [category_type.strip()]
    return None


class GithubDatasetProvider(BaseProvider):
    """对应 TS GithubDatasetProvider"""

    code = "github_dataset"
    name = "GitHub开源数据集"
    baseUrl = "https://raw.githubusercontent.com"

    def __init__(self, remark: str = None):
        self.remark = remark

    def build_url(self) -> str:
        return f"{self.baseUrl}/{self.remark}"

    def parse_json(self, raw) -> List[dict]:
        """对应 TS parseJson：数组 / {data:[...]} / {items:[...]}"""
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            if isinstance(raw.get("data"), list):
                return raw["data"]
            if isinstance(raw.get("items"), list):
                return raw["items"]
        return []

    def fetch_list(self, page: int) -> List[RawQuote]:
        if not self.remark:
            logger.warning(f"[{self.code}] remark 未配置，跳过采集")
            return []

        url = self.build_url()
        logger.info(f"[{self.code}] 下载数据集: {url}")

        try:
            resp = fetch(url, timeout=30)
            records = self.parse_json(json.loads(resp.text))
            logger.info(f"[{self.code}] 解析到 {len(records)} 条记录")

            result: List[RawQuote] = []
            for item in records:
                content = extract_content(item)
                if not content or len(content) < 2:
                    continue

                title = item.get("title")
                source = item.get("source")
                category_type = item.get("categoryType")
                raw: RawQuote = {
                    "content": content,
                    "url": url,
                }
                if isinstance(title, str):
                    raw["title"] = title
                author = extract_author(item)
                if author:
                    raw["author"] = author
                if isinstance(source, str):
                    raw["source"] = source
                tags = extract_tags(item)
                if tags:
                    raw["tags"] = tags
                if isinstance(category_type, str):
                    raw["categoryType"] = category_type

                result.append(raw)

            return result
        except Exception as err:
            logger.error(f"[{self.code}] 下载失败 {url}: {err}")
            return []

    def fetch_detail(self, raw: RawQuote) -> EnrichedQuote:
        sim_hash = compute_sim_hash(raw.get("content") or "")
        fingerprint = compute_fingerprint(raw.get("content") or "")

        enriched: EnrichedQuote = dict(raw)  # type: ignore[assignment]
        enriched["simHash"] = sim_hash
        enriched["fingerprint"] = fingerprint
        enriched["wordCount"] = len(raw.get("content") or "")
        return enriched
