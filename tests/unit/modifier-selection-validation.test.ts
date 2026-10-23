import assert from "node:assert/strict";
import test from "node:test";
import { validateModifierSelections } from "../../src/lib/orders/modifier-selection-validation";

const option = (
  id: string,
  group: Partial<{
    id: string;
    name: string;
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    isActive: boolean;
  }> = {},
) => ({
  id,
  isActive: true,
  modifierGroup: {
    id: "size",
    name: "Size",
    isRequired: true,
    minSelect: 1,
    maxSelect: 1,
    isActive: true,
    ...group,
  },
});

test("accepts selections inside the configured group limits", () => {
  assert.doesNotThrow(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [option("small"), option("large")],
      selectedModifierIds: ["large"],
    }),
  );
});

test("rejects missing required modifier choices", () => {
  assert.throws(
    () =>
      validateModifierSelections({
        productName: "Coffee",
        availableOptions: [option("small"), option("large")],
        selectedModifierIds: [],
      }),
    /requires at least 1 choice from Size/,
  );
});

test("rejects selections above a group's maximum", () => {
  assert.throws(
    () =>
      validateModifierSelections({
        productName: "Coffee",
        availableOptions: [option("small"), option("large")],
        selectedModifierIds: ["small", "large"],
      }),
    /allows at most 1 choice from Size/,
  );
});

test("ignores inactive groups and permits optional empty groups", () => {
  assert.doesNotThrow(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [
        { ...option("legacy", { isActive: false }), isActive: false },
        option("syrup", {
          id: "syrup",
          name: "Syrup",
          isRequired: false,
          minSelect: 0,
          maxSelect: 2,
        }),
      ],
      selectedModifierIds: [],
    }),
  );
});

test("blocks required groups that have no active choices", () => {
  assert.throws(
    () =>
      validateModifierSelections({
        productName: "Coffee",
        availableOptions: [{ ...option("retired"), isActive: false }],
        selectedModifierIds: [],
      }),
    /requires at least 1 choice from Size/,
  );
});
