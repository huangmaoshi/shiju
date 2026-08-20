"""分类服务（对应 TS category_service.ts）"""
from sqlalchemy.orm import Session

from ..models import Category


def _stripInternal(node: dict) -> dict:
    return {
        "id": node["id"],
        "name": node["name"],
        "type": node["type"],
        "children": [_stripInternal(c) for c in node["children"]],
    }


def getAll(db: Session) -> list:
    allCategories = (
        db.query(Category)
        .filter(Category.status == 1)
        .order_by(Category.sort.asc(), Category.id.asc())
        .all()
    )

    node_map = {}
    for c in allCategories:
        node_map[c.id] = {
            "id": c.id,
            "name": c.name,
            "type": c.type,
            "sort": c.sort,
            "status": c.status,
            "children": [],
        }

    roots = []
    for c in allCategories:
        node = node_map[c.id]
        if c.parentId is None:
            roots.append(node)
        else:
            parent = node_map.get(c.parentId)
            if parent:
                parent["children"].append(node)

    return [_stripInternal(r) for r in roots]


def list(db: Session) -> list:
    return getAll(db)
