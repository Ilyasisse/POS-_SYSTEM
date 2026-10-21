import assert from "node:assert/strict";
import test from "node:test";
import {
  availabilitySchema,
  catalogFormValues,
  catalogSchemas,
  fieldErrors,
  orderingMatches,
  priceLabel,
  reorderIds,
  saleAvailable,
  selectionRule,
  type CatalogRecord,
  type CategoryVersion,
} from "../../src/lib/catalog/catalog";

const product = {
  name: "Coffee",
  price: "2.50",
  categoryId: "drinks",
  isActive: "on",
  trackStock: "off",
  isPopular: "off",
  imageUrl: "",
  description: "",
  pronunciationAudioUrl: "",
  availableForSale: "on",
  availabilityReason: "",
  durationMinutes: "",
};
const modifier = {
  name: "Extra milk",
  price: "0",
  isActive: "on",
  productIds: ["coffee"],
  modifierGroupId: "milk",
  pronunciationAudioUrl: "",
};

test("product and modifier prices reject missing, negative, nonfinite and overprecise inputs", () => {
  for (const price of [
    "",
    " ",
    "-0.01",
    "NaN",
    "Infinity",
    "1e2",
    "2.555",
    "1000001",
  ]) {
    for (const [schema, input] of [
      [catalogSchemas.products, product],
      [catalogSchemas.modifiers, modifier],
    ] as const) {
      const result = schema.safeParse({ ...input, price });
      assert.equal(result.success, false, `Rejected ${JSON.stringify(price)}`);
      if (!result.success) assert.ok(fieldErrors(result.error).price);
    }
  }
  assert.equal(catalogSchemas.modifiers.parse(modifier).price, 0);
  assert.equal(catalogSchemas.products.parse(product).price, 2.5);
});

test("form values default unchecked flags and preserve multiple distinct product selections", () => {
  const form = new FormData();
  form.set("name", "Extra milk");
  form.append("productIds", "coffee");
  form.append("productIds", " coffee ");
  form.append("productIds", " ");
  form.append("productIds", "tea");
  form.append("productIds", "coffee");
  const values = catalogFormValues(form);
  assert.deepEqual(values.productIds, ["coffee", "tea"]);
  for (const key of [
    "isActive",
    "isRequired",
    "trackStock",
    "isPopular",
    "availableForSale",
  ])
    assert.equal(values[key], "off");
});

test("modifier creation requires real product and group selections", () => {
  for (const input of [
    { productIds: [] },
    { productIds: [""] },
    { modifierGroupId: "" },
  ]) {
    assert.equal(
      catalogSchemas.modifiers.safeParse({ ...modifier, ...input }).success,
      false,
    );
  }
  assert.equal(
    catalogSchemas.modifiers.safeParse({
      ...modifier,
      productIds: ["coffee", "tea"],
    }).success,
    true,
  );
});

test("asset fields keep local and HTTPS pronunciation paths and reject executable URLs", () => {
  for (const pronunciationAudioUrl of [
    "/uploads/coffee.webm",
    "https://storage.example.com/coffee.webm",
    "",
  ]) {
    assert.equal(
      catalogSchemas.products.safeParse({ ...product, pronunciationAudioUrl })
        .success,
      true,
    );
    assert.equal(
      catalogSchemas.modifiers.safeParse({ ...modifier, pronunciationAudioUrl })
        .success,
      true,
    );
  }
  for (const pronunciationAudioUrl of [
    "javascript:alert(1)",
    "data:audio/webm;base64,AAAA",
    "//example.com/coffee.webm",
    "https://",
    "/\\example.com/coffee.webm",
    "https://example.com/\tcoffee.webm",
  ]) {
    const result = catalogSchemas.products.safeParse({
      ...product,
      pronunciationAudioUrl,
    });
    assert.equal(result.success, false);
    if (!result.success)
      assert.ok(fieldErrors(result.error).pronunciationAudioUrl);
  }
});

test("category positions and kitchen stations reject invalid server inputs", () => {
  const category = {
    name: "Drinks",
    isActive: "on",
    station: "BARISTA",
    sortOrder: "0",
  };
  assert.equal(catalogSchemas.categories.safeParse(category).success, true);
  for (const input of [
    { station: "UNKNOWN" },
    { sortOrder: "-1" },
    { sortOrder: "0.5" },
    { sortOrder: "Infinity" },
    { name: " " },
  ]) {
    assert.equal(
      catalogSchemas.categories.safeParse({ ...category, ...input }).success,
      false,
    );
  }
});

test("selection rules reject contradictory required, minimum and maximum combinations", () => {
  const base = {
    name: "Milk",
    isActive: "on",
    isRequired: "off",
    minSelect: "0",
    maxSelect: "1",
  };
  assert.equal(catalogSchemas["modifier-groups"].safeParse(base).success, true);
  assert.equal(
    catalogSchemas["modifier-groups"].safeParse({
      ...base,
      isRequired: "on",
      minSelect: "1",
    }).success,
    true,
  );
  for (const input of [
    { maxSelect: "0" },
    { minSelect: "2", maxSelect: "1" },
    { isRequired: "on", minSelect: "0" },
    { isRequired: "off", minSelect: "1" },
    { minSelect: "-1" },
    { maxSelect: "1.5" },
  ])
    assert.equal(
      catalogSchemas["modifier-groups"].safeParse({ ...base, ...input })
        .success,
      false,
    );
});

test("sale pauses require bounded reasons and supported timed or manual durations", () => {
  const pause = {
    id: "coffee",
    availableForSale: "off",
    availabilityReason: "Delivery delayed",
    durationMinutes: "60",
  };
  for (const durationMinutes of ["", "60", "180", "720", "1440", "keep"]) {
    assert.equal(
      availabilitySchema.safeParse({ ...pause, durationMinutes }).success,
      true,
    );
  }
  for (const input of [
    { durationMinutes: "30" },
    { durationMinutes: "-60" },
    { availabilityReason: " " },
    { availabilityReason: "x".repeat(201) },
  ]) {
    assert.equal(
      availabilitySchema.safeParse({ ...pause, ...input }).success,
      false,
    );
  }
});

test("timed pauses resume exactly at their deadline while indefinite pauses remain sold out", () => {
  const row: CatalogRecord = {
    id: "coffee",
    name: "Coffee",
    isActive: true,
    updatedAt: "2026-10-21T08:00:00.000Z",
    availableForSale: false,
    availabilityRestoresAt: "2026-10-21T09:00:00.000Z",
  };
  assert.equal(
    saleAvailable(row, Date.parse("2026-10-21T08:59:59.999Z")),
    false,
  );
  assert.equal(
    saleAvailable(row, Date.parse("2026-10-21T09:00:00.000Z")),
    true,
  );
  assert.equal(saleAvailable({ ...row, availabilityRestoresAt: null }), false);
  assert.equal(
    saleAvailable({
      ...row,
      availableForSale: true,
      availabilityRestoresAt: null,
    }),
    true,
  );
});

test("category order snapshots detect edits, insertions, deletions and reordered ties", () => {
  const order: CategoryVersion[] = [
    { id: "coffee", sortOrder: 0, updatedAt: "2026-10-21T08:00:00.000Z" },
    { id: "tea", sortOrder: 0, updatedAt: "2026-10-21T08:00:00.000Z" },
  ];
  assert.equal(orderingMatches(order, structuredClone(order)), true);
  assert.equal(orderingMatches(order, order.toReversed()), false);
  assert.equal(orderingMatches(order, order.slice(1)), false);
  assert.equal(
    orderingMatches(order, [...order, { ...order[0], id: "food" }]),
    false,
  );
  assert.equal(
    orderingMatches(order, [{ ...order[0], sortOrder: 1 }, order[1]]),
    false,
  );
  assert.equal(
    orderingMatches(order, [
      { ...order[0], updatedAt: "2026-10-21T09:00:00.000Z" },
      order[1],
    ]),
    false,
  );
});

test("moving a category preserves the complete order and leaves the input untouched", () => {
  const ids = ["coffee", "tea", "food"];
  assert.deepEqual(reorderIds(ids, "food", "coffee"), [
    "food",
    "coffee",
    "tea",
  ]);
  assert.deepEqual(reorderIds(ids, "coffee", "food"), [
    "tea",
    "food",
    "coffee",
  ]);
  assert.deepEqual(reorderIds(ids, "missing", "coffee"), ids);
  assert.deepEqual(ids, ["coffee", "tea", "food"]);
});

test("catalog labels describe free choices and selection requirements in plain language", () => {
  assert.equal(priceLabel(0), "Included");
  assert.equal(priceLabel(1.5), "+$1.50");
  assert.equal(selectionRule(1, 1), "Choose exactly 1");
  assert.equal(selectionRule(0, 3), "Choose up to 3 (optional)");
  assert.equal(selectionRule(1, 3), "Choose 1–3");
});
