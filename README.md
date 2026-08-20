# 📖 拾句 · 作文素材与金句摘抄库

> 面向中学生 / 写作者的金句收藏与作文素材应用，提供内容浏览、搜索、收藏、背诵打卡、每日推荐、**AI 金句提取**、**AI 拼音标注**、**AI 繁转简**、**AI 自动分类**（支持 OpenAI / 百炼 / 千帆 / 智谱 / DeepSeek / Moonshot / **火山方舟** 等主流大模型）、**GitHub 数据自动采集**、**原文审核流程**、VIP 会员体系等功能。

**产品定位**：面向学生群体的轻量化作文素材工具 + 金句卡片生成器。
**核心优势**：素材全、分类准、AI 金句提取、定时自动采集、一键卡片化、无冗余功能。

---

## 1. 产品概述

### 1.1 产品背景

初高中、大学生群体长期存在作文素材积累、文案摘抄需求，但现有产品普遍存在四个痛点：

- 素材杂乱无分类，找对应主题的金句效率极低
- 只有文字内容，无适配社交平台的可视化输出
- 功能臃肿、广告泛滥，纯工具体验差
- 优质金句需要自己从原文里抠，没有 AI 辅助提取

「拾句」以「精准素材 + AI 自动提取金句 + 一键卡片化 + 定时自动采集」为核心，主打干净、高效、高颜值。

### 1.2 目标用户

| 用户群体 | 典型场景 |
|---|---|
| 初高中学生（12-18 岁） | 高考/中考作文素材积累、考前押题素材包 |
| 大学生（18-22 岁） | 四六级/考研作文、日常文案摘抄 |
| 文案爱好者 / 教师 | 备课素材参考、灵感收集 |

### 1.3 核心价值

- **精准分类素材库**：按作文主题、内容类型双维度分类，标注适用场景
- **AI 金句自动提取**：大模型从原文里批量挖掘高质量金句，自动去重
- **定时自动采集**：50+ 合规数据源，Cron 定时采集入库
- **原文审核机制**：AI/采集的内容先入库待审，人工过审才对用户展示
- **零门槛金句卡片**：多套精美模板，一键生成高清配图
- **全场景摘抄体验**：每日推荐、随机灵感、收藏管理、自建金句、云同步

---

## 2. 项目架构

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
│              后端 API 层   Python 3.10+ · FastAPI · SQLAlchemy 2.x          │
│                                                                             │
│  Router(APIRouter) → Service → SQLAlchemy → SQLite / PostgreSQL / MySQL   │
│  依赖注入：JWT 鉴权 / Admin Key / 会员拦截 / 限流 / 异常处理 / CORS          │
│                                                                             │
│  内置能力：                                                                   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  AI 金句提取服务   │  │  GitHub 直导入服务   │  │  APScheduler 定时采集调度  │  │
│  │  多 Provider 兼容  │  │  自动 URL 编码       │  │  CronTrigger 驱动         │  │
│  │  OpenAI 协议统一   │  │  超时 + 自动重试      │  │  任务可配置启停/立即执行   │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  AI 拼音标注       │  │  AI 繁转简           │  │  AI 自动分类               │  │
│  │  逐字标注带声调     │  │  本地 OpenCC 映射    │  │  自动注入分类列表          │  │
│  │  提示词可配置       │  │  + AI 精准转换        │  │  多维度分类树 70+ 节点     │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────────┐  │
│  │  一键批量处理       │  │  原文审核流程        │  │  SQLAlchemy + SQLite       │  │
│  │  拼音/提取/繁转简   │  │  批量审核接口        │  │  开发轻量 / 生产 PG/MySQL   │  │
│  │  分类 一键搞定      │  │  待审原文不对用户展示│  │  模型字段对齐 Prisma schema │  │
│  └──────────────────┘  └───────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌───────────────────────┐  ┌───────────────────────────────────────────────┐
│  数据库 (SQLite/PG/MySQL) │  │  GitHub Raw / 公网 JSON 数据源                │
│  原文 / 金句 / 采集 / AI │  │  chinese-poetry / poetry-dataset / quotes ... │
│  配置 / 会员 / 订单      │  │  （httpx + 30s 超时 + 3 次重试）              │
└───────────────────────┘  └───────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│              独立采集子模块  crawler/（Python，可选）                          │
│  providers: GitHubDataset / GuWenWen / MingYan / WikiQuote                 │
│  engine: httpx + BeautifulSoup + 复用 server 的 SimHash 去重                 │
│  复用 server 的 SQLAlchemy 模型，连同一个数据库，不另建库                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
拾句/
├── server/                     # 后端 API 服务（Python 3.10+ · FastAPI · SQLAlchemy）
│   ├── app/
│   │   ├── api/                #   22 组路由（APIRouter）
│   │   │   ├── admin_routes.py         # 管理后台全部 API（admin 依赖）
│   │   │   ├── ai_routes.py            # AI 提取任务接口
│   │   │   ├── auth_routes.py          # 注册/登录/JWT
│   │   │   ├── original_text_routes.py # 原文管理 + 选段加金句
│   │   │   ├── quote_routes.py          # 金句 CRUD
│   │   │   └── ...（ad/card/category/collection/composition/custom_quote/
│   │   │             daily_recommend/export/member/order/recite/search/
│   │   │             stats/sync/theme_package/user）
│   │   ├── services/           #   23 个业务服务
│   │   │   ├── ai_service.py           # AI 提取任务管理
│   │   │   ├── github_import_service.py# GitHub Raw 直导入（超时+重试+去重）
│   │   │   ├── cron_service.py         # APScheduler 定时采集调度器
│   │   │   ├── original_text_service.py
│   │   │   └── ...
│   │   ├── utils/              #   工具函数
│   │   │   ├── ai_client.py           # AI HTTP 客户端（统一 OpenAI 协议，httpx）
│   │   │   ├── dedup.py                # MD5 + SimHash 去重引擎
│   │   │   ├── jwt.py                  # PyJWT 签发/校验
│   │   │   ├── password.py            # PBKDF2-SHA512
│   │   │   ├── trad_to_simpl.py       # 本地 OpenCC 繁简转换
│   │   │   ├── crawl_url.py            # GitHub Raw URL 拼接（中文路径编码）
│   │   │   ├── user_rights.py          # 会员权益判断
│   │   │   ├── response.py            # 统一 ok()/error() 响应
│   │   │   └── logger.py
│   │   ├── config.py           # 配置（PORT/DB/JWT/ADMIN_KEY）
│   │   ├── database.py         # SQLAlchemy engine + SessionLocal + init_db
│   │   ├── deps.py             # 依赖：BusinessError / get_current_user_id /
│   │   │                        #   require_admin / require_feature / require_member
│   │   ├── models.py           # SQLAlchemy 全部模型（表名/列名对齐 Prisma）
│   │   └── main.py             # FastAPI 应用组装 + 启动引导（建表/默认管理员/cron）
│   ├── data/                   #   SQLite 数据库文件目录（dev.db）
│   ├── seed.py                 #   种子数据：50+ 采集源、分类、系统配置
│   ├── run.py                  #   启动入口（uvicorn，等价 uvicorn app.main:app）
│   └── requirements.txt
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
├── crawler/                    # 独立采集子模块（Python，可选）
│   ├── crawler/
│   │   ├── providers/          #   GitHubDataset / GuWenWen / MingYan / WikiQuote
│   │   ├── engine/             #   deduper / http_client(httpx) / parser(BeautifulSoup)
│   │   ├── processors/         #   content_cleaner / db_writer / sensitive_checker
│   │   ├── config.py / db.py / logger.py / scheduler.py / index.py
│   ├── index.py                #   入口 shim（python index.py --list）
│   ├── requirements.txt
│   └── README.md                #   爬虫使用说明
│
├── run.py                      # 项目根一键启动器（同时拉起 server + crawler）
├── docker-compose.yml          # Docker 一键部署（PostgreSQL + server + web）
├── .env.example                # 环境变量示例
├── .gitignore
└── README.md
```

### 技术栈

| 模块 | 技术 | 说明 |
|---|---|---|
| 后端运行时 | Python ≥ 3.10 | 推荐 3.11+ |
| 后端框架 | **FastAPI** ≥ 0.110 | ASGI，Pydantic 自动校验 |
| ASGI 服务器 | uvicorn[standard] ≥ 0.29 | 开发热重载 / 生产多 worker |
| ORM | **SQLAlchemy** 2.x | declarative_base + sessionmaker |
| 数据库 | SQLite（开发）/ PostgreSQL（生产推荐）/ MySQL | 通过 `DATABASE_URL` 切换 |
| 数据校验 | Pydantic ≥ 2.6 | FastAPI 内置 |
| 鉴权 | **PyJWT** ≥ 2.8 + Admin Key | 双鉴权：用户端 Bearer Token / 管理后台 x-admin-key |
| 密码存储 | PBKDF2-SHA512 | `hashlib.pbkdf2_hmac` |
| 日志 | logging | 文件 + 控制台 |
| AI 接入 | **OpenAI 兼容协议**（httpx） | 金句提取 / 拼音标注 / 繁转简 / 自动分类，提示词模板可配置 |
| 本地繁简转换 | **opencc-python-reimplemented** | 零 API 成本 |
| PDF 导出 | reportlab ≥ 4.0 | 摘抄本导出 |
| 定时任务 | **APScheduler** ≥ 3.10 | CronTrigger，任务可启停/立即执行 |
| 去重算法 | **MD5 精确匹配 + SimHash 相似度** | 短文本 <100 字 MD5，长文本 ≥100 字 SimHash（汉明距离 ≤10 → 相似度 >85%） |
| GitHub 直导入 | httpx | 30s 超时、3 次自动重试、指数退避、中文路径自动 URL 编码 |
| HTTP 客户端（爬虫） | httpx + BeautifulSoup4 | 复用 server 的 SQLAlchemy 模型 |
| 管理后台 | React 18 + Ant Design 5 + Vite + Tailwind | 5173 端口，开发代理 `/api/*` → :3000 |
| 移动端 | Flutter 3.x | Provider + Dio |
| 容器化 | Docker + docker-compose | python:3.11-slim / node:20-alpine / nginx |

> 说明：项目曾以 Node.js + Express + Prisma 实现，后端 crawler/server 已整体迁移到 Python（FastAPI + SQLAlchemy）。SQLAlchemy 模型的表名/列名保持原 Prisma schema 命名，保证数据兼容。

---

## 3. 核心功能一览

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
- **AI 拼音标注**：逐字标注带声调拼音，金句和原文均支持，单条/批量/一键处理
- **AI 繁转简**：**本地 OpenCC 映射**（零 API 成本）+ AI 精准转换双模式
- **AI 自动分类**：自动获取现有分类列表注入 AI 提示词，AI 选择 1-5 个最合适分类
- **一键批量处理**：一键生成缺失拼音 + 一键提取零金句原文 + 一键繁转简 + 一键自动分类
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

| 档位 | 价格 | 权益 |
|---|---|---|
| 月卡 | 6 元 | 全素材自由看、无广告、卡片无水印 |
| 季卡 | 15 元（5 元/月） | 同月卡 |
| 年卡 | 48 元（4 元/月，主推） | 同月卡 + 离线下载 + 无限导出 |

### 内容合规
- 合规内容标记（不限于公版）：`complianceTag = public_domain / mit / apache / cc0 / translated`
- 采集源 `protocol` 字段标注协议类型（PD / MIT / Apache-2.0 / CC0 等）
- **审核流程**：所有采集/AI 提取的原文默认待审，必须人工审核通过后才对用户展示
- 去重算法确保不会重复入库

---

## 4. 数据采集与去重机制

### 采集方式

后端内置 **两种采集模式**，共享同一套 APScheduler 调度器和审核流程：

#### 模式一：GitHub Raw 直导入（推荐，已实现并稳定运行）

后端 `github_import_service.py` 直接从 GitHub 仓库的 `raw.githubusercontent.com` JSON 文件抓取数据。前端管理后台 → 采集管理 → 选采集源 → 点「导入」。

**特性**：
- 自动 URL 拼接：`baseUrl` + `remark`（仓库路径），支持**中文目录自动 URL 编码**
- 网络健壮性：30s 超时、3 次重试、指数退避（1.5s → 3s → 4.5s）、详细错误信息
- 内置 50+ 预设采集源（chinese-poetry / poetry-dataset / quotes / 名人名言 / 电影台词 ...）

#### 模式二：定时自动采集

后端启动时 `app/main.py` 的 `lifespan` → `cron_service.start()` 自动加载所有 `enabled=1` 的 `CrawlSchedule`，注册为 APScheduler CronTrigger job，到点自动执行。

管理后台 → 采集管理 → ⏰ 定时采集 Tab：
- 配置 Cron 表达式（5 段标准格式：`分 时 日 月 周`）
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

去重引擎位于 `server/app/utils/dedup.py`，crawler 子模块通过 `crawler/engine/deduper.py` 复用同一套实现（MD5 + 64 位 SimHash，中文 2-gram 分词）。

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

`auditStatus` 字段（0=待审 1=通过 2=拒绝，`CrawlRecord` 还多了 3=重复）同时存在于 `Quote`、`OriginalText`、`CrawlRecord` 三张表。

---

## 5. AI 全功能矩阵

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

### 4 大 AI 功能 + 一键批量处理

共享同一套 AI 配置（Provider / API Key / 模型 / 提示词模板 / 超时重试），在管理后台 → AI 智能功能管理 中统一管理。

| 功能 | 说明 | 提示词占位符 | 模板字段 |
|---|---|---|---|
| AI 金句提取 | 从原文中提取 3-8 句金句，自动 SimHash 去重 | `{type}` `{content}` | `promptTemplate` |
| AI 拼音标注 | 逐字标注带声调拼音，返回 JSON 数组 | `{content}` | `pinyinPromptTemplate` |
| AI 繁转简 | 繁体/异体字 → 标准简体中文 | `{content}` | `simplifyPromptTemplate` |
| AI 自动分类 | 自动获取分类列表注入，AI 选择 1-5 个分类 | `{categories}` `{content}` | `classifyPromptTemplate` |

| 一键功能 | 说明 |
|---|---|
| 一键生成缺失拼音 | 筛选所有 `pinyinData` 为空的金句 + 原文，串行调 AI 标注 |
| 一键提取零金句原文 | 筛选 `quoteCount=0` 的原文，创建后台 AI 提取任务 |
| 一键繁转简 | 筛选含繁体字的内容，使用**本地 OpenCC 映射**转换（零 API 成本） |
| 一键自动分类 | 筛选无分类关联的金句 + 原文，串行调 AI 分类 |

### 分类体系

金句和原文**共用同一套分类**，每个条目可有多个分类（多对多关系）。4 大维度 70+ 节点：

| 维度 | type | 分类示例 |
|---|---|---|
| 内容类型 | `content_type` | 古诗词曲（唐诗/宋词/元曲/诗经/楚辞…）、现代诗歌、名人名言、谚语俗语、影视台词、名著摘句、歌词… |
| 主题 | `theme` | 青春成长、家国情怀、情感共情、思辨哲理、文化传承、科技教育、社会观察、励志奋斗、自然风光… |
| 用途场景 | `scene` | 作文开头、作文结尾、过渡衔接、论点论据、抒情描写… |
| 时代 | `era` | 先秦、汉魏、南北朝、唐代、宋代、元代、明代、清代、近现代、当代 |

---

## 6. 开发环境启动

### 前置要求

| 工具 | 版本要求 |
|---|---|
| Python | ≥ 3.10（推荐 3.11+） |
| Node.js | ≥ 18（推荐 20 LTS，仅 web 管理后台需要） |
| Flutter | ≥ 3.0（仅构建移动端 App 时需要） |

### 6.1 一键启动（推荐）

项目根 `run.py` 同时拉起后端 + 爬虫，自动复用项目根 `.venv`：

```bash
# 首次：创建虚拟环境并安装依赖
python -m venv .venv
# Linux/macOS
. .venv/bin/activate
# Windows
. .venv\Scripts\activate
pip install -r server/requirements.txt -r crawler/requirements.txt

# 一键启动（后端 + 爬虫）
python run.py
# 单独启动后端
python run.py --no-crawler
# 单独启动爬虫
python run.py --no-server
# 指定端口
python run.py --port 3001
# 爬虫只挂起不跑调度（调度交给 server 内建 cron，避免双跑）
python run.py --crawler-no-schedule
```

### 6.2 后端单独启动

```bash
cd server
pip install -r requirements.txt

# 开发模式（自动重载）
python run.py                    # → http://localhost:3000

# 或直接 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

首次启动自动建表 + 创建默认管理员 `admin / admin123`（请尽快改密码）。

**环境变量**（`server/.env`，未设置时自动回退到 SQLite）：

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=sqlite:///data/dev.db     # 生产换 postgresql://... 或 mysql://...
JWT_SECRET="change_in_production"
JWT_EXPIRES_IN=2h
ADMIN_KEY="shiju_admin_key"             # 管理后台鉴权头：x-admin-key
```

**灌入种子数据**（50+ 采集源、分类、系统配置）：

```bash
cd server
python seed.py
```

### 6.3 管理后台启动

```bash
cd web
npm install
npm run dev                               # → http://localhost:5173
```

Vite 自动将 `/api/*` 代理到 `http://localhost:3000`。

登录后台：`http://localhost:5173/admin/login`，Admin Key 为 `server/.env` 中的 `ADMIN_KEY`。

### 6.4 移动端启动（Flutter）

```bash
cd app
flutter pub get
# 修改 lib/config/api_config.dart 的 baseUrl
flutter run
```

### 6.5 采集器独立模块（可选）

后端内置的 `github_import_service.py` 已覆盖 GitHub Raw 直导入场景。如果需要采集古诗文网等 HTML 网站，可启动独立的 `crawler/` 模块：

```bash
cd crawler
pip install -r requirements.txt

python -m crawler.index --list                          # 列出可用 Provider
python -m crawler.index --run guwenwen --pages 3         # 立即采集某源
python -m crawler.index                                  # 守护模式（APScheduler）
```

详细用法见 [crawler/README.md](crawler/README.md)。

---

## 7. 生产环境部署

### 7.1 Docker 一键部署（推荐）

项目内置完整的 Docker 部署文件，编排 **PostgreSQL + 后端 + 管理后台** 三个服务，一条命令拉起。

#### 部署文件说明

| 文件 | 说明 |
|---|---|
| [docker-compose.yml](docker-compose.yml) | 编排文件：postgres + shiju-server + shiju-web |
| [server/Dockerfile](server/Dockerfile) | 后端镜像：`python:3.11-slim` + 依赖 + uvicorn 启动 |
| [server/.dockerignore](server/.dockerignore) | 后端构建排除（`__pycache__` / `data/` / `.env` 等） |
| [web/Dockerfile](web/Dockerfile) | 前端镜像：`node:20-alpine` 编译 → `nginx:alpine` 托管 |
| [web/nginx.conf](web/nginx.conf) | Nginx 配置：静态资源 + `/api/*` 反代 `shiju-server:3000` |
| [.env.example](.env.example) | 环境变量示例（含 PG / SQLite / MySQL 三种 DATABASE_URL） |

#### 快速启动

```bash
# 1. 复制环境变量文件并修改（务必改 JWT_SECRET 和 ADMIN_KEY）
cp .env.example .env

# 2. 一键构建并启动（首次会拉镜像 + 编译，耗时较长）
docker compose up -d --build

# 3. 查看启动日志（确认健康检查通过）
docker compose logs -f shiju-server

# 4. 灌入种子数据（50+ 采集源、分类、系统配置）—— 首次部署可选
docker compose exec shiju-server python seed.py
```

启动顺序：postgres 健康检查通过 → shiju-server 健康检查通过 → shiju-web 启动。

#### 服务地址

| 服务 | 地址 | 说明 |
|---|---|---|
| 后端 API | `http://localhost:3000` | FastAPI + SQLAlchemy，健康检查 `/api/health` |
| 管理后台 | `http://localhost:8080/admin/login` | Nginx + React 静态，Admin Key 为 `ADMIN_KEY` |
| PostgreSQL | `localhost:5432` | 可通过 `PG_PORT` 修改 |

#### 常用运维命令

```bash
# 查看全部服务状态
docker compose ps

# 查看某服务实时日志
docker compose logs -f shiju-server
docker compose logs -f shiju-web

# 重启某个服务
docker compose restart shiju-server

# 代码更新后重新构建并启动
docker compose up -d --build shiju-server

# 进入后端容器排查
docker compose exec shiju-server bash

# 停止全部服务（数据卷保留）
docker compose down

# 停止并删除数据卷（⚠️ 清空 PostgreSQL 数据）
docker compose down -v
```

#### 切换数据库

默认使用 docker-compose 内置的 PostgreSQL。如需切换：

**SQLite（容器内，零配置快速起步）：**
编辑 `docker-compose.yml` 的 `shiju-server.environment`：
```yaml
DATABASE_URL: "sqlite:///data/dev.db"
```
并注释掉 `postgres` 服务块和 `shiju-server.depends_on`。数据通过 `./server/data:/app/data` 卷持久化。

**MySQL：**
取消注释 `docker-compose.yml` 末尾的 MySQL 服务块，修改 `DATABASE_URL` 为 `mysql://...`（注意 requirements.txt 需补装 `PyMySQL`）。

#### 架构图

```
┌──────────────────────────────────────────────────────────┐
│  docker-compose                                          │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  shiju-web (Nginx)         端口 8080 → 80       │    │
│  │  静态资源 /usr/share/nginx/html                 │    │
│  │  /api/* → proxy_pass → shiju-server:3000        │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │ depends_on (healthy)          │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │  shiju-server (Python 3.11)  端口 3000         │    │
│  │  uvicorn app.main:app --host 0.0.0.0            │    │
│  │  启动时自动建表 + 建管理员 + 启动 cron 调度     │    │
│  │  数据卷 ./server/data → /app/data（SQLite 用）  │    │
│  └──────────────────────┬──────────────────────────┘    │
│                         │ depends_on (healthy)          │
│  ┌──────────────────────▼──────────────────────────┐    │
│  │  postgres (PostgreSQL 16)   端口 5432          │    │
│  │  数据卷 postgres_data                          │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

### 7.2 手动部署（不用 Docker）

适合已有服务器环境、或需要更细粒度控制时使用。

#### 7.2.1 后端部署

```bash
cd server
pip install -r requirements.txt

# 生产配置：复制 .env.example 为 .env 并修改
cp ../.env.example .env
# 编辑 .env：
#   NODE_ENV=production
#   DATABASE_URL=postgresql://user:pass@your-pg-host:5432/shiju
#   JWT_SECRET=<强随机串>
#   ADMIN_KEY=<强随机串>

# 方式一：直接启动（单进程，reload 已自动关闭）
NODE_ENV=production python run.py --no-reload --port 3000

# 方式二：uvicorn 多 worker（推荐生产）
uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 4

# 首次部署灌入种子数据
python seed.py
```

**用 systemd 托管后端进程**（推荐，开机自启 + 崩溃重启）：

```ini
# /etc/systemd/system/shiju-server.service
[Unit]
Description=ShiJu Server (FastAPI)
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/shiju/server
EnvironmentFile=/opt/shiju/server/.env
ExecStart=/opt/shiju/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 3000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now shiju-server
sudo systemctl status shiju-server
sudo journalctl -u shiju-server -f   # 查看日志
```

#### 7.2.2 管理后台部署

```bash
cd web
npm install
npm run build                 # → dist/（纯静态文件）
```

把 `dist/` 内容拷到 Nginx 静态目录，配置 SPA 回退 + `/api` 反代：

```nginx
# /etc/nginx/conf.d/shiju.conf
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/shiju-web;
    index index.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反代到后端
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # AI 接口可能较慢
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1024;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. 关键 API 接口

所有管理后台接口共用 `x-admin-key` 请求头鉴权（`ADMIN_KEY` 环境变量）。响应统一 `{ code, message, data }` 结构。

### 采集管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/crawl/sources` | 列出全部采集源 |
| POST | `/api/v1/admin/crawl/sources` | 新增采集源 |
| PUT | `/api/v1/admin/crawl/sources/:id` | 更新采集源 |
| DELETE | `/api/v1/admin/crawl/sources/:id` | 删除采集源 |
| GET | `/api/v1/admin/crawl/tasks` | 列出采集任务 |
| GET | `/api/v1/admin/crawl/source-stats` | 采集源统计 |
| POST | `/api/v1/admin/crawl/import` | 手动触发 GitHub Raw 直导入（异步执行）|
| GET | `/api/v1/admin/crawl/tasks/:id` | 查看任务状态 |

### 定时采集调度

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/crawl/schedule` | 列出全部调度 |
| POST | `/api/v1/admin/crawl/schedule/upsert` | 创建/更新（sourceId + cronExpr + enabled）|
| POST | `/api/v1/admin/crawl/schedule/:id/start` | 启用（Cron 注册）|
| POST | `/api/v1/admin/crawl/schedule/:id/stop` | 停用（Cron 注销）|
| POST | `/api/v1/admin/crawl/schedule/:id/run` | 立即执行一次 |

### 审核管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/audit/list?entity=original&status=0` | 审核队列列表 |
| POST | `/api/v1/admin/audit/batch` | 批量审核（`{entity, ids, targetStatus}`）|

### AI 金句提取

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/admin/ai/configs` | 列出 AI 配置 |
| POST | `/api/v1/admin/ai/configs` | 新建 AI 配置 |
| POST | `/api/v1/admin/ai/extract` | 创建提取任务 |
| GET | `/api/v1/admin/ai/tasks/:id` | 任务状态（轮询进度）|

---

## 9. 端口与健康检查

| 端口 | 服务 |
|---|---|
| 3000 | 后端 API（FastAPI / uvicorn）|
| 5173 | 管理后台开发服务器（Vite dev）|
| 8080 | 管理后台生产容器内端口（Nginx）|
| 3306 | MySQL（docker-compose 内部，可选）|
| 5432 | PostgreSQL（docker-compose 内部，可选）|

```bash
curl http://localhost:3000/api/health
# {"code":0,"data":{"status":"ok","uptime":1234,"version":"1.0.0"}}
```

---

## 10. 数据库切换（SQLite / PostgreSQL / MySQL）

通过 `DATABASE_URL` 环境变量切换，SQLAlchemy 自动适配：

| 数据库 | `DATABASE_URL` 示例 | 适用场景 |
|---|---|---|
| SQLite（默认） | `sqlite:///data/dev.db` | 开发轻量、单机部署 |
| PostgreSQL（推荐） | `postgresql://user:pass@host:5432/shiju` | 生产、高并发、事务强 |
| MySQL | `mysql://user:pass@host:3306/shiju` | 生产、已有 MySQL 环境 |

> 说明：SQLAlchemy 模型的表名/列名与原 Prisma schema 保持一致（如 `contentMd5`、`auditStatus`、`createdAt`），三种数据库下行为一致。

---

## 11. 已知技术限制

| 项目 | 现状 | 未来改进 |
|---|---|---|
| SQLite 开发环境 | 单文件轻量，适合 MVP | 生产切换 PostgreSQL，提升并发 |
| 去重 SimHash | 自建实现，64 位 | 可考虑接入 VPTree 索引加速大规模比对 |
| 采集源 GitHub Raw 为主 | 覆盖古诗词/名言/台词等主要品类 | 后续可接入更多公开 JSON 数据源 |
| 审核流程 | 人工批量审核 | 可考虑接入 AI 辅助审核 |
| 独立 crawler/ 子模块 | 已实现但后端内置 github_import_service 已覆盖主要场景 | 如需抓古诗文网等 HTML 动态页再启用 |
| Redis | 未引入 | 可用于缓存每日推荐、热门搜索词、采集速率限制 |
| Docker | 三件套（compose + server/Dockerfile + web/Dockerfile）已完整 | 可考虑多阶段构建进一步缩小镜像 |
