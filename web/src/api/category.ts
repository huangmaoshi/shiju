import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { Category } from "@/types";

export const categoryApi = {
  list: (type?: string) => apiGet<Category[]>("/v1/categories/", type ? { type } : undefined),
  create: (data: Partial<Category>) => apiPost<Category>("/v1/categories/", data),
  update: (id: number, data: Partial<Category>) => apiPut<Category>(`/v1/categories/${id}`, data),
  remove: (id: number) => apiDelete<void>(`/v1/categories/${id}`),
};
