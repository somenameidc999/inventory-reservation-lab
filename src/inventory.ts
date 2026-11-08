import type { Pool } from "pg";
import { requireAdmin, type Actor } from "./auth.ts";
import { reserveOne } from "./reservations.ts";

export type Item = { item_id: string; name: string; available: number };
export type UserReservation = { reservation_id: number; name: string; created_at: Date };
export const maxStock = 1_000_000;

export function validItemId(id: string) {
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
}

export async function listInventory(db: Pool): Promise<Item[]> {
  const { rows } = await db.query<Item>("SELECT item_id, name, available FROM inventory ORDER BY name, item_id");
  return rows;
}

export async function listReservations(db: Pool, actor: Actor): Promise<UserReservation[]> {
  const { rows } = await db.query<UserReservation>(
    `SELECT reservation_id, name, created_at
     FROM reservations JOIN inventory USING (item_id)
     WHERE user_id = $1
     ORDER BY created_at DESC, reservation_id DESC`,
    [actor.user_id],
  );
  return rows;
}

export async function reserveFor(db: Pool, actor: Actor, id: string) {
  if (!validItemId(id)) return { status: "invalid" } as const;
  const client = await db.connect();
  let discard = false;
  try {
    return await reserveOne(client, id, actor.user_id);
  } catch (error) {
    discard = true;
    throw error;
  } finally {
    client.release(discard);
  }
}

export async function createItem(db: Pool, actor: Actor, id: string, name: string, available: number) {
  requireAdmin(actor);
  if (!validItemId(id) || !name.trim() || name.length > 80 ||
      !Number.isSafeInteger(available) || available < 0 || available > maxStock) return "invalid";
  const { rowCount } = await db.query(
    "INSERT INTO inventory (item_id, name, available) VALUES ($1, $2, $3) ON CONFLICT (item_id) DO NOTHING",
    [id, name.trim(), available],
  );
  return rowCount === 1 ? "created" : "duplicate";
}

export async function restockItem(db: Pool, actor: Actor, id: string, quantity: number) {
  requireAdmin(actor);
  if (!validItemId(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxStock) return "invalid";
  const { rowCount } = await db.query(
    "UPDATE inventory SET available = available + $2 WHERE item_id = $1 AND available <= $3",
    [id, quantity, maxStock - quantity],
  );
  return rowCount === 1 ? "restocked" : "restock_failed";
}
