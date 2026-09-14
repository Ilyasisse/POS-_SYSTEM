"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CartLine } from "@/lib/types";
import { createHeldOrderDraft, HELD_ORDER_STORAGE_KEY, MAX_HELD_ORDERS, parseHeldOrderDrafts, type HeldOrderDraft } from "@/lib/cashier/held-order-drafts";

const changedEvent = "cashier-held-orders-changed";
const serverSnapshot = () => "";
const browserSnapshot = () => {
  try {
    return window.localStorage.getItem(HELD_ORDER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
};
function subscribe(callback: () => void) {
  const listener = () => callback();
  window.addEventListener("storage", listener);
  window.addEventListener(changedEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changedEvent, listener);
  };
}
function writeDrafts(drafts: HeldOrderDraft[]) {
  window.localStorage.setItem(HELD_ORDER_STORAGE_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new Event(changedEvent));
}
export function removeHeldOrderDraft(id: string) {
  try {
    writeDrafts(parseHeldOrderDrafts(browserSnapshot()).filter((draft) => draft.id !== id));
    return true;
  } catch {
    return false;
  }
}

type Props = {
  cart: CartLine[];
  tableId: string;
  tableName: string;
  orderNote: string;
  onHeld: (label: string) => void;
  onResume: (draft: HeldOrderDraft) => void;
};

export function HeldOrderDrafts({ cart, tableId, tableName, orderNote, onHeld, onResume }: Props) {
  const raw = useSyncExternalStore(subscribe, browserSnapshot, serverSnapshot);
  const drafts = useMemo(() => parseHeldOrderDrafts(raw), [raw]);
  const [label, setLabel] = useState("");
  const [storageError, setStorageError] = useState("");
  const [open, setOpen] = useState(false);
  const canHold = cart.length > 0 && Boolean(tableId) && label.trim().length > 0 && drafts.length < MAX_HELD_ORDERS;

  function hold() {
    if (!canHold) return;
    try {
      const draft = createHeldOrderDraft({
        id: crypto.randomUUID(), label, tableId, tableName, orderNote,
        savedAt: new Date().toISOString(), cart,
      });
      writeDrafts([draft, ...drafts]);
      onHeld(draft.label);
      setLabel("");
      setStorageError("");
      setOpen(false);
    } catch {
      setStorageError("This device could not save the held order. Keep this order open and try again.");
    }
  }

  return (
    <section className="mt-3 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-amber-200/70 bg-card/90 p-3">
      <p className="mr-auto text-sm text-muted-foreground">{drafts.length} held order{drafts.length === 1 ? "" : "s"} on this device</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button type="button" variant="outline">Hold or reopen</Button></DialogTrigger>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Held orders</DialogTitle><DialogDescription>Saved only on this device. Holding does not reserve a table or send items to the kitchen.</DialogDescription></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input value={label} maxLength={80} onChange={(event) => setLabel(event.target.value)} placeholder="Customer name or reminder" aria-label="Held order name" />
            <Button type="button" onClick={hold} disabled={!canHold}>Hold current order</Button>
          </div>
          {drafts.length >= MAX_HELD_ORDERS ? <p className="text-sm text-amber-700">Remove or finish a held order before saving another.</p> : null}
          {storageError ? <p role="alert" className="text-sm text-red-700">{storageError}</p> : null}
          <div className="space-y-2">
            {drafts.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm">No held orders on this device.</p> : drafts.map((draft) => (
              <article key={draft.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{draft.label}</p><p className="text-sm text-muted-foreground">{draft.tableName} · {draft.items.reduce((sum, item) => sum + item.quantity, 0)} items · {new Date(draft.savedAt).toLocaleString("en-US", { timeZone: "Africa/Nairobi" })}</p></div>
                  <div className="flex gap-2"><Button type="button" size="sm" disabled={cart.length > 0} title={cart.length > 0 ? "Hold or clear the current order first" : undefined} onClick={() => { onResume(draft); setOpen(false); }}>Reopen</Button><Button type="button" size="sm" variant="outline" onClick={() => removeHeldOrderDraft(draft.id)}>Remove</Button></div>
                </div>
              </article>
            ))}
          </div>
          {cart.length > 0 && drafts.length > 0 ? <p className="text-xs text-muted-foreground">Hold or clear the current order before reopening another one.</p> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
