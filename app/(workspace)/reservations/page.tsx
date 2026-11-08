import type { Metadata } from "next";
import { database } from "../../../src/db.ts";
import { listReservations } from "../../../src/inventory.ts";
import { signedIn } from "../../session.ts";
import { DateStamp, PageHeading } from "../ui.tsx";

export const metadata: Metadata = { title: "My reservations" };

export default async function Reservations() {
  const actor = await signedIn();
  const reservations = await listReservations(database(), actor);
  return (
    <>
      <PageHeading label="Your activity" title="My reservations">View the equipment you reserved.</PageHeading>
      <div className="table-wrap">
        <table className="w-full min-w-96">
          <thead><tr><th>Reservation</th><th>Equipment</th><th>Reserved at</th></tr></thead>
          <tbody>
            {reservations.map((row) => <tr key={row.reservation_id}>
              <td className="tabular-nums">#{row.reservation_id}</td>
              <td className="font-semibold">{row.name}</td>
              <td><DateStamp date={row.created_at} /></td>
            </tr>)}
            {reservations.length === 0 && <tr><td colSpan={3}>You have no reservations yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
