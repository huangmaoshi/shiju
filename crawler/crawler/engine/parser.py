"""HTML 解析工具

对应 TypeScript 版 crawler/src/engine/parser.ts（cheerio）。
使用 BeautifulSoup：soup.select(selector) / soup.select_one(...) / get_text()。
"""
from bs4 import BeautifulSoup


def load(html: str) -> BeautifulSoup:
    """对应 TS load(html)"""
    return BeautifulSoup(html, "html.parser")


def extract_text(soup: BeautifulSoup, selector: str) -> str:
    """对应 TS extractText：取第一个匹配元素的文本并 trim"""
    el = soup.select_one(selector)
    if el is None:
        return ""
    return el.get_text().strip()


def extract_all_text(soup: BeautifulSoup, selector: str) -> list:
    """对应 TS extractAllText：取所有匹配元素的文本（过滤空串）"""
    result = []
    for el in soup.select(selector):
        text = el.get_text().strip()
        if text:
            result.append(text)
    return result


def extract_attr(soup: BeautifulSoup, selector: str, attr: str) -> str:
    """对应 TS extractAttr：取第一个匹配元素的属性值"""
    el = soup.select_one(selector)
    if el is None:
        return ""
    value = el.get(attr) or ""
    if isinstance(value, list):  # class 等多值属性
        value = " ".join(value)
    return value.strip()


def extract_all_attr(soup: BeautifulSoup, selector: str, attr: str) -> list:
    """对应 TS extractAllAttr：取所有匹配元素的属性值"""
    result = []
    for el in soup.select(selector):
        value = el.get(attr)
        if value:
            if isinstance(value, list):
                value = " ".join(value)
            result.append(value.strip())
    return result


def extract_links(soup: BeautifulSoup, selector: str) -> list:
    """对应 TS extractLinks：取所有 href"""
    return extract_all_attr(soup, selector, "href")


def has_selector(soup: BeautifulSoup, selector: str) -> bool:
    """对应 TS hasSelector"""
    return len(soup.select(selector)) > 0
