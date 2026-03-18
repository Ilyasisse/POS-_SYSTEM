export enum PaymentMethod {
  MYCASH = "MYCASH",
  GOLIS = "GOLIS",
  DAHABSHIIL = "DAHABSHIIL",
  OTHER = "OTHER",
}

export type SocketStatus = "connecting" | "connected" | "disconnected";

export type Station = "KITCHEN" | "BARISTA" | null;

export type ModifierOption = {
  id: string;
  name: string;
  price: number;
};

export type ModifierGroup = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: ModifierOption[];
};

export type ModifierGroupForWaiter = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
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
  sku?: string | null;
  description?: string | null;
  trackStock: boolean;
  stockQty: number;
  imageUrl?: string | null;
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
};

export type CartLine = {
  cartKey: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  sku?: string;
  finalPrice?: number;
  selectedModifiers?: SelectedModifierLine[];
  station?: Station;
  product: {
    id: string;
    name: string;
    category?: {
      id: string;
      name: string;
      station?: Station;
    } | null;
  };
};

export type ReceiptSnapshot = {
  receiptNo: number;
  createdAt: string;
  waiterName: string;
  orderNote: string;
  total: number;
  lines: CartLine[];
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