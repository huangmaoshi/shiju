import { catchAsync } from "@/utils/async_handler";
import { ok, error } from "@/utils/response";
import { PrismaClient } from "@prisma/client";
import { resolveGithubRawUrl, checkUrlReachable } from "@/utils/crawl_url";

const prisma = new PrismaClient();

// ========== Auth ==========

export const authCheck = catchAsync(async (_req, res) => {
  ok(res, { ok: true });
});

// ========== Dashboard ==========

export const dashboard = catchAsync(async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalUsers, totalQuotes, totalCollections, memberCount, todayNewUsers, todayNewQuotes] =
    await Promise.all([
      prisma.user.count(),
      prisma.quote.count({ where: { isActive: true } }),
      prisma.collection.count(),
      prisma.user.count({ where: { memberLevel: { gt: 0 } } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.quote.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

  const recentCrawlers = await prisma.crawlTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { source: { select: { name: true } } },
  });

  const todayRevenue = await prisma.order.aggregate({
    where: { payStatus: 1, createdAt: { gte: todayStart } },
    _sum: { amount: true },
  });

  const topQuotes = await prisma.quote.findMany({
    orderBy: { favCount: "desc" },
    take: 5,
    select: { id: true, content: true, author: true, favCount: true },
  });

  ok(res, {
    totalUsers,
    totalQuotes,
    totalCollections,
    memberCount,
    todayNewUsers,
    todayNewQuotes,
    todayRevenue: todayRevenue._sum.amount || 0,
    recentCrawlers,
    topQuotes,
  });
});

// ========== Quotes (金句管理) ==========

export const quoteList = catchAsync(async (req, res) => {
  const { keyword, categoryId, isActive, auditStatus, page, pageSize } = req.query as {
    keyword?: string;
    categoryId?: string;
    isActive?: string;
    auditStatus?: string;
    page?: string;
    pageSize?: string;
  };
  const take = Number(pageSize || 20);
  const skip = ((Number(page || 1)) - 1) * take;

  const where: any = {};
  if (keyword) where.content = { contains: keyword };
  if (categoryId) where.quoteCategories = { some: { categoryId: Number(categoryId) } };
  if (isActive !== undefined && isActive !== "") where.isActive = isActive === "true";
  if (auditStatus !== undefined && auditStatus !== "") where.auditStatus = Number(auditStatus);

  const [list, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        quoteCategories: { include: { category: { select: { id: true, name: true } } } },
      },
    }),
    prisma.quote.count({ where }),
  ]);

  ok(res, { list, total, page: Number(page || 1), pageSize: take });
});

export const quoteCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.content) return error(res, 400, "内容不能为空");

  const quote = await prisma.quote.create({
    data: {
      content: body.content,
      author: body.author || null,
      source: body.source || null,
      sourceUrl: body.sourceUrl || null,
      summary: body.summary || null,
      tags: body.tags || null,
      pinyinData: body.pinyinData || null,
      wordCount: body.content.length,
      isFree: body.isFree ?? true,
      isActive: body.isActive ?? true,
      provider: body.provider || "admin",
    },
  });

  if (body.categoryIds?.length) {
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        quoteCategories: {
          create: body.categoryIds.map((cid: number) => ({ categoryId: cid })),
        },
      },
    });
  }

  ok(res, quote);
});

export const quoteUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const quote = await prisma.quote.update({
    where: { id },
    data: {
      content: body.content ?? undefined,
      author: body.author ?? undefined,
      source: body.source ?? undefined,
      sourceUrl: body.sourceUrl ?? undefined,
      summary: body.summary ?? undefined,
      tags: body.tags ?? undefined,
      isFree: body.isFree ?? undefined,
      isActive: body.isActive ?? undefined,
    },
  });

  if (body.categoryIds) {
    await prisma.quote.update({
      where: { id },
      data: {
        quoteCategories: {
          deleteMany: {},
          create: body.categoryIds.map((cid: number) => ({ categoryId: cid })),
        },
      },
    });
  }

  ok(res, quote);
});

export const quoteDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.quote.update({
    where: { id },
    data: { quoteCategories: { deleteMany: {} } },
  });
  await prisma.quote.delete({ where: { id } });
  ok(res, null);
});

export const quoteToggle = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const { isActive } = req.body as { isActive?: boolean };
  const quote = await prisma.quote.update({
    where: { id },
    data: { isActive: isActive !== undefined ? !!isActive : undefined },
  });
  ok(res, quote);
});

// ========== Categories (分类管理) ==========

export const categoryList = catchAsync(async (_req, res) => {
  const list = await prisma.category.findMany({
    orderBy: { sort: "asc" },
    include: { children: true, parent: { select: { id: true, name: true } } },
  });
  ok(res, list);
});

export const categoryCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.type) return error(res, 400, "名称和类型不能为空");

  const item = await prisma.category.create({
    data: {
      name: body.name,
      type: body.type,
      parentId: body.parentId || null,
      sort: body.sort ?? 0,
      status: body.status ?? 1,
    },
  });
  ok(res, item);
});

export const categoryUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const item = await prisma.category.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      type: body.type ?? undefined,
      parentId: body.parentId ?? undefined,
      sort: body.sort ?? undefined,
      status: body.status ?? undefined,
    },
  });
  ok(res, item);
});

export const categoryDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const childCount = await prisma.category.count({ where: { parentId: id } });
  if (childCount > 0) return error(res, 400, "存在子分类，无法删除");

  await prisma.quoteCategory.deleteMany({ where: { categoryId: id } });
  await prisma.category.delete({ where: { id } });
  ok(res, null);
});

// ========== Users (用户管理) ==========

export const userList = catchAsync(async (req, res) => {
  const { keyword, status, memberLevel, page, pageSize } = req.query as {
    keyword?: string;
    status?: string;
    memberLevel?: string;
    page?: string;
    pageSize?: string;
  };
  const take = Number(pageSize || 15);
  const skip = ((Number(page || 1)) - 1) * take;

  const where: any = {};
  if (keyword) {
    where.OR = [
      { nickname: { contains: keyword } },
      { openId: { contains: keyword } },
      { username: { contains: keyword } },
    ];
  }
  if (status !== undefined && status !== "") where.status = Number(status);
  if (memberLevel !== undefined && memberLevel !== "") where.memberLevel = Number(memberLevel);

  const [list, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        openId: true,
        username: true,
        nickname: true,
        avatar: true,
        gender: true,
        userType: true,
        memberLevel: true,
        memberExpireAt: true,
        trialExpireAt: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  ok(res, { list, total, page: Number(page || 1), pageSize: take });
});

export const userCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  const { username, password, nickname, memberLevel, memberExpireAt, trialExpireAt, status, userType } = body as {
    username?: string; password?: string; nickname?: string;
    memberLevel?: number; memberExpireAt?: string; trialExpireAt?: string; status?: number;
    userType?: string;
  };

  if (!username) return error(res, 400, "用户名不能为空");

  const existing = await prisma.user.findFirst({ where: { OR: [{ username }, { openId: username }] } });
  if (existing) return error(res, 409, "用户名已存在");

  // 仅允许 wechat / account / admin 三种类型
  const finalUserType = userType === "admin" || userType === "wechat" ? userType : "account";

  const openId = `account_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const data: any = {
    openId,
    username,
    nickname: nickname || username,
    userType: finalUserType,
    status: status ?? 1,
    memberLevel: finalUserType === "admin" ? 2 : (memberLevel ?? 0),
  };

  if (password) {
    const { hashPassword } = await import("@/utils/password");
    data.passwordHash = hashPassword(password);
  }
  if (memberExpireAt) data.memberExpireAt = new Date(memberExpireAt);
  if (trialExpireAt) data.trialExpireAt = new Date(trialExpireAt);

  const user = await prisma.user.create({ data });
  ok(res, user);
});

export const userUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const data: any = {};
  if (body.nickname !== undefined) data.nickname = body.nickname;
  if (body.username !== undefined) {
    const dup = await prisma.user.findFirst({ where: { username: body.username, id: { not: id } } });
    if (dup) return error(res, 409, "用户名已存在");
    data.username = body.username;
  }
  if (body.status !== undefined) data.status = body.status;
  if (body.userType !== undefined) {
    // 仅允许 wechat / account / admin
    const t = body.userType;
    data.userType = t === "admin" || t === "wechat" ? t : "account";
    if (data.userType === "admin") data.memberLevel = 2;
  }
  if (body.memberLevel !== undefined) data.memberLevel = body.memberLevel;
  if (body.memberExpireAt !== undefined) data.memberExpireAt = body.memberExpireAt ? new Date(body.memberExpireAt) : null;
  if (body.trialExpireAt !== undefined) data.trialExpireAt = body.trialExpireAt ? new Date(body.trialExpireAt) : null;

  if (body.resetPassword) {
    const { hashPassword } = await import("@/utils/password");
    data.passwordHash = hashPassword(body.resetPassword);
  }

  const user = await prisma.user.update({ where: { id }, data });
  ok(res, user);
});

export const userBan = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { status: 0 } });
  ok(res, user);
});

export const userUnban = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.update({ where: { id }, data: { status: 1 } });
  ok(res, user);
});

export const userDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.user.delete({ where: { id } });
  ok(res, null);
});

// ========== SystemConfig (系统配置) ==========

export const systemConfigList = catchAsync(async (_req, res) => {
  const rows = await prisma.systemConfig.findMany({ orderBy: { key: "asc" } });
  ok(res, rows);
});

export const systemConfigBatchUpdate = catchAsync(async (req, res) => {
  const items = (req.body?.items || []) as Array<{ key: string; value: string; remark?: string }>;
  for (const item of items) {
    if (!item.key) continue;
    await prisma.systemConfig.upsert({
      where: { key: item.key },
      create: { key: item.key, value: String(item.value), remark: item.remark ?? null },
      update: { value: String(item.value), remark: item.remark },
    });
  }
  ok(res, null);
});

export const paymentConfigList = catchAsync(async (_req, res) => {
  const list = await prisma.paymentConfig.findMany();
  ok(res, list);
});

export const paymentConfigUpsert = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.payChannel) return error(res, 400, "payChannel 不能为空");

  const item = await prisma.paymentConfig.upsert({
    where: { payChannel: body.payChannel },
    create: {
      payChannel: body.payChannel,
      appId: body.appId ?? null,
      mchId: body.mchId ?? null,
      apiKey: body.apiKey ?? null,
      notifyUrl: body.notifyUrl ?? null,
      isActive: body.isActive ?? true,
      remark: body.remark ?? null,
    },
    update: {
      appId: body.appId,
      mchId: body.mchId,
      apiKey: body.apiKey,
      notifyUrl: body.notifyUrl,
      isActive: body.isActive,
      remark: body.remark,
    },
  });
  ok(res, item);
});

// ========== Ads (广告管理) ==========

export const adList = catchAsync(async (_req, res) => {
  const list = await prisma.adConfig.findMany({ orderBy: { priority: "desc" } });
  ok(res, list);
});

export const adCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.position) return error(res, 400, "广告位不能为空");

  const item = await prisma.adConfig.create({
    data: {
      position: body.position,
      title: body.title || null,
      imageUrl: body.imageUrl || null,
      targetUrl: body.targetUrl || null,
      adType: body.adType || null,
      adUnitId: body.adUnitId || null,
      platform: body.platform || null,
      frequency: body.frequency ?? 3,
      priority: body.priority ?? 0,
      isActive: body.isActive ?? true,
      status: body.status ?? 1,
      startAt: body.startAt || null,
      endAt: body.endAt || null,
    },
  });
  ok(res, item);
});

export const adUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const item = await prisma.adConfig.update({
    where: { id },
    data: {
      position: body.position ?? undefined,
      title: body.title ?? undefined,
      imageUrl: body.imageUrl ?? undefined,
      targetUrl: body.targetUrl ?? undefined,
      adType: body.adType ?? undefined,
      adUnitId: body.adUnitId ?? undefined,
      platform: body.platform ?? undefined,
      frequency: body.frequency ?? undefined,
      priority: body.priority ?? undefined,
      isActive: body.isActive ?? undefined,
      status: body.status ?? undefined,
      startAt: body.startAt ?? undefined,
      endAt: body.endAt ?? undefined,
    },
  });
  ok(res, item);
});

export const adDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.adConfig.delete({ where: { id } });
  ok(res, null);
});

// ========== Card Templates (卡片模板管理) ==========

export const cardList = catchAsync(async (_req, res) => {
  const list = await prisma.cardTemplate.findMany({ orderBy: { id: "asc" } });
  ok(res, list);
});

export const cardCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.name) return error(res, 400, "模板名称不能为空");

  const item = await prisma.cardTemplate.create({
    data: {
      name: body.name,
      style: body.style || "classic",
      bgType: body.bgType || "color",
      bgValue: body.bgValue || "#ffffff",
      fontFamily: body.fontFamily || "system",
      fontSize: body.fontSize ?? 18,
      fontColor: body.fontColor || "#333333",
      lineHeight: body.lineHeight ?? 1.8,
      textAlign: body.textAlign || "center",
      showAuthor: body.showAuthor ?? 1,
      showWatermark: body.showWatermark ?? 1,
      isMember: body.isMember ?? 0,
      status: body.status ?? 1,
      previewUrl: body.previewUrl || null,
    },
  });
  ok(res, item);
});

export const cardUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const item = await prisma.cardTemplate.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      style: body.style ?? undefined,
      bgType: body.bgType ?? undefined,
      bgValue: body.bgValue ?? undefined,
      fontFamily: body.fontFamily ?? undefined,
      fontSize: body.fontSize ?? undefined,
      fontColor: body.fontColor ?? undefined,
      lineHeight: body.lineHeight ?? undefined,
      textAlign: body.textAlign ?? undefined,
      showAuthor: body.showAuthor ?? undefined,
      showWatermark: body.showWatermark ?? undefined,
      isMember: body.isMember ?? undefined,
      status: body.status ?? undefined,
      previewUrl: body.previewUrl ?? undefined,
    },
  });
  ok(res, item);
});

export const cardDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.cardTemplate.delete({ where: { id } });
  ok(res, null);
});

// ========== Crawl Sources (采集源管理) ==========

export const crawlSources = catchAsync(async (_req, res) => {
  const list = await prisma.crawlSource.findMany({
    orderBy: { priority: "desc" },
  });
  ok(res, list);
});

export const crawlSourceCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.name || !body.code || !body.baseUrl) return error(res, 400, "名称、编码和基础URL不能为空");

  const item = await prisma.crawlSource.create({
    data: {
      name: body.name,
      code: body.code,
      baseUrl: body.baseUrl,
      type: body.type || "html",
      datasetType: body.datasetType || null,
      complianceTag: body.complianceTag || null,
      protocol: body.protocol || null,
      datasetSize: body.datasetSize ? Number(body.datasetSize) : null,
      needTranslate: body.needTranslate === true ? true : false,
      categoryType: body.categoryType || null,
      categoryId: body.categoryId ? Number(body.categoryId) : null,
      charset: body.charset || "utf-8",
      userAgent: body.userAgent || null,
      qpsLimit: body.qpsLimit ?? 5,
      maxDepth: body.maxDepth ?? 3,
      status: body.status ?? 1,
      priority: body.priority ?? 0,
      remark: body.remark || null,
    },
  });
  ok(res, item);
});

export const crawlSourceUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl;
  if (body.type !== undefined) data.type = body.type;
  if (body.datasetType !== undefined) data.datasetType = body.datasetType;
  if (body.complianceTag !== undefined) data.complianceTag = body.complianceTag;
  if (body.protocol !== undefined) data.protocol = body.protocol;
  if (body.datasetSize !== undefined) data.datasetSize = Number(body.datasetSize);
  if (body.needTranslate === true) data.needTranslate = true;
  else if (body.needTranslate === false) data.needTranslate = false;
  if (body.categoryType !== undefined) data.categoryType = body.categoryType;
  if (body.categoryId !== undefined) data.categoryId = Number(body.categoryId);
  if (body.charset !== undefined) data.charset = body.charset;
  if (body.userAgent !== undefined) data.userAgent = body.userAgent;
  if (body.qpsLimit !== undefined) data.qpsLimit = Number(body.qpsLimit);
  if (body.maxDepth !== undefined) data.maxDepth = Number(body.maxDepth);
  if (body.status !== undefined) data.status = Number(body.status);
  if (body.priority !== undefined) data.priority = Number(body.priority);
  if (body.remark !== undefined) data.remark = body.remark;

  const item = await prisma.crawlSource.update({ where: { id }, data });
  ok(res, item);
});

export const crawlSourceDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.crawlSource.delete({ where: { id } });
  ok(res, null);
});

// ========== Crawl Tasks (采集任务管理) ==========

export const crawlTasks = catchAsync(async (req, res) => {
  const { status, page, pageSize } = req.query as {
    status?: string;
    page?: string;
    pageSize?: string;
  };
  const take = Number(pageSize || 20);
  const skip = ((Number(page || 1)) - 1) * take;

  const where: any = {};
  if (status) where.status = status;

  const [list, total] = await Promise.all([
    prisma.crawlTask.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: { source: { select: { name: true } } },
    }),
    prisma.crawlTask.count({ where }),
  ]);

  ok(res, { list, total, page: Number(page || 1), pageSize: take });
});

export const crawlRun = catchAsync(async (req, res) => {
  const { sourceId, url, provider } = req.body || {};

  const task = await prisma.crawlTask.create({
    data: {
      sourceId: sourceId ? Number(sourceId) : null,
      url: url || null,
      provider: provider || "custom",
      status: "pending",
      startAt: new Date(),
      totalCount: 0,
      newCount: 0,
    },
  });

  // 模拟异步采集完成（实际应由 crawler 模块处理）
  setTimeout(async () => {
    await prisma.crawlTask.update({
      where: { id: task.id },
      data: {
        status: "success",
        endAt: new Date(),
        totalCount: Math.floor(Math.random() * 50) + 10,
        newCount: Math.floor(Math.random() * 20) + 1,
      },
    });
  }, 2000);

  ok(res, task);
});

export const crawlStop = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.crawlTask.update({
    where: { id },
    data: { status: "failed", endAt: new Date(), lastError: "已手动停止" },
  });
  ok(res, null);
});

// ========== Crawl Records (采集记录/审核) ==========

export const crawlRecords = catchAsync(async (req, res) => {
  const { auditStatus, page, pageSize } = req.query as {
    auditStatus?: string;
    page?: string;
    pageSize?: string;
  };
  const take = Number(pageSize || 20);
  const skip = ((Number(page || 1)) - 1) * take;

  const where: any = {};
  if (auditStatus !== undefined && auditStatus !== "") where.auditStatus = Number(auditStatus);

  const [list, total] = await Promise.all([
    prisma.crawlRecord.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: { task: { select: { provider: true, sourceId: true } } },
    }),
    prisma.crawlRecord.count({ where }),
  ]);

  ok(res, { list, total, page: Number(page || 1), pageSize: take });
});

export const crawlAudit = catchAsync(async (req, res) => {
  const { ids, auditStatus, auditReason } = req.body as {
    ids: number[];
    auditStatus: number; // 0=待审 1=通过 2=拒绝
    auditReason?: string;
  };

  await prisma.crawlRecord.updateMany({
    where: { id: { in: ids } },
    data: {
      auditStatus,
      auditReason: auditReason || null,
      auditBy: "admin",
      auditAt: new Date(),
    },
  });

  ok(res, null);
});

// ========== Crawl Schedule (采集调度) ==========

export const crawlSchedule = catchAsync(async (_req, res) => {
  const list = await prisma.crawlSchedule.findMany();
  ok(res, list);
});

export const crawlScheduleCreate = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (!body.sourceId || !body.cronExpr) return error(res, 400, "采集源和Cron表达式不能为空");

  const item = await prisma.crawlSchedule.create({
    data: {
      sourceId: Number(body.sourceId),
      cronExpr: body.cronExpr,
      enabled: body.enabled ?? 1,
      concurrency: body.concurrency ?? 2,
      pagesPerRun: body.pagesPerRun ?? 20,
    },
  });
  ok(res, item);
});

export const crawlScheduleUpdate = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};

  const item = await prisma.crawlSchedule.update({
    where: { id },
    data: {
      cronExpr: body.cronExpr ?? undefined,
      enabled: body.enabled ?? undefined,
      concurrency: body.concurrency ?? undefined,
      pagesPerRun: body.pagesPerRun ?? undefined,
    },
  });
  ok(res, item);
});

export const crawlScheduleDelete = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  await prisma.crawlSchedule.delete({ where: { id } });
  ok(res, null);
});

export const crawlScheduleEnable = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.crawlSchedule.update({
    where: { id },
    data: { enabled: 1 },
  });
  try {
    const { cronScheduler } = await import("@/services/cron_service");
    cronScheduler.register(item);
  } catch (e: any) {
    return error(res, 500, "调度器加载失败: " + e.message);
  }
  ok(res, item);
});

export const crawlScheduleDisable = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.crawlSchedule.update({
    where: { id },
    data: { enabled: 0 },
  });
  try {
    const { cronScheduler } = await import("@/services/cron_service");
    cronScheduler.unregister(id);
  } catch { /* ignore */ }
  ok(res, item);
});

export const crawlScheduleTrigger = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const schedule = await prisma.crawlSchedule.findUnique({ where: { id } });
  if (!schedule) return error(res, 404, "调度配置不存在");
  try {
    const { cronScheduler } = await import("@/services/cron_service");
    cronScheduler.triggerNow(id);
    ok(res, { triggered: true, scheduleId: id });
  } catch (e: any) {
    return error(res, 500, "触发失败: " + e.message);
  }
});

// ========== OriginalText / Quote 审核 ==========

export const auditOriginalText = catchAsync(async (req, res) => {
  const { ids, auditStatus, auditReason } = req.body as {
    ids: number[];
    auditStatus: number;
    auditReason?: string;
  };
  if (!Array.isArray(ids) || ids.length === 0) return error(res, 400, "请选择要审核的原文");
  if (![1, 2].includes(auditStatus)) return error(res, 400, "审核状态无效（1=通过 2=拒绝）");

  const numericIds = ids.map((i) => Number(i)).filter((i) => !Number.isNaN(i));
  if (numericIds.length === 0) return error(res, 400, "ID列表无效");

  const result = await prisma.originalText.updateMany({
    where: { id: { in: numericIds } },
    data: { auditStatus, auditReason: auditReason || null },
  });
  ok(res, { updated: result.count });
});

export const auditQuote = catchAsync(async (req, res) => {
  const { ids, auditStatus, auditReason } = req.body as {
    ids: number[];
    auditStatus: number;
    auditReason?: string;
  };
  if (!Array.isArray(ids) || ids.length === 0) return error(res, 400, "请选择要审核的金句");
  if (![1, 2].includes(auditStatus)) return error(res, 400, "审核状态无效（1=通过 2=拒绝）");

  const numericIds = ids.map((i) => Number(i)).filter((i) => !Number.isNaN(i));
  if (numericIds.length === 0) return error(res, 400, "ID列表无效");

  const result = await prisma.quote.updateMany({
    where: { id: { in: numericIds } },
    data: { auditStatus, auditReason: auditReason || null },
  });
  ok(res, { updated: result.count });
});

export const pendingAuditStats = catchAsync(async (_req, res) => {
  const [originalCount, quoteCount] = await Promise.all([
    prisma.originalText.count({ where: { auditStatus: 0 } }),
    prisma.quote.count({ where: { auditStatus: 0 } }),
  ]);
  ok(res, { originalCount, quoteCount });
});

export const originalTextAdminList = catchAsync(async (req, res) => {
  const { keyword, categoryType, auditStatus, page, pageSize } = req.query as {
    keyword?: string;
    categoryType?: string;
    auditStatus?: string;
    page?: string;
    pageSize?: string;
  };
  const take = Number(pageSize || 20);
  const skip = ((Number(page || 1)) - 1) * take;

  const where: any = {};
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { content: { contains: keyword } },
      { author: { contains: keyword } },
    ];
  }
  if (categoryType) where.categoryType = categoryType;
  if (auditStatus !== undefined && auditStatus !== "") where.auditStatus = Number(auditStatus);

  const [list, total] = await Promise.all([
    prisma.originalText.findMany({
      where, take, skip,
      orderBy: { createdAt: "desc" },
      include: { quotes: true },
    }),
    prisma.originalText.count({ where }),
  ]);

  ok(res, { list, total, page: Number(page || 1), pageSize: take });
});

export const originalTextAdminDetail = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.originalText.findUnique({
    where: { id },
    include: { quotes: true },
  });
  if (!item) return error(res, 404, "原文不存在");
  ok(res, item);
});

// ========== Stats (数据统计) ==========

export const statsOverview = catchAsync(async (_req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 跨数据库兼容：用 findMany + JS 分组（避免 $queryRaw 的 SQL 方言问题）
  const [users, quotes] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true } }),
    prisma.quote.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true } }),
  ]);

  const groupByDate = (rows: { createdAt: Date }[]) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = r.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  ok(res, { dailyUsers: groupByDate(users), dailyQuotes: groupByDate(quotes) });
});
// ======== 批量导入公版数据接口 ========
export const crawlImport = catchAsync(async (req, res) => {
  const { sourceId } = req.body as { sourceId: number };

  const source = await prisma.crawlSource.findUnique({ where: { id: sourceId } });
  if (!source) return error(res, 404, "采集源不存在");

  if (source.type !== "github") {
    return error(res, 400, "仅支持 GitHub 直导入类型的采集源");
  }

  const rawUrl = resolveGithubRawUrl(source);
  if (!rawUrl) {
    return error(
      res,
      400,
      "采集源 remark/baseUrl 未配置为有效的 GitHub raw URL。remark 需填完整 URL 或 owner/repo/branch/path 格式（不含中文备注）",
    );
  }

  if (source.type === "github" && !/\.json(?:$|\?)/i.test(rawUrl)) {
    return error(
      res,
      400,
      `GitHub 采集源必须指向 .json 文件，当前解析到: ${rawUrl}`,
    );
  }

  try {
    new URL(rawUrl);
  } catch {
    return error(res, 400, `解析后的 URL 无效: ${rawUrl}`);
  }

  const task = await prisma.crawlTask.create({
    data: {
      sourceId,
      url: rawUrl,
      provider: source.code,
      status: "running",
      priority: source.priority,
      totalCount: 0,
      newCount: 0,
      startAt: new Date(),
    },
  });

  // 立即返回，后台异步处理（大量数据导入耗时较长）
  res.status(202).json({
    code: 0,
    message: "已开始导入",
    data: { taskId: task.id, status: "running" },
  });

  (async () => {
    try {
      const { importFromGithubRaw } = await import("@/services/github_import_service");
      const result = await importFromGithubRaw({
        rawUrl,
        taskId: task.id,
        sourceId,
        sourceName: source.name,
        complianceTag: source.complianceTag || undefined,
        protocol: source.protocol || undefined,
        datasetType: source.datasetType || undefined,
        categoryType: source.categoryType || undefined,
        provider: source.code,
      });

      await prisma.crawlTask.update({
        where: { id: task.id },
        data: {
          status: result.errors.length > 0 && result.totalInserted === 0 ? "failed" : "success",
          endAt: new Date(),
          totalCount: result.totalFetched,
          newCount: result.totalInserted,
          recordCount: result.totalInserted,
          lastError:
            result.errors.length > 0
              ? result.errors.slice(0, 3).join("; ")
              : `去重跳过 ${result.totalSkipped} 条 (MD5=${result.skippedReason.md5}, SimHash=${result.skippedReason.simhash})`,
          errorMessage: result.errors.join("\n").slice(0, 2000),
        },
      });

      await prisma.crawlSource.update({
        where: { id: sourceId },
        data: {
          lastRunAt: new Date(),
          lastCrawlAt: new Date(),
          totalCrawled: { increment: result.totalInserted },
        },
      });
    } catch (err: any) {
      await prisma.crawlTask.update({
        where: { id: task.id },
        data: {
          status: "failed",
          endAt: new Date(),
          lastError: String(err?.message || err),
          errorMessage: String(err?.stack || err).slice(0, 2000),
        },
      });
    }
  })();
});

export const crawlSourceStats = catchAsync(async (_req, res) => {
  const [total, githubCount, publicDomainCount, apiCount, mitCount, cc0Count, apacheCount, ccBySaCount, pendingCrawl, runningCrawl] =
    await Promise.all([
      prisma.crawlSource.count(),
      prisma.crawlSource.count({ where: { type: "github" } }),
      prisma.crawlSource.count({ where: { complianceTag: "public_domain" } }),
      prisma.crawlSource.count({ where: { type: "api" } }),
      prisma.crawlSource.count({ where: { complianceTag: "mit" } }),
      prisma.crawlSource.count({ where: { complianceTag: "cc0" } }),
      prisma.crawlSource.count({ where: { complianceTag: "apache" } }),
      prisma.crawlSource.count({ where: { complianceTag: "cc_by_sa" } }),
      prisma.crawlTask.count({ where: { status: "pending" } }),
      prisma.crawlTask.count({ where: { status: "running" } }),
    ]);

  ok(res, {
    total, githubCount, publicDomainCount, apiCount, mitCount, cc0Count,
    apacheCount, ccBySaCount,
    pendingCrawl, runningCrawl,
  });
});

// ========== 采集源连通性预检 ==========
export const crawlSourceCheck = catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const source = await prisma.crawlSource.findUnique({ where: { id } });
  if (!source) return error(res, 404, "采集源不存在");

  if (source.type !== "github") {
    return error(res, 400, "仅支持 GitHub 类型采集源的连通性预检");
  }

  const rawUrl = resolveGithubRawUrl(source);
  if (!rawUrl) {
    return ok(res, {
      sourceId: id,
      ok: false,
      status: 0,
      statusText: "URL 解析失败：remark 需填完整 URL 或 owner/repo/branch/path 格式",
      url: null,
      latencyMs: 0,
    });
  }

  const result = await checkUrlReachable(rawUrl);
  // 如果检测失败，同步更新 source 的 lastError 方便列表展示
  if (!result.ok) {
    await prisma.crawlSource.update({
      where: { id },
      data: { remark: source.remark }, // touch to update updatedAt
    });
  }
  ok(res, { sourceId: id, ...result });
});

// ========== 批量采集源连通性预检 ==========
export const crawlSourceCheckAll = catchAsync(async (_req, res) => {
  const sources = await prisma.crawlSource.findMany({
    where: { type: "github", status: 1 },
    orderBy: { id: "asc" },
  });

  const results: Array<{
    sourceId: number;
    code: string;
    name: string;
    ok: boolean;
    status: number;
    statusText: string;
    url: string;
    latencyMs: number;
  }> = [];

  for (const s of sources) {
    const rawUrl = resolveGithubRawUrl(s);
    if (!rawUrl) {
      results.push({
        sourceId: s.id, code: s.code, name: s.name,
        ok: false, status: 0, statusText: "URL 解析失败",
        url: "", latencyMs: 0,
      });
      continue;
    }
    const r = await checkUrlReachable(rawUrl);
    results.push({
      sourceId: s.id, code: s.code, name: s.name,
      ok: r.ok, status: r.status, statusText: r.statusText,
      url: r.url, latencyMs: r.latencyMs,
    });
  }

  const okCount = results.filter((r) => r.ok).length;
  ok(res, {
    total: results.length,
    ok: okCount,
    fail: results.length - okCount,
    results,
  });
});
