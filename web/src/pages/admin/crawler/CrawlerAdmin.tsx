import { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Tabs,
  Row,
  Col,
  Statistic,
  message,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
} from "antd";
import {
  PlayCircleOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { adminApi } from "@/api";

const { Text } = Typography;

function validateCron(expr: string): string | undefined {
  if (!expr) return "Cron 表达式不能为空";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Cron 表达式必须为 5 段（分 时 日 月 周）";
  const re = /^(\*|(\d+(-\d+)?|\d+\/\d+)(,\d+(-\d+)?|\d+\/\d+)*)$/;
  const ranges: [number, number][] = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 7],
  ];
  for (let i = 0; i < 5; i++) {
    const part = parts[i];
    if (!re.test(part)) return `第 ${i + 1} 段「${part}」格式不合法`;
    if (part === "*") continue;
    const tokens = part.split(",");
    for (const tok of tokens) {
      const r = tok.split("-");
      const lo = Number(r[0]);
      const hi = r.length > 1 ? Number(r[1]) : lo;
      const [min, max] = ranges[i];
      if (isNaN(lo) || isNaN(hi) || lo < min || hi > max) {
        return `第 ${i + 1} 段值超出范围 ${min}-${max}`;
      }
    }
  }
  return undefined;
}

function SchedulePanel() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [sch, src] = await Promise.all([
        adminApi.crawlSchedule(),
        adminApi.crawlSources(),
      ]);
      setSchedules(Array.isArray(sch) ? sch : []);
      setSources(Array.isArray(src) ? src : []);
    } catch (e: any) {
      message.error(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      sourceId: undefined,
      cronExpr: "0 3 * * *",
      concurrency: 2,
      pagesPerRun: 20,
      enabled: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    form.setFieldsValue({
      sourceId: row.sourceId,
      cronExpr: row.cronExpr,
      concurrency: row.concurrency ?? 2,
      pagesPerRun: row.pagesPerRun ?? 20,
      enabled: !!row.enabled,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    const payload = {
      sourceId: Number(v.sourceId),
      cronExpr: v.cronExpr.trim(),
      concurrency: Number(v.concurrency),
      pagesPerRun: Number(v.pagesPerRun),
      enabled: v.enabled ? 1 : 0,
    };
    try {
      if (editing) {
        await adminApi.crawlScheduleUpdate(editing.id, payload);
        message.success("已更新");
      } else {
        await adminApi.crawlScheduleCreate(payload);
        message.success("已创建");
      }
      setModalOpen(false);
      loadAll();
    } catch (e: any) {
      message.error(e?.message || "保存失败");
    }
  };

  const remove = async (id: number) => {
    try {
      await adminApi.crawlScheduleDelete(id);
      message.success("已删除");
      loadAll();
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  const toggleEnable = async (row: any) => {
    try {
      if (row.enabled) {
        await adminApi.crawlScheduleDisable(row.id);
        message.success("已停用");
      } else {
        await adminApi.crawlScheduleEnable(row.id);
        message.success("已启用");
      }
      loadAll();
    } catch (e: any) {
      message.error(e?.message || "操作失败");
    }
  };

  const triggerRun = async (row: any) => {
    try {
      await adminApi.crawlScheduleTrigger(row.id);
      message.success("已触发，稍后在采集任务日志查看结果");
    } catch (e: any) {
      message.error(e?.message || "触发失败");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "采集源",
      dataIndex: "sourceId",
      width: 180,
      render: (id: number) => {
        const s = sourceMap.get(id);
        return s ? <Tag color="blue">{s.name}</Tag> : <span style={{ color: "#999" }}>未知 (ID={id})</span>;
      },
    },
    {
      title: "Cron 表达式",
      dataIndex: "cronExpr",
      width: 160,
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: "启用",
      dataIndex: "enabled",
      width: 100,
      render: (v: number | boolean, r: any) => (
        <Switch
          checked={!!v}
          onChange={() => toggleEnable(r)}
          checkedChildren={<CheckCircleOutlined />}
          unCheckedChildren={<CloseCircleOutlined />}
        />
      ),
    },
    { title: "并发", dataIndex: "concurrency", width: 80 },
    { title: "每次页数", dataIndex: "pagesPerRun", width: 100 },
    {
      title: "上次执行",
      dataIndex: "lastRunAt",
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString() : "-"),
    },
    {
      title: "上次结果",
      dataIndex: "lastRunStatus",
      width: 110,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          success: { color: "green", text: "成功" },
          failed: { color: "red", text: "失败" },
          running: { color: "blue", text: "运行中" },
        };
        if (!v) return <Tag>未执行</Tag>;
        const s = map[v] || { color: "default", text: v };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "上次条数",
      dataIndex: "lastRunCount",
      width: 100,
      render: (v: number) => (v ?? 0) > 0 ? v : "-",
    },
    {
      title: "下次执行",
      dataIndex: "nextRunAt",
      width: 170,
      render: (v: string) =>
        v ? (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: "#1890ff" }} />
            {new Date(v).toLocaleString()}
          </Space>
        ) : (
          <span style={{ color: "#999" }}>-</span>
        ),
    },
    {
      title: "操作",
      width: 230,
      fixed: "right" as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" type="primary" icon={<ThunderboltOutlined />} onClick={() => triggerRun(r)}>立即执行</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除此定时任务？" onConfirm={() => remove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title="定时采集调度"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建定时任务</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={schedules}
        loading={loading}
        scroll={{ x: 1500 }}
        pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条定时任务` }}
      />
      <Modal
        title={editing ? "编辑定时任务" : "新建定时任务"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="保存"
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="sourceId"
            label="采集源"
            rules={[{ required: true, message: "请选择采集源" }]}
          >
            <Select
              placeholder="选择采集源"
              options={sources.map((s) => ({
                label: `${s.name} (${s.code})`,
                value: s.id,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item
            name="cronExpr"
            label="Cron 表达式（5 段：分 时 日 月 周）"
            rules={[
              { required: true, message: "请输入 Cron 表达式" },
              {
                validator: (_, v) => {
                  const err = validateCron(v);
                  if (err) return Promise.reject(new Error(err));
                  return Promise.resolve();
                },
              },
            ]}
            extra={
              <span style={{ fontSize: 12, color: "#999" }}>
                示例：<code>0 3 * * *</code>（每天凌晨 3 点）、<code>0 */6 * * *</code>（每 6 小时）、<code>30 2 * * 1</code>（每周一凌晨 2:30）
              </span>
            }
          >
            <Input placeholder="如：0 3 * * *" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="concurrency" label="并发数" rules={[{ required: true }]}>
                <InputNumber min={1} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pagesPerRun" label="每次页数" rules={[{ required: true }]}>
                <InputNumber min={1} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

const COMPLIANCE_COLORS: Record<string, { color: string; label: string }> = {
  public_domain: { color: "green", label: "公有领域" },
  mit: { color: "blue", label: "MIT 许可" },
  apache: { color: "geekblue", label: "Apache 许可" },
  cc0: { color: "cyan", label: "CC0 公共领域" },
  cc_by_sa: { color: "purple", label: "CC BY-SA" },
  web_crawl: { color: "orange", label: "网页爬取" },
  other: { color: "default", label: "其他/未标注" },
};

const TYPE_COLORS: Record<string, { color: string; label: string }> = {
  github: { color: "blue", label: "GitHub直导入" },
  api: { color: "purple", label: "API接口" },
  static: { color: "default", label: "静态页面" },
  dynamic: { color: "orange", label: "动态页面" },
};

const DATASET_TYPE_LABELS: Record<string, string> = {
  poetry: "古诗词",
  prose: "散文名著",
  quote: "名人名言",
  lyric: "歌词",
  script: "影视台词",
};

export default function CrawlerAdmin() {
  const [sources, setSources] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sourcePageSize, setSourcePageSize] = useState(15);
  const [taskPageSize, setTaskPageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [src, st, tk] = await Promise.all<any>([
        adminApi.crawlSources(),
        adminApi.crawlSourceStats(),
        adminApi.crawlTasks(),
      ]);
      setSources(src || []);
      setStats(st || {});
      setTasks(Array.isArray(tk) ? tk : (tk?.list || []));
    } catch {
      message.warning("部分数据加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const runImport = async (source: any) => {
    setLoading(true);
    try {
      await adminApi.crawlImport(source.id);
      message.success(`已触发「${source.name}」导入`);
      setTimeout(loadAll, 2000);
    } catch {
      message.error("触发失败");
    } finally {
      setLoading(false);
    }
  };

  const runSource = async (source: any) => {
    setLoading(true);
    try {
      await adminApi.runCrawler({ sourceId: source.id, provider: source.code });
      message.success(`已触发「${source.name}」采集`);
      setTimeout(loadAll, 2000);
    } catch {
      message.error("触发失败");
    } finally {
      setLoading(false);
    }
  };

  const getComplianceTag = (tag: string) => {
    const cfg = COMPLIANCE_COLORS[tag] || { color: "default", label: tag || "-" };
    return (
      <Tag color={cfg.color} icon={tag === "public_domain" ? <SafetyCertificateOutlined /> : undefined}>
        {cfg.label}
      </Tag>
    );
  };

  const getTypeTag = (type: string) => {
    const cfg = TYPE_COLORS[type] || { color: "default", label: type || "-" };
    return <Tag color={cfg.color}>{cfg.label}</Tag>;
  };

  const publicDomainSources = sources.filter((s) => s.complianceTag === "public_domain");

  const StatCards = () => (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={4}><Card><Statistic title="采集源总数" value={stats?.total || sources.length} suffix="个" /></Card></Col>
      <Col span={4}><Card><Statistic title="GitHub直导入" value={stats?.githubCount || 0} suffix="个" valueStyle={{ color: "#1890ff" }} /></Card></Col>
      <Col span={4}><Card><Statistic title="公有领域" value={stats?.publicDomainCount || 0} suffix="个" valueStyle={{ color: "#52c41a" }} /></Card></Col>
      <Col span={4}><Card><Statistic title="开源许可" value={(stats?.mitCount || 0) + (stats?.cc0Count || 0) + (stats?.apacheCount || 0) + (stats?.ccBySaCount || 0)} suffix="个" valueStyle={{ color: "#1890ff" }} /></Card></Col>
      <Col span={4}><Card><Statistic title="未标注" value={Math.max(0, (stats?.total || sources.length) - (stats?.publicDomainCount || 0) - (stats?.mitCount || 0) - (stats?.cc0Count || 0) - (stats?.apacheCount || 0) - (stats?.ccBySaCount || 0))} suffix="个" /></Card></Col>
      <Col span={4}><Card><Statistic title="运行中/等待" value={(stats?.runningCrawl || 0) + (stats?.pendingCrawl || 0)} suffix="任务" valueStyle={{ color: "#fa8c16" }} /></Card></Col>
    </Row>
  );

  const allSourceColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "名称", dataIndex: "name", width: 220, render: (v: string) => <strong>{v}</strong> },
    { title: "Code", dataIndex: "code", width: 180, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: "完整源 URL",
      dataIndex: "baseUrl",
      width: 260,
      render: (v: string) => (
        <Text
          copyable={v ? { text: v } : false}
          style={{
            display: "inline-block",
            maxWidth: 240,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
          }}
          title={v || undefined}
        >
          {v || "-"}
        </Text>
      ),
    },
    { title: "类型", dataIndex: "type", width: 110, render: getTypeTag },
    { title: "数据集", dataIndex: "datasetType", width: 90, render: (v: string) => DATASET_TYPE_LABELS[v] || v || "-" },
    { title: "合规标签", dataIndex: "complianceTag", width: 110, render: getComplianceTag },
    { title: "协议", dataIndex: "protocol", width: 110, render: (v: string) => (v ? <Tag color="gold">{v}</Tag> : "-") },
    { title: "数据量", dataIndex: "datasetSize", width: 100, render: (v: number) => (v ? `${(v / 10000).toFixed(1)}万条` : "-") },
    { title: "需翻译", dataIndex: "needTranslate", width: 80, render: (v: boolean) => (v ? <Tag color="volcano">是</Tag> : "-") },
    { title: "优先级", dataIndex: "priority", width: 80 },
    {
      title: "操作", width: 200, fixed: "right" as const,
      render: (_: any, r: any) => (
        <Space size="small">
          {r.type === "github" ? (
            <Button size="small" type="primary" icon={<CloudDownloadOutlined />} onClick={() => runImport(r)}>导入</Button>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => runSource(r)}>采集</Button>
          )}
        </Space>
      ),
    },
  ];

  const PublicDomainView = () => (
    <Row gutter={[16, 16]}>
      {publicDomainSources.length === 0 ? (
        <Col span={24}><Text type="secondary">暂无公版数据源</Text></Col>
      ) : (
        publicDomainSources.map((src) => (
          <Col span={12} key={src.id}>
            <Card
              size="small"
              title={<Space><SafetyCertificateOutlined style={{ color: "#52c41a" }} /><strong>{src.name}</strong></Space>}
              extra={<Button size="small" type="primary" icon={<CloudDownloadOutlined />} onClick={() => runImport(src)}>一键导入</Button>}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                <div>
                  <Text type="secondary">类型：</Text>{getTypeTag(src.type)}
                  <Text type="secondary" style={{ marginLeft: 8 }}>数据集：</Text>{DATASET_TYPE_LABELS[src.datasetType] || src.datasetType}
                </div>
                <div>
                  <Text type="secondary">完整源 URL：</Text>
                  <Text copyable={src.baseUrl ? { text: src.baseUrl } : false} style={{ wordBreak: "break-all" }}>
                    {src.baseUrl || "-"}
                  </Text>
                </div>
                <div>
                  <Text type="secondary">协议：</Text><Tag color="green">{src.protocol || "PD"}</Tag>
                  {src.datasetSize && (
                    <>
                      <Text type="secondary" style={{ marginLeft: 8 }}>数据量：</Text>
                      <Tag color="blue">{(src.datasetSize / 10000).toFixed(1)} 万条</Tag>
                    </>
                  )}
                </div>
                {src.remark && <div><Text type="secondary">说明：</Text><Text>{src.remark}</Text></div>}
              </Space>
            </Card>
          </Col>
        ))
      )}
    </Row>
  );

  const taskColumns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "采集源", dataIndex: "provider", width: 160 },
    {
      title: "状态", dataIndex: "status", width: 100, render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          success: { color: "green", text: "成功" },
          running: { color: "blue", text: "运行中" },
          failed: { color: "red", text: "失败" },
          pending: { color: "default", text: "等待中" },
        };
        const s = map[v] || map.pending;
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: "总数", dataIndex: "totalCount", width: 80 },
    { title: "新增", dataIndex: "newCount", width: 80, render: (v: number) => <span style={{ color: v > 0 ? "#52c41a" : "#999" }}>+{v}</span> },
    { title: "开始时间", dataIndex: "startAt", width: 180, render: (v: string) => (v ? new Date(v).toLocaleString() : "-") },
    { title: "结束时间", dataIndex: "endAt", width: 180, render: (v: string) => (v ? new Date(v).toLocaleString() : "-") },
  ];

  return (
    <div>
      <StatCards />

      <Tabs
        defaultActiveKey="sources"
        size="middle"
        style={{ width: "100%" }}
        items={[
          {
            key: "sources",
            label: `采集源列表（${sources.length}）`,
            children: (
              <Card size="small" extra={<Button icon={<ReloadOutlined />} onClick={loadAll}>刷新</Button>}>
                <Table
                  columns={allSourceColumns}
                  dataSource={sources}
                  rowKey="id"
                  size="small"
                  scroll={{ x: 1500 }}
                  loading={loading}
                  pagination={{
                    pageSize: sourcePageSize,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 个采集源`,
                    onShowSizeChange: (_current, size) => setSourcePageSize(size),
                  }}
                />
              </Card>
            ),
          },
          {
            key: "public_domain",
            label: `🟢 合规数据源（${publicDomainSources.length}）`,
            children: (
              <Card size="small" title="合规数据源快捷面板" style={{ background: "#f6ffed" }}>
                <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                  所有已配置合规来源的采集源都可以正常导入，不受著作权保护期限制。合规标签仅用于来源追溯和统计。
                </Text>
                <PublicDomainView />
              </Card>
            ),
          },
          {
            key: "tasks",
            label: `采集任务日志（${tasks.length}）`,
            children: (
              <Card size="small" extra={<Button icon={<ReloadOutlined />} onClick={loadAll}>刷新</Button>}>
                <Table
                  columns={taskColumns}
                  dataSource={tasks}
                  rowKey="id"
                  size="small"
                  loading={loading}
                  pagination={{
                    pageSize: taskPageSize,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条采集任务`,
                    onShowSizeChange: (_current, size) => setTaskPageSize(size),
                  }}
                />
              </Card>
            ),
          },
          {
            key: "scheduler",
            label: "⏰ 定时采集",
            children: <SchedulePanel />,
          },
        ]}
      />
    </div>
  );
}
