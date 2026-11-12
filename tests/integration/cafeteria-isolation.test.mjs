import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeHostname } from "../../src/lib/cafeteria/hostname.ts";
import { createScopedClient } from "../../src/lib/cafeteria/scoped-client.ts";

test("hostnames are normalized and untrusted host formats rejected", () => {
  assert.equal(normalizeHostname("CAFE.Example.COM.:443"), "cafe.example.com");
  for (const host of ["https://cafe.com", "a.com,b.com", "a.com/path", "*.example.com", "", "a b.com", "-bad.com"]) {
    assert.throws(() => normalizeHostname(host));
  }
});

function fixture() {
  const calls = [];
  const base = { product: {}, cafeSetting: {}, async $transaction(work) {
    const tx = {
      async $executeRaw(strings, ...values) { calls.push(["context", ...values]); },
      async $executeRawUnsafe(sql) { calls.push(["role", sql]); },
      product: {
        async findMany(args) { calls.push(["products", args]); return [{ id: "p" }]; },
        async findUnique(args) { calls.push(["find", args]); return null; },
        async create(args) { calls.push(["create", args]); return args.data; },
      },
      cafeSetting: {
        async create(args) { calls.push(["settings", args]); return args.data; },
      },
    };
    return work(tx);
  } };
  return { calls, base };
}

test("every standalone operation enters a tenant transaction and restricted role", async () => {
  const { base, calls } = fixture();
  const client = createScopedClient(base, async () => "cafe-a");
  assert.deepEqual(await client.product.findMany({}), [{ id: "p" }]);
  assert.deepEqual(calls.slice(0, 2), [
    ["context", "cafe-a"], ["role", "SET LOCAL ROLE pos_cafeteria_runtime"],
  ]);
  assert.equal(calls[2][0], "products");
});

test("batch and interactive transactions reuse one scoped transaction", async () => {
  for (const interactive of [false, true]) {
    const { base, calls } = fixture();
    const client = createScopedClient(base, async () => "cafe-b");
    if (interactive) await client.$transaction(async (tx) => {
      await tx.product.findMany({}); await tx.product.findMany({});
    });
    else await client.$transaction([client.product.findMany({}), client.product.findMany({})]);
    assert.equal(calls.filter((c) => c[0] === "role").length, 1);
    assert.equal(calls.filter((c) => c[0] === "products").length, 2);
  }
});

test("upsert avoids native global conflict targets and singleton defaults are scoped", async () => {
  const { base, calls } = fixture();
  const client = createScopedClient(base, async () => "cafe-b");
  await client.product.upsert({ where: { id: "p" }, create: { id: "p" }, update: {} });
  assert.deepEqual(calls.map((c) => c[0]), ["context", "role", "context", "find", "create"]);
  await client.cafeSetting.create({ data: { businessName: "Other Cafe" } });
  assert.equal(calls.at(-1)[1].data.id, "cafe-b:default");
});

test("unresolved cafeterias fail before any database operation", async () => {
  const { base, calls } = fixture();
  const client = createScopedClient(base, async () => { throw new Error("Unknown domain"); });
  await assert.rejects(Promise.resolve(client.product.findMany({})), /Unknown domain/);
  assert.equal(calls.length, 0);
  assert.throws(() => client.cafeteria, /platform management/);
});

test("migration covers every operational Prisma model", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../prisma/migrations/20261012080000_cafeteria_domains/migration.sql", import.meta.url), "utf8");
  const models = [...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]).filter((m) => !["Cafeteria", "CafeteriaDomain"].includes(m));
  for (const model of models) assert.ok(migration.includes("'" + model + "'"), model);
  assert.match(migration, /WITH CHECK/);
  assert.match(migration, /NOBYPASSRLS/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
});
