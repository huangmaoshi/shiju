"""去重引擎

对应 TypeScript 版 crawler/src/engine/deduper.ts。
直接复用 server-py 的 app/utils/dedup.py（MD5 + SimHash），
这里做一层同名包装，保持与 TS 版一致的对外接口。
"""
import os
import sys

_SERVER_PY = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "server-py"))
if _SERVER_PY not in sys.path:
    sys.path.insert(0, _SERVER_PY)

from app.utils.dedup import dedup  # noqa: E402

from ..config import config  # noqa: E402

SIMHASH_BITS = dedup["SIMHASH_BITS"]


def compute_sim_hash(text: str) -> str:
    """对应 TS computeSimHash"""
    if not text:
        return ""
    return dedup["computeSimHash"](text)


def compute_fingerprint(text: str) -> str:
    """对应 TS computeFingerprint（SimHash 指纹）"""
    if not text:
        return ""
    return dedup["computeSimHash"](text)


def hamming_distance(hash1: str, hash2: str) -> int:
    """对应 TS hammingDistance（长度不一致时抛异常）"""
    if len(hash1) != len(hash2):
        raise ValueError("Hash lengths must match")
    return sum(1 for a, b in zip(hash1, hash2) if a != b)


def is_duplicate(new_hash: str, existing_hashes: list, threshold: int = None) -> bool:
    """对应 TS isDuplicate"""
    if threshold is None:
        threshold = config.simhash_threshold
    for existing in existing_hashes:
        if not existing:
            continue
        if hamming_distance(new_hash, existing) <= threshold:
            return True
    return False


# 保持 camelCase 别名，方便与 TS 对照
computeSimHash = compute_sim_hash
computeFingerprint = compute_fingerprint
hammingDistance = hamming_distance
isDuplicate = is_duplicate
