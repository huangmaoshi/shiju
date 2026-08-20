"""收藏夹服务

对应 TypeScript 版 server/src/services/collection_service.ts
"""
from datetime import datetime

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import (
    Collection,
    CollectionQuote,
    Quote,
    CustomQuote,
    QuoteCategory,
    Category,
)


def _to_user_id(userId) -> int:
    n = int(userId)
    return n


def _serialize_collection(c: Collection) -> dict:
    return {
        "id": c.id,
        "userId": c.userId,
        "name": c.name,
        "description": c.description or None,
        "isDefault": c.isDefault,
        "quoteCount": c.quoteCount,
        "createdAt": c.createdAt,
        "updatedAt": c.updatedAt,
    }


def _get_categories_for_quote(db: Session, quote_id: int) -> list:
    qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).all()
    if not qcs:
        return []
    cat_ids = [qc.categoryId for qc in qcs]
    cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
    return [{"id": str(c.id), "name": c.name, "type": c.type} for c in cats]


def _ensure_default_collection(db: Session, userId: int) -> None:
    has_default = db.query(Collection).filter(
        Collection.userId == userId,
        Collection.isDefault == 1,
    ).first()
    if not has_default:
        c = Collection(
            userId=userId,
            name="我的收藏",
            isDefault=1,
            quoteCount=0,
        )
        db.add(c)
        db.commit()


def list(db: Session, userId) -> list:
    uid = _to_user_id(userId)
    collections = (
        db.query(Collection)
        .filter(Collection.userId == uid)
        .order_by(Collection.isDefault.desc(), Collection.createdAt.asc())
        .all()
    )
    return [_serialize_collection(c) for c in collections]


def create(db: Session, userId, data: dict) -> dict:
    uid = _to_user_id(userId)
    name = data["name"]
    description = data.get("description")
    is_default = data.get("isDefault", 0)

    if is_default == 1:
        db.query(Collection).filter(
            Collection.userId == uid,
            Collection.isDefault == 1,
        ).update({"isDefault": 0}, synchronize_session=False)
        db.commit()

    _ensure_default_collection(db, uid)

    c = Collection(
        userId=uid,
        name=name,
        description=description,
        isDefault=is_default,
        quoteCount=0,
    )
    db.add(c)
    db.commit()
    db.refresh(c)

    return _serialize_collection(c)


def rename(db: Session, userId, id: int, name: str) -> dict:
    uid = _to_user_id(userId)
    c = db.query(Collection).filter(Collection.id == id).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    c.name = name
    c.updatedAt = datetime.now()
    db.commit()
    db.refresh(c)

    return _serialize_collection(c)


def update(db: Session, userId, id: int, name=None, description=None) -> dict:
    uid = _to_user_id(userId)
    c = db.query(Collection).filter(Collection.id == id).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    if name is not None:
        c.name = name
    if description is not None:
        c.description = description
    c.updatedAt = datetime.now()
    db.commit()
    db.refresh(c)

    return _serialize_collection(c)


def remove(db: Session, userId, id: int) -> None:
    uid = _to_user_id(userId)
    c = db.query(Collection).filter(Collection.id == id).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)
    if c.isDefault == 1:
        raise BusinessError(400, "默认收藏夹不能删除")

    try:
        db.query(CollectionQuote).filter(CollectionQuote.collectionId == id).delete()
        db.query(Collection).filter(Collection.id == id).delete()
        db.commit()
    except Exception:
        db.rollback()
        raise


def addQuote(db: Session, userId, collectionId: int, data: dict) -> None:
    uid = _to_user_id(userId)
    quote_id = data.get("quoteId")
    custom_quote_id = data.get("customQuoteId")

    if not quote_id and not custom_quote_id:
        raise BusinessError(400, "quoteId 或 customQuoteId 不能同时为空")
    if quote_id and custom_quote_id:
        raise BusinessError(400, "quoteId 和 customQuoteId 只能传一个")

    c = db.query(Collection).filter(Collection.id == collectionId).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    if quote_id:
        dup = db.query(CollectionQuote).filter(
            CollectionQuote.collectionId == collectionId,
            CollectionQuote.quoteId == quote_id,
        ).first()
    else:
        dup = db.query(CollectionQuote).filter(
            CollectionQuote.collectionId == collectionId,
            CollectionQuote.customQuoteId == custom_quote_id,
        ).first()
    if dup:
        raise BusinessError(400, "该句已在收藏夹中")

    try:
        cq = CollectionQuote(
            collectionId=collectionId,
            quoteId=quote_id,
            customQuoteId=custom_quote_id,
        )
        db.add(cq)
        c.quoteCount = (c.quoteCount or 0) + 1
        c.updatedAt = datetime.now()
        db.commit()
    except Exception:
        db.rollback()
        raise


def removeQuote(db: Session, userId, collectionId: int, recordId: int) -> None:
    uid = _to_user_id(userId)

    c = db.query(Collection).filter(Collection.id == collectionId).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    record = db.query(CollectionQuote).filter(CollectionQuote.id == recordId).first()
    if not record or record.collectionId != collectionId:
        raise BusinessError(404, "收藏记录不存在", 404)

    try:
        db.query(CollectionQuote).filter(CollectionQuote.id == recordId).delete()
        c.quoteCount = max((c.quoteCount or 0) - 1, 0)
        c.updatedAt = datetime.now()
        db.commit()
    except Exception:
        db.rollback()
        raise


def getQuotes(db: Session, userId, collectionId: int, page: int = 1, pageSize: int = 20) -> dict:
    uid = _to_user_id(userId)

    c = db.query(Collection).filter(Collection.id == collectionId).first()
    if not c or c.userId != uid:
        raise BusinessError(404, "收藏夹不存在", 404)

    skip = (page - 1) * pageSize

    total = db.query(CollectionQuote).filter(CollectionQuote.collectionId == collectionId).count()
    records = (
        db.query(CollectionQuote)
        .filter(CollectionQuote.collectionId == collectionId)
        .order_by(CollectionQuote.addedAt.desc())
        .offset(skip)
        .limit(pageSize)
        .all()
    )

    # Batch load quotes and custom quotes
    quote_ids = [r.quoteId for r in records if r.quoteId]
    custom_ids = [r.customQuoteId for r in records if r.customQuoteId]

    quotes_map = {}
    if quote_ids:
        for q in db.query(Quote).filter(Quote.id.in_(quote_ids)).all():
            quotes_map[q.id] = q

    custom_map = {}
    if custom_ids:
        for cq in db.query(CustomQuote).filter(CustomQuote.id.in_(custom_ids)).all():
            custom_map[cq.id] = cq

    # Batch load categories
    all_cat_ids = set()
    qcs_by_quote = {}
    if quote_ids:
        qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId.in_(quote_ids)).all()
        for qc in qcs:
            qcs_by_quote.setdefault(qc.quoteId, []).append(qc.categoryId)
            all_cat_ids.add(qc.categoryId)

    cats_map = {}
    if all_cat_ids:
        for cat in db.query(Category).filter(Category.id.in_([*all_cat_ids])).all():
            cats_map[cat.id] = cat

    list_data: list = []
    for r in records:
        if r.quoteId and r.quoteId in quotes_map:
            q = quotes_map[r.quoteId]
            cat_ids = qcs_by_quote.get(q.id, [])
            categories = [
                {"id": str(cats_map[cid].id), "name": cats_map[cid].name, "type": cats_map[cid].type}
                for cid in cat_ids if cid in cats_map
            ]
            list_data.append({
                "id": str(q.id),
                "content": q.content,
                "author": q.author or None,
                "source": q.source or None,
                "summary": q.summary or None,
                "isFree": q.isFree,
                "categories": categories,
                "wordCount": q.wordCount,
                "isLongText": q.wordCount > 100,
                "pinyinData": q.pinyinData or None,
                "collected": True,
                "inRecitePlan": False,
            })
        elif r.customQuoteId and r.customQuoteId in custom_map:
            cq = custom_map[r.customQuoteId]
            list_data.append({
                "id": f"custom_{cq.id}",
                "content": cq.content,
                "author": cq.author or None,
                "source": cq.source or None,
                "summary": None,
                "isFree": True,
                "categories": [],
                "wordCount": len(cq.content),
                "isLongText": len(cq.content) > 100,
                "pinyinData": None,
                "collected": True,
                "inRecitePlan": False,
            })

    return {"total": total, "list": list_data}


def collectQuote(db: Session, userId, quoteId: int) -> None:
    uid = _to_user_id(userId)
    _ensure_default_collection(db, uid)

    default_c = db.query(Collection).filter(
        Collection.userId == uid,
        Collection.isDefault == 1,
    ).first()
    if not default_c:
        raise BusinessError(404, "默认收藏夹不存在", 404)

    dup = db.query(CollectionQuote).filter(
        CollectionQuote.collectionId == default_c.id,
        CollectionQuote.quoteId == quoteId,
    ).first()
    if dup:
        raise BusinessError(400, "该句已在收藏夹中")

    try:
        cq = CollectionQuote(
            collectionId=default_c.id,
            quoteId=quoteId,
        )
        db.add(cq)
        default_c.quoteCount = (default_c.quoteCount or 0) + 1
        default_c.updatedAt = datetime.now()
        db.commit()
    except Exception:
        db.rollback()
        raise


def uncollectQuote(db: Session, userId, quoteId: int) -> None:
    uid = _to_user_id(userId)

    default_c = db.query(Collection).filter(
        Collection.userId == uid,
        Collection.isDefault == 1,
    ).first()
    if not default_c:
        return

    record = db.query(CollectionQuote).filter(
        CollectionQuote.collectionId == default_c.id,
        CollectionQuote.quoteId == quoteId,
    ).first()
    if not record:
        return

    try:
        db.query(CollectionQuote).filter(CollectionQuote.id == record.id).delete()
        default_c.quoteCount = max((default_c.quoteCount or 0) - 1, 0)
        default_c.updatedAt = datetime.now()
        db.commit()
    except Exception:
        db.rollback()
        raise


def stats(db: Session, userId) -> dict:
    uid = _to_user_id(userId)

    total_collections = db.query(Collection).filter(Collection.userId == uid).count()

    # Count CollectionQuote where collection.userId == uid
    total_quotes = (
        db.query(CollectionQuote)
        .join(Collection, CollectionQuote.collectionId == Collection.id)
        .filter(Collection.userId == uid)
        .count()
    )

    favorite = (
        db.query(CollectionQuote)
        .join(Collection, CollectionQuote.collectionId == Collection.id)
        .filter(Collection.userId == uid)
        .order_by(CollectionQuote.addedAt.desc())
        .first()
    )

    favorite_quote = None
    if favorite:
        if favorite.quoteId:
            q = db.query(Quote).filter(Quote.id == favorite.quoteId).first()
            if q:
                categories = _get_categories_for_quote(db, q.id)
                favorite_quote = {
                    "id": str(q.id),
                    "content": q.content,
                    "author": q.author or None,
                    "source": q.source or None,
                    "summary": q.summary or None,
                    "isFree": q.isFree,
                    "categories": categories,
                    "wordCount": q.wordCount,
                    "isLongText": q.wordCount > 100,
                    "pinyinData": q.pinyinData or None,
                    "collected": True,
                    "inRecitePlan": False,
                }
        elif favorite.customQuoteId:
            cq = db.query(CustomQuote).filter(CustomQuote.id == favorite.customQuoteId).first()
            if cq:
                favorite_quote = {
                    "id": f"custom_{cq.id}",
                    "content": cq.content,
                    "author": cq.author or None,
                    "source": cq.source or None,
                    "summary": None,
                    "isFree": True,
                    "categories": [],
                    "wordCount": len(cq.content),
                    "isLongText": len(cq.content) > 100,
                    "pinyinData": None,
                    "collected": True,
                    "inRecitePlan": False,
                }

    return {
        "totalCollections": total_collections,
        "totalQuotes": total_quotes,
        "favoriteQuote": favorite_quote,
    }
