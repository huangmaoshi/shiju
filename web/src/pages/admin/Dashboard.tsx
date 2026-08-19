import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Tag } from "antd";
import {
  UserOutlined,
  FileTextOutlined,
  StarOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BugOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { adminApi } from "@/api";
import type { DashboardStats, CrawlerTask } from "@/types";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    adminApi.dashboard().then(setStats).catch(() => {
      // Mock 数据
      setStats({
        totalUsers: 1234,
        totalQuotes: 8156,
        totalCollections: 4321,
        todayNewUsers: 23,
        todayNewQuotes: 56,
        memberCount: 89,
        recentCrawlers: [
          { id: 1, provider: "guwenwen", status: "success", startAt: new Date().toISOString(), endAt: new Date().toISOString(), totalCount: 120, newCount: 34, createdAt: new Date().toISOString() },
          { id: 2, provider: "mingyan", status: "running", startAt: new Date().toISOString(), totalCount: 0, newCount: 0, createdAt: new Date().toISOString() },
          { id: 3, provider: "guwenwen", status: "failed", startAt: new Date(Date.now() - 3600000).toISOString(), totalCount: 0, newCount: 0, errorMessage: "网络超时", createdAt: new Date(Date.now() - 3600000).toISOString() },
        ],
      });
    });
  }, []);

  if (!stats) return null;

  const barOption = {
    title: { text: "近 7 日采集量", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {},
    xAxis: { type: "category", data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [45, 72, 38, 90, 56, 120, 85], itemStyle: { color: "#667eea" } }],
  };

  const pieOption = {
    title: { text: "会员等级分布", left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      radius: "60%",
      data: [
        { value: stats.totalUsers - stats.memberCount, name: "免费用户" },
        { value: stats.memberCount, name: "会员" },
      ],
      color: ["#ddd", "#667eea"],
    }],
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "采集源", dataIndex: "provider", render: (v: string) => v },
    {
      title: "状态",
      dataIndex: "status",
      render: (v: string) => {
        const map: Record<string, { color: string; icon: any; text: string }> = {
          success: { color: "green", icon: <CheckCircleOutlined />, text: "成功" },
          running: { color: "blue", icon: <ThunderboltOutlined />, text: "运行中" },
          failed: { color: "red", icon: <BugOutlined />, text: "失败" },
          pending: { color: "default", icon: <ClockCircleOutlined />, text: "等待中" },
        };
        const item = map[v] || map.pending;
        return <Tag color={item.color} icon={item.icon}>{item.text}</Tag>;
      },
    },
    { title: "总数", dataIndex: "totalCount" },
    { title: "新增", dataIndex: "newCount" },
    { title: "耗时", render: (_: any, r: CrawlerTask) => {
        if (!r.startAt || !r.endAt) return "-";
        return `${Math.round((new Date(r.endAt).getTime() - new Date(r.startAt).getTime()) / 1000)}s`;
    }},
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}><Card><Statistic title="用户总数" value={stats.totalUsers} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="金句总数" value={stats.totalQuotes} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="摘抄本" value={stats.totalCollections} prefix={<StarOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="会员数" value={stats.memberCount} prefix={<RiseOutlined />} valueStyle={{ color: "#764ba2" }} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}><Card><ReactECharts option={barOption} style={{ height: 280 }} /></Card></Col>
        <Col xs={24} lg={8}><Card><ReactECharts option={pieOption} style={{ height: 280 }} /></Card></Col>
      </Row>
      <Card title="最近采集任务" style={{ marginTop: 16 }}>
        <Table columns={columns} dataSource={stats.recentCrawlers || []} rowKey="id" size="middle" />
      </Card>
    </div>
  );
}
