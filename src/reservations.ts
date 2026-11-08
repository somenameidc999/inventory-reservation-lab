import type { Client } from "pg";

export type ReservationResult =
  | { status: "reserved"; reservationId: number }
  | { status: "out_of_stock" };

// The caller supplies an idle connection for exclusive use until the call returns.
export async function reserveOne(
  client: Client,
  itemId: string,
  userId: string,
): Promise<ReservationResult> {
  await client.query("BEGIN ISOLATION LEVEL READ COMMITTED");
  try {
    const stock = await client.query(
      `UPDATE inventory
       SET available = available - 1
       WHERE item_id = $1 AND available > 0`,
      [itemId],
    );

    let result: ReservationResult = { status: "out_of_stock" };
    if (stock.rowCount === 1) {
      const reservation = await client.query<{ reservation_id: number }>(
        `INSERT INTO reservations (item_id, user_id)
         VALUES ($1, $2)
         RETURNING reservation_id`,
        [itemId, userId],
      );
      result = {
        status: "reserved",
        reservationId: reservation.rows[0].reservation_id,
      };
    }

    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}
