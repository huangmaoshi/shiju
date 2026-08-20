"""原文路由（对应 TS server/src/routes/original_text_routes.ts + original_text_controller.ts）"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_optional_user_id, require_admin
from ..services import original_text_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/original-texts", tags=["original-texts"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _valid_id(id_: int) -> bool:
    return bool(id_)


@router.get("")
async def list_original_texts(
    request: Request,
    keyword: str | None = None,
    categoryType: str | None = None,
    status: str | None = None,
    auditStatus: str | None = None,
    page: int | None = None,
    pageSize: int | None = None,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_optional_user_id),
):
    params = {
        "keyword": keyword,
        "categoryType": categoryType,
        "status": int(status) if status is not None and status != "" else None,
        "auditStatus": int(auditStatus) if auditStatus is not None and auditStatus != "" else None,
        "page": page,
        "pageSize": pageSize,
    }
    return ok(original_text_service.list(db, params))


@router.get("/{original_text_id}")
async def get_original_text_by_id(
    original_text_id: int,
    request: Request,
    auditStatus: str | None = None,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_optional_user_id),
):
    if not _valid_id(original_text_id):
        raise BusinessError(400, "无效的 ID")
    audit_status = (
        int(auditStatus) if auditStatus is not None and auditStatus != "" else None
    )
    result = original_text_service.getById(db, original_text_id, audit_status)
    if not result:
        raise BusinessError(404, "原文不存在", 404)
    return ok(result)


@router.post("", dependencies=[Depends(require_admin)])
async def create_original_text(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    if not body.get("title") or not body.get("content"):
        raise BusinessError(400, "标题和内容为必填项")
    return ok(original_text_service.create(db, body))


@router.put("/{original_text_id}", dependencies=[Depends(require_admin)])
async def update_original_text(
    original_text_id: int, request: Request, db: Session = Depends(get_db)
):
    if not _valid_id(original_text_id):
        raise BusinessError(400, "无效的 ID")
    body = await _body(request)
    return ok(original_text_service.update(db, original_text_id, body))


@router.delete("/{original_text_id}", dependencies=[Depends(require_admin)])
async def remove_original_text(original_text_id: int, db: Session = Depends(get_db)):
    if not _valid_id(original_text_id):
        raise BusinessError(400, "无效的 ID")
    original_text_service.remove(db, original_text_id)
    return ok(None)


@router.post("/{original_text_id}/add-quote", dependencies=[Depends(require_admin)])
async def add_quote_to_original_text(
    original_text_id: int, request: Request, db: Session = Depends(get_db)
):
    if not _valid_id(original_text_id):
        raise BusinessError(400, "无效的原文 ID")
    body = await _body(request)
    content = body.get("content")
    if not content or not isinstance(content, str):
        raise BusinessError(400, "金句内容为必填项")
    result = original_text_service.addQuoteFromText(
        db, original_text_id, content, body.get("author"), body.get("source")
    )
    return ok(result)
