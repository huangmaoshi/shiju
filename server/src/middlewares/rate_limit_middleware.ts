import rateLimit from "express-rate-limit";

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "Too many requests, please try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: "Too many login attempts, please try again later." },
});

export { generalLimiter, loginLimiter };
export default { generalLimiter, loginLimiter };
