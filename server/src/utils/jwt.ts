import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  openId?: string;
}

function sign(payload: JwtPayload, secret: string, expiresIn: string | number = "2h"): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

function verify(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

export { sign, verify };
export default { sign, verify };
