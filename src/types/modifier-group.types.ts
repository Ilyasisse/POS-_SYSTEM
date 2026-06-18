import type { ModifierOption } from "./modifier.types";

/**
 * Groups modifier options and selection rules for a product.
 */
export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect?: number;
  maxSelect?: number;
  multiple: boolean;
  options: ModifierOption[];
};
