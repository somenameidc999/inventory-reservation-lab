import type { Metadata } from "next";
import { database } from "../../../src/db.ts";
import { reportCache } from "../../../src/report-cache.ts";
import { reportTtlSeconds, stockReport } from "../../../src/reporting.ts";
import { administrator } from "../../session.ts";
import { DateStamp, PageHeading } from "../ui.tsx";

export const metadata: Metadata = { title: "Stock report" };

export default async function Reports() {
  const actor = await administrator();
  const report = await stockReport(database(), actor, reportCache());
  return (
    <>
      <PageHeading label="Administration" title="Stock report">Available units and reservation counts by item.</PageHeading>
      <div className="panel mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
        <span className="font-semibold">{report.source === "redis" ? "Redis cache" : "PostgreSQL"}</span>
        <span className="text-muted">Generated <DateStamp date={report.generatedAt} /></span>
        <span className="text-muted">Report data can be up to {reportTtlSeconds} seconds old.</span>
      </div>
      <div className="table-wrap">
        <table className="w-full min-w-96">
          <thead><tr><th>Equipment</th><th>Available</th><th>Reserved</th></tr></thead>
          <tbody>
            {report.rows.map((row) => <tr key={row.item_id}>
              <td className="font-semibold">{row.name}</td><td>{row.available}</td><td>{row.reserved}</td>
            </tr>)}
            {report.rows.length === 0 && <tr><td colSpan={3}>No equipment to report.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
