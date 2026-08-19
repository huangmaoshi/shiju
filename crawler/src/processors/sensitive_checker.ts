const SENSITIVE_WORDS: string[] = [
  "暴力", "血腥", "杀戮", "屠杀", "枪毙", "枪杀",
  "色情", "淫秽", "猥亵", "性骚扰",
  "毒品", "吸毒", "贩毒", "大麻",
  "赌博", "赌场", "博彩",
  "诈骗", "骗局", "欺诈",
  "自杀", "自残", "跳楼", "割腕",
  "邪教", "传销",
  "反动", "颠覆",
  "枪支", "弹药", "爆炸",
  "绑架", "劫持",
  "仇恨", "种族歧视",
  "色情网", "黄色网",
  "代孕", "买卖器官",
  "黑市", "洗钱",
  "恐怖主义", "极端主义",
  "仇恨言论", "人身攻击",
];

export interface SensitiveCheckResult {
  hasSensitive: boolean;
  matchedWords: string[];
  riskLevel: "none" | "low" | "medium" | "high";
}

export function checkSensitive(text: string): SensitiveCheckResult {
  if (!text) {
    return { hasSensitive: false, matchedWords: [], riskLevel: "none" };
  }

  const lowered = text.toLowerCase();
  const matched: string[] = [];

  for (const word of SENSITIVE_WORDS) {
    if (lowered.includes(word.toLowerCase())) {
      matched.push(word);
    }
  }

  let riskLevel: SensitiveCheckResult["riskLevel"] = "none";
  if (matched.length === 1) {
    riskLevel = "low";
  } else if (matched.length <= 3) {
    riskLevel = "medium";
  } else if (matched.length > 3) {
    riskLevel = "high";
  }

  return {
    hasSensitive: matched.length > 0,
    matchedWords: matched,
    riskLevel,
  };
}

export function filterSensitive(text: string, replaceChar: string = "*"): string {
  if (!text) return "";
  let result = text;
  for (const word of SENSITIVE_WORDS) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, replaceChar.repeat(word.length));
  }
  return result;
}

export function getSensitiveWordList(): string[] {
  return [...SENSITIVE_WORDS];
}

export default { checkSensitive, filterSensitive, getSensitiveWordList };
