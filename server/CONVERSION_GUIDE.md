# server 转换指南（供转换代理使用）

将 `E:\gitee\拾句\server\src` 的 TypeScript 代码转换为 Python（FastAPI + SQLAlchemy）。
目标目录：`E:\gitee\拾句\server\app`。

## 已完成的公共设施（不要重写，直接 import）

| TS 文件 | Python 文件 | 说明 |
|---|---|---|
| utils/response.ts | app/utils/response.py | `ok(data, message)` 返回 Response；错误直接 `raise BusinessError(code, msg, status)` |
| utils/jwt.ts | app/utils/jwt.py | `sign(payload, secret, expires_in)` / `verify(token, secret)` |
| utils/password.ts | app/utils/password.py | `hash_password(pwd)` / `verify_password(pwd, stored)` |
| utils/dedup.ts | app/utils/dedup.py | `dedup["fingerprint"](content)` 等（dict 风格调用） |
| utils/user_rights.ts | app/utils/user_rights.py | `compute_user_rights(params_dict)` / `get_default_trial_days(db)` |
| utils/ai_client.ts | app/utils/ai_client.py | `AiClient(api_key=..., base_url=..., model=..., ...)` `.chat(messages)` |
| utils/trad_to_simpl.ts | app/utils/trad_to_simpl.py | `trad_to_simpl(text)` / `contains_traditional_chinese(text)` |
| utils/crawl_url.ts | app/utils/crawl_url.py | `resolve_github_raw_url(remark, base_url)` / `check_url_reachable(url, timeout_ms)` |
| utils/logger.ts | app/utils/logger.py | `from ..utils.logger import logger` |
| config/index.ts | app/config.py | `from ..config import config` → `config.port` 等 |
| middlewares | app/deps.py | `BusinessError`、`get_current_user_id`、`get_optional_user_id`、`require_admin`、`require_feature`、`require_member` |
| prisma schema | app/models.py | 所有 SQLAlchemy 模型 |

## 数据库模型（app/models.py）

- 表名/列名保持 Prisma 命名：`User`、`Quote`、`OriginalText`、`CrawlSource`，列如 `contentMd5`、`auditStatus`、`createdAt`。
- 布尔列是 `Boolean`（SQLite 存 0/1）。
- 日期列是 `DateTime`（Python `datetime` 对象，可直接与 `datetime.now()` 比较）。

## 服务函数签名约定（必须遵守）

```python
from sqlalchemy.orm import Session
from ..models import Quote, Category, ...
from ..deps import BusinessError
from ..utils.dedup import dedup
from ..utils.logger import logger

def list_xxx(db: Session, user_id: int | None, page: int = 1, page_size: int = 20, ...) -> dict:
    # db 是第一个参数
    ...
```

- **返回普通 dict / list**，不要返回 ORM 对象（调用方会经 ok() 序列化）。
- 需要 ORM 对象转 dict 时，写个 `_serialize(obj)` 辅助或手动构造 dict。常见字段直接 `obj.__dict__` 去掉 `_sa_instance_state`，或用显式 dict 构造（推荐显式构造，保持与 TS 版返回字段一致）。
- 分页结果统一 `{"total": total, "list": [...]}`。
- 错误统一 `raise BusinessError(code, message, status)`。

## Prisma → SQLAlchemy 对照表

| Prisma | SQLAlchemy |
|---|---|
| `prisma.quote.findMany({ where: {...}, orderBy: { createdAt: "desc" }, take, skip })` | `db.query(Quote).filter(...).order_by(Quote.createdAt.desc()).offset(skip).limit(take).all()` |
| `prisma.quote.findFirst({ where: { id } })` | `db.query(Quote).filter(Quote.id == id).first()` |
| `prisma.quote.findUnique({ where: { id } })` | `db.query(Quote).get(id)` |
| `prisma.quote.create({ data: {...} })` | `obj = Quote(**{...}); db.add(obj); db.commit(); db.refresh(obj)` |
| `prisma.quote.update({ where: { id }, data: {...} })` | `db.query(Quote).filter(Quote.id==id).update({...}); db.commit()` |
| `prisma.quote.updateMany({ where, data })` | `db.query(Quote).filter(where).update({...}, synchronize_session=False); db.commit()` |
| `prisma.quote.delete({ where: { id } })` | `db.query(Quote).filter(Quote.id==id).delete(); db.commit()` |
| `prisma.$transaction([...])` | `with db.begin(): ...` 或逐条操作 + commit；确保一致性用 try/except + rollback |
| `count()` | `db.query(Quote).filter(...).count()` |
| `in: [1,2]` | `Quote.id.in_([1,2])` |
| `not: null` | `Quote.contentMd5.isnot(None)` |
| `contains: "kw"` | `Quote.content.contains(kw)` |
| `startsWith` | `Quote.content.startswith(kw)` |
| `gt/lt/gte/lte` | `>`, `<`, `>=`, `<=` |
| `{ increment: 1 }` | 先查出来 `obj.field += 1; db.commit()` 或 `update` 时 `Quote.field + 1` |

**重要**：
- 每次写操作后必须 `db.commit()`（除非在事务块里）。
- 不要在服务里用 `SessionLocal()` 新建会话——所有会话由路由层通过 `Depends(get_db)` 注入，服务只接受传入的 `db`。
- 查询 `findMany` 返回的 ORM 列表，序列化时注意嵌套关联不要直接访问 lazy load（如 `quote.quoteCategories`），需要关联数据时显式 join 查询或单独查询。

## 时间处理

- `new Date()` → `datetime.now()`
- 日期比较：`obj.expireAt < datetime.now()`（或 `.timestamp()` 比较）
- 日期加天数：`datetime.now() + timedelta(days=7)`
- `new Date(dateStr)` → `datetime.fromisoformat(dateStr)`（前端传 "2026-08-19" 时补 "T00:00:00"）

## 通用工具

- 随机数：`random.randint`, `random.choice`, `random.sample`（Fisher-Yates 用 `random.shuffle` 或 `random.sample`）
- 字符串哈希/编码：`hashlib.md5(...).hexdigest()`
- 解析 JSON：`json.loads` / `json.dumps(..., ensure_ascii=False)`
- 请求外部 API：`httpx`（同步）
- 列表去重保持顺序：`list(dict.fromkeys(xs))`

## 错误码约定

- BusinessError(404, "xxx", 404) → HTTP 404
- BusinessError(400, "xxx") → HTTP 400
- BusinessError(401, "未登录", 401)
- BusinessError(402, "试用已结束，请开通会员后继续使用", 402)
- BusinessError(403, "Forbidden", 403)

## 转换后常见运行错误（实测踩坑）

1. **内置函数遮蔽**：模块顶层 `def list(...)`/`def set(...)` 会遮蔽内置函数。内部若再写 `list({...})` 会**递归调用自身**，报 `'set' object has no attribute 'query'` 之类诡异错误。修复：集合/推导式转列表用 `[*{...}]` 或 `list(...)` 前先 `import builtins`。
2. **SQLAlchemy 文本 SQL**：`db.execute('DELETE FROM "x"')` 必须 `from sqlalchemy import text` 后写 `db.execute(text('DELETE FROM "x"'))`，否则报 `Textual SQL expression ... should be explicitly declared as text(...)`。
3. **PyJWT 不支持 jsonwebtoken 的过期格式**：`jwt.encode(payload, secret)` 不带 `exp` 时 token 永不过期；`expiresIn: '2h'` 需自行解析（参考 `app/utils/jwt.py` 的 `_parse_expires_in`，支持 s/m/h/d 与秒数，同时写入 `iat`/`exp`）。
4. **.env 缺失导致 JWT 签名失败**：PyJWT 报 `HMAC key must not be empty`。需要新建 `server/.env`，从 `server/.env` 复制 `JWT_SECRET`/`JWT_EXPIRES_IN`/`ADMIN_KEY` 等；`DATABASE_URL` 不要复制（config.py 会自动回退到 SQLite `server/data/dev.db`）。
5. **端口冲突**：Node 原版占 3000 时，Python 版用 `run.py --port 3001` 测试，避免混淆。
6. **crawler 运行入口**：必须 `python -m crawler.index`（包内相对导入），直接 `python crawler/index.py` 会报 `ImportError: attempted relative import`。

## 完成后自检

1. 文件内 import 全部存在（`from ..models import ...`、`from ..deps import BusinessError`、`from ..utils.logger import logger`）
2. 没有语法错误：可运行 `python -c "import app.services.xxx"`（在 server 目录，venv 为 `E:\gitee\拾句\.venv\Scripts\python.exe`）
3. 不要修改 TS 源文件
4. 不要创建额外的模块文件（除非必要）
