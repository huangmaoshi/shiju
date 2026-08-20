"""收藏夹路由

对应 TypeScript 版 server/src/routes/collection_routes.ts + collection_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import collection_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/collections", tags=["collection"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("")
@router.get("/")
async def list(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return ok(collection_service.list(db, user_id))


@router.post("")
@router.post("/")
async def create(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    name = body.get("name")
    if not name:
        raise BusinessError(400, "Missing name")
    result = collection_service.create(
        db, user_id, {"name": name, "description": body.get("description")}
    )
    return ok(result)


@router.get("/stats")
async def stats(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    return ok(collection_service.stats(db, user_id))


@router.get("/quotes/{quote_id}/collect")
async def collect_quote(
    quote_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    collection_service.collectQuote(db, user_id, quote_id)
    return ok(None)


@router.delete("/quotes/{quote_id}/collect")
async def uncollect_quote(
    quote_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    collection_service.uncollectQuote(db, user_id, quote_id)
    return ok(None)


@router.put("/{id}")
async def rename(
    id: int,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    name = body.get("name")
    description = body.get("description")
    if not name and description is None:
        raise BusinessError(400, "Missing name or description")
    result = collection_service.update(db, user_id, id, name, description)
    return ok(result)


@router.delete("/{id}")
async def remove(
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    collection_service.remove(db, user_id, id)
    return ok(None)


@router.get("/{id}/quotes")
async def get_quotes(
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    page: int = 1,
    pageSize: int = 20,
):
    result = collection_service.getQuotes(db, user_id, id, page or 1, pageSize or 20)
    return ok(result)


@router.post("/{id}/quotes")
async def add_quote(
    request: Request,
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    result = collection_service.addQuote(
        db, user_id, id,
        {"quoteId": body.get("quoteId"), "customQuoteId": body.get("customQuoteId")},
    )
    return ok(result)


@router.delete("/{id}/quotes/{record_id}")
async def remove_quote(
    record_id: int,
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    collection_service.removeQuote(db, user_id, id, record_id)
    return ok(None)
