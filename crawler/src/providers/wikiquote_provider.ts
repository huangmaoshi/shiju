import { fetchWithDelay } from "../engine/http_client";
import { computeSimHash, computeFingerprint } from "../engine/deduper";
import BaseProvider, { RawQuote, EnrichedQuote } from "./base_provider";
import logger from "../logger";
import prisma from "../db";

interface WikiquoteRemark {
  offset?: string | number;
  lang?: string;
}

const API_PATH = "/w/api.php";
const DEFAULT_HOST = "zh.wikiquote.org";
const EN_HOST = "en.wikiquote.org";

class WikiquoteProvider extends BaseProvider {
  readonly code = "wikiquote";
  readonly name = "维基语录";
  readonly baseUrl = `https://${DEFAULT_HOST}`;

  private async getRemark(): Promise<WikiquoteRemark> {
    try {
      const source = await prisma.crawlSource.findUnique({
        where: { code: this.code },
        select: { remark: true },
      });
      if (source?.remark) {
        return JSON.parse(source.remark) as WikiquoteRemark;
      }
    } catch (err: any) {
      logger.warn(`[${this.code}] 读取 CrawlSource remark 失败: ${err.message}`);
    }
    return {};
  }

  private resolveHost(lang?: string): string {
    return lang === "en" ? EN_HOST : DEFAULT_HOST;
  }

  private buildApiUrl(host: string, query: Record<string, string | number>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      params.set(k, String(v));
    }
    return `https://${host}${API_PATH}?${params.toString()}`;
  }

  async fetchList(page: number): Promise<RawQuote[]> {
    const remark = await this.getRemark();
    const host = this.resolveHost(remark.lang);
    const initialOffset = remark.offset ?? "";

    const offset =
      typeof initialOffset === "number"
        ? String(initialOffset + (page - 1) * 20)
        : page === 1
          ? String(initialOffset)
          : initialOffset;

    const url = this.buildApiUrl(host, {
      action: "query",
      list: "allpages",
      aplimit: 20,
      apoffset: offset,
      apnamespace: 0,
      format: "json",
    });

    logger.info(`[${this.code}] 抓取列表: ${url}`);

    const items: RawQuote[] = [];

    try {
      const resp = await fetchWithDelay(url);
      const data = JSON.parse(resp.body);
      const pages: Array<{ title: string; pageid?: number }> =
        data?.query?.allpages ?? [];

      for (const p of pages) {
        const title = p.title;
        items.push({
          title,
          content: "",
          source: this.name,
          url: `https://${host}/wiki/${encodeURIComponent(title)}`,
          tags: [this.name, remark.lang || "zh"],
        });
      }
    } catch (err: any) {
      logger.error(`[${this.code}] 列表抓取失败: ${err.message}`);
    }

    return items;
  }

  async fetchDetail(raw: RawQuote): Promise<EnrichedQuote> {
    let content = raw.content || "";

    if (raw.title) {
      const remark = await this.getRemark();
      const host = this.resolveHost(remark.lang);

      const url = this.buildApiUrl(host, {
        action: "parse",
        page: raw.title,
        prop: "wikitext",
        format: "json",
      });

      try {
        const resp = await fetchWithDelay(url);
        const data = JSON.parse(resp.body);
        const wikitext: string = data?.parse?.wikitext?.["*"] ?? "";
        content = this.extractQuotes(wikitext);
      } catch (err: any) {
        logger.warn(`[${this.code}] 详情抓取失败 ${raw.title}: ${err.message}`);
      }
    }

    const simHash = computeSimHash(content);
    const fingerprint = computeFingerprint(content);

    return {
      ...raw,
      content,
      simHash,
      fingerprint,
      wordCount: content.length,
    };
  }

  private extractQuotes(wikitext: string): string {
    const lines = wikitext.split("\n");
    const quotes: string[] = [];
    let inBlockquote = false;
    let blockquoteBuf: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/<blockquote[\s>]/i.test(line) || /^\{\{quote/i.test(line) || /^\{\{quotation/i.test(line)) {
        inBlockquote = true;
        blockquoteBuf = [];
        const inner = line.replace(/^.*?<blockquote[^>]*>/i, "").replace(/^\{\{[a-zA-Z]+\|?/, "");
        if (inner && !/^<\/blockquote/.test(line)) {
          blockquoteBuf.push(inner);
        }
        continue;
      }

      if (inBlockquote) {
        if (/<\/blockquote/i.test(line) || (/^\}\}/.test(line) && !line.startsWith("{{"))) {
          const tail = line.replace(/<\/blockquote.*$/i, "").replace(/^\}\}/, "");
          if (tail) blockquoteBuf.push(tail);
          const cleaned = this.cleanWikiMarkup(blockquoteBuf.join(" "));
          if (cleaned && cleaned.length > 3) quotes.push(cleaned);
          inBlockquote = false;
          blockquoteBuf = [];
        } else {
          blockquoteBuf.push(line);
        }
        continue;
      }

      if (/^\*{1,4}\s/.test(line)) {
        const body = line.replace(/^\*{1,4}\s*/, "");
        const cleaned = this.cleanWikiMarkup(body);
        if (cleaned && cleaned.length > 5 && !this.isMetaLine(cleaned)) {
          quotes.push(cleaned);
        }
      }
    }

    if (quotes.length === 0) {
      const cleaned = this.cleanWikiMarkup(wikitext);
      const sentences = cleaned.split(/[。！？.!?\n]{1,}/);
      for (const s of sentences) {
        const trimmed = s.trim();
        if (trimmed.length > 10 && trimmed.length < 500 && !this.isMetaLine(trimmed)) {
          quotes.push(trimmed);
        }
      }
    }

    const unique = Array.from(new Set(quotes));
    return unique.join("\n");
  }

  private isMetaLine(text: string): boolean {
    const lowered = text.toLowerCase();
    return (
      lowered.startsWith("维基语录") ||
      lowered.startsWith("本条目") ||
      lowered.startsWith("参见") ||
      lowered.startsWith("外部链接") ||
      lowered.startsWith("参考文献") ||
      lowered.includes("category:") ||
      /^\[\[分类:/.test(text)
    );
  }

  private cleanWikiMarkup(text: string): string {
    let result = text;

    result = result.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
    result = result.replace(/<ref[^>]*\/?>/gi, "");
    result = result.replace(/<nowiki>[\s\S]*?<\/nowiki>/gi, "");
    result = result.replace(/<!--[\s\S]*?-->/g, "");

    result = result.replace(/<\/?(div|span|blockquote|p|br|hr|li|ul|ol)[^>]*>/gi, "");

    result = result.replace(/\[\[([^\|\]]*\|)?([^\]]*)\]\]/g, (_, _label: string, target: string) => {
      const t = (target as string).trim();
      if (t.startsWith("Image:") || t.startsWith("File:") || t.startsWith("Category:")) return "";
      return t;
    });

    result = result.replace(/\{\{[^{}]*\}\}/g, "");
    result = result.replace(/\{\|[^}]*\|\}/g, "");

    result = result.replace(/'''/g, "");
    result = result.replace(/''/g, "");

    result = result.replace(/^\s*[|!].*$/gm, "");
    result = result.replace(/^\s*[:*#]{1,5}\s*/gm, "");
    result = result.replace(/^\s*\{\|.*$/gm, "");
    result = result.replace(/^\s*\|\}.*$/gm, "");

    result = result.replace(/\s+/g, " ").trim();

    return result;
  }
}

export default WikiquoteProvider;
