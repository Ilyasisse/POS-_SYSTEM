"use client";

import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { Card } from "@/components/admin/shared";
import { useToast } from "@/components/ui/toast";
import {
  clampFloorPosition,
  defaultFloorPosition,
  type FloorPosition,
} from "@/lib/tables/floor-layout";
import { moveTableOnFloorAction } from "./actions";

type FloorTable = {
  id: string;
  name: string;
  isActive: boolean;
  occupied: boolean;
  floorX: number | null;
  floorY: number | null;
};
type Drag = {
  id: string;
  pointerId: number;
  clientX: number;
  clientY: number;
  from: FloorPosition;
};

export default function TableFloorPlan({ tables }: { tables: FloorTable[] }) {
  const { toast } = useToast();
  const initial = Object.fromEntries(
    tables.map((table, index) => [
      table.id,
      table.floorX != null && table.floorY != null
        ? { x: table.floorX, y: table.floorY }
        : defaultFloorPosition(index, tables.length),
    ]),
  );
  const [positions, setPositions] =
    useState<Record<string, FloorPosition>>(initial);
  const persisted = useRef<Record<string, FloorPosition | null>>(
    Object.fromEntries(
      tables.map((table) => [
        table.id,
        table.floorX != null && table.floorY != null
          ? { x: table.floorX, y: table.floorY }
          : null,
      ]),
    ),
  );
  const pending = useRef(new Set<string>());
  const drag = useRef<Drag | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  async function save(
    id: string,
    position: FloorPosition,
    fallback: FloorPosition,
  ) {
    if (pending.current.has(id)) return;
    pending.current.add(id);
    const expected = persisted.current[id];
    setPositions((current) => ({ ...current, [id]: position }));
    try {
      const result = await moveTableOnFloorAction({
        id,
        x: position.x,
        y: position.y,
        expectedX: expected?.x ?? null,
        expectedY: expected?.y ?? null,
      });
      if (!result.ok) {
        setPositions((current) => ({ ...current, [id]: fallback }));
        toast({
          tone: "warning",
          description: result.message,
          action: { label: "Refresh", onClick: () => window.location.reload() },
        });
      } else {
        persisted.current[id] = position;
        toast({ tone: "success", description: "Table position saved." });
      }
    } catch {
      setPositions((current) => ({ ...current, [id]: fallback }));
      toast({
        tone: "error",
        description: "Could not save the table position. Try again.",
      });
    } finally {
      pending.current.delete(id);
    }
  }

  function positionAt(event: PointerEvent<HTMLButtonElement>, active: Drag) {
    const box = canvas.current?.getBoundingClientRect();
    if (!box || box.width <= 0 || box.height <= 0) return active.from;
    return clampFloorPosition(
      active.from.x + ((event.clientX - active.clientX) * 100) / box.width,
      active.from.y + ((event.clientY - active.clientY) * 100) / box.height,
    );
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (pending.current.has(id)) return;
    drag.current = {
      id,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      from: positions[id],
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const next = positionAt(event, active);
    setPositions((current) => ({ ...current, [active.id]: next }));
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    const next = positionAt(event, active);
    if (next.x !== active.from.x || next.y !== active.from.y)
      void save(active.id, next, active.from);
  }

  function onPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    setPositions((current) => ({ ...current, [active.id]: active.from }));
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const offsets: Record<string, FloorPosition> = {
      ArrowUp: { x: 0, y: -5 },
      ArrowDown: { x: 0, y: 5 },
      ArrowLeft: { x: -5, y: 0 },
      ArrowRight: { x: 5, y: 0 },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const from = positions[id];
    const next = clampFloorPosition(from.x + offset.x, from.y + offset.y);
    if (next.x !== from.x || next.y !== from.y) void save(id, next, from);
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-black">Floor plan</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Drag tables to their real positions, or focus a table and use the arrow
        keys. Changes save immediately.
      </p>
      <div
        ref={canvas}
        className="relative mt-5 aspect-[4/3] min-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      >
        {tables.map((table) => {
          const position = positions[table.id];
          return (
            <button
              key={table.id}
              type="button"
              aria-label={`Move ${table.name}; ${!table.isActive ? "hidden" : table.occupied ? "occupied" : "available"}`}
              title={`${table.name}: drag or use arrow keys`}
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                touchAction: "none",
              }}
              className={`absolute grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-lg px-1 text-xs font-bold text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${!table.isActive ? "bg-slate-500" : table.occupied ? "bg-red-600" : "bg-emerald-600"}`}
              onPointerDown={(event) => onPointerDown(event, table.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onKeyDown={(event) => onKeyDown(event, table.id)}
            >
              {table.name}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
        <span>Green: available</span>
        <span>Red: occupied</span>
        <span>Gray: hidden</span>
      </div>
    </Card>
  );
}
