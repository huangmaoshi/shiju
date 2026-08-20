"""自定义名句服务（对应 TS custom_quote_service.ts）"""
from datetime import datetime

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import CustomQuote
from .member_service import checkIsMember

FREE_QUOTA = 50


def _toItem(r: CustomQuote) -> dict:
    return {
        "id": str(r.id),
        "content": r.content,
        "author": r.author,
        "source": r.source,
        "note": r.note,
        "tags": r.tags,
        "createdAt": r.createdAt.isoformat() if r.createdAt else None,
    }


def _joinTags(categoryIds) -> str | None:
    if categoryIds is None:
        return None
    return ",".join(str(x) for x in categoryIds)


def list(db: Session, userId: int, page: int, pageSize: int) -> dict:
    skip = (page - 1) * pageSize

    total = db.query(CustomQuote).filter(CustomQuote.userId == userId).count()
    records = (
        db.query(CustomQuote)
        .filter(CustomQuote.userId == userId)
        .order_by(CustomQuote.createdAt.desc())
        .offset(skip)
        .limit(pageSize)
        .all()
    )

    return {"total": total, "list": [_toItem(r) for r in records]}


def create(db: Session, userId: int, input: dict) -> dict:
    quota = getQuota(db, userId)
    if quota["remaining"] <= 0:
        raise BusinessError(403, "自定义名句数量已达上限，请开通会员")

    record = CustomQuote(
        userId=userId,
        content=input.get("content"),
        author=input.get("author"),
        source=input.get("sourceName"),
        note=input.get("note"),
        tags=_joinTags(input.get("categoryIds")),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return _toItem(record)


def update(db: Session, userId: int, id: int, input: dict) -> dict:
    existing = db.query(CustomQuote).filter(CustomQuote.id == id).first()
    if not existing:
        raise BusinessError(404, "自定义名句不存在")
    if existing.userId != userId:
        raise BusinessError(403, "无权操作")

    existing.content = input.get("content")
    existing.author = input.get("author")
    existing.source = input.get("sourceName")
    existing.note = input.get("note")
    existing.tags = _joinTags(input.get("categoryIds"))
    existing.updatedAt = datetime.now()
    db.commit()
    db.refresh(existing)

    return _toItem(existing)


def remove(db: Session, userId: int, id: int) -> None:
    existing = db.query(CustomQuote).filter(CustomQuote.id == id).first()
    if not existing:
        raise BusinessError(404, "自定义名句不存在")
    if existing.userId != userId:
        raise BusinessError(403, "无权操作")

    db.delete(existing)
    db.commit()


def getQuota(db: Session, userId: int) -> dict:
    isMember = checkIsMember(db, userId)

    used = db.query(CustomQuote).filter(CustomQuote.userId == userId).count()
    total = float("inf") if isMember else FREE_QUOTA
    remaining = float("inf") if isMember else max(0, FREE_QUOTA - used)

    return {"total": total, "used": used, "remaining": remaining}
