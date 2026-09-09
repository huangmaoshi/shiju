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
const PREVIEW_SCALE = PREVIEW_WIDTH / EXPORT_WIDTH;

const defaultExportSettings = (template?: any) => ({
  bgType: template?.bgType || "color",
  bgValue: template?.bgValue || "#ffffff",
  fontFamily: template?.fontFamily || "PingFang SC",
  fontSize: template?.fontSize || 32,
  fontColor: template?.fontColor || "#1f2937",
  lineHeight: template?.lineHeight || 1.8,
  textAlign: template?.textAlign || "center",
  textX: template?.textX ?? 40,
  textY: template?.textY ?? 210,
  textWidth: template?.textWidth ?? DEFAULT_TEXT_WIDTH,
  showAuthor: template?.showAuthor !== 0,
  showWatermark: template?.showWatermark !== 0,
});

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
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({
    active: false,
    offsetX: 0,
    offsetY: 0,
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

      const words = paragraph.split(/(\s+)/).filter((word) => word.length > 0);
      let line = "";

      words.forEach((word) => {
        const test = line + word;
        if (ctx.measureText(test).width <= maxWidth || line.length === 0) {
          line = test;
        } else {
          lines.push(line.trimEnd());
          line = word;
        }
      });

      if (line) {
        lines.push(line.trimEnd());
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
    const maxWidth = Math.max(120, Math.min(textWidth, canvas.width - textX * 2));

    ctx.textBaseline = "top";
    ctx.fillStyle = settings.fontColor || "#1f2937";
    ctx.font = `600 ${settings.fontSize || 32}px ${settings.fontFamily || "PingFang SC"}`;

    const lines = buildTextLines(quote.content || "", settings);
    const lineHeight = (settings.fontSize || 32) * (settings.lineHeight || 1.8);

    const align = settings.textAlign === "left" ? "left" : settings.textAlign === "right" ? "right" : "center";

    lines.forEach((line, index) => {
      const y = textY + index * lineHeight;
      const x = align === "left" ? textX : align === "right" ? textX + maxWidth : textX + maxWidth / 2;
      ctx.textAlign = align;
      ctx.fillText(line, x, y);
    });

    const contentBottom = textY + lines.length * lineHeight + 80;
    if (settings.showAuthor) {
      ctx.font = `500 28px ${settings.fontFamily || "PingFang SC"}`;
      ctx.fillStyle = "rgba(31, 41, 55, 0.85)";
      ctx.textAlign = align;
      const authorText = `—— ${quote.author || "佚名"}${quote.source ? ` 《${quote.source}》` : ""}`;
      ctx.fillText(authorText, align === "left" ? textX : align === "right" ? textX + maxWidth : textX + maxWidth / 2, contentBottom);
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

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const currentPreviewX = Math.round((exportSettings.textX ?? 40) * PREVIEW_SCALE);
    const currentPreviewY = Math.round((exportSettings.textY ?? 210) * PREVIEW_SCALE);

    dragStateRef.current = {
      active: true,
      offsetX: event.clientX - currentPreviewX,
      offsetY: event.clientY - currentPreviewY,
    };
  };

  const onPreviewPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;

    event.preventDefault();
    const nextPreviewX = Math.max(12, Math.min(PREVIEW_WIDTH - 30, event.clientX - dragStateRef.current.offsetX));
    const nextPreviewY = Math.max(12, Math.min(PREVIEW_HEIGHT - 60, event.clientY - dragStateRef.current.offsetY));

    setExportSettings((prev: any) => ({
      ...prev,
      textX: Math.round(nextPreviewX / PREVIEW_SCALE),
      textY: Math.round(nextPreviewY / PREVIEW_SCALE),
    }));
  };

  const stopDrag = (event?: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current.active = false;
    event?.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const ot = quote?.originalText;
  const SHOW_LIMIT = 500;
  const otFull = ot?.content || "";
  const otPreview = otFull.length > SHOW_LIMIT ? otFull.slice(0, SHOW_LIMIT) : otFull;
  const previewLines = quote ? buildTextLines(quote.content || "", exportSettings) : [];
  const previewTextX = Math.round((exportSettings.textX ?? 40) * PREVIEW_SCALE);
  const previewTextY = Math.round((exportSettings.textY ?? 210) * PREVIEW_SCALE);
  const previewTextWidth = Math.round((exportSettings.textWidth ?? DEFAULT_TEXT_WIDTH) * PREVIEW_SCALE);
  const previewFontSize = Math.round((exportSettings.fontSize || 32) * PREVIEW_SCALE);
  const previewLineHeight = Math.round(((exportSettings.fontSize || 32) * (exportSettings.lineHeight || 1.8)) * PREVIEW_SCALE);

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
          <Col span={12}>
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
                <div style={{ fontWeight: 600, marginBottom: 6 }}>文字宽度</div>
                <Input
                  value={exportSettings.textWidth}
                  onChange={(e) =>
                    setExportSettings((prev: any) => ({ ...prev, textWidth: Number(e.target.value) || DEFAULT_TEXT_WIDTH }))
                  }
                />
              </div>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>字体大小</div>
                <Input
                  value={exportSettings.fontSize}
                  onChange={(e) =>
                    setExportSettings((prev: any) => ({ ...prev, fontSize: Number(e.target.value) || 32 }))
                  }
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <Button onClick={() => setExportOpen(false)}>取消</Button>
                <Button type="primary" loading={exportLoading} onClick={handleExportCard}>
                  导出 PNG
                </Button>
              </div>
            </div>
          </Col>

          <Col span={12}>
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
                background:
                  exportSettings.bgType === "image" && exportSettings.bgValue
                    ? `url(${exportSettings.bgValue}) center/cover no-repeat`
                    : exportSettings.bgValue || "#ffffff",
                boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
                cursor: "move",
                touchAction: "none",
              }}
              onPointerDown={startDrag}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={stopDrag}
              onPointerLeave={stopDrag}
              onPointerCancel={stopDrag}
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
                  left: previewTextX,
                  top: previewTextY,
                  width: previewTextWidth,
                  color: exportSettings.fontColor || "#1f2937",
                }}
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
                {exportSettings.showAuthor && (
                  <div
                    style={{
                      marginTop: Math.round(24 * PREVIEW_SCALE),
                      fontSize: Math.round(16 * PREVIEW_SCALE),
                      opacity: 0.85,
                      textAlign: exportSettings.textAlign || "center",
                    }}
                  >
                    —— {quote.author || "佚名"}
                  </div>
                )}
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
