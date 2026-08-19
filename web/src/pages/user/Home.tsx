import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Button, Input, Tag, Statistic } from "antd";
import { SearchOutlined, ThunderboltOutlined, FireOutlined, StarOutlined } from "@ant-design/icons";
import { quoteApi } from "@/api/quote";
import { dailyApi, statsApi } from "@/api";
import { categoryApi } from "@/api/category";
import type { Quote, Category, DailyRecommend } from "@/types";

export default function Home() {
  const [random, setRandom] = useState<Quote[]>([]);
  const [daily, setDaily] = useState<Quote[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [keyword, setKeyword] = useState("");
  const [stats, setStats] = useState({ quoteTotal: 0, categoryTotal: 0, templateTotal: 0, dailyRecommendCount: 0 });

  useEffect(() => {
    quoteApi.random(5).then(setRandom).catch(() => {});
    dailyApi.today().then((d: DailyRecommend) => setDaily(d.quotes || [])).catch(() => {});
    categoryApi.list().then(setCategories).catch(() => {});
    statsApi.home().then(setStats).catch(() => {});
  }, []);

  const groups: Record<string, Category[]> = {};
  categories.forEach((c) => {
    groups[c.type] = groups[c.type] || [];
    groups[c.type].push(c);
  });
  const typeNames: Record<string, string> = {
    content_type: "📖 内容类型",
    theme: "🎨 主题",
    scene: "🎬 场景",
  };

  return (
    <div>
      <div
        className="bg-gradient-hero"
        style={{ borderRadius: 16, padding: "56px 40px", color: "#fff", marginBottom: 32 }}
      >
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>📖 拾句</h1>
        <p style={{ fontSize: 18, opacity: 0.9, marginBottom: 24 }}>
          作文素材与金句摘抄库 · 为你的文字增添光彩
        </p>
        <Input.Search
          size="large"
          placeholder="搜索金句，如 生命、勤奋、梦想..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={(v) => (window.location.href = `/search?q=${encodeURIComponent(v)}`)}
          style={{ maxWidth: 520 }}
          enterButton={<Button type="primary" size="large" icon={<SearchOutlined />}>搜索</Button>}
        />
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="金句总量" value={stats.quoteTotal} suffix={stats.quoteTotal >= 10000 ? "+" : ""} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="分类" value={stats.categoryTotal} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="作文模板" value={stats.templateTotal} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="每日精选" value={stats.dailyRecommendCount} suffix="条/天" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 24]}>
        <Col xs={24} lg={14}>
          <Card title={<span><FireOutlined /> 今日精选</span>} extra={<Link to="/search">更多</Link>}>
            {daily.length === 0 ? (
              <p style={{ color: "#999" }}>暂无每日推荐</p>
            ) : (
              daily.slice(0, 5).map((q) => (
                <div key={q.id} className="quote-card" style={{ padding: 16, borderRadius: 12, marginBottom: 12 }}>
                  <p style={{ fontSize: 16, lineHeight: 1.8, marginBottom: 8 }}>"{q.content}"</p>
                  <div style={{ color: "#888", fontSize: 13 }}>
                    —— {q.author || "佚名"} {q.source && `《${q.source}》`}
                  </div>
                </div>
              ))
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<span><ThunderboltOutlined /> 随机金句</span>} style={{ marginBottom: 16 }}>
            {random.map((q) => (
              <div key={q.id} className="quote-card" style={{ padding: 16, borderRadius: 12, marginBottom: 12 }}>
                <p style={{ fontSize: 15, lineHeight: 1.7 }}>"{q.content}"</p>
                <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                  —— {q.author || "佚名"} {q.source && `《${q.source}》`}
                </div>
              </div>
            ))}
          </Card>
          <Card title={<span><StarOutlined /> 浏览分类</span>}>
            {Object.keys(groups).map((t) => (
              <div key={t} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6 }}>{typeNames[t] || t}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {groups[t].map((c) => (
                    <Link key={c.id} to={`/quotes?categoryId=${c.id}`}>
                      <Tag color="purple" style={{ margin: 0, cursor: "pointer" }}>{c.name}</Tag>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
