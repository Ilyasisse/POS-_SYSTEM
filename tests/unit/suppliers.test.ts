import { expect, test } from "@jest/globals";

import { isValidSupplierSlug, normalizeSupplierSlug } from "../../src/lib/suppliers/validation";

test("normalizes supplier identity fields", () => {
  expect(normalizeSupplierSlug(" Fresh Beans Ltd. ")).toBe("fresh-beans-ltd");
  expect(isValidSupplierSlug("fresh-beans-ltd")).toBe(true);
  expect(isValidSupplierSlug("../fresh")).toBe(false);
});
