import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  adminKey: string | null;
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (token: string, user: User) => void;
  setUser: (user: User) => void;
  adminLogin: (key: string) => void;
  logout: () => void;
  adminLogout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("access_token"),
  adminKey: localStorage.getItem("admin_key"),
  user: null,
  isLoggedIn: !!localStorage.getItem("access_token"),
  isAdmin: !!localStorage.getItem("admin_key"),
  login: (token: string, user: User) => {
    localStorage.setItem("access_token", token);
    const patch: Partial<AuthState> = { accessToken: token, user, isLoggedIn: true };
    // 管理员账号登录后自动获得后台访问权限
    if (user?.isAdmin) {
      localStorage.setItem("admin_key", token);
      patch.adminKey = token;
      patch.isAdmin = true;
    }
    set(patch);
  },
  setUser: (user: User) => set({ user }),
  adminLogin: (key: string) => {
    localStorage.setItem("admin_key", key);
    set({ adminKey: key, isAdmin: true });
  },
  logout: () => {
    localStorage.removeItem("access_token");
    set({ accessToken: null, user: null, isLoggedIn: false });
  },
  // 退出后台：清理 admin_key，若来源于管理员用户登录则一并清理用户态
  adminLogout: () => {
    localStorage.removeItem("admin_key");
    localStorage.removeItem("access_token");
    set({ adminKey: null, isAdmin: false, accessToken: null, user: null, isLoggedIn: false });
  },
}));
