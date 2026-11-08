import { Pool } from "pg";

let pool: Pool | undefined;

export function database(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3_000,
    statement_timeout: 10_000,
  });
  return pool;
}
