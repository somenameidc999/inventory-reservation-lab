import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test, type TestContext } from "node:test";
import { setTimeout } from "node:timers/promises";
import { Client, Pool } from "pg";
import { createSession, endSession, readSession, type Actor } from "../src/auth.ts";
import { createItem, listInventory, listReservations, reserveFor, restockItem } from "../src/inventory.ts";
import { stockReport, type Report, type ReportCache } from "../src/reporting.ts";
import { reserveOne, type ReservationResult } from "../src/reservations.ts";

const host = process.env.INVENTORY_TEST_SOCKET;
assert.ok(host?.startsWith("/tmp/inventory-lab."), "Run tests with npm test");

const config = {
  host,
  port: 5432,
  user: "inventory_lab",
  database: "postgres",
  ssl: false,
  connectionTimeoutMillis: 3_000,
  statement_timeout: 15_000,
};
const alice = new Client(config);
const bob = new Client(config);
const observer = new Client(config);
const pool = new Pool(config);
const itemId = "field-kit";
const staff: Actor = { user_id: "user-alice", display_name: "Alice Morgan", role: "staff" };
const otherStaff: Actor = { user_id: "user-bob", display_name: "Bob Reyes", role: "staff" };
const admin: Actor = { user_id: "user-admin", display_name: "Sam Rivera", role: "admin" };
const demoPassword = "demo-storeroom-2026";

before(async () => {
  await Promise.all([alice.connect(), bob.connect(), observer.connect()]);
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await observer.query(schema);
});

beforeEach(async () => {
  await observer.query("TRUNCATE sessions, reservations, inventory, users RESTART IDENTITY");
  const seed = await readFile(new URL("../db/seed.sql", import.meta.url), "utf8");
  await observer.query(seed);
});

after(async () => {
  await Promise.all([alice.end(), bob.end(), observer.end(), pool.end()]);
});

async function backendPid(client: Client): Promise<number> {
  const { rows } = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
  return rows[0].pid;
}

function reportGrade(t: TestContext, id: string, score: number, evidence: object) {
  if (process.env.FIELDSTOCK_GRADE === "1") {
    t.diagnostic(`fieldstock-grade ${JSON.stringify({ id, score, evidence })}`);
  }
}

async function waitForBlock(waitingPid: number, blockingPid: number): Promise<boolean> {
  const deadline = performance.now() + 3_000;
  do {
    const { rows } = await observer.query<{ blocked: boolean }>(
      "SELECT $1::integer = ANY(pg_blocking_pids($2::integer)) AS blocked",
      [blockingPid, waitingPid],
    );
    if (rows[0].blocked) return true;
    await setTimeout(20);
  } while (performance.now() < deadline);

  return false;
}

test("overlapping attempts for the last unit leave exactly one reservation", async (t) => {
  const [alicePid, bobPid, observerPid] = await Promise.all([
    backendPid(alice), backendPid(bob), backendPid(observer),
  ]);
  const attempts: Promise<ReservationResult>[] = [];
  let settled: PromiseSettledResult<ReservationResult>[];
  let overlap = false;
  await observer.query("BEGIN");
  try {
    // Pause Alice's insert while her transaction still holds the inventory row.
    await observer.query("LOCK TABLE reservations IN SHARE MODE");
    const aliceAttempt = reserveOne(alice, itemId, "user-alice");
    attempts.push(aliceAttempt);
    // Observe early rejections while polling. The final await checks the original promises.
    void aliceAttempt.catch(() => {});
    await waitForBlock(alicePid, observerPid);

    const bobAttempt = reserveOne(bob, itemId, "user-bob");
    attempts.push(bobAttempt);
    void bobAttempt.catch(() => {});
    overlap = await waitForBlock(bobPid, alicePid);
    if (overlap) t.diagnostic(`pg_blocking_pids(${bobPid}) included Alice's session ${alicePid}`);
  } finally {
    await observer.query("ROLLBACK");
    settled = await Promise.allSettled(attempts);
  }

  const [aliceResult, bobResult] = settled.map((attempt) =>
    attempt.status === "fulfilled" ? attempt.value : { status: "rejected" as const },
  );
  const aliceWon = aliceResult?.status === "reserved";
  const winner = aliceWon ? aliceResult : bobResult;
  const loser = aliceWon ? bobResult : aliceResult;
  const stock = await observer.query("SELECT available FROM inventory WHERE item_id = $1", [itemId]);
  const reservations = await observer.query("SELECT reservation_id, item_id, user_id FROM reservations");
  t.diagnostic(`Observed Alice=${aliceResult?.status}, Bob=${bobResult?.status}, reservations=${reservations.rowCount}, available=${stock.rows[0]?.available}`);
  let score = 0;
  try {
    assert.ok(winner?.status === "reserved");
    assert.deepEqual(loser, { status: "out_of_stock" });
    assert.deepEqual(stock.rows, [{ available: 0 }]);
    assert.deepEqual(reservations.rows, [
      { reservation_id: winner.reservationId, item_id: itemId, user_id: aliceWon ? "user-alice" : "user-bob" },
    ]);
    score = overlap ? 2 : 1;
    assert.ok(overlap, "Expected PostgreSQL to confirm the contested write");
  } finally {
    reportGrade(t, "RES-01", score, {
      overlap, alice: aliceResult?.status, bob: bobResult?.status,
      available: stock.rows[0]?.available, reservations: reservations.rows,
    });
  }
});

test("a failed reservation insert rolls back the stock decrement", async (t) => {
  const attempt = await reserveOne(alice, itemId, "unknown-user").then(
    (result) => ({ status: result.status }),
    (error: unknown) => ({ errorCode: error instanceof Error && "code" in error ? error.code : null }),
  );

  const stock = await observer.query("SELECT available FROM inventory WHERE item_id = $1", [itemId]);
  const reservations = await observer.query("SELECT reservation_id FROM reservations");
  const evidence = { ...attempt, available: stock.rows[0]?.available, reservations: reservations.rowCount };
  let score = 0;
  let retryStatus = "unverified";
  try {
    assert.deepEqual(attempt, { errorCode: "23503" });
    assert.deepEqual(stock.rows, [{ available: 1 }]);
    assert.deepEqual(reservations.rows, []);
    t.diagnostic("PostgreSQL rejected the unknown user. Stock stayed at 1 and no reservation persisted.");
    reportGrade(t, "RES-02", 1, { ...evidence, retry: retryStatus });

    retryStatus = "rejected";
    const retry = await reserveOne(alice, itemId, "user-alice");
    retryStatus = retry.status;
    assert.equal(retryStatus, "reserved");
    score = 2;
  } finally {
    reportGrade(t, "RES-02", score, { ...evidence, retry: retryStatus });
  }
});

test("sessions reject invalid credentials and expired or revoked tokens", async () => {
  assert.equal(await createSession(pool, "alice", "wrong-password"), null);
  assert.equal(await createSession(pool, "unknown", demoPassword), null);
  const session = await createSession(pool, "Alice", demoPassword);
  assert.ok(session);
  assert.deepEqual(await readSession(pool, session.token), staff);
  const stored = await observer.query<{ token_hash: string }>("SELECT token_hash FROM sessions");
  assert.match(stored.rows[0].token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(stored.rows[0].token_hash, session.token);

  await observer.query("UPDATE sessions SET expires_at = now() - interval '1 second'");
  assert.equal(await readSession(pool, session.token), null);
  const current = await createSession(pool, "admin", demoPassword);
  assert.ok(current);
  assert.deepEqual(await readSession(pool, current.token), admin);
  await endSession(pool, current.token);
  assert.equal(await readSession(pool, current.token), null);
});

test("only administrators manage stock or read reports, even when a cached report exists", async () => {
  let cacheReads = 0;
  const cache: ReportCache = {
    async read() {
      cacheReads += 1;
      return { generatedAt: new Date().toISOString(), rows: [] };
    },
    async write() {},
  };
  await assert.rejects(createItem(pool, staff, "toolbox", "Toolbox", 0), /Administrator/);
  await assert.rejects(restockItem(pool, staff, itemId, 1), /Administrator/);
  await assert.rejects(stockReport(pool, staff, cache), /Administrator/);
  assert.equal(cacheReads, 0);

  const items = await listInventory(pool);
  assert.equal(items.find((item) => item.item_id === itemId)?.available, 1);
  assert.equal(items.some((item) => item.item_id === "toolbox"), false);
});

test("inventory rejects duplicates, invalid quantities and restocks above the limit", async () => {
  assert.equal(await createItem(pool, admin, "toolbox", "Toolbox", 2), "created");
  assert.equal(await createItem(pool, admin, "toolbox", "Duplicate", 100), "duplicate");
  assert.equal(await createItem(pool, admin, "bad-id!", "Invalid item", 0), "invalid");
  assert.equal(await restockItem(pool, admin, "toolbox", -1), "invalid");
  assert.equal(await restockItem(pool, admin, "toolbox", 1_000_000), "restock_failed");
  assert.equal(await restockItem(pool, admin, "toolbox", 3), "restocked");
  assert.deepEqual((await listInventory(pool)).find((item) => item.item_id === "toolbox"), {
    item_id: "toolbox", name: "Toolbox", available: 5,
  });
});

test("reservation history belongs to the authenticated actor", async () => {
  const result = await reserveFor(pool, staff, itemId);
  assert.ok(result.status === "reserved");
  assert.deepEqual((await listReservations(pool, staff)).map((row) => row.reservation_id), [result.reservationId]);
  assert.deepEqual(await listReservations(pool, otherStaff), []);
});

test("reports reuse a cached snapshot and fall back to PostgreSQL on a cache outage", async () => {
  let saved: Report | null = null;
  const cache: ReportCache = {
    async read() { return saved; },
    async write(report) { saved = report; },
  };
  const outage: ReportCache = {
    async read() { throw new Error("Redis unavailable"); },
    async write() { throw new Error("Redis unavailable"); },
  };
  const report = await stockReport(pool, admin, cache);
  assert.equal(report.source, "database");
  assert.equal((await reserveFor(pool, staff, itemId)).status, "reserved");
  assert.deepEqual(await stockReport(pool, admin, cache), { ...report, source: "redis" });

  const fresh = await stockReport(pool, admin, outage);
  assert.equal(fresh.source, "database");
  assert.deepEqual(fresh.rows.find((row) => row.item_id === itemId), {
    item_id: itemId, name: "Field Kit", available: 0, reserved: 1,
  });
});
