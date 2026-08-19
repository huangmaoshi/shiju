import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",

  logLevel: process.env.CRAWL_LOG_LEVEL || "debug",

  concurrency: parseInt(process.env.CRAWL_CONCURRENCY || "2", 10),
  timeout: parseInt(process.env.CRAWL_TIMEOUT || "15000", 10),
  maxRetry: parseInt(process.env.CRAWL_MAX_RETRY || "3", 10),
  delayMin: parseInt(process.env.CRAWL_DELAY_MIN || "1000", 10),
  delayMax: parseInt(process.env.CRAWL_DELAY_MAX || "3000", 10),

  simhashThreshold: 3,
  fingerprintLength: 64,
};

export default config;
