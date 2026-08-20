"""OpenAI 兼容协议 AI 客户端

对应 TypeScript 版 server/src/utils/ai_client.ts
支持超时、重试（仅 5xx / 网络错误重试，4xx 直接抛出）。
"""
import time
from typing import List, Optional

import httpx

from .logger import logger


class AiClientError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class AiClient:
    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        timeout_ms: int = 60000,
        retry_count: int = 2,
        retry_delay_ms: int = 1000,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.timeout_ms = timeout_ms
        self.retry_count = retry_count
        self.retry_delay_ms = retry_delay_ms

    def _do_request(self, messages: List[dict], use_optional_params: bool = True) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = {"model": self.model, "messages": messages}
        if use_optional_params:
            payload["temperature"] = self.temperature
            payload["max_tokens"] = self.max_tokens
        logger.info(
            f"[AiClient] POST {url} model={self.model} "
            f"max_tokens={self.max_tokens if use_optional_params else 'omitted'} "
            f"temperature={self.temperature if use_optional_params else 'omitted'} "
            f"messages_len={len(messages)}"
        )
        try:
            resp = httpx.post(url, headers=headers, json=payload, timeout=self.timeout_ms / 1000.0)
        except httpx.TimeoutException:
            raise AiClientError(504, f"AI 请求超时 ({self.timeout_ms}ms)")
        except httpx.HTTPError as e:
            logger.error(f"[AiClient] network error: {e}")
            raise AiClientError(502, f"AI 网络错误: {e}")

        if resp.status_code >= 400:
            detail = ""
            try:
                data = resp.json()
                err = data.get("error") or {}
                detail = err.get("message") or data.get("message") or str(data)
            except Exception:
                detail = resp.text
            logger.error(f"[AiClient] API error {resp.status_code}: {detail}")
            raise AiClientError(resp.status_code, f"AI API 错误 ({resp.status_code}): {detail or resp.reason_phrase}")

        try:
            data = resp.json()
            choices = data.get("choices") or []
            content = choices[0].get("message", {}).get("content") if choices else None
            if not isinstance(content, str):
                raise AiClientError(502, "AI API 返回格式异常")
            return content.strip()
        except ValueError:
            raise AiClientError(502, "AI API 返回格式异常")

    def chat(self, messages: List[dict]) -> str:
        """
        带自动降级的聊天请求：
        1. 首次带全部参数（temperature + max_tokens）
        2. 400 错误时自动去掉可选参数重试（兼容 Ollama 等本地模型）
        3. 5xx / 网络错误按原逻辑重试
        """
        last_error: Optional[Exception] = None

        # 第一阶段：带可选参数请求
        for attempt in range(self.retry_count + 1):
            if attempt > 0:
                delay = self.retry_delay_ms * attempt
                logger.info(f"[AiClient] 第 {attempt + 1} 次重试（带参数），等待 {delay}ms")
                time.sleep(delay / 1000.0)
            try:
                return self._do_request(messages, use_optional_params=True)
            except Exception as err:
                last_error = err
                status = err.status if isinstance(err, AiClientError) else 0
                # 400 错误：参数不兼容，进入降级
                if status == 400:
                    logger.warning(f"[AiClient] 400 错误，尝试去掉可选参数重试: {err}")
                    break
                # 其他 4xx 直接抛出
                if 0 < status < 500:
                    raise err
                # 5xx / 网络错误：按原逻辑重试
                logger.warning(f"[AiClient] 请求失败 (attempt {attempt + 1}): {err}")

        # 第二阶段：降级，去掉可选参数
        try:
            logger.info("[AiClient] 使用精简参数（不含 temperature/max_tokens）重试")
            return self._do_request(messages, use_optional_params=False)
        except AiClientError as err:
            if err.status == 400:
                logger.error(f"[AiClient] 降级后仍然 400: {err.message}")
            raise err

        raise last_error or AiClientError(500, "未知错误")
