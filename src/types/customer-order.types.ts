import { Product } from "./product.types";
import type { CustomerFulfillmentType } from "@/lib/customer/customer-order-fulfillment";

export type CategoryChip = {
  id: string;
  name: string;
  count: number;
};

export type CustomerOrderState = {
  selectedCategoryValue: string;
  searchTerm: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: CustomerFulfillmentType;
  deliveryAddress: string;
  orderNote: string;
  selectedProduct: Product | null;
  modifierModalOpen: boolean;
  cartOpen: boolean;
  isSubmitting: boolean;
  submitMessage: string;
  submitError: string;
  lastOrderNumber: number | null;
};
