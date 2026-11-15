import { expect, afterAll, test } from "@jest/globals";

import { client, db, json, user } from "../workflow/fixtures";

afterAll(() => db.$disconnect());

test("staff login issues a real session and sign-out clears protected access", async () => {
  const account = await user("CASHIER");
  const api = await client();
  const credentials = { email: account.email, password: account.password };
  const login = await json<{ redirectTo: string }>(
    await api("/api/auth/staff-login", { body: credentials }),
    200,
  );
  expect(login.redirectTo).toBe("/cashier");
  expect((await api("/api/cashier/payment-requests?batchKey=unused")).status).toBe(200);
  await json(await api("/api/auth/signout", { method: "POST" }), 200);
  expect((await api("/api/cashier/payment-requests?batchKey=unused")).status).toBe(401);
});

test("anonymous, inactive, and wrong-role users cannot use protected APIs", async () => {
  const anonymous = await client();
  expect((await anonymous("/api/kitchen/tickets")).status).toBe(401);

  const inactive = await user("CASHIER", { active: false });
  const attempt = await anonymous("/api/auth/staff-login", {
    body: { email: inactive.email, password: inactive.password },
  });
  expect(attempt.status).toBe(403);

  const kitchen = await client(await user("BARISTA", { station: "BARISTA" }));
  const auditCount = await db.reportExportAudit.count();
  const denied = await kitchen("/api/admin/reports/export?report=sales&format=csv", {
    method: "POST",
  });
  expect(denied.status).toBe(403);
  expect(await db.reportExportAudit.count()).toBe(auditCount);
});
