"""金句路由

对应 TypeScript 版 server/src/routes/quote_routes.ts + quote_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_optional_user_id, require_admin
from ..models import Quote, QuoteCategory
from ..services import quote_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/quotes", tags=["quote"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _serialize_quote(q: Quote) -> dict:
    return {
        "id": q.id,
        "content": q.content,
        "contentMd5": q.contentMd5,
        "simHash": q.simHash,
        "author": q.author,
        "source": q.source,
        "sourceUrl": q.sourceUrl,
        "provider": q.provider,
        "summary": q.summary,
        "pinyinData": q.pinyinData,
        "simplifiedContent": q.simplifiedContent,
        "tags": q.tags,
        "wordCount": q.wordCount,
        "isFree": q.isFree,
        "isActive": q.isActive,
        "auditStatus": q.auditStatus,
        "auditReason": q.auditReason,
        "viewCount": q.viewCount,
        "favCount": q.favCount,
        "originalTextId": q.originalTextId,
        "quoteType": q.quoteType,
        "aiExtracted": q.aiExtracted,
        "createdAt": q.createdAt,
        "updatedAt": q.updatedAt,
    }


@router.get("")
@router.get("/")
async def list(
    user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
    page: int = 1,
    pageSize: int = 20,
    categoryId: int | None = None,
    keyword: str | None = None,
):
    params = {}
    if page:
        params["page"] = page
    if pageSize:
        params["pageSize"] = pageSize
    if categoryId:
        params["categoryId"] = categoryId
    if keyword is not None:
        params["keyword"] = keyword
    return ok(quote_service.list(db, user_id, params))


@router.get("/random")
async def random(
    user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
    limit: int = 10,
):
    return ok(quote_service.random(db, user_id, limit))


@router.get("/{id}")
async def get_by_id(
    id: int,
    user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
):
    return ok(quote_service.getById(db, id, user_id))


@router.post("", dependencies=[Depends(require_admin)])
@router.post("/", dependencies=[Depends(require_admin)])
async def create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote = Quote(
        content=body.get("content"),
        author=body.get("author") or None,
        source=body.get("source") or None,
        sourceUrl=body.get("sourceUrl") or None,
        isFree=body.get("isFree", True),
        isActive=body.get("isActive", True),
        provider=body.get("provider") or "admin",
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)
    category_ids = body.get("categoryIds") or []
    for cid in category_ids:
        db.add(QuoteCategory(quoteId=quote.id, categoryId=int(cid)))
    if category_ids:
        db.commit()
    return ok(_serialize_quote(quote))


@router.put("/{id}", dependencies=[Depends(require_admin)])
async def update(id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote = db.query(Quote).filter(Quote.id == id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)
    if body.get("content") is not None:
        quote.content = body["content"]
    if body.get("author") is not None:
        quote.author = body["author"]
    if body.get("source") is not None:
        quote.source = body["source"]
    if body.get("sourceUrl") is not None:
        quote.sourceUrl = body["sourceUrl"]
    if body.get("isFree") is not None:
        quote.isFree = body["isFree"]
    if body.get("isActive") is not None:
        quote.isActive = body["isActive"]
    if body.get("categoryIds") is not None:
        db.query(QuoteCategory).filter(QuoteCategory.quoteId == id).delete()
        for cid in body["categoryIds"]:
            db.add(QuoteCategory(quoteId=id, categoryId=int(cid)))
    db.commit()
    db.refresh(quote)
    return ok(_serialize_quote(quote))


@router.delete("/{id}", dependencies=[Depends(require_admin)])
async def remove(id: int, db: Session = Depends(get_db)):
    quote = db.query(Quote).filter(Quote.id == id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)
    db.query(QuoteCategory).filter(QuoteCategory.quoteId == id).delete()
    db.query(Quote).filter(Quote.id == id).delete()
    db.commit()
    return ok(None)


@router.put("/{id}/status", dependencies=[Depends(require_admin)])
async def set_status(id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    quote = db.query(Quote).filter(Quote.id == id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)
    quote.isActive = bool(body.get("isActive"))
    db.commit()
    db.refresh(quote)
    return ok(_serialize_quote(quote))
