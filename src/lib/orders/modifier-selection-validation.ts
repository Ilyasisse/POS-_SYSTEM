type ModifierOptionRule = {
  id: string;
  isActive: boolean;
  modifierGroup: {
    id: string;
    name: string;
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    isActive: boolean;
  };
};

export function validateModifierSelections(input: {
  productName: string;
  availableOptions: readonly ModifierOptionRule[];
  selectedModifierIds: readonly string[];
}) {
  const groups = new Map<
    string,
    ModifierOptionRule["modifierGroup"] & { optionIds: Set<string> }
  >();

  for (const option of input.availableOptions) {
    if (!option.modifierGroup.isActive) continue;
    const existing = groups.get(option.modifierGroup.id);
    if (existing) {
      if (option.isActive) existing.optionIds.add(option.id);
    } else {
      groups.set(option.modifierGroup.id, {
        ...option.modifierGroup,
        optionIds: new Set(option.isActive ? [option.id] : []),
      });
    }
  }

  const selectedIds = new Set(input.selectedModifierIds);
  for (const group of groups.values()) {
    const selectedCount = [...group.optionIds].filter((id) =>
      selectedIds.has(id),
    ).length;
    const minimum = Math.max(group.minSelect, group.isRequired ? 1 : 0);

    if (selectedCount < minimum) {
      throw new Error(
        `${input.productName} requires at least ${minimum} choice${minimum === 1 ? "" : "s"} from ${group.name}.`,
      );
    }
    if (selectedCount > group.maxSelect) {
      throw new Error(
        `${input.productName} allows at most ${group.maxSelect} choice${group.maxSelect === 1 ? "" : "s"} from ${group.name}.`,
      );
    }
  }
}
