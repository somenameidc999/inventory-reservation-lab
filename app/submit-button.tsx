"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className="button" disabled={pending || disabled}>{pending ? "Working…" : label}</button>;
}
