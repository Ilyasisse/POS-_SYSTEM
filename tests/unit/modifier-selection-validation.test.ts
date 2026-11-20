import { expect, test } from "@jest/globals";

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
  expect(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [option("small"), option("large")],
      selectedModifierIds: ["large"],
    }),
  ).not.toThrow();
});

test("rejects missing required modifier choices", () => {
  expect(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [option("small"), option("large")],
      selectedModifierIds: [],
    }),
  ).toThrow(/requires at least 1 choice from Size/);
});

test("rejects selections above a group's maximum", () => {
  expect(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [option("small"), option("large")],
      selectedModifierIds: ["small", "large"],
    }),
  ).toThrow(/allows at most 1 choice from Size/);
});

test("ignores inactive groups and permits optional empty groups", () => {
  expect(() =>
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
  ).not.toThrow();
});

test("blocks required groups that have no active choices", () => {
  expect(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [{ ...option("retired"), isActive: false }],
      selectedModifierIds: [],
    }),
  ).toThrow(/requires at least 1 choice from Size/);
});

test("duplicate option IDs cannot satisfy a group's minimum", () => {
  expect(() =>
    validateModifierSelections({
      productName: "Coffee",
      availableOptions: [
        option("small", { minSelect: 2, maxSelect: 2 }),
        option("large", { minSelect: 2, maxSelect: 2 }),
      ],
      selectedModifierIds: ["small", "small"],
    }),
  ).toThrow(/requires at least 2 choices from Size/);
});
