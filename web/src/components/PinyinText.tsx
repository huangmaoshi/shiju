import { useMemo } from "react";

interface PinyinItem {
  c: string;
  p: string;
}

interface PinyinTextProps {
  text: string;
  pinyinData?: string | null;
  fontSize?: number;
  lineHeight?: number;
  showPinyin?: boolean;
  style?: React.CSSProperties;
}

/**
 * 拼音注音文本组件
 * 使用 HTML ruby 标签在字符上方显示拼音
 * 当 pinyinData 为空或 showPinyin=false 时，退化为普通文本
 */
export default function PinyinText({
  text,
  pinyinData,
  fontSize = 16,
  lineHeight = 2.2,
  showPinyin = true,
  style,
}: PinyinTextProps) {
  const pinyinList = useMemo<PinyinItem[] | null>(() => {
    if (!pinyinData || !showPinyin) return null;
    try {
      const arr = JSON.parse(pinyinData) as PinyinItem[];
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr;
    } catch {
      return null;
    }
  }, [pinyinData, showPinyin]);

  // 无拼音数据时退化为普通文本
  if (!pinyinList) {
    return (
      <span style={{ fontSize, lineHeight, whiteSpace: "pre-wrap", ...style }}>
        {text}
      </span>
    );
  }

  return (
    <span
      style={{
        fontSize,
        lineHeight,
        whiteSpace: "pre-wrap",
        display: "inline",
        ...style,
      }}
    >
      {pinyinList.map((item, i) => {
        const char = item.c;
        const pinyin = item.p;

        // 换行符单独处理
        if (char === "\n" || char === "\\n") {
          return <br key={i} />;
        }

        // 标点或无拼音的字符：直接渲染
        if (!pinyin) {
          return (
            <span key={i} style={{ fontSize, lineHeight: 1 }}>{char}</span>
          );
        }

        // 有拼音的字符：使用 ruby 标签
        return (
          <ruby key={i} style={{ rubyPosition: "over" }}>
            {char}
            <rt
              style={{
                fontSize: `${Math.max(fontSize * 0.45, 10)}px`,
                color: "#999",
                lineHeight: 1.2,
                fontFamily: "-apple-system, sans-serif",
                userSelect: "none",
              }}
            >
              {pinyin}
            </rt>
          </ruby>
        );
      })}
    </span>
  );
}
