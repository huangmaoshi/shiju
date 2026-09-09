export interface Quote {
  id: number;
  content: string;
  pinyinData?: string;
  simplifiedContent?: string;
  author?: string;
  source?: string;
  sourceUrl?: string;
  categoryIds?: number[];
  categories?: Category[] | string[];
  originalText?: OriginalText;
  isFree: boolean;
  isActive: boolean;
  viewCount: number;
  collectCount: number;
  createdAt: string;
}

export interface QuoteList {
  list: Quote[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Category {
  id: number;
  name: string;
  type: "content_type" | "theme" | "scene";
  sort: number;
  parentId?: number;
  quoteCount?: number;
}

export interface User {
  id: string;
  openId?: string;
  username?: string;
  nickname?: string;
  avatar?: string;
  userType?: string;
  isAdmin?: boolean;
  memberLevel: number;
  isPaidMember?: boolean;
  isTrialActive?: boolean;
  trialExpireAt?: string;
  memberExpireDate?: string;
  canUseFeature?: boolean;
  isBanned?: boolean;
  status: number;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Collection {
  id: number;
  userId: number;
  name: string;
  quoteCount: number;
  isDefault: boolean;
  createdAt: string;
}

export interface DailyRecommend {
  id: number;
  date: string;
  quotes: Quote[];
}

export interface CardTemplate {
  id: number;
  name: string;
  style: string;
  bgType?: string;
  bgValue?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  lineHeight?: number;
  textAlign?: string;
  showAuthor?: number;
  showWatermark?: number;
  isMember?: number;
  status?: number;
  previewUrl?: string;
  isFree?: boolean;
  sort?: number;
}

export interface AdConfig {
  id: number;
  position: string;
  title: string;
  imageUrl?: string;
  targetUrl?: string;
  type: string;
  priority: number;
  startAt?: string;
  endAt?: string;
  isActive: boolean;
}

export interface CrawlerTask {
  id: number;
  provider: string;
  status: "pending" | "running" | "success" | "failed";
  startAt?: string;
  endAt?: string;
  totalCount: number;
  newCount: number;
  errorMessage?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalQuotes: number;
  totalCollections: number;
  todayNewUsers: number;
  todayNewQuotes: number;
  memberCount: number;
  recentCrawlers: CrawlerTask[];
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface OriginalText {
  id: number;
  title: string;
  author?: string;
  source?: string;
  sourceUrl?: string;
  categoryType?: string;
  content: string;
  pinyinData?: string;
  simplifiedContent?: string;
  auditStatus?: number;
  complianceTag?: string;
  wordCount: number;
  quoteCount: number;
  status: "draft" | "published" | "archived";
  quotes?: Quote[];
  createdAt: string;
  updatedAt?: string;
}

export interface AiConfig {
  id: number;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  promptTemplate?: string;
  pinyinPromptTemplate?: string;
  simplifyPromptTemplate?: string;
  timeoutMs?: number;
  retryCount?: number;
  batchConcurrency?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AiTask {
  id: number;
  status: "pending" | "running" | "success" | "failed";
  totalCount: number;
  successCount: number;
  failedCount: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  errorMessage?: string;
  results?: Array<{ originalTextId: number; quoteCount: number; success: boolean }>;
  createdAt: string;
}
