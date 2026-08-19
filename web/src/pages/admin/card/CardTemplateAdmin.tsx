import { Card, Table, Button, Modal, Form, Input, Switch, InputNumber, Tag, Space, Popconfirm, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState } from "react";

const demo = [
  { id: 1, name: "简约白", style: "minimal", isFree: true, sort: 1, previewUrl: "" },
  { id: 2, name: "古典风", style: "classic", isFree: true, sort: 2, previewUrl: "" },
  { id: 3, name: "渐变紫", style: "gradient-purple", isFree: false, sort: 3, previewUrl: "" },
  { id: 4, name: "水墨", style: "ink-wash", isFree: false, sort: 4, previewUrl: "" },
  { id: 5, name: "落日黄", style: "sunset", isFree: true, sort: 5, previewUrl: "" },
];

export default function CardTemplateAdmin() {
  const [list, setList] = useState<any[]>(demo);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const save = async () => {
    const v = await form.validateFields();
    setList((arr) => {
      if (editing) return arr.map((x) => (x.id === editing.id ? { ...editing, ...v } : x));
      return [...arr, { id: Date.now(), ...v }];
    });
    message.success("保存成功");
    setOpen(false);
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "模板名称", dataIndex: "name", width: 160 },
    { title: "样式标识", dataIndex: "style", width: 180, render: (v: string) => <code>{v}</code> },
    { title: "免费", dataIndex: "isFree", width: 80, render: (v: boolean) => v ? <Tag color="green">免费</Tag> : <Tag color="orange">会员</Tag> },
    { title: "排序", dataIndex: "sort", width: 80 },
    {
      title: "操作", render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => setList((arr) => arr.filter((x) => x.id !== r.id))} /></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="卡片模板管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新建模板</Button>}>
      <Table columns={columns} dataSource={list} rowKey="id" size="middle" />
      <Modal title={editing ? "编辑模板" : "新建模板"} open={open} onCancel={() => setOpen(false)} onOk={save} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="style" label="样式标识" rules={[{ required: true }]}><Input placeholder="如 gradient-purple" /></Form.Item>
          <Form.Item name="isFree" label="是否免费" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="sort" label="排序" initialValue={0}><InputNumber /></Form.Item>
          <Form.Item name="previewUrl" label="预览图 URL"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
