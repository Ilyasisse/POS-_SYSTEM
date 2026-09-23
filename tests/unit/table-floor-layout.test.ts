import assert from "node:assert/strict";
import test from "node:test";
import {
  clampFloorPosition,
  defaultFloorPosition,
  validFloorPosition,
} from "../../src/lib/tables/floor-layout";

test("positions spread across the canvas and remain inside the safe area", () => {
  const positions = Array.from({ length: 12 }, (_, index) =>
    defaultFloorPosition(index, 12),
  );
  assert.equal(
    positions.length,
    new Set(positions.map((point) => `${point.x}:${point.y}`)).size,
  );
  assert.ok(positions.every(validFloorPosition));
});

test("dragging and keyboard moves stay inside the floor", () => {
  assert.deepEqual(clampFloorPosition(-50, 121.9), { x: 5, y: 95 });
  assert.deepEqual(clampFloorPosition(18.6, 42.4), { x: 19, y: 42 });
  assert.equal(validFloorPosition({ x: 96, y: 42 }), false);
  assert.equal(validFloorPosition({ x: NaN, y: 42 }), false);
});
