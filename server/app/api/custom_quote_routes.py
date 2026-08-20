"""自定义名句路由

对应 TypeScript 版 server/src/routes/custom_quote_routes.ts + custom_quote_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import custom_quote_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/custom-quotes", tags=["custom-quote"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("")
@router.get("/")
async def list(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    page: int = 1,
    pageSize: int = 20,
):
    return ok(custom_quote_service.list(db, user_id, page or 1, pageSize or 20))


@router.post("")
@router.post("/")
async def create(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    content = body.get("content")
    if not content:
        raise BusinessError(400, "Missing content")
    data = {
        "content": content,
        "author": body.get("author"),
        "sourceName": body.get("source"),
        "note": body.get("note"),
        "categoryIds": body.get("categoryIds"),
    }
    return ok(custom_quote_service.create(db, user_id, data))


@router.put("/{id}")
async def update(
    id: int,
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    data = {
        "content": body.get("content"),
        "author": body.get("author"),
        "sourceName": body.get("source"),
        "note": body.get("note"),
        "categoryIds": body.get("categoryIds"),
    }
    return ok(custom_quote_service.update(db, user_id, id, data))


@router.delete("/{id}")
async def remove(
    id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    custom_quote_service.remove(db, user_id, id)
    return ok(None)


@router.get("/quota")
async def get_quota(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    return ok(custom_quote_service.getQuota(db, user_id))
