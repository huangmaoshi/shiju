import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, Spin, Row, Col, Divider, Typography, Tag } from "antd";
import { originalTextApi } from "@/api";
import type { OriginalText } from "@/types";
import PinyinText from "@/components/PinyinText";

export default function OriginalTextDetail() {
  const { id } = useParams();
  const [ot, setOt] = useState<OriginalText | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPinyin, setShowPinyin] = useState(true);

  useEffect(() => {
    if (!id) return;
    originalTextApi.get(Number(id)).then(setOt).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spin style={{ display: "block", margin: "40px auto" }} />;
  if (!ot) return <Card><p>原文不存在</p></Card>;

  return (
    <Row gutter={16}>
      <Col xs={24} lg={16}>
        <Card style={{ borderRadius: 16, marginBottom: 16 }}>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            📖 {ot.title}
          </Typography.Title>
          {(ot.author || ot.source) && (
            <div style={{ color: "#888", fontSize: 14, marginBottom: 16 }}>
              {ot.author && <span>作者：{ot.author}</span>}
              {ot.source && <span style={{ marginLeft: 16 }}>来源：{ot.source}</span>}
              <span style={{ marginLeft: 16 }}>字数：{ot.wordCount || ot.content.length}</span>
            </div>
          )}
          <Divider style={{ margin: "8px 0 16px" }} plain>
            完整原文
            {ot.pinyinData && (
              <Tag
                style={{ cursor: "pointer", marginLeft: 8, fontSize: 12 }}
                color={showPinyin ? "blue" : "default"}
                onClick={() => setShowPinyin(!showPinyin)}
              >
                {showPinyin ? "拼音：开" : "拼音：关"}
              </Tag>
            )}
          </Divider>
          <div
            style={{
              fontSize: 16,
              lineHeight: 2.5,
              color: "#333",
              whiteSpace: "pre-wrap",
            }}
          >
            <PinyinText
              text={ot.content}
              pinyinData={ot.pinyinData}
              showPinyin={showPinyin}
              fontSize={16}
              lineHeight={2.5}
            />
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title={`💎 关联金句 (${ot.quotes?.length || 0})`}>
          {ot.quotes && ot.quotes.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {ot.quotes.map((q) => (
                <Link key={q.id} to={`/quotes/${q.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#fafbfc",
                      border: "1px solid #f0f0f0",
                      transition: "border-color .2s",
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#667eea")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "#f0f0f0")}
                  >
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: "#333", marginBottom: 6 }}>
                      "{q.content}"
                    </p>
                    <div style={{ color: "#999", fontSize: 12 }}>
                      —— {q.author || "佚名"} {q.source && `《${q.source}》`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: 13 }}>该原文暂无关联金句</p>
          )}
        </Card>
      </Col>
    </Row>
  );
}
