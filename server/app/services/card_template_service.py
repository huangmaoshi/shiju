"""卡片模板服务（对应 TS card_template_service.ts）"""
from sqlalchemy.orm import Session

from ..models import CardTemplate


def _toItem(tpl: CardTemplate) -> dict:
    return {
        "id": tpl.id,
        "name": tpl.name,
        "style": tpl.style,
        "bgType": tpl.bgType,
        "bgValue": tpl.bgValue,
        "fontFamily": tpl.fontFamily,
        "fontSize": tpl.fontSize,
        "fontColor": tpl.fontColor,
        "lineHeight": tpl.lineHeight,
        "textAlign": tpl.textAlign,
        "showAuthor": tpl.showAuthor,
        "showWatermark": tpl.showWatermark,
        "isMember": tpl.isMember,
        "previewUrl": tpl.previewUrl,
    }


def list(db: Session, isMember: bool | None = None) -> list:
    query = db.query(CardTemplate).filter(CardTemplate.status == 1)
    if isMember is not None:
        query = query.filter(CardTemplate.isMember == (1 if isMember else 0))
    templates = query.order_by(CardTemplate.id.asc()).all()
    return [_toItem(t) for t in templates]


def getById(db: Session, id: int) -> dict | None:
    tpl = db.query(CardTemplate).filter(CardTemplate.id == id).first()
    if not tpl or tpl.status != 1:
        return None
    return _toItem(tpl)
