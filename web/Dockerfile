# ====== 拾句管理后台 Dockerfile ======
# 多阶段构建：builder 编译 React 静态资源，runner 用 Nginx 托管
# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=development

# 关键修复：先升级 npm 到最新版，修复 alpine 下 npm exit handler 崩溃 bug
RUN npm install -g npm@latest

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

# ---- Stage 2: Runner (Nginx) ----
FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
