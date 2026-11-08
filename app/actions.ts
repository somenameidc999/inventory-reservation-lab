"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSession, endSession } from "../src/auth.ts";
import { database } from "../src/db.ts";
import { createItem, reserveFor, restockItem } from "../src/inventory.ts";
import { administrator, sessionCookie, signedIn } from "./session.ts";

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function quantity(form: FormData): number {
  const value = field(form, "quantity");
  return /^\d{1,7}$/.test(value) ? Number(value) : NaN;
}

export async function login(form: FormData) {
  const db = database();
  const session = await createSession(db, field(form, "username"), field(form, "password"));
  if (!session) redirect("/login?error=invalid");
  const jar = await cookies();
  await endSession(db, jar.get(sessionCookie)?.value);
  jar.set(sessionCookie, session.token, {
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  await endSession(database(), jar.get(sessionCookie)?.value);
  jar.delete(sessionCookie);
  redirect("/login");
}

export async function reserve(form: FormData) {
  const actor = await signedIn();
  const result = await reserveFor(database(), actor, field(form, "itemId"));
  revalidatePath("/");
  revalidatePath("/reservations");
  redirect(`/?notice=${result.status}`);
}

export async function addInventory(form: FormData) {
  const actor = await administrator();
  const result = await createItem(database(), actor, field(form, "itemId"), field(form, "name"), quantity(form));
  revalidatePath("/");
  revalidatePath("/manage");
  redirect(`/manage?notice=${result}`);
}

export async function restock(form: FormData) {
  const actor = await administrator();
  const result = await restockItem(database(), actor, field(form, "itemId"), quantity(form));
  revalidatePath("/");
  revalidatePath("/manage");
  redirect(`/manage?notice=${result}`);
}
