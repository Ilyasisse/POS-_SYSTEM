import type { Station } from "./socket.types";

/**
 * Summarizes staff identity and routing data used by order and shift screens.
 */
export type StaffSummary = {
  id: string;
  fullName: string;
  email?: string | null;
  role?: string;
  station?: Station;
};
