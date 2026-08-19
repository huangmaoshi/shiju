import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Row, Col, Card, Tag, Input, Select, Pagination, Empty } from "antd";
import { quoteApi } from "@/api/quote";
import { categoryApi } from "@/api/category";
import type { Quote, Category, QuoteList } from "@/types";

export default function Quotes() {
  const [params] = useSearchParams();
  const [list, setList] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | undefined>(
    params.get("categoryId") ? Number(params.get("categoryId")) : undefined
  );
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    categoryApi.list().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    quoteApi
      .list({ page, pageSize, categoryId, keyword })
      .then((r: QuoteList) => {
        setList(r.list);
        setTotal(r.total);
      })
      .catch(() => {});
  }, [page, pageSize, categoryId, keyword]);

  const groups: Record<string, Category[]> = {};
  categories.forEach((c) => {
    groups[c.type] = groups[c.type] || [];
    groups[c.type].push(c);
  });

  const renderQuote = (q: Quote) => {
    const cats = Array.isArray(q.categories)
      ? q.categories.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean)
      : [];
    return (
      <Col key={q.id} xs={24} sm={12} lg={8}>
        <Link to={`/quotes/${q.id}`} style={{ textDecoration: "none" }}>
          <div className="quote-card" style={{ borderRadius: 12, padding: 20, height: "100%", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            <p style={{ fontSize: 15, lineHeight: 1.8, color: "#333", minHeight: 70 }}>"{q.content.length > 100 ? q.content.slice(0, 100) + "..." : q.content}"</p>
            <div style={{ color: "#888", fontSize: 13, marginBottom: 8 }}>
              —— {q.author || "佚名"} {q.source && `《${q.source}》`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {cats.slice(0, 3).map((n) => (
                <Tag key={n} color="purple" style={{ margin: 0 }}>{n}</Tag>
              ))}
            </div>
          </div>
        </Link>
      </Col>
    );
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Input.Search
              placeholder="搜索金句"
              onSearch={(v) => { setPage(1); setKeyword(v); }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              placeholder="选择分类"
              allowClear
              style={{ width: 180 }}
              value={categoryId}
              onChange={(v) => { setPage(1); setCategoryId(v); }}
              options={Object.keys(groups).flatMap((t) => [
                { label: `—— ${t} ——`, disabled: true, value: "" },
                ...groups[t].map((c) => ({ label: c.name, value: c.id })),
              ])}
            />
          </Col>
        </Row>
      </Card>

      {list.length === 0 ? (
        <Card><Empty /></Card>
      ) : (
        <>
          <Row gutter={[16, 16]}>{list.map(renderQuote)}</Row>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showTotal={(t) => `共 ${t} 条`}
              onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
            />
          </div>
        </>
      )}
    </div>
  );
}
