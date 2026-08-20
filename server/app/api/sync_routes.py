"""多端同步路由（对应 TS sync_routes.ts + sync_controller.ts）"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import sync_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


@router.post("/pull")
async def pull(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    result = sync_service.pull(db, user_id, body.get("lastSyncAt"))
    return ok(result)


@router.post("/push")
async def push(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    # TS controller 读 body.records；sync_service.push 需要 {tableName: [item, ...]} 结构的 changes
    records = body.get("records")
    if records is None:
        records = body.get("changes")
    if records is None:
        raise BusinessError(400, "Missing records")
    if not isinstance(records, dict):
        raise BusinessError(400, "records 必须是 tableName -> items 的映射")
    result = sync_service.push(db, user_id, records)
    return ok(result)


@router.post("/batch-push")
async def batch_push(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    if body.get("changes") is None:
        raise BusinessError(400, "Missing changes")
    result = sync_service.batchPush(db, user_id, body)
    return ok(result)
