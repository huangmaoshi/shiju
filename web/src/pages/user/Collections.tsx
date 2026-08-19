import { useEffect, useState } from "react";
import { Card, Tag, Button, Empty, Modal, Form, Input, message, Space } from "antd";
import { PlusOutlined, StarOutlined, BookOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { collectionApi } from "@/api";

export default function Collections() {
  const [list, setList] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    collectionApi.list().then((r: any) => setList(Array.isArray(r) ? r : [])).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async () => {
    try {
      const v = await form.validateFields();
      setSubmitting(true);
      if (editing) {
        await collectionApi.update(editing.id, { name: v.name, description: v.description });
        message.success("已更新");
      } else {
        await collectionApi.create({ name: v.name, description: v.description });
        message.success("摘抄本已创建");
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      load();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (c: any) => {
    setEditing(c);
    form.setFieldsValue({ name: c.name, description: c.description });
    setModalOpen(true);
  };

  const onDelete = async (id: number) => {
    try {
      await collectionApi.remove(id);
      message.success("已删除");
      load();
    } catch (e: any) {
      message.error(e?.message || "删除失败");
    }
  };

  return (
    <div>
      <Card
        title={<span><StarOutlined /> 我的摘抄本</span>}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
            新建摘抄本
          </Button>
        }
      >
        {list.length === 0 ? (
          <Empty description="还没有摘抄本，快去收藏喜欢的金句吧" />
        ) : (
          <RowGrid data={list} onEdit={onEdit} onDelete={onDelete} />
        )}
      </Card>

      <Modal
        title={editing ? "编辑摘抄本" : "新建摘抄本"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={onSubmit}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="name"
            label="摘抄本名称"
            rules={[{ required: true, message: "请输入名称" }, { max: 32, message: "名称最多32个字符" }]}
          >
            <Input placeholder="如：初中作文素材" />
          </Form.Item>
          <Form.Item name="description" label="描述（选填）" rules={[{ max: 100, message: "描述最多100个字符" }]}>
            <Input.TextArea rows={3} placeholder="摘抄本简介" showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

function RowGrid({ data, onEdit, onDelete }: { data: any[]; onEdit: (c: any) => void; onDelete: (id: number) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
      {data.map((c) => (
        <Card
          key={c.id}
          hoverable
          style={{ borderRadius: 12 }}
          bodyStyle={{ padding: 16 }}
        >
          <div
            onClick={() => window.location.href = `/collections/${c.id}`}
            style={{ textAlign: "center", cursor: "pointer" }}
          >
            <BookOutlined style={{ fontSize: 40, color: "#667eea", marginBottom: 8 }} />
            <div style={{ fontSize: 16, fontWeight: 500, color: "#333" }}>{c.name}</div>
            <div style={{ color: "#999", fontSize: 13, marginTop: 4 }}>
              {c.quoteCount || 0} 条金句
            </div>
            {c.isDefault ? <Tag color="purple" style={{ marginTop: 8 }}>默认</Tag> : null}
          </div>
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid #f0f0f0",
              textAlign: "center",
            }}
          >
            <Space size="small">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); onEdit(c); }}
              >
                编辑
              </Button>
              {!c.isDefault && (
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                >
                  删除
                </Button>
              )}
            </Space>
          </div>
        </Card>
      ))}
    </div>
  );
}
