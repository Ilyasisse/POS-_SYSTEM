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
  statusMessage: string;
  socketStatus: string;
  onCloseModifier: () => void;
  onConfirmModifier: (
    product: Product,
    selectedModifiers: SelectedModifiersMap,
    assignedBaristaId: string | null,
  ) => void;
  onCloseCart: () => void;
  onCustomerNameChange: (customerName: string) => void;
  onCustomerPhoneChange: (customerPhone: string) => void;
  onOrderNoteChange: (orderNote: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
};

export default function CustomerOrderOverlays({
  orderState,
  baristas,
  cart,
  cartSubtotal,
  cartCount,
  statusMessage,
  socketStatus,
  onCloseModifier,
  onConfirmModifier,
  onCloseCart,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  onChangeQuantity,
  onRemove,
  onClearCart,
  onCheckout,
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
        cartSubtotal={cartSubtotal}
        cartCount={cartCount}
        isSubmitting={orderState.isSubmitting}
        submitMessage={orderState.submitMessage}
        submitError={orderState.submitError}
        statusMessage={statusMessage}
        socketStatus={socketStatus}
        lastOrderNumber={orderState.lastOrderNumber}
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
