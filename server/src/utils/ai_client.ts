import logger from './logger';

export interface AiClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AiClientError';
    this.status = status;
    Object.setPrototypeOf(this, AiClientError.prototype);
  }
}

export class AiClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private timeoutMs: number;
  private retryCount: number;
  private retryDelayMs: number;

  constructor(opts: AiClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.model = opts.model;
    this.temperature = opts.temperature ?? 0.7;
    this.maxTokens = opts.maxTokens ?? 2048;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.retryCount = opts.retryCount ?? 2;
    this.retryDelayMs = opts.retryDelayMs ?? 1000;
  }

  private async _doRequest(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let detail = '';
        try {
          const data = (await res.json()) as Record<string, unknown>;
          const err = (data.error as Record<string, unknown> | undefined) ?? {};
          detail = (err.message as string) || (data.message as string) || JSON.stringify(data);
        } catch {
          detail = await res.text();
        }
        logger.error(`[AiClient] API error ${res.status}: ${detail}`);
        throw new AiClientError(res.status, `AI API 错误 (${res.status}): ${detail || res.statusText}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      const content = choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new AiClientError(502, 'AI API 返回格式异常');
      }
      return content.trim();
    } catch (err) {
      if (err instanceof AiClientError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new AiClientError(504, `AI 请求超时 (${this.timeoutMs}ms)`);
      }
      logger.error(`[AiClient] network error: ${(err as Error).message}`);
      throw new AiClientError(502, `AI 网络错误: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryCount; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelayMs * attempt;
        logger.info(`[AiClient] 第 ${attempt + 1}/${this.retryCount + 1} 次重试，等待 ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      try {
        return await this._doRequest(messages);
      } catch (err) {
        lastError = err as Error;
        const status = err instanceof AiClientError ? err.status : 0;

        // 仅对 5xx 或网络错误进行重试，4xx 错误直接抛出
        if (status > 0 && status < 500) {
          throw err;
        }

        logger.warn(`[AiClient] 请求失败 (attempt ${attempt + 1}): ${(err as Error).message}`);
      }
    }

    throw lastError || new AiClientError(500, '未知错误');
  }
}

export default AiClient;
