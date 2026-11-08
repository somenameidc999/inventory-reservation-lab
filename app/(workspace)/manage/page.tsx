import type { Metadata } from "next";
import { database } from "../../../src/db.ts";
import { listInventory, maxStock } from "../../../src/inventory.ts";
import { addInventory, restock } from "../../actions.ts";
import { administrator } from "../../session.ts";
import { SubmitButton } from "../../submit-button.tsx";
import { Notice, PageHeading } from "../ui.tsx";

export const metadata: Metadata = { title: "Manage stock" };

const notices = new Map([
  ["created", "Equipment added."],
  ["restocked", "Stock updated."],
  ["invalid", "Check the item identifier, name, and quantity."],
  ["duplicate", "That item identifier is already in use."],
  ["restock_failed", "The item is missing or the new quantity would exceed the stock limit."],
]);

export default async function Manage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await administrator();
  const items = await listInventory(database());
  const { notice } = await searchParams;
  const message = notice && notices.get(notice);
  return (
    <>
      <PageHeading label="Administration" title="Manage stock">Add equipment or increase available stock.</PageHeading>
      {message && <Notice>{message}</Notice>}
      <section className="panel mb-7 p-5" aria-labelledby="add-item">
        <h2 id="add-item" className="mb-4 text-lg font-bold">Add equipment</h2>
        <form action={addInventory} className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_8rem_auto]">
          <label className="field">Item ID<input name="itemId" pattern="[a-z0-9][a-z0-9\-]{0,39}" placeholder="first-aid-kit" required /></label>
          <label className="field">Name<input name="name" maxLength={80} required /></label>
          <label className="field">Starting stock<input name="quantity" type="number" min={0} max={maxStock} required /></label>
          <SubmitButton label="Add item" />
        </form>
      </section>
      <div className="table-wrap">
        <table className="w-full min-w-96">
          <thead><tr><th>Equipment</th><th>Available</th><th>Add units</th></tr></thead>
          <tbody>
            {items.map((item) => <tr key={item.item_id}>
              <td className="font-semibold">{item.name}</td><td>{item.available}</td>
              <td><form action={restock} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="itemId" value={item.item_id} />
                <input aria-label={`Units to add to ${item.name}`} className="w-24" name="quantity" type="number" min={1} max={maxStock} required />
                <SubmitButton label="Restock" />
              </form></td>
            </tr>)}
            {items.length === 0 && <tr><td colSpan={3}>Add an item before restocking.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
