import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import config from "../config";

export class BusinessError extends Error {
  code: number;
  status: number;

  constructor(code: number, message: string, status = 400) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, BusinessError.prototype);
  }
}

function errorHandler(
  err: Error | BusinessError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof BusinessError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      data: null,
    });
  }

  const isDev = config.nodeEnv !== "production";
  logger.error(err.stack || err.message);

  return res.status(500).json({
    code: 500,
    message: isDev ? err.message : "Internal server error",
    data: null,
  });
}

export { errorHandler };
export default { errorHandler, BusinessError };
