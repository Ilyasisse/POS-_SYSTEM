"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useClientResource } from "@/hooks/useClientResource";
type Availability = "AVAILABLE" | "BUSY" | "AWAY" | "OFFLINE";
async function loadAvailability(signal: AbortSignal) {
  const response = await fetch("/api/staff/presence", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Could not load cashier status.");
  return response.json() as Promise<{ availability: Availability }>;
}

export default function CashierAvailability() {
  const [status, setStatus] = useState<Availability>("OFFLINE");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const heartbeat = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    await fetch("/api/staff/presence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
  }, []);
  const [edited, setEdited] = useState(false);
  useClientResource({
    load: loadAvailability,
    enabled: !edited,
    onData(data) {
      setStatus(data.availability);
    },
    onError(error) {
      toast({ tone: "error", description: error instanceof Error ? error.message : "Could not load cashier status." });
    },
  });
  useEffect(() => {
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    window.addEventListener("focus", heartbeat);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", heartbeat);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [heartbeat]);
  async function change(value: Availability) {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: value }),
      });
      if (!response.ok) throw new Error("Could not save status. Try again.");
      setEdited(true);
      setStatus(value);
      toast({ tone: "success", description: "Cashier status updated." });
    } catch (error) {
      toast({
        tone: "error",
        description:
          error instanceof Error ? error.message : "Could not save status.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <label className="text-xs">
      My status
      <select
        aria-label="Cashier availability"
        disabled={busy}
        value={status}
        onChange={(event) => void change(event.target.value as Availability)}
        className="ml-2 rounded-lg border bg-background p-2"
      >
        <option value="AVAILABLE">Available</option>
        <option value="BUSY">Busy</option>
        <option value="AWAY">Away</option>
        <option value="OFFLINE">Offline</option>
      </select>
    </label>
  );
}
