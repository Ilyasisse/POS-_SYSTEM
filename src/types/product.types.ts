import type { ModifierGroup } from "./modifier-group.types";
import type { Station } from "./socket.types";

export type { MenuProduct } from "./menu/menu-types";

/**
 * Represents a POS product with inventory and menu metadata.
 */
export type Product = {
  id: string;
  name: string;
  price: number;
  isOpenPrice?: boolean;
  openPriceEntered?: boolean;
  description?: string | null;
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
