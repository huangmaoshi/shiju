import { Response } from "express";

function ok<T = unknown>(res: Response, data: T = null as unknown as T, message = "ok"): Response {
  return res.status(200).json({
    code: 0,
    message,
    data,
  });
}

function error(res: Response, code: number, message: string, status = 400): Response {
  return res.status(status).json({
    code,
    message,
    data: null,
  });
}

export { ok, error };
export default { ok, error };
