"""作文模板服务（对应 TS composition_service.ts）"""
from sqlalchemy.orm import Session

from ..models import CompositionTemplate


def _toItem(i: CompositionTemplate) -> dict:
    return {
        "id": i.id,
        "title": i.title,
        "type": i.type,
        "content": i.content,
        "examples": i.examples,
        "theme": i.theme,
        "isFree": i.isFree,
    }


def list(db: Session, isFree: bool | None = None) -> list:
    query = db.query(CompositionTemplate).filter(CompositionTemplate.status == 1)
    if isFree is not None:
        query = query.filter(CompositionTemplate.isFree == (1 if isFree else 0))
    items = query.order_by(CompositionTemplate.id.asc()).all()
    return [_toItem(i) for i in items]


def getById(db: Session, id: int) -> dict | None:
    item = db.query(CompositionTemplate).filter(CompositionTemplate.id == id).first()
    if not item or item.status != 1:
        return None
    return _toItem(item)
