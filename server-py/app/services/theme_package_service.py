"""主题包服务（对应 TS theme_package_service.ts）"""
from sqlalchemy.orm import Session

from ..models import ThemePackage


def _toItem(i: ThemePackage) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "description": i.description,
        "coverUrl": i.coverUrl,
        "quoteIds": i.quoteIds,
        "isMember": i.isMember,
        "adUnlockDays": i.adUnlockDays,
        "expireDate": i.expireDate.isoformat() if i.expireDate else None,
    }


def list(db: Session) -> list:
    items = (
        db.query(ThemePackage)
        .filter(ThemePackage.status == 1)
        .order_by(ThemePackage.id.asc())
        .all()
    )
    return [_toItem(i) for i in items]


def getById(db: Session, id: int) -> dict | None:
    item = db.query(ThemePackage).filter(ThemePackage.id == id).first()
    if not item or item.status != 1:
        return None
    return _toItem(item)
