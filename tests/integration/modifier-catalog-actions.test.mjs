import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";
import "tsx";

const state = { writes: [], invalidated: [], allowed: true, productCount: 2, usageCount: 0 };
globalThis.__modifierCatalogRegression = state;
const sources = {
  "mock:modifier-permission": `exports.requirePermission = async () => { if (!globalThis.__modifierCatalogRegression.allowed) throw new Error("Forbidden"); };`,
  "mock:modifier-cache": `exports.revalidatePath = (path) => globalThis.__modifierCatalogRegression.invalidated.push(path);`,
  "mock:modifier-navigation": `exports.redirect = (path) => { throw new Error("redirect:" + path); };`,
  "mock:modifier-prisma": `const state = globalThis.__modifierCatalogRegression;
const modifier = Object.fromEntries(["create", "update", "delete"].map(method => [method, async args => { state.writes.push({method, ...args}); return {id:"milk"}; }]));
exports.prisma = {
 modifier,
 orderItemModifier: {count: async () => state.usageCount},
 $transaction: async callback => callback({modifier, product: {count: async () => state.productCount}}),
};`,
};
const aliases = {
  "@/lib/auth/require-permission": "mock:modifier-permission",
  "@/lib/prisma": "mock:modifier-prisma",
  "next/cache": "mock:modifier-cache",
  "next/navigation": "mock:modifier-navigation",
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return aliases[specifier]
      ? { url: aliases[specifier], shortCircuit: true }
      : nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    return Object.hasOwn(sources, url)
      ? { format: "commonjs", source: sources[url], shortCircuit: true }
      : nextLoad(url, context);
  },
});
after(() => {
  hooks.deregister();
  delete globalThis.__modifierCatalogRegression;
});
beforeEach(() => {
  state.writes.length = 0;
  state.invalidated.length = 0;
  state.allowed = true;
  state.productCount = 2;
  state.usageCount = 0;
});
const actionModule = await import(
  new URL("../../src/app/admin/(catalog)/modifiers/actions.ts", import.meta.url).href
);
const actions = actionModule.createModifier ? actionModule : actionModule.default;
function form(products = ["tea", "coffee"], price = "1") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    id: "milk",
    name: "Milk",
    modifierGroupId: "extras",
    price,
    isActive: "on",
  }))
    data.set(key, value);
  for (const product of products) data.append("productIds", product);
  return data;
}

test("creating for multiple products saves one shared modifier and unique links", async () => {
  await assert.rejects(
    actions.createModifier(form(["tea", "coffee", "tea"])),
    /redirect:\/admin\/modifiers$/,
  );
  assert.equal(state.writes.length, 1);
  assert.equal(state.writes[0].method, "create");
  assert.equal(state.writes[0].data.price, 1);
  assert.deepEqual(state.writes[0].data.products.connect, [{ id: "tea" }, { id: "coffee" }]);
  assert.ok(state.invalidated.includes("/api/GET/Product/all"));
});

test("editing replaces product selections atomically while updating one shared price", async () => {
  state.productCount = 1;
  await assert.rejects(actions.updateModifier(form(["coffee"], "2")), /redirect:/);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0].where, { id: "milk" });
  assert.equal(state.writes[0].data.price, 2);
  assert.deepEqual(state.writes[0].data.products.set, [{ id: "coffee" }]);
});

test("create and edit reject missing products and invalid prices before writing", async () => {
  for (const action of [actions.createModifier, actions.updateModifier]) {
    await assert.rejects(action(form([])), /At least one product/);
    for (const price of ["-1", "NaN", "Infinity"])
      await assert.rejects(action(form(undefined, price)), /Price must/);
  }
  assert.equal(state.writes.length, 0);
});

test("invalid product selections and missing permission create no modifier", async () => {
  state.productCount = 1;
  await assert.rejects(actions.createModifier(form()), /no longer exist/);
  await assert.rejects(actions.updateModifier(form()), /no longer exist/);
  state.allowed = false;
  await assert.rejects(actions.createModifier(form()), /Forbidden/);
  await assert.rejects(actions.updateModifier(form()), /Forbidden/);
  assert.equal(state.writes.length, 0);
});

test("deleting a used shared modifier deactivates it and invalidates the product feed", async () => {
  state.usageCount = 1;
  await assert.rejects(actions.deleteModifier(form()), /redirect:/);
  assert.deepEqual(state.writes, [
    { method: "update", where: { id: "milk" }, data: { isActive: false } },
  ]);
  assert.ok(state.invalidated.includes("/api/GET/Product/all"));
});

test("deleting an unused modifier keeps the existing hard delete behavior", async () => {
  await assert.rejects(actions.deleteModifier(form()), /redirect:/);
  assert.deepEqual(state.writes, [{ method: "delete", where: { id: "milk" } }]);
});
