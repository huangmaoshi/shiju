"""多端同步服务（对应 TS sync_service.ts）"""
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import Collection, CustomQuote, RecitePlan, SyncRecord

TABLE_MAP = {
    "collections": Collection,
    "customQuotes": CustomQuote,
    "recitePlans": RecitePlan,
}


def _parseDate(s) -> datetime:
    if not s:
        return datetime(1970, 1, 1)
    s = str(s)
    if "T" not in s and len(s) == 10:
        s = s + "T00:00:00"
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return datetime(1970, 1, 1)


def _dedupeChanges(items: list) -> list:
    m = {}
    for item in items:
        m[str(item["data"]["id"])] = item
    return list(m.values())


def _modelFields(model, data: dict) -> dict:
    cols = set(model.__table__.columns.keys())
    return {k: v for k, v in data.items() if k in cols}


def pull(
    db: Session, userId: int, lastSyncAt: str | None, deviceId: str | None = None
) -> dict:
    since = _parseDate(lastSyncAt)

    query = db.query(SyncRecord).filter(
        SyncRecord.userId == userId,
        SyncRecord.syncAt > since,
    )
    if deviceId:
        query = query.filter(SyncRecord.deviceId.isnot(deviceId))
    records = query.order_by(SyncRecord.syncAt.asc()).all()

    changes = {}
    for record in records:
        key = record.tableName
        changes.setdefault(key, []).append(
            {
                "action": record.action,
                "data": {"id": record.recordId},
            }
        )

    for key in list(changes.keys()):
        changes[key] = _dedupeChanges(changes[key])

    return {"serverTime": datetime.now().isoformat(), "changes": changes}


def push(
    db: Session, userId: int, changes: dict, deviceId: str | None = None
) -> dict:
    synced = 0

    try:
        for tableName, items in changes.items():
            model = TABLE_MAP.get(tableName)
            if not model:
                continue

            for item in items:
                action = item.get("action")
                data = item.get("data") or {}
                record_id = data.get("id")

                if action == "upsert":
                    rest = _modelFields(model, data)
                    rest.pop("userId", None)
                    if record_id:
                        rest.pop("id", None)
                        existing = db.query(model).filter(model.id == record_id).first()
                        if existing:
                            for k, v in rest.items():
                                setattr(existing, k, v)
                        else:
                            db.add(model(**rest, id=record_id, userId=userId))
                    else:
                        db.add(model(**rest, userId=userId))
                elif action == "delete":
                    if record_id:
                        target = db.query(model).filter(model.id == record_id).first()
                        if target:
                            db.delete(target)

                db.add(
                    SyncRecord(
                        userId=userId,
                        tableName=tableName,
                        recordId=record_id or 0,
                        action=action,
                        deviceId=deviceId,
                    )
                )
                db.commit()
                synced += 1
    except Exception:
        db.rollback()
        raise

    return {"synced": synced, "serverTime": datetime.now().isoformat()}


def batchPush(db: Session, userId: int, payload: dict) -> dict:
    return push(db, userId, payload.get("changes") or {}, payload.get("deviceId"))
