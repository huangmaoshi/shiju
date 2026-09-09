# ====== 拾句后端 Dockerfile（Python · FastAPI · uvicorn）======
# 单阶段镜像：python:3.11-slim + 依赖 + 源码

FROM python:3.11-slim

WORKDIR /app

# 时区（cron 调度器默认 Asia/Shanghai）+ curl（供 healthcheck 使用）
ENV TZ=Asia/Shanghai \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata curl \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖（利用 Docker 层缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 拷源码
COPY . .

# SQLite 数据目录（PG 模式下无影响）
RUN mkdir -p data

# 生产模式默认关闭 reload
ENV NODE_ENV=production

EXPOSE 6010

# 启动：uvicorn 直接多 worker，或用 run.py
# 用 run.py 会读 config.port 并自动关闭 reload（NODE_ENV=production）
CMD ["python", "run.py", "--host", "0.0.0.0", "--port", "6010", "--no-reload"]
