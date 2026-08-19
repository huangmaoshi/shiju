import { load } from "../engine/parser";
import { fetchWithDelay } from "../engine/http_client";
import { computeSimHash, computeFingerprint } from "../engine/deduper";
import BaseProvider, { RawQuote, EnrichedQuote } from "./base_provider";
import logger from "../logger";

const CATEGORIES: Record<string, string> = {
  life: "/shenghuo/",
  love: "/aiqing/",
  work: "/zhichang/",
  study: "/xuexi/",
  friendship: "/youqing/",
  family: "/qinqing/",
  success: "/chenggong/",
  time: "/shijian/",
};

class MingyanProvider extends BaseProvider {
  readonly code = "mingyan";
  readonly name = "名言通";
  readonly baseUrl = "https://www.mingyantong.com";

  async fetchList(page: number): Promise<RawQuote[]> {
    const items: RawQuote[] = [];

    for (const [categoryKey, path] of Object.entries(CATEGORIES)) {
      const url = `${this.baseUrl}${path}list-${page}.html`;
      logger.info(`[${this.code}] 抓取列表: ${url}`);

      try {
        const resp = await fetchWithDelay(url);
        const $ = load(resp.body);

        $(".quote-item, .list-item, .mingyu-list li").each((_, el) => {
          const $el = $(el);
          const content =
            $el.find(".quote-content, .content, p").first().text().trim();
          const author =
            $el.find(".quote-author, .author, .source").first().text().trim() || undefined;
          const href = $el.find("a").first().attr("href") || "";

          if (content && content.length > 5) {
            items.push({
              content,
              author,
              source: this.name,
              url: href.startsWith("http") ? href : `${this.baseUrl}${href}`,
              categoryType: categoryKey,
              tags: [categoryKey],
            });
          }
        });

        if (items.length === 0) {
          $("article, .quote, .item").each((_, el) => {
            const $el = $(el);
            const content = $el.text().trim();
            if (content && content.length > 10 && content.length < 500) {
              items.push({
                content,
                source: this.name,
                url: `${this.baseUrl}${path}`,
                categoryType: categoryKey,
                tags: [categoryKey],
              });
            }
          });
        }
      } catch (err: any) {
        logger.error(`[${this.code}] 列表抓取失败 ${url}: ${err.message}`);
      }
    }

    return items;
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

export default MingyanProvider;
