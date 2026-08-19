/**
 * 采集源 URL 解析工具
 *
 * 目前只有 github 类型支持自动解析 raw URL（baseUrl + remark 拼接）
 * 其他类型（api/static/dynamic/web_crawl）需要调用方自行处理。
 */

export interface GithubSourceLike {
  remark?: string | null;
  baseUrl: string;
}

/**
 * 解析 GitHub 直链 URL。优先顺序：
 *  1) remark 本身是完整 http(s) URL → 直接返回
 *  2) baseUrl 是 raw.githubusercontent.com，remark 是
 *     `owner/repo/branch/path...`（含中文字段） → 拼接后对中文段做 URL encode 再返回
 *
 * 解析失败返回 null。
 */
export function resolveGithubRawUrl(source: GithubSourceLike): string | null {
  const remark = (source.remark || "").trim();
  const base = (source.baseUrl || "").trim();

  if (remark && /^https?:\/\//i.test(remark)) return remark;

  if (base && /^https?:\/\//i.test(base)) {
    const tail = remark;
    if (!tail) return base;
    // owner/repo/branch/path （允许中文和 %）
    if (/^[\w.\-%\u4e00-\u9fa5]+\/[\w.\-%\u4e00-\u9fa5]+\/.+$/.test(tail)) {
      const sep = base.endsWith("/") ? "" : "/";
      const encodedTail = tail
        .split("/")
        .map((seg) => (/^[\w.\-%]+$/.test(seg) ? seg : encodeURIComponent(seg)))
        .join("/");
      return `${base}${sep}${encodedTail}`;
    }
  }
  return null;
}

/**
 * 快速 HEAD + GET 回退连通性检查。返回最终 HTTP 状态码与解析后的 URL。
 */
export async function checkUrlReachable(
  rawUrl: string,
  timeoutMs = 10_000,
): Promise<{ url: string; ok: boolean; status: number; statusText: string; latencyMs: number }> {
  const startedAt = Date.now();
  const attempt = async (method: "HEAD" | "GET"): Promise<{ ok: boolean; status: number; statusText: string }> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(rawUrl, {
        method,
        signal: ctrl.signal,
        headers: { "User-Agent": "ShiJu-Crawler/1.0" },
        redirect: "follow",
      });
      if (method === "GET") {
        // 只读首块，避免下载过大文件
        const reader = r.body?.getReader();
        if (reader) {
          try {
            await reader.read();
            reader.releaseLock();
          } catch {
            // ignore
          }
        }
      }
      return { ok: r.ok, status: r.status, statusText: r.statusText };
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? `请求超时(${timeoutMs}ms)`
          : e?.cause?.code || e?.message || String(e);
      return { ok: false, status: 0, statusText: String(msg).slice(0, 120) };
    } finally {
      clearTimeout(t);
    }
  };

  let r = await attempt("HEAD");
  // 部分 CDN 不支持 HEAD，退回 GET
  if (!r.ok && r.status !== 404 && r.status !== 403) {
    const r2 = await attempt("GET");
    if (r2.ok || r2.status === 404 || r2.status === 403) r = r2;
  }
  return {
    url: rawUrl,
    ok: r.ok,
    status: r.status,
    statusText: r.statusText || "",
    latencyMs: Date.now() - startedAt,
  };
}
