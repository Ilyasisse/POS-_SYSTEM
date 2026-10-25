"use client";

import { useCustomerTranslations } from "@/components/customer/i18n/CustomerLanguageProvider";

import { formatCustomerMessage, type CustomerMessage } from "@/i18n/customer";
import CustomerFulfillmentSelect from "./CustomerFulfillmentSelect";
import { normalizeCustomerPaymentPhone } from "@/lib/payments/customer-ussd";
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
  orderType?: "DINE_IN" | "TAKEOUT";
  selectedTableId?: string;
  onFulfillmentChange?: (type: "DINE_IN" | "TAKEOUT", tableId: string) => void;
  cartSubtotal: number;
  cartCount: number;
  isSubmitting: boolean;
  submitMessage: CustomerMessage;
  submitError: CustomerMessage;
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

type CartLineItemsProps = Pick<CustomerCartSheetProps, "cart" | "onChangeQuantity" | "onRemove">;

function CartLineItems({ cart, onChangeQuantity, onRemove }: CartLineItemsProps) {
  const t = useCustomerTranslations();
  return (
    <div className="space-y-3">
      {cart.map((item) => (
        <div
          key={item.cartKey}
          data-aos="fade-up"
          className="border-border bg-card rounded-[1.5rem] border p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-foreground text-lg font-semibold break-words">{item.name}</p>
              <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(Number(item.finalPrice ?? item.price))}
              </p>
            </div>

            <Button
              variant="outline"
              type="button"
              onClick={() => onRemove(item.cartKey)}
              className="border-border bg-muted/50 text-foreground rounded-full border px-3 py-1 text-xs font-semibold"
            >
              {t("remove")}
            </Button>
          </div>

          {item.selectedModifiers?.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.selectedModifiers.map((modifier) => (
                <span
                  key={`${item.cartKey}-${modifier.optionId}`}
                  className="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium break-words"
                >
                  {modifier.groupName}: {modifier.optionName}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="border-border bg-muted/50 inline-flex items-center rounded-full border">
              <Button
                type="button"
                aria-label={t("decreaseQuantity", { name: item.name })}
                onClick={() => onChangeQuantity(item.cartKey, -1)}
                className="text-foreground px-4 py-3 text-lg font-semibold"
              >
                -
              </Button>
              <span className="text-foreground min-w-10 text-center text-sm font-semibold">
                {item.quantity}
              </span>
              <Button
                type="button"
                aria-label={t("increaseQuantity", { name: item.name })}
                onClick={() => onChangeQuantity(item.cartKey, 1)}
                className="text-foreground px-4 py-3 text-lg font-semibold"
              >
                +
              </Button>
            </div>

            <p className="text-foreground shrink-0 text-sm font-semibold">
              {formatCurrency(Number(item.lineTotal ?? item.finalPrice ?? item.price))}
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
  const t = useCustomerTranslations();
  return (
    <div className="border-border dark:bg-secondary shrink-0 border-b bg-[linear-gradient(145deg,#20140f_0%,#4a281a_42%,#8c5b34_100%)] px-4 py-4 text-white sm:px-6 sm:py-5 dark:bg-none">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs tracking-[0.3em] text-amber-200/90 uppercase">
            {isCashier ? "Kitchen order" : t("yourOrder")}
          </p>
          <h2
            className="mt-3 text-3xl break-words sm:text-4xl"
            style={{
              fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif',
            }}
          >
            {isCashier ? tableName || "Selected table" : t("cart")}
          </h2>
          <p className="mt-1 text-sm text-white/70">{t("itemCount", { count: cartCount })}</p>
        </div>
        {showCloseButton ? (
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 hover:text-white dark:bg-white/10 dark:hover:bg-white/15"
          >
            {t("close")}
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
  | "submitMessage"
  | "submitError"
  | "onCustomerNameChange"
  | "onCustomerPhoneChange"
  | "onOrderNoteChange"
  | "onChangeQuantity"
  | "onRemove"
> & { isCashier: boolean }) {
  const t = useCustomerTranslations();
  if (cart.length === 0) {
    return (
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
        <CartMessages message={submitMessage} error={submitError} />
        <div className="border-border bg-card/75 text-muted-foreground flex min-h-[16rem] items-center justify-center rounded-[1.75rem] border border-dashed p-8 text-center text-sm">
          {t("emptyCart")}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <CartMessages message={submitMessage} error={submitError} />
      <div className="border-border bg-card rounded-[1.5rem] border p-4 shadow-[0_20px_45px_rgba(55,36,20,0.05)]">
        <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
          {isCashier ? "Order details" : t("checkoutDetails")}
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {!isCashier ? (
            <>
              <div>
                <label htmlFor="customer-name" className="text-sm font-semibold">
                  {t("nameRequired")}
                </label>
                <Input
                  id="customer-name"
                  required
                  value={customerName}
                  onChange={(event) => onCustomerNameChange(event.target.value)}
                  placeholder={t("googleName")}
                  className="mt-1 rounded-full"
                />
                {!customerName.trim() ? (
                  <p className="text-muted-foreground mt-1 text-xs">{t("signInName")}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="customer-phone" className="text-sm font-semibold">
                  {t("phoneRequired")}
                </label>
                <Input
                  id="customer-phone"
                  type="tel"
                  inputMode="numeric"
                  required
                  pattern="90[0-9]{7}"
                  maxLength={9}
                  value={customerPhone}
                  onChange={(event) => onCustomerPhoneChange(event.target.value)}
                  placeholder="901234567"
                  aria-describedby="customer-phone-help"
                  aria-invalid={Boolean(
                    customerPhone && !normalizeCustomerPaymentPhone(customerPhone),
                  )}
                  className="mt-1 rounded-full"
                />
                <p id="customer-phone-help" className="text-muted-foreground mt-1 text-xs">
                  {t("phoneHelp")}
                </p>
                {customerPhone && !normalizeCustomerPaymentPhone(customerPhone) ? (
                  <p role="alert" className="text-xs text-rose-700">
                    {t("phoneInvalid")}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
          {isCashier ? (
            <div className="md:col-span-2">
              <Textarea
                aria-label="Special requests or notes"
                value={orderNote}
                onChange={(event) => onOrderNoteChange(event.target.value)}
                placeholder="Special requests or notes"
                rows={4}
                className="border-border bg-muted/50 focus:border-ring w-full rounded-[1.25rem] border px-4 py-3 text-sm outline-none"
              />
            </div>
          ) : null}
        </div>
        {!isCashier && onFulfillmentChange ? (
          <CustomerFulfillmentSelect
            orderType={orderType}
            tableId={selectedTableId}
            onChange={onFulfillmentChange}
          />
        ) : null}
        <CartLineItems cart={cart} onChangeQuantity={onChangeQuantity} onRemove={onRemove} />
      </div>
    </div>
  );
}

function CartMessages({ message, error }: { message: CustomerMessage; error: CustomerMessage }) {
  const t = useCustomerTranslations();
  return (
    <>
      {message ? (
        <div
          role="status"
          className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {formatCustomerMessage(message, t)}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {formatCustomerMessage(error, t)}
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
}: Pick<CustomerCartSheetProps, "cartSubtotal" | "isSubmitting" | "onCheckout" | "onClearCart"> & {
  cartIsEmpty: boolean;
  isCashier: boolean;
}) {
  const t = useCustomerTranslations();
  const checkoutLabel = isSubmitting
    ? isCashier
      ? "Sending to kitchen…"
      : t("preparingPayment")
    : isCashier
      ? "Send to kitchen"
      : t("checkout");

  return (
    <div className="border-border bg-card shrink-0 border-t px-4 py-4 sm:px-6 sm:py-5">
      <div className="text-foreground flex items-center justify-between text-base font-semibold">
        <span>{t("total")}</span>
        <span>{formatCurrency(cartSubtotal)}</span>
      </div>
      <div className="mt-5 grid gap-3">
        <Button
          type="button"
          onClick={onCheckout}
          disabled={isSubmitting || cartIsEmpty}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 py-4 text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checkoutLabel}
        </Button>
        <Button
          variant="outline"
          type="button"
          onClick={onClearCart}
          disabled={cartIsEmpty || isSubmitting}
          className="border-border bg-muted/50 text-foreground hover:bg-muted rounded-full border px-6 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("clearCart")}
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
      className="border-border bg-card text-foreground dark:bg-card dark:text-foreground hidden max-h-[calc(100dvh-8.75rem)] min-h-[36rem] overflow-hidden rounded-[1.75rem] border shadow-[0_22px_65px_rgba(44,28,17,0.14)] lg:sticky lg:top-[7.75rem] lg:flex"
    >
      <CustomerCartContent {...props} showCloseButton={false} />
    </aside>
  );
}

export default function CustomerCartSheet(props: CustomerCartSheetProps) {
  const t = useCustomerTranslations();
  const { open, onClose } = props;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="border-border bg-card text-foreground dark:bg-card dark:text-foreground flex w-full gap-0 overflow-hidden border-l p-0 sm:max-w-xl"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{t("yourCart")}</SheetTitle>
          <SheetDescription>{t("cartDescription")}</SheetDescription>
        </SheetHeader>
        <CustomerCartContent {...props} />
      </SheetContent>
    </Sheet>
  );
}
