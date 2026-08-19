import { Router } from "express";
import * as adminController from "@/controllers/admin_controller";
import { adminRequired } from "@/middlewares/admin_middleware";

const router = Router();

// 鉴权检查（不需要admin权限，用于前端探测）
router.post("/auth", adminController.authCheck);

// 以下路由需要admin权限
router.use(adminRequired);

// ========== Dashboard ==========
router.get("/dashboard", adminController.dashboard);

// ========== Stats ==========
router.get("/stats/overview", adminController.statsOverview);

// ========== Quotes 金句管理 ==========
router.get("/quotes", adminController.quoteList);
router.post("/quotes", adminController.quoteCreate);
router.put("/quotes/:id", adminController.quoteUpdate);
router.delete("/quotes/:id", adminController.quoteDelete);
router.put("/quotes/:id/toggle", adminController.quoteToggle);

// ========== Categories 分类管理 ==========
router.get("/categories", adminController.categoryList);
router.post("/categories", adminController.categoryCreate);
router.put("/categories/:id", adminController.categoryUpdate);
router.delete("/categories/:id", adminController.categoryDelete);

// ========== Users 用户管理 ==========
router.get("/users", adminController.userList);
router.post("/users", adminController.userCreate);
router.put("/users/:id", adminController.userUpdate);
router.put("/users/:id/ban", adminController.userBan);
router.put("/users/:id/unban", adminController.userUnban);
router.delete("/users/:id", adminController.userDelete);

// ========== System Config 系统配置 ==========
router.get("/system-config", adminController.systemConfigList);
router.put("/system-config", adminController.systemConfigBatchUpdate);

// ========== Payment Config 支付配置 ==========
router.get("/payment-config", adminController.paymentConfigList);
router.post("/payment-config", adminController.paymentConfigUpsert);

// ========== Ads 广告管理 ==========
router.get("/ads", adminController.adList);
router.post("/ads", adminController.adCreate);
router.put("/ads/:id", adminController.adUpdate);
router.delete("/ads/:id", adminController.adDelete);

// ========== Card Templates 卡片模板管理 ==========
router.get("/cards", adminController.cardList);
router.post("/cards", adminController.cardCreate);
router.put("/cards/:id", adminController.cardUpdate);
router.delete("/cards/:id", adminController.cardDelete);


// 兼容旧接口名
router.get("/crawlers", adminController.crawlTasks);
// ========== Crawl Sources 采集源管理 ==========
router.get("/crawl/sources", adminController.crawlSources);
router.post("/crawl/sources", adminController.crawlSourceCreate);
router.put("/crawl/sources/:id", adminController.crawlSourceUpdate);
router.delete("/crawl/sources/:id", adminController.crawlSourceDelete);

// ========== Crawl Tasks 采集任务管理 ==========
router.get("/crawl/tasks", adminController.crawlTasks);
router.post("/crawl/run", adminController.crawlRun);
router.post("/crawl/tasks/:id/stop", adminController.crawlStop);

// ========== Crawl Records 采集记录/审核 ==========
router.get("/crawl/records", adminController.crawlRecords);
router.post("/crawl/audit", adminController.crawlAudit);

// ========== Crawl Import 批量导入 ==========
router.post("/crawl/import", adminController.crawlImport);
router.get("/crawl/source-stats", adminController.crawlSourceStats);
router.get("/crawl/sources/:id/check", adminController.crawlSourceCheck);
router.get("/crawl/sources-check-all", adminController.crawlSourceCheckAll);

// ========== Crawl Schedule 采集调度 ==========
router.get("/crawl/schedule", adminController.crawlSchedule);
router.post("/crawl/schedule", adminController.crawlScheduleCreate);
router.put("/crawl/schedule/:id", adminController.crawlScheduleUpdate);
router.delete("/crawl/schedule/:id", adminController.crawlScheduleDelete);
router.post("/crawl/schedule/:id/enable", adminController.crawlScheduleEnable);
router.post("/crawl/schedule/:id/disable", adminController.crawlScheduleDisable);
router.post("/crawl/schedule/:id/trigger", adminController.crawlScheduleTrigger);

// ========== OriginalText / Quote 审核 ==========
router.get("/audit/pending-stats", adminController.pendingAuditStats);
router.post("/audit/original-texts", adminController.auditOriginalText);
router.post("/audit/quotes", adminController.auditQuote);

// ========== OriginalText Admin 管理 ==========
router.get("/original-texts", adminController.originalTextAdminList);
router.get("/original-texts/:id", adminController.originalTextAdminDetail);

export default router;
