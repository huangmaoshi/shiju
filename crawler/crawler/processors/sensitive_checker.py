"""敏感词检查

对应 TypeScript 版 crawler/src/processors/sensitive_checker.ts。
敏感词列表与逻辑照搬 TS 版。
"""
import re

SENSITIVE_WORDS = [
    "暴力", "血腥", "杀戮", "屠杀", "枪毙", "枪杀",
    "色情", "淫秽", "猥亵", "性骚扰",
    "毒品", "吸毒", "贩毒", "大麻",
    "赌博", "赌场", "博彩",
    "诈骗", "骗局", "欺诈",
    "自杀", "自残", "跳楼", "割腕",
    "邪教", "传销",
    "反动", "颠覆",
    "枪支", "弹药", "爆炸",
    "绑架", "劫持",
    "仇恨", "种族歧视",
    "色情网", "黄色网",
    "代孕", "买卖器官",
    "黑市", "洗钱",
    "恐怖主义", "极端主义",
    "仇恨言论", "人身攻击",
]


def check_sensitive(text: str) -> dict:
    """对应 TS checkSensitive，返回 {hasSensitive, matchedWords, riskLevel}"""
    if not text:
        return {"hasSensitive": False, "matchedWords": [], "riskLevel": "none"}

    lowered = text.lower()
    matched = []

    for word in SENSITIVE_WORDS:
        if word.lower() in lowered:
            matched.append(word)

    risk_level = "none"
    if len(matched) == 1:
        risk_level = "low"
    elif len(matched) <= 3:
        risk_level = "medium"
    elif len(matched) > 3:
        risk_level = "high"

    return {
        "hasSensitive": len(matched) > 0,
        "matchedWords": matched,
        "riskLevel": risk_level,
    }


def filter_sensitive(text: str, replace_char: str = "*") -> str:
    """对应 TS filterSensitive"""
    if not text:
        return ""
    result = text
    for word in SENSITIVE_WORDS:
        regex = re.compile(re.escape(word), re.IGNORECASE)
        result = regex.sub(replace_char * len(word), result)
    return result


def get_sensitive_word_list() -> list:
    """对应 TS getSensitiveWordList"""
    return list(SENSITIVE_WORDS)
