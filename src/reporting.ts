import type { Pool } from "pg";
import { requireAdmin, type Actor } from "./auth.ts";

export type ReportRow = { item_id: string; name: string; available: number; reserved: number };
export type Report = { generatedAt: string; rows: ReportRow[] };
export const reportTtlSeconds = 30;

export interface ReportCache {
  read(): Promise<Report | null>;
  write(report: Report): Promise<void>;
}

export async function stockReport(db: Pool, actor: Actor, cache?: ReportCache) {
  requireAdmin(actor);
  const cached = await cache?.read().catch(() => null);
  if (cached) return { ...cached, source: "redis" as const };

  const generatedAt = new Date().toISOString();
  const { rows } = await db.query<ReportRow>(
    `SELECT i.item_id, i.name, i.available, count(r.reservation_id)::integer AS reserved
     FROM inventory i LEFT JOIN reservations r USING (item_id)
     GROUP BY i.item_id
     ORDER BY i.name, i.item_id`,
  );
  const report = { generatedAt, rows };
  await cache?.write(report).catch(() => {});
  return { ...report, source: "database" as const };
}
