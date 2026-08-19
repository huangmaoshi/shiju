export function stripHtmlTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function normalizeWhitespace(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function removeBom(text: string): string {
  if (!text) return "";
  return text.replace(/^\uFEFF/, "");
}

export function cleanContent(text: string): string {
  if (!text) return "";
  let result = text;
  result = stripHtmlTags(result);
  result = removeBom(result);
  result = normalizeWhitespace(result);
  result = result
    .replace(/[ \t]+([，。！？；：])/g, "$1")
    .replace(/([，。！？；：])([^ "])/g, "$1$2");
  return result.trim();
}

export function truncateSummary(text: string, maxLen: number = 100): string {
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

export default {
  stripHtmlTags,
  normalizeWhitespace,
  removeBom,
  cleanContent,
  truncateSummary,
};
