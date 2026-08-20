"""主题包路由（对应 TS theme_package_routes.ts + theme_package_controller.ts）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..services import theme_package_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/theme-packages", tags=["theme-packages"])


@router.get("/")
async def list_(db: Session = Depends(get_db)):
    return ok(theme_package_service.list(db))


@router.get("/{id}")
async def get_by_id(id: int, db: Session = Depends(get_db)):
    return ok(theme_package_service.getById(db, id))
