import { Request, Response, NextFunction } from "express";
import config from "../config";
import { error } from "../utils/response";
import { verify } from "../utils/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * 管理员鉴权中间件，支持两种鉴权方式：
 * 1. x-admin-key 请求头（独立密钥，向后兼容 /admin/login）
 * 2. Authorization: Bearer <token>（管理员用户登录后的 JWT）
 */
async function adminRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 模式1：x-admin-key 密钥鉴权
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (adminKey && config.adminKey && adminKey === config.adminKey) {
    next();
    return;
  }

  // 模式2：管理员用户 JWT 鉴权
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const payload = verify(token, config.jwtSecret);
      const userId = Number(payload.userId);
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (user && user.userType === "admin" && user.status === 1) {
          next();
          return;
        }
      }
    } catch {
      // token 无效，继续拒绝
    }
  }

  error(res, 403, "Forbidden", 403);
}

export { adminRequired };
export default { adminRequired };
