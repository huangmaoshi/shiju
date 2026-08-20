"""分类路由

对应 TypeScript 版 server/src/routes/category_routes.ts + category_controller.ts
"""
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import BusinessError, require_admin
from ..models import Category
from ..services import category_service
from ..utils.response import ok

router = APIRouter(prefix="/api/v1/categories", tags=["category"])


async def _body(request: Request) -> dict:
    try:
        data = await request.json()
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _serialize_category(c: Category) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "type": c.type,
        "parentId": c.parentId,
        "sort": c.sort,
        "status": c.status,
        "createdAt": c.createdAt,
    }


@router.get("")
@router.get("/")
async def list(db: Session = Depends(get_db)):
    return ok(category_service.list(db))


@router.post("", dependencies=[Depends(require_admin)])
@router.post("/", dependencies=[Depends(require_admin)])
async def create(request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    name = body.get("name")
    category_type = body.get("type") or "theme"
    sort = body.get("sort")
    parent_id = body.get("parentId")
    category = Category(
        name=name,
        type=category_type,
        sort=sort if sort is not None else 0,
        parentId=int(parent_id) if parent_id else None,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return ok(_serialize_category(category))


@router.put("/{id}", dependencies=[Depends(require_admin)])
async def update(id: int, request: Request, db: Session = Depends(get_db)):
    body = await _body(request)
    category = db.query(Category).filter(Category.id == id).first()
    if not category:
        raise BusinessError(404, "分类不存在", 404)
    if body.get("name") is not None:
        category.name = body["name"]
    if body.get("type") is not None:
        category.type = body["type"]
    if body.get("sort") is not None:
        category.sort = body["sort"]
    if "parentId" in body:
        category.parentId = int(body["parentId"]) if body["parentId"] else None
    db.commit()
    db.refresh(category)
    return ok(_serialize_category(category))


@router.delete("/{id}", dependencies=[Depends(require_admin)])
async def remove(id: int, db: Session = Depends(get_db)):
    category = db.query(Category).filter(Category.id == id).first()
    if not category:
        raise BusinessError(404, "分类不存在", 404)
    db.delete(category)
    db.commit()
    return ok(None)
