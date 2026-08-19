import * as crypto from "crypto";

const SIMHASH_BITS = 64;
const SIMHASH_THRESHOLD_85_PERCENT = 10; // 64-bit, 10 bits different = 84.4% similarity

const SHORT_TEXT_BOUNDARY = 100;

function normalize(text: string): string {
    return text
        .replace(/[\s，。！？、；：""''（）《》【】…—\u3000]/g, "")
        .replace(/\s+/g, "")
        .toLowerCase();
}

function md5(text: string): string {
    return crypto.createHash("md5").update(text, "utf8").digest("hex");
}

function tokenize(text: string): string[] {
    const cleaned = normalize(text);
    if (cleaned.length === 0) return [];
    const tokens: string[] = [];
    for (let i = 0; i < cleaned.length - 1; i++) {
        tokens.push(cleaned.slice(i, i + 2));
    }
    if (tokens.length === 0 && cleaned.length > 0) {
        tokens.push(cleaned);
    }
    return tokens;
}

function stringHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return Math.abs(hash);
}

function intToBinaryString(num: number, bits: number): string {
    return (num >>> 0).toString(2).padStart(bits, "0").slice(-bits);
}

function computeSimHash(text: string): string {
    if (!text) return "";
    const tokens = tokenize(text);
    const v: number[] = new Array(SIMHASH_BITS).fill(0);

    for (const token of tokens) {
        const hash = stringHash(token);
        const binary = intToBinaryString(hash, SIMHASH_BITS);
        for (let i = 0; i < SIMHASH_BITS; i++) {
            if (binary[i] === "1") v[i] += 1;
            else v[i] -= 1;
        }
    }

    let fingerprint = "";
    for (let i = 0; i < SIMHASH_BITS; i++) {
        fingerprint += v[i] >= 0 ? "1" : "0";
    }
    return fingerprint;
}

function hammingDistance(a: string, b: string): number {
    if (a.length !== b.length) return SIMHASH_BITS;
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) dist++;
    }
    return dist;
}

function similarityPercent(a: string, b: string): number {
    if (!a || !b) return 0;
    const dist = hammingDistance(a, b);
    return ((SIMHASH_BITS - dist) / SIMHASH_BITS) * 100;
}

export interface DedupInput {
    content: string;
}

export interface DedupFingerprint {
    contentMd5: string;
    simHash: string;
    normalized: string;
}

export interface DedupContext {
    knownMd5s: Set<string>;
    knownSimHashes: string[];
    threshold: number; // hamming distance threshold for 85% similarity
}

function fingerprint(content: string): DedupFingerprint {
    const normalized = normalize(content);
    return {
        contentMd5: md5(normalized),
        simHash: computeSimHash(content),
        normalized,
    };
}

function isDuplicate(content: string, ctx: DedupContext, contentLen?: number): { isDup: boolean; reason?: "md5" | "simhash" } {
    const len = contentLen ?? content.length;
    const fp = fingerprint(content);

    // 1. MD5 精确匹配（短文本唯一手段，长文本也作为快速路径）
    if (ctx.knownMd5s.has(fp.contentMd5)) {
        return { isDup: true, reason: "md5" };
    }

    // 2. 长文本才做 SimHash 相似度检查
    if (len >= SHORT_TEXT_BOUNDARY) {
        for (const existingHash of ctx.knownSimHashes) {
            if (!existingHash) continue;
            const dist = hammingDistance(fp.simHash, existingHash);
            if (dist <= ctx.threshold) {
                return { isDup: true, reason: "simhash" };
            }
        }
    }

    return { isDup: false };
}

export const dedup = {
    SIMHASH_BITS,
    SHORT_TEXT_BOUNDARY,
    DEFAULT_SIMHASH_THRESHOLD: SIMHASH_THRESHOLD_85_PERCENT,

    normalize,
    md5,
    computeSimHash,
    hammingDistance,
    similarityPercent,
    fingerprint,
    isDuplicate,
};

export default dedup;
