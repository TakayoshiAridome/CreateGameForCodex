import type { Point } from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function facingAngle(from: Point, to: Point) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 0.001) return 0;
  return Math.atan2(dx, dy);
}

function faceToward(unit: Point & { facing?: number }, point: Point) {
  unit.facing = facingAngle(unit, point);
}

function moveToward(unit: Point & { speed: number; facing?: number }, point: Point, dt: number, multiplier = 1, speedOverride?: number) {
  const dx = point.x - unit.x;
  const dy = point.y - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return 0;
  faceToward(unit, point);
  const step = Math.min(d, (speedOverride ?? unit.speed) * multiplier * dt);
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
  const animatedUnit = unit as Point & { moving?: boolean; runTime?: number };
  if ("moving" in animatedUnit) {
    animatedUnit.moving = true;
    animatedUnit.runTime = (animatedUnit.runTime ?? 0) + step * 0.055;
  }
  return step;
}

export { clamp, distance, faceToward, facingAngle, moveToward };
