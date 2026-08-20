"""作文模板路由（对应 TS composition_routes.ts + composition_controller.ts）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import composition_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/compositions", tags=["compositions"])


@router.get("/")
async def list_(db: Session = Depends(get_db)):
    return ok(composition_service.list(db))


@router.get("/{id}")
async def get_by_id(id: int, db: Session = Depends(get_db)):
    return ok(composition_service.getById(db, id))
