import { Card, Empty, Progress, List } from "antd";

export default function Recite() {
  const todayPlan = [
    { content: "书籍是人类进步的阶梯", author: "高尔基", progress: 80 },
    { content: "时间就是金钱", author: "富兰克林", progress: 100 },
    { content: "知识就是力量", author: "培根", progress: 40 },
  ];

  return (
    <div>
      <Card title="📚 背诵计划" style={{ marginBottom: 16 }}>
        <p style={{ color: "#999", fontSize: 14 }}>今日待复习 3 条 · 已完成 2 条 · 连续打卡 7 天</p>
      </Card>
      <Card title="今日背诵">
        <List
          dataSource={todayPlan}
          renderItem={(q) => (
            <List.Item>
              <List.Item.Meta
                title={<span>"{q.content}"</span>}
                description={<span style={{ color: "#999" }}>—— {q.author}</span>}
              />
              <Progress type="circle" percent={q.progress} width={50} />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
