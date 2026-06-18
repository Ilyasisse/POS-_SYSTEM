import type { ModifierGroup } from "./modifier-group.types";
import type { Station } from "./socket.types";

/**
 * Represents a POS product with inventory and menu metadata.
 */
export type Product = {
  id: string;
  name: string;
  price: number;
  cost?: number | null;
  isActive: boolean;
  description?: string | null;
  trackStock: boolean;
  stockQty: number;
  imageUrl?: string | null;
  pronunciationAudioUrl?: string | null;
  isPopular: boolean;
  modifierGroups?: ModifierGroup[];
  category?: {
    id: string;
    name: string;
    station?: Station;
  } | null;
};

/**
 * Represents product data formatted for the public menu experience.
 */
export type MenuProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  categoryName: string;
  categorySlug: string;
  imageUrl: string | null;
  isPopular: boolean;
  bestSellerScore: number;
};
