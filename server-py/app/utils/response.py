"""统一 API 响应格式工具

对应 TypeScript 版 server/src/utils/response.ts
所有接口返回 { code, message, data } 结构：
  code=0 成功，非 0 为业务错误码
"""
import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi.responses import Response


def _json_default(obj: Any):
    if isinstance(obj, (datetime, date)):
        # 与 JS JSON.stringify(Date) 保持一致：ISO 8601 格式
        return obj.isoformat().replace(" ", "T")
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def _json_response(payload: dict, status: int = 200) -> Response:
    body = json.dumps(payload, default=_json_default, ensure_ascii=False)
    return Response(content=body, status_code=status, media_type="application/json")


def ok(data: Any = None, message: str = "ok") -> Response:
    """成功响应：HTTP 200，code=0"""
    return _json_response({"code": 0, "message": message, "data": data})


def error(code: int, message: str, status: int = 400) -> Response:
    """错误响应：data=null"""
    return _json_response({"code": code, "message": message, "data": None}, status=status)


def error_403(code: int = 403, message: str = "Forbidden") -> Response:
    return error(code, message, 403)


def error_404(code: int = 404, message: str = "Not Found") -> Response:
    return error(code, message, 404)


def error_500(code: int = 500, message: str = "Internal server error") -> Response:
    return error(code, message, 500)
