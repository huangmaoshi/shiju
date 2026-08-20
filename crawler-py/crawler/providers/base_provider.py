"""Provider 基类

对应 TypeScript 版 crawler/src/providers/base_provider.ts。
RawQuote / EnrichedQuote 用 TypedDict 描述，与 TS 字段一致。
"""
from abc import ABC, abstractmethod
from typing import TypedDict, Optional, List


class RawQuote(TypedDict, total=False):
    title: Optional[str]
    content: str  # required
    author: Optional[str]
    source: Optional[str]
    url: str  # required
    tags: Optional[List[str]]
    categoryType: Optional[str]


class EnrichedQuote(RawQuote, total=False):
    simHash: str
    fingerprint: str
    wordCount: int
    summary: Optional[str]


class ProviderMeta(TypedDict):
    code: str
    name: str
    baseUrl: str
    enabled: bool


class BaseProvider(ABC):
    """对应 TS abstract class BaseProvider"""

    code: str = ""
    name: str = ""
    baseUrl: str = ""

    @abstractmethod
    def fetch_list(self, page: int) -> List[RawQuote]:
        """对应 TS fetchList(page)"""

    @abstractmethod
    def fetch_detail(self, raw: RawQuote) -> EnrichedQuote:
        """对应 TS fetchDetail(raw)"""

    @property
    def meta(self) -> ProviderMeta:
        return {
            "code": self.code,
            "name": self.name,
            "baseUrl": self.baseUrl,
            "enabled": True,
        }

    def crawl_pages(self, start_page: int = 1, max_pages: int = 10):
        """对应 TS crawlPages 异步生成器（这里为普通生成器）"""
        for page in range(start_page, max_pages + 1):
            try:
                items = self.fetch_list(page)
            except Exception as err:
                print(f"[{self.code}] 第 {page} 页采集失败: {err}")
                break

            if not items:
                break

            for item in items:
                yield item
