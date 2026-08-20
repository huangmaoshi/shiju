"""系统配置服务（对应 TS system_config_service.ts）"""
from datetime import datetime

from sqlalchemy.orm import Session

from ..deps import BusinessError
from ..models import PaymentConfig, SystemConfig


def get(db: Session, key: str, fallback: str | None = None) -> str | None:
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    return row.value if row else fallback


def set(db: Session, key: str, value: str, remark: str | None = None) -> None:
    row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if row:
        row.value = value
        if remark is not None:
            row.remark = remark
        row.updatedAt = datetime.now()
    else:
        db.add(SystemConfig(key=key, value=value, remark=remark))
    db.commit()


def list(db: Session) -> list:
    rows = db.query(SystemConfig).order_by(SystemConfig.key.asc()).all()
    return [
        {
            "id": r.id,
            "key": r.key,
            "value": r.value,
            "remark": r.remark,
            "updatedAt": r.updatedAt.isoformat() if r.updatedAt else None,
        }
        for r in rows
    ]


def batchUpdate(db: Session, items: list) -> None:
    for item in items:
        if not item.get("key"):
            continue
        set(db, item["key"], str(item.get("value")), item.get("remark"))


def ensureDefaults(db: Session) -> None:
    defaults = [
        ("default_trial_days", "7", "新用户默认试用天数"),
    ]
    for key, value, remark in defaults:
        row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if not row:
            db.add(SystemConfig(key=key, value=value, remark=remark))
            db.commit()


def _serializePaymentConfig(c: PaymentConfig) -> dict:
    return {
        "id": c.id,
        "payChannel": c.payChannel,
        "appId": c.appId,
        "mchId": c.mchId,
        "apiKey": c.apiKey,
        "notifyUrl": c.notifyUrl,
        "isActive": c.isActive,
        "remark": c.remark,
        "updatedAt": c.updatedAt.isoformat() if c.updatedAt else None,
    }


def listPaymentConfigs(db: Session) -> list:
    rows = db.query(PaymentConfig).all()
    return [_serializePaymentConfig(c) for c in rows]


def upsertPaymentConfig(db: Session, data: dict) -> dict:
    payChannel = data.get("payChannel")
    if not payChannel:
        raise BusinessError(400, "payChannel 不能为空")

    row = db.query(PaymentConfig).filter(PaymentConfig.payChannel == payChannel).first()
    if row:
        for field in ("appId", "mchId", "apiKey", "notifyUrl", "isActive", "remark"):
            if data.get(field) is not None:
                setattr(row, field, data[field])
        row.updatedAt = datetime.now()
    else:
        row = PaymentConfig(
            payChannel=payChannel,
            appId=data.get("appId"),
            mchId=data.get("mchId"),
            apiKey=data.get("apiKey"),
            notifyUrl=data.get("notifyUrl"),
            isActive=data.get("isActive", True),
            remark=data.get("remark"),
        )
        db.add(row)
    db.commit()
    db.refresh(row)

    return _serializePaymentConfig(row)
