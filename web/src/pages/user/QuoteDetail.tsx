import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Card,
  Tag,
  Button,
  Spin,
  message,
  Divider,
  Row,
  Col,
  Drawer,
  Popover,
  Empty,
  Modal,
  Select,
  Input,
  Slider,
  Checkbox,
} from "antd";
import { StarOutlined, DownloadOutlined, CopyOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { adminApi, collectionApi } from "@/api";
import { quoteApi } from "@/api/quote";
import type { Quote } from "@/types";
import PinyinText from "@/components/PinyinText";

const FONT_OPTIONS = [
  { label: "PingFang SC", value: "PingFang SC" },
  { label: "Microsoft YaHei", value: "Microsoft YaHei" },
  { label: "SimHei", value: "SimHei" },
  { label: "SimSun", value: "SimSun" },
  { label: "Georgia", value: "Georgia" },
  { label: "系统默认", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
];

const TEXT_ALIGN_OPTIONS = [
  { label: "居中", value: "center" },
  { label: "左对齐", value: "left" },
  { label: "右对齐", value: "right" },
];

const DEFAULT_TEXT_WIDTH = 280;
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1600;
const PREVIEW_WIDTH = 360;
const PREVIEW_HEIGHT = 520;
const PREVIEW_SCALE = Math.min(PREVIEW_WIDTH / EXPORT_WIDTH, PREVIEW_HEIGHT / EXPORT_HEIGHT);
const PREVIEW_OFFSET_X = Math.round((PREVIEW_WIDTH - EXPORT_WIDTH * PREVIEW_SCALE) / 2);
const PREVIEW_OFFSET_Y = Math.round((PREVIEW_HEIGHT - EXPORT_HEIGHT * PREVIEW_SCALE) / 2);

const defaultExportSettings = (template?: any) => {
  const fontSize = template?.fontSize || 32;
  const textY = template?.textY ?? 210;
  const textHeight = template?.textHeight ?? 260;

  return {
    bgType: template?.bgType || "color",
    bgValue: template?.bgValue || "#ffffff",
    fontFamily: template?.fontFamily || "PingFang SC",
    fontSize,
    fontColor: template?.fontColor || "#1f2937",
    lineHeight: template?.lineHeight || 1.8,
    textAlign: template?.textAlign || "center",
    textX: template?.textX ?? 40,
    textY,
    textWidth: template?.textWidth ?? DEFAULT_TEXT_WIDTH,
    textHeight,
    authorX: template?.authorX ?? template?.textX ?? 40,
    authorY: template?.authorY ?? Math.min(1600 - 120, textY + textHeight + 18),
    authorFontSize: template?.authorFontSize ?? Math.max(18, Math.round(fontSize * 0.75)),
    showAuthor: template?.showAuthor !== 0,
    showWatermark: template?.showWatermark !== 0,
  };
};

export default function QuoteDetail() {
  const { id } = useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [collectLoading, setCollectLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTemplateId, setExportTemplateId] = useState<number | null>(null);
  const [exportSettings, setExportSettings] = useState<any>(defaultExportSettings());
  const [exportLoading, setExportLoading] = useState(false);
  const [editorLocked, setEditorLocked] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const textBoxRef = useRef<HTMLDivElement | null>(null);
  const textResizeRef = useRef<{
    active: boolean;
    mode: "corner" | "width";
    startX: number;
    startY: number;
    startTextWidth: number;
    startTextHeight: number;
  }>({
    active: false,
    mode: "corner",
    startX: 0,
    startY: 0,
    startTextWidth: DEFAULT_TEXT_WIDTH,
    startTextHeight: 260,
  });
  const textDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });
  const authorDragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
  });
  const authorResizeRef = useRef<{ active: boolean; startY: number; startAuthorFontSize: number }>({
    active: false,
    startY: 0,
    startAuthorFontSize: 24,
  });

  useEffect(() => {
    if (!id) return;
    quoteApi.detail(Number(id)).then(setQuote).finally(() => setLoading(false));
    collectionApi.list().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    adminApi
      .cards()
      .then((data: any) => {
        const nextTemplates = Array.isArray(data) ? data : [];
        setTemplates(nextTemplates);
        if (nextTemplates.length > 0) {
          setExportTemplateId(nextTemplates[0].id);
          setExportSettings(defaultExportSettings(nextTemplates[0]));
        }
      })
      .catch(() => {
        setTemplates([]);
      });
  }, []);

  const cats = quote?.categories
    ? Array.isArray(quote.categories)
      ? quote.categories.map((c: any) => (typeof c === "string" ? c : c.name))
      : []
    : [];

  const copy = () => {
    if (!quote) return;
    navigator.clipboard.writeText(`"${quote.content}"\n—— ${quote.author || "佚名"}${quote.source ? ` 《${quote.source}》` : ""}`);
    message.success("已复制到剪贴板");
  };

  const onAddToDefault = async () => {
    if (!quote) return;
    setCollectLoading(true);
    try {
      await collectionApi.collectQuote(Number(quote.id));
      message.success("已加入摘抄本");
      collectionApi.list().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (e: any) {
      if (e?.message?.includes("已在") || e?.message?.includes("400")) {
        message.info("该句已在摘抄本中");
      } else {
        message.error(e?.message || "加入失败");
      }
    } finally {
      setCollectLoading(false);
    }
  };

  const onAddToCollection = async (cid: number) => {
    if (!quote) return;
    try {
      await collectionApi.addQuoteTo(cid, { quoteId: Number(quote.id) });
      message.success("加入成功");
      collectionApi.list().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (e: any) {
      message.error(e?.message || "加入失败");
    }
  };

  const addToCollectionContent = (
    <div style={{ minWidth: 200 }}>
      {collections.length === 0 ? (
        <Empty description="暂无摘抄本" style={{ padding: "20px 0" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {collections.map((c: any) => (
            <a
              key={c.id}
              onClick={() => onAddToCollection(c.id)}
              style={{ padding: "6px 8px", borderRadius: 6, display: "flex", justifyContent: "space-between" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span>
                <FolderOpenOutlined /> {c.name}
              </span>
              <span style={{ color: "#aaa", fontSize: 12 }}>{c.quoteCount || 0} 条</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const handleSelectTemplate = (value: number | null) => {
    setExportTemplateId(value);
    const match = templates.find((item) => item.id === value);
    setExportSettings(defaultExportSettings(match));
  };

  const handleBgFileChange = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setExportSettings((prev: any) => ({
        ...prev,
        bgType: "image",
        bgValue: String(reader.result),
      }));
      message.success("已读取本地背景图片");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const lines: string[] = [];
    const rawParagraphs = text.split(/\n/);

    rawParagraphs.forEach((paragraph) => {
      if (!paragraph.trim()) {
        lines.push("");
        return;
      }

      const tokens = paragraph.split(/(\s+)/).filter((token) => token.length > 0);
      let line = "";

      const pushLine = (value: string) => {
        const trimmed = value.trimEnd();
        if (trimmed) {
          lines.push(trimmed);
        }
      };

      tokens.forEach((token) => {
        if (/^\s+$/.test(token)) {
          if (line) {
            line += token;
          }
          return;
        }

        const tokenWidth = ctx.measureText(token).width;

        if (tokenWidth <= maxWidth) {
          const candidate = line + token;
          if (ctx.measureText(candidate).width <= maxWidth || !line) {
            line = candidate;
            return;
          }
        }

        if (line) {
          pushLine(line);
          line = "";
        }

        if (tokenWidth <= maxWidth) {
          line = token;
          return;
        }

        let word = "";
        Array.from(token).forEach((char) => {
          const candidate = word + char;
          if (ctx.measureText(candidate).width <= maxWidth || !word) {
            word = candidate;
            return;
          }

          pushLine(word);
          word = char;
        });

        if (word) {
          line = word;
        }
      });

      if (line) {
        pushLine(line);
      }
    });

    return lines;
  };

  const buildTextLines = (text: string, settings: any) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return [text];

    ctx.font = `600 ${settings.fontSize || 32}px ${settings.fontFamily || "PingFang SC"}`;

    const textX = Number(settings.textX ?? 40);
    const textWidth = Number(settings.textWidth ?? DEFAULT_TEXT_WIDTH);
    const maxWidth = Math.max(120, Math.min(textWidth, 1080 - textX * 2));

    return wrapText(ctx, text, maxWidth);
  };

  const buildCardCanvas = async () => {
    if (!quote) throw new Error("缺少金句数据");

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建画布");

    const settings = exportSettings;

    if (settings.bgType === "image" && settings.bgValue) {
      try {
        const bg = await loadImage(settings.bgValue);
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      } catch {
        ctx.fillStyle = settings.bgValue || "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      ctx.fillStyle = settings.bgValue || "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const overlay = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    overlay.addColorStop(0, "rgba(255,255,255,0.12)");
    overlay.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const textX = Number(settings.textX ?? 40);
    const textY = Number(settings.textY ?? 210);
    const textWidth = Number(settings.textWidth ?? DEFAULT_TEXT_WIDTH);
    const textHeight = Number(settings.textHeight ?? 260);
    const maxWidth = Math.max(120, Math.min(textWidth, canvas.width - textX * 2));
    const authorX = Number(settings.authorX ?? textX);
    const authorY = Number(settings.authorY ?? Math.min(canvas.height - 120, textY + textHeight + 18));
    const authorFontSize = Number(settings.authorFontSize ?? Math.max(18, Math.round((settings.fontSize || 32) * 0.75)));

    ctx.textBaseline = "top";
    ctx.fillStyle = settings.fontColor || "#1f2937";
    ctx.font = `600 ${settings.fontSize || 32}px ${settings.fontFamily || "PingFang SC"}`;

    const lines = buildTextLines(quote.content || "", settings);
    const lineHeight = (settings.fontSize || 32) * (settings.lineHeight || 1.8);
    const maxVisibleLines = Math.max(1, Math.floor(textHeight / lineHeight));
    const visibleLines = lines.slice(0, maxVisibleLines);

    const align = settings.textAlign === "left" ? "left" : settings.textAlign === "right" ? "right" : "center";

    visibleLines.forEach((line, index) => {
      const y = textY + index * lineHeight;
      const x = align === "left" ? textX : align === "right" ? textX + maxWidth : textX + maxWidth / 2;
      ctx.textAlign = align;
      ctx.fillText(line, x, y);
    });

    if (settings.showAuthor) {
      ctx.font = `500 ${authorFontSize}px ${settings.fontFamily || "PingFang SC"}`;
      ctx.fillStyle = "rgba(31, 41, 55, 0.85)";
      ctx.textAlign = "left";
      const authorText = `—— ${quote.author || "佚名"}${quote.source ? ` 《${quote.source}》` : ""}`;
      ctx.fillText(authorText, authorX, authorY);
    }

    if (settings.showWatermark) {
      ctx.font = "500 24px PingFang SC";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.textAlign = "right";
      ctx.fillText("拾句", canvas.width - 80, canvas.height - 70);
    }

    return canvas;
  };

  const handleExportCard = async () => {
    setExportLoading(true);
    try {
      const canvas = await buildCardCanvas();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("生成图片失败");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shiju-card-${quote?.id || Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("已导出图片卡片");
      setExportOpen(false);
    } catch (e: any) {
      message.error(e?.message || "导出失败");
    } finally {
      setExportLoading(false);
    }
  };

  const startTextDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const currentPreviewX = Math.round((exportSettings.textX ?? 40) * PREVIEW_SCALE + PREVIEW_OFFSET_X);
    const currentPreviewY = Math.round((exportSettings.textY ?? 210) * PREVIEW_SCALE + PREVIEW_OFFSET_Y);

    textDragRef.current = {
      active: true,
      offsetX: event.clientX - currentPreviewX,
      offsetY: event.clientY - currentPreviewY,
    };
  };

  const onTextDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked || !textDragRef.current.active) return;

    event.preventDefault();

    const textWidth = Number(exportSettings.textWidth ?? DEFAULT_TEXT_WIDTH) * PREVIEW_SCALE;
    const textHeight = Number(exportSettings.textHeight ?? 260) * PREVIEW_SCALE;
    const nextPreviewX = Math.max(
      PREVIEW_OFFSET_X + 8,
      Math.min(PREVIEW_OFFSET_X + PREVIEW_WIDTH - Math.max(18, textWidth) - 8, event.clientX - textDragRef.current.offsetX)
    );
    const nextPreviewY = Math.max(
      PREVIEW_OFFSET_Y + 8,
      Math.min(PREVIEW_OFFSET_Y + PREVIEW_HEIGHT - Math.max(18, textHeight) - 8, event.clientY - textDragRef.current.offsetY)
    );

    setExportSettings((prev: any) => ({
      ...prev,
      textX: Math.round((nextPreviewX - PREVIEW_OFFSET_X) / PREVIEW_SCALE),
      textY: Math.round((nextPreviewY - PREVIEW_OFFSET_Y) / PREVIEW_SCALE),
    }));
  };

  const stopTextDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    textDragRef.current.active = false;
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startTextResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const mode = (event.currentTarget.dataset.resizeMode as "corner" | "width") || "corner";

    textResizeRef.current = {
      active: true,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startTextWidth: Number(exportSettings.textWidth ?? DEFAULT_TEXT_WIDTH),
      startTextHeight: Number(exportSettings.textHeight ?? 260),
    };
  };

  const onTextResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked || !textResizeRef.current.active) return;

    event.preventDefault();
    const currentTextWidth = Number(exportSettings.textWidth ?? DEFAULT_TEXT_WIDTH);
    const currentTextHeight = Number(exportSettings.textHeight ?? 260);
    const previewX = Number(exportSettings.textX ?? 40) * PREVIEW_SCALE;
    const previewY = Number(exportSettings.textY ?? 210) * PREVIEW_SCALE;

    const deltaX = (event.clientX - textResizeRef.current.startX) / PREVIEW_SCALE;
    const deltaY = (event.clientY - textResizeRef.current.startY) / PREVIEW_SCALE;

    const nextTextWidth = Math.min(
      Math.max(120, Math.round(textResizeRef.current.startTextWidth + deltaX)),
      Math.max(120, Math.round(PREVIEW_WIDTH - previewX - 20) / PREVIEW_SCALE)
    );

    if (textResizeRef.current.mode === "width") {
      if (currentTextWidth === nextTextWidth) return;

      setExportSettings((prev: any) => ({
        ...prev,
        textWidth: nextTextWidth,
      }));
      return;
    }

    const nextTextHeight = Math.min(
      Math.max(120, Math.round(textResizeRef.current.startTextHeight + deltaY)),
      Math.max(120, Math.round(PREVIEW_HEIGHT - previewY - 20) / PREVIEW_SCALE)
    );

    if (currentTextWidth === nextTextWidth && currentTextHeight === nextTextHeight) return;

    setExportSettings((prev: any) => ({
      ...prev,
      textWidth: nextTextWidth,
      textHeight: nextTextHeight,
    }));
  };

  const stopTextResize = (event?: React.PointerEvent<HTMLDivElement>) => {
    textResizeRef.current.active = false;
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startAuthorDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const currentPreviewX = Math.round((exportSettings.authorX ?? exportSettings.textX ?? 40) * PREVIEW_SCALE + PREVIEW_OFFSET_X);
    const currentPreviewY = Math.round((exportSettings.authorY ?? Math.min(EXPORT_HEIGHT - 120, (exportSettings.textY ?? 210) + (exportSettings.textHeight ?? 260) + 18)) * PREVIEW_SCALE + PREVIEW_OFFSET_Y);

    authorDragRef.current = {
      active: true,
      offsetX: event.clientX - currentPreviewX,
      offsetY: event.clientY - currentPreviewY,
    };
  };

  const onAuthorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked || !authorDragRef.current.active) return;

    event.preventDefault();
    const nextPreviewX = Math.max(
      PREVIEW_OFFSET_X + 8,
      Math.min(PREVIEW_OFFSET_X + PREVIEW_WIDTH - 120, event.clientX - authorDragRef.current.offsetX)
    );
    const nextPreviewY = Math.max(
      PREVIEW_OFFSET_Y + 8,
      Math.min(PREVIEW_OFFSET_Y + PREVIEW_HEIGHT - 40, event.clientY - authorDragRef.current.offsetY)
    );

    setExportSettings((prev: any) => ({
      ...prev,
      authorX: Math.round((nextPreviewX - PREVIEW_OFFSET_X) / PREVIEW_SCALE),
      authorY: Math.round((nextPreviewY - PREVIEW_OFFSET_Y) / PREVIEW_SCALE),
    }));
  };

  const stopAuthorDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    authorDragRef.current.active = false;
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startAuthorScale = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    authorResizeRef.current = {
      active: true,
      startY: event.clientY,
      startAuthorFontSize: Number(exportSettings.authorFontSize ?? Math.max(18, Math.round((exportSettings.fontSize || 32) * 0.75))),
    };
  };

  const onAuthorScaleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editorLocked || !authorResizeRef.current.active) return;

    event.preventDefault();
    const deltaY = event.clientY - authorResizeRef.current.startY;
    const nextFontSize = Math.max(
      14,
      Math.min(160, Math.round(authorResizeRef.current.startAuthorFontSize + deltaY * 0.35))
    );

    setExportSettings((prev: any) => ({
      ...prev,
      authorFontSize: nextFontSize,
    }));
  };

  const stopAuthorScale = (event?: React.PointerEvent<HTMLDivElement>) => {
    authorResizeRef.current.active = false;
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const ot = quote?.originalText;
  const SHOW_LIMIT = 500;
  const otFull = ot?.content || "";
  const otPreview = otFull.length > SHOW_LIMIT ? otFull.slice(0, SHOW_LIMIT) : otFull;
  const previewLines = quote ? buildTextLines(quote.content || "", exportSettings) : [];
  const previewTextX = Number(exportSettings.textX ?? 40);
  const previewTextY = Number(exportSettings.textY ?? 210);
  const previewTextWidth = Number(exportSettings.textWidth ?? DEFAULT_TEXT_WIDTH);
  const previewTextHeight = Number(exportSettings.textHeight ?? 260);
  const previewFontSize = Number(exportSettings.fontSize || 32);
  const previewLineHeight = Number((exportSettings.fontSize || 32) * (exportSettings.lineHeight || 1.8));
  const previewAuthorX = Number(exportSettings.authorX ?? exportSettings.textX ?? 40);
  const previewAuthorY = Number(exportSettings.authorY ?? Math.min(EXPORT_HEIGHT - 120, (exportSettings.textY ?? 210) + (exportSettings.textHeight ?? 260) + 18));
  const previewAuthorFontSize = Number(exportSettings.authorFontSize ?? Math.max(18, Math.round((exportSettings.fontSize || 32) * 0.75)));

  if (loading) return <Spin style={{ display: "block", margin: "40px auto" }} />;
  if (!quote) return <Card><p>金句不存在</p></Card>;

  return (
    <Row gutter={16}>
      <Col xs={24} lg={16}>
        <Card className="quote-card" style={{ borderRadius: 16, marginBottom: 16 }}>
          {quote.pinyinData && (
            <div style={{ textAlign: "right", marginBottom: 8 }}>
              <Tag
                style={{ cursor: "pointer", fontSize: 12 }}
                color={showPinyin ? "blue" : "default"}
                onClick={() => setShowPinyin(!showPinyin)}
              >
                {showPinyin ? "拼音：开" : "拼音：关"}
              </Tag>
            </div>
          )}
          <p style={{ fontSize: 22, lineHeight: 2.5, color: "#333", fontWeight: 500 }}>
            <PinyinText
              text={quote.content}
              pinyinData={quote.pinyinData}
              showPinyin={showPinyin}
              fontSize={22}
              lineHeight={2.5}
            />
          </p>
          <Divider />
          <div style={{ color: "#666", fontSize: 15, marginBottom: 16 }}>
            —— <strong>{quote.author || "佚名"}</strong>
            {quote.source && <> 《{quote.source}》</>}
          </div>
          {ot && (
            <Card
              size="small"
              style={{ marginBottom: 16, borderRadius: 12, background: "#fafbfc" }}
              title={<span>📖 原文节选</span>}
            >
              <div style={{ color: "#555", fontSize: 14, marginBottom: 8 }}>
                <strong>{ot.title}</strong>
                {ot.author && <span style={{ color: "#888", marginLeft: 8 }}>—— {ot.author}</span>}
              </div>
              <Divider style={{ margin: "8px 0 12px", borderColor: "#e0e0e0" }} plain>
                以下为金句原文
              </Divider>
              <div
                style={{
                  maxHeight: expanded ? "none" : 180,
                  overflowY: expanded ? "visible" : "auto",
                  fontSize: 14,
                  lineHeight: 2,
                  color: "#444",
                  whiteSpace: "pre-wrap",
                }}
              >
                <PinyinText
                  text={expanded ? otFull : otPreview}
                  pinyinData={ot.pinyinData}
                  showPinyin={showPinyin}
                  fontSize={14}
                  lineHeight={2.2}
                />
              </div>
              {otFull.length > SHOW_LIMIT && (
                <a onClick={() => setExpanded(!expanded)} style={{ marginTop: 8, display: "inline-block" }}>
                  {expanded ? "收起" : "展开全文"}
                </a>
              )}
            </Card>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {cats.map((n) => (
              <Tag key={n} color="purple" style={{ fontSize: 13, padding: "4px 12px" }}>{n}</Tag>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Button type="primary" icon={<StarOutlined />} loading={collectLoading} onClick={onAddToDefault}>
              加入摘抄本
            </Button>
            <Popover content={addToCollectionContent} title="加入指定摘抄本" trigger="click" placement="bottom">
              <Button icon={<FolderOpenOutlined />}>选择摘抄本</Button>
            </Popover>
            <Button icon={<CopyOutlined />} onClick={copy}>复制</Button>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              导出图片卡片
            </Button>
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        {ot && (
          <Card title="📖 出处信息" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: "#555", marginBottom: 12 }}>
              出自：<strong>{ot.title}</strong>
              {ot.author && <span style={{ color: "#888", marginLeft: 6 }}>（{ot.author}）</span>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button type="link" style={{ padding: 0 }} onClick={() => setDrawerOpen(true)}>
                查看完整原文 →
              </Button>
              <Link to={`/original-text/${ot.id}`} style={{ color: "#667eea", fontSize: 14 }}>
                进入原文页 →
              </Link>
            </div>
          </Card>
        )}
        <Card title="统计" style={{ marginBottom: 16 }}>
          <p>👁️ 浏览：{quote.viewCount}</p>
          <p>⭐ 收藏：{quote.collectCount}</p>
          <p>📅 录入：{new Date(quote.createdAt).toLocaleDateString()}</p>
          <p>{quote.isFree ? "🟢 免费" : "🔒 会员"}</p>
        </Card>
        <Card title="相关金句">
          <p style={{ color: "#999", fontSize: 13 }}>暂无相关推荐</p>
        </Card>
      </Col>

      <Modal
        title="导出图片卡片"
        open={exportOpen}
        width={980}
        footer={null}
        onCancel={() => setExportOpen(false)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>选择模板</div>
                <Select
                  style={{ width: "100%" }}
                  value={exportTemplateId}
                  onChange={handleSelectTemplate}
                  options={templates.map((item) => ({ label: item.name, value: item.id }))}
                  allowClear
                  placeholder="可不选，直接自定义"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>卡片背景</div>
                <Select
                  style={{ width: "100%" }}
                  value={exportSettings.bgType}
                  onChange={(value) => setExportSettings((prev: any) => ({ ...prev, bgType: value }))}
                  options={[
                    { label: "纯色背景", value: "color" },
                    { label: "图片背景", value: "image" },
                  ]}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>背景值（颜色 / URL / 本地 data URL）</div>
                <Input.TextArea
                  rows={3}
                  value={exportSettings.bgValue}
                  onChange={(e) =>
                    setExportSettings((prev: any) => ({ ...prev, bgValue: e.target.value }))
                  }
                  placeholder="可填 #ffffff 或图片 URL"
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>本地背景图</div>
                <input type="file" accept="image/*" onChange={handleBgFileChange} />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>字体</div>
                <Select
                  style={{ width: "100%" }}
                  value={exportSettings.fontFamily}
                  onChange={(value) => setExportSettings((prev: any) => ({ ...prev, fontFamily: value }))}
                  options={FONT_OPTIONS}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>文字位置</div>
                <Select
                  style={{ width: "100%" }}
                  value={exportSettings.textAlign}
                  onChange={(value) => setExportSettings((prev: any) => ({ ...prev, textAlign: value }))}
                  options={TEXT_ALIGN_OPTIONS}
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>显示作者名字</div>
                <Checkbox
                  checked={Boolean(exportSettings.showAuthor)}
                  onChange={(e) => setExportSettings((prev: any) => ({ ...prev, showAuthor: e.target.checked }))}
                >
                  显示作者
                </Checkbox>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>编辑状态</div>
                <Button
                  type={editorLocked ? "default" : "primary"}
                  onClick={() => setEditorLocked((prev) => !prev)}
                  style={{ width: "100%" }}
                >
                  {editorLocked ? "已锁定，点击解锁编辑" : "已解锁，点击锁定编辑"}
                </Button>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>文字宽度</div>
                <div style={{ color: "#999", fontSize: 12 }}>
                  可直接在预览区右侧拖拽调整正文宽度
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>字体大小</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Slider
                    min={18}
                    max={80}
                    style={{ flex: 1 }}
                    value={exportSettings.fontSize || 32}
                    onChange={(value) => setExportSettings((prev: any) => ({ ...prev, fontSize: Number(value) || 32 }))}
                  />
                  <Input
                    style={{ width: 90 }}
                    value={exportSettings.fontSize}
                    onChange={(e) =>
                      setExportSettings((prev: any) => ({ ...prev, fontSize: Number(e.target.value) || 32 }))
                    }
                  />
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>作者字体大小</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Slider
                    min={14}
                    max={160}
                    style={{ flex: 1 }}
                    value={exportSettings.authorFontSize ?? Math.max(18, Math.round((exportSettings.fontSize || 32) * 0.75))}
                    onChange={(value) => setExportSettings((prev: any) => ({ ...prev, authorFontSize: Number(value) || 24 }))}
                  />
                  <Input
                    style={{ width: 90 }}
                    value={exportSettings.authorFontSize ?? Math.max(18, Math.round((exportSettings.fontSize || 32) * 0.75))}
                    onChange={(e) =>
                      setExportSettings((prev: any) => ({
                        ...prev,
                        authorFontSize: Number(e.target.value) || Math.max(18, Math.round((prev.fontSize || 32) * 0.75)),
                      }))
                    }
                  />
                </div>
                <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>
                  可在预览区直接拖动作者名字位置
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <Button onClick={() => setExportOpen(false)}>取消</Button>
                <Button type="primary" loading={exportLoading} onClick={handleExportCard}>
                  导出 PNG
                </Button>
              </div>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>编辑预览</div>
              <Button
                size="small"
                type={editorLocked ? "default" : "primary"}
                onClick={() => setEditorLocked((prev) => !prev)}
              >
                {editorLocked ? "解锁编辑" : "锁定编辑"}
              </Button>
            </div>

            <div
              ref={previewContainerRef}
              style={{
                width: PREVIEW_WIDTH,
                height: PREVIEW_HEIGHT,
                margin: "0 auto",
                borderRadius: 18,
                overflow: "hidden",
                position: "relative",
                border: "1px solid #e8e8e8",
                background: "#000",
                boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: PREVIEW_OFFSET_X,
                  top: PREVIEW_OFFSET_Y,
                  width: EXPORT_WIDTH,
                  height: EXPORT_HEIGHT,
                  transform: `scale(${PREVIEW_SCALE})`,
                  transformOrigin: "top left",
                  background:
                    exportSettings.bgType === "image" && exportSettings.bgValue
                      ? `url(${exportSettings.bgValue}) center/cover no-repeat`
                      : exportSettings.bgValue || "#ffffff",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.12)",
                    pointerEvents: "none",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "rgba(45, 55, 72, 0.72)",
                    color: "#fff",
                    fontSize: 11,
                    lineHeight: 1,
                    zIndex: 2,
                  }}
                >
                  1080×1600 实际像素预览
                </div>

                <div
                  ref={textBoxRef}
                  onPointerDown={startTextDrag}
                  onPointerMove={onTextDragMove}
                  onPointerUp={stopTextDrag}
                  onPointerCancel={stopTextDrag}
                  style={{
                    position: "absolute",
                    left: previewTextX,
                    top: previewTextY,
                    width: previewTextWidth,
                    height: previewTextHeight,
                    color: exportSettings.fontColor || "#1f2937",
                    overflow: "hidden",
                    minWidth: 120,
                    minHeight: 120,
                    border: "1px dashed rgba(102, 126, 234, 0.4)",
                    background: "rgba(255,255,255,0.08)",
                    boxSizing: "border-box",
                    cursor: editorLocked ? "default" : "move",
                    touchAction: "none",
                    userSelect: "none",
                    pointerEvents: editorLocked ? "none" : "auto",
                  }}
                  title="拖动移动正文位置"
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {previewLines.map((line, index) => (
                      <div
                        key={`${line}-${index}`}
                        style={{
                          fontFamily: exportSettings.fontFamily || "PingFang SC",
                          fontSize: previewFontSize,
                          lineHeight: exportSettings.lineHeight || 1.8,
                          fontWeight: 600,
                          wordBreak: "break-word",
                          textAlign: exportSettings.textAlign || "center",
                          whiteSpace: "pre-wrap",
                          minHeight: `${previewLineHeight}px`,
                        }}
                      >
                        {line || " "}
                      </div>
                    ))}
                  </div>
                </div>

                {exportSettings.showAuthor && (
                  <div
                    onPointerDown={startAuthorDrag}
                    onPointerMove={onAuthorPointerMove}
                    onPointerUp={stopAuthorDrag}
                    onPointerCancel={stopAuthorDrag}
                    style={{
                      position: "absolute",
                      left: previewAuthorX,
                      top: previewAuthorY,
                      fontSize: previewAuthorFontSize,
                      opacity: 0.85,
                      color: exportSettings.fontColor || "#1f2937",
                      cursor: editorLocked ? "default" : "move",
                      touchAction: "none",
                      whiteSpace: "nowrap",
                      userSelect: "none",
                      padding: "2px 4px",
                      border: "1px dashed rgba(102, 126, 234, 0.25)",
                      borderRadius: 4,
                      background: "rgba(255,255,255,0.04)",
                      pointerEvents: editorLocked ? "none" : "auto",
                      zIndex: 3,
                    }}
                    title="拖动移动作者名字位置"
                  >
                    —— {quote.author || "佚名"}{quote.source ? ` 《${quote.source}》` : ""}
                    <div
                      onPointerDown={startAuthorScale}
                      onPointerMove={onAuthorScaleMove}
                      onPointerUp={stopAuthorScale}
                      onPointerLeave={stopAuthorScale}
                      onPointerCancel={stopAuthorScale}
                      style={{
                        position: "absolute",
                        right: -4,
                        bottom: -4,
                        width: 10,
                        height: 10,
                        borderRight: "2px solid rgba(102, 126, 234, 0.95)",
                        borderBottom: "2px solid rgba(102, 126, 234, 0.95)",
                        background: "rgba(255,255,255,0.18)",
                        borderRadius: 2,
                        cursor: editorLocked ? "default" : "nwse-resize",
                        touchAction: "none",
                        pointerEvents: editorLocked ? "none" : "auto",
                      }}
                      title="拖拽调整作者字号"
                    />
                  </div>
                )}
                <div
                  data-resize-mode="width"
                  onPointerDown={startTextResize}
                  onPointerMove={onTextResizeMove}
                  onPointerUp={stopTextResize}
                  onPointerLeave={stopTextResize}
                  onPointerCancel={stopTextResize}
                  style={{
                    position: "absolute",
                    top: previewTextY + previewTextHeight / 2 - 10,
                    left: previewTextX + previewTextWidth - 6,
                    width: 12,
                    height: 20,
                    border: "2px solid rgba(102, 126, 234, 0.95)",
                    background: "rgba(255,255,255,0.22)",
                    borderRadius: 2,
                    cursor: editorLocked ? "default" : "ew-resize",
                    touchAction: "none",
                    pointerEvents: editorLocked ? "none" : "auto",
                    zIndex: 4,
                  }}
                  title="拖拽调整正文宽度"
                />
                {[
                  { key: "nw", top: -7, left: -7, cursor: "nwse-resize" },
                  { key: "ne", top: -7, right: -7, cursor: "nesw-resize" },
                  { key: "sw", bottom: -7, left: -7, cursor: "nesw-resize" },
                  { key: "se", bottom: -7, right: -7, cursor: "nwse-resize" },
                ].map((handle) => (
                  <div
                    key={handle.key}
                    onPointerDown={startTextResize}
                    onPointerMove={onTextResizeMove}
                    onPointerUp={stopTextResize}
                    onPointerLeave={stopTextResize}
                    onPointerCancel={stopTextResize}
                    style={{
                      position: "absolute",
                      top: handle.top,
                      left: handle.left,
                      right: handle.right,
                      bottom: handle.bottom,
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(102, 126, 234, 0.95)",
                      background: "rgba(255,255,255,0.22)",
                      borderRadius: 2,
                      cursor: editorLocked ? "default" : handle.cursor,
                      touchAction: "none",
                      pointerEvents: editorLocked ? "none" : "auto",
                    }}
                    title="拖拽调整正文框大小"
                  />
                ))}
              </div>
            </div>
          </Col>
        </Row>
      </Modal>

      {ot && (
        <Drawer
          title={`📖 ${ot.title}`}
          placement="right"
          width={640}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          <div style={{ color: "#888", fontSize: 13, marginBottom: 12 }}>
            {ot.author && <>作者：{ot.author}</>}
            {ot.source && <span style={{ marginLeft: 12 }}>来源：{ot.source}</span>}
            <span style={{ marginLeft: 12 }}>字数：{ot.wordCount || otFull.length}</span>
          </div>
          <Divider style={{ margin: "8px 0 12px" }} plain>完整原文</Divider>
          <div
            style={{
              fontSize: 15,
              lineHeight: 2.5,
              color: "#333",
              whiteSpace: "pre-wrap",
              maxHeight: "calc(100vh - 200px)",
              overflowY: "auto",
            }}
          >
            <PinyinText
              text={otFull}
              pinyinData={ot.pinyinData}
              showPinyin={showPinyin}
              fontSize={15}
              lineHeight={2.5}
            />
          </div>
        </Drawer>
      )}
    </Row>
  );
}
