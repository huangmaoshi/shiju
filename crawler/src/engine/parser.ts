import * as cheerio from "cheerio";

export function load(html: string) {
  return cheerio.load(html, {
    decodeEntities: false,
    normalizeWhitespace: false,
  });
}

export function extractText($: cheerio.CheerioAPI, selector: string): string {
  const el = $(selector).first();
  if (el.length === 0) return "";
  return el.text().trim();
}

export function extractAllText($: cheerio.CheerioAPI, selector: string): string[] {
  const result: string[] = [];
  $(selector).each((_, el) => {
    const text = $(el).text().trim();
    if (text) result.push(text);
  });
  return result;
}

export function extractAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string
): string {
  const el = $(selector).first();
  if (el.length === 0) return "";
  return (el.attr(attr) || "").trim();
}

export function extractAllAttr(
  $: cheerio.CheerioAPI,
  selector: string,
  attr: string
): string[] {
  const result: string[] = [];
  $(selector).each((_, el) => {
    const value = $(el).attr(attr);
    if (value) result.push(value.trim());
  });
  return result;
}

export function extractLinks($: cheerio.CheerioAPI, selector: string): string[] {
  return extractAllAttr($, selector, "href");
}

export function hasSelector($: cheerio.CheerioAPI, selector: string): boolean {
  return $(selector).length > 0;
}
