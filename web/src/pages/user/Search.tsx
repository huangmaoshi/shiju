import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, Input, Tag, Row, Col, Pagination, Empty, Tabs } from "antd";
import { quoteApi } from "@/api/quote";
import { searchApi } from "@/api";
import type { QuoteList } from "@/types";

function highlight(text: string, keyword: string) {
  if (!keyword || !text) return text;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fff3b0", color: "#d48806", padding: "0 2px", borderRadius: 2 }}>
        {text.slice(idx, idx + keyword.length)}
      </mark>
      {text.slice(idx + keyword.length)}
    </>
  );
}

export default function Search() {
  const [params] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") || "");
  const [tab, setTab] = useState("quote");

  const [quoteList, setQuoteList] = useState<any[]>([]);
  const [quoteTotal, setQuoteTotal] = useState(0);
  const [quotePage, setQuotePage] = useState(1);

  const [otList, setOtList] = useState<any[]>([]);
  const [otTotal, setOtTotal] = useState(0);
  const [otPage, setOtPage] = useState(1);

  const [hot, setHot] = useState<string[]>([]);

  useEffect(() => {
    searchApi.hot().then(setHot).catch(() => {});
  }, []);

  useEffect(() => {
    if (!keyword.trim()) { setQuoteList([]); setQuoteTotal(0); return; }
    quoteApi.list({ page: quotePage, pageSize: 12, keyword }).then((r: QuoteList) => {
      setQuoteList(r.list); setQuoteTotal(r.total);
    }).catch(() => {});
  }, [keyword, quotePage]);

  useEffect(() => {
    if (!keyword.trim()) { setOtList([]); setOtTotal(0); return; }
    searchApi.originalTextList(keyword, otPage, 12).then((r) => {
      setOtList(r.list); setOtTotal(r.total);
    }).catch(() => {});
  }, [keyword, otPage]);

  const onSearch = useCallback((v: string) => {
    setKeyword(v);
    setQuotePage(1);
    setOtPage(1);
  }, []);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 16px" }}>🔍 搜索金句</h2>
        <Input.Search
          size="large"
          placeholder="输入关键词"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={onSearch}
          allowClear
        />
        {hot.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <span style={{ color: "#999", marginRight: 8 }}>🔥 热门：</span>
            {hot.map((k) => (
              <Tag key={k} style={{ cursor: "pointer" }} onClick={() => onSearch(k)}>{k}</Tag>
            ))}
          </div>
        )}
      </Card>

      {keyword && (
        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k); }}
          items={[
            {
              key: "quote",
              label: `金句 (${quoteTotal})`,
              children:
                quoteList.length === 0 ? (
                  <Card><Empty description={`没有找到 "${keyword}" 相关的金句`} /></Card>
                ) : (
                  <>
                    <Row gutter={[16, 16]}>
                      {quoteList.map((q: any) => (
                        <Col key={q.id} xs={24} sm={12} lg={8}>
                          <Link to={`/quotes/${q.id}`} style={{ textDecoration: "none" }}>
                            <div className="quote-card" style={{ borderRadius: 12, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
                              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#333" }}>"{q.content}"</p>
                              <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
                                —— {q.author || "佚名"} {q.source && `《${q.source}》`}
                              </div>
                            </div>
                          </Link>
                        </Col>
                      ))}
                    </Row>
                    <div style={{ textAlign: "center", marginTop: 24 }}>
                      <Pagination current={quotePage} pageSize={12} total={quoteTotal} onChange={setQuotePage} showTotal={(t) => `共 ${t} 条`} />
                    </div>
                  </>
                ),
            },
            {
              key: "original",
              label: `原文 (${otTotal})`,
              children:
                otList.length === 0 ? (
                  <Card><Empty description={`没有找到 "${keyword}" 相关的原文`} /></Card>
                ) : (
                  <>
                    <Row gutter={[16, 16]}>
                      {otList.map((ot: any) => (
                        <Col key={ot.id} xs={24} sm={12} lg={8}>
                          <Card style={{ borderRadius: 12, height: "100%" }}>
                            <Link to={`/original-text/${ot.id}`} style={{ color: "#1890ff", fontSize: 16, fontWeight: 600, textDecoration: "none" }}>
                              {ot.title}
                            </Link>
                            {ot.author && (
                              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>作者：{ot.author}</div>
                            )}
                            {ot.matchedContent && (
                              <p style={{ color: "#555", fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
                                {highlight(ot.matchedContent, keyword)}
                              </p>
                            )}
                            <div style={{ color: "#aaa", fontSize: 12, marginTop: 8 }}>
                              字数：{ot.wordCount || "-"} · 金句：{ot.quoteCount || 0}
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                    <div style={{ textAlign: "center", marginTop: 24 }}>
                      <Pagination current={otPage} pageSize={12} total={otTotal} onChange={setOtPage} showTotal={(t) => `共 ${t} 条`} />
                    </div>
                  </>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}
