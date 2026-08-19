import { Card, Button, Table, Space, Tag, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { adminApi } from "@/api";

const positions = [
  { value: "splash", label: "启动页 Splash" },
  { value: "banner", label: "首页 Banner" },
  { value: "feed", label: "信息流插屏" },
  { value: "reward", label: "激励视频" },
];

export default function AdAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = () => adminApi.ads().then(setList).catch(() => {
    setList([
      { id: 1, position: "splash", title: "作文大赛广告", imageUrl: "", targetUrl: "https://example.com", priority: 1, isActive: true },
      { id: 2, position: "banner", title: "新书推荐", priority: 2, isActive: true },
      { id: 3, position: "feed", title: "阅读会员推广", priority: 1, isActive: false },
    ]);
  });
  useEffect(() => { load(); }, []);

  const save = async () => {
    const v = await form.validateFields();
    message.success("保存成功");
    setOpen(false);
    load();
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "广告位", dataIndex: "position", width: 140, render: (v: string) => <Tag color="purple">{positions.find((p) => p.value === v)?.label || v}</Tag> },
    { title: "标题", dataIndex: "title", width: 180 },
    { title: "跳转链接", dataIndex: "targetUrl", width: 200, render: (v: string) => v ? <a href={v} target="_blank">{v}</a> : "-" },
    { title: "优先级", dataIndex: "priority", width: 80 },
    { title: "启用", dataIndex: "isActive", width: 80, render: (v: boolean) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
    {
      title: "操作", render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setOpen(true); }}>编辑</Button>
          <Popconfirm title="确认删除？"><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="广告配置" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新建广告</Button>}>
      <Table columns={columns} dataSource={list} rowKey="id" size="middle" pagination={{ pageSize: 20 }} />
      <Modal title={editing ? "编辑广告" : "新建广告"} open={open} onCancel={() => setOpen(false)} onOk={save} okText="保存">
        <Form form={form} layout="vertical">
          <Form.Item name="position" label="广告位" rules={[{ required: true }]}>
            <Select options={positions} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="targetUrl" label="跳转链接"><Input placeholder="https://" /></Form.Item>
          <Form.Item name="imageUrl" label="图片地址"><Input placeholder="图片 CDN 链接" /></Form.Item>
          <Form.Item name="priority" label="优先级" initialValue={1}><InputNumber min={0} max={10} /></Form.Item>
          <Form.Item name="isActive" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
