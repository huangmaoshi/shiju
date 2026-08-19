import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button, Form, Input, Tabs, Divider, message } from "antd";
import { UserOutlined, LockOutlined, WechatOutlined, HomeOutlined } from "@ant-design/icons";
import { userApi } from "@/api";
import { useAuthStore } from "@/stores/auth";

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // 用户名密码登录
  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await userApi.login(values.username, values.password);
      login(res.token, res.user);
      message.success("登录成功");
      navigate("/");
    } catch (err: any) {
      message.error(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const onRegister = async (values: { username: string; password: string; nickname?: string }) => {
    setLoading(true);
    try {
      const res = await userApi.register(values.username, values.password, values.nickname);
      login(res.token, res.user);
      message.success("注册成功，已自动登录");
      navigate("/");
    } catch (err: any) {
      message.error(err?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  // 微信登录（开发环境 mock，生产环境接入微信开放平台）
  const onWechatLogin = async () => {
    setLoading(true);
    try {
      // 开发环境：使用 mock code
      const code = "dev_" + Date.now();
      const res = await userApi.wechatLogin(code);
      login(res.token, res.user);
      message.success("微信登录成功");
      navigate("/");
    } catch (err: any) {
      message.error(err?.message || "微信登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      minHeight: "calc(100vh - 64px)",
      padding: "60px 20px",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    }}>
      <Card style={{
        width: 420,
        borderRadius: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        overflow: "hidden",
      }}>
        {/* 标题 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            fontSize: 32,
            marginBottom: 12,
          }}>📖</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#333" }}>拾句</h1>
          <p style={{ color: "#999", fontSize: 14, marginTop: 8 }}>
            登录以同步你的摘抄本和背诵计划
          </p>
        </div>

        {/* 登录/注册 Tab */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: "login",
              label: "登录",
              children: (
                <Form onFinish={onLogin} layout="vertical" size="large" autoComplete="off">
                  <Form.Item name="username" rules={[{ required: true, message: "请输入账号" }]}>
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="账号"
                      autoComplete="username"
                    />
                  </Form.Item>
                  <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="密码"
                      autoComplete="current-password"
                    />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 12 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      style={{ height: 48, fontSize: 16, borderRadius: 8 }}
                    >
                      登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "register",
              label: "注册",
              children: (
                <Form onFinish={onRegister} layout="vertical" size="large" autoComplete="off">
                  <Form.Item
                    name="username"
                    rules={[
                      { required: true, message: "请输入账号" },
                      { min: 3, max: 32, message: "账号长度 3-32 个字符" },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="设置账号（3-32个字符）" />
                  </Form.Item>
                  <Form.Item
                    name="password"
                    rules={[
                      { required: true, message: "请输入密码" },
                      { min: 6, max: 64, message: "密码长度 6-64 个字符" },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="设置密码（6-64个字符）" />
                  </Form.Item>
                  <Form.Item name="nickname">
                    <Input placeholder="昵称（选填）" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 12 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      loading={loading}
                      style={{ height: 48, fontSize: 16, borderRadius: 8 }}
                    >
                      注册并登录
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />

        {/* 分隔线 */}
        <Divider plain style={{ margin: "16px 0", color: "#ccc", fontSize: 13 }}>
          其他登录方式
        </Divider>

        {/* 微信登录按钮 */}
        <Button
          size="large"
          block
          loading={loading}
          onClick={onWechatLogin}
          style={{
            height: 48,
            fontSize: 16,
            borderRadius: 8,
            background: "#07c160",
            borderColor: "#07c160",
            color: "#fff",
            fontWeight: 500,
          }}
          icon={<WechatOutlined />}
        >
          微信一键登录
        </Button>

        {/* 返回首页 */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <Button
            type="link"
            icon={<HomeOutlined />}
            onClick={() => navigate("/")}
            style={{ color: "#999", fontSize: 13 }}
          >
            先逛逛
          </Button>
        </div>
      </Card>
    </div>
  );
}
