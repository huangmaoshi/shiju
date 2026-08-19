import { useEffect, useRef, useState } from "react";
import {
  Card, Table, Button, Space, Input, Tag, Modal, Form, Select, message,
  Popconfirm, Drawer, Statistic, Row, Col, Typography, Divider, Tooltip,
} from "antd";
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, ScissorOutlined, ArrowLeftOutlined, HighlightOutlined,
} from "@ant-design/icons";
import { originalTextApi, aiApi, adminApi } from "@/api";
import type { OriginalText, Quote } from "@/types";
import PinyinText from "@/components/PinyinText";

const { Text, Paragraph } = Typography;

const CATEGORY_TYPES = [
  { label: "散文随笔", value: "essay" },
  { label: "小说节选", value: "novel" },
  { label: "诗歌", value: "poetry" },
  { label: "书信", value: "letter" },
  { label: "演讲", value: "speech" },
  { label: "传记", value: "biography" },
  { label: "杂文", value: "essay_critical" },
  { label: "其他", value: "other" },
];

const COMPLIANCE_TAGS = [
  { label: "已审核", value: "approved" },
  { label: "待审核", value: "pending" },
  { label: "敏感内容", value: "sensitive" },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  published: { color: "green", label: "已发布" },
  archived: { color: "orange", label: "已归档" },
};

const AUDIT_STATUS: Record<number, { color: string; label: string }> = {
  0: { color: "orange", label: "待审核" },
  1: { color: "green", label: "已通过" },
  2: { color: "red", label: "已拒绝" },
};

export default function OriginalTextAdmin() {
  const [list, setList] = useState<OriginalText[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [keyword, setKeyword] = useState("");
  const [categoryType, setCategoryType] = useState<string | undefined>();
  const [auditStatus, setAuditStatus] = useState<string | undefined>();
  const [stats, setStats] = useState({ totalTexts: 0, totalQuotes: 0, avgWords: 0 });

  const [editing, setEditing] = useState<OriginalText | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<OriginalText | null>(null);
  const [showPinyin, setShowPinyin] = useState(true);

  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteTarget, setQuoteTarget] = useState<OriginalText | null>(null);
  const [quoteContent, setQuoteContent] = useState("");

  // 选中提取金句浮气泡
  const [selectionBubble, setSelectionBubble] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({ visible: false, x: 0, y: 0, text: "" });
  const contentAreaRef = useRef<HTMLDivElement | null>(null);

  // 批量选择 + 拼音生成
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const load = () => {
    const params: any = { page, pageSize, keyword, categoryType };
    if (auditStatus !== undefined) params.auditStatus = auditStatus;
    originalTextApi.list(params).then((r) => {
      setList(r.list);
      setTotal(r.total);
      if (r.list.length > 0) {
        const totalWords = r.list.reduce((s, t) => s + (t.wordCount || 0), 0);
        const totalQuotes = r.list.reduce((s, t) => s + (t.quoteCount || 0), 0);
        setStats({
          totalTexts: r.total,
          totalQuotes,
          avgWords: Math.round(totalWords / r.list.length) || 0,
        });
      } else {
        setStats({ totalTexts: 0, totalQuotes: 0, avgWords: 0 });
      }
    });
  };

  useEffect(() => { load(); }, [page, pageSize, keyword, categoryType, auditStatus]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      title: "", author: "", source: "", sourceUrl: "",
      categoryType: undefined, content: "", complianceTag: "pending",
    });
    setModalOpen(true);
  };

  const openEdit = (t: OriginalText) => {
    setEditing(t);
    form.setFieldsValue(t);
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    if (editing) {
      await originalTextApi.update(editing.id, v);
      message.success("已更新");
    } else {
      await originalTextApi.create(v);
      message.success("已创建");
    }
    setModalOpen(false);
    load();
  };

  const del = async (id: number) => {
    await originalTextApi.remove(id);
    message.success("已删除");
    if (detailOpen && detailData?.id === id) {
      setDetailOpen(false);
      setDetailData(null);
    }
    load();
  };

  // AI 生成单条原文拼音
  const genPinyinSingle = async (id: number) => {
    setLoadingIds((prev) => new Set(prev).add(id));
    try {
      await aiApi.pinyinOriginalTextSingle({ originalTextId: id });
      message.success("拼音生成成功");
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "拼音生成失败");
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  // AI 批量生成原文拼音
  const genPinyinBatch = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请先勾选要生成拼音的原文");
      return;
    }
    setBatchLoading(true);
    try {
      const res: any = await aiApi.pinyinOriginalTextBatch({ originalTextIds: selectedRowKeys });
      message.success(`批量拼音完成：成功 ${res.data?.success || 0} 条，失败 ${res.data?.failed || 0} 条`);
      setSelectedRowKeys([]);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "批量拼音失败");
    } finally {
      setBatchLoading(false);
    }
  };

  // 批量审核通过
  const batchApprove = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请先勾选要审核的原文");
      return;
    }
    try {
      await adminApi.auditOriginalTexts(selectedRowKeys, 1);
      message.success(`已通过 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "审核失败");
    }
  };

  // 批量审核拒绝
  const batchReject = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请先勾选要审核的原文");
      return;
    }
    try {
      await adminApi.auditOriginalTexts(selectedRowKeys, 2);
      message.success(`已拒绝 ${selectedRowKeys.length} 条`);
      setSelectedRowKeys([]);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "审核失败");
    }
  };

  const openDetail = async (t: OriginalText) => {
    const full = await originalTextApi.get(t.id);
    setDetailData(full);
    setDetailOpen(true);
    setSelectionBubble({ visible: false, x: 0, y: 0, text: "" });
  };

  const openQuoteModal = (t: OriginalText, prefill?: string) => {
    setQuoteTarget(t);
    setQuoteContent(prefill || "");
    setQuoteModalOpen(true);
  };

  const addQuote = async () => {
    if (!quoteTarget || !quoteContent.trim()) {
      message.warning("请输入金句内容");
      return;
    }
    try {
      const result = await originalTextApi.addQuote(quoteTarget.id, quoteContent.trim());
      message.success("金句已添加 ✨");
      setQuoteModalOpen(false);
      setSelectionBubble({ visible: false, x: 0, y: 0, text: "" });
      if (detailOpen && detailData?.id === quoteTarget.id) {
        openDetail(detailData);
      }
      load();
      return result;
    } catch (err: any) {
      if (err?.response?.status === 409) {
        message.warning(err.response.data?.message || "该金句已存在");
      } else if (err?.response?.status === 400) {
        message.error(err.response.data?.message || "选段与原文不匹配");
      } else {
        message.error("添加失败，请重试");
      }
    }
  };

  // === 选段 → 气泡 ===
  const handleMouseUp = () => {
    if (!contentAreaRef.current || !detailOpen) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionBubble((b) => ({ ...b, visible: false }));
      return;
    }
    const text = sel.toString().trim();
    if (!text || text.length < 2) {
      setSelectionBubble((b) => ({ ...b, visible: false }));
      return;
    }

    // 选区必须发生在原文区域内
    const anchorNode = sel.anchorNode;
    if (!anchorNode || !contentAreaRef.current.contains(anchorNode)) {
      setSelectionBubble((b) => ({ ...b, visible: false }));
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = contentAreaRef.current.getBoundingClientRect();

    setSelectionBubble({
      visible: true,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 10,
      text,
    });
  };

  const dismissBubble = (e: React.MouseEvent) => {
    // 点击气泡本身时不关闭
    const target = e.target as HTMLElement;
    if (target.closest("[data-selection-bubble]")) return;
    // 如果当前已有非空选区，说明是拖动选中后的 mouseup→click，不要关闭
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length >= 2) return;
    setSelectionBubble({ visible: false, x: 0, y: 0, text: "" });
  };

  const extractFromSelection = () => {
    if (!detailData || !selectionBubble.text) return;
    setSelectionBubble({ visible: false, x: 0, y: 0, text: "" });
    openQuoteModal(detailData, selectionBubble.text);
  };

  // 详情抽屉关闭时清理选区
  useEffect(() => {
    if (!detailOpen) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      setSelectionBubble({ visible: false, x: 0, y: 0, text: "" });
    }
  }, [detailOpen]);

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "标题", dataIndex: "title", width: 200,
      render: (v: string) => (
        <Text strong>{v}</Text>
      ),
    },
    { title: "作者", dataIndex: "author", width: 100, render: (v?: string) => v || "-" },
    { title: "来源", dataIndex: "source", width: 120, render: (v?: string) => v || "-" },
    {
      title: "分类类型", dataIndex: "categoryType", width: 110,
      render: (v?: string) => {
        const found = CATEGORY_TYPES.find((c) => c.value === v);
        return found ? found.label : (v || "-");
      },
    },
    { title: "字数", dataIndex: "wordCount", width: 80, align: "right" as const },
    { title: "金句数", dataIndex: "quoteCount", width: 80, align: "right" as const },
    {
      title: "拼音", dataIndex: "pinyinData", width: 70,
      render: (v?: string) => v ? <Tag color="blue">已注</Tag> : <Tag>无</Tag>,
    },
    {
      title: "审核", dataIndex: "auditStatus", width: 90,
      render: (v?: number) => {
        const s = AUDIT_STATUS[v ?? 0] || { color: "default", label: "未知" };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "协议标签", dataIndex: "complianceTag", width: 100,
      render: (v?: string) => {
        const found = COMPLIANCE_TAGS.find((c) => c.value === v);
        const color = v === "approved" ? "green" : v === "sensitive" ? "red" : "orange";
        return found ? <Tag color={color}>{found.label}</Tag> : (v ? <Tag>{v}</Tag> : "-");
      },
    },
    {
      title: "状态", dataIndex: "status", width: 100,
      render: (v: string) => {
        const s = STATUS_MAP[v] || { color: "default", label: v };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "操作", width: 340, fixed: "right" as const,
      render: (_: any, r: OriginalText) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>详情</Button>
          <Button size="small" type="primary" ghost icon={<ScissorOutlined />} onClick={() => openQuoteModal(r)}>选段</Button>
          <Button size="small" loading={loadingIds.has(r.id)} onClick={() => genPinyinSingle(r.id)}>拼音</Button>
          <Popconfirm title="确认删除？关联金句将保留" onConfirm={() => del(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic title="原文总数" value={stats.totalTexts} suffix="篇" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="关联金句总数" value={stats.totalQuotes} suffix="条" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="平均字数" value={stats.avgWords} suffix="字" />
          </Card>
        </Col>
      </Row>

      <Card
        title="原文管理"
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Button loading={batchLoading} onClick={genPinyinBatch}>
                  批量拼音 ({selectedRowKeys.length})
                </Button>
                <Button type="primary" ghost onClick={batchApprove}>
                  批量通过
                </Button>
                <Button danger ghost onClick={batchReject}>
                  批量拒绝
                </Button>
              </>
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建原文</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Input.Search
            placeholder="搜索标题 / 内容 / 作者"
            style={{ maxWidth: 320 }}
            prefix={<SearchOutlined />}
            onSearch={(v) => { setPage(1); setKeyword(v); }}
            allowClear
          />
          <Select
            placeholder="分类类型"
            style={{ width: 160 }}
            allowClear
            options={CATEGORY_TYPES}
            onChange={(v) => { setPage(1); setCategoryType(v); }}
          />
          <Select
            placeholder="审核状态"
            style={{ width: 140 }}
            allowClear
            value={auditStatus}
            options={[
              { label: '待审核', value: '0' },
              { label: '已通过', value: '1' },
              { label: '已拒绝', value: '2' },
            ]}
            onChange={(v) => { setPage(1); setAuditStatus(v); }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={list}
          rowKey="id"
          size="middle"
          scroll={{ x: 1500 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as number[]),
          }}
          pagination={{
            current: page, pageSize, total,
            onChange: setPage,
            onShowSizeChange: (_c, s) => { setPageSize(s); setPage(1); },
            showTotal: (t) => `共 ${t} 篇`,
            showSizeChanger: true,
          }}
        />
      </Card>

      <Modal
        title={editing ? "编辑原文" : "新建原文"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="保存"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="原文标题" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="author" label="作者">
                <Input placeholder="如：鲁迅、佚名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="来源">
                <Input placeholder="如：《朝花夕拾》" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="sourceUrl" label="来源链接">
            <Input placeholder="https://..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="categoryType" label="分类类型">
                <Select placeholder="选择分类类型" options={CATEGORY_TYPES} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="complianceTag" label="协议标签">
                <Select placeholder="选择协议标签" options={COMPLIANCE_TAGS} allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content" label="原文内容" rules={[{ required: true, message: "请输入原文内容" }]}>
            <Input.TextArea rows={10} placeholder="粘贴原文全文..." showCount maxLength={100000} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={quoteTarget ? `从《${quoteTarget.title}》生成金句` : "生成金句"}
        open={quoteModalOpen}
        onCancel={() => setQuoteModalOpen(false)}
        onOk={addQuote}
        okText="一键添加"
        width={560}
        destroyOnClose
      >
        <Paragraph type="secondary">
          {quoteContent
            ? "下方是你从原文中选取的片段，可微调后点击确定生成金句。"
            : "粘贴或输入要作为金句的片段（选段必须出自该原文）..."}
        </Paragraph>
        <Input.TextArea
          rows={6}
          placeholder="粘贴或输入要作为金句的片段..."
          value={quoteContent}
          onChange={(e) => setQuoteContent(e.target.value)}
          showCount
          maxLength={500}
          autoFocus
        />
      </Modal>

      <Drawer
        title={null}
        width={720}
        placement="right"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detailData && (
          <div>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setDetailOpen(false)}
              style={{ marginBottom: 8 }}
            >
              返回列表
            </Button>
            <Typography.Title level={4} style={{ marginBottom: 4 }}>{detailData.title}</Typography.Title>
            <Space split={<Divider type="vertical" />} style={{ marginBottom: 16, flexWrap: "wrap" }}>
              {detailData.author && <Text type="secondary">作者：{detailData.author}</Text>}
              {detailData.source && <Text type="secondary">来源：{detailData.source}</Text>}
              <Text type="secondary">{detailData.wordCount} 字</Text>
              <Tag color="blue">{detailData.quoteCount} 条金句</Tag>
              {detailData.pinyinData ? (
                <Tag
                  style={{ cursor: "pointer" }}
                  color={showPinyin ? "blue" : "default"}
                  onClick={() => setShowPinyin(!showPinyin)}
                >
                  {showPinyin ? "拼音：开" : "拼音：关"}
                </Tag>
              ) : (
                <Tag>拼音未标注</Tag>
              )}
            </Space>

            <Divider
              orientation="left"
              orientationMargin={0}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              原文全文
              <Tooltip title="在下方文本上拖动选中任意片段，会出现「提炼为金句」按钮">
                <Tag color="cyan" style={{ cursor: "default", margin: 0 }}>
                  <HighlightOutlined /> 可选中
                </Tag>
              </Tooltip>
            </Divider>

            <div
              ref={contentAreaRef}
              onMouseUp={handleMouseUp}
              onClick={dismissBubble}
              data-content-area
              style={{
                position: "relative",
                maxHeight: 320,
                overflow: "auto",
                padding: 12,
                background: "#fafafa",
                borderRadius: 6,
                whiteSpace: "pre-wrap",
                lineHeight: 2,
                marginBottom: 16,
                cursor: "text",
                userSelect: "text",
              }}
            >
              <PinyinText
                text={detailData.content}
                pinyinData={detailData.pinyinData}
                showPinyin={showPinyin}
                fontSize={14}
                lineHeight={2}
              />

              {selectionBubble.visible && (
                <div
                  data-selection-bubble
                  style={{
                    position: "absolute",
                    left: selectionBubble.x,
                    top: selectionBubble.y,
                    transform: "translate(-50%, -100%)",
                    zIndex: 10,
                    background: "#1677ff",
                    color: "#fff",
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                    userSelect: "none",
                  }}
                  onClick={extractFromSelection}
                >
                  <ScissorOutlined style={{ marginRight: 6 }} />
                  提炼为金句
                  <span
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: -6,
                      transform: "translateX(-50%) rotate(45deg)",
                      width: 10,
                      height: 10,
                      background: "#1677ff",
                    }}
                  />
                </div>
              )}
            </div>

            <Divider orientation="left">关联金句（{detailData.quotes?.length || 0}）</Divider>
            {(detailData.quotes && detailData.quotes.length > 0) ? (
              detailData.quotes.map((q: Quote) => (
                <Card
                  key={q.id}
                  size="small"
                  style={{ marginBottom: 8 }}
                  bodyStyle={{ padding: "10px 14px", cursor: "pointer" }}
                  onClick={() => message.info(`点击编辑金句 #${q.id}：${q.content.slice(0, 30)}...`)}
                >
                  <div style={{ fontSize: 15, lineHeight: 2.2 }}>
                    <PinyinText
                      text={q.content}
                      pinyinData={(q as any).pinyinData}
                      showPinyin={showPinyin}
                      fontSize={15}
                      lineHeight={2.2}
                    />
                  </div>
                  <div style={{ marginTop: 4 }}>
                    {q.author && <Text type="secondary" style={{ fontSize: 12 }}>—— {q.author}</Text>}
                    {!q.isFree && <Tag color="orange" style={{ marginLeft: 6, fontSize: 11 }}>会员</Tag>}
                    {!q.isActive && <Tag color="red" style={{ fontSize: 11 }}>已停用</Tag>}
                  </div>
                </Card>
              ))
            ) : (
              <Text type="secondary">
                暂无关联金句。
                在上方原文中{" "}
                <b style={{ color: "#1677ff" }}>选中任意片段</b>
                {" "}或点击列表行的「选段」按钮即可生成。
              </Text>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
