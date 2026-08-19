# 📖 拾句 · 作文素材与金句摘抄库

> 面向中学生 / 写作者的金句收藏与作文素材应用，提供内容浏览、搜索、收藏、背诵打卡、每日推荐、**AI 金句提取**、**AI 拼音标注**、**AI 繁转简**、**AI 自动分类**（支持 OpenAI / 百炼 / 千帆 / 智谱 / DeepSeek / Moonshot / **火山方舟** 等主流大模型）、**GitHub 数据自动采集**、**原文审核流程**、VIP 会员体系等功能。

---

## 1. 项目架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端层                                        │
│  ┌──────────────┐  ┌────────────────────────────┐  ┌─────────────────────┐  │
│  │  Flutter App │  │   Web 管理后台 (React + Vite)│  │  管理后台（审核/采集/AI）│  │
│  │  (移动端)     │  │   Ant Design + Tailwind    │  │  http://localhost:5173  │  │
│  └──────┬───────┘  └──────────────┬─────────────┘  └──────────┬──────────┘  │
│         │ HTTPS                   │ /api/* 代理                │              │
└─────────┼─────────────────────────┼────────────────────────────┼──────────────┘
          │                         │                            │
          ▼                         ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              后端 API 层   Node.js + Express 4 + TypeScript                 │
│                                                                             │
│  Controller → Service → Prisma → SQLite / MySQL                             │
│  中间件：JWT 鉴权 / Admin Key / 会员拦截 / 限流 / 错误处理 / CORS / Helmet    │
│                                                                             │
│  内置能力：                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  AI 金句提取服务   │  │  GitHub 直导入服务   │  │  Cron 定时采集调度器        │  │
│  │  多 Provider 兼容  │  │  自动 URL 编码       │  │  node-cron 驱动           │  │
│  │  OpenAI 协议统一   │  │  超时 + 自动重试      │  │  任务可配置启停/立即执行   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  AI 拼音标注       │  │  AI 繁转简           │  │  AI 自动分类               │  │
│  │  逐字标注带声调     │  │  本地映射（零成本）    │  │  自动注入分类列表          │  │
│  │  提示词可配置       │  │  + AI 精准转换        │  │  多维度分类树 70+ 节点     │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  一键批量处理       │  │  原文审核流程        │  │  Prisma ORM + SQLite      │  │
│  │  拼音/提取/繁转简   │  │  批量审核接口        │  │  开发轻量 / 生产 MySQL     │  │
│  │  分类 一键搞定      │  │  待审原文不对用户展示│  │  schema 已含全部采集字段    │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌───────────────────────┐  ┌───────────────────────────────────────────────┐
│  数据库 (SQLite/MySQL) │  │  GitHub Raw / 公网 JSON 数据源                │
│  原文 / 金句 / 采集 / AI │  │  chinese-poetry / poetry-dataset / quotes ... │
│  配置 / 会员 / 订单      │  │  （后端内置 HTTP fetch + 30s 超时 + 3 次重试）  │
└───────────────────────┘  └───────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│              独立采集子模块  crawler/（可选，已有的代码实现）                   │
│  providers: GitHubDataset / GuWenWen / MingYan / WikiQuote                 │
│  engine: Got + Cheerio + 自建 SimHash 去重                                    │
│  后端内置 github_import_service 已经可以直接用                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
拾句/
├── server/                     # 后端 API 服务（Node.js + Express + Prisma）
│   ├── prisma/                 #   数据库模型 + 种子数据 + SQLite 文件
│   │   ├── schema.prisma       #     全部数据模型（含采集/AI/审核字段）
│   │   └── seed.ts             #     初始化采集源、分类、系统配置
│   ├── src/
│   │   ├── config/             #   配置加载
│   │   ├── controllers/        #   控制器（20+，涵盖用户/内容/AI/采集/审核）
│   │   ├── services/           #   业务逻辑层
│   │   │   ├── ai_service.ts           # AI 金句提取任务管理
│   │   │   ├── github_import_service.ts # GitHub 直导入（带超时+重试+去重）
│   │   │   ├── cron_service.ts         # 定时采集调度器（node-cron）
│   │   │   ├── original_text_service.ts# 原文库服务
│   │   │   └── ...
│   │   ├── middlewares/        #   auth / admin / feature / rate_limit / error
│   │   ├── routes/             #   17 组路由
│   │   ├── utils/              #   工具函数
│   │   │   ├── ai_client.ts           # AI HTTP 客户端（统一 OpenAI 协议）
│   │   │   ├── dedup.ts               # MD5 + SimHash 去重引擎
│   │   │   └── ...
│   │   ├── types/              #   TypeScript 类型
│   │   ├── app.ts              #   Express 应用组装
│   │   └── server.ts           #   启动入口 + CronScheduler 自动启动
│   └── package.json
│
├── web/                        # 管理后台（React 18 + Vite + Ant Design + Tailwind）
│   ├── src/
│   │   ├── api/                #   client.ts + adminApi 封装
│   │   ├── layouts/            #   AdminLayout / UserLayout
│   │   ├── pages/
│   │   │   ├── admin/          #     Dashboard / Users / Quotes / Original / Categories
│   │   │   │                    #     / AI / Crawler / Audit / Ads / Card / Config
│   │   │   └── user/           #     Home / Quotes / Search / Collections / Recite ...
│   │   └── stores/             #   Zustand 状态
│   └── package.json
│
├── app/                        # 移动端（Flutter 3.x + Provider + Dio）
│   └── lib/
│       ├── config/             #   API 地址
│       ├── models/             #   数据模型
│       ├── pages/              #   Home / Library / Search / Collection / Recite / Member ...
│       ├── providers/          #   状态管理
│       ├── services/           #   15 组 API 客户端
│       └── widgets/            #   公共组件
│
├── crawler/                    # 独立采集子模块（可选，已实现的代码版本）
│   └── src/
│       ├── providers/          #   GitHubDataset / GuWenWen / MingYan / WikiQuote
│       ├── engine/             #   deduper / http_client / parser
│       └── processors/         #   content_cleaner / db_writer / sensitive_checker
│
├── README.md
├── 产品文档.md
├── 技术编码文档.md
├── docker-compose.yml          # Docker 一键部署
├── .env.example                # 环境变量示例
└── .gitignore
```

### 技术栈

| 模块 | 技术 | 说明 |
|---|---|---|
| 后端运行时 | Node.js ≥ 18（推荐 20 LTS） | Express 4.x |
| 后端语言 | TypeScript 5 | 路径别名 `@/` 指向 `src/` |
| ORM | Prisma 5 | SQLite（开发）/ MySQL（生产） |
| 鉴权 | JWT (jsonwebtoken) + Admin Key | 双鉴权：用户端 Bearer Token / 管理后台 x-admin-key |
| 密码存储 | PBKDF2-SHA512 | 零依赖 Node 内置 crypto |
| 日志 | Winston + Morgan | 文件 + 控制台 |
| 参数校验 | Zod | 输入安全 |
| AI 接入 | **OpenAI 兼容协议**（HTTP fetch） | 金句提取 / 拼音标注 / 繁转简 / 自动分类，提示词模板可配置 |
| 本地繁简转换 | 纯 JS 映射表（`trad_to_simpl.ts`） | 1000+ 常用繁简字映射，零 API 成本 |
| 定时任务 | node-cron | 采集调度器，Cron 表达式可配置 |
| 去重算法 | **MD5 精确匹配 + SimHash 相似度** | 短文本 <100 字 MD5，长文本 ≥100 字 SimHash（汉明距离 ≤10 → 相似度 >85%） |
| GitHub 直导入 | Node.js 原生 fetch + AbortController | 30s 超时、3 次自动重试、指数退避、中文路径自动 URL 编码 |
| 管理后台 | React 18 + Ant Design 5 + Vite + Tailwind | 5173 端口，开发代理 `/api/*` → :3000 |
| 移动端 | Flutter 3.x | Provider + Dio |
| 容器化 | Docker + docker-compose | node:20-alpine |

---

## 2. 核心功能一览

### 用户端功能
- 首页随机推荐 / 每日精选金句
- 分类浏览（内容类型 / 主题 / 场景）
- 全文搜索金句 + 原文（带关键词高亮）
- 收藏夹 / 自定义金句录入
- 背诵打卡（艾宾浩斯复习）
- 卡片生成导出（会员专属模板）
- 金句原文查看 + **选段一键加金句**（选中原文任意文本 → 浮动气泡「加为金句」）
- 登录：微信扫码 / 账号密码注册登录
- 会员中心：月卡 / 季卡 / 包年 购买 + 微信支付

### 管理后台功能
- Dashboard 数据总览（用户/金句/收入图表）
- 用户管理（创建/编辑/封禁/会员/试用设置/重置密码）
- 金句 CRUD + 启用开关
- 原文库管理（原文录入 + 选段生成金句 + MD5/SimHash 自动指纹）
- **AI 金句提取**：多模型配置（OpenAI/百炼/千帆/智谱/DeepSeek/Moonshot/**火山方舟**）、单篇/批量任务、**自动 SimHash 去重**、提示词模板可配置
- **AI 拼音标注**：逐字标注带声调拼音，金句和原文均支持，单条/批量/一键处理，提示词模板可配置
- **AI 繁转简**：**本地纯 JS 映射**（1000+ 常用繁简字，零 API 成本）+ AI 精准转换双模式，单条/批量/一键处理
- **AI 自动分类**：自动获取现有分类列表注入 AI 提示词，AI 从分类列表中选择最合适分类（1-5个），金句和原文均支持，单条/批量/一键处理，提示词模板可配置
- **一键批量处理**：一键生成缺失拼音 + 一键提取零金句原文 + 一键繁转简 + 一键自动分类，串行处理带进度追踪
- **AI 稳定性**：支持重试次数、超时时间、批量并发数配置，请求失败自动重试
- **采集管理**：
  - 采集源管理（50+ 预设源，覆盖古诗/词/文/语录/台词）
  - GitHub Raw **手动直导入**（带进度/去重）
  - **定时采集调度**：Cron 表达式配置、任务启停、立即执行
- **原文审核**：采集/AI 提取的原文默认 `auditStatus=0`（待审），**不对用户展示**；支持批量审核通过/拒绝
- 分类管理（4 大维度 70+ 分类：内容类型/主题/用途场景/时代，支持多级父子，金句和原文共用）
- 广告配置（穿山甲 / 自运营 Banner）
- 卡片模板管理
- 系统配置（默认试用天数 / 微信支付 AppID-MchID-APIKey）

### 会员体系
```
试用用户  →  自动注册即送 N 天（后台可配）
   ↓ 到期
非会员（免费）→  基础功能受限
   ↓ 购买月卡/季卡
普通会员（memberLevel=1）
   ↓ 购买包年
高级会员（memberLevel=2）
```

### 内容合规
- 合规内容标记（不限于公版）：`complianceTag = public_domain / mit / apache / cc0 / translated`
- 采集源 `protocol` 字段标注协议类型（PD / MIT / Apache-2.0 / CC0 等）
- **审核流程**：所有采集/AI 提取的原文默认待审，必须人工审核通过后才对用户展示
- 去重算法确保不会重复入库

---

## 3. 数据采集与去重机制

### 采集方式

后端内置 **两种采集模式**，共享同一套 Cron 调度器和审核流程：

#### 模式一：GitHub Raw 直导入（推荐，已实现并稳定运行）

后端 `github_import_service.ts` 直接从 GitHub 仓库的 `raw.githubusercontent.com` JSON 文件抓取数据。前端管理后台 → 采集管理 → 选采集源 → 点「导入」。

**特性**：
- 自动 URL 拼接：`baseUrl` + `remark`（仓库路径），支持**中文目录自动 URL 编码**
- 网络健壮性：30s 超时、3 次重试、指数退避（1.5s → 3s → 4.5s）、详细错误信息
- 内置 50+ 预设采集源（chinese-poetry / poetry-dataset / quotes / 名人名言 / 电影台词 ...）

#### 模式二：定时自动采集

后端启动时 `server.ts` → `cronScheduler.startAll()` 自动加载所有 `enabled=1` 的 `CrawlSchedule`，注册为 node-cron job，到点自动执行。

管理后台 → 采集管理 → ⏰ 定时采集 Tab：
- 配置 Cron 表达式（5 段标准格式：`* * * * * *` 分 时 日 月 周）
- 启用/停用开关
- 立即执行按钮（不等 Cron 到点）
- 实时查看 `nextRunAt` / `lastRunAt` / 上次执行结果

### 分级去重策略

所有采集/AI 提取的数据入库前都会经过**三重去重检查**：

```
                    ┌─────────────────────────────────────────┐
  新内容进入  ───►  │ ① 本地批次内 MD5 快速拦截                 │
                    │    同一批数据内先算一次 MD5              │
                    └──────────────┬──────────────────────────┘
                                   │ 未拦截
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │ ② 正式库 + 临时库 MD5 精确比对           │
                    │    Quote.contentMd5 / OriginalText.contentMd5 │
                    │    CrawlRecord.fingerprint              │
                    └──────────────┬──────────────────────────┘
                                   │ 未拦截
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │ ③ 长文本 SimHash 相似度判定               │
                    │    文本长度 < 100 字 → 跳过此步           │
                    │    文本长度 ≥ 100 字 → SimHash 指纹比对    │
                    │    汉明距离 ≤ 10 → 相似度 > 85% → 重复    │
                    └─────────────────────────────────────────┘
                                   │ 未拦截
                                   ▼
                            入库（auditStatus=0）
```

### 审核流程

```
采集 / AI 提取
       │
       ▼
  OriginalText / Quote
  auditStatus = 0（待审）
       │
       ▼
  用户端查询: WHERE auditStatus = 1
  → 待审原文/金句 不对用户展示 ✅
       │
       ▼
  管理后台 → 审核管理 → 批量通过
  auditStatus = 1（通过）
       │
       ▼
  用户端可见 ✅
```

---

## 4. AI 金句提取

### 支持的 Provider

后端采用 **OpenAI 兼容协议**（`/chat/completions` + Bearer Token），天然支持所有兼容 OpenAI 的大模型服务商。管理后台 AI 配置页面内置了常用 Provider 的**一键预填**：

| Provider | 默认 Base URL | 常见模型 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | gpt-4o / gpt-4o-mini |
| 火山方舟 (豆包) | `https://ark.cn-beijing.volces.com/api/v3` | doubao-1-5-pro / doubao-1-5-lite / doubao-pro-32k / doubao-pro-128k |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-plus / qwen-turbo / qwen-max |
| 百度千帆 | `https://qianfan.baidubce.com/v2` | ernie-4.0-turbo / ernie-speed-8k |
| 智谱 | `https://open.bigmodel.cn/api/paas/v4` | glm-4 / glm-4-plus |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat / deepseek-reasoner |
| Moonshot (Kimi) | `https://api.moonshot.cn/v1` | moonshot-v1-8k / moonshot-v1-32k |
| 自定义 | 手填 | 任意兼容 OpenAI 的模型 |

### 使用流程

1. 管理后台 → AI 金句提取管理 → **新建 AI 配置**
2. 选择 Provider → Base URL 自动预填 → 选模型 → 填 API Key → 保存
3. 到 **AI 金句提取** Tab：选原文 → 选 AI 配置 → 开始提取
4. 提取结果自动经过 **SimHash 去重**，重复金句不入库
5. 提取到的金句默认 `auditStatus=0`，到审核管理通过后对用户展示

### HTTP 请求示例（以火山方舟为例）

```bash
curl https://ark.cn-beijing.volces.com/api/v3/chat/completions \
  -H "Authorization: Bearer ${ARK_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "doubao-1-5-pro",
    "messages": [{"role": "user", "content": "从以下原文中提取 5 条有感染力的金句..."}],
    "temperature": 0.7
  }'
```

后端 `ai_client.ts` 统一构造这类请求，换 Provider 只需换 `baseUrl` 和 `apiKey`。

---

## 4.1 AI 全功能矩阵

拾句内置 **4 大 AI 功能 + 一键批量处理**，共享同一套 AI 配置（Provider / API Key / 模型 / 提示词模板 / 超时重试），在管理后台 → AI 智能功能管理 中统一管理。

| 功能 | 说明 | 提示词占位符 | 模板字段 |
|---|---|---|---|
| AI 金句提取 | 从原文中提取 3-8 句金句，自动 SimHash 去重 | `{type}` `{content}` | `promptTemplate` |
| AI 拼音标注 | 逐字标注带声调拼音，返回 JSON 数组 | `{content}` | `pinyinPromptTemplate` |
| AI 繁转简 | 繁体/异体字 → 标准简体中文 | `{content}` | `simplifyPromptTemplate` |
| AI 自动分类 | 自动获取分类列表注入，AI 选择 1-5 个分类 | `{categories}` `{content}` | `classifyPromptTemplate` |

### 分类体系

金句和原文**共用同一套分类**，每个条目可有多个分类（多对多关系）。4 大维度 70+ 节点：

| 维度 | type | 分类示例 |
|---|---|---|
| 内容类型 | `content_type` | 古诗词曲（唐诗/宋词/元曲/诗经/楚辞…）、现代诗歌、名人名言、谚语俗语、影视台词、名著摘句、歌词… |
| 主题 | `theme` | 青春成长、家国情怀、情感共情、思辨哲理、文化传承、科技教育、社会观察、励志奋斗、自然风光… |
| 用途场景 | `scene` | 作文开头、作文结尾、过渡衔接、论点论据、抒情描写… |
| 时代 | `era` | 先秦、汉魏、南北朝、唐代、宋代、元代、明代、清代、近现代、当代 |

### AI 自动分类工作流

```
1. 获取所有启用的分类列表（ID | 分类名 | 维度 | 父分类）
2. 注入提示词模板 {categories} 占位符
3. AI 分析内容，从列表中选择 1-5 个最合适的分类
4. 返回 JSON 数组 [1, 5, 12]
5. 先删除旧关联 → 写入新关联（QuoteCategory / OriginalTextCategory）
```

### 一键批量处理

管理后台 → 🚀 一键批量处理 Tab：

| 一键功能 | 说明 |
|---|---|
| 一键生成缺失拼音 | 筛选所有 `pinyinData` 为空的金句 + 原文，串行调 AI 标注 |
| 一键提取零金句原文 | 筛选 `quoteCount=0` 的原文，创建后台 AI 提取任务 |
| 一键繁转简 | 筛选含繁体字的内容，使用**本地纯 JS 映射**转换（零 API 成本） |
| 一键自动分类 | 筛选无分类关联的金句 + 原文，串行调 AI 分类 |

### 本地繁简转换（无需 AI）

`trad_to_simpl.ts` 内置 1000+ 常用繁简汉字映射，纯 JavaScript 查表替换：
- **零 API 成本**：不调用任何大模型，速度极快
- 一键繁转简默认使用此本地方案
- 如需词级精准转换（如「發/髮→发」多义字），可后续集成 `opencc-js`

---

## 5. 开发环境启动

### 前置要求

| 工具 | 版本要求 |
|---|---|
| Node.js | ≥ 18（推荐 20 LTS） |
| npm | ≥ 9 |
| Flutter | ≥ 3.0（仅构建 App 时需要） |

### 5.1 后端启动

```bash
cd server

npm install
npx prisma generate
npx prisma db push          # SQLite 自动创建 dev.db

# （可选）写入种子数据：50+ 采集源、分类、系统配置
npm run prisma:seed

npm run dev                 # → http://localhost:3000
```

**环境变量**（`server/.env`）：
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"            # 开发 SQLite；生产换 MySQL
JWT_SECRET="change_in_production"
JWT_EXPIRES_IN=2h
ADMIN_KEY="shiju_admin_key"              # 管理后台鉴权头：x-admin-key
```

### 5.2 管理后台启动

```bash
cd web
npm install
npm run dev                               # → http://localhost:5173
```

Vite 自动将 `/api/*` 代理到 `http://localhost:3000`。

登录后台：`http://localhost:5173/admin/login`，Admin Key 为 `server/.env` 中的 `ADMIN_KEY`。

### 5.3 移动端启动（Flutter）

```bash
cd app
flutter pub get
# 修改 lib/config/api_config.dart 的 baseUrl
flutter run
```

### 5.4 采集器独立模块（可选）

后端内置的 `github_import_service.ts` 已覆盖 GitHub Raw 直导入场景。如果需要采集古诗文网等 HTML 网站，可启动独立的 `crawler/` 模块：

```bash
cd crawler
npm install
npm run dev                               # 定时调度运行
npm run crawl:run                         # 执行一次
```

---

## 6. 生产环境部署

### 6.1 后端

```bash
cd server
# 修改 .env 为生产配置
npm run build                 # → dist/
npx prisma migrate deploy
npm run start                 # node dist/server.js
# 推荐 PM2：pm2 start dist/server.js --name shiju-server
```

### 6.2 管理后台

```bash
cd web
npm run build                 # → dist/（纯静态）
# Nginx 托管 + /api 反代到后端
```

### 6.3 Docker 一键部署（推荐）

项目内置完整的 Docker 多阶段构建文件，支持一键部署。

#### 文件说明

| 文件 | 说明 |
|---|---|
| `docker-compose.yml` | 编排文件，定义后端 + 前端两个服务 |
| `server/Dockerfile` | 后端多阶段构建：编译 TS + 生成 Prisma → 精简运行 |
| `web/Dockerfile` | 前端多阶段构建：Vite 编译 → Nginx 托管 |
| `web/nginx.conf` | Nginx 配置：静态资源 + `/api/*` 反代后端 |
| `.env.example` | 环境变量示例文件 |
| `server/.dockerignore` | 后端构建排除（node_modules / dist / .env / dev.db） |
| `web/.dockerignore` | 前端构建排除（node_modules / dist / .env） |

#### 快速启动

```bash
# 1. 复制环境变量文件并修改
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 和 ADMIN_KEY

# 2. 一键构建并启动
docker compose up -d --build

# 3. 查看日志（可选）
docker compose logs -f shiju-server

# 4. 停止
docker compose down
```

#### 服务地址

| 服务 | 地址 | 说明 |
|---|---|---|
| 后端 API | `http://localhost:3000` | Express + Prisma |
| 管理后台 | `http://localhost:8080/admin/login` | Nginx + React 静态 |
| 健康检查 | `http://localhost:3000/api/health` | API 存活探测 |

#### 数据持久化

- SQLite 模式（默认）：数据库文件挂载到 `./server/data/` 目录，容器重建后数据不丢
- MySQL 模式：取消注释 `docker-compose.yml` 中的 MySQL 配置，修改 `DATABASE_URL` 为 `mysql://...`

#### Docker 架构图

```
┌─────────────────────────────────────────────────────┐
│  docker-compose                                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  shiju-web (Nginx)                          │   │
│  │  端口: 8080 → 80                            │   │
│  │  静态资源: /usr/share/nginx/html            │   │
│  │  /api/* → proxy_pass → shiju-server:3000    │   │
│  └──────────────────┬──────────────────────────┘   │
│                      │ depends_on (healthy)         │
│  ┌──────────────────▼──────────────────────────┐   │
│  │  shiju-server (Node.js 20)                  │   │
│  │  端口: 3000                                 │   │
│  │  启动: prisma db push → node dist/server.js │   │
│  │  数据: ./server/data/ → /app/data           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### 使用 MySQL（可选）

```yaml
# 取消 docker-compose.yml 中 mysql 服务的注释
# 修改 shiju-server 环境变量:
#   DATABASE_URL: "mysql://shiju:shiju_pass_2024@mysql:3306/shiju"
# 启动:
docker compose up -d --build
```

---

## 附：端口与健康检查

| 端口 | 服务 |
|---|---|
| 3000 | 后端 API（Express）|
| 5173 | 管理后台开发服务器（Vite dev）|
| 8080 | 管理后台生产容器内端口（Nginx）|
| 3306 | MySQL（docker-compose 内部）|

```bash
curl http://localhost:3000/api/health
# {"code":0,"data":{"status":"ok","uptime":1234,"version":"1.0.0"}}
```

## 附：数据库切换（SQLite → MySQL）

修改 `server/prisma/schema.prisma`：
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
```

然后：
```bash
cd server
# .env 的 DATABASE_URL 改为 mysql://...
npx prisma migrate dev --name switch_to_mysql
npm run dev
```
