import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { importFromGithubRaw } from "./github_import_service";
import { resolveGithubRawUrl } from "@/utils/crawl_url";

const prisma = new PrismaClient();

interface ScheduleJob {
    scheduleId: number;
    sourceId: number;
    task?: ReturnType<typeof cron.schedule>;
}

const jobs = new Map<number, ScheduleJob>();

async function resolveRawUrl(sourceId: number): Promise<string | null> {
    const source = await prisma.crawlSource.findUnique({ where: { id: sourceId } });
    if (!source) return null;
    return resolveGithubRawUrl(source);
}

async function runSchedule(scheduleId: number) {
    const schedule = await prisma.crawlSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule || !schedule.enabled) return;

    await prisma.crawlSchedule.update({
        where: { id: scheduleId },
        data: { lastRunStatus: "running", lastRunAt: new Date(), lastError: null },
    });

    const source = await prisma.crawlSource.findUnique({ where: { id: schedule.sourceId } });
    if (!source) {
        await prisma.crawlSchedule.update({
            where: { id: scheduleId },
            data: { lastRunStatus: "failed", lastError: "采集源不存在" },
        });
        return;
    }

    const rawUrl = await resolveRawUrl(source.id);
    if (!rawUrl || !/\.json(?:$|\?)/i.test(rawUrl)) {
        await prisma.crawlSchedule.update({
            where: { id: scheduleId },
            data: { lastRunStatus: "failed", lastError: `URL 无效: ${rawUrl ?? "(空)"}` },
        });
        return;
    }

    const task = await prisma.crawlTask.create({
        data: {
            sourceId: source.id,
            url: rawUrl,
            provider: source.type,
            status: "running",
            startAt: new Date(),
        },
    });

    try {
        const result = await importFromGithubRaw({
            rawUrl,
            taskId: task.id,
            sourceId: source.id,
            sourceName: source.name,
            complianceTag: source.complianceTag || undefined,
            protocol: source.protocol || undefined,
            provider: source.type,
            categoryType: source.categoryType || undefined,
        });

        await prisma.crawlTask.update({
            where: { id: task.id },
            data: {
                status: "success",
                endAt: new Date(),
                totalCount: result.totalFetched,
                newCount: result.totalInserted,
                recordCount: result.originalTextsInserted,
                lastError:
                    result.totalSkipped > 0
                        ? `去重跳过 ${result.totalSkipped} 条 (MD5=${result.skippedReason.md5}, SimHash=${result.skippedReason.simhash})`
                        : null,
            },
        });

        await prisma.crawlSource.update({
            where: { id: source.id },
            data: {
                lastRunAt: new Date(),
                lastCrawlAt: new Date(),
                totalCrawled: { increment: result.originalTextsInserted },
            },
        });

        await prisma.crawlSchedule.update({
            where: { id: scheduleId },
            data: {
                lastRunStatus: "success",
                lastRunCount: { increment: result.originalTextsInserted },
                nextRunAt: computeNextRun(schedule.cronExpr),
            },
        });
    } catch (err: any) {
        await prisma.crawlTask.update({
            where: { id: task.id },
            data: { status: "failed", endAt: new Date(), lastError: err.message },
        });
        await prisma.crawlSchedule.update({
            where: { id: scheduleId },
            data: {
                lastRunStatus: "failed",
                lastError: err.message?.slice(0, 500),
                nextRunAt: computeNextRun(schedule.cronExpr),
            },
        });
    }
}

function computeNextRun(cronExpr: string): Date | null {
    try {
        if (!cron.validate(cronExpr)) return null;
        const parts = cronExpr.trim().split(/\s+/);
        const [min, hr, dom, mon, dow] = parts;
        const jsCron = `${min} ${hr} ${dom} ${mon} ${dow}`;
        if (!cron.validate(jsCron)) return null;
        // node-cron 没有暴露 nextDate，用简单估算：
        const d = new Date();
        d.setMinutes(d.getMinutes() + 1);
        d.setSeconds(0);
        return d;
    } catch {
        return null;
    }
}

export const cronScheduler = {
    startAll: async () => {
        const schedules = await prisma.crawlSchedule.findMany({ where: { enabled: 1 } });
        for (const s of schedules) {
            cronScheduler.register(s);
        }
        console.log(`[CronScheduler] loaded ${schedules.length} schedules`);
    },

    register(schedule: { id: number; cronExpr: string; sourceId: number; enabled: number }) {
        cronScheduler.unregister(schedule.id);
        if (!schedule.enabled) return;
        if (!cron.validate(schedule.cronExpr)) {
            console.warn(`[CronScheduler] invalid cron "${schedule.cronExpr}" for schedule #${schedule.id}`);
            return;
        }
        const task = cron.schedule(schedule.cronExpr, () => {
            runSchedule(schedule.id).catch((e) =>
                console.error(`[CronScheduler] schedule #${schedule.id} error:`, e.message),
            );
        });
        jobs.set(schedule.id, { scheduleId: schedule.id, sourceId: schedule.sourceId, task });
        console.log(`[CronScheduler] schedule #${schedule.id} (source ${schedule.sourceId}) registered: ${schedule.cronExpr}`);
    },

    unregister(scheduleId: number) {
        const job = jobs.get(scheduleId);
        if (job?.task) {
            job.task.stop();
            jobs.delete(scheduleId);
        }
    },

    triggerNow: async (scheduleId: number) => {
        runSchedule(scheduleId).catch((e) =>
            console.error(`[CronScheduler] manual trigger #${scheduleId} error:`, e.message),
        );
    },

    stopAll: () => {
        for (const job of jobs.values()) job.task?.stop();
        jobs.clear();
        console.log("[CronScheduler] all schedules stopped");
    },

    list() {
        return Array.from(jobs.keys());
    },
};
