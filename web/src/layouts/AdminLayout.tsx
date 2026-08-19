import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu } from "antd";
import {
  DashboardOutlined,
  FileTextOutlined,
  TagsOutlined,
  TeamOutlined,
  BugOutlined,
  SoundOutlined,
  PictureOutlined,
  SettingOutlined,
  LogoutOutlined,
  BookOutlined,
  RobotOutlined,
  CheckSquareOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";

const { Sider, Content, Header } = Layout;

const menus = [
  { key: "/admin", icon: <DashboardOutlined />, label: "概览" },
  { key: "/admin/original", icon: <BookOutlined />, label: "原文管理" },
  { key: "/admin/quotes", icon: <FileTextOutlined />, label: "金句管理" },
  { key: "/admin/ai", icon: <RobotOutlined />, label: "AI 金句提取" },
  { key: "/admin/categories", icon: <TagsOutlined />, label: "分类管理" },
  { key: "/admin/users", icon: <TeamOutlined />, label: "用户管理" },
  { key: "/admin/crawler", icon: <BugOutlined />, label: "采集管理" },
  { key: "/admin/audit", icon: <CheckSquareOutlined />, label: "内容审核" },
  { key: "/admin/ads", icon: <SoundOutlined />, label: "广告配置" },
  { key: "/admin/cards", icon: <PictureOutlined />, label: "卡片模板" },
  { key: "/admin/config", icon: <SettingOutlined />, label: "系统配置" },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLogout, user } = useAuthStore();

  const selectedKey = menus.find((m) =>
    location.pathname === m.key || (m.key !== "/admin" && location.pathname.startsWith(m.key))
  )?.key || "/admin";

  // 退出后台：统一跳转到 /login
  const onAdminLogout = () => {
    adminLogout();
    navigate("/login");
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220} style={{ background: "#001529" }}>
        <div
          style={{
            color: "#fff",
            fontSize: 20,
            fontWeight: 700,
            textAlign: "center",
            padding: "20px 0 16px",
            borderBottom: "1px solid rgba(255,255,255,.1)",
          }}
        >
          📖 拾句后台
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          style={{ marginTop: 12 }}
          items={menus.map((m) => ({
            key: m.key,
            icon: m.icon,
            label: m.label,
            onClick: () => navigate(m.key),
          }))}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            管理后台
            {user?.nickname ? <span style={{ fontSize: 13, color: "#999", marginLeft: 12 }}>· {user.nickname}</span> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a onClick={() => navigate("/")} style={{ color: "#666", cursor: "pointer" }}>
              <HomeOutlined /> 返回前台
            </a>
            <a onClick={onAdminLogout} style={{ color: "#666", cursor: "pointer" }}>
              <LogoutOutlined /> 退出
            </a>
          </div>
        </Header>
        <Content style={{ margin: 16, padding: 24, background: "#fff", borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
