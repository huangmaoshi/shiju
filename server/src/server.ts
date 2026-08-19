import { PrismaClient } from "@prisma/client";
import app from "./app";
import config from "./config";
import logger from "./utils/logger";
import { hashPassword } from "./utils/password";

const prisma = new PrismaClient();

let server: ReturnType<typeof app.listen>;

/**
 * 启动时确保存在默认管理员账号（admin / admin123）
 * 如已存在任意 userType='admin' 的用户则跳过
 */
async function ensureAdminUser(): Promise<void> {
  try {
    const existing = await prisma.user.findFirst({ where: { userType: "admin" } });
    if (existing) return;
    await prisma.user.create({
      data: {
        openId: "admin_internal",
        username: "admin",
        passwordHash: hashPassword("admin123"),
        nickname: "系统管理员",
        userType: "admin",
        memberLevel: 2,
        status: 1,
      },
    });
    logger.info("[bootstrap] 默认管理员账号已创建: admin / admin123（请尽快修改密码）");
  } catch (err) {
    logger.warn(`[bootstrap] 创建默认管理员失败: ${(err as Error).message}`);
  }
}

async function bootstrap(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info("Prisma connected successfully");
  } catch (err) {
    logger.warn(`Prisma connect failed: ${(err as Error).message} — continuing anyway`);
  }

  await ensureAdminUser();

  server = app.listen(config.port, async () => {
    console.log(`🚀 拾句后端启动: http://localhost:${config.port}`);
    try {
      const { cronScheduler } = await import("./services/cron_service");
      await cronScheduler.startAll();
    } catch (e: any) {
      console.warn(`[Cron] 调度器加载失败: ${e.message}`);
    }
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.error(`Prisma disconnect error: ${(err as Error).message}`);
  }
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bootstrap();

export { prisma };
