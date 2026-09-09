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
  Input,
  Select,
  message,
  Modal,
  Drawer,
  Checkbox,
  Form,
  Empty,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { adminApi } from "@/api";

const AUDIT_STATUS_MAP: Record<number, { color: string; text: string; icon: React.ReactNode }> = {
  0: { color: "orange", text: "待审", icon: <ClockCircleOutlined /> },
  1: { color: "green", text: "通过", icon: <CheckCircleOutlined /> },
  2: { color: "red", text: "拒绝", icon: <CloseCircleOutlined /> },
};

const AUDIT_STATUS_OPTIONS = [
  { label: "全部", value: null },
  { label: "待审", value: 0 },
  { label: "通过", value: 1 },
  { label: "拒绝", value: 2 },
];

function StatusTag({ status }: { status: number }) {
  const s = AUDIT_STATUS_MAP[status] || AUDIT_STATUS_MAP[0];
  return (
    <Tag color={s.color} icon={s.icon}>
      {s.text}
    </Tag>
  );
}

function AuditModal({
  open,
  title,
  count,
  onCancel,
  onOk,
}: {
  open: boolean;
  title: string;
  count: number;
  onCancel: () => void;
  onOk: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title={title}
      open={open}
      onCancel={() => {
        setReason("");
        onCancel();
      }}
      onOk={() => {
        onOk(reason.trim() || undefined);
        setReason("");
      }}
      okText="确认"
      cancelText="取消"
    >
      <p>确定要对选中的 <strong>{count}</strong> 条记录执行此操作吗？</p>
      <Form.Item label="审核原因（可选）" style={{ marginTop: 12 }}>
        <Input.TextArea
          rows={2}
          placeholder="如：内容低俗、来源不明、错别字过多等"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Form.Item>
    </Modal>
  );
}

function QuoteAuditPanel() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [keyword, setKeyword] = useState("");
  const [auditStatus, setAuditStatus] = useState<number | null>(0);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; status: number }>({ open: false, status: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (auditStatus !== null) params.auditStatus = auditStatus;
      const res = await adminApi.quotes(params);
      setList(res.list || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    load();
  }, [page, pageSize, keyword, auditStatus]);

  const openAuditModal = (status: number) => {
    if (selectedIds.length === 0) {
      message.warning("请先勾选要审核的记录");
      return;
    }
    setModal({ open: true, status });
  };

  const doQuickAudit = async (status: number) => {
    try {
      const allIds: number[] = [];
      let pageNo = 1;
      const pageSize = 1000;
      while (true) {
        const params: any = { page: pageNo, pageSize };
        if (keyword) params.keyword = keyword;
        if (auditStatus !== null) params.auditStatus = auditStatus;

        const res = await adminApi.quotes(params);
        const ids = (res.list || []).map((item: any) => item.id);
        allIds.push(...ids);

        if (allIds.length >= (res.total || 0) || ids.length < pageSize) {
          break;
        }

        pageNo += 1;
      }

      if (allIds.length === 0) {
        message.warning("当前筛选条件下没有可审核的数据");
        return;
      }

      Modal.confirm({
        title: status === 1 ? "确认一键通过全部" : "确认一键拒绝全部",
        icon: status === 1 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined style={{ color: "red" }} />,
        content: `将当前筛选条件下的 ${allIds.length} 条金句${status === 1 ? "全部通过" : "全部拒绝"}吗？`,
        okText: "确认",
        cancelText: "取消",
        onOk: async () => {
          try {
            await adminApi.auditQuotes(allIds, status);
            message.success(`已${status === 1 ? "通过" : "拒绝"} ${allIds.length} 条`);
            setSelectedIds([]);
            load();
          } catch (e: any) {
            message.error(e?.message || "操作失败");
          }
        },
      });
    } catch (e: any) {
      message.error(e?.message || "获取审核列表失败");
    }
  };

  const doAudit = async (reason?: string) => {
    try {
      await adminApi.auditQuotes(selectedIds, modal.status, reason);
      message.success(`已${modal.status === 1 ? "通过" : "拒绝"} ${selectedIds.length} 条`);
      setModal({ open: false, status: 1 });
      setSelectedIds([]);
      load();
    } catch (e: any) {
      message.error(e?.message || "操作失败");
    }
  };

  const doSingleAudit = async (id: number, status: number) => {
    Modal.confirm({
      title: status === 1 ? "确认通过" : "确认拒绝",
      icon: status === 1 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined style={{ color: "red" }} />,
      content: `确定${status === 1 ? "通过" : "拒绝"}这条金句？`,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          await adminApi.auditQuotes([id], status);
          message.success("操作成功");
          load();
        } catch (e: any) {
          message.error(e?.message || "操作失败");
        }
      },
    });
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "内容",
      dataIndex: "content",
      ellipsis: true,
      width: 360,
      render: (v: string) => (v || "").length > 50 ? v.slice(0, 50) + "..." : v,
    },
    { title: "作者", dataIndex: "author", width: 120, render: (v: string) => v || "-" },
    { title: "来源", dataIndex: "source", width: 120, render: (v: string) => v || "-" },
    { title: "审核状态", dataIndex: "auditStatus", width: 110, render: (v: number) => <StatusTag status={v ?? 0} /> },
    { title: "审核原因", dataIndex: "auditReason", width: 140, render: (v: string) => v || "-" },
    {
      title: "操作",
      width: 150,
      fixed: "right" as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            disabled={r.auditStatus === 1}
            onClick={() => doSingleAudit(r.id, 1)}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            disabled={r.auditStatus === 2}
            onClick={() => doSingleAudit(r.id, 2)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space>
          <Input.Search
            placeholder="搜索金句内容/作者"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => { setPage(1); setKeyword(v); }}
          />
          <Select
            value={auditStatus}
            options={AUDIT_STATUS_OPTIONS}
            style={{ width: 130 }}
            onChange={(v) => { setPage(1); setAuditStatus(v as number | null); }}
          />
        </Space>
      }
      extra={
        <Space>
          {list.length > 0 && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => doQuickAudit(1)}
              >
                一键通过全部
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => doQuickAudit(2)}
              >
                一键拒绝全部
              </Button>
            </>
          )}
          {selectedIds.length > 0 && (
            <>
              <span style={{ color: "#1890ff" }}>已选 {selectedIds.length} 条</span>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => openAuditModal(1)}
              >
                批量通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => openAuditModal(2)}
              >
                批量拒绝
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])}>清空</Button>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
          getCheckboxProps: () => ({ disabled: false }),
        }}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
      <AuditModal
        open={modal.open}
        title={modal.status === 1 ? "批量通过" : "批量拒绝"}
        count={selectedIds.length}
        onCancel={() => setModal({ open: false, status: 1 })}
        onOk={doAudit}
      />
    </Card>
  );
}

function OriginalAuditPanel() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [keyword, setKeyword] = useState("");
  const [auditStatus, setAuditStatus] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [modal, setModal] = useState<{ open: boolean; status: number }>({ open: false, status: 1 });

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (auditStatus !== null) params.auditStatus = auditStatus;
      const res = await adminApi.originalTexts(params);
      setList(res.list || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds([]);
    load();
  }, [page, pageSize, keyword, auditStatus]);

  const openAuditModal = (status: number) => {
    if (selectedIds.length === 0) {
      message.warning("请先勾选要审核的记录");
      return;
    }
    setModal({ open: true, status });
  };

  const doQuickAudit = async (status: number) => {
    try {
      const allIds: number[] = [];
      let pageNo = 1;
      const pageSize = 1000;
      while (true) {
        const params: any = { page: pageNo, pageSize };
        if (keyword) params.keyword = keyword;
        if (auditStatus !== null) params.auditStatus = auditStatus;

        const res = await adminApi.originalTexts(params);
        const ids = (res.list || []).map((item: any) => item.id);
        allIds.push(...ids);

        if (allIds.length >= (res.total || 0) || ids.length < pageSize) {
          break;
        }

        pageNo += 1;
      }

      if (allIds.length === 0) {
        message.warning("当前筛选条件下没有可审核的数据");
        return;
      }

      Modal.confirm({
        title: status === 1 ? "确认一键通过全部" : "确认一键拒绝全部",
        icon: status === 1 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined style={{ color: "red" }} />,
        content: `将当前筛选条件下的 ${allIds.length} 条原文${status === 1 ? "全部通过" : "全部拒绝"}吗？`,
        okText: "确认",
        cancelText: "取消",
        onOk: async () => {
          try {
            await adminApi.auditOriginalTexts(allIds, status);
            message.success(`已${status === 1 ? "通过" : "拒绝"} ${allIds.length} 条`);
            setSelectedIds([]);
            load();
          } catch (e: any) {
            message.error(e?.message || "操作失败");
          }
        },
      });
    } catch (e: any) {
      message.error(e?.message || "获取审核列表失败");
    }
  };

  const doAudit = async (reason?: string) => {
    try {
      await adminApi.auditOriginalTexts(selectedIds, modal.status, reason);
      message.success(`已${modal.status === 1 ? "通过" : "拒绝"} ${selectedIds.length} 条`);
      setModal({ open: false, status: 1 });
      setSelectedIds([]);
      load();
    } catch (e: any) {
      message.error(e?.message || "操作失败");
    }
  };

  const doSingleAudit = async (id: number, status: number) => {
    Modal.confirm({
      title: status === 1 ? "确认通过" : "确认拒绝",
      icon: status === 1 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined style={{ color: "red" }} />,
      content: `确定${status === 1 ? "通过" : "拒绝"}这篇原文？`,
      okText: "确认",
      cancelText: "取消",
      onOk: async () => {
        try {
          await adminApi.auditOriginalTexts([id], status);
          message.success("操作成功");
          load();
        } catch (e: any) {
          message.error(e?.message || "操作失败");
        }
      },
    });
  };

  const openDetail = (item: any) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 70 },
    {
      title: "标题",
      dataIndex: "title",
      ellipsis: true,
      width: 260,
      render: (v: string) => <a>{v || "(无标题)"}</a>,
    },
    { title: "作者", dataIndex: "author", width: 120, render: (v: string) => v || "-" },
    { title: "来源", dataIndex: "source", width: 120, render: (v: string) => v || "-" },
    { title: "字数", dataIndex: "content", width: 90, render: (v: string) => v ? v.length : 0 },
    {
      title: "审核状态",
      dataIndex: "auditStatus",
      width: 110,
      render: (v: number) => <StatusTag status={v ?? 0} />,
    },
    { title: "审核原因", dataIndex: "auditReason", width: 140, render: (v: string) => v || "-" },
    {
      title: "操作",
      width: 200,
      fixed: "right" as const,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" onClick={() => openDetail(r)}>详情</Button>
          <Button
            size="small"
            type="primary"
            disabled={r.auditStatus === 1}
            onClick={() => doSingleAudit(r.id, 1)}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            disabled={r.auditStatus === 2}
            onClick={() => doSingleAudit(r.id, 2)}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      title={
        <Space>
          <Input.Search
            placeholder="搜索标题/作者"
            allowClear
            style={{ width: 260 }}
            onSearch={(v) => { setPage(1); setKeyword(v); }}
          />
          <Select
            value={auditStatus}
            options={AUDIT_STATUS_OPTIONS}
            style={{ width: 130 }}
            onChange={(v) => { setPage(1); setAuditStatus(v as number | null); }}
          />
        </Space>
      }
      extra={
        <Space>
          {list.length > 0 && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => doQuickAudit(1)}
              >
                一键通过全部
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => doQuickAudit(2)}
              >
                一键拒绝全部
              </Button>
            </>
          )}
          {selectedIds.length > 0 && (
            <>
              <span style={{ color: "#1890ff" }}>已选 {selectedIds.length} 条</span>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => openAuditModal(1)}
              >
                批量通过
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => openAuditModal(2)}
              >
                批量拒绝
              </Button>
              <Button size="small" onClick={() => setSelectedIds([])}>清空</Button>
            </>
          )}
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 12 }}>
        <Checkbox
          indeterminate={selectedIds.length > 0 && selectedIds.length < list.length}
          checked={list.length > 0 && selectedIds.length === list.length}
          onChange={(e) => setSelectedIds(e.target.checked ? list.map((x) => x.id) : [])}
        >
          全选当前页
        </Checkbox>
      </div>
      {list.length === 0 && !loading ? (
        <Empty description="暂无原文数据" />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={loading}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as number[]),
          }}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      )}
      <AuditModal
        open={modal.open}
        title={modal.status === 1 ? "批量通过原文" : "批量拒绝原文"}
        count={selectedIds.length}
        onCancel={() => setModal({ open: false, status: 1 })}
        onOk={doAudit}
      />
      <Drawer
        title={detailItem?.title || "原文详情"}
        open={detailOpen}
        width={640}
        onClose={() => setDetailOpen(false)}
      >
        {detailItem && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Tag color="blue">作者：{detailItem.author || "-"}</Tag>
              <Tag color="purple">来源：{detailItem.source || "-"}</Tag>
              <StatusTag status={detailItem.auditStatus ?? 0} />
            </div>
            <Card size="small" title="正文">
              <div style={{ whiteSpace: "pre-wrap", fontFamily: "serif", lineHeight: 1.8 }}>
                {detailItem.content || "(无内容)"}
              </div>
            </Card>
            {detailItem.quotes && detailItem.quotes.length > 0 && (
              <Card size="small" title={`关联金句（${detailItem.quotes.length}）`}>
                {detailItem.quotes.map((q: any) => (
                  <div key={q.id} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <div>"{q.content}"</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {q.author ? `—— ${q.author}` : ""} · ID {q.id} · <StatusTag status={q.auditStatus ?? 0} />
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Card>
  );
}

export default function AuditAdmin() {
  const [stats, setStats] = useState<{ originalCount: number; quoteCount: number }>({
    originalCount: 0,
    quoteCount: 0,
  });

  const loadStats = async () => {
    try {
      const s = await adminApi.pendingAuditStats();
      setStats(s);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="原文待审核"
              value={stats.originalCount}
              suffix="篇"
              valueStyle={{ color: "#fa8c16" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="金句待审核"
              value={stats.quoteCount}
              suffix="条"
              valueStyle={{ color: "#fa8c16" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总待审核"
              value={stats.originalCount + stats.quoteCount}
              suffix="条"
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="操作"
              value="审核面板"
              valueStyle={{ fontSize: 16 }}
              prefix={<SearchOutlined style={{ color: "#52c41a" }} />}
            />
            <Button type="link" onClick={loadStats}>刷新统计</Button>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="quote"
        items={[
          { key: "quote", label: "💬 金句审核", children: <QuoteAuditPanel /> },
          { key: "original", label: "📖 原文审核", children: <OriginalAuditPanel /> },
        ]}
      />
    </div>
  );
}
