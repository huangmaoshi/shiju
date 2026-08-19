import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card, Table, Button, Space, Tag, message, Modal, Input,
  Typography, Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { collectionApi } from "@/api";

const { Text, Paragraph } = Typography;

export default function CollectionDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const collectionId = Number(id);

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [collInfo, setCollInfo] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await collectionApi.getQuotes(collectionId, { page, pageSize });
      setItems(r.list || []);
      setTotal(r.total || 0);
    } catch (e: any) {
      message.error(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  const loadInfo = async () => {
    try {
      const list = await collectionApi.list();
      const arr = Array.isArray(list) ? list : [];
      const found = arr.find((c: any) => c.id === collectionId);
      if (found) {
        setCollInfo(found);
        setEditName(found.name);
        setEditDesc(found.description || "");
      }
    } catch {}
  };

  useEffect(() => {
    if (!collectionId) return;
    load();
    loadInfo();
  }, [collectionId, page, pageSize]);

  const onSearch = (v: string) => {
    setKeyword(v);
    setPage(1);
  };

  const onRemoveQuote = async (recordId: number) => {
    try {
      await collectionApi.removeQuote(collectionId, recordId);
      message.success("已移除");
      load();
      loadInfo();
    } catch (e: any) {
      message.error(e?.message || "移除失败");
    }
  };

  const onUpdateInfo = async () => {
    if (!editName.trim()) {
      message.warning("名称不能为空");
      return;
    }
    try {
      await collectionApi.update(collectionId, { name: editName.trim(), description: editDesc });
      message.success("已更新");
      setEditOpen(false);
      loadInfo();
    } catch (e: any) {
      message.error(e?.message || "更新失败");
    }
  };

  const columns = [
    {
      title: "内容",
      dataIndex: "content",
      ellipsis: true,
      width: 400,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: "作者",
      dataIndex: "author",
      width: 100,
      render: (v?: string) => v || "-",
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 120,
      render: (v?: string) => v || "-",
    },
    {
      title: "字数",
      dataIndex: "wordCount",
      width: 80,
    },
    {
      title: "分类",
      dataIndex: "categories",
      width: 140,
      render: (cats: any[]) => cats && cats.length > 0
        ? cats.slice(0, 3).map((c) => <Tag key={c.id}>{c.name}</Tag>)
        : "-",
    },
    {
      title: "操作",
      width: 100,
      render: (_: any, r: any) => (
        <Popconfirm
          title="确认移除这条摘抄？"
          onConfirm={() => onRemoveQuote(r._recordId || r.recordId || r.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />}>移除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card
        size="small"
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/collections")}>返回</Button>
            <BookOutlined />
            <span>{collInfo?.name || "摘抄本详情"}</span>
            {collInfo?.isDefault && <Tag color="purple">默认</Tag>}
            <Text type="secondary">共 {total} 条</Text>
          </Space>
        }
        extra={
          <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>编辑信息</Button>
        }
      >
        {collInfo?.description && (
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {collInfo.description}
          </Paragraph>
        )}
        <Input.Search
          placeholder="搜索摘抄内容"
          allowClear
          style={{ width: 280, marginBottom: 12 }}
          onSearch={onSearch}
        />
        <Table
          rowKey={(r: any) => r.id || r._recordId}
          columns={columns}
          dataSource={items
            .filter((item: any) => !keyword || item.content?.includes(keyword))
            .map((item: any) => ({ ...item, _recordId: item._recordId }))}
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          locale={{ emptyText: "还没有摘抄内容" }}
        />
      </Card>

      <Modal
        title="编辑摘抄本"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={onUpdateInfo}
        okText="保存"
      >
        <div style={{ marginBottom: 12 }}>
          <Text strong>名称</Text>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="摘抄本名称"
            maxLength={32}
            style={{ marginTop: 4 }}
          />
        </div>
        <div>
          <Text strong>描述</Text>
          <Input.TextArea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="选填"
            rows={3}
            maxLength={100}
            showCount
            style={{ marginTop: 4 }}
          />
        </div>
      </Modal>
    </div>
  );
}
