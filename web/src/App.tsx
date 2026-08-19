import { Routes, Route, Navigate } from "react-router-dom";
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";
import { useAuthStore } from "./stores/auth";

import Home from "./pages/user/Home";
import Quotes from "./pages/user/Quotes";
import QuoteDetail from "./pages/user/QuoteDetail";
import OriginalTextDetail from "./pages/user/OriginalTextDetail";
import Search from "./pages/user/Search";
import Login from "./pages/user/Login";
import Collections from "./pages/user/Collections";
import CollectionDetail from "./pages/user/CollectionDetail";
import Recite from "./pages/user/Recite";

import Dashboard from "./pages/admin/Dashboard";
import QuoteAdmin from "./pages/admin/quotes/QuoteAdmin";
import CategoryAdmin from "./pages/admin/categories/CategoryAdmin";
import UserAdmin from "./pages/admin/users/UserAdmin";
import CrawlerAdmin from "./pages/admin/crawler/CrawlerAdmin";
import AdAdmin from "./pages/admin/ads/AdAdmin";
import CardTemplateAdmin from "./pages/admin/card/CardTemplateAdmin";
import ConfigAdmin from "./pages/admin/config/ConfigAdmin";
import OriginalTextAdmin from "./pages/admin/original/OriginalTextAdmin";
import AiConfigAdmin from "./pages/admin/ai/AiConfigAdmin";
import AuditAdmin from "./pages/admin/audit/AuditAdmin";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.isAdmin);
  if (!isAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// 客户端登录守卫：未登录用户强制跳转登录页
function UserGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<UserGuard><UserLayout /></UserGuard>}>
        <Route path="/" element={<Home />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/:id" element={<QuoteDetail />} />
        <Route path="/original-text/:id" element={<OriginalTextDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:id" element={<CollectionDetail />} />
        <Route path="/recite" element={<Recite />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminGuard>
            <AdminLayout />
          </AdminGuard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="quotes" element={<QuoteAdmin />} />
        <Route path="categories" element={<CategoryAdmin />} />
        <Route path="users" element={<UserAdmin />} />
        <Route path="crawler" element={<CrawlerAdmin />} />
        <Route path="ads" element={<AdAdmin />} />
        <Route path="cards" element={<CardTemplateAdmin />} />
        <Route path="config" element={<ConfigAdmin />} />
        <Route path="original" element={<OriginalTextAdmin />} />
        <Route path="ai" element={<AiConfigAdmin />} />
        <Route path="audit" element={<AuditAdmin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
