# ====== 拾句管理后台 Dockerfile ======
# 多阶段构建：builder 编译 React 静态资源，runner 用 Nginx 托管
# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
# 明确使用开发环境，保证开发依赖正常安装
ENV NODE_ENV=development

# 先拷贝 package 文件，利用 Docker 层缓存
COPY package*.json ./
# 方案1：把 npm ci --include=dev 替换为 npm install，规避alpine下npm ci内部异常
RUN npm install

# 拷贝源码与配置文件
COPY tsconfig.json tsconfig*.json* ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src

# 执行项目构建
RUN npm run build

# ---- Stage 2: Runner (Nginx) ----
FROM nginx:alpine AS runner
# 拷自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 拷贝编译产出静态文件
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
