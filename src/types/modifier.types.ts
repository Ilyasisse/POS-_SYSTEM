/**
 * Represents one selectable modifier option for a product.
 */
export type ModifierOption = {
  id: string;
  name: string;
  price: number;
  pronunciationAudioUrl?: string | null;
};

/**
 * Represents a configured modifier line selected on an order item.
 */
export type SelectedModifierLine = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
  qty: number;
  pronunciationAudioUrl?: string | null;
};
