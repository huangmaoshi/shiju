import { useEffect, useState } from "react";
import { Card, Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, message, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { categoryApi } from "@/api/category";
import type { Category } from "@/types";

export default function CategoryAdmin() {
  const [list, setList] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => categoryApi.list().then(setList);

  useEffect(() => { load(); }, []);

  const openEdit = (c?: Category) => {
    setEditing(c || null);
    form.setFieldsValue(c || { name: "", type: "theme", sort: 0 });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    if (editing) await categoryApi.update(editing.id, v);
    else await categoryApi.create(v);
    setModalOpen(false);
    message.success("保存成功");
    load();
  };

  const del = async (id: number) => {
    await categoryApi.remove(id);
    message.success("已删除");
    load();
  };

  const typeColor: Record<string, string> = { content_type: "blue", theme: "purple", scene: "green" };
  const typeName: Record<string, string> = { content_type: "内容类型", theme: "主题", scene: "场景" };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "名称", dataIndex: "name", width: 180 },
    { title: "类型", dataIndex: "type", width: 120, render: (v: string) => <Tag color={typeColor[v]}>{typeName[v] || v}</Tag> },
    { title: "排序", dataIndex: "sort", width: 100 },
    { title: "关联金句", dataIndex: "quoteCount", width: 120, defaultSortOrder: "descend" as const, sorter: (a: any, b: any) => (a.quoteCount || 0) - (b.quoteCount || 0) },
    {
      title: "操作", render: (_: any, r: Category) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => del(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card title="分类管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>新建分类</Button>}>
        <Table columns={columns} dataSource={list} rowKey="id" size="middle" pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个分类` }} />
      </Card>
      <Modal title={editing ? "编辑分类" : "新建分类"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={save} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={[
              { label: "📖 内容类型", value: "content_type" },
              { label: "🎨 主题", value: "theme" },
              { label: "🎬 场景", value: "scene" },
            ]} />
          </Form.Item>
          <Form.Item name="sort" label="排序" initialValue={0}><InputNumber min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
