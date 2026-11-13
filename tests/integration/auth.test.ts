import assert from "node:assert/strict";
import { after, test } from "node:test";
import { client, db, json, user } from "../workflow/fixtures";

after(() => db.$disconnect());

test("staff login issues a real session and sign-out clears protected access", async () => {
  const account = await user("CASHIER");
  const api = await client();
  const credentials = { email: account.email, password: account.password };
  const login = await json<{ redirectTo: string }>(
    await api("/api/auth/staff-login", { body: credentials }),
    200,
  );
  assert.equal(login.redirectTo, "/cashier");
  assert.equal((await api("/api/cashier/payment-requests?batchKey=unused")).status, 200);
  await json(await api("/api/auth/signout", { method: "POST" }), 200);
  assert.equal((await api("/api/cashier/payment-requests?batchKey=unused")).status, 401);
});

test("anonymous, inactive, and wrong-role users cannot use protected APIs", async () => {
  const anonymous = await client();
  assert.equal((await anonymous("/api/kitchen/tickets")).status, 401);

  const inactive = await user("CASHIER", { active: false });
  const attempt = await anonymous("/api/auth/staff-login", {
    body: { email: inactive.email, password: inactive.password },
  });
  assert.equal(attempt.status, 403);

  const kitchen = await client(await user("BARISTA", { station: "BARISTA" }));
  const denied = await kitchen("/api/admin/reports/export?report=sales&format=csv", {
    method: "POST",
  });
  assert.equal(denied.status, 403);
  assert.equal(await db.reportExportAudit.count(), 0);
});
