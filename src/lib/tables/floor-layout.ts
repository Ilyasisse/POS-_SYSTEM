export type FloorPosition = { x: number; y: number };

export function validFloorPosition(position: FloorPosition) {
  return (
    Number.isInteger(position.x) &&
    Number.isInteger(position.y) &&
    position.x >= 5 &&
    position.x <= 95 &&
    position.y >= 5 &&
    position.y <= 95
  );
}

export function clampFloorPosition(x: number, y: number): FloorPosition {
  return {
    x: Math.max(5, Math.min(95, Math.round(x))),
    y: Math.max(5, Math.min(95, Math.round(y))),
  };
}

export function defaultFloorPosition(
  index: number,
  total: number,
): FloorPosition {
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt((Math.max(total, 1) * 4) / 3)),
  );
  const rows = Math.max(1, Math.ceil(total / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: Math.round(10 + ((column + 0.5) * 80) / columns),
    y: Math.round(10 + ((row + 0.5) * 80) / rows),
  };
}
