import type { KitchenStation } from "@/lib/kitchen-socket";

export enum PaymentMethod {
  MYCASH = "MYCASH",
  GOLIS = "GOLIS",
  DAHABSHIIL = "Dahabshiil",
  OTHER = "OTHER",
}

export type SocketStatus = "connecting" | "connected" | "disconnected";

export type Station = KitchenStation | null;

export type StaffSummary = {
  id: string;
  fullName: string;
  email?: string | null;
  role?: string;
  station?: Station;
};

export type ModifierOption = {
  id: string;
  name: string;
  price: number;
  pronunciationAudioUrl?: string | null;
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect?: number;
  maxSelect?: number;
  multiple: boolean;
  options: ModifierOption[];
};

export type Category = {
  id: string;
  name: string;
  iconUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  station?: Station;
};

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

export type SelectedModifierLine = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
  qty: number;
  pronunciationAudioUrl?: string | null;
};

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

export type ReceiptSnapshot = {
  receiptNo: number;
  createdAt: string;
  waiterName: string;
  orderNote: string;
  total: number;
  lines: ReceiptSnapshotLine[];
};

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