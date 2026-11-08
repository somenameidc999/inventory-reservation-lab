import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill("demo-storeroom-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
}

test("staff reserve stock, see only their reservations, and cannot use admin actions", async ({ browser, page, baseURL }) => {
  const bob = await browser.newPage({ baseURL });
  const admin = await browser.newPage({ baseURL });
  try {
    await page.goto("/reservations");
    await expect(page).toHaveURL(/\/login$/);
    await signIn(page, "alice");
    await signIn(bob, "bob");
    const fieldKit = (tab: Page) => tab.getByRole("row", { name: /Field Kit/ });
    await expect(fieldKit(bob).getByRole("button", { name: "Reserve one" })).toBeVisible();
    await fieldKit(page).getByRole("button", { name: "Reserve one" }).click();
    await expect(page.getByRole("status")).toHaveText("Reservation confirmed.");
    await fieldKit(bob).getByRole("button", { name: "Reserve one" }).click();
    await expect(bob.getByRole("status")).toHaveText("That item is out of stock.");

    await page.getByRole("link", { name: "My reservations" }).click();
    await expect(fieldKit(page)).toBeVisible();
    await bob.goto("/reservations");
    await expect(bob.getByText("You have no reservations yet.")).toBeVisible();
    await bob.goto("/reports");
    await expect(bob.getByRole("status")).toHaveText("Administrator permission required.");

    await signIn(admin, "admin");
    await admin.getByRole("link", { name: "Manage stock" }).click();
    await admin.getByLabel("Item ID").fill("measuring-tape");
    await admin.getByLabel("Name", { exact: true }).fill("Measuring Tape");
    await admin.getByLabel("Starting stock").fill("2");
    const submitted = admin.waitForRequest((request) => request.method() === "POST" && !!request.headers()["next-action"]);
    await admin.getByRole("button", { name: "Add item" }).click();
    const request = await submitted;
    await expect(admin.getByRole("status")).toHaveText("Equipment added.");

    const body = request.postData();
    expect(body).toContain("measuring-tape");
    const denied = await bob.request.post("/manage", {
      data: body!.replace("measuring-tape", "forged-item").replace("Measuring Tape", "Forged Item"),
      headers: {
        Origin: new URL(admin.url()).origin,
        "next-action": request.headers()["next-action"],
        "content-type": request.headers()["content-type"],
      },
      maxRedirects: 0,
    });
    expect(denied.headers()["x-action-redirect"]).toMatch(/^\/\?notice=forbidden(?:;|$)/);

    const tape = admin.getByRole("row", { name: /Measuring Tape/ });
    await tape.getByRole("spinbutton").fill("3");
    await tape.getByRole("button", { name: "Restock" }).click();
    await expect(admin.getByRole("status")).toHaveText("Stock updated.");
    await expect(tape.getByRole("cell", { name: "5", exact: true })).toBeVisible();
    await expect(admin.getByText("Forged Item")).toHaveCount(0);

    await admin.goto("/reports");
    await expect(admin.getByRole("heading", { name: "Stock report" })).toBeVisible();
    await expect(admin.getByText("PostgreSQL", { exact: true })).toBeVisible();
    await expect(fieldKit(admin).getByRole("cell")).toHaveText(["Field Kit", "0", "1"]);
    await expect(admin.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
    await admin.reload();
    const cacheExpected = process.env.REDIS_URL && process.env.EXPECT_REDIS !== "false";
    await expect(admin.getByText(cacheExpected ? "Redis cache" : "PostgreSQL", { exact: true })).toBeVisible();
  } finally {
    await Promise.all([bob.close(), admin.close()]);
  }
});

test("login rejects the wrong password and logout revokes the session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username").fill("alice");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Username or password is incorrect." })).toBeVisible();

  await signIn(page, "alice");
  const session = (await page.context().cookies()).find((cookie) => cookie.name === "inventory_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(session).toBeDefined();
  await page.context().addCookies([session!]);
  await page.goto("/reservations");
  await expect(page).toHaveURL(/\/login$/);
});
