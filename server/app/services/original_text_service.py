"""原文服务

对应 TypeScript 版 server/src/services/original_text_service.ts
"""
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import OriginalText, Quote
from ..utils.dedup import dedup


def _count_words(text: str) -> int:
    if not text:
        return 0
    import re
    cleaned = re.sub(r"\s+", "", text)
    return len(cleaned)


def _serialize_summary(r: OriginalText) -> dict:
    return {
        "id": str(r.id),
        "title": r.title,
        "author": r.author or None,
        "source": r.source or None,
        "categoryType": r.categoryType or None,
        "summary": r.summary or None,
        "wordCount": r.wordCount,
        "status": r.status,
        "auditStatus": r.auditStatus or None,
        "quoteCount": r.quoteCount,
        "createdAt": r.createdAt.isoformat() if r.createdAt else None,
        "updatedAt": r.updatedAt.isoformat() if r.updatedAt else None,
    }


def _serialize_detail(db: Session, record: OriginalText) -> dict:
    quotes = (
        db.query(Quote)
        .filter(Quote.originalTextId == record.id)
        .order_by(Quote.id.asc())
        .all()
    )
    return {
        "id": str(record.id),
        "title": record.title,
        "author": record.author or None,
        "source": record.source or None,
        "sourceUrl": record.sourceUrl or None,
        "categoryType": record.categoryType or None,
        "content": record.content,
        "pinyinData": record.pinyinData or None,
        "summary": record.summary or None,
        "tags": record.tags or None,
        "provider": record.provider or None,
        "complianceTag": record.complianceTag or None,
        "protocol": record.protocol or None,
        "wordCount": record.wordCount,
        "status": record.status,
        "auditStatus": record.auditStatus or None,
        "quoteCount": record.quoteCount,
        "createdAt": record.createdAt.isoformat() if record.createdAt else None,
        "updatedAt": record.updatedAt.isoformat() if record.updatedAt else None,
        "quotes": [
            {
                "id": str(q.id),
                "content": q.content,
                "author": q.author or None,
                "source": q.source or None,
            }
            for q in quotes
        ],
    }


def list(db: Session, params: dict | None = None) -> dict:
    if params is None:
        params = {}
    page = params.get("page") or 1
    page_size = params.get("pageSize") or 20
    skip = (page - 1) * page_size

    conditions = []

    audit_status = params.get("auditStatus")
    if audit_status is not None:
        conditions.append(OriginalText.auditStatus == audit_status)

    keyword = params.get("keyword")
    if keyword:
        conditions.append(
            or_(
                OriginalText.title.contains(keyword),
                OriginalText.content.contains(keyword),
                OriginalText.author.contains(keyword),
            )
        )

    category_type = params.get("categoryType")
    if category_type:
        conditions.append(OriginalText.categoryType == category_type)

    status = params.get("status")
    if status is not None:
        conditions.append(OriginalText.status == status)

    from sqlalchemy import func

    query = db.query(OriginalText)
    if conditions:
        query = query.filter(*conditions)

    total = query.count()
    records = (
        query
        .order_by(OriginalText.id.asc())
        .offset(skip)
        .limit(page_size)
        .all()
    )

    return {"total": total, "list": [_serialize_summary(r) for r in records]}


def getById(db: Session, id: int, auditStatus: int | None = None) -> dict | None:
    query = db.query(OriginalText).filter(OriginalText.id == id)
    if auditStatus is not None:
        query = query.filter(OriginalText.auditStatus == auditStatus)

    record = query.first()
    if not record:
        return None

    return _serialize_detail(db, record)


def create(db: Session, data: dict) -> dict:
    record = OriginalText(
        title=data["title"],
        content=data["content"],
        author=data.get("author"),
        source=data.get("source"),
        sourceUrl=data.get("sourceUrl"),
        categoryType=data.get("categoryType"),
        summary=data.get("summary"),
        tags=data.get("tags"),
        provider=data.get("provider"),
        complianceTag=data.get("complianceTag"),
        protocol=data.get("protocol"),
        wordCount=_count_words(data["content"]),
        status=data.get("status", 1),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    detail = getById(db, record.id)
    if not detail:
        raise BusinessError(500, "创建后查询失败", 500)
    return detail


def update(db: Session, id: int, data: dict) -> dict:
    existing = db.query(OriginalText).filter(OriginalText.id == id).first()
    if not existing:
        raise BusinessError(404, "原文不存在", 404)

    for field in ["title", "author", "source", "sourceUrl", "categoryType",
                   "summary", "tags", "provider", "complianceTag", "protocol", "status"]:
        if field in data:
            setattr(existing, field, data[field])

    if "content" in data:
        existing.content = data["content"]
        existing.wordCount = _count_words(data["content"])

    existing.updatedAt = datetime.now()
    db.commit()
    db.refresh(existing)

    detail = getById(db, id)
    if not detail:
        raise BusinessError(500, "更新后查询失败", 500)
    return detail


def remove(db: Session, id: int) -> None:
    existing = db.query(OriginalText).filter(OriginalText.id == id).first()
    if not existing:
        raise BusinessError(404, "原文不存在", 404)

    try:
        db.query(Quote).filter(Quote.originalTextId == id).delete()
        db.query(OriginalText).filter(OriginalText.id == id).delete()
        db.commit()
    except Exception:
        db.rollback()
        raise


def addQuoteFromText(
    db: Session,
    originalTextId: int,
    quoteContent: str,
    author: str | None = None,
    source: str | None = None,
) -> dict:
    original_text = db.query(OriginalText).filter(OriginalText.id == originalTextId).first()
    if not original_text:
        raise BusinessError(404, "原文不存在", 404)

    trimmed = quoteContent.strip()
    if not trimmed:
        raise BusinessError(400, "金句内容不能为空")

    if trimmed not in original_text.content:
        raise BusinessError(400, "选段内容与原文不匹配，请检查是否从原文中选取")

    fp = dedup["fingerprint"](trimmed)

    existing_dup = db.query(Quote).filter(Quote.contentMd5 == fp["contentMd5"]).first()
    if existing_dup:
        raise BusinessError(409, f"该金句已存在（#{existing_dup.id}）")

    try:
        quote = Quote(
            content=trimmed,
            contentMd5=fp["contentMd5"],
            simHash=fp["simHash"],
            author=author or original_text.author,
            source=source or original_text.source or original_text.title,
            sourceUrl=original_text.sourceUrl,
            originalTextId=originalTextId,
            wordCount=_count_words(trimmed),
            isFree=True,
            isActive=True,
            provider=original_text.provider or "admin",
            quoteType="admin",
            aiExtracted=False,
        )
        db.add(quote)

        original_text.quoteCount = (original_text.quoteCount or 0) + 1
        original_text.updatedAt = datetime.now()

        db.commit()
        db.refresh(quote)
    except Exception:
        db.rollback()
        raise

    return {
        "id": str(quote.id),
        "content": quote.content,
        "author": quote.author or None,
        "source": quote.source or None,
    }
