import { CartLine, Product, StaffSummary } from "@/types";
import CustomerCartSheet from "../CustomerCartSheet";
import CustomerModifierModal from "../CustomerModifierModal";
import { SelectedModifiersMap } from "../customer-order-utils";
import { CustomerOrderState } from "@/types/customer-order.types";

type CustomerOrderOverlaysProps = {
  orderState: CustomerOrderState;
  baristas: StaffSummary[];
  cart: CartLine[];
  cartSubtotal: number;
  cartCount: number;
  onCloseModifier: () => void;
  onConfirmModifier: (
    product: Product,
    selectedModifiers: SelectedModifiersMap,
    assignedBaristaId: string | null,
  ) => void;
  onCloseCart: () => void;
  onCustomerNameChange: (customerName: string) => void;
  onCustomerPhoneChange: (customerPhone: string) => void;
  onFulfillmentChange: (orderType: "DINE_IN" | "TAKEOUT", tableId: string) => void;
  onOrderNoteChange: (orderNote: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  tableName?: string;
};

export default function CustomerOrderOverlays({
  orderState,
  baristas,
  cart,
  cartSubtotal,
  cartCount,
  onCloseModifier,
  onConfirmModifier,
  onCloseCart,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  onFulfillmentChange,
  onChangeQuantity,
  onRemove,
  onClearCart,
  onCheckout,
  tableName,
}: CustomerOrderOverlaysProps) {
  return (
    <>
      <CustomerModifierModal
        open={orderState.modifierModalOpen}
        product={orderState.selectedProduct}
        baristas={baristas}
        onClose={onCloseModifier}
        onConfirm={onConfirmModifier}
      />

      <CustomerCartSheet
        open={orderState.cartOpen}
        cart={cart}
        customerName={orderState.customerName}
        customerPhone={orderState.customerPhone}
        orderNote={orderState.orderNote}
        orderType={orderState.orderType}
        selectedTableId={orderState.tableId}
        onFulfillmentChange={tableName ? undefined : onFulfillmentChange}
        tableName={tableName}
        cartSubtotal={cartSubtotal}
        cartCount={cartCount}
        isSubmitting={orderState.isSubmitting}
        submitMessage={orderState.submitMessage}
        submitError={orderState.submitError}
        onClose={onCloseCart}
        onCustomerNameChange={onCustomerNameChange}
        onCustomerPhoneChange={onCustomerPhoneChange}
        onOrderNoteChange={onOrderNoteChange}
        onChangeQuantity={onChangeQuantity}
        onRemove={onRemove}
        onClearCart={onClearCart}
        onCheckout={onCheckout}
      />
    </>
  );
}
