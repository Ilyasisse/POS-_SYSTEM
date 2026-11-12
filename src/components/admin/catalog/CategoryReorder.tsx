"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { reorderIds, type CatalogData } from "@/lib/catalog/catalog";
import { saveCategoryOrder } from "@/app/admin/(catalog)/actions";

export default function CategoryReorder({
  data,
  onClose,
}: {
  data: CatalogData;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(data.ordering.map((row) => row.id));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const dragged = useRef<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const names = new Map(data.categories.map((row) => [row.id, row.name]));
  const changed = ids.some((id, index) => id !== data.ordering[index]?.id);
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) {
      if (changed || pending) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [changed, pending]);
  function close() {
    if (
      !pending &&
      (!changed || window.confirm("Discard the unsaved category order?"))
    )
      onClose();
  }
  function move(id: string, target: string) {
    setIds((current) => reorderIds(current, id, target));
    setMessage("");
  }
  function save() {
    startTransition(async () => {
      try {
        const result = await saveCategoryOrder({
          ids,
          expected: data.ordering,
        });
        toast({
          tone: result.ok ? "success" : "error",
          description: result.message,
          ...(!result.ok
            ? {
                action: {
                  label: "Reload order",
                  onClick: () => {
                    onClose();
                    router.refresh();
                  },
                },
              }
            : {}),
        });
        if (result.ok) {
          onClose();
          router.refresh();
        } else setMessage(result.message);
      } catch {
        const error =
          "Could not save the order. Check your connection and try again.";
        setMessage(error);
        toast({ tone: "error", description: error });
      }
    });
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90dvh] flex-col sm:max-w-xl"
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          close();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <DialogTitle className="text-lg">Reorder categories</DialogTitle>
        <DialogDescription>
          Arrange the whole menu, including categories outside the current
          filters. Use arrows or drag a desktop handle. Changes appear to
          customers after saving.
        </DialogDescription>
        <ol
          className="min-h-0 space-y-2 overflow-y-auto py-2"
          aria-label="Category ordering"
        >
          {ids.map((id, index) => (
            <li
              key={id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const source = dragged.current;
                if (source && !pending) move(source, id);
                dragged.current = null;
              }}
              className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2"
            >
              <button
                type="button"
                draggable={!pending}
                disabled={pending}
                aria-label={`Drag ${names.get(id) ?? "category"}`}
                className="hidden size-11 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:flex"
                onDragStart={(event) => {
                  dragged.current = id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", id);
                }}
                onDragEnd={() => {
                  dragged.current = null;
                }}
              >
                <GripVertical className="size-5" aria-hidden="true" />
              </button>
              <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 break-words text-sm font-semibold">
                {names.get(id) ?? "Category"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                disabled={pending || index === 0}
                aria-label={`Move ${names.get(id)} up`}
                onClick={() => move(id, ids[index - 1])}
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                disabled={pending || index === ids.length - 1}
                aria-label={`Move ${names.get(id)} down`}
                onClick={() => move(id, ids[index + 1])}
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || !changed}
            onClick={save}
          >
            {pending ? "Saving…" : "Save order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
