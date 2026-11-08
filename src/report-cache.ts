import { Redis } from "ioredis";
import { reportTtlSeconds, type Report, type ReportCache } from "./reporting.ts";

let redis: Redis | undefined;

export function reportCache(): ReportCache | undefined {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  const namespace = process.env.REPORT_CACHE_NAMESPACE || "inventory-lab";
  const key = `${namespace}:stock-summary:v1`;

  if (!redis) {
    redis = new Redis(url, {
      connectTimeout: 250,
      commandTimeout: 250,
      maxRetriesPerRequest: 0,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2_000),
    });
    // Command rejections are handled by the reporting service.
    redis.on("error", () => {});
  }
  const client = redis;
  return {
    async read() {
      const value = await client.get(key);
      if (!value) return null;
      const report = JSON.parse(value) as Report;
      const age = Date.now() - Date.parse(report.generatedAt);
      return age >= 0 && age < reportTtlSeconds * 1_000 && Array.isArray(report.rows) ? report : null;
    },
    async write(report) {
      await client.set(key, JSON.stringify(report), "EX", reportTtlSeconds);
    },
  };
}
