import * as cheerio from "cheerio";
import { load } from "../engine/parser";
import { fetchWithDelay } from "../engine/http_client";
import { computeSimHash, computeFingerprint } from "../engine/deduper";
import BaseProvider, { RawQuote, EnrichedQuote } from "./base_provider";
import logger from "../logger";

const CATEGORIES: Record<string, { path: string; type: string }> = {
  mingju: { path: "/mingju/", type: "古诗文名句" },
  shige: { path: "/shige/", type: "古诗" },
  ci: { path: "/ci/", type: "宋词" },
  wenyanwen: { path: "/wenyanwen/", type: "文言文" },
};

class GuwenwenProvider extends BaseProvider {
  readonly code = "guwenwen";
  readonly name = "古诗文网";
  readonly baseUrl = "https://www.gushiwen.cn";

  async fetchList(page: number): Promise<RawQuote[]> {
    const items: RawQuote[] = [];

    for (const [categoryKey, meta] of Object.entries(CATEGORIES)) {
      const url = `${this.baseUrl}${meta.path}default.aspx?page=${page}`;
      logger.info(`[${this.code}] 抓取列表: ${url}`);

      try {
        const resp = await fetchWithDelay(url);
        const $ = load(resp.body);

        $(".sons .cont, .typecont .cont").each((_, el) => {
          const $el = $(el);
          const contentText =
            $el.find(".yizhu").text().trim() || $el.find("p").first().text().trim();
          const title = $el.find("b").first().text().trim();
          const authorSrc = $el.find(".source").text().trim().replace(/[〔〕]/g, "");
          const href = $el.find("a").first().attr("href") || "";

          if (contentText && contentText.length > 5) {
            items.push({
              title: title || undefined,
              content: contentText.replace(/^(译|注)/, "").trim(),
              author: authorSrc || undefined,
              source: title || meta.type,
              url: href.startsWith("http") ? href : `${this.baseUrl}${href}`,
              categoryType: meta.type,
              tags: [categoryKey, meta.type],
            });
          }
        });
      } catch (err: any) {
        logger.error(`[${this.code}] 列表抓取失败 ${url}: ${err.message}`);
      }
    }

    return items;
  }

  async fetchDetail(raw: RawQuote): Promise<EnrichedQuote> {
    let detailContent = raw.content;

    try {
      if (raw.url && raw.url.startsWith("http")) {
        const resp = await fetchWithDelay(raw.url);
        const $ = load(resp.body);
        const fullText =
          $(".contyishu .cont").text().trim() ||
          $(".wencont").text().trim();
        if (fullText && fullText.length > raw.content.length) {
          detailContent = fullText;
        }
      }
    } catch (err: any) {
      logger.warn(`[${this.code}] 详情抓取失败 ${raw.url}: ${err.message}`);
    }

    const simHash = computeSimHash(detailContent);
    const fingerprint = computeFingerprint(detailContent);

    return {
      ...raw,
      content: detailContent,
      simHash,
      fingerprint,
      wordCount: detailContent.length,
    };
  }
}

export default GuwenwenProvider;
