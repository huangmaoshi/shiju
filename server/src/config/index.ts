import * as dotenv from "dotenv";

dotenv.config();

const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "2h",
  databaseUrl: process.env.DATABASE_URL ?? "",
  logLevel: process.env.LOG_LEVEL ?? "info",
  adminKey: process.env.ADMIN_KEY ?? "",
};

export default config;
export { config };
