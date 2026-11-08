import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Pool } from "pg";

export type Actor = { user_id: string; display_name: string; role: "staff" | "admin" };
type Credential = { user_id: string; password_hash: string };
const deriveKey = promisify(scrypt);
const dummyHash = `${"0".repeat(32)}:${"0".repeat(128)}`;
const sessionLengthMs = 8 * 60 * 60 * 1_000;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Pool, username: string, password: string) {
  const login = username.trim().toLowerCase();
  if (!/^[a-z0-9]{1,40}$/.test(login) || password.length < 1 || password.length > 128) return null;

  const { rows: [user] } = await db.query<Credential>(
    "SELECT user_id, password_hash FROM users WHERE username = $1",
    [login],
  );
  const [salt, hash] = (user?.password_hash ?? dummyHash).split(":");
  const expected = Buffer.from(hash, "hex");
  const key = await deriveKey(password, salt, 64) as Buffer;
  if (expected.length !== key.length || !timingSafeEqual(expected, key) || !user) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLengthMs);
  await db.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    tokenHash(token), user.user_id, expiresAt,
  ]);
  return { token, expiresAt };
}

export async function readSession(db: Pool, token?: string): Promise<Actor | null> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { rows: [actor] } = await db.query<Actor>(
    `SELECT u.user_id, u.display_name, u.role
     FROM sessions s JOIN users u USING (user_id)
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash(token)],
  );
  return actor ?? null;
}

export async function endSession(db: Pool, token?: string) {
  if (token) await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
}

export function requireAdmin(actor: Actor) {
  if (actor.role !== "admin") throw new Error("Administrator permission required.");
}
