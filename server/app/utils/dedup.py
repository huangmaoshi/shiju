"""分级去重引擎（MD5 + SimHash）

对应 TypeScript 版 server/src/utils/dedup.ts
短文本（<100字）用 MD5 精确匹配；长文本额外做 SimHash 相似度检查。
"""
import hashlib
import re

SIMHASH_BITS = 64
SIMHASH_THRESHOLD_85_PERCENT = 10  # 64-bit, 10 bits different = 84.4% similarity
SHORT_TEXT_BOUNDARY = 100

_PUNCT_RE = re.compile(r"[\s，。！？、；：""''（）《》【】…—\u3000]")


def normalize(text: str) -> str:
    t = _PUNCT_RE.sub("", text)
    t = re.sub(r"\s+", "", t)
    return t.lower()


def md5(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def tokenize(text: str):
    cleaned = normalize(text)
    if not cleaned:
        return []
    tokens = []
    for i in range(len(cleaned) - 1):
        tokens.append(cleaned[i:i + 2])
    if not tokens and len(cleaned) > 0:
        tokens.append(cleaned)
    return tokens


def string_hash(s: str) -> int:
    """DJB hash 变体（与 TS 版一致：hash*33 ^ charCode，取绝对值）"""
    h = 5381
    for ch in s:
        h = (h * 33) ^ ord(ch)
    return abs(h)


def int_to_binary_string(num: int, bits: int) -> str:
    # 模拟 JS (num >>> 0).toString(2) 的 32 位无符号行为
    num = num & 0xFFFFFFFF
    s = bin(num)[2:]
    return s.rjust(bits, "0")[-bits:]


def compute_sim_hash(text: str) -> str:
    if not text:
        return ""
    tokens = tokenize(text)
    v = [0] * SIMHASH_BITS
    for token in tokens:
        h = string_hash(token)
        binary = int_to_binary_string(h, SIMHASH_BITS)
        for i in range(SIMHASH_BITS):
            if binary[i] == "1":
                v[i] += 1
            else:
                v[i] -= 1
    fp = "".join("1" if x >= 0 else "0" for x in v)
    return fp


def hamming_distance(a: str, b: str) -> int:
    if len(a) != len(b):
        return SIMHASH_BITS
    return sum(1 for x, y in zip(a, b) if x != y)


def similarity_percent(a: str, b: str) -> float:
    if not a or not b:
        return 0
    dist = hamming_distance(a, b)
    return ((SIMHASH_BITS - dist) / SIMHASH_BITS) * 100


def fingerprint(content: str):
    """返回 { contentMd5, simHash, normalized }"""
    normalized = normalize(content)
    return {
        "contentMd5": md5(normalized),
        "simHash": compute_sim_hash(content),
        "normalized": normalized,
    }


def is_duplicate(content: str, known_md5s: set, known_sim_hashes: list, threshold: int = SIMHASH_THRESHOLD_85_PERCENT, content_len: int | None = None):
    """判重，返回 (isDup, reason|None)"""
    length = content_len if content_len is not None else len(content)
    fp = fingerprint(content)

    if fp["contentMd5"] in known_md5s:
        return True, "md5"

    if length >= SHORT_TEXT_BOUNDARY:
        for existing in known_sim_hashes:
            if not existing:
                continue
            if hamming_distance(fp["simHash"], existing) <= threshold:
                return True, "simhash"

    return False, None


dedup = {
    "SIMHASH_BITS": SIMHASH_BITS,
    "SHORT_TEXT_BOUNDARY": SHORT_TEXT_BOUNDARY,
    "DEFAULT_SIMHASH_THRESHOLD": SIMHASH_THRESHOLD_85_PERCENT,
    "normalize": normalize,
    "md5": md5,
    "computeSimHash": compute_sim_hash,
    "hammingDistance": hamming_distance,
    "similarityPercent": similarity_percent,
    "fingerprint": fingerprint,
    "isDuplicate": is_duplicate,
}
