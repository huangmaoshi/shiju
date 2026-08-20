"""密码哈希与验证（PBKDF2-SHA512）

对应 TypeScript 版 server/src/utils/password.ts
存储格式：salt:derivedKey
"""
import hashlib
import hmac
import secrets

SALT_LEN = 16
KEY_LEN = 64
ITERATIONS = 120000
DIGEST = "sha512"


def hash_password(password: str) -> str:
    salt = secrets.token_hex(SALT_LEN)
    derived = hashlib.pbkdf2_hmac(DIGEST, password.encode("utf-8"), salt.encode("utf-8"), ITERATIONS, KEY_LEN)
    return f"{salt}:{derived.hex()}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split(":")
    if len(parts) != 2:
        return False
    salt, hex_digest = parts
    if not salt or not hex_digest:
        return False
    derived = hashlib.pbkdf2_hmac(DIGEST, password.encode("utf-8"), salt.encode("utf-8"), ITERATIONS, KEY_LEN)
    return hmac.compare_digest(bytes.fromhex(hex_digest), derived)
