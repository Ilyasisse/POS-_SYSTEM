import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("scheduler lease supplies its cafeteria without a session default", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "SchedulerLease" (
      "key" TEXT PRIMARY KEY,
      "cafeteriaId" TEXT NOT NULL DEFAULT current_setting('app.cafeteria_id', true),
      "ownerToken" TEXT NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP NOT NULL,
      "updatedAt" TIMESTAMP NOT NULL
    )`);
    // Exercise the actual parameterized INSERT, including its conflict handling.
    const source = readFileSync("src/lib/supplier-orders/scheduler-execution.ts", "utf8");
    const template = source.match(/Prisma\.sql`([\s\S]*?)`/)[1];
    const acquire = async (cafeteriaId, ownerToken) => {
      const values = { key: `${cafeteriaId}:supplier-order-scheduler`, cafeteriaId, ownerToken, leaseDurationSeconds: 180 };
      const params = [];
      const sql = template.replace(/\$\{(\w+)\}/g, (_, name) => {
        assert.ok(Object.hasOwn(values, name));
        params.push(values[name]);
        return `$${params.length}`;
      });
      return (await db.query(sql, params)).rows;
    };
    assert.equal((await acquire("cafe-a", "first"))[0].ownerToken, "first");
    assert.deepEqual(await acquire("cafe-a", "overlap"), []);
    assert.equal((await acquire("cafe-b", "independent"))[0].ownerToken, "independent");
    assert.deepEqual((await db.query('SELECT "cafeteriaId" FROM "SchedulerLease" ORDER BY "cafeteriaId"')).rows,
      [{ cafeteriaId: "cafe-a" }, { cafeteriaId: "cafe-b" }]);
    await db.exec(`UPDATE "SchedulerLease" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second'`);
    assert.equal((await acquire("cafe-a", "reclaimed"))[0].ownerToken, "reclaimed");
  } finally {
    await db.close();
  }
});
