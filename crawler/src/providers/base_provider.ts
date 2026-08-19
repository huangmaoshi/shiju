export interface RawQuote {
  title?: string;
  content: string;
  author?: string;
  source?: string;
  url: string;
  tags?: string[];
  categoryType?: string;
}

export interface EnrichedQuote extends RawQuote {
  simHash: string;
  fingerprint: string;
  wordCount: number;
  summary?: string;
}

export interface ProviderMeta {
  code: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
}

export abstract class BaseProvider {
  abstract readonly code: string;
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  abstract fetchList(page: number): Promise<RawQuote[]>;
  abstract fetchDetail(raw: RawQuote): Promise<EnrichedQuote>;

  get meta(): ProviderMeta {
    return {
      code: this.code,
      name: this.name,
      baseUrl: this.baseUrl,
      enabled: true,
    };
  }

  async *crawlPages(startPage: number = 1, maxPages: number = 10): AsyncGenerator<RawQuote> {
    for (let page = startPage; page <= maxPages; page++) {
      let items: RawQuote[] = [];
      try {
        items = await this.fetchList(page);
      } catch (err: any) {
        console.error(`[${this.code}] 第 ${page} 页采集失败: ${err.message}`);
        break;
      }

      if (items.length === 0) break;

      for (const item of items) {
        yield item;
      }
    }
  }
}

export default BaseProvider;
