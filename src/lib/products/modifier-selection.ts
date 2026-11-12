type ModifierGroupRule = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
};

type ProductModifierOption = {
  id: string;
  isActive: boolean;
  modifierGroup: ModifierGroupRule;
};

type IncomingModifierChoice = { modifierId: string; qty?: number };

// Include inactive choices when loading rules: a required group with no active
// options must still reject an order, rather than silently becoming optional.
export const productModifierRulesSelect = {
  where: { modifierGroup: { isActive: true } },
  select: {
    id: true,
    isActive: true,
    modifierGroup: {
      select: {
        id: true,
        name: true,
        isRequired: true,
        minSelect: true,
        maxSelect: true,
      },
    },
  },
} as const;

export function validateProductModifierSelection(
  productName: string,
  options: readonly ProductModifierOption[],
  requested: readonly IncomingModifierChoice[],
): string | null {
  const optionsById = new Map(options.map((option) => [option.id, option]));
  const rules = new Map(
    options.map((option) => [option.modifierGroup.id, option.modifierGroup]),
  );
  const selections = new Map<string, Set<string>>();

  for (const choice of requested) {
    const option = optionsById.get(choice.modifierId);
    if (!option?.isActive) {
      return `A selected option is no longer available for ${productName}. Please review your choices.`;
    }
    const quantity = choice.qty ?? 1;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      return `Invalid option quantity for ${productName}.`;
    }
    const selected =
      selections.get(option.modifierGroup.id) ?? new Set<string>();
    selected.add(option.id);
    selections.set(option.modifierGroup.id, selected);
  }

  for (const rule of rules.values()) {
    const minimum = Math.max(rule.isRequired ? 1 : 0, rule.minSelect);
    const count = selections.get(rule.id)?.size ?? 0;
    if (count < minimum || count > rule.maxSelect) {
      const requirement =
        minimum === rule.maxSelect
          ? `exactly ${minimum}`
          : minimum === 0
            ? `up to ${rule.maxSelect}`
            : `${minimum}–${rule.maxSelect}`;
      return `${productName}: choose ${requirement} from ${rule.name}.`;
    }
  }
  return null;
}
