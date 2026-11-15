import { expect, afterAll, test } from "@jest/globals";

import { client, db, json, product, unique } from "../workflow/fixtures";

afterAll(() => db.$disconnect());

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
    expect(ids.includes(visible.id) && ids.includes(restored.id)).toBeTruthy();
    expect(!ids.includes(paused.id) && !ids.includes(archived.id)).toBeTruthy();
  }
  const categories = await json<Array<{ id: string }>>(await api("/api/GET/Category"));
  expect(categories.some(({ id }) => id === empty.id)).toBeTruthy();
  const menu = await api("/menu");
  expect(menu.status).toBe(200);
  const html = await menu.text();
  expect(html.includes(visible.name)).toBeTruthy();
  expect(!html.includes(empty.name) && !html.includes(paused.name)).toBeTruthy();
});
