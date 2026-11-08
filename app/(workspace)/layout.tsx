import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "../actions.ts";
import { signedIn } from "../session.ts";

export default async function Workspace({ children }: { children: ReactNode }) {
  const actor = await signedIn();
  const link = "rounded-lg px-3 py-2 text-sm text-emerald-50 hover:bg-white/15";
  return (
    <div className="mx-auto grid min-h-screen max-w-7xl md:grid-cols-[15rem_1fr]">
      <aside className="flex flex-col gap-5 bg-pine p-5 text-white md:min-h-screen md:p-6">
        <Link href="/" className="text-xl font-bold tracking-tight">Fieldstock</Link>
        <nav aria-label="Storeroom" className="flex flex-wrap gap-1 md:flex-col">
          <Link href="/" className={link}>Inventory</Link>
          <Link href="/reservations" className={link}>My reservations</Link>
          {actor.role === "admin" && <>
            <Link href="/manage" className={link}>Manage stock</Link>
            <Link href="/reports" className={link}>Stock report</Link>
          </>}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-white/20 pt-4 md:mt-auto md:block">
          <div>
            <p className="text-sm font-semibold">{actor.display_name}</p>
            <p className="text-xs text-emerald-100">{actor.role === "admin" ? "Administrator" : "Staff"}</p>
          </div>
          <form action={logout} className="md:mt-3">
            <button className="rounded-lg border border-white/30 px-3 py-1.5 text-sm hover:bg-white/15">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
