"""广告配置服务（对应 TS ad_service.ts）"""
from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import AdConfig


def _serialize(c: AdConfig) -> dict:
    return {
        "id": c.id,
        "position": c.position,
        "adType": c.adType,
        "adUnitId": c.adUnitId,
        "platform": c.platform,
        "frequency": c.frequency,
        "priority": c.priority,
    }


def getConfigs(db: Session, position: str, platform: str | None = None) -> list:
    query = db.query(AdConfig).filter(AdConfig.status == 1, AdConfig.position == position)
    if platform:
        query = query.filter(AdConfig.platform == platform)
    configs = query.order_by(AdConfig.priority.desc(), AdConfig.id.asc()).all()
    return [_serialize(c) for c in configs]


def impression(db: Session, userId: int, adUnitId: str) -> None:
    exists = (
        db.query(AdConfig).filter(AdConfig.adUnitId == adUnitId, AdConfig.status == 1).first()
    )
    if not exists:
        raise BusinessError(404, "广告位不存在或已禁用")


def click(db: Session, userId: int, adUnitId: str) -> None:
    exists = (
        db.query(AdConfig).filter(AdConfig.adUnitId == adUnitId, AdConfig.status == 1).first()
    )
    if not exists:
        raise BusinessError(404, "广告位不存在或已禁用")


def rewardVerify(db: Session, userId: int, adUnitId: str, rewardToken: str) -> dict:
    ad = db.query(AdConfig).filter(AdConfig.adUnitId == adUnitId, AdConfig.status == 1).first()
    if not ad:
        raise BusinessError(404, "广告位不存在或已禁用")

    if not rewardToken:
        raise BusinessError(400, "rewardToken 不能为空")

    return {
        "success": True,
        "rewardUnitId": adUnitId,
        "verified": True,
    }
