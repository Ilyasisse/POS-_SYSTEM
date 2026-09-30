import type { SelectedModifierLine } from "./modifier.types";
import type { Station } from "./socket.types";

/**
 * Supported payment methods recorded by the POS.
 */
enum PaymentMethod {
  CASH = "CASH",
  MYCASH = "MYCASH",
  GOLIS = "GOLIS",
  DAHABSHIIL = "Dahabshiil",
  OTHER = "OTHER",
}

/**
 * Represents one configured cart line before an order is submitted.
 */
export type CartLine = {
  cartKey: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  pronunciationAudioUrl?: string | null;
  finalPrice?: number;
  lineTotal?: number;
  selectedModifiers: SelectedModifierLine[];
  station?: Station;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  product: {
    id: string;
    name: string;
    pronunciationAudioUrl?: string | null;
    category?: {
      id: string;
      name: string;
      station?: Station;
    } | null;
  };
};

/**
 * Represents one receipt line after order submission.
 */
export type ReceiptSnapshotLine = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  finalPrice: number;
  station?: Station;
  selectedModifiers: SelectedModifierLine[];
  assignedUserId?: string | null;
  assignedUserName?: string | null;
};

/**
 * Represents the printable receipt state for an order.
 */
export type ReceiptSnapshot = {
  receiptNo: number;
  createdAt: string;
  waiterName: string;
  orderNote: string;
  total: number;
  lines: ReceiptSnapshotLine[];
};

/**
 * Represents a payment recorded against an order.
 */
export type Payment = {
  id: string;
  orderId: string;
  cashierId: string;
  cashierName: string;
  method: PaymentMethod;
  amountPaid: number;
  reference?: string | null;
  createdAt: Date;
};
