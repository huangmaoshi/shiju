import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { Quote, QuoteList, PaginationQuery } from "@/types";

export const quoteApi = {
  list: (params?: PaginationQuery & { categoryId?: number }) =>
    apiGet<QuoteList>("/v1/quotes/", params as any),

  detail: (id: number) => apiGet<Quote>(`/v1/quotes/${id}`),

  random: (limit = 5) => apiGet<Quote[]>(`/v1/quotes/random?limit=${limit}`),

  create: (data: Partial<Quote>) => apiPost<Quote>("/v1/quotes/", data),

  update: (id: number, data: Partial<Quote>) => apiPut<Quote>(`/v1/quotes/${id}`, data),

  remove: (id: number) => apiDelete<void>(`/v1/quotes/${id}`),

  setActive: (id: number, isActive: boolean) =>
    apiPut<Quote>(`/v1/quotes/${id}/status`, { isActive }),
};
