import { readFile } from "node:fs/promises";
import { Client } from "pg";

if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL before running db:setup.");
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(416715)");
  for (const file of ["schema.sql", "seed.sql"]) {
    await client.query(await readFile(new URL(`../db/${file}`, import.meta.url), "utf8"));
  }
  await client.query("COMMIT");
  console.log("Schema ready. Added any missing synthetic records.");
} finally {
  await client.end();
}
