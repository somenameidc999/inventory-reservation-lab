import type { ReactNode } from "react";

export function PageHeading({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <header className="mb-7">
      <p className="eyebrow">{label}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{children}</p>
    </header>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p role="status" className="mb-5 rounded-xl border border-teal-200 bg-mint p-3 text-sm text-pine">{children}</p>;
}

export function DateStamp({ date }: { date: Date | string }) {
  const value = typeof date === "string" ? new Date(date) : date;
  const label = new Intl.DateTimeFormat("en", {
    dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
  }).format(value);
  return <time dateTime={value.toISOString()}>{label} UTC</time>;
}
