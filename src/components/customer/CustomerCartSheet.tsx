"use client";

import CustomerFulfillmentSelect from "./CustomerFulfillmentSelect";
import { normalizeCustomerPaymentPhone } from "@/lib/payments/customer-ussd";
import {
  validateCustomerFulfillment,
  type CustomerFulfillmentType,
} from "@/lib/customer/customer-order-fulfillment";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";

import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { CartLine } from "@/lib/types";
import { formatCurrency } from "./customer-order-utils";

type CustomerCartSheetProps = {
  open: boolean;
  cart: CartLine[];
  customerName: string;
  customerPhone: string;
  orderNote: string;
  orderType?: CustomerFulfillmentType;
  deliveryAddress?: string;
  deliveryPhone?: string;
  selectedTableId?: string;
  onFulfillmentChange?: (type: CustomerFulfillmentType, tableId: string) => void;
  onDeliveryAddressChange?: (value: string) => void;
  onDeliveryPhoneChange?: (value: string) => void;
  cartSubtotal: number;
  cartCount: number;
  isSubmitting: boolean;
  submitMessage: string;
  submitError: string;
  onClose: () => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onOrderNoteChange: (value: string) => void;
  onChangeQuantity: (cartKey: string, delta: number) => void;
  onRemove: (cartKey: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  mode?: "customer" | "cashier";
  tableName?: string;
};

type CustomerCartContentProps = Omit<CustomerCartSheetProps, "open"> & {
  showCloseButton?: boolean;
};

type CartLineItemsProps = Pick<
  CustomerCartSheetProps,
  "cart" | "onChangeQuantity" | "onRemove"
>;

function CartLineItems({
  cart,
  onChangeQuantity,
  onRemove,
}: CartLineItemsProps) {
  return (
    <div className="space-y-3">
      {cart.map((item) => (
        <div
          key={item.cartKey}
          data-aos="fade-up"
          className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words text-lg font-semibold text-foreground">
                {item.name}
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(Number(item.finalPrice ?? item.price))}
              </p>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={() => onRemove(item.cartKey)}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-foreground"
            >
              Remove
            </Button>
          </div>

          {item.selectedModifiers?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.selectedModifiers.map((modifier) => (
                <span
                  key={`${item.cartKey}-${modifier.optionId}`}
                  className="break-words rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {modifier.groupName}: {modifier.optionName}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-muted/50">
              <Button
                type="button"
                aria-label={`Decrease quantity for ${item.name}`}
                onClick={() => onChangeQuantity(item.cartKey, -1)}
                className="px-4 py-3 text-lg font-semibold text-foreground"
              >
                -
              </Button>
              <span className="min-w-10 text-center text-sm font-semibold text-foreground">
                {item.quantity}
              </span>
              <Button
                type="button"
                aria-label={`Increase quantity for ${item.name}`}
                onClick={() => onChangeQuantity(item.cartKey, 1)}
                className="px-4 py-3 text-lg font-semibold text-foreground"
              >
                +
              </Button>
            </div>

            <p className="shrink-0 text-sm font-semibold text-foreground">
              {formatCurrency(
                Number(item.lineTotal ?? item.finalPrice ?? item.price),
              )}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CartHeader({
  isCashier,
  tableName,
  cartCount,
  showCloseButton,
  onClose,
}: {
  isCashier: boolean;
  tableName?: string;
  cartCount: number;
  showCloseButton: boolean;
  onClose: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] dark:bg-none dark:bg-secondary px-4 py-4 text-white sm:px-6 sm:py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200/90">
            {isCashier ? "Kitchen order" : "Your order"}
          </p>
          <h2
            className="mt-3 break-words text-3xl sm:text-4xl"
            style={{
              fontFamily:
                '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
            }}
          >
            {isCashier ? tableName || "Selected table" : "Cart"}
          </h2>
          <p className="mt-1 text-sm text-white/70">
            {cartCount} item{cartCount === 1 ? "" : "s"}
          </p>
        </div>
        {showCloseButton ? (
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 hover:text-white dark:bg-white/10 dark:hover:bg-white/15"
          >
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CartBody({
  cart,
  customerName,
  customerPhone,
  orderNote,
  orderType = "TAKEOUT",
  selectedTableId = "",
  onFulfillmentChange,
  deliveryAddress = "",
  deliveryPhone = "",
  onDeliveryAddressChange,
  onDeliveryPhoneChange,
  submitMessage,
  submitError,
  isCashier,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onOrderNoteChange,
  onChangeQuantity,
  onRemove,
}: Pick<
  CustomerCartSheetProps,
  | "cart"
  | "customerName"
  | "customerPhone"
  | "orderNote"
  | "orderType"
  | "selectedTableId"
  | "onFulfillmentChange"
  | "deliveryAddress"
  | "deliveryPhone"
  | "onDeliveryAddressChange"
  | "onDeliveryPhoneChange"
  | "submitMessage"
  | "submitError"
  | "onCustomerNameChange"
  | "onCustomerPhoneChange"
  | "onOrderNoteChange"
  | "onChangeQuantity"
  | "onRemove"
> & { isCashier: boolean }) {
  const fulfillment = validateCustomerFulfillment({
    orderType,
    customerName,
    tableId: selectedTableId,
    deliveryAddress,
    deliveryPhone,
  });
  const fieldError = (field: string, value: string) =>
    !isCashier && !fulfillment.ok && fulfillment.field === field && (value || submitError)
      ? fulfillment.error
      : "";
  if (cart.length === 0) {
    return (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <CartMessages message={submitMessage} error={submitError} />
        <div className="flex min-h-[16rem] items-center justify-center rounded-[1.75rem] border border-dashed border-border bg-card/75 p-8 text-center text-sm text-muted-foreground">
          Your cart is empty. Add items from the menu to continue.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <CartMessages message={submitMessage} error={submitError} />
      <div className="rounded-[1.5rem] border border-border bg-card p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
          {isCashier ? "Order details" : "Checkout details"}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {!isCashier ? (
            <>
              <div>
                <label htmlFor="customer-name" className="text-sm font-semibold">Name (required)</label>
                <Input id="customer-name" required maxLength={100} value={customerName}
                  onChange={(event) => onCustomerNameChange(event.target.value)}
                  placeholder="Your Google account name"
                  className="mt-1 rounded-full" />
                {!customerName.trim() ? <p className="mt-1 text-xs text-muted-foreground">Sign in at checkout to use your account name.</p> : null}
                {fieldError("customerName", customerName) ? <p role="alert" className="text-xs text-rose-700">{fieldError("customerName", customerName)}</p> : null}
              </div>
              <div>
                <label htmlFor="customer-phone" className="text-sm font-semibold">Payment phone (required)</label>
                <Input id="customer-phone" type="tel" inputMode="numeric" required pattern="90[0-9]{7}" maxLength={9}
                  value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)}
                  placeholder="901234567" aria-describedby="customer-phone-help"
                  aria-invalid={Boolean(customerPhone && !normalizeCustomerPaymentPhone(customerPhone))}
                  className="mt-1 rounded-full" />
                <p id="customer-phone-help" className="mt-1 text-xs text-muted-foreground">90 followed by seven digits. Leave out +252.</p>
                {customerPhone && !normalizeCustomerPaymentPhone(customerPhone) ? <p role="alert" className="text-xs text-rose-700">Use exactly nine digits starting with 90.</p> : null}
              </div>
            </>
          ) : null}
          {isCashier ? <div className="md:col-span-2">
            <Textarea
              aria-label="Special requests or notes"
              value={orderNote}
              onChange={(event) => onOrderNoteChange(event.target.value)}
              placeholder="Special requests or notes"
              rows={4}
              className="w-full rounded-[1.25rem] border border-border bg-muted/50 px-4 py-3 text-sm outline-none focus:border-ring"
            />
          </div> : null}
        </div>
        {!isCashier && onFulfillmentChange ? <CustomerFulfillmentSelect orderType={orderType} tableId={selectedTableId} onChange={onFulfillmentChange} /> : null}
        {!isCashier && orderType === "DINE_IN" && !selectedTableId && submitError ? <p role="alert" className="mt-1 text-xs text-rose-700">Select your table before checkout.</p> : null}
        {!isCashier && orderType === "DELIVERY" ? (
          <div className="mt-4 grid gap-3">
            <div>
              <label htmlFor="delivery-phone" className="text-sm font-semibold">Delivery contact phone (required)</label>
              <Input id="delivery-phone" type="tel" autoComplete="tel" required maxLength={30}
                value={deliveryPhone} onChange={event => onDeliveryPhoneChange?.(event.target.value)}
                aria-describedby="delivery-phone-help" aria-invalid={Boolean(fieldError("deliveryPhone", deliveryPhone))}
                className="mt-1 rounded-full" placeholder="Phone to call on arrival" />
              <p id="delivery-phone-help" className="mt-1 text-xs text-muted-foreground">This can differ from the phone sending payment.</p>
              {fieldError("deliveryPhone", deliveryPhone) ? <p role="alert" className="text-xs text-rose-700">{fieldError("deliveryPhone", deliveryPhone)}</p> : null}
            </div>
            <div>
              <label htmlFor="delivery-address" className="text-sm font-semibold">Delivery address (required)</label>
              <Textarea id="delivery-address" autoComplete="street-address" required maxLength={500} rows={3}
                value={deliveryAddress} onChange={event => onDeliveryAddressChange?.(event.target.value)}
                aria-invalid={Boolean(fieldError("deliveryAddress", deliveryAddress))}
                className="mt-1 rounded-xl" placeholder="Area, street, and a nearby landmark" />
              {fieldError("deliveryAddress", deliveryAddress) ? <p role="alert" className="text-xs text-rose-700">{fieldError("deliveryAddress", deliveryAddress)}</p> : null}
            </div>
          </div>
        ) : null}
        <CartLineItems
          cart={cart}
          onChangeQuantity={onChangeQuantity}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

function CartMessages({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message ? (
        <div
          role="status"
          className="rounded-[1.25rem] border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-300"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-[1.25rem] border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300"
        >
          {error}
        </div>
      ) : null}
    </>
  );
}

function CartFooter({
  cartSubtotal,
  cartIsEmpty,
  isSubmitting,
  isCashier,
  onCheckout,
  onClearCart,
}: Pick<
  CustomerCartSheetProps,
  "cartSubtotal" | "isSubmitting" | "onCheckout" | "onClearCart"
> & { cartIsEmpty: boolean; isCashier: boolean }) {
  const checkoutLabel = isSubmitting
    ? isCashier
      ? "Sending to kitchen…"
      : "Preparing payment…"
    : isCashier
      ? "Send to kitchen"
      : "Checkout";

  return (
    <div className="shrink-0 border-t border-border bg-card px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between text-base font-semibold text-foreground">
        <span>Total</span>
        <span>{formatCurrency(cartSubtotal)}</span>
      </div>
      <div className="mt-5 grid gap-3">
        <Button
          type="button"
          onClick={onCheckout}
          disabled={isSubmitting || cartIsEmpty}
          className="rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkoutLabel}
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={onClearCart}
          disabled={cartIsEmpty || isSubmitting}
          className="rounded-full border border-border bg-muted/50 px-6 py-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear cart
        </Button>
      </div>
    </div>
  );
}

function CustomerCartContent({
  showCloseButton = true,
  mode = "customer",
  ...props
}: CustomerCartContentProps) {
  const isCashier = mode === "cashier";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <CartHeader
        isCashier={isCashier}
        tableName={props.tableName}
        cartCount={props.cartCount}
        showCloseButton={showCloseButton}
        onClose={props.onClose}
      />
      <CartBody {...props} isCashier={isCashier} />
      <CartFooter
        cartSubtotal={props.cartSubtotal}
        cartIsEmpty={props.cart.length === 0}
        isSubmitting={props.isSubmitting}
        isCashier={isCashier}
        onCheckout={props.onCheckout}
        onClearCart={props.onClearCart}
      />
    </div>
  );
}

export function CustomerCartPanel(props: Omit<CustomerCartSheetProps, "open">) {
  return (
    <aside
      aria-label="Current table order"
      className="hidden max-h-[calc(100dvh-8.75rem)] min-h-[36rem] overflow-hidden rounded-[1.75rem] border border-border bg-card text-foreground shadow-[0_22px_65px_rgba(44,28,17,0.14)] dark:bg-card dark:text-foreground lg:sticky lg:top-[7.75rem] lg:flex"
    >
      <CustomerCartContent {...props} showCloseButton={false} />
    </aside>
  );
}

export default function CustomerCartSheet(props: CustomerCartSheetProps) {
  const { open, onClose } = props;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex w-full gap-0 overflow-hidden border-l border-border bg-card p-0 text-foreground dark:bg-card dark:text-foreground sm:max-w-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            Review order details, quantities, and checkout information.
          </SheetDescription>
        </SheetHeader>
        <CustomerCartContent {...props} />
      </SheetContent>
    </Sheet>
  );
}
