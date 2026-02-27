"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getKitchenSocketUrl,
  type KitchenSocketMessage,
  type KitchenTicket,
  type SaleRecord,
} from "../../lib/kitchen-socket";

type Category = string;
type PaymentMethod = "cash" | "card" | "split";
type DiscountMode = "none" | "percent" | "fixed";
type SocketStatus = "connecting" | "connected" | "disconnected";

type MenuItem = {
  id: string;
  name: string;
  category: Category;
  price: number;
  sku: string;
  popular?: boolean;
};

type CartLine = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
};

type ReceiptSnapshot = {
  receiptNo: number;
  createdAt: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paid: number;
  change: number;
  orderNote: string;
};

const DEFAULT_TAX_RATE = 8.25;

const fallbackMenuItems: MenuItem[] = [
  { id: "coffee", name: "Coffee", category: "Drinks", price: 3.5, sku: "DRK-001", popular: true },
  { id: "latte", name: "Latte", category: "Drinks", price: 4.5, sku: "DRK-002", popular: true },
  { id: "cap", name: "Cappuccino", category: "Drinks", price: 5, sku: "DRK-003" },
  { id: "croissant", name: "Croissant", category: "Food", price: 4, sku: "FOD-001", popular: true },
  { id: "sandwich", name: "Sandwich", category: "Food", price: 8.5, sku: "FOD-002" },
  { id: "cake", name: "Cheesecake", category: "Food", price: 6, sku: "FOD-003" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function money(amount: number) {
  return currency.format(amount);
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resetOrderValues() {
  return {
    orderNote: "",
    discountMode: "none" as DiscountMode,
    discountValue: "0",
    paymentMethod: "cash" as PaymentMethod,
    cashPaid: "0",
    cardPaid: "0",
  };
}

export default function WaiterPage() {
  const socketUrl = useMemo(() => getKitchenSocketUrl(), []);
  const [waiterName, setWaiterName] = useState("Waiter-1");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>(fallbackMenuItems);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
  const [discountValue, setDiscountValue] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [cashPaid, setCashPaid] = useState("0");
  const [cardPaid, setCardPaid] = useState("0");

  const [receiptCounter, setReceiptCounter] = useState(1001);
  const [lastReceipt, setLastReceipt] = useState<ReceiptSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pendingTicketsRef = useRef<KitchenTicket[]>([]);
  const pendingSalesRef = useRef<SaleRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Product endpoint not available.");
        }
        const payload = (await response.json()) as {
          categories?: Array<{
            name: string;
            products: Array<{ id: string; name: string; sku: string; priceCents: number }>;
          }>;
          taxPercent?: number;
        };
        if (cancelled || !payload.categories) {
          return;
        }

        const menu = payload.categories.flatMap((category) =>
          category.products.map((product, index) => ({
            id: product.id,
            name: product.name,
            category: category.name,
            price: product.priceCents / 100,
            sku: product.sku || "",
            popular: index < 2,
          })),
        );

        if (menu.length > 0) {
          setMenuCatalog(menu);
        }
        if (Number.isFinite(payload.taxPercent)) {
          setTaxRate(payload.taxPercent ?? DEFAULT_TAX_RATE);
        }
      } catch {
        if (!cancelled) {
          setStatusMessage("Using fallback menu. Connect database to load live products.");
        }
      }
    };

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      setSocketStatus("connecting");
      const ws = new WebSocket(socketUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        setSocketStatus("connected");
        const pendingTicketCount = pendingTicketsRef.current.length;
        const pendingSaleCount = pendingSalesRef.current.length;
        if (pendingTicketCount > 0 || pendingSaleCount > 0) {
          pendingTicketsRef.current.forEach((ticket) => {
            const message: KitchenSocketMessage = { type: "NEW_ORDER", payload: ticket };
            ws.send(JSON.stringify(message));
          });
          pendingSalesRef.current.forEach((sale) => {
            const message: KitchenSocketMessage = { type: "NEW_SALE", payload: sale };
            ws.send(JSON.stringify(message));
          });
          pendingTicketsRef.current = [];
          pendingSalesRef.current = [];
          setStatusMessage(
            `Reconnected. Synced ${pendingTicketCount} ticket(s) and ${pendingSaleCount} sale record(s).`,
          );
        }
      };

      ws.onerror = () => {
        setSocketStatus("disconnected");
      };

      ws.onclose = () => {
        if (disposed) {
          return;
        }
        setSocketStatus("disconnected");
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [socketUrl]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(menuCatalog.map((item) => item.category))).sort();
    return ["All", ...unique];
  }, [menuCatalog]);

  const filteredItems = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return menuCatalog.filter((item) => {
      const categoryMatch = selectedCategory === "All" || item.category === selectedCategory;
      if (!categoryMatch) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.sku.toLowerCase().includes(normalized)
      );
    });
  }, [menuCatalog, searchTerm, selectedCategory]);

  const quickItems = useMemo(
    () => menuCatalog.filter((item) => item.popular).slice(0, 8),
    [menuCatalog],
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cart],
  );

  const discountAmount = useMemo(() => {
    const value = Math.max(0, toNumber(discountValue));
    if (discountMode === "percent") {
      return Math.min(subtotal, subtotal * (Math.min(value, 100) / 100));
    }
    if (discountMode === "fixed") {
      return Math.min(subtotal, value);
    }
    return 0;
  }, [discountMode, discountValue, subtotal]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  const paidAmount = useMemo(() => {
    if (paymentMethod === "cash") {
      return Math.max(0, toNumber(cashPaid));
    }
    if (paymentMethod === "card") {
      return Math.max(0, toNumber(cardPaid));
    }
    return Math.max(0, toNumber(cashPaid)) + Math.max(0, toNumber(cardPaid));
  }, [paymentMethod, cashPaid, cardPaid]);

  const balance = total - paidAmount;
  const changeDue = balance < 0 ? Math.abs(balance) : 0;
  const hasCart = cart.length > 0;
  const validPayment = hasCart && paidAmount >= total && total > 0;

  const addToCart = (item: MenuItem) => {
    setStatusMessage("");
    setCart((prev) => {
      const exists = prev.find((line) => line.id === item.id);
      if (!exists) {
        return [...prev, { ...item, quantity: 1 }];
      }
      return prev.map((line) =>
        line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
  };

  const adjustQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.id === itemId ? { ...line, quantity: Math.max(0, line.quantity + delta) } : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const clearOrder = () => {
    setCart([]);
    const reset = resetOrderValues();
    setOrderNote(reset.orderNote);
    setDiscountMode(reset.discountMode);
    setDiscountValue(reset.discountValue);
    setPaymentMethod(reset.paymentMethod);
    setCashPaid(reset.cashPaid);
    setCardPaid(reset.cardPaid);
    setStatusMessage("Order cleared.");
  };

  const sendTicket = (ticket: KitchenTicket) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingTicketsRef.current.push(ticket);
      return false;
    }
    const message: KitchenSocketMessage = { type: "NEW_ORDER", payload: ticket };
    socket.send(JSON.stringify(message));
    return true;
  };

  const sendSale = (sale: SaleRecord) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      pendingSalesRef.current.push(sale);
      return false;
    }
    const message: KitchenSocketMessage = { type: "NEW_SALE", payload: sale };
    socket.send(JSON.stringify(message));
    return true;
  };

  const useExactTotal = () => {
    const exact = total.toFixed(2);
    if (paymentMethod === "cash") {
      setCashPaid(exact);
      setCardPaid("0");
      return;
    }
    if (paymentMethod === "card") {
      setCardPaid(exact);
      setCashPaid("0");
      return;
    }
    setCashPaid("0");
    setCardPaid(exact);
  };

  const completeSale = async () => {
    if (isSubmitting) {
      return;
    }
    if (!hasCart) {
      setStatusMessage("Add at least one item before checkout.");
      return;
    }
    if (!validPayment) {
      setStatusMessage(`Payment is incomplete. Remaining balance is ${money(Math.max(0, balance))}.`);
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    let receiptNo = receiptCounter;
    let savedToDatabase = false;

    const draft: ReceiptSnapshot = {
      receiptNo,
      createdAt: now.toLocaleString("en-US"),
      lines: cart,
      subtotal,
      discount: discountAmount,
      tax: taxAmount,
      total,
      paymentMethod,
      paid: paidAmount,
      change: changeDue,
      orderNote,
    };

    try {
      let remaining = total;
      const payments: Array<{ method: "cash" | "card"; amount: number }> = [];
      const cashAmount = Math.max(0, toNumber(cashPaid));
      const cardAmount = Math.max(0, toNumber(cardPaid));

      if (paymentMethod === "cash" || paymentMethod === "split") {
        const appliedCash = Math.min(remaining, cashAmount);
        if (appliedCash > 0) {
          payments.push({ method: "cash", amount: appliedCash });
          remaining -= appliedCash;
        }
      }
      if (paymentMethod === "card" || paymentMethod === "split") {
        const appliedCard = Math.min(remaining, cardAmount);
        if (appliedCard > 0) {
          payments.push({ method: "card", amount: appliedCard });
          remaining -= appliedCard;
        }
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          waiterName,
          notes: orderNote,
          discountMode,
          discountValue: toNumber(discountValue),
          items: cart.map((line) => ({
            productId: line.id,
            quantity: line.quantity,
          })),
          payments,
        }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { orderNumber?: number };
        if (typeof payload.orderNumber === "number") {
          receiptNo = payload.orderNumber;
        }
        savedToDatabase = true;
      }
    } catch {
      savedToDatabase = false;
    }

    const finalReceipt: ReceiptSnapshot = { ...draft, receiptNo };
    const kitchenTicket: KitchenTicket = {
      id: `ticket-${receiptNo}-${now.getTime()}`,
      receiptNo,
      createdAt: now.toISOString(),
      note: finalReceipt.orderNote.trim() ? finalReceipt.orderNote.trim() : null,
      status: "new",
      items: finalReceipt.lines.map((line) => ({
        id: line.id,
        name: line.name,
        quantity: line.quantity,
      })),
    };
    const sale: SaleRecord = {
      id: `sale-${receiptNo}-${now.getTime()}`,
      receiptNo,
      waiterName: waiterName.trim() || "Unknown Waiter",
      total: Number(finalReceipt.total.toFixed(2)),
      createdAt: now.toISOString(),
    };

    const sentKitchen = sendTicket(kitchenTicket);
    const sentAdmin = sendSale(sale);

    setLastReceipt(finalReceipt);
    setReceiptCounter((prev) => Math.max(prev + 1, receiptNo + 1));
    setCart([]);
    const reset = resetOrderValues();
    setOrderNote(reset.orderNote);
    setDiscountMode(reset.discountMode);
    setDiscountValue(reset.discountValue);
    setPaymentMethod(reset.paymentMethod);
    setCashPaid(reset.cashPaid);
    setCardPaid(reset.cardPaid);
    setIsSubmitting(false);

    if (savedToDatabase && sentKitchen && sentAdmin) {
      setStatusMessage(`Receipt #${receiptNo} completed and synced.`);
    } else if (!savedToDatabase) {
      setStatusMessage(`Receipt #${receiptNo} sent live, but database save failed.`);
    } else {
      setStatusMessage(`Receipt #${receiptNo} completed. Socket offline, queued for sync.`);
    }
  };

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-blue-100 px-4 py-6 text-slate-900 md:px-6"
      style={{ fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif' }}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-blue-200/30">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#4F7CFF] px-4 py-3 text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Waiter Console</p>
              <h1 className="text-xl font-bold md:text-2xl">MAASH ALLAH CAFE</h1>
            </div>
            <div className="text-right text-sm">
              <label className="mb-1 block text-xs text-blue-100">Waiter Name</label>
              <input
                value={waiterName}
                onChange={(event) => setWaiterName(event.target.value)}
                className="h-9 w-36 rounded-md border border-blue-300/60 bg-white/20 px-2 text-right text-sm font-semibold text-white outline-none placeholder:text-blue-100"
                placeholder="Waiter-1"
              />
              <p className="text-blue-100">{new Date().toLocaleTimeString("en-US")}</p>
            </div>
          </header>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-700">Quick Items</p>
            <div className="flex flex-wrap gap-2">
              {quickItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="min-h-11 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-blue-100 transition hover:-translate-y-0.5 hover:bg-blue-100"
                >
                  {item.name} | {money(item.price)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  selectedCategory === category
                    ? "bg-[#4F7CFF] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-blue-100"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">Search item or SKU</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name/SKU"
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addToCart(item)}
                className="min-h-28 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#4F7CFF]"
              >
                <p className="text-sm font-bold text-slate-800">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.sku || "NO-SKU"}</p>
                <p className="mt-2 text-sm font-extrabold text-[#2E7D32]">{money(item.price)}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl shadow-slate-300/40">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Current Order</h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                socketStatus === "connected"
                  ? "bg-green-100 text-green-700"
                  : socketStatus === "connecting"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {socketStatus}
            </span>
          </div>
          <p className="text-xs text-slate-500">Socket URL: {socketUrl}</p>

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-500">No items yet.</p>
            ) : (
              cart.map((line) => (
                <div key={line.id} className="rounded-lg border border-slate-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{line.name}</p>
                      <p className="text-xs text-slate-500">{line.sku || "NO-SKU"}</p>
                    </div>
                    <p className="text-sm font-bold text-[#2E7D32]">{money(line.price * line.quantity)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(line.id, -1)}
                      className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
                    >
                      -
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => adjustQuantity(line.id, 1)}
                      className="min-h-9 min-w-9 rounded-md bg-slate-100 px-2 text-sm font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-600">Order notes</span>
            <textarea
              value={orderNote}
              onChange={(event) => setOrderNote(event.target.value)}
              placeholder="No onions, extra hot..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-[#4F7CFF] focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <div className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-700">Discount</p>
            <div className="grid grid-cols-3 gap-2">
              {(["none", "percent", "fixed"] as DiscountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDiscountMode(mode)}
                  className={`min-h-10 rounded-md font-semibold ${
                    discountMode === mode ? "bg-[#4F7CFF] text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {mode === "none" ? "None" : mode === "percent" ? "%" : "Fixed"}
                </button>
              ))}
            </div>
            <input
              disabled={discountMode === "none"}
              value={discountValue}
              onChange={(event) => setDiscountValue(event.target.value)}
              placeholder={discountMode === "percent" ? "10 for 10%" : "2.50"}
              className="h-10 rounded-md border border-slate-300 px-2 outline-none disabled:opacity-40"
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="mb-2 font-semibold text-slate-700">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "card", "split"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`min-h-10 rounded-md text-sm font-semibold uppercase ${
                    paymentMethod === method ? "bg-[#4F7CFF] text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            {(paymentMethod === "cash" || paymentMethod === "split") && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Cash Received</span>
                <input
                  value={cashPaid}
                  onChange={(event) => setCashPaid(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-2 outline-none"
                />
              </label>
            )}
            {(paymentMethod === "card" || paymentMethod === "split") && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Card Amount</span>
                <input
                  value={cardPaid}
                  onChange={(event) => setCardPaid(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-2 outline-none"
                />
              </label>
            )}
            <button
              type="button"
              onClick={useExactTotal}
              className="mt-2 min-h-10 w-full rounded-md bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-700"
            >
              Use Exact Total
            </button>
          </div>

          <div className="space-y-1 rounded-xl bg-slate-900 p-3 text-sm text-slate-100">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="flex justify-between text-orange-300">
              <span>Discount</span>
              <span>-{money(discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({taxRate.toFixed(2)}%)</span>
              <span>{money(taxAmount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            <div className={`flex justify-between ${balance > 0 ? "text-red-300" : "text-green-300"}`}>
              <span>{balance > 0 ? "Remaining" : "Change"}</span>
              <span>{money(Math.abs(balance))}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={clearOrder}
              className="min-h-11 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void completeSale()}
              disabled={!hasCart || isSubmitting}
              className="min-h-11 rounded-lg bg-[#2E7D32] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Processing..." : "Complete Sale"}
            </button>
          </div>

          {statusMessage && (
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{statusMessage}</p>
          )}

          {lastReceipt && (
            <article className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="text-sm font-bold">Receipt #{lastReceipt.receiptNo}</p>
              <p className="mb-2 text-slate-500">{lastReceipt.createdAt}</p>
              <div className="space-y-1">
                {lastReceipt.lines.map((line) => (
                  <div key={line.id} className="flex justify-between">
                    <span>{line.quantity}x {line.name}</span>
                    <span>{money(line.price * line.quantity)}</span>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
