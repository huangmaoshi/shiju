"""导出路由（对应 TS export_routes.ts + export_controller.ts）"""
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, get_current_user_id
from ..services import export_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/export", tags=["export"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _download_response(result: dict) -> Response:
    """将导出服务返回的 {mime, filename, buffer} 转为文件下载响应

    Content-Disposition 与 TS 版一致：filename 使用 urlencoded（encodeURIComponent）
    """
    return Response(
        content=result["buffer"],
        media_type=result["mime"],
        headers={
            "Content-Disposition": f'attachment; filename="{quote(result["filename"], safe="")}"'
        },
    )


@router.post("/collection")
async def export_collection(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    collection_id = body.get("collectionId")
    if not collection_id:
        raise BusinessError(400, "Missing collectionId")
    fmt = body.get("format") or "txt"
    result = export_service.exportCollection(db, user_id, collection_id, fmt)
    return _download_response(result)


@router.post("/custom")
async def export_custom(
    request: Request,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    body = await _body(request)
    fmt = body.get("format") or "txt"
    result = export_service.exportCustom(db, user_id, fmt)
    return _download_response(result)
