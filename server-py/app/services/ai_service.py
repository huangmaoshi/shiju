"""AI 提取 / 拼音 / 繁简转换 / 分类服务

对应 TypeScript 版 server/src/services/ai_service.ts
- 异步任务（_run_extract / _run_batch_extract）用 threading.Thread(daemon=True) 启动，
  线程内通过 SessionLocal() 新建独立会话（后台线程不允许复用请求注入的 session）。
- AiExtractTask 状态流转：pending -> running -> success / failed
- extractedQuotes 字段存 JSON 字符串（json.dumps ensure_ascii=False）
"""
import json
import re
import threading
from datetime import datetime

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..deps import BusinessError
from ..models import (
    AiConfig,
    AiExtractTask,
    Category,
    OriginalText,
    OriginalTextCategory,
    Quote,
    QuoteCategory,
)
from ..utils.ai_client import AiClient, AiClientError
from ..utils.logger import logger
from ..utils.trad_to_simpl import contains_traditional_chinese, trad_to_simpl

DEFAULT_PROMPT_TEMPLATE = "请从以下{type}中提取 3-8 句最具金句潜质的句子，每句一行，只输出句子不要序号：\n\n{content}"

PINYIN_PROMPT = """请为以下中文文本逐字标注拼音。返回JSON数组格式，每个元素为 {"c":"单个字符","p":"带声调的拼音"}。
要求：
1. 每个中文字符对应一个拼音（带声调标记，如 hǎi）
2. 标点符号的 p 为空字符串 ""
3. 换行符的 c 为 "\\n"，p 为空字符串
4. 只返回JSON数组，不要任何其他内容、不要markdown代码块

文本：{content}"""

DEFAULT_SIMPLIFY_PROMPT = """请将以下繁体字/异体字文本转换为标准简体中文。

要求：
1. 保持原文的标点、格式和段落结构不变
2. 只做繁简转换，不要修改任何词汇或语法
3. 如果文本已是简体，直接返回原文
4. 只返回转换后的文本，不要任何解释

文本：
{content}"""

DEFAULT_CLASSIFY_PROMPT = """你是一个专业的内容分类助手。请根据以下文本内容，从给定的分类列表中选择最合适的分类（可多选，1-5个）。

可用分类列表（格式：ID | 分类名 | 维度 | 父分类）：
{categories}

待分类内容：
{content}

要求：
1. 从上面的分类列表中选择最匹配的分类，可以是多个
2. 综合考虑内容类型、主题、用途场景、时代等维度
3. 只返回JSON数组，元素为分类ID（数字），如 [1, 5, 12]
4. 不要返回任何其他内容、不要markdown代码块"""


# ====== 序列化 ======


def _serialize_config(c) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "provider": c.provider,
        "apiKey": c.apiKey,
        "baseUrl": c.baseUrl,
        "model": c.model,
        "temperature": c.temperature,
        "maxTokens": c.maxTokens,
        "promptTemplate": c.promptTemplate,
        "pinyinPromptTemplate": c.pinyinPromptTemplate,
        "simplifyPromptTemplate": c.simplifyPromptTemplate,
        "classifyPromptTemplate": c.classifyPromptTemplate,
        "timeoutMs": c.timeoutMs,
        "retryCount": c.retryCount,
        "batchConcurrency": c.batchConcurrency,
        "isDefault": c.isDefault,
        "isActive": c.isActive,
        "remark": c.remark,
        "createdAt": c.createdAt,
        "updatedAt": c.updatedAt,
    }


def _serialize_task(t) -> dict:
    return {
        "id": t.id,
        "configId": t.configId,
        "originalTextId": t.originalTextId,
        "batchSource": t.batchSource,
        "batchIds": t.batchIds,
        "status": t.status,
        "totalCount": t.totalCount,
        "successCount": t.successCount,
        "failCount": t.failCount,
        "extractedQuotes": t.extractedQuotes,
        "errorMessage": t.errorMessage,
        "startAt": t.startAt,
        "endAt": t.endAt,
        "duration": t.duration,
        "createdAt": t.createdAt,
        "updatedAt": t.updatedAt,
    }


# ====== AiConfig ======


def list_configs(db: Session) -> list:
    rows = db.query(AiConfig).order_by(AiConfig.id.desc()).all()
    return [_serialize_config(r) for r in rows]


def get_config(db: Session, config_id: int) -> dict:
    c = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not c:
        raise BusinessError(404, "AI 配置不存在", 404)
    return _serialize_config(c)


def create_config(db: Session, data: dict) -> dict:
    cfg = AiConfig(
        name=data["name"],
        provider=data["provider"],
        apiKey=data.get("apiKey") or "",
        baseUrl=data["baseUrl"],
        model=data["model"],
        temperature=data.get("temperature", 0.7),
        maxTokens=data.get("maxTokens", 2048),
        promptTemplate=data.get("promptTemplate") or DEFAULT_PROMPT_TEMPLATE,
        pinyinPromptTemplate=data.get("pinyinPromptTemplate"),
        simplifyPromptTemplate=data.get("simplifyPromptTemplate"),
        classifyPromptTemplate=data.get("classifyPromptTemplate"),
        timeoutMs=data.get("timeoutMs", 60000),
        retryCount=data.get("retryCount", 2),
        batchConcurrency=data.get("batchConcurrency", 3),
        remark=data.get("remark"),
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return _serialize_config(cfg)


def update_config(db: Session, config_id: int, data: dict) -> dict:
    cfg = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not cfg:
        raise BusinessError(404, "AI 配置不存在", 404)
    allowed_keys = (
        "name", "provider", "apiKey", "baseUrl", "model", "temperature",
        "maxTokens", "promptTemplate", "pinyinPromptTemplate",
        "simplifyPromptTemplate", "classifyPromptTemplate", "timeoutMs",
        "retryCount", "batchConcurrency", "isActive", "remark",
    )
    for key in allowed_keys:
        if key in data and data[key] is not None:
            setattr(cfg, key, data[key])
    db.commit()
    db.refresh(cfg)
    return _serialize_config(cfg)


def delete_config(db: Session, config_id: int):
    cfg = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not cfg:
        raise BusinessError(404, "AI 配置不存在", 404)
    if cfg.isDefault:
        raise BusinessError(400, "默认配置不可删除，请先设置其他默认配置")
    db.delete(cfg)
    db.commit()
    return None


def set_default_config(db: Session, config_id: int) -> dict:
    cfg = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not cfg:
        raise BusinessError(404, "AI 配置不存在", 404)
    db.query(AiConfig).filter(AiConfig.isDefault == True).update(
        {"isDefault": False}, synchronize_session=False
    )
    cfg.isDefault = True
    cfg.isActive = True
    db.commit()
    db.refresh(cfg)
    return _serialize_config(cfg)


# ====== AiExtractTask ======


def list_tasks(db: Session) -> list:
    rows = db.query(AiExtractTask).order_by(AiExtractTask.id.desc()).limit(200).all()
    return [_serialize_task(r) for r in rows]


def get_task(db: Session, task_id: int) -> dict:
    t = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
    if not t:
        raise BusinessError(404, "提取任务不存在", 404)
    return _serialize_task(t)


def delete_task(db: Session, task_id: int):
    t = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
    if not t:
        raise BusinessError(404, "提取任务不存在", 404)
    db.delete(t)
    db.commit()
    return None


# ====== 提取入口 ======


def extract_from_text(db: Session, config_id: int, original_text_id: int) -> dict:
    config = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not config:
        raise BusinessError(404, "AI 配置不存在", 404)

    original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
    if not original:
        raise BusinessError(404, "原文不存在", 404)

    task = AiExtractTask(
        configId=config_id,
        originalTextId=original_text_id,
        batchSource="original_text",
        status="pending",
        totalCount=1,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    threading.Thread(target=_run_extract, args=(task.id,), daemon=True).start()
    return _serialize_task(task)


def extract_from_batch(db: Session, config_id: int, original_text_ids: list) -> dict:
    if not original_text_ids:
        raise BusinessError(400, "ID 列表不能为空")

    config = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    if not config:
        raise BusinessError(404, "AI 配置不存在", 404)

    originals = db.query(OriginalText).filter(OriginalText.id.in_(original_text_ids)).all()
    if not originals:
        raise BusinessError(404, "没有找到有效的原文")

    valid_ids = [o.id for o in originals]

    task = AiExtractTask(
        configId=config_id,
        batchSource="original_text",
        batchIds=json.dumps(valid_ids),
        status="pending",
        totalCount=len(valid_ids),
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    threading.Thread(target=_run_batch_extract, args=(task.id,), daemon=True).start()
    return _serialize_task(task)


# ====== 内部执行 ======


def _build_client(config) -> AiClient:
    return AiClient(
        api_key=config.apiKey or "",
        base_url=config.baseUrl,
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.maxTokens,
        timeout_ms=config.timeoutMs or 60000,
        retry_count=config.retryCount or 2,
    )


def _build_prompt(template: str, content: str, type_: str | None = None) -> str:
    safe_type = type_ or "文章"
    return template.replace("{type}", safe_type).replace("{content}", content)


def _parse_sentences(raw: str) -> list:
    lines = [s.strip() for s in re.split(r"\r?\n", raw)]
    lines = [s for s in lines if len(s) > 0]

    cleaned = [
        re.sub(r"^[\d①②③④⑤⑥⑦⑧⑨⑩一二三四五六七八九十]+[.、)\]\s]+", "", line).strip()
        for line in lines
    ]

    seen = set()
    result = []
    for s in cleaned:
        if not s:
            continue
        key = re.sub(r"\s+", "", s)
        if key in seen:
            continue
        seen.add(key)
        result.append(s)
    return result


def _run_extract(task_id: int) -> None:
    """单条原文 AI 提取（后台线程执行，独立 db session）"""
    db = SessionLocal()
    started_at = datetime.now()
    try:
        task = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
        if not task or not task.originalTextId:
            return

        task.status = "running"
        task.startAt = datetime.now()
        db.commit()

        config = db.query(AiConfig).filter(AiConfig.id == task.configId).first()
        original = db.query(OriginalText).filter(OriginalText.id == task.originalTextId).first()
        if not config or not original:
            raise Exception("配置或原文缺失")

        client = _build_client(config)
        prompt = _build_prompt(
            config.promptTemplate or DEFAULT_PROMPT_TEMPLATE,
            original.content,
            original.categoryType or original.title,
        )

        raw = client.chat([
            {"role": "system", "content": "你是一个专业的金句提取助手。"},
            {"role": "user", "content": prompt},
        ])

        sentences = _parse_sentences(raw)

        created_count = 0
        for sentence in sentences:
            db.add(Quote(
                content=sentence,
                author=original.author,
                source=original.source or original.title,
                sourceUrl=original.sourceUrl,
                originalTextId=original.id,
                provider="ai_extract",
                aiExtracted=True,
                quoteType="ai",
                isFree=True,
                isActive=True,
                wordCount=len(sentence),
            ))
            created_count += 1
        db.commit()

        original.quoteCount = (original.quoteCount or 0) + created_count
        db.commit()

        duration = int((datetime.now() - started_at).total_seconds() * 1000)
        task.status = "success"
        task.successCount = created_count
        task.extractedQuotes = json.dumps(sentences, ensure_ascii=False)
        task.endAt = datetime.now()
        task.duration = duration
        db.commit()

        logger.info(f"[AI Extract] task={task_id} original={original.id} quotes={created_count} duration={duration}ms")
    except Exception as err:
        duration = int((datetime.now() - started_at).total_seconds() * 1000)
        message = f"AI 错误 ({err.status}): {err.message}" if isinstance(err, AiClientError) else str(err)
        logger.error(f"[AI Extract] task={task_id} failed: {message}")
        try:
            db.rollback()
            task = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.errorMessage = message
                task.endAt = datetime.now()
                task.duration = duration
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


def _run_batch_extract(task_id: int) -> None:
    """批量原文 AI 提取（后台线程执行，独立 db session，串行处理）"""
    db = SessionLocal()
    started_at = datetime.now()
    success_count = 0
    fail_count = 0
    errors = []
    try:
        task = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
        if not task:
            return

        task.status = "running"
        task.startAt = datetime.now()
        db.commit()

        config = db.query(AiConfig).filter(AiConfig.id == task.configId).first()
        if not config:
            raise Exception("AI 配置不存在")

        ids = json.loads(task.batchIds) if task.batchIds else []
        client = _build_client(config)

        for original_id in ids:
            try:
                original = db.query(OriginalText).filter(OriginalText.id == original_id).first()
                if not original:
                    fail_count += 1
                    errors.append(f"原文 {original_id} 不存在")
                    continue

                prompt = _build_prompt(
                    config.promptTemplate or DEFAULT_PROMPT_TEMPLATE,
                    original.content,
                    original.categoryType or original.title,
                )
                raw = client.chat([
                    {"role": "system", "content": "你是一个专业的金句提取助手。"},
                    {"role": "user", "content": prompt},
                ])
                sentences = _parse_sentences(raw)

                created_count = 0
                for sentence in sentences:
                    db.add(Quote(
                        content=sentence,
                        author=original.author,
                        source=original.source or original.title,
                        sourceUrl=original.sourceUrl,
                        originalTextId=original.id,
                        provider="ai_extract",
                        aiExtracted=True,
                        quoteType="ai",
                        isFree=True,
                        isActive=True,
                        wordCount=len(sentence),
                    ))
                    created_count += 1
                db.commit()

                original.quoteCount = (original.quoteCount or 0) + created_count
                db.commit()

                success_count += created_count
            except Exception as item_err:
                db.rollback()
                fail_count += 1
                msg = (
                    f"AI 错误 ({item_err.status}): {item_err.message}"
                    if isinstance(item_err, AiClientError)
                    else str(item_err)
                )
                errors.append(f"原文 {original_id}: {msg}")

        duration = int((datetime.now() - started_at).total_seconds() * 1000)
        task.status = "failed" if fail_count == len(ids) else "success"
        task.successCount = success_count
        task.failCount = fail_count
        task.errorMessage = "; ".join(errors[:10])
        task.endAt = datetime.now()
        task.duration = duration
        db.commit()

        logger.info(f"[AI Batch] task={task_id} total={len(ids)} success={success_count} fail={fail_count} duration={duration}ms")
    except Exception as err:
        duration = int((datetime.now() - started_at).total_seconds() * 1000)
        logger.error(f"[AI Batch] task={task_id} fatal: {err}")
        try:
            db.rollback()
            task = db.query(AiExtractTask).filter(AiExtractTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.failCount = fail_count
                task.successCount = success_count
                task.errorMessage = str(err)
                task.endAt = datetime.now()
                task.duration = duration
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


# ====== 拼音生成 ======


def _parse_pinyin_json(raw: str, text: str):
    """解析 AI 返回的拼音 JSON，容错处理"""
    try:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        arr = json.loads(cleaned)
        if not isinstance(arr, list) or len(arr) == 0:
            return None
        valid = all(
            isinstance(item, dict) and isinstance(item.get("c"), str) and isinstance(item.get("p"), str)
            for item in arr
        )
        if not valid:
            return None
        return json.dumps(arr, ensure_ascii=False)
    except Exception:
        logger.error(f"[AI Pinyin] 解析失败，原始返回: {raw[:200]}")
        return None


def _get_config(db: Session, config_id: int | None = None):
    cfg = None
    if config_id:
        cfg = db.query(AiConfig).filter(AiConfig.id == config_id).first()
    else:
        cfg = db.query(AiConfig).filter(AiConfig.isDefault == True, AiConfig.isActive == True).first()
    if not cfg:
        raise BusinessError(400, "未找到可用的 AI 配置", 400)
    return cfg


def generate_pinyin_for_quote(db: Session, quote_id: int, config_id: int | None = None) -> dict:
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)

    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.pinyinPromptTemplate or PINYIN_PROMPT
    prompt = template.replace("{content}", quote.content)

    raw = client.chat([
        {"role": "system", "content": "你是一个专业的中文拼音标注助手。"},
        {"role": "user", "content": prompt},
    ])

    pinyin_data = _parse_pinyin_json(raw, quote.content)
    if not pinyin_data:
        raise BusinessError(500, "AI 返回拼音格式解析失败", 500)

    quote.pinyinData = pinyin_data
    db.commit()

    logger.info(f"[AI Pinyin] quote={quote_id} chars={len(quote.content)} done")
    return {"id": quote_id, "pinyinData": pinyin_data}


def generate_pinyin_for_quotes_batch(db: Session, quote_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.pinyinPromptTemplate or PINYIN_PROMPT
    success = 0
    failed = 0
    errors = []

    for quote_id in quote_ids:
        try:
            quote = db.query(Quote).filter(Quote.id == quote_id).first()
            if not quote:
                failed += 1
                errors.append(f"金句 {quote_id} 不存在")
                continue

            prompt = template.replace("{content}", quote.content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的中文拼音标注助手。"},
                {"role": "user", "content": prompt},
            ])

            pinyin_data = _parse_pinyin_json(raw, quote.content)
            if not pinyin_data:
                failed += 1
                errors.append(f"金句 {quote_id} 拼音解析失败")
                continue

            quote.pinyinData = pinyin_data
            db.commit()
            success += 1
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"金句 {quote_id}: {err}")

    logger.info(f"[AI Pinyin Batch] quotes total={len(quote_ids)} success={success} failed={failed}")
    return {"total": len(quote_ids), "success": success, "failed": failed, "errors": errors[:10]}


def generate_pinyin_for_original_text(db: Session, original_text_id: int, config_id: int | None = None) -> dict:
    original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
    if not original:
        raise BusinessError(404, "原文不存在", 404)

    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.pinyinPromptTemplate or PINYIN_PROMPT
    prompt = template.replace("{content}", original.content)

    raw = client.chat([
        {"role": "system", "content": "你是一个专业的中文拼音标注助手。"},
        {"role": "user", "content": prompt},
    ])

    pinyin_data = _parse_pinyin_json(raw, original.content)
    if not pinyin_data:
        raise BusinessError(500, "AI 返回拼音格式解析失败", 500)

    original.pinyinData = pinyin_data
    db.commit()

    logger.info(f"[AI Pinyin] originalText={original_text_id} chars={len(original.content)} done")
    return {"id": original_text_id, "pinyinData": pinyin_data}


def generate_pinyin_for_original_texts_batch(db: Session, original_text_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.pinyinPromptTemplate or PINYIN_PROMPT
    success = 0
    failed = 0
    errors = []

    for original_text_id in original_text_ids:
        try:
            original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
            if not original:
                failed += 1
                errors.append(f"原文 {original_text_id} 不存在")
                continue

            prompt = template.replace("{content}", original.content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的中文拼音标注助手。"},
                {"role": "user", "content": prompt},
            ])

            pinyin_data = _parse_pinyin_json(raw, original.content)
            if not pinyin_data:
                failed += 1
                errors.append(f"原文 {original_text_id} 拼音解析失败")
                continue

            original.pinyinData = pinyin_data
            db.commit()
            success += 1
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"原文 {original_text_id}: {err}")

    logger.info(f"[AI Pinyin Batch] originalTexts total={len(original_text_ids)} success={success} failed={failed}")
    return {"total": len(original_text_ids), "success": success, "failed": failed, "errors": errors[:10]}


# ====== 繁转简 ======


def simplify_text(db: Session, text: str, config_id: int | None = None) -> str:
    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.simplifyPromptTemplate or DEFAULT_SIMPLIFY_PROMPT
    prompt = template.replace("{content}", text)

    raw = client.chat([
        {"role": "system", "content": "你是一个专业的繁简转换助手，擅长将繁体字转换为标准简体中文。"},
        {"role": "user", "content": prompt},
    ])

    result = raw.strip()
    logger.info(f"[AI Simplify] input={len(text)} chars output={len(result)} chars")
    return result


def simplify_quote(db: Session, quote_id: int, config_id: int | None = None) -> dict:
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)

    simplified = simplify_text(db, quote.content, config_id)
    quote.simplifiedContent = simplified
    db.commit()

    logger.info(f"[AI Simplify] quote={quote_id} done")
    return {"id": quote_id, "content": quote.content, "simplifiedContent": simplified}


def simplify_quotes_batch(db: Session, quote_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.simplifyPromptTemplate or DEFAULT_SIMPLIFY_PROMPT
    success = 0
    failed = 0
    errors = []

    for quote_id in quote_ids:
        try:
            quote = db.query(Quote).filter(Quote.id == quote_id).first()
            if not quote:
                failed += 1
                errors.append(f"金句 {quote_id} 不存在")
                continue

            prompt = template.replace("{content}", quote.content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的繁简转换助手。"},
                {"role": "user", "content": prompt},
            ])

            quote.simplifiedContent = raw.strip()
            db.commit()
            success += 1
            logger.info(f"[AI Simplify] progress {success + failed}/{len(quote_ids)}")
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"金句 {quote_id}: {err}")

    logger.info(f"[AI Simplify Batch] total={len(quote_ids)} success={success} failed={failed}")
    return {"total": len(quote_ids), "success": success, "failed": failed, "errors": errors[:10]}


def simplify_original_text(db: Session, original_text_id: int, config_id: int | None = None) -> dict:
    original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
    if not original:
        raise BusinessError(404, "原文不存在", 404)

    simplified = simplify_text(db, original.content, config_id)
    original.simplifiedContent = simplified
    db.commit()

    logger.info(f"[AI Simplify] originalText={original_text_id} done")
    return {"id": original_text_id, "content": original.content, "simplifiedContent": simplified}


def simplify_original_texts_batch(db: Session, original_text_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    template = config.simplifyPromptTemplate or DEFAULT_SIMPLIFY_PROMPT
    success = 0
    failed = 0
    errors = []

    for original_text_id in original_text_ids:
        try:
            original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
            if not original:
                failed += 1
                errors.append(f"原文 {original_text_id} 不存在")
                continue

            prompt = template.replace("{content}", original.content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的繁简转换助手。"},
                {"role": "user", "content": prompt},
            ])

            original.simplifiedContent = raw.strip()
            db.commit()
            success += 1
            logger.info(f"[AI Simplify] progress {success + failed}/{len(original_text_ids)}")
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"原文 {original_text_id}: {err}")

    logger.info(f"[AI Simplify Batch] originalTexts total={len(original_text_ids)} success={success} failed={failed}")
    return {"total": len(original_text_ids), "success": success, "failed": failed, "errors": errors[:10]}


# ====== 一键批量处理（One-Click Batch）======


def get_one_click_stats(db: Session) -> dict:
    quotes_without_pinyin = (
        db.query(Quote)
        .filter(or_(Quote.pinyinData.is_(None), Quote.pinyinData == ""))
        .count()
    )
    original_texts_without_pinyin = (
        db.query(OriginalText)
        .filter(or_(OriginalText.pinyinData.is_(None), OriginalText.pinyinData == ""))
        .count()
    )
    original_texts_without_quotes = (
        db.query(OriginalText)
        .filter(OriginalText.quoteCount == 0, OriginalText.status == 1)
        .count()
    )

    # 繁体字识别需要内存扫描，分批读取避免爆内存
    quotes_with_traditional = 0
    cursor = 0
    while True:
        batch = (
            db.query(Quote.id, Quote.content)
            .filter(Quote.id > cursor)
            .order_by(Quote.id.asc())
            .limit(1000)
            .all()
        )
        if not batch:
            break
        for _, content in batch:
            if contains_traditional_chinese(content):
                quotes_with_traditional += 1
        cursor = batch[-1][0]
        if len(batch) < 1000:
            break

    original_texts_with_traditional = 0
    cursor = 0
    while True:
        batch = (
            db.query(OriginalText.id, OriginalText.content)
            .filter(OriginalText.id > cursor)
            .order_by(OriginalText.id.asc())
            .limit(200)
            .all()
        )
        if not batch:
            break
        for _, content in batch:
            if contains_traditional_chinese(content):
                original_texts_with_traditional += 1
        cursor = batch[-1][0]
        if len(batch) < 200:
            break

    return {
        "quotesWithoutPinyin": quotes_without_pinyin,
        "originalTextsWithoutPinyin": original_texts_without_pinyin,
        "originalTextsWithoutQuotes": original_texts_without_quotes,
        "quotesWithTraditional": quotes_with_traditional,
        "originalTextsWithTraditional": original_texts_with_traditional,
    }


def one_click_pinyin_all(db: Session, config_id: int | None = None, limit: int | None = None) -> dict:
    q = (
        db.query(Quote.id)
        .filter(or_(Quote.pinyinData.is_(None), Quote.pinyinData == ""))
        .order_by(Quote.id.asc())
    )
    if limit:
        q = q.limit(limit)
    quote_ids = [r[0] for r in q.all()]

    q = (
        db.query(OriginalText.id)
        .filter(or_(OriginalText.pinyinData.is_(None), OriginalText.pinyinData == ""))
        .order_by(OriginalText.id.asc())
    )
    if limit:
        q = q.limit(limit)
    original_text_ids = [r[0] for r in q.all()]

    quote_result = (
        generate_pinyin_for_quotes_batch(db, quote_ids, config_id)
        if quote_ids
        else {"total": 0, "success": 0, "failed": 0, "errors": []}
    )
    original_result = (
        generate_pinyin_for_original_texts_batch(db, original_text_ids, config_id)
        if original_text_ids
        else {"total": 0, "success": 0, "failed": 0, "errors": []}
    )

    return {"quotes": quote_result, "originalTexts": original_result}


def one_click_extract_all(db: Session, config_id: int, limit: int | None = None) -> dict:
    q = (
        db.query(OriginalText.id)
        .filter(OriginalText.quoteCount == 0, OriginalText.status == 1)
        .order_by(OriginalText.id.asc())
    )
    if limit:
        q = q.limit(limit)
    original_text_ids = [r[0] for r in q.all()]

    if not original_text_ids:
        return {"total": 0, "success": 0, "failed": 0, "taskId": None, "skipped": True}

    # extract_from_batch 会创建异步任务并返回，串行处理在 _run_batch_extract 中执行
    task = extract_from_batch(db, config_id, original_text_ids)
    return {"total": len(original_text_ids), "taskId": task["id"], "enqueued": True}


def one_click_simplify_all_local(db: Session, limit: int | None = None) -> dict:
    """一键繁转简（本地纯映射，不需要 AI，极快），仅处理 content 中含繁体字的条目"""
    quote_success = 0
    quote_failed = 0
    quote_errors = []

    cursor = 0
    quote_scanned = 0
    while True:
        if limit is not None and quote_scanned >= limit:
            break
        batch = (
            db.query(Quote.id, Quote.content)
            .filter(Quote.id > cursor)
            .order_by(Quote.id.asc())
            .limit(500)
            .all()
        )
        if not batch:
            break
        for qid, content in batch:
            if limit is not None and quote_scanned >= limit:
                break
            quote_scanned += 1
            if not contains_traditional_chinese(content):
                continue
            try:
                simplified = trad_to_simpl(content)
                if simplified != content:
                    quote = db.query(Quote).filter(Quote.id == qid).first()
                    quote.simplifiedContent = simplified
                    db.commit()
                quote_success += 1
            except Exception as e:
                quote_failed += 1
                if len(quote_errors) < 10:
                    quote_errors.append(f"金句 {qid}: {e}")
        cursor = batch[-1][0]
        if len(batch) < 500:
            break

    ot_success = 0
    ot_failed = 0
    ot_errors = []

    cursor = 0
    ot_scanned = 0
    while True:
        if limit is not None and ot_scanned >= limit:
            break
        batch = (
            db.query(OriginalText.id, OriginalText.content)
            .filter(OriginalText.id > cursor)
            .order_by(OriginalText.id.asc())
            .limit(100)
            .all()
        )
        if not batch:
            break
        for oid, content in batch:
            if limit is not None and ot_scanned >= limit:
                break
            ot_scanned += 1
            if not contains_traditional_chinese(content):
                continue
            try:
                simplified = trad_to_simpl(content)
                if simplified != content:
                    original = db.query(OriginalText).filter(OriginalText.id == oid).first()
                    original.simplifiedContent = simplified
                    db.commit()
                ot_success += 1
            except Exception as e:
                ot_failed += 1
                if len(ot_errors) < 10:
                    ot_errors.append(f"原文 {oid}: {e}")
        cursor = batch[-1][0]
        if len(batch) < 100:
            break

    summary = {
        "quotes": {"total": quote_success + quote_failed, "success": quote_success, "failed": quote_failed, "errors": quote_errors},
        "originalTexts": {"total": ot_success + ot_failed, "success": ot_success, "failed": ot_failed, "errors": ot_errors},
        "method": "local",
    }
    logger.info(f"[OneClick Simplify] quotes={quote_success}/{quote_failed}  originalTexts={ot_success}/{ot_failed}")
    return summary


# ====== AI 自动分类 ======


def _get_category_list_text(db: Session) -> str:
    """获取所有启用的分类，格式化为 AI 提示词中的列表文本"""
    categories = (
        db.query(Category)
        .filter(Category.status == 1)
        .order_by(Category.type.asc(), Category.sort.asc(), Category.id.asc())
        .all()
    )

    name_map = {c.id: c.name for c in categories}

    lines = []
    for c in categories:
        parent_name = name_map.get(c.parentId, "") if c.parentId else ""
        line = f"{c.id} | {c.name} | {c.type}"
        if parent_name:
            line += f" | {parent_name}"
        lines.append(line)
    return "\n".join(lines)


def _parse_category_ids(raw: str) -> list:
    """解析 AI 返回的分类 ID 数组"""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\[[\s\S]*\]", cleaned)
    if match:
        cleaned = match.group(0)
    try:
        arr = json.loads(cleaned)
        if not isinstance(arr, list):
            return []
        result = []
        for v in arr:
            if isinstance(v, bool):
                continue
            try:
                n = float(v)
            except (TypeError, ValueError):
                continue
            if n == n and n > 0:  # 过滤 NaN 与非正数
                result.append(int(n))
        return result
    except Exception:
        logger.error(f"[AI Classify] 解析分类ID失败，原始返回: {raw[:200]}")
        return []


def classify_quote(db: Session, quote_id: int, config_id: int | None = None) -> dict:
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise BusinessError(404, "金句不存在", 404)

    config = _get_config(db, config_id)
    client = _build_client(config)
    category_list_text = _get_category_list_text(db)
    template = config.classifyPromptTemplate or DEFAULT_CLASSIFY_PROMPT
    prompt = template.replace("{categories}", category_list_text).replace("{content}", quote.content)

    raw = client.chat([
        {"role": "system", "content": "你是一个专业的内容分类助手，擅长分析文本并选择最合适的分类。"},
        {"role": "user", "content": prompt},
    ])

    category_ids = _parse_category_ids(raw)
    if not category_ids:
        raise BusinessError(500, "AI 返回分类解析失败", 500)

    # 先删除旧关联，再写入新关联
    db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).delete(synchronize_session=False)
    for category_id in category_ids:
        db.add(QuoteCategory(quoteId=quote_id, categoryId=category_id))
    db.commit()

    logger.info(f"[AI Classify] quote={quote_id} categories={json.dumps(category_ids)}")
    return {"id": quote_id, "categoryIds": category_ids}


def classify_quotes_batch(db: Session, quote_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    category_list_text = _get_category_list_text(db)
    template = config.classifyPromptTemplate or DEFAULT_CLASSIFY_PROMPT

    success = 0
    failed = 0
    errors = []

    for quote_id in quote_ids:
        try:
            quote = db.query(Quote).filter(Quote.id == quote_id).first()
            if not quote:
                failed += 1
                errors.append(f"金句 {quote_id} 不存在")
                continue

            prompt = template.replace("{categories}", category_list_text).replace("{content}", quote.content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的内容分类助手。"},
                {"role": "user", "content": prompt},
            ])

            category_ids = _parse_category_ids(raw)
            if not category_ids:
                failed += 1
                errors.append(f"金句 {quote_id} 分类解析失败")
                continue

            db.query(QuoteCategory).filter(QuoteCategory.quoteId == quote_id).delete(synchronize_session=False)
            for category_id in category_ids:
                db.add(QuoteCategory(quoteId=quote_id, categoryId=category_id))
            db.commit()
            success += 1
            logger.info(f"[AI Classify] progress {success + failed}/{len(quote_ids)}")
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"金句 {quote_id}: {err}")

    logger.info(f"[AI Classify Batch] quotes total={len(quote_ids)} success={success} failed={failed}")
    return {"total": len(quote_ids), "success": success, "failed": failed, "errors": errors[:10]}


def classify_original_text(db: Session, original_text_id: int, config_id: int | None = None) -> dict:
    original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
    if not original:
        raise BusinessError(404, "原文不存在", 404)

    config = _get_config(db, config_id)
    client = _build_client(config)
    category_list_text = _get_category_list_text(db)
    template = config.classifyPromptTemplate or DEFAULT_CLASSIFY_PROMPT
    # 原文可能很长，截取前 2000 字
    content = original.content[:2000]
    prompt = template.replace("{categories}", category_list_text).replace("{content}", content)

    raw = client.chat([
        {"role": "system", "content": "你是一个专业的内容分类助手，擅长分析文本并选择最合适的分类。"},
        {"role": "user", "content": prompt},
    ])

    category_ids = _parse_category_ids(raw)
    if not category_ids:
        raise BusinessError(500, "AI 返回分类解析失败", 500)

    db.query(OriginalTextCategory).filter(OriginalTextCategory.originalTextId == original_text_id).delete(synchronize_session=False)
    for category_id in category_ids:
        db.add(OriginalTextCategory(originalTextId=original_text_id, categoryId=category_id))
    db.commit()

    logger.info(f"[AI Classify] originalText={original_text_id} categories={json.dumps(category_ids)}")
    return {"id": original_text_id, "categoryIds": category_ids}


def classify_original_texts_batch(db: Session, original_text_ids: list, config_id: int | None = None) -> dict:
    config = _get_config(db, config_id)
    client = _build_client(config)
    category_list_text = _get_category_list_text(db)
    template = config.classifyPromptTemplate or DEFAULT_CLASSIFY_PROMPT

    success = 0
    failed = 0
    errors = []

    for original_text_id in original_text_ids:
        try:
            original = db.query(OriginalText).filter(OriginalText.id == original_text_id).first()
            if not original:
                failed += 1
                errors.append(f"原文 {original_text_id} 不存在")
                continue

            content = original.content[:2000]
            prompt = template.replace("{categories}", category_list_text).replace("{content}", content)
            raw = client.chat([
                {"role": "system", "content": "你是一个专业的内容分类助手。"},
                {"role": "user", "content": prompt},
            ])

            category_ids = _parse_category_ids(raw)
            if not category_ids:
                failed += 1
                errors.append(f"原文 {original_text_id} 分类解析失败")
                continue

            db.query(OriginalTextCategory).filter(OriginalTextCategory.originalTextId == original_text_id).delete(synchronize_session=False)
            for category_id in category_ids:
                db.add(OriginalTextCategory(originalTextId=original_text_id, categoryId=category_id))
            db.commit()
            success += 1
            logger.info(f"[AI Classify] progress {success + failed}/{len(original_text_ids)}")
        except Exception as err:
            db.rollback()
            failed += 1
            errors.append(f"原文 {original_text_id}: {err}")

    logger.info(f"[AI Classify Batch] originalTexts total={len(original_text_ids)} success={success} failed={failed}")
    return {"total": len(original_text_ids), "success": success, "failed": failed, "errors": errors[:10]}


def one_click_classify_all(db: Session, config_id: int | None = None, limit: int | None = None) -> dict:
    # 查找没有任何分类关联的金句
    qcat_exists = (
        db.query(QuoteCategory.quoteId).filter(QuoteCategory.quoteId == Quote.id).exists()
    )
    q = db.query(Quote.id).filter(~qcat_exists).order_by(Quote.id.asc())
    if limit:
        q = q.limit(limit)
    unclassified_quote_ids = [r[0] for r in q.all()]

    # 查找没有任何分类关联的原文
    otcat_exists = (
        db.query(OriginalTextCategory.originalTextId)
        .filter(OriginalTextCategory.originalTextId == OriginalText.id)
        .exists()
    )
    q = db.query(OriginalText.id).filter(~otcat_exists).order_by(OriginalText.id.asc())
    if limit:
        q = q.limit(limit)
    unclassified_original_text_ids = [r[0] for r in q.all()]

    quote_result = (
        classify_quotes_batch(db, unclassified_quote_ids, config_id)
        if unclassified_quote_ids
        else {"total": 0, "success": 0, "failed": 0, "errors": []}
    )
    original_result = (
        classify_original_texts_batch(db, unclassified_original_text_ids, config_id)
        if unclassified_original_text_ids
        else {"total": 0, "success": 0, "failed": 0, "errors": []}
    )

    return {"quotes": quote_result, "originalTexts": original_result}


def get_one_click_classify_stats(db: Session) -> dict:
    qcat_exists = (
        db.query(QuoteCategory.quoteId).filter(QuoteCategory.quoteId == Quote.id).exists()
    )
    quotes_unclassified = db.query(Quote).filter(~qcat_exists).count()

    otcat_exists = (
        db.query(OriginalTextCategory.originalTextId)
        .filter(OriginalTextCategory.originalTextId == OriginalText.id)
        .exists()
    )
    original_texts_unclassified = db.query(OriginalText).filter(~otcat_exists).count()

    return {"quotesUnclassified": quotes_unclassified, "originalTextsUnclassified": original_texts_unclassified}
