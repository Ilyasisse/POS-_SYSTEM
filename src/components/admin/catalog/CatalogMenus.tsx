"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Trash2,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saleAvailable, type CatalogRecord } from "@/lib/catalog/catalog";

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(min-width: 768px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const desktopSnapshot = () => window.matchMedia("(min-width: 768px)").matches;

export default function CatalogMenus({
  row,
  product,
  onEdit,
  onStatus,
  onDelete,
  onAvailability,
}: {
  row: CatalogRecord;
  product: boolean;
  onEdit: () => void;
  onStatus: () => void;
  onDelete: () => void;
  onAvailability: () => void;
}) {
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => false);
  const [open, setOpen] = useState(false);
  const available = saleAvailable(row);
  const actions = [
    { label: "Edit", icon: Pencil, action: onEdit },
    ...(product
      ? [
          {
            label: available ? "Mark sold out" : "Resume sales",
            icon: available ? PauseCircle : PlayCircle,
            action: onAvailability,
          },
        ]
      : []),
    {
      label: product
        ? row.isActive
          ? "Hide from menu"
          : "Enable product"
        : row.isActive
          ? "Make inactive"
          : "Make active",
      icon: row.isActive ? EyeOff : Eye,
      action: onStatus,
    },
    { label: "Delete", icon: Trash2, action: onDelete },
  ];
  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 shrink-0"
      aria-label={`Actions for ${row.name}`}
    >
      <MoreHorizontal className="size-5" aria-hidden="true" />
    </Button>
  );
  function choose(action: () => void) {
    setOpen(false);
    window.setTimeout(action, 0);
  }
  if (desktop)
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map(({ label, icon: Icon, action }) => (
            <div key={label}>
              {label === "Delete" && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="min-h-11 gap-3 px-3"
                variant={label === "Delete" ? "destructive" : "default"}
                onSelect={() => choose(action)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label={`Actions for ${row.name}`}
        onClick={() => setOpen(true)}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-none data-[state=open]:animate-none">
          <DialogTitle className="pr-10 text-lg">{row.name}</DialogTitle>
          <DialogDescription>Choose an action</DialogDescription>
          <div className="space-y-2">
            {actions.map(({ label, icon: Icon, action }) => (
              <Button
                key={label}
                type="button"
                variant="ghost"
                className={`min-h-12 w-full justify-start gap-3 ${label === "Delete" ? "text-destructive" : ""}`}
                onClick={() => choose(action)}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
