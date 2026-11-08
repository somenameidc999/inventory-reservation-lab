import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { login } from "../actions.ts";
import { currentActor } from "../session.ts";
import { SubmitButton } from "../submit-button.tsx";

export const metadata: Metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentActor()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 p-6 md:grid-cols-2 md:p-12">
      <div className="rounded-3xl bg-pine p-8 text-white md:p-12">
        <p className="text-xs font-bold tracking-[0.2em] text-emerald-200 uppercase">Equipment storeroom</p>
        <h1 className="mt-6 text-5xl font-bold tracking-tight">Fieldstock</h1>
        <p className="mt-4 max-w-sm text-lg leading-relaxed text-emerald-50">
          Check what’s on the shelf and reserve equipment for your next job.
        </p>
        <div className="mt-10 rounded-xl border border-emerald-100/25 p-4 text-sm leading-relaxed">
          <p className="font-semibold">Local demo accounts</p>
          <p className="mt-1">Staff: <code>alice</code> or <code>bob</code> · Admin: <code>admin</code></p>
          <p>Password: <code>demo-storeroom-2026</code></p>
        </div>
      </div>
      <div className="panel p-7 md:p-9">
        <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
        <p className="mt-2 text-sm text-muted">Use your storeroom account to continue.</p>
        {error === "invalid" && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-900">Username or password is incorrect.</p>}
        <form action={login} className="mt-6 grid gap-4">
          <label className="field">Username<input name="username" autoComplete="username" maxLength={40} required /></label>
          <label className="field">Password<input type="password" name="password" autoComplete="current-password" maxLength={128} required /></label>
          <SubmitButton label="Sign in" />
        </form>
      </div>
    </main>
  );
}
