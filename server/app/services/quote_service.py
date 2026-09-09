"""金句服务

对应 TypeScript 版 server/src/services/quote_service.ts
"""
import random as _random

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import (
    Quote,
    QuoteCategory,
    Category,
    OriginalText,
    CollectionQuote,
    Collection,
    RecitePlan,
)


def _to_user_id(userId) -> int | None:
    if userId is None:
        return None
    try:
        n = int(userId)
        return n
    except (TypeError, ValueError):
        return None


def _get_categories(db: Session, quote_id: int) -> list:
    qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).all()
    if not qcs:
        return []
    cat_ids = [qc.categoryId for qc in qcs]
    cats = db.query(Category).filter(Category.id.in_(cat_ids)).all()
    return [{"id": str(c.id), "name": c.name, "type": c.type} for c in cats]


def list(db: Session, userId=None, params: dict | None = None) -> dict:
    if params is None:
        params = {}
    page = params.get("page") or 1
    page_size = params.get("pageSize") or 20
    skip = (page - 1) * page_size

    conditions = [Quote.isActive == True, Quote.auditStatus == 1]

    keyword = params.get("keyword")
    if keyword:
        conditions.append(
            or_(
                Quote.content.contains(keyword),
                Quote.author.contains(keyword),
                Quote.source.contains(keyword),
            )
        )

    category_id = params.get("categoryId")
    category_type = params.get("categoryType")

    quote_ids_filter = None
    if category_id or category_type:
        qc_query = db.query(QuoteCategory.quoteId)
        if category_id:
            qc_query = qc_query.filter(QuoteCategory.categoryId == category_id)
        if category_type:
            qc_query = qc_query.join(Category, QuoteCategory.categoryId == Category.id).filter(
                Category.type == category_type
            )
        quote_ids_filter = [r[0] for r in qc_query.all()]

    from sqlalchemy import func

    query = db.query(Quote)
    if quote_ids_filter is not None:
        if not quote_ids_filter:
            return {"total": 0, "list": []}
        conditions.append(Quote.id.in_(quote_ids_filter))

    query = query.filter(*conditions)
    total = query.count()
    quotes = (
        query
        .order_by(Quote.id.asc())
        .offset(skip)
        .limit(page_size)
        .all()
    )

    # Batch load categories
    quote_ids = [q.id for q in quotes]
    cat_map: dict[int, list] = {}
    if quote_ids:
        qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId.in_(quote_ids)).all()
        cat_ids = [*{qc.categoryId for qc in qcs}]
        cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
        for qc in qcs:
            c = cats.get(qc.categoryId)
            if c:
                cat_map.setdefault(qc.quoteId, []).append(
                    {"id": str(c.id), "name": c.name, "type": c.type}
                )

    # Batch load original texts
    ot_ids = [q.originalTextId for q in quotes if q.originalTextId]
    ot_map = {}
    if ot_ids:
        for ot in db.query(OriginalText).filter(OriginalText.id.in_(ot_ids)).all():
            ot_map[ot.id] = ot

    list_data = []
    for q in quotes:
        item = {
            "id": str(q.id),
            "content": q.content,
            "author": q.author or None,
            "source": q.source or None,
            "summary": q.summary or None,
            "isFree": q.isFree,
            "categories": cat_map.get(q.id, []),
        }
        if q.originalTextId and q.originalTextId in ot_map:
            ot = ot_map[q.originalTextId]
            item["originalText"] = {
                "id": str(ot.id),
                "title": ot.title,
                "author": ot.author or None,
            }
        list_data.append(item)

    return {"total": total, "list": list_data}


def getById(db: Session, id: int, userId=None) -> dict | None:
    uid = _to_user_id(userId)

    quote = db.query(Quote).filter(
        Quote.id == id,
        Quote.isActive == True,
        Quote.auditStatus == 1,
    ).first()

    if not quote:
        return None

    collected = False
    in_recite_plan = False

    if uid is not None:
        coll = (
            db.query(CollectionQuote)
            .join(Collection, CollectionQuote.collectionId == Collection.id)
            .filter(CollectionQuote.quoteId == id, Collection.userId == uid)
            .first()
        )
        plan = db.query(RecitePlan).filter(
            RecitePlan.quoteId == id,
            RecitePlan.userId == uid,
        ).first()
        collected = coll is not None
        in_recite_plan = plan is not None

    categories = _get_categories(db, quote.id)

    detail = {
        "id": str(quote.id),
        "content": quote.content,
        "author": quote.author or None,
        "source": quote.source or None,
        "summary": quote.summary or None,
        "isFree": quote.isFree,
        "categories": categories,
        "wordCount": quote.wordCount,
        "isLongText": quote.wordCount > 100,
        "pinyinData": quote.pinyinData or None,
        "collected": collected,
        "inRecitePlan": in_recite_plan,
    }

    if quote.originalTextId:
        ot = db.query(OriginalText).filter(OriginalText.id == quote.originalTextId).first()
        if ot:
            detail["originalText"] = {
                "id": str(ot.id),
                "title": ot.title,
                "author": ot.author or None,
                "content": ot.content,
                "summary": ot.summary or None,
            }

    return detail


def random(db: Session, userId=None, limit: int = 10) -> list:
    uid = _to_user_id(userId)

    from sqlalchemy import func

    total = db.query(func.count(Quote.id)).filter(
        Quote.isActive == True,
        Quote.auditStatus == 1,
    ).scalar()

    if total == 0:
        return []

    take = min(limit, total)
    skip = max(0, _random.randint(0, max(0, total - take)))

    quotes = (
        db.query(Quote)
        .filter(Quote.isActive == True, Quote.auditStatus == 1)
        .offset(skip)
        .limit(take)
        .all()
    )

    collected_ids: set[int] = set()
    plan_ids: set[int] = set()

    if uid is not None and quotes:
        quote_ids = [q.id for q in quotes]
        colls = (
            db.query(CollectionQuote)
            .join(Collection, CollectionQuote.collectionId == Collection.id)
            .filter(CollectionQuote.quoteId.in_(quote_ids), Collection.userId == uid)
            .all()
        )
        collected_ids = {c.quoteId for c in colls if c.quoteId}

        plans = db.query(RecitePlan).filter(
            RecitePlan.quoteId.in_(quote_ids),
            RecitePlan.userId == uid,
        ).all()
        plan_ids = {p.quoteId for p in plans if p.quoteId}

    # Batch load categories
    quote_ids = [q.id for q in quotes]
    cat_map: dict[int, list] = {}
    if quote_ids:
        qcs = db.query(QuoteCategory).filter(QuoteCategory.quoteId.in_(quote_ids)).all()
        cat_ids = [*{qc.categoryId for qc in qcs}]
        cats = {c.id: c for c in db.query(Category).filter(Category.id.in_(cat_ids)).all()} if cat_ids else {}
        for qc in qcs:
            c = cats.get(qc.categoryId)
            if c:
                cat_map.setdefault(qc.quoteId, []).append(
                    {"id": str(c.id), "name": c.name, "type": c.type}
                )

    # Batch load original texts
    ot_ids = [q.originalTextId for q in quotes if q.originalTextId]
    ot_map = {}
    if ot_ids:
        for ot in db.query(OriginalText).filter(OriginalText.id.in_(ot_ids)).all():
            ot_map[ot.id] = ot

    result = []
    for quote in quotes:
        item = {
            "id": str(quote.id),
            "content": quote.content,
            "author": quote.author or None,
            "source": quote.source or None,
            "summary": quote.summary or None,
            "isFree": quote.isFree,
            "categories": cat_map.get(quote.id, []),
            "wordCount": quote.wordCount,
            "isLongText": quote.wordCount > 100,
            "pinyinData": quote.pinyinData or None,
            "collected": quote.id in collected_ids,
            "inRecitePlan": quote.id in plan_ids,
        }
        if quote.originalTextId and quote.originalTextId in ot_map:
            ot = ot_map[quote.originalTextId]
            item["originalText"] = {
                "id": str(ot.id),
                "title": ot.title,
                "author": ot.author or None,
            }
        result.append(item)

    return result
