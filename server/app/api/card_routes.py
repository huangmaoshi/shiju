"""卡片模板路由（对应 TS card_routes.ts + card_template_controller.ts）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import card_template_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/card-templates", tags=["card-templates"])


@router.get("/")
async def list_(db: Session = Depends(get_db)):
    return ok(card_template_service.list(db))


@router.get("/{id}")
async def get_by_id(id: int, db: Session = Depends(get_db)):
    return ok(card_template_service.getById(db, id))
