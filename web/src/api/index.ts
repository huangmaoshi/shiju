import { apiGet, apiPost, apiPut, apiDelete } from "./client";
import type { DailyRecommend, DashboardStats, User, CrawlerTask, AdConfig, Quote, Category, OriginalText, AiConfig, AiTask } from "@/types";

export const userApi = {
  me: () => apiGet<User>("/v1/user/me"),
  // 微信登录
  wechatLogin: (code: string) => apiPost<{ token: string; expiresIn: number; user: User }>("/v1/auth/wechat-login", { code }),
  // 用户名密码登录
  login: (username: string, password: string) =>
    apiPost<{ token: string; expiresIn: number; user: User }>("/v1/auth/login", { username, password }),
  // 注册
  register: (username: string, password: string, nickname?: string) =>
    apiPost<{ token: string; expiresIn: number; user: User }>("/v1/auth/register", { username, password, nickname }),
  // 退出
  logout: () => apiPost("/v1/auth/logout"),
  // 刷新 token
  refresh: (token: string) => apiPost<{ token: string; openId: string }>("/v1/auth/refresh", { token }),
};

export const searchApi = {
  quotes: (keyword: string) => apiGet("/v1/search/quotes", { keyword }),
  hot: () => apiGet<string[]>("/v1/search/hot"),
  originalTextList: (keyword: string, page = 1, pageSize = 12) =>
    apiGet<{ list: any[]; total: number; page: number; pageSize: number }>("/v1/search/original-texts", { keyword, page, pageSize }),
};

export const dailyApi = {
  today: () => apiGet<DailyRecommend>("/v1/daily-recommend/today"),
};

export const statsApi = {
  home: () => apiGet<{ quoteTotal: number; categoryTotal: number; templateTotal: number; dailyRecommendCount: number }>("/v1/stats/home"),
};

export const collectionApi = {
  list: () => apiGet<any[]>("/v1/collections/"),
  create: (data: { name: string; description?: string }) => apiPost("/v1/collections/", data),
  update: (id: number, data: { name?: string; description?: string }) => apiPut(`/v1/collections/${id}`, data),
  remove: (id: number) => apiDelete<void>(`/v1/collections/${id}`),
  getQuotes: (id: number, params?: { page?: number; pageSize?: number }) =>
    apiGet<{ total: number; list: any[] }>(`/v1/collections/${id}/quotes`, params),
  // 一键加入默认摘抄本
  collectQuote: (quoteId: number) => apiGet(`/v1/collections/quotes/${quoteId}/collect`),
  uncollectQuote: (quoteId: number) => apiDelete(`/v1/collections/quotes/${quoteId}/collect`),
  // 加入指定摘抄本
  addQuoteTo: (collectionId: number, data: { quoteId?: number; customQuoteId?: number }) =>
    apiPost(`/v1/collections/${collectionId}/quotes`, data),
  removeQuote: (collectionId: number, recordId: number) =>
    apiDelete<void>(`/v1/collections/${collectionId}/quotes/${recordId}`),
};

// Admin API - 完整覆盖后端 admin_routes
export const adminApi = {
  // Dashboard
  dashboard: () => apiGet<DashboardStats>("/v1/admin/dashboard"),
  statsOverview: () => apiGet("/v1/admin/stats/overview"),

  // Quotes
  quotes: (params?: any) => apiGet<{ list: Quote[]; total: number; page: number; pageSize: number }>("/v1/admin/quotes", params),
  quoteCreate: (data: any) => apiPost<Quote>("/v1/admin/quotes", data),
  quoteUpdate: (id: number, data: any) => apiPut<Quote>(`/v1/admin/quotes/${id}`, data),
  quoteDelete: (id: number) => apiDelete<void>(`/v1/admin/quotes/${id}`),
  quoteToggle: (id: number, isActive: boolean) => apiPut(`/v1/admin/quotes/${id}/toggle`, { isActive }),

  // Categories
  categories: () => apiGet<Category[]>("/v1/admin/categories"),
  categoryCreate: (data: any) => apiPost<Category>("/v1/admin/categories", data),
  categoryUpdate: (id: number, data: any) => apiPut<Category>(`/v1/admin/categories/${id}`, data),
  categoryDelete: (id: number) => apiDelete<void>(`/v1/admin/categories/${id}`),

  // Users
  users: (params?: any) => apiGet<{ list: User[]; total: number; page: number; pageSize: number }>("/v1/admin/users", params),
  userCreate: (data: any) => apiPost<User>("/v1/admin/users", data),
  userUpdate: (id: number, data: any) => apiPut<User>(`/v1/admin/users/${id}`, data),
  userBan: (id: number) => apiPut(`/v1/admin/users/${id}/ban`),
  userUnban: (id: number) => apiPut(`/v1/admin/users/${id}/unban`),
  userDelete: (id: number) => apiDelete<void>(`/v1/admin/users/${id}`),

  // System Config
  systemConfig: () => apiGet<any[]>("/v1/admin/system-config"),
  systemConfigBatchUpdate: (items: any[]) => apiPut("/v1/admin/system-config", { items }),

  // Payment Config
  paymentConfigs: () => apiGet<any[]>("/v1/admin/payment-config"),
  paymentConfigUpsert: (data: any) => apiPost("/v1/admin/payment-config", data),

  // Ads
  ads: () => apiGet<AdConfig[]>("/v1/admin/ads"),
  adCreate: (data: any) => apiPost<AdConfig>("/v1/admin/ads", data),
  adUpdate: (id: number, data: any) => apiPut<AdConfig>(`/v1/admin/ads/${id}`, data),
  adDelete: (id: number) => apiDelete<void>(`/v1/admin/ads/${id}`),

  // Card Templates
  cards: () => apiGet("/v1/admin/cards"),
  cardCreate: (data: any) => apiPost("/v1/admin/cards", data),
  cardUpdate: (id: number, data: any) => apiPut(`/v1/admin/cards/${id}`, data),
  cardDelete: (id: number) => apiDelete<void>(`/v1/admin/cards/${id}`),

  // Crawl Sources
  crawlSources: () => apiGet("/v1/admin/crawl/sources"),
  crawlSourceCreate: (data: any) => apiPost("/v1/admin/crawl/sources", data),
  crawlSourceUpdate: (id: number, data: any) => apiPut(`/v1/admin/crawl/sources/${id}`, data),
  crawlSourceDelete: (id: number) => apiDelete<void>(`/v1/admin/crawl/sources/${id}`),
  crawlSourceCheck: (id: number) => apiGet<any>(`/v1/admin/crawl/sources/${id}/check`),
  crawlSourceCheckAll: () => apiGet<any>("/v1/admin/crawl/sources-check-all"),

  // Crawl Tasks
  crawlers: (params?: any) => apiGet<CrawlerTask[] | any>("/v1/admin/crawlers", params), // 兼容别名
  crawlTasks: (params?: any) => apiGet("/v1/admin/crawl/tasks", params),
  runCrawler: (data: any) => apiPost<CrawlerTask>("/v1/admin/crawl/run", data),
  crawlStop: (id: number) => apiPost(`/v1/admin/crawl/tasks/${id}/stop`),

  // Crawl Records / Audit
  crawlRecords: (params?: any) => apiGet("/v1/admin/crawl/records", params),
  crawlAudit: (data: any) => apiPost("/v1/admin/crawl/audit", data),

  // Crawl Schedule
  crawlSchedule: () => apiGet("/v1/admin/crawl/schedule"),
  crawlScheduleCreate: (data: any) => apiPost("/v1/admin/crawl/schedule", data),
  crawlScheduleUpdate: (id: number, data: any) => apiPut(`/v1/admin/crawl/schedule/${id}`, data),
    crawlSourceStats: () => apiGet<any>('/v1/admin/crawl/source-stats'),
    crawlImport: (sourceId: number) => apiPost<any>('/v1/admin/crawl/import', { sourceId }),
  crawlScheduleDelete: (id: number) => apiDelete<void>(`/v1/admin/crawl/schedule/${id}`),

  // Crawl Schedule 启停 / 立即执行
  crawlScheduleEnable: (id: number) => apiPost(`/v1/admin/crawl/schedule/${id}/enable`),
  crawlScheduleDisable: (id: number) => apiPost(`/v1/admin/crawl/schedule/${id}/disable`),
  crawlScheduleTrigger: (id: number) => apiPost(`/v1/admin/crawl/schedule/${id}/trigger`),

  // 审核
  pendingAuditStats: () => apiGet<{ originalCount: number; quoteCount: number }>('/v1/admin/audit/pending-stats'),
  auditOriginalTexts: (ids: number[], auditStatus: number, auditReason?: string) =>
    apiPost('/v1/admin/audit/original-texts', { ids, auditStatus, auditReason }),
  auditQuotes: (ids: number[], auditStatus: number, auditReason?: string) =>
    apiPost('/v1/admin/audit/quotes', { ids, auditStatus, auditReason }),

  // Original Texts (admin)
  originalTexts: (params?: any) => apiGet<{ list: OriginalText[]; total: number; page: number; pageSize: number }>("/v1/admin/original-texts", params),
  originalTextDetail: (id: number) => apiGet<OriginalText>(`/v1/admin/original-texts/${id}`),
};

export const originalTextApi = {
  list: (params?: any) => apiGet<{ list: OriginalText[]; total: number; page: number; pageSize: number }>("/v1/original-texts", params),
  get: (id: number) => apiGet<OriginalText>(`/v1/original-texts/${id}`),
  create: (data: any) => apiPost<OriginalText>("/v1/original-texts", data),
  update: (id: number, data: any) => apiPut<OriginalText>(`/v1/original-texts/${id}`, data),
  remove: (id: number) => apiDelete<void>(`/v1/original-texts/${id}`),
  addQuote: (id: number, content: string) => apiPost<Quote>(`/v1/original-texts/${id}/add-quote`, { content }),
};

export const aiApi = {
  configList: () => apiGet<AiConfig[]>("/v1/ai/configs"),
  configCreate: (data: any) => apiPost<AiConfig>("/v1/ai/configs", data),
  configUpdate: (id: number, data: any) => apiPut<AiConfig>(`/v1/ai/configs/${id}`, data),
  configDelete: (id: number) => apiDelete<void>(`/v1/ai/configs/${id}`),
  configSetDefault: (id: number) => apiPost<void>(`/v1/ai/configs/${id}/default`),
  taskList: () => apiGet<AiTask[]>("/v1/ai/tasks"),
  extractSingle: (data: any) => apiPost("/v1/ai/extract/single", data),
  extractBatch: (data: any) => apiPost("/v1/ai/extract/batch", data),
  // 拼音生成
  pinyinQuoteSingle: (data: any) => apiPost("/v1/ai/pinyin/quote/single", data),
  pinyinQuoteBatch: (data: any) => apiPost("/v1/ai/pinyin/quote/batch", data),
  pinyinOriginalTextSingle: (data: any) => apiPost("/v1/ai/pinyin/original-text/single", data),
  pinyinOriginalTextBatch: (data: any) => apiPost("/v1/ai/pinyin/original-text/batch", data),
  // 繁转简
  simplifyText: (data: any) => apiPost<{ simplifiedText: string }>("/v1/ai/simplify/text", data),
  simplifyQuoteSingle: (data: any) => apiPost("/v1/ai/simplify/quote/single", data),
  simplifyQuotesBatch: (data: any) => apiPost("/v1/ai/simplify/quote/batch", data),
  simplifyOriginalTextSingle: (data: any) => apiPost("/v1/ai/simplify/original-text/single", data),
  simplifyOriginalTextsBatch: (data: any) => apiPost("/v1/ai/simplify/original-text/batch", data),
  // 一键批量处理
  oneClickStats: () => apiGet<any>("/v1/ai/one-click/stats"),
  oneClickPinyin: (data: any) => apiPost("/v1/ai/one-click/pinyin", data),
  oneClickExtract: (data: any) => apiPost("/v1/ai/one-click/extract", data),
  oneClickSimplifyLocal: (data: any) => apiPost("/v1/ai/one-click/simplify-local", data),
  // AI 自动分类
  classifyQuoteSingle: (data: any) => apiPost("/v1/ai/classify/quote/single", data),
  classifyQuoteBatch: (data: any) => apiPost("/v1/ai/classify/quote/batch", data),
  classifyOriginalTextSingle: (data: any) => apiPost("/v1/ai/classify/original-text/single", data),
  classifyOriginalTextBatch: (data: any) => apiPost("/v1/ai/classify/original-text/batch", data),
  oneClickClassifyStats: () => apiGet<any>("/v1/ai/one-click/classify-stats"),
  oneClickClassify: (data: any) => apiPost("/v1/ai/one-click/classify", data),
};
