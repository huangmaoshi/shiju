import config from "../config";

const SIMHASH_BITS = 64;

function tokenize(text: string): string[] {
  const cleaned = text.replace(/[\s，。！？、；：""''（）《》【】]/g, " ");
  const tokens: string[] = [];
  const chars = cleaned.replace(/\s/g, "");

  for (let i = 0; i < chars.length - 1; i++) {
    tokens.push(chars.slice(i, i + 2));
  }

  if (tokens.length === 0 && chars.length > 0) {
    tokens.push(chars);
  }

  return tokens;
}

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

function intToBinaryString(num: number, bits: number): string {
  return num.toString(2).padStart(bits, "0").slice(-bits);
}

export function computeSimHash(text: string): string {
  if (!text) return "";

  const tokens = tokenize(text);
  const v: number[] = new Array(SIMHASH_BITS).fill(0);

  for (const token of tokens) {
    const hash = stringHash(token);
    const binary = intToBinaryString(hash, SIMHASH_BITS);

    for (let i = 0; i < SIMHASH_BITS; i++) {
      if (binary[i] === "1") {
        v[i] += 1;
      } else {
        v[i] -= 1;
      }
    }
  }

  let fingerprint = "";
  for (let i = 0; i < SIMHASH_BITS; i++) {
    fingerprint += v[i] >= 0 ? "1" : "0";
  }

  return fingerprint;
}

export function computeFingerprint(text: string): string {
  if (!text) return "";
  return computeSimHash(text);
}

export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error("Hash lengths must match");
  }
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++;
  }
  return distance;
}

export function isDuplicate(
  newHash: string,
  existingHashes: string[],
  threshold: number = config.simhashThreshold
): boolean {
  for (const existing of existingHashes) {
    if (!existing) continue;
    if (hammingDistance(newHash, existing) <= threshold) {
      return true;
    }
  }
  return false;
}
