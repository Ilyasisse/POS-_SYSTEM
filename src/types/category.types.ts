import type { Station } from "./socket.types";

/**
 * Represents a menu category available to product and menu screens.
 */
export type Category = {
  id: string;
  name: string;
  iconUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  station?: Station;
};
