import got from "got";
import { computeSimHash, computeFingerprint } from "../engine/deduper";
import BaseProvider, { RawQuote, EnrichedQuote } from "./base_provider";
import logger from "../logger";

interface JsonRecord {
  content?: string;
  quote?: string;
  text?: string;
  author?: string;
  "作者"?: string;
  title?: string;
  source?: string;
  tags?: string[];
  categoryType?: string;
  [key: string]: unknown;
}

function extractContent(item: JsonRecord): string | undefined {
  for (const key of ["content", "quote", "text"]) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function extractAuthor(item: JsonRecord): string | undefined {
  if (typeof item.author === "string" && item.author.trim()) return item.author.trim();
  if (typeof item["作者"] === "string" && item["作者"].trim()) return item["作者"].trim();
  return undefined;
}

function extractTags(item: JsonRecord): string[] | undefined {
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    return item.tags.filter((t) => typeof t === "string") as string[];
  }
  if (typeof item.categoryType === "string" && item.categoryType.trim()) {
    return [item.categoryType.trim()];
  }
  return undefined;
}

class GithubDatasetProvider extends BaseProvider {
  readonly code = "github_dataset";
  readonly name = "GitHub开源数据集";
  readonly baseUrl = "https://raw.githubusercontent.com";

  remark?: string;

  private buildUrl(): string {
    return `${this.baseUrl}/${this.remark}`;
  }

  private parseJson(raw: unknown): JsonRecord[] {
    if (Array.isArray(raw)) return raw as JsonRecord[];
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data as JsonRecord[];
      if (Array.isArray(obj.items)) return obj.items as JsonRecord[];
    }
    return [];
  }

  async fetchList(_page: number): Promise<RawQuote[]> {
    if (!this.remark) {
      logger.warn(`[${this.code}] remark 未配置，跳过采集`);
      return [];
    }

    const url = this.buildUrl();
    logger.info(`[${this.code}] 下载数据集: ${url}`);

    try {
      const resp = await got.get(url, {
        responseType: "json",
        timeout: { request: 30000 },
      });

      const records = this.parseJson(resp.body);
      logger.info(`[${this.code}] 解析到 ${records.length} 条记录`);

      const result: RawQuote[] = [];
      for (const item of records) {
        const content = extractContent(item);
        if (!content || content.length < 2) continue;

        const raw: RawQuote = {
          title: typeof item.title === "string" ? item.title : undefined,
          content,
          author: extractAuthor(item),
          source: typeof item.source === "string" ? item.source : undefined,
          url,
          tags: extractTags(item),
          categoryType:
            typeof item.categoryType === "string" ? item.categoryType : undefined,
        };

        result.push(raw);
      }

      return result;
    } catch (err: any) {
      logger.error(`[${this.code}] 下载失败 ${url}: ${err.message}`);
      return [];
    }
  }

  async fetchDetail(raw: RawQuote): Promise<EnrichedQuote> {
    const simHash = computeSimHash(raw.content);
    const fingerprint = computeFingerprint(raw.content);

    return {
      ...raw,
      simHash,
      fingerprint,
      wordCount: raw.content.length,
    };
  }
}

export default GithubDatasetProvider;
