"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { setProductAvailability } from "./actions";

export default function ProductAvailabilityControl({
  productId,
  productName,
  unavailable,
}: {
  productId: string;
  productName: string;
  unavailable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try {
        await setProductAvailability(data);
        setOpen(false);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update availability.");
      }
    });
  }

  if (unavailable) {
    return (
      <form action={setProductAvailability}>
        <input type="hidden" name="id" value={productId} />
        <input type="hidden" name="mode" value="AVAILABLE" />
        <Button type="submit" size="sm" variant="outline">Restock</Button>
      </form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">Mark sold out</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Pause {productName}?</DialogTitle>
            <DialogDescription>
              The item disappears from ordering screens immediately. Timed pauses
              restore automatically.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={productId} />
          <input type="hidden" name="mode" value="UNAVAILABLE" />
          <div className="space-y-2">
            <Label htmlFor={`duration-${productId}`}>Restock after</Label>
            <NativeSelect id={`duration-${productId}`} name="durationMinutes" defaultValue="180">
              <option value="60">1 hour</option>
              <option value="180">3 hours</option>
              <option value="720">12 hours</option>
              <option value="1440">24 hours</option>
              <option value="">Until manually restocked</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`reason-${productId}`}>Reason</Label>
            <Textarea id={`reason-${productId}`} name="reason" minLength={3} maxLength={200} placeholder="Example: chicken delivery is delayed" required />
          </div>
          {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Pausing..." : "Mark sold out"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
