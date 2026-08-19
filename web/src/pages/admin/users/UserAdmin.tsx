import { useEffect, useState } from "react";
import { Card, Table, Input, Tag, Avatar, Space, Button, message, Modal, Form, Select, DatePicker, InputNumber, Popconfirm, Switch, Tabs } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, StopOutlined, CheckOutlined, DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import { adminApi } from "@/api";
import dayjs from "dayjs";

const MEMBER_OPTIONS = [
  { value: 0, label: <span><Tag>非会员</Tag></span> },
  { value: 1, label: <span><Tag color="gold">普通会员</Tag></span> },
  { value: 2, label: <span><Tag color="purple">高级会员</Tag></span> },
];

function MemberTag({ level }: { level: number }) {
  if (level === 2) return <Tag color="purple">高级会员</Tag>;
  if (level === 1) return <Tag color="gold">普通会员</Tag>;
  return <Tag>非会员</Tag>;
}

export default function UserAdmin() {
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [filterMember, setFilterMember] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await adminApi.users({
        keyword: keyword || undefined,
        memberLevel: filterMember || undefined,
        page,
        pageSize,
      });
      setList(r.list || []);
      setTotal(r.total || 0);
    } catch {
      message.error("加载用户列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, pageSize, filterMember]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      userType: "account",
      memberLevel: 0,
      status: 1,
      trialExpireAt: dayjs().add(7, "day"),
    });
    setModalOpen(true);
  };

  const openEdit = (u: any) => {
    setEditing(u);
    form.setFieldsValue({
      nickname: u.nickname,
      username: u.username,
      userType: u.userType || "account",
      memberLevel: u.memberLevel,
      memberExpireAt: u.memberExpireAt ? dayjs(u.memberExpireAt) : null,
      trialExpireAt: u.trialExpireAt ? dayjs(u.trialExpireAt) : null,
      status: u.status,
      resetPassword: undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const v = await form.validateFields();
      const payload: any = {
        nickname: v.nickname,
        userType: v.userType,
        memberLevel: v.memberLevel,
        memberExpireAt: v.memberExpireAt ? v.memberExpireAt.toISOString() : null,
        trialExpireAt: v.trialExpireAt ? v.trialExpireAt.toISOString() : null,
        status: v.status ? 1 : 0,
      };
      if (editing) {
        if (v.username !== undefined && v.username !== editing.username) payload.username = v.username;
        if (v.resetPassword) payload.resetPassword = v.resetPassword;
        await adminApi.userUpdate(editing.id, payload);
        message.success("已更新用户");
      } else {
        if (!v.username || !v.password) {
          message.error("用户名和密码必填");
          return;
        }
        payload.username = v.username;
        payload.password = v.password;
        await adminApi.userCreate(payload);
        message.success("已创建用户");
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || "操作失败");
    }
  };

  const handleBan = async (u: any) => {
    try {
      if (u.status === 1) await adminApi.userBan(u.id); else await adminApi.userUnban(u.id);
      message.success("操作成功");
      load();
    } catch { message.error("操作失败"); }
  };

  const handleDelete = async (u: any) => {
    try {
      await adminApi.userDelete(u.id);
      message.success("已删除");
      load();
    } catch { message.error("删除失败"); }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "头像", width: 60, render: () => <Avatar style={{ background: "#667eea" }}>👤</Avatar> },
    { title: "用户名", dataIndex: "username", width: 120, render: (v: string) => v || "-" },
    { title: "昵称", dataIndex: "nickname", width: 120 },
    { title: "用户类型", dataIndex: "userType", width: 90, render: (v: string) => {
      if (v === "admin") return <Tag color="red">管理员</Tag>;
      if (v === "account") return <Tag>普通用户</Tag>;
      return <Tag color="green">微信</Tag>;
    } },
    { title: "会员等级", dataIndex: "memberLevel", width: 110, render: (v: number) => <MemberTag level={v} /> },
    { title: "会员到期", dataIndex: "memberExpireAt", width: 120, render: (v: string) => v ? dayjs(v).format("YYYY-MM-DD") : "-" },
    { title: "试用到期", dataIndex: "trialExpireAt", width: 120, render: (v: string) => v ? dayjs(v).format("YYYY-MM-DD") : "-" },
    { title: "状态", dataIndex: "status", width: 80, render: (v: number) => v === 1 ? <Tag color="green">正常</Tag> : <Tag color="red">封禁</Tag> },
    { title: "注册时间", dataIndex: "createdAt", width: 110, render: (v: string) => dayjs(v).format("YYYY-MM-DD") },
    {
      title: "操作", width: 220, fixed: "right" as const, render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" danger icon={r.status === 1 ? <StopOutlined /> : <CheckOutlined />} onClick={() => handleBan(r)}>
            {r.status === 1 ? "封禁" : "解封"}
          </Button>
          <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="用户管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>创建用户</Button>}
    >
      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <Input.Search
          placeholder="搜索 用户名 / OpenID / 昵称"
          prefix={<SearchOutlined />}
          style={{ maxWidth: 320 }}
          onSearch={(v) => { setKeyword(v); setPage(1); load(); }}
          allowClear
        />
        <Select
          placeholder="会员等级"
          style={{ width: 140 }}
          allowClear
          value={filterMember || undefined}
          onChange={(v) => { setFilterMember(v || ""); setPage(1); }}
          options={[
            { value: "0", label: "非会员" },
            { value: "1", label: "普通会员" },
            { value: "2", label: "高级会员" },
          ]}
        />
      </div>

      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `共 ${t} 个用户`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        okText={editing ? "保存" : "创建"}
        cancelText="取消"
        destroyOnClose
        width={560}
        title={editing ? `编辑用户 #${editing.id}` : "创建用户"}
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true, min: 3, max: 32 }]}>
                <Input placeholder="3-32 个字符" />
              </Form.Item>
              <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6, max: 64 }]}>
                <Input.Password placeholder="至少 6 位" />
              </Form.Item>
            </>
          )}
          {editing && (
            <>
              <Form.Item name="username" label="用户名">
                <Input />
              </Form.Item>
              <Form.Item name="resetPassword" label="重置密码（留空不修改）">
                <Input.Password placeholder="输入新密码以重置" prefix={<KeyOutlined />} />
              </Form.Item>
            </>
          )}
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="默认同用户名" />
          </Form.Item>

          <Form.Item name="userType" label="用户类型" tooltip="管理员拥有所有权限，无需会员等级">
            <Select
              options={[
                { value: "account", label: "普通用户" },
                { value: "admin", label: "管理员" },
              ]}
            />
          </Form.Item>

          <Form.Item name="memberLevel" label="会员等级">
            <Select options={MEMBER_OPTIONS} />
          </Form.Item>
          <Form.Item name="memberExpireAt" label="会员到期时间">
            <DatePicker showTime style={{ width: "100%" }} placeholder="不填则不改变" />
          </Form.Item>
          <Form.Item name="trialExpireAt" label="试用到期时间">
            <DatePicker showTime style={{ width: "100%" }} placeholder="不填则不改变" />
          </Form.Item>

          <Form.Item name="status" label="状态" valuePropName="checked" getValueFromEvent={(v) => v ? 1 : 0}>
            <Switch checkedChildren="正常" unCheckedChildren="封禁" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
