"""GitHub 原始数据导入服务

对应 TypeScript 版 server/src/services/github_import_service.ts
- 用 httpx 同步请求下载 raw JSON，带超时与重试
- 去重使用 utils/dedup.py 的 dedup["fingerprint"]（MD5 + SimHash）
"""
import json
import time

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import CrawlRecord, OriginalText
from ..utils.dedup import dedup
from ..utils.logger import logger

FETCH_TIMEOUT_MS = 30_000
MAX_RETRIES = 3
RETRY_DELAY_MS = 1500

_UA = "ShiJu-Crawler/1.0 (+https://github.com)"


def _pick_content(item: dict):
    """prologue（小序）+ paragraphs/正文 一并拼接"""
    parts = []
    if isinstance(item.get("prologue"), str) and item["prologue"].strip():
        parts.append(item["prologue"].strip())
    paragraphs = item.get("paragraphs")
    if isinstance(paragraphs, list):
        joined = "\n".join(s for s in paragraphs if isinstance(s, str))
        if joined.strip():
            parts.append(joined.strip())
    else:
        for key in ("content", "quote", "text"):
            v = item.get(key)
            if isinstance(v, str) and v.strip():
                parts.append(v.strip())
                break
    merged = "\n\n".join(p for p in parts if p).strip()
    return merged or None


def _pick_author(item: dict):
    for key in ("author", "作者"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _pick_title(item: dict):
    """优先级：title（诗）→ rhythmic（词牌名）"""
    for key in ("title", "rhythmic"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _pick_tags(item: dict):
    tags = item.get("tags")
    if isinstance(tags, list):
        arr = [t for t in tags if isinstance(t, str)]
        if arr:
            return ",".join(arr)
    if isinstance(tags, str) and tags.strip():
        return tags.strip()
    for key in ("categoryType", "poem_type", "type"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return None


def _pick_category_type(item: dict, fallback=None):
    for key in ("categoryType", "poem_type", "type"):
        v = item.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return fallback


def _parse_json(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for key in ("data", "items", "list"):
            v = raw.get(key)
            if isinstance(v, list):
                return v
    return []


def _fetch_with_retry(url: str) -> dict:
    """下载 rawUrl 内容。返回 {"ok": True, "text": ...} 或 {"ok": False, "error": ...}"""
    last_error = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = httpx.get(
                url,
                headers={"User-Agent": _UA},
                follow_redirects=True,
                timeout=FETCH_TIMEOUT_MS / 1000.0,
            )
            if resp.status_code == 404:
                return {"ok": False, "error": f"HTTP 404 资源不存在（已尝试 {attempt} 次）"}
            if 400 <= resp.status_code < 500:
                detail = resp.text[:200]
                return {
                    "ok": False,
                    "error": f"HTTP {resp.status_code} {resp.reason_phrase or ''}: {detail}",
                }
            if not resp.is_success:
                last_error = f"HTTP {resp.status_code} {resp.reason_phrase or ''}"
            else:
                return {"ok": True, "text": resp.text}
        except httpx.TimeoutException:
            last_error = f"请求超时 ({FETCH_TIMEOUT_MS}ms)"
        except Exception as e:
            last_error = str(e)
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_DELAY_MS * attempt / 1000.0)
    return {"ok": False, "error": f"{last_error}（重试 {MAX_RETRIES} 次仍失败）"}


def _load_existing_stores(db: Session) -> dict:
    """加载已存在素材的去重指纹（OriginalText + CrawlRecord 临时库）"""
    stores = {
        "originalMd5s": set(),
        "originalSimHashes": [],
        "localBatchMd5s": set(),
    }

    for (content_md5,) in (
        db.query(OriginalText.contentMd5).filter(OriginalText.contentMd5.isnot(None)).all()
    ):
        if content_md5:
            stores["originalMd5s"].add(content_md5)

    for (sim_hash,) in (
        db.query(OriginalText.simHash).filter(OriginalText.simHash.isnot(None)).all()
    ):
        if sim_hash:
            stores["originalSimHashes"].append(sim_hash)

    # CrawlRecord 临时库也比对
    for (content,) in db.query(CrawlRecord.content).all():
        fp = dedup["fingerprint"](content)
        stores["originalMd5s"].add(fp["contentMd5"])
        if fp["simHash"]:
            stores["originalSimHashes"].append(fp["simHash"])

    return stores


def import_from_github_raw(db: Session, options: dict) -> dict:
    """从 GitHub raw JSON 导入原文素材，带去重。

    options 键：rawUrl / taskId / sourceId / sourceName / complianceTag /
               protocol / datasetType / categoryType / provider
    """
    result = {
        "totalFetched": 0,
        "totalInserted": 0,
        "totalSkipped": 0,
        "originalTextsInserted": 0,
        "skippedReason": {"md5": 0, "simhash": 0},
        "errors": [],
    }

    raw_url = options.get("rawUrl")
    task_id = options.get("taskId")
    source_id = options.get("sourceId")

    fetched = _fetch_with_retry(raw_url)
    if not fetched["ok"]:
        result["errors"].append(f"下载失败 [{raw_url}]: {fetched['error']}")
        return result
    text = fetched["text"]

    try:
        data = json.loads(text)
    except Exception as err:
        result["errors"].append(f"JSON 解析失败: {err}")
        return result

    records = _parse_json(data)
    result["totalFetched"] = len(records)
    if not records:
        result["errors"].append("未解析到任何记录，数据结构可能不匹配")
        return result

    stores = _load_existing_stores(db)
    sim_threshold = dedup["DEFAULT_SIMHASH_THRESHOLD"]
    boundary = dedup["SHORT_TEXT_BOUNDARY"]

    for item in records:
        content = _pick_content(item)
        if not content or len(content) < 2:
            result["totalSkipped"] += 1
            continue

        fp = dedup["fingerprint"](content)

        # === OriginalText 去重 ===
        # 1) 本地批次 MD5 快速拦截
        if fp["contentMd5"] in stores["localBatchMd5s"]:
            result["totalSkipped"] += 1
            result["skippedReason"]["md5"] += 1
            continue
        # 2) 正式素材库 MD5
        if fp["contentMd5"] in stores["originalMd5s"]:
            result["totalSkipped"] += 1
            result["skippedReason"]["md5"] += 1
            continue
        # 3) 长文本 SimHash 相似度 > 85%
        if len(content) >= boundary:
            sim_dup = False
            for existing_hash in stores["originalSimHashes"]:
                if dedup["hammingDistance"](fp["simHash"], existing_hash) <= sim_threshold:
                    sim_dup = True
                    break
            if sim_dup:
                result["totalSkipped"] += 1
                result["skippedReason"]["simhash"] += 1
                continue

        stores["localBatchMd5s"].add(fp["contentMd5"])
        stores["originalMd5s"].add(fp["contentMd5"])
        stores["originalSimHashes"].append(fp["simHash"])

        title = _pick_title(item)
        author = _pick_author(item)
        tags = _pick_tags(item)
        cat_type = _pick_category_type(item, options.get("categoryType"))
        word_count = len(content)
        source_name = item.get("source") if isinstance(item.get("source"), str) else None
        source_name = source_name or options.get("sourceName") or options.get("provider") or "GitHub"

        try:
            ot = OriginalText(
                title=title or content[:30],
                contentMd5=fp["contentMd5"],
                simHash=fp["simHash"],
                author=author,
                source=source_name,
                sourceUrl=raw_url,
                categoryType=cat_type,
                content=content,
                summary=(content[:200] + "…") if len(content) > 200 else None,
                tags=tags,
                wordCount=word_count,
                provider=options.get("provider") or "github_dataset",
                complianceTag=options.get("complianceTag"),
                auditStatus=0,
                quoteCount=0,
            )
            db.add(ot)
            db.commit()
            result["originalTextsInserted"] += 1
        except IntegrityError:
            db.rollback()
            result["totalSkipped"] += 1
            continue
        except Exception as err:
            db.rollback()
            result["errors"].append(f"OriginalText 写入失败: {err}")
            result["totalSkipped"] += 1
            continue

        # 采集临时库（供后续双重比对）
        try:
            db.add(CrawlRecord(
                taskId=task_id,
                sourceId=source_id,
                originalUrl=raw_url,
                content=content,
                author=author,
                sourceName=source_name,
                fingerprint=fp["contentMd5"],
                simHash=fp["simHash"],
                categoryType=cat_type,
                auditStatus=0,
            ))
            db.commit()
        except Exception:
            db.rollback()

        result["totalInserted"] += 1

    return result
