import { useEffect, useState } from "react";
import { Card, Table, Button, Space, Input, Tag, Modal, Form, Select, message, Popconfirm, Switch, Drawer, Divider } from "antd";
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import { quoteApi } from "@/api/quote";
import { aiApi } from "@/api";
import { categoryApi } from "@/api/category";
import type { Quote, Category } from "@/types";
import PinyinText from "@/components/PinyinText";

export default function QuoteAdmin() {
  const [list, setList] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form] = Form.useForm();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // 详情Drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Quote | null>(null);
  const [showPinyin, setShowPinyin] = useState(true);

  const load = () => {
    quoteApi.list({ page, pageSize: 15, keyword }).then((r) => { setList(r.list); setTotal(r.total); });
  };

  useEffect(() => { load(); categoryApi.list().then(setCategories); }, [page, keyword]);

  const openEdit = (q?: Quote) => {
    setEditing(q || null);
    form.setFieldsValue(q || { content: "", author: "", source: "", isFree: true, isActive: true });
    setModalOpen(true);
  };

  const openDetail = async (q: Quote) => {
    const full = await quoteApi.detail(Number(q.id));
    setDetail(full);
    setDetailOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    if (editing) {
      await quoteApi.update(editing.id, v);
      message.success("已更新");
    } else {
      await quoteApi.create(v);
      message.success("已创建");
    }
    setModalOpen(false);
    load();
  };

  const del = async (id: number) => {
    await quoteApi.remove(id);
    message.success("已删除");
    load();
  };

  // AI 生成单条金句拼音
  const genPinyinSingle = async (id: number) => {
    setLoadingIds((prev) => new Set(prev).add(id));
    try {
      await aiApi.pinyinQuoteSingle({ quoteId: id });
      message.success("拼音生成成功");
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "拼音生成失败");
    } finally {
      setLoadingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  // AI 批量生成金句拼音
  const genPinyinBatch = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请先勾选要生成拼音的金句");
      return;
    }
    setBatchLoading(true);
    try {
      const res: any = await aiApi.pinyinQuoteBatch({ quoteIds: selectedRowKeys });
      message.success(`批量拼音完成：成功 ${res.data?.success || 0} 条，失败 ${res.data?.failed || 0} 条`);
      load();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "批量生成失败");
    } finally {
      setBatchLoading(false);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    {
      title: "内容",
      dataIndex: "content",
      ellipsis: true,
      width: 320,
      render: (v: string) => v?.length > 60 ? v.slice(0, 60) + "..." : v,
    },
    { title: "作者", dataIndex: "author", width: 100, render: (v?: string) => v || "-" },
    { title: "出处", dataIndex: "source", width: 120, render: (v?: string) => v || "-" },
    { title: "分类", dataIndex: "categories", width: 180, render: (cs: any) => Array.isArray(cs) ? cs.map((c: any) => (typeof c === "string" ? c : c.name)).filter(Boolean).slice(0, 3).map((n: string) => <Tag key={n} color="purple">{n}</Tag>) : null },
    { title: "免费", dataIndex: "isFree", width: 80, render: (v: boolean) => v ? <Tag color="green">免费</Tag> : <Tag color="orange">会员</Tag> },
    { title: "拼音", dataIndex: "pinyinData", width: 70, render: (v?: string) => v ? <Tag color="blue">已注</Tag> : <Tag>无</Tag> },
    { title: "状态", dataIndex: "isActive", width: 100, render: (v: boolean, r: Quote) => <Switch checked={v} onChange={(c) => quoteApi.setActive(r.id, c).then(() => {})} /> },
    {
      title: "操作", width: 240, render: (_: any, r: Quote) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>查看</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" loading={loadingIds.has(r.id)} onClick={() => genPinyinSingle(r.id)}>拼音</Button>
          <Popconfirm title="确认删除？" onConfirm={() => del(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="金句管理" extra={
        <Space>
          {selectedRowKeys.length > 0 && (
            <Button loading={batchLoading} onClick={genPinyinBatch}>
              批量拼音 ({selectedRowKeys.length})
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新建金句</Button>
        </Space>
      }>
        <div style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            enterButton={<SearchOutlined />}
            placeholder="搜索金句内容 / 作者 / 出处"
            onSearch={(v) => { setKeyword(v); setPage(1); }}
            style={{ maxWidth: 480 }}
          />
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={list}
          rowSelection={{ selectedRowKeys, onChange: (k) => setSelectedRowKeys(k as number[]) }}
          scroll={{ x: 1200 }}
          pagination={{
            current: page, pageSize: 15, total,
            showSizeChanger: true, showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>

      <Modal
        title={editing ? "编辑金句" : "新建金句"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="保存"
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="content" label="金句内容" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="输入金句全文" />
          </Form.Item>
          <Form.Item name="author" label="作者">
            <Input placeholder="如：鲁迅、佚名" />
          </Form.Item>
          <Form.Item name="source" label="出处">
            <Input placeholder="如：《朝花夕拾》" />
          </Form.Item>
          <Form.Item name="isFree" label="是否免费" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isActive" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="categoryIds" label="所属分类">
            <Select mode="multiple" placeholder="选择分类" options={categories.map((c) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="金句详情"
        width={640}
        placement="right"
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        destroyOnClose
      >
        {detail && (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <Tag color={detail.isFree ? "green" : "orange"}>{detail.isFree ? "免费" : "会员"}</Tag>
              <Tag color={detail.pinyinData ? "blue" : "default"}>拼音：{detail.pinyinData ? "已标注" : "未标注"}</Tag>
              {detail.pinyinData && (
                <Tag
                  style={{ cursor: "pointer" }}
                  color={showPinyin ? "blue" : "default"}
                  onClick={() => setShowPinyin(!showPinyin)}
                >
                  {showPinyin ? "拼音：开" : "拼音：关"}
                </Tag>
              )}
              <Tag>{detail.isActive ? "启用" : "未启用"}</Tag>
            </Space>

            <Divider orientation="left" orientationMargin={0}>金句内容</Divider>
            <div style={{ fontSize: 20, lineHeight: 2.4, color: "#333", padding: 16, background: "#fafbfc", borderRadius: 8 }}>
              <PinyinText
                text={detail.content}
                pinyinData={detail.pinyinData}
                showPinyin={showPinyin}
                fontSize={20}
                lineHeight={2.4}
              />
            </div>

            <Divider orientation="left" orientationMargin={0}>基本信息</Divider>
            <p style={{ margin: "6px 0" }}><strong>作者：</strong>{detail.author || "佚名"}</p>
            <p style={{ margin: "6px 0" }}><strong>出处：</strong>{detail.source || "-"}</p>
            <p style={{ margin: "6px 0" }}>
              <strong>分类：</strong>
              {(detail.categories || []).map((c: any) => (
                <Tag key={typeof c === "string" ? c : c.id} color="purple">
                  {typeof c === "string" ? c : c.name}
                </Tag>
              ))}
            </p>
            <p style={{ margin: "6px 0" }}><strong>浏览：</strong>{detail.viewCount || 0}</p>
            <p style={{ margin: "6px 0" }}><strong>收藏：</strong>{detail.collectCount || 0}</p>
            <p style={{ margin: "6px 0" }}><strong>录入时间：</strong>{new Date(detail.createdAt).toLocaleString()}</p>
          </div>
        )}
      </Drawer>
    </div>
  );
}
