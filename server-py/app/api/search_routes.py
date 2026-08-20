"""搜索路由

对应 TypeScript 版 server/src/routes/search_routes.ts + search_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id, get_optional_user_id
from ..services import search_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/search", tags=["search"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.get("/quotes")
async def search_quotes(
    user_id: int | None = Depends(get_optional_user_id),
    db: Session = Depends(get_db),
    keyword: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    if not keyword:
        raise BusinessError(400, "Missing keyword")
    result = search_service.searchQuotes(db, user_id, keyword, page or 1, pageSize or 20)
    return ok(result)


@router.get("/original-texts")
async def search_original_text(
    db: Session = Depends(get_db),
    keyword: str | None = None,
    page: int = 1,
    pageSize: int = 20,
):
    if not keyword:
        raise BusinessError(400, "Missing keyword")
    result = search_service.searchOriginalText(db, keyword, page or 1, pageSize or 20)
    return ok(result)


@router.get("/hot")
async def get_hot(db: Session = Depends(get_db)):
    return ok(search_service.getHotKeywords(db))


@router.post("/history")
async def save_history(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    keyword = body.get("keyword")
    if not keyword:
        raise BusinessError(400, "Missing keyword")
    search_service.saveHistory(db, user_id, keyword)
    return ok(None)


@router.delete("/history")
async def clear_history(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    search_service.clearHistory(db, user_id)
    return ok(None)
