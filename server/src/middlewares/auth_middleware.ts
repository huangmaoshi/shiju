import { Request, Response, NextFunction } from "express";
import { verify } from "../utils/jwt";
import config from "../config";
import { error } from "../utils/response";

export interface AuthRequest extends Request {
  userId?: string;
  openId?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}

function authRequired(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    error(res, 401, "Missing token", 401);
    return;
  }
  try {
    const payload = verify(token, config.jwtSecret);
    req.userId = payload.userId;
    req.openId = payload.openId;
    next();
  } catch {
    error(res, 401, "Invalid or expired token", 401);
  }
}

function authOptional(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verify(token, config.jwtSecret);
    req.userId = payload.userId;
    req.openId = payload.openId;
  } catch {
    // ignore
  }
  next();
}

export { authRequired, authOptional, extractToken };
export default { authRequired, authOptional, extractToken };
