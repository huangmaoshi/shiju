import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Dropdown, Avatar } from "antd";
import {
  HomeOutlined,
  BookOutlined,
  SearchOutlined,
  StarOutlined,
  ReadOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { userApi } from "@/api";

const { Header, Content, Footer } = Layout;

export default function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn, user, setUser, logout } = useAuthStore();

  // 页面刷新后恢复用户信息（含管理员标记）
  useEffect(() => {
    if (!isLoggedIn) return;
    if (user) return;
    userApi.me()
      .then((u) => { if (u) setUser(u); })
      .catch(() => {});
  }, [isLoggedIn, user, setUser]);

  const selectedKey =
    location.pathname === "/"
      ? "/"
      : location.pathname.startsWith("/quotes")
      ? "/quotes"
      : location.pathname.startsWith("/search")
      ? "/search"
      : location.pathname.startsWith("/collections")
      ? "/collections"
      : location.pathname.startsWith("/recite")
      ? "/recite"
      : "/";

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      <Header
        style={{
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Link to="/" style={{ fontSize: 22, fontWeight: 700, color: "#667eea", marginRight: 32 }}>
          📖 拾句
        </Link>
        <Menu
          mode="horizontal"
          selectedKeys={[selectedKey]}
          style={{ flex: 1, borderBottom: 0, fontSize: 15 }}
          items={[
            { key: "/", icon: <HomeOutlined />, label: "首页" },
            { key: "/quotes", icon: <BookOutlined />, label: "金句库" },
            { key: "/search", icon: <SearchOutlined />, label: "搜索" },
            { key: "/collections", icon: <StarOutlined />, label: "摘抄本" },
            { key: "/recite", icon: <ReadOutlined />, label: "背诵" },
          ]}
          onClick={({ key }) => navigate(key)}
        />
        <div style={{ marginLeft: "auto" }}>
          {isLoggedIn ? (
            <Dropdown
              menu={{
                items: [
                  // 仅管理员显示“进入后台”入口
                  ...(user?.isAdmin
                    ? [{ key: "admin", icon: <DashboardOutlined />, label: "进入后台", onClick: () => navigate("/admin") }]
                    : []),
                  { key: "logout", icon: <LogoutOutlined />, label: "退出登录", onClick: async () => { try { await userApi.logout(); } catch {} logout(); navigate("/login"); } },
                ],
              }}
            >
              <Avatar
                src={user?.avatar}
                style={{ background: user?.isAdmin ? "#fa541c" : "#667eea", cursor: "pointer" }}
              >
                {user?.nickname?.[0] || <UserOutlined />}
              </Avatar>
            </Dropdown>
          ) : (
            <Button type="primary" onClick={() => navigate("/login")}>
              登录
            </Button>
          )}
        </div>
      </Header>
      <Content style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: "center", background: "transparent", color: "#999" }}>
        拾句 · 作文素材与金句摘抄库 © {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
}
