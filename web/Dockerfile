# ====== 拾句管理后台 Dockerfile ======
# 多阶段构建：builder 编译 React 静态资源，runner 用 Nginx 托管

# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# 明确使用开发环境，避免在 CI/Docker 环境里因为 NODE_ENV=production
# 导致 vite / tsc 等构建依赖被跳过
ENV NODE_ENV=development

# 先拷 package files，利用 Docker 层缓存，并锁定依赖安装
COPY package*.json ./
RUN npm ci --include=dev

# 拷源码并编译
COPY tsconfig.json tsconfig*.json* ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

RUN npm run build

# ---- Stage 2: Runner (Nginx) ----
FROM nginx:alpine AS runner

# 拷自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 拷编译产物
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
