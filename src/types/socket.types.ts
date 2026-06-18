import type { KitchenStation } from "@/lib/kitchen/kitchen-socket";

/**
 * Tracks the connection state of realtime socket clients.
 */
export type SocketStatus = "connecting" | "connected" | "disconnected";

/**
 * Represents a nullable kitchen station assignment.
 */
export type Station = KitchenStation | null;
