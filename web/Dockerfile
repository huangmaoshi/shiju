# ====== 拾句管理后台 Dockerfile ======
# 多阶段构建：builder 编译 React 静态资源，runner 用 Nginx 托管
# ---- Stage 1: Builder（Debian 基础，彻底解决 npm musl 兼容 bug） ----
FROM node:22-slim AS builder
WORKDIR /app
ENV NODE_ENV=development

# 拷贝 package 文件并安装依赖
COPY package*.json ./
RUN npm install

# 拷贝源码与配置
COPY tsconfig.json tsconfig*.json* ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

# 执行构建
RUN npm run build

# ---- Stage 2: Runner（继续使用 Alpine，保持镜像体积极小） ----
FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
