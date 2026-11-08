import { database } from "../../src/db.ts";
import { listInventory } from "../../src/inventory.ts";
import { reserve } from "../actions.ts";
import { signedIn } from "../session.ts";
import { SubmitButton } from "../submit-button.tsx";
import { Notice, PageHeading } from "./ui.tsx";

const notices = new Map([
  ["reserved", "Reservation confirmed."],
  ["out_of_stock", "That item is out of stock."],
  ["invalid", "The item identifier is invalid."],
  ["forbidden", "Administrator permission required."],
]);

export default async function Inventory({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await signedIn();
  const items = await listInventory(database());
  const { notice } = await searchParams;
  const message = notice && notices.get(notice);
  return (
    <>
      <PageHeading label="Storeroom" title="Inventory">Browse equipment and reserve one unit at a time.</PageHeading>
      {message && <Notice>{message}</Notice>}
      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Items tracked", items.length],
          ["Units available", items.reduce((sum, item) => sum + item.available, 0)],
          ["Items out of stock", items.filter((item) => item.available === 0).length],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="w-full min-w-96">
          <thead><tr><th>Equipment</th><th>Available</th><th className="text-right">Reserve</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.item_id}>
                <td><span className="font-semibold">{item.name}</span><code className="mt-1 block text-xs text-muted">{item.item_id}</code></td>
                <td><span className={item.available > 0 ? "rounded-full bg-mint px-2.5 py-1 font-semibold text-pine" : "rounded-full bg-slate-100 px-2.5 py-1 text-muted"}>{item.available}</span></td>
                <td className="text-right">
                  {item.available > 0
                    ? <form action={reserve}><input type="hidden" name="itemId" value={item.item_id} /><SubmitButton label="Reserve one" /></form>
                    : <span className="text-muted">Out of stock</span>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3}>No equipment has been added yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
