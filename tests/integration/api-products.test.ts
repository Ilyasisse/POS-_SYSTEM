import assert from "node:assert/strict";
import { after, test } from "node:test";
import { client, db, json, product, unique } from "../workflow/fixtures";

after(() => db.$disconnect());

test("catalog feeds enforce availability and keep active empty categories for staff", async () => {
  const [visible, paused, restored, archived, empty] = await Promise.all([
    product(),
    product(),
    product(),
    product(),
    db.category.create({ data: { name: unique("Empty category") } }),
  ]);
  await db.product.update({
    where: { id: paused.id },
    data: { availableForSale: false, availabilityRestoresAt: new Date(Date.now() + 3_600_000) },
  });
  await db.product.update({
    where: { id: restored.id },
    data: { availableForSale: false, availabilityRestoresAt: new Date(Date.now() - 3_600_000) },
  });
  await db.product.update({ where: { id: archived.id }, data: { isActive: false } });
  const api = await client();
  for (const endpoint of ["/api/GET/Product", "/api/GET/Product/all"]) {
    const rows = await json<Array<{ id: string }>>(await api(endpoint));
    const ids = rows.map(({ id }) => id);
    assert.ok(ids.includes(visible.id) && ids.includes(restored.id));
    assert.ok(!ids.includes(paused.id) && !ids.includes(archived.id));
  }
  const categories = await json<Array<{ id: string }>>(await api("/api/GET/Category"));
  assert.ok(categories.some(({ id }) => id === empty.id));
  const menu = await api("/menu");
  assert.equal(menu.status, 200);
  const html = await menu.text();
  assert.ok(html.includes(visible.name));
  assert.ok(!html.includes(empty.name) && !html.includes(paused.name));
});
