# ====== 拾句后端 Dockerfile ======
# 多阶段构建：builder 编译 TS + 生成 Prisma Client，runner 精简运行

# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 Prisma 所需的 openssl（alpine 精简镜像缺失）
RUN apk add --no-cache openssl

# 先拷 package.json + prisma schema，利用 Docker 层缓存
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

# 安装全部依赖（含 devDependencies，编译需要）
RUN npm install

# 生成 Prisma Client
RUN npx prisma generate

# 拷源码并编译
COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

# 安装运行时所需系统依赖
RUN apk add --no-cache openssl tini

# 仅拷生产依赖
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# 拷编译产物 + Prisma Client + schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# 环境变量默认值（可在 docker-compose / .env 覆盖）
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:./dev.db"
ENV JWT_SECRET="change_in_production"
ENV JWT_EXPIRES_IN=2h
ENV ADMIN_KEY="shiju_admin_key"

EXPOSE 3000

# 入口：先推送 schema 到数据库（创建表），再启动
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
