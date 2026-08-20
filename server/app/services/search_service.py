"""搜索服务

对应 TypeScript 版 server/src/services/search_service.ts
"""
import re
import time
from datetime import datetime

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import Quote, OriginalText, SearchHistory, QuoteCategory, Category
from ..utils.logger import logger

_HOT_KEYWORD_CACHE: dict = {}
_CACHE_TTL_MS = 60 * 60 * 1000


def _extract_matched_context(content: str, keyword: str) -> str:
    lower_content = content.lower()
    lower_keyword = keyword.lower()
    idx = lower_content.find(lower_keyword)
    if idx == -1:
        return content[:80]
    start = max(0, idx - 40)
    end = min(len(content), idx + len(keyword) + 40)
    before = "..." if start > 0 else ""
    after = "..." if end < len(content) else ""
    snippet = content[start:end]
    escaped = re.escape(keyword)
    highlighted = re.sub(escaped, lambda m: f"**{m.group()}**", snippet, flags=re.IGNORECASE)
    return f"{before}{highlighted}{after}"


def _get_categories_for_quote(db: Session, quote_id: int) -> list:
    qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).all()
    if not qcs:
        return []
    cat_ids = [qc.categoryId for qc in qcs]
    cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
    return [{"id": str(c.id), "name": c.name, "type": c.type} for c in cats]


def searchQuotes(
    db: Session,
    user_id: int | None = None,
    keyword: str = "",
    page: int = 1,
    pageSize: int = 20,
) -> dict:
    if not keyword or not keyword.strip():
        raise BusinessError(400, "搜索关键词不能为空")

    kw = keyword.strip()
    skip = (page - 1) * pageSize

    conditions = [
        Quote.isActive == True,
        Quote.auditStatus == 1,
        or_(
            Quote.content.contains(kw),
            Quote.author.contains(kw),
            Quote.source.contains(kw),
        ),
    ]

    total = db.query(func.count(Quote.id)).filter(*conditions).scalar()
    quotes = (
        db.query(Quote)
        .filter(*conditions)
        .order_by(Quote.id.desc())
        .offset(skip)
        .limit(pageSize)
        .all()
    )

    # Batch load categories for all quotes
    quote_ids = [q.id for q in quotes]
    cat_map: dict[int, list] = {}
    if quote_ids:
        qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId.in_(quote_ids)).all()
        cat_ids = list({qc.categoryId for qc in qcs})
        cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
        for qc in qcs:
            c = cats.get(qc.categoryId)
            if c:
                cat_map.setdefault(qc.quoteId, []).append(
                    {"id": str(c.id), "name": c.name, "type": c.type}
                )

    list_data = [
        {
            "id": str(q.id),
            "content": q.content,
            "author": q.author or None,
            "source": q.source or None,
            "summary": q.summary or None,
            "isFree": q.isFree,
            "categories": cat_map.get(q.id, []),
        }
        for q in quotes
    ]

    return {"total": total, "list": list_data}


def getHotKeywords(db: Session) -> list:
    cached = _HOT_KEYWORD_CACHE.get("hot")
    if cached and cached["expireAt"] > int(time.time() * 1000):
        return cached["data"]

    results = (
        db.query(SearchHistory.keyword, func.count(SearchHistory.keyword).label("cnt"))
        .group_by(SearchHistory.keyword)
        .order_by(func.count(SearchHistory.keyword).desc())
        .limit(10)
        .all()
    )

    keywords = [r[0] for r in results]
    _HOT_KEYWORD_CACHE["hot"] = {"data": keywords, "expireAt": int(time.time() * 1000) + _CACHE_TTL_MS}

    return keywords


getHot = getHotKeywords


def searchOriginalText(
    db: Session,
    keyword: str,
    page: int = 1,
    pageSize: int = 20,
) -> dict:
    if not keyword or not keyword.strip():
        raise BusinessError(400, "搜索关键词不能为空")

    kw = keyword.strip()
    skip = (page - 1) * pageSize

    conditions = [
        OriginalText.auditStatus == 1,
        or_(
            OriginalText.title.contains(kw),
            OriginalText.content.contains(kw),
            OriginalText.author.contains(kw),
        ),
    ]

    total = db.query(func.count(OriginalText.id)).filter(*conditions).scalar()
    records = (
        db.query(OriginalText)
        .filter(*conditions)
        .order_by(OriginalText.id.desc())
        .offset(skip)
        .limit(pageSize)
        .all()
    )

    list_data = [
        {
            "id": str(r.id),
            "title": r.title,
            "author": r.author or None,
            "summary": r.summary or None,
            "wordCount": r.wordCount,
            "quoteCount": r.quoteCount,
            "matchedContent": _extract_matched_context(r.content, kw),
        }
        for r in records
    ]

    return {"total": total, "list": list_data}


def saveHistory(db: Session, userId: int, keyword: str) -> None:
    if not keyword or not keyword.strip():
        return

    kw = keyword.strip()

    db.query(SearchHistory).filter(
        SearchHistory.userId == userId,
        SearchHistory.keyword == kw,
    ).delete()
    db.commit()

    record = SearchHistory(userId=userId, keyword=kw)
    db.add(record)
    db.commit()


def clearHistory(db: Session, userId: int) -> None:
    db.query(SearchHistory).filter(SearchHistory.userId == userId).delete()
    db.commit()
