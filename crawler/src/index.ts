import prisma from "./db";
import logger from "./logger";
import config from "./config";
import { getProvider, listProviders, getAllProviders } from "./providers/factory";
import { writeQuote } from "./processors/db_writer";
import scheduler from "./scheduler";

function parseArgs(): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  const raw = process.argv.slice(2);

  for (let i = 0; i < raw.length; i++) {
    const token = raw[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function cmdList(): Promise<void> {
  const providers = listProviders();
  console.log("\n可用 Provider 列表:");
  for (const code of providers) {
    const p = getProvider(code);
    if (p) {
      console.log(`  - ${code.padEnd(20)} ${p.name} (${p.baseUrl})`);
    }
  }

  const sources = await prisma.crawlSource.findMany({
    select: { id: true, code: true, name: true, status: true, totalCrawled: true },
  });

  if (sources.length > 0) {
    console.log("\n数据库 CrawlSource 列表:");
    for (const s of sources) {
      console.log(
        `  [${s.id}] ${s.code.padEnd(20)} ${s.name}  status=${s.status}  total=${s.totalCrawled}`
      );
    }
  }
}

async function cmdRun(sourceCode?: string, pages?: string): Promise<void> {
  const pageCount = pages ? parseInt(pages, 10) : 5;

  if (sourceCode) {
    const provider = getProvider(sourceCode);
    if (!provider) {
      console.error(`Provider 不存在: ${sourceCode}`);
      console.log(`可用: ${listProviders().join(", ")}`);
      process.exit(1);
    }
    await runProvider(provider, pageCount);
  } else {
    const all = getAllProviders();
    for (const p of all) {
      await runProvider(p, pageCount);
    }
  }
}

async function runProvider(provider: ReturnType<typeof getProvider>, pages: number): Promise<void> {
  if (!provider) return;

  const source = await ensureCrawlSource(provider);

  console.log(`\n===== 开始采集 [${provider.code}] ${provider.name} (${pages} 页) =====`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  const task = await prisma.crawlTask.create({
    data: {
      sourceId: source.id,
      url: provider.baseUrl,
      status: "running",
      maxRetry: config.maxRetry,
    },
  });

  for (let page = 1; page <= pages; page++) {
    try {
      const rawList = await provider.fetchList(page);
      if (rawList.length === 0) {
        console.log(`  第 ${page} 页无数据，停止`);
        break;
      }

      console.log(`  第 ${page} 页获取 ${rawList.length} 条`);

      for (const raw of rawList) {
        try {
          const enriched = await provider.fetchDetail(raw);
          const result = await writeQuote(enriched, source.id, task.id);
          if (result.status === "inserted") {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err: any) {
          failed++;
          logger.error(`处理失败: ${err.message}`);
        }
      }
    } catch (err: any) {
      failed++;
      logger.error(`第 ${page} 页失败: ${err.message}`);
    }
  }

  await prisma.crawlTask.update({
    where: { id: task.id },
    data: {
      status: "success",
      recordCount: inserted,
      lastRunAt: new Date(),
    },
  });

  await prisma.crawlSource.update({
    where: { id: source.id },
    data: {
      lastCrawlAt: new Date(),
      lastRunAt: new Date(),
      totalCrawled: { increment: inserted + skipped },
    },
  });

  console.log(`  结果: 新增 ${inserted}, 跳过 ${skipped}, 失败 ${failed}`);
}

async function ensureCrawlSource(provider: NonNullable<ReturnType<typeof getProvider>>) {
  let source = await prisma.crawlSource.findUnique({
    where: { code: provider.code },
  });

  if (!source) {
    source = await prisma.crawlSource.create({
      data: {
        name: provider.name,
        code: provider.code,
        baseUrl: provider.baseUrl,
        type: "quote",
        status: 1,
        qpsLimit: config.concurrency,
      },
    });
    logger.info(`自动创建 CrawlSource: ${provider.code}`);
  }

  return source;
}

async function startDaemon(): Promise<void> {
  console.log("[crawler] 以守护模式启动，调度器已激活\n");
  scheduler.startScheduler();

  process.on("SIGINT", async () => {
    console.log("\n[crawler] 收到 SIGINT，正在退出...");
    scheduler.stopScheduler();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[crawler] 收到 SIGTERM，正在退出...");
    scheduler.stopScheduler();
    await prisma.$disconnect();
    process.exit(0);
  });
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.list) {
    await cmdList();
    await prisma.$disconnect();
    return;
  }

  if (args.run !== undefined) {
    const sourceCode = typeof args.run === "string" ? args.run : undefined;
    const pages = typeof args.pages === "string" ? args.pages : undefined;
    await cmdRun(sourceCode, pages);
    await prisma.$disconnect();
    return;
  }

  await startDaemon();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[crawler] 启动失败:", err);
    process.exit(1);
  });
}

export { cmdList, cmdRun, startDaemon, runProvider, ensureCrawlSource, main };
export default { cmdList, cmdRun, startDaemon, runProvider, ensureCrawlSource, main };
