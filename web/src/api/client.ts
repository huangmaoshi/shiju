import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

const client: AxiosInstance = axios.create({
  baseURL: "/api",
  timeout: 120000,
});

client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const adminKey = localStorage.getItem("admin_key");
    if (adminKey) {
      config.headers["x-admin-key"] = adminKey;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const adminKey = localStorage.getItem("admin_key");
      const accessToken = localStorage.getItem("access_token");
      if (adminKey || accessToken) {
        localStorage.removeItem("admin_key");
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export default client;

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export async function apiGet<T = unknown>(path: string, params?: unknown): Promise<T> {
  const res = await client.get<ApiResponse<T>>(path, { params });
  if (res.data.code !== 0) throw new Error(res.data.message);
  return res.data.data;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await client.post<ApiResponse<T>>(path, body);
  if (res.data.code !== 0) throw new Error(res.data.message);
  return res.data.data;
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await client.put<ApiResponse<T>>(path, body);
  if (res.data.code !== 0) throw new Error(res.data.message);
  return res.data.data;
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await client.delete<ApiResponse<T>>(path);
  if (res.data.code !== 0) throw new Error(res.data.message);
  return res.data.data;
}
