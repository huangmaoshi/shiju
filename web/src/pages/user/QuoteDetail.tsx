import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, Tag, Button, Spin, message, Divider, Row, Col, Drawer, Popover, Empty } from "antd";
import { StarOutlined, DownloadOutlined, CopyOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { quoteApi } from "@/api/quote";
import { collectionApi } from "@/api";
import type { Quote } from "@/types";
import PinyinText from "@/components/PinyinText";

export default function QuoteDetail() {
  const { id } = useParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPinyin, setShowPinyin] = useState(true);
  const [collectLoading, setCollectLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    quoteApi.detail(Number(id)).then(setQuote).finally(() => setLoading(false));
    collectionApi.list().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => {});
  }, [id]);

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

  // 一键加入默认摘抄本
  const onAddToDefault = async () => {
    if (!quote) return;
    setCollectLoading(true);
    try {
      await collectionApi.collectQuote(Number(quote.id));
      message.success("已加入摘抄本");
      // 刷新列表
      collectionApi.list().then((r: any) => setCollections(Array.isArray(r) ? r : [])).catch(() => {});
    } catch (e: any) {
      // 如果是"该句已在收藏夹中"仍提示成功
      if (e?.message?.includes("已在") || e?.message?.includes("400")) {
        message.info("该句已在摘抄本中");
      } else {
        message.error(e?.message || "加入失败");
      }
    } finally {
      setCollectLoading(false);
    }
  };

  // 加入指定摘抄本
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
              <span><FolderOpenOutlined /> {c.name}</span>
              <span style={{ color: "#aaa", fontSize: 12 }}>{c.quoteCount || 0} 条</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const ot = quote?.originalText;
  const SHOW_LIMIT = 500;
  const otFull = ot?.content || "";
  const otPreview = otFull.length > SHOW_LIMIT ? otFull.slice(0, SHOW_LIMIT) : otFull;

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
              title={
                <span>📖 原文节选</span>
              }
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
            <Button type="primary" icon={<StarOutlined />} loading={collectLoading} onClick={onAddToDefault}>加入摘抄本</Button>
            <Popover content={addToCollectionContent} title="加入指定摘抄本" trigger="click" placement="bottom">
              <Button icon={<FolderOpenOutlined />}>选择摘抄本</Button>
            </Popover>
            <Button icon={<CopyOutlined />} onClick={copy}>复制</Button>
            <Button icon={<DownloadOutlined />}>导出图片卡片</Button>
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
