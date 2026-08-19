import cron from "node-cron";
import prisma from "./db";
import logger from "./logger";
import { getProvider } from "./providers/factory";
import { writeQuote } from "./processors/db_writer";
import config from "./config";

const scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

async function executeSchedule(sourceCode: string): Promise<void> {
  const source = await prisma.crawlSource.findUnique({
    where: { code: sourceCode },
  });

  if (!source) {
    logger.error(`[scheduler] CrawlSource 不存在: ${sourceCode}`);
    return;
  }

  const schedule = await prisma.crawlSchedule.findUnique({
    where: { sourceId: source.id },
  });

  if (!schedule || schedule.enabled !== 1) {
    logger.warn(`[scheduler] 未找到有效调度配置: ${sourceCode}`);
    return;
  }

  const provider = getProvider(source.code);
  if (!provider) {
    logger.error(`[scheduler] Provider 未注册: ${source.code}`);
    return;
  }

  (provider as any).remark = source.remark ?? undefined;

  logger.info(`[scheduler] 开始执行 ${sourceCode} (pagesPerRun=${schedule.pagesPerRun})`);

  const task = await prisma.crawlTask.create({
    data: {
      sourceId: source.id,
      url: source.baseUrl,
      status: "running",
      priority: source.priority,
      maxRetry: 3,
    },
  });

  let inserted = 0;
  let skipped = 0;

  for (let page = 1; page <= schedule.pagesPerRun; page++) {
    try {
      const rawList = await provider.fetchList(page);
      if (rawList.length === 0) {
        logger.info(`[${sourceCode}] 第 ${page} 页无数据，停止翻页`);
        break;
      }

      for (const raw of rawList) {
        try {
          const enriched = await provider.fetchDetail(raw);
          const result = await writeQuote(enriched, source.id, task.id);
          if (result.status === "inserted") inserted++;
          else skipped++;
        } catch (err: any) {
          logger.error(`[${sourceCode}] 单条处理失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      logger.error(`[${sourceCode}] 第 ${page} 页采集失败: ${err.message}`);
      await prisma.crawlTask.update({
        where: { id: task.id },
        data: { status: "failed", lastError: err.message },
      });
      return;
    }
  }

  await prisma.crawlTask.update({
    where: { id: task.id },
    data: {
      status: "success",
      recordCount: inserted,
      lastRunAt: new Date(),
      duration: 0,
    },
  });

  await prisma.crawlSource.update({
    where: { id: source.id },
    data: {
      lastCrawlAt: new Date(),
      totalCrawled: { increment: inserted + skipped },
    },
  });

  logger.info(`[scheduler] ${sourceCode} 完成: 新增 ${inserted}, 跳过 ${skipped}`);
}

export function startScheduler(): void {
  stopScheduler();

  cron.schedule("* * * * *", async () => {
    const schedules = await prisma.crawlSchedule.findMany({
      where: { enabled: 1 },
    });

    for (const sched of schedules) {
      const source = await prisma.crawlSource.findUnique({
        where: { id: sched.sourceId },
      });
      if (!source) continue;

      const taskKey = source.code;
      if (scheduledTasks.has(taskKey)) continue;

      try {
        const task = cron.schedule(sched.cronExpr, () => {
          executeSchedule(source.code).catch((err) => {
            logger.error(`[scheduler] ${source.code} 执行异常: ${err.message}`);
          });
        });

        scheduledTasks.set(taskKey, task);
        logger.info(`[scheduler] 注册定时器 ${source.code}: ${sched.cronExpr}`);
      } catch (err: any) {
        logger.error(`[scheduler] 注册失败 ${source.code} (${sched.cronExpr}): ${err.message}`);
      }
    }
  });

  logger.info("[scheduler] 调度器已启动");
}

export function stopScheduler(): void {
  for (const [key, task] of scheduledTasks) {
    task.stop();
    scheduledTasks.delete(key);
  }
  logger.info("[scheduler] 调度器已停止");
}

export function listScheduledTasks(): string[] {
  return Array.from(scheduledTasks.keys());
}

export async function runOnce(sourceCode: string): Promise<void> {
  await executeSchedule(sourceCode);
}

export default { startScheduler, stopScheduler, listScheduledTasks, runOnce };
