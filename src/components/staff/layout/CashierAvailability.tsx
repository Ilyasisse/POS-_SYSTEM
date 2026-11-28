"use client";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
type Availability = "AVAILABLE" | "BUSY" | "AWAY" | "OFFLINE";
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
  useEffect(() => {
    let active = true;
    void fetch("/api/staff/presence", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load cashier status.");
        return response.json() as Promise<{ availability: Availability }>;
      })
      .then((data) => {
        if (active) setStatus(data.availability);
      })
      .catch((error) => {
        if (active) toast({ tone: "error", description: error.message });
      });
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    window.addEventListener("focus", heartbeat);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", heartbeat);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, [heartbeat, toast]);
  async function change(value: Availability) {
    setBusy(true);
    try {
      const response = await fetch("/api/staff/presence", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: value }),
      });
      if (!response.ok) throw new Error("Could not save status. Try again.");
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
