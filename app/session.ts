import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "../src/auth.ts";
import { database } from "../src/db.ts";

export const sessionCookie = "inventory_session";

export const currentActor = cache(async () => {
  const token = (await cookies()).get(sessionCookie)?.value;
  return token ? readSession(database(), token) : null;
});

export async function signedIn() {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  return actor;
}

export async function administrator() {
  const actor = await signedIn();
  if (actor.role !== "admin") redirect("/?notice=forbidden");
  return actor;
}
