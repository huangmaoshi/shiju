import got, { Got, OptionsOfTextResponseBody } from "got";
import config from "../config";
import logger from "../logger";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min: number = config.delayMin, max: number = config.delayMax): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const client: Got = got.extend({
  timeout: {
    request: config.timeout,
  },
  retry: {
    limit: config.maxRetry,
    methods: ["GET", "HEAD"],
    statusCodes: [408, 429, 500, 502, 503, 504],
    backoffLimit: 5000,
  },
  headers: {
    "User-Agent": randomUA(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  },
  followRedirect: true,
  https: {
    rejectUnauthorized: false,
  },
});

export interface HttpResponse {
  url: string;
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

export async function fetch(url: string, options?: OptionsOfTextResponseBody): Promise<HttpResponse> {
  logger.debug(`HTTP GET ${url}`);

  try {
    const response = await client.get(url, {
      ...options,
      responseType: "text",
    });

    return {
      url: response.url,
      statusCode: response.statusCode,
      body: response.body,
      headers: response.headers as Record<string, string | string[] | undefined>,
    };
  } catch (err: any) {
    logger.error(`HTTP 请求失败 ${url}: ${err.message}`);
    throw err;
  }
}

export async function fetchWithDelay(
  url: string,
  options?: OptionsOfTextResponseBody,
  delayMin?: number,
  delayMax?: number
): Promise<HttpResponse> {
  await randomDelay(delayMin, delayMax);
  return fetch(url, options);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { randomUA, randomDelay };
export default client;
