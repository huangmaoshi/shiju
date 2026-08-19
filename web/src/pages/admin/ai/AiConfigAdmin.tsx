import { useEffect, useState } from "react";
import {
  Card, Table, Button, Space, Tag, Modal, Form, Select, message,
  Popconfirm, Tabs, Input, Switch, InputNumber, Row, Col, Descriptions,
  List, Typography, Progress, Statistic, Divider,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined,
  ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined,
  CloseCircleOutlined, LoadingOutlined,
} from "@ant-design/icons";
import { aiApi, originalTextApi, adminApi } from "@/api";
import type { AiConfig, AiTask, OriginalText, Quote } from "@/types";

const { Text, Paragraph } = Typography;

const PROVIDERS = [
  { label: "OpenAI", value: "openai" },
  { label: "OpenAI 兼容", value: "compatible" },
  { label: "阿里云百炼 (qwen)", value: "aliyun-qwen" },
  { label: "百度千帆 (ernie)", value: "baidu-ernie" },
  { label: "智谱 AI", value: "zhipu" },
  { label: "DeepSeek", value: "deepseek" },
  { label: "月之暗面 (moonshot)", value: "moonshot" },
  { label: "火山方舟 (豆包 / Doubao)", value: "volcengine-ark" },
  { label: "本地/自建模型 (OpenAI 兼容)", value: "local" },
];

const PROVIDER_PRESETS: Record<string, { baseUrl: string; placeholder?: string; hint?: string }> = {
  openai:          { baseUrl: "https://api.openai.com/v1",          hint: "官方 OpenAI 接口" },
  compatible:      { baseUrl: "",                                    hint: "填写自己的 OpenAI 兼容端点" },
  "aliyun-qwen":   { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  "baidu-ernie":   { baseUrl: "https://qianfan.baidubce.com/v2" },
  zhipu:           { baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  deepseek:        { baseUrl: "https://api.deepseek.com/v1" },
  moonshot:        { baseUrl: "https://api.moonshot.cn/v1" },
  "volcengine-ark": {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    hint: "火山方舟 API，模型填写接入点 ID (ep-xxxxx) 或豆包模型名 (doubao-1-5-pro-32k-250115)",
  },
  local: {
    baseUrl: "http://localhost:8800/v1",
    hint: "本地或内网部署的 OpenAI 兼容服务（如 vLLM / Ollama / LM Studio），API Key 可留空",
  },
};

const ARK_MODELS = [
  { label: "doubao-1-5-pro-32k-250115（推荐 Pro）", value: "doubao-1-5-pro-32k-250115" },
  { label: "doubao-1-5-lite-32k-250115（推荐 Lite）", value: "doubao-1-5-lite-32k-250115" },
  { label: "doubao-pro-32k", value: "doubao-pro-32k" },
  { label: "doubao-pro-128k", value: "doubao-pro-128k" },
  { label: "doubao-lite-32k", value: "doubao-lite-32k" },
  { label: "doubao-lite-128k", value: "doubao-lite-128k" },
  { label: "豆包推理接入点（ep-xxxxx）", value: "ep-" },
];

const TASK_STATUS_MAP: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { color: "default", label: "等待中", icon: <LoadingOutlined /> },
  running: { color: "processing", label: "执行中", icon: <LoadingOutlined spin /> },
  success: { color: "success", label: "成功", icon: <CheckCircleOutlined /> },
  failed: { color: "error", label: "失败", icon: <CloseCircleOutlined /> },
};

export default function AiConfigAdmin() {
  return (
    <Card title="AI 智能功能管理">
      <Tabs
        defaultActiveKey="config"
        items={[
          { key: "config", label: "AI 大模型配置", children: <ConfigPanel /> },
          { key: "classify", label: "🏷️ AI 自动分类", children: <ClassifyPanel /> },
          { key: "oneclick", label: "🚀 一键批量处理", children: <OneClickPanel /> },
          { key: "extract", label: "AI 金句提取", children: <ExtractPanel /> },
          { key: "simplify", label: "AI 繁转简", children: <SimplifyPanel /> },
        ]}
      />
    </Card>
  );
}

function ConfigPanel() {
  const [list, setList] = useState<AiConfig[]>([]);
  const [editing, setEditing] = useState<AiConfig | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    aiApi.configList().then(setList).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setCurrentProvider(undefined);
    form.setFieldsValue({
      name: "", provider: undefined, apiKey: "", baseUrl: "",
      model: "", temperature: 0.7, maxTokens: 2000,
      promptTemplate: "请从以下{type}中提取 3-8 句最具金句潜质的句子，每句一行，只输出句子不要序号：\n\n{content}",
      pinyinPromptTemplate: "",
      simplifyPromptTemplate: "",
      classifyPromptTemplate: "",
      timeoutMs: 60000,
      retryCount: 2,
      batchConcurrency: 3,
      isDefault: false,
    });
    setModalOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      if (preset.baseUrl) {
        form.setFieldValue("baseUrl", preset.baseUrl);
      }
    }
  };

  const openEdit = (c: AiConfig) => {
    setEditing(c);
    form.setFieldsValue({ ...c, apiKey: "" });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    if (!v.apiKey) delete v.apiKey;
    if (editing) {
      await aiApi.configUpdate(editing.id, v);
      message.success("已更新");
    } else {
      await aiApi.configCreate(v);
      message.success("已创建");
    }
    setModalOpen(false);
    load();
  };

  const setDefault = async (id: number) => {
    await aiApi.configSetDefault(id);
    message.success("已设为默认");
    load();
  };

  const del = async (id: number) => {
    await aiApi.configDelete(id);
    message.success("已删除");
    load();
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "名称", dataIndex: "name", width: 160,
      render: (v: string, r: AiConfig) => (
        <Space>
          <Text strong>{v}</Text>
          {r.isDefault && <Tag color="gold">默认</Tag>}
        </Space>
      ),
    },
    {
      title: "服务商", dataIndex: "provider", width: 140,
      render: (v: string) => PROVIDERS.find((p) => p.value === v)?.label || v,
    },
    { title: "模型", dataIndex: "model", width: 140 },
    {
      title: "BaseURL", dataIndex: "baseUrl", width: 200,
      ellipsis: true, render: (v: string) => <Text copyable={{ text: v, tooltips: false }}>{v}</Text>,
    },
    {
      title: "是否默认", dataIndex: "isDefault", width: 100,
      render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    {
      title: "是否启用", dataIndex: "isActive", width: 100,
      render: (v: boolean) => v ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>,
    },
    {
      title: "操作", width: 200, fixed: "right" as const,
      render: (_: any, r: AiConfig) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          {!r.isDefault && (
            <Button size="small" onClick={() => setDefault(r.id)}>设为默认</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => del(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const [currentProvider, setCurrentProvider] = useState<string | undefined>();
  const providerPreset = currentProvider ? PROVIDER_PRESETS[currentProvider] : undefined;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建 AI 配置</Button>
        <Button icon={<ReloadOutlined />} onClick={load} style={{ marginLeft: 8 }} loading={loading}>刷新</Button>
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        size="middle"
        scroll={{ x: 1200 }}
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editing ? "编辑 AI 配置" : "新建 AI 配置"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setCurrentProvider(undefined); }}
        onOk={save}
        okText="保存"
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onValuesChange={(vals) => {
          if (vals.provider !== undefined) setCurrentProvider(vals.provider);
        }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="name" label="配置名称" rules={[{ required: true }]}>
                <Input placeholder="如：GPT-4o 主配置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="provider" label="服务商" rules={[{ required: true }]}>
                <Select
                  placeholder="选择服务商"
                  options={PROVIDERS}
                  onChange={handleProviderChange}
                />
              </Form.Item>
            </Col>
          </Row>
          {providerPreset?.hint && (
            <div style={{ margin: "-4px 0 12px", color: "#888", fontSize: 12 }}>{providerPreset.hint}</div>
          )}
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true }]}>
                <Input placeholder="https://api.openai.com/v1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="模型名" rules={[{ required: true }]}>
                {currentProvider === "volcengine-ark" ? (
                  <Select
                    showSearch
                    allowClear
                    placeholder="豆包模型名 或 ep-xxxxx 接入点"
                    options={ARK_MODELS}
                    filterOption={(inp, o) =>
                      (o?.label as string)?.toLowerCase().includes(inp.toLowerCase()) ||
                      (o?.value as string)?.toLowerCase().includes(inp.toLowerCase())
                    }
                    onSearch={(val) => {
                      if (val && !ARK_MODELS.find((m) => m.value === val)) {
                        form.setFieldValue("model", val);
                      }
                    }}
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <div style={{ padding: "6px 8px", borderTop: "1px solid #eee", fontSize: 12, color: "#888" }}>
                          也支持手动输入模型名或接入点 ID（ep-xxxxx）
                        </div>
                      </>
                    )}
                  />
                ) : (
                  <Input placeholder="gpt-4o-mini" />
                )}
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="apiKey"
            label="API Key"
            extra={editing ? "留空则不修改原 Key" : "请输入完整的 API Key"}
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="temperature" label="Temperature">
                <InputNumber min={0} max={2} step={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxTokens" label="Max Tokens">
                <InputNumber min={100} max={10000} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isDefault" label="设为默认" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="timeoutMs" label="超时时间(ms)">
                <InputNumber min={5000} max={300000} step={5000} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="retryCount" label="重试次数">
                <InputNumber min={0} max={10} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="batchConcurrency" label="最大并发数">
                <InputNumber min={1} max={20} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="promptTemplate" label="金句提取 Prompt 模板" extra="可用占位符：{type}（分类）、{content}（原文）">
            <Input.TextArea rows={3} placeholder="请从以下文本中提取金句..." />
          </Form.Item>
          <Form.Item name="pinyinPromptTemplate" label="拼音生成 Prompt 模板" extra="留空使用默认模板。可用占位符：{content}（原文）">
            <Input.TextArea rows={3} placeholder="留空则使用默认模板" />
          </Form.Item>
          <Form.Item name="simplifyPromptTemplate" label="繁转简 Prompt 模板" extra="留空使用默认模板。可用占位符：{content}（原文）">
            <Input.TextArea rows={3} placeholder="留空则使用默认模板" />
          </Form.Item>
          <Form.Item name="classifyPromptTemplate" label="AI 分类 Prompt 模板" extra="留空使用默认模板。可用占位符：{categories}（分类列表）、{content}（待分类内容）">
            <Input.TextArea rows={3} placeholder="留空则使用默认模板" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function ExtractPanel() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [texts, setTexts] = useState<OriginalText[]>([]);
  const [tasks, setTasks] = useState<AiTask[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingTexts, setLoadingTexts] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [singleTextId, setSingleTextId] = useState<number | undefined>();
  const [batchTextIds, setBatchTextIds] = useState<number[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<number | undefined>();
  const [viewResult, setViewResult] = useState<AiTask | null>(null);

  const loadConfigs = () => {
    setLoadingConfigs(true);
    aiApi.configList().then(setConfigs).finally(() => setLoadingConfigs(false));
  };

  const loadTexts = () => {
    setLoadingTexts(true);
    originalTextApi.list({ pageSize: 200 }).then((r) => setTexts(r.list)).finally(() => setLoadingTexts(false));
  };

  const loadTasks = () => {
    aiApi.taskList().then(setTasks);
  };

  useEffect(() => { loadConfigs(); loadTexts(); loadTasks(); }, []);

  const getDefaultConfig = () => {
    return configs.find((c) => c.isDefault)?.id;
  };

  useEffect(() => {
    if (!selectedConfig && configs.length > 0) {
      setSelectedConfig(getDefaultConfig() ?? configs[0].id);
    }
  }, [configs]);

  const doExtractSingle = async () => {
    if (!singleTextId) { message.warning("请选择原文"); return; }
    if (!selectedConfig) { message.warning("请选择 AI 配置"); return; }
    setExtracting(true);
    try {
      await aiApi.extractSingle({ originalTextId: singleTextId, configId: selectedConfig });
      message.success("已提交提取任务");
      loadTasks();
    } finally {
      setExtracting(false);
    }
  };

  const doExtractBatch = async () => {
    if (batchTextIds.length === 0) { message.warning("请至少选择一篇原文"); return; }
    if (!selectedConfig) { message.warning("请选择 AI 配置"); return; }
    setExtracting(true);
    try {
      await aiApi.extractBatch({ originalTextIds: batchTextIds, configId: selectedConfig });
      message.success(`已提交 ${batchTextIds.length} 篇批量提取任务`);
      setBatchTextIds([]);
      loadTasks();
    } finally {
      setExtracting(false);
    }
  };

  const taskColumns = [
    {
      title: "状态", dataIndex: "status", width: 100,
      render: (v: string) => {
        const s = TASK_STATUS_MAP[v] || { color: "default", label: v, icon: null };
        return <Tag color={s.color} icon={s.icon}>{s.label}</Tag>;
      },
    },
    {
      title: "总数 / 成功 / 失败", width: 200,
      render: (_: any, r: AiTask) => (
        <Space size={4}>
          <Text>{r.totalCount}</Text>
          <Text type="secondary">/</Text>
          <Text style={{ color: "#3f8600" }}>{r.successCount}</Text>
          <Text type="secondary">/</Text>
          <Text style={{ color: "#cf1322" }}>{r.failedCount}</Text>
        </Space>
      ),
    },
    {
      title: "开始时间", dataIndex: "startedAt", width: 180,
      render: (v?: string) => v ? new Date(v).toLocaleString() : "-",
    },
    {
      title: "耗时", width: 100,
      render: (_: any, r: AiTask) => r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : "-",
    },
    {
      title: "错误信息", dataIndex: "errorMessage", width: 200, ellipsis: true,
      render: (v?: string) => v ? <Text type="danger">{v}</Text> : "-",
    },
    {
      title: "进度", width: 140,
      render: (_: any, r: AiTask) => r.totalCount > 0 ? (
        <Progress
          percent={Math.round(((r.successCount + r.failedCount) / r.totalCount) * 100)}
          size="small"
          status={r.status === "failed" ? "exception" : r.status === "success" ? "success" : "active"}
        />
      ) : "-",
    },
    {
      title: "操作", width: 120, fixed: "right" as const,
      render: (_: any, r: AiTask) => (
        <Button size="small" type="link" onClick={() => setViewResult(r)}>查看结果</Button>
      ),
    },
  ];

  const resultTexts = texts.length > 0
    ? texts.reduce<Record<number, OriginalText>>((m, t) => { m[t.id] = t; return m; }, {})
    : {};

  return (
    <div>
      <Card type="inner" title="单篇提取" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>选择原文</div>
            <Select
              placeholder={loadingTexts ? "加载中..." : "选择一篇原文"}
              style={{ width: "100%" }}
              showSearch
              filterOption={(inp, o) => (o?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              value={singleTextId}
              onChange={setSingleTextId}
              loading={loadingTexts}
              options={texts.map((t) => ({
                label: `${t.title}（${t.wordCount}字，${t.quoteCount}条金句）`,
                value: t.id,
              }))}
            />
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>AI 配置</div>
            <Select
              placeholder={loadingConfigs ? "加载中..." : "选择 AI 配置"}
              style={{ width: "100%" }}
              value={selectedConfig}
              onChange={setSelectedConfig}
              loading={loadingConfigs}
              options={configs.map((c) => ({
                label: `${c.name}${c.isDefault ? "（默认）" : ""}`,
                value: c.id,
              }))}
            />
          </Col>
          <Col span={8}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>&nbsp;</div>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={doExtractSingle} loading={extracting}>
              开始提取
            </Button>
          </Col>
        </Row>
      </Card>

      <Card type="inner" title={`批量提取（已选 ${batchTextIds.length} 篇）`} style={{ marginBottom: 16 }}>
        <Row gutter={16} align="top">
          <Col span={12}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>多选原文</div>
            <Select
              mode="multiple"
              placeholder={loadingTexts ? "加载中..." : "选择多篇原文，支持搜索"}
              style={{ width: "100%" }}
              showSearch
              filterOption={(inp, o) => (o?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              value={batchTextIds}
              onChange={setBatchTextIds}
              loading={loadingTexts}
              options={texts.map((t) => ({
                label: `${t.title}（${t.wordCount}字）`,
                value: t.id,
              }))}
              notFoundContent={loadingTexts ? "加载中..." : undefined}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>AI 配置</div>
            <Select
              placeholder={loadingConfigs ? "加载中..." : "选择 AI 配置"}
              style={{ width: "100%" }}
              value={selectedConfig}
              onChange={setSelectedConfig}
              loading={loadingConfigs}
              options={configs.map((c) => ({
                label: `${c.name}${c.isDefault ? "（默认）" : ""}`,
                value: c.id,
              }))}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>&nbsp;</div>
            <Button
              type="primary"
              danger
              icon={<ThunderboltOutlined />}
              onClick={doExtractBatch}
              loading={extracting}
              disabled={batchTextIds.length === 0}
            >
              批量提取
            </Button>
          </Col>
        </Row>
      </Card>

      <Card
        type="inner"
        title="任务日志"
        extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>}
      >
        <Table
          columns={taskColumns}
          dataSource={tasks}
          rowKey="id"
          size="middle"
          scroll={{ x: 900 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title="提取任务结果"
        open={!!viewResult}
        onCancel={() => setViewResult(null)}
        footer={null}
        width={640}
        destroyOnClose
      >
        {viewResult && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="任务 ID">{viewResult.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={TASK_STATUS_MAP[viewResult.status]?.color}>{TASK_STATUS_MAP[viewResult.status]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总数">{viewResult.totalCount}</Descriptions.Item>
              <Descriptions.Item label="成功 / 失败">{viewResult.successCount} / {viewResult.failedCount}</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {viewResult.startedAt ? new Date(viewResult.startedAt).toLocaleString() : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {viewResult.durationMs ? `${(viewResult.durationMs / 1000).toFixed(1)}s` : "-"}
              </Descriptions.Item>
            </Descriptions>

            {viewResult.errorMessage && (
              <Paragraph type="danger" style={{ marginBottom: 16 }}>
                错误：{viewResult.errorMessage}
              </Paragraph>
            )}

            <div style={{ fontWeight: 500, marginBottom: 8 }}>提取明细：</div>
            <List
              size="small"
              bordered
              dataSource={viewResult.results || []}
              locale={{ emptyText: "暂无明细数据" }}
              renderItem={(r) => {
                const t = resultTexts[r.originalTextId];
                return (
                  <List.Item>
                    <Space>
                      {r.success
                        ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
                        : <CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
                      <Text>{t ? t.title : `原文 #${r.originalTextId}`}</Text>
                      <Tag color="blue">+{r.quoteCount} 条</Tag>
                    </Space>
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function SimplifyPanel() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [texts, setTexts] = useState<OriginalText[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingTexts, setLoadingTexts] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<number | undefined>();
  const [simplifying, setSimplifying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [singleTextId, setSingleTextId] = useState<number | undefined>();
  const [batchTextIds, setBatchTextIds] = useState<number[]>([]);
  const [manualText, setManualText] = useState("");
  const [manualResult, setManualResult] = useState("");

  const loadConfigs = () => {
    setLoadingConfigs(true);
    aiApi.configList().then(setConfigs).finally(() => setLoadingConfigs(false));
  };

  const loadTexts = () => {
    setLoadingTexts(true);
    originalTextApi.list({ pageSize: 500 }).then((r) => setTexts(r.list)).finally(() => setLoadingTexts(false));
  };

  useEffect(() => { loadConfigs(); loadTexts(); }, []);

  useEffect(() => {
    if (!selectedConfig && configs.length > 0) {
      setSelectedConfig(configs.find((c) => c.isDefault)?.id ?? configs[0].id);
    }
  }, [configs]);

  const doManualSimplify = async () => {
    if (!manualText.trim()) { message.warning("请输入要转换的文本"); return; }
    setSimplifying(true);
    setManualResult("");
    try {
      const result: any = await aiApi.simplifyText({ text: manualText, configId: selectedConfig });
      setManualResult(result?.simplifiedText || "");
      message.success("转换完成");
    } catch (e: any) {
      message.error(e?.message || "转换失败");
    } finally {
      setSimplifying(false);
    }
  };

  const doSingleSimplify = async () => {
    if (!singleTextId) { message.warning("请选择原文"); return; }
    setSimplifying(true);
    try {
      await aiApi.simplifyOriginalTextSingle({ originalTextId: singleTextId, configId: selectedConfig });
      message.success("转换完成");
    } catch (e: any) {
      message.error(e?.message || "转换失败");
    } finally {
      setSimplifying(false);
    }
  };

  const doBatchSimplify = async () => {
    if (batchTextIds.length === 0) { message.warning("请至少选择一篇原文"); return; }
    setSimplifying(true);
    setProgress({ current: 0, total: batchTextIds.length });
    try {
      const result: any = await aiApi.simplifyOriginalTextsBatch({ originalTextIds: batchTextIds, configId: selectedConfig });
      message.success(`批量转换完成：成功 ${result?.success || 0} 条，失败 ${result?.failed || 0} 条`);
      setBatchTextIds([]);
    } catch (e: any) {
      message.error(e?.message || "批量转换失败");
    } finally {
      setSimplifying(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div>
      <Card type="inner" title="繁转简 - 手动输入" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>AI 配置</div>
            <Select
              placeholder={loadingConfigs ? "加载中..." : "选择 AI 配置"}
              style={{ width: "100%", marginBottom: 12 }}
              value={selectedConfig}
              onChange={setSelectedConfig}
              loading={loadingConfigs}
              options={configs.map((c) => ({
                label: `${c.name}${c.isDefault ? "（默认）" : ""}`,
                value: c.id,
              }))}
            />
            <Input.TextArea
              rows={6}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="在此输入繁体字文本，或粘贴内容..."
              showCount
              maxLength={5000}
            />
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              style={{ marginTop: 12 }}
              onClick={doManualSimplify}
              loading={simplifying}
              disabled={!manualText.trim()}
            >
              转换为简体
            </Button>
          </Col>
          <Col span={12}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>转换结果</div>
            <Input.TextArea
              rows={6}
              value={manualResult}
              placeholder="转换后的简体字会显示在这里..."
              readOnly
            />
            {manualResult && (
              <Button
                style={{ marginTop: 12 }}
                onClick={() => { navigator.clipboard.writeText(manualResult); message.success("已复制到剪贴板"); }}
              >
                复制结果
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Card type="inner" title="繁转简 - 单篇原文" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={10}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>选择原文</div>
            <Select
              placeholder={loadingTexts ? "加载中..." : "选择一篇原文"}
              style={{ width: "100%" }}
              showSearch
              filterOption={(inp, o) => (o?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              value={singleTextId}
              onChange={setSingleTextId}
              loading={loadingTexts}
              options={texts.map((t) => ({
                label: `${t.title}（${t.wordCount}字）`,
                value: t.id,
              }))}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>&nbsp;</div>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={doSingleSimplify}
              loading={simplifying}
              disabled={!singleTextId}
            >
              转换为简体
            </Button>
          </Col>
        </Row>
      </Card>

      <Card type="inner" title={`繁转简 - 批量原文（已选 ${batchTextIds.length} 篇）`} style={{ marginBottom: 16 }}>
        <Row gutter={16} align="top">
          <Col span={12}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>多选原文</div>
            <Select
              mode="multiple"
              placeholder={loadingTexts ? "加载中..." : "选择多篇原文，支持搜索"}
              style={{ width: "100%" }}
              showSearch
              filterOption={(inp, o) => (o?.label as string)?.toLowerCase().includes(inp.toLowerCase())}
              value={batchTextIds}
              onChange={setBatchTextIds}
              loading={loadingTexts}
              options={texts.map((t) => ({
                label: `${t.title}（${t.wordCount}字）`,
                value: t.id,
              }))}
              notFoundContent={loadingTexts ? "加载中..." : undefined}
            />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 8, color: "#666", fontSize: 13 }}>&nbsp;</div>
            <Button
              type="primary"
              danger
              icon={<ThunderboltOutlined />}
              onClick={doBatchSimplify}
              loading={simplifying}
              disabled={batchTextIds.length === 0}
            >
              批量转换
            </Button>
            {progress.total > 0 && (
              <Progress
                percent={Math.round((progress.current / progress.total) * 100)}
                size="small"
                style={{ marginTop: 8 }}
                format={() => `${progress.current}/${progress.total}`}
              />
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );
}

interface OneClickStatsData {
  quotesWithoutPinyin: number;
  originalTextsWithoutPinyin: number;
  originalTextsWithoutQuotes: number;
  quotesWithTraditional: number;
  originalTextsWithTraditional: number;
}

function OneClickPanel() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<number | undefined>();
  const [stats, setStats] = useState<OneClickStatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [busy, setBusy] = useState<{ pinyin?: boolean; extract?: boolean; simplify?: boolean }>({});
  const [log, setLog] = useState<string[]>([]);

  const loadConfigs = () => {
    setLoadingConfigs(true);
    aiApi.configList().then(setConfigs).finally(() => setLoadingConfigs(false));
  };

  const loadStats = () => {
    setLoadingStats(true);
    aiApi.oneClickStats().then(setStats as any).finally(() => setLoadingStats(false));
  };

  useEffect(() => { loadConfigs(); loadStats(); }, []);

  useEffect(() => {
    if (!selectedConfig && configs.length > 0) {
      setSelectedConfig(configs.find((c) => c.isDefault)?.id ?? configs[0].id);
    }
  }, [configs]);

  const appendLog = (lines: string | string[]) => {
    const arr = Array.isArray(lines) ? lines : [lines];
    setLog((prev) => [...arr, ...prev].slice(0, 50));
  };

  const ts = () => new Date().toLocaleTimeString();

  const doPinyin = async () => {
    if (!selectedConfig) { message.warning("请选择 AI 配置"); return; }
    setBusy((b) => ({ ...b, pinyin: true }));
    appendLog(`[${ts()}] 🚀 开始一键拼音处理...`);
    try {
      const result: any = await aiApi.oneClickPinyin({ configId: selectedConfig });
      const q = result.quotes || {};
      const o = result.originalTexts || {};
      appendLog([
        `[${ts()}] ✅ 拼音处理完成`,
        `   金句：成功 ${q.success || 0} / 失败 ${q.failed || 0} / 共 ${q.total || 0}`,
        `   原文：成功 ${o.success || 0} / 失败 ${o.failed || 0} / 共 ${o.total || 0}`,
      ]);
      if ((q.errors || []).length) appendLog(`   ⚠️ 金句错误：${(q.errors || []).join('; ')}`);
      if ((o.errors || []).length) appendLog(`   ⚠️ 原文错误：${(o.errors || []).join('; ')}`);
      message.success("一键拼音完成");
      loadStats();
    } catch (e: any) {
      appendLog(`[${ts()}] ❌ 失败：${e?.message || '未知错误'}`);
      message.error(e?.message || "一键拼音失败");
    } finally {
      setBusy((b) => ({ ...b, pinyin: false }));
    }
  };

  const doExtract = async () => {
    if (!selectedConfig) { message.warning("请选择 AI 配置"); return; }
    setBusy((b) => ({ ...b, extract: true }));
    appendLog(`[${ts()}] 🚀 开始一键金句提取（会创建后台任务串行处理）...`);
    try {
      const result: any = await aiApi.oneClickExtract({ configId: selectedConfig });
      if (result?.skipped) {
        appendLog(`[${ts()}] ℹ️ 没有需要提取的原文`);
        message.info("没有需要提取的原文");
      } else {
        appendLog([
          `[${ts()}] ✅ 已加入提取队列，任务 ID #${result?.taskId}`,
          `   共 ${result?.total || 0} 篇原文；请在「AI 金句提取」Tab 查看进度`,
        ]);
        message.success(`已创建提取任务（${result?.total || 0} 篇原文），请在任务日志查看进度`);
      }
      loadStats();
    } catch (e: any) {
      appendLog(`[${ts()}] ❌ 失败：${e?.message || '未知错误'}`);
      message.error(e?.message || "一键提取失败");
    } finally {
      setBusy((b) => ({ ...b, extract: false }));
    }
  };

  const doSimplifyLocal = async () => {
    setBusy((b) => ({ ...b, simplify: true }));
    appendLog(`[${ts()}] 🚀 开始一键繁转简（本地纯JS处理，无需AI，极快）...`);
    try {
      const result: any = await aiApi.oneClickSimplifyLocal({});
      const q = result.quotes || {};
      const o = result.originalTexts || {};
      appendLog([
        `[${ts()}] ✅ 繁转简处理完成（本地映射）`,
        `   金句：成功 ${q.success || 0} / 失败 ${q.failed || 0}`,
        `   原文：成功 ${o.success || 0} / 失败 ${o.failed || 0}`,
      ]);
      if ((q.errors || []).length) appendLog(`   ⚠️ 金句错误：${(q.errors || []).join('; ')}`);
      if ((o.errors || []).length) appendLog(`   ⚠️ 原文错误：${(o.errors || []).join('; ')}`);
      message.success("一键繁转简完成");
      loadStats();
    } catch (e: any) {
      appendLog(`[${ts()}] ❌ 失败：${e?.message || '未知错误'}`);
      message.error(e?.message || "一键繁转简失败");
    } finally {
      setBusy((b) => ({ ...b, simplify: false }));
    }
  };

  return (
    <div>
      <Card type="inner" title="处理统计" extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadStats} loading={loadingStats}>刷新</Button>} style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small" style={{ background: "#fff7e6" }}>
              <Statistic
                title="金句未加拼音"
                value={stats?.quotesWithoutPinyin ?? 0}
                loading={loadingStats}
                valueStyle={{ color: "#d48806" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: "#fff7e6" }}>
              <Statistic
                title="原文未加拼音"
                value={stats?.originalTextsWithoutPinyin ?? 0}
                loading={loadingStats}
                valueStyle={{ color: "#d48806" }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ background: "#e6f7ff" }}>
              <Statistic
                title="原文未提取金句"
                value={stats?.originalTextsWithoutQuotes ?? 0}
                loading={loadingStats}
                valueStyle={{ color: "#096dd9" }}
              />
            </Card>
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Card size="small" style={{ background: "#f6ffed" }}>
              <Statistic
                title="金句含繁体字"
                value={stats?.quotesWithTraditional ?? 0}
                loading={loadingStats}
                valueStyle={{ color: "#389e0d" }}
              />
            </Card>
          </Col>
          <Col span={12} style={{ marginTop: 16 }}>
            <Card size="small" style={{ background: "#f6ffed" }}>
              <Statistic
                title="原文含繁体字"
                value={stats?.originalTextsWithTraditional ?? 0}
                loading={loadingStats}
                valueStyle={{ color: "#389e0d" }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card type="inner" title="AI 配置选择" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={10}>
            <Select
              placeholder={loadingConfigs ? "加载中..." : "选择 AI 配置（拼音/提取用）"}
              style={{ width: "100%" }}
              value={selectedConfig}
              onChange={setSelectedConfig}
              loading={loadingConfigs}
              options={configs.map((c) => ({
                label: `${c.name}${c.isDefault ? "（默认）" : ""}`,
                value: c.id,
              }))}
            />
          </Col>
          <Col span={14}>
            <Text type="secondary">繁转简无需 AI 配置，直接使用本地字符映射处理，速度极快且无需 Key。</Text>
          </Col>
        </Row>
      </Card>

      <Card type="inner" title="一键操作" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={doPinyin}
              loading={busy.pinyin}
              disabled={!selectedConfig || ((stats?.quotesWithoutPinyin || 0) + (stats?.originalTextsWithoutPinyin || 0)) === 0}
            >
              ① 一键生成所有缺失拼音（{((stats?.quotesWithoutPinyin || 0) + (stats?.originalTextsWithoutPinyin || 0)).toLocaleString()} 条）
            </Button>
            <Paragraph style={{ margin: "6px 0 0", color: "#888", fontSize: 12 }}>
              逐个调用 AI 标注拼音，串行处理防止限流；数量大时请耐心等待。
            </Paragraph>
          </div>

          <Divider style={{ margin: 0 }} />

          <div>
            <Button
              type="primary"
              size="large"
              danger
              icon={<ThunderboltOutlined />}
              onClick={doExtract}
              loading={busy.extract}
              disabled={!selectedConfig || (stats?.originalTextsWithoutQuotes || 0) === 0}
            >
              ② 一键提取「零金句」原文（{(stats?.originalTextsWithoutQuotes || 0).toLocaleString()} 篇）
            </Button>
            <Paragraph style={{ margin: "6px 0 0", color: "#888", fontSize: 12 }}>
              创建后台提取任务，串行逐篇处理。可在「AI 金句提取」Tab 查看任务进度和结果。
            </Paragraph>
          </div>

          <Divider style={{ margin: 0 }} />

          <div>
            <Button
              type="primary"
              size="large"
              style={{ background: "#389e0d", borderColor: "#389e0d" }}
              icon={<ThunderboltOutlined />}
              onClick={doSimplifyLocal}
              loading={busy.simplify}
              disabled={((stats?.quotesWithTraditional || 0) + (stats?.originalTextsWithTraditional || 0)) === 0}
            >
              ③ 一键繁转简（本地映射，无需AI，约 {((stats?.quotesWithTraditional || 0) + (stats?.originalTextsWithTraditional || 0)).toLocaleString()} 条）
            </Button>
            <Paragraph style={{ margin: "6px 0 0", color: "#888", fontSize: 12 }}>
              使用本地常用繁简对照表逐字转换，不调用 AI、速度极快、零成本；结果写入 <code>simplifiedContent</code> 字段。
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card
        type="inner"
        title="执行日志（最新 50 条）"
        extra={<Button size="small" onClick={() => setLog([])}>清空</Button>}
      >
        {log.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>暂无日志；点击上面的按钮开始执行处理。</Text>
        ) : (
          <div style={{ fontFamily: "Consolas, Menlo, monospace", fontSize: 12, lineHeight: 1.8, maxHeight: 280, overflow: "auto" }}>
            {log.map((line, i) => (
              <div key={i} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ====== AI 自动分类面板 ======
function ClassifyPanel() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [texts, setTexts] = useState<OriginalText[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<number | undefined>();
  const [selectedTextIds, setSelectedTextIds] = useState<number[]>([]);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<number[]>([]);
  const [stats, setStats] = useState<{ quotesUnclassified: number; originalTextsUnclassified: number } | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<string[]>([]);

  const loadConfigs = () => {
    aiApi.configList().then((r: any) => {
      const arr = Array.isArray(r) ? r : [];
      setConfigs(arr);
      const def = arr.find((c: AiConfig) => c.isDefault);
      if (def) setSelectedConfig(def.id);
    });
  };

  const loadTexts = () => {
    originalTextApi.list({ pageSize: 100 }).then((r: any) => {
      const data = r?.list || r?.data || [];
      setTexts(Array.isArray(data) ? data : []);
    });
  };

  const loadQuotes = () => {
    adminApi.quotes({ pageSize: 100 }).then((r: any) => {
      const data = r?.list || r?.data || [];
      setQuotes(Array.isArray(data) ? data : []);
    });
  };

  const loadStats = () => {
    aiApi.oneClickClassifyStats().then((r: any) => setStats(r));
  };

  useEffect(() => {
    loadConfigs();
    loadTexts();
    loadQuotes();
    loadStats();
  }, []);

  const addLog = (line: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog((prev) => [`[${ts}] ${line}`, ...prev].slice(0, 50));
  };

  const doClassifyQuote = async (quoteId: number) => {
    setBusy({ ...busy, singleQuote: true });
    try {
      addLog(`开始分类金句 #${quoteId}...`);
      const r: any = await aiApi.classifyQuoteSingle({ quoteId, configId: selectedConfig });
      addLog(`✅ 金句 #${quoteId} 分类完成: ${JSON.stringify(r.categoryIds)}`);
      message.success(`金句 #${quoteId} 分类完成`);
    } catch (e: any) {
      addLog(`❌ 金句 #${quoteId} 分类失败: ${e.message}`);
      message.error(e.message);
    } finally {
      setBusy({ ...busy, singleQuote: false });
    }
  };

  const doClassifyQuoteBatch = async () => {
    if (selectedQuoteIds.length === 0) {
      message.warning("请先选择金句");
      return;
    }
    setBusy({ ...busy, quoteBatch: true });
    try {
      addLog(`开始批量分类 ${selectedQuoteIds.length} 条金句...`);
      const r: any = await aiApi.classifyQuoteBatch({ quoteIds: selectedQuoteIds, configId: selectedConfig });
      addLog(`✅ 金句批量分类完成: 成功 ${r.success}/${r.total}, 失败 ${r.failed}`);
      message.success(`分类完成: 成功 ${r.success}/${r.total}`);
      loadStats();
    } catch (e: any) {
      addLog(`❌ 金句批量分类失败: ${e.message}`);
      message.error(e.message);
    } finally {
      setBusy({ ...busy, quoteBatch: false });
    }
  };

  const doClassifyText = async (originalTextId: number) => {
    setBusy({ ...busy, singleText: true });
    try {
      addLog(`开始分类原文 #${originalTextId}...`);
      const r: any = await aiApi.classifyOriginalTextSingle({ originalTextId, configId: selectedConfig });
      addLog(`✅ 原文 #${originalTextId} 分类完成: ${JSON.stringify(r.categoryIds)}`);
      message.success(`原文 #${originalTextId} 分类完成`);
    } catch (e: any) {
      addLog(`❌ 原文 #${originalTextId} 分类失败: ${e.message}`);
      message.error(e.message);
    } finally {
      setBusy({ ...busy, singleText: false });
    }
  };

  const doClassifyTextBatch = async () => {
    if (selectedTextIds.length === 0) {
      message.warning("请先选择原文");
      return;
    }
    setBusy({ ...busy, textBatch: true });
    try {
      addLog(`开始批量分类 ${selectedTextIds.length} 篇原文...`);
      const r: any = await aiApi.classifyOriginalTextBatch({ originalTextIds: selectedTextIds, configId: selectedConfig });
      addLog(`✅ 原文批量分类完成: 成功 ${r.success}/${r.total}, 失败 ${r.failed}`);
      message.success(`分类完成: 成功 ${r.success}/${r.total}`);
      loadStats();
    } catch (e: any) {
      addLog(`❌ 原文批量分类失败: ${e.message}`);
      message.error(e.message);
    } finally {
      setBusy({ ...busy, textBatch: false });
    }
  };

  const doOneClickClassify = async () => {
    const total = (stats?.quotesUnclassified || 0) + (stats?.originalTextsUnclassified || 0);
    if (total === 0) {
      message.info("没有需要分类的内容");
      return;
    }
    setBusy({ ...busy, oneClick: true });
    try {
      addLog(`开始一键分类（金句 ${stats?.quotesUnclassified || 0} + 原文 ${stats?.originalTextsUnclassified || 0}）...`);
      const r: any = await aiApi.oneClickClassify({ configId: selectedConfig });
      addLog(`✅ 一键分类完成: 金句 ${r.quotes.success}/${r.quotes.total}, 原文 ${r.originalTexts.success}/${r.originalTexts.total}`);
      message.success("一键分类完成");
      loadStats();
    } catch (e: any) {
      addLog(`❌ 一键分类失败: ${e.message}`);
      message.error(e.message);
    } finally {
      setBusy({ ...busy, oneClick: false });
    }
  };

  const quoteColumns = [
    {
      title: "ID", dataIndex: "id", width: 60,
      render: (id: number) => <Text strong>{id}</Text>,
    },
    {
      title: "内容", dataIndex: "content",
      render: (t: string) => <Text ellipsis style={{ maxWidth: 300 }}>{t}</Text>,
    },
    {
      title: "作者", dataIndex: "author", width: 100,
      render: (t?: string) => t || "-",
    },
    {
      title: "操作", width: 100,
      render: (_: any, record: Quote) => (
        <Button
          size="small"
          type="link"
          icon={<RobotOutlined />}
          loading={busy.singleQuote}
          onClick={() => doClassifyQuote(record.id)}
        >
          分类
        </Button>
      ),
    },
  ];

  const textColumns = [
    {
      title: "ID", dataIndex: "id", width: 60,
      render: (id: number) => <Text strong>{id}</Text>,
    },
    {
      title: "标题", dataIndex: "title",
      render: (t: string) => <Text ellipsis style={{ maxWidth: 200 }}>{t}</Text>,
    },
    {
      title: "作者", dataIndex: "author", width: 100,
      render: (t?: string) => t || "-",
    },
    {
      title: "操作", width: 100,
      render: (_: any, record: OriginalText) => (
        <Button
          size="small"
          type="link"
          icon={<RobotOutlined />}
          loading={busy.singleText}
          onClick={() => doClassifyText(record.id)}
        >
          分类
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card type="inner" title="AI 配置">
        <Space>
          <Select
            style={{ width: 300 }}
            placeholder="选择 AI 配置（留空使用默认）"
            allowClear
            value={selectedConfig}
            onChange={setSelectedConfig}
            options={configs.map((c) => ({ label: `${c.name}${c.isDefault ? " (默认)" : ""}`, value: c.id }))}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { loadConfigs(); loadStats(); }}>刷新</Button>
        </Space>
      </Card>

      <Card type="inner" title="📊 分类统计">
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="未分类金句"
              value={stats?.quotesUnclassified || 0}
              valueStyle={{ color: (stats?.quotesUnclassified || 0) > 0 ? "#fa8c16" : "#52c41a" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="未分类原文"
              value={stats?.originalTextsUnclassified || 0}
              valueStyle={{ color: (stats?.originalTextsUnclassified || 0) > 0 ? "#fa8c16" : "#52c41a" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="合计待分类"
              value={(stats?.quotesUnclassified || 0) + (stats?.originalTextsUnclassified || 0)}
            />
          </Col>
        </Row>
      </Card>

      <Card
        type="inner"
        title="🚀 一键分类"
        extra={<Button icon={<ReloadOutlined />} onClick={loadStats}>刷新统计</Button>}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltOutlined />}
              onClick={doOneClickClassify}
              loading={busy.oneClick}
              disabled={!selectedConfig || ((stats?.quotesUnclassified || 0) + (stats?.originalTextsUnclassified || 0)) === 0}
            >
              一键分类所有未分类内容（{((stats?.quotesUnclassified || 0) + (stats?.originalTextsUnclassified || 0)).toLocaleString()} 条）
            </Button>
            <Paragraph style={{ margin: "6px 0 0", color: "#888", fontSize: 12 }}>
              自动筛选所有没有分类的金句和原文，逐个调用 AI 从现有分类列表中选择最合适的分类（1-5个），串行处理。
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card type="inner" title="金句批量分类">
        <Space style={{ marginBottom: 8 }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={doClassifyQuoteBatch}
            loading={busy.quoteBatch}
            disabled={selectedQuoteIds.length === 0}
          >
            批量分类（{selectedQuoteIds.length} 条）
          </Button>
        </Space>
        <Table
          rowSelection={{
            selectedRowKeys: selectedQuoteIds,
            onChange: (keys) => setSelectedQuoteIds(keys as number[]),
          }}
          columns={quoteColumns}
          dataSource={quotes}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card type="inner" title="原文批量分类">
        <Space style={{ marginBottom: 8 }}>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={doClassifyTextBatch}
            loading={busy.textBatch}
            disabled={selectedTextIds.length === 0}
          >
            批量分类（{selectedTextIds.length} 篇）
          </Button>
        </Space>
        <Table
          rowSelection={{
            selectedRowKeys: selectedTextIds,
            onChange: (keys) => setSelectedTextIds(keys as number[]),
          }}
          columns={textColumns}
          dataSource={texts}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Card type="inner" title="执行日志" extra={<Button size="small" onClick={() => setLog([])}>清空</Button>}>
        {log.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>暂无日志</Text>
        ) : (
          <div style={{ fontFamily: "Consolas, Menlo, monospace", fontSize: 12, lineHeight: 1.8, maxHeight: 280, overflow: "auto" }}>
            {log.map((line, i) => (
              <div key={i} style={{ whiteSpace: "pre-wrap" }}>{line}</div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
