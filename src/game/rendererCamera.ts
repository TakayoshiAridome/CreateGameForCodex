import * as THREE from "three";
import { clamp, playableBottom, playableWidth, type GameState, type Point } from "./core";

export const WORLD_SCALE = 74;

export function toWorld(point: Point, state: GameState) {
  const center = cameraCenterForState(state);
  return new THREE.Vector3((point.x - center.x) / WORLD_SCALE, 0, (point.y - center.y) / WORLD_SCALE);
}

export function cameraCenterForState(state: GameState) {
  const selectedHero = state.heroes[state.selected];
  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  const heroes = aliveHeroes.length > 0 ? aliveHeroes : state.heroes;
  const anchor =
    selectedHero && selectedHero.hp > 0
      ? selectedHero
      : heroes.reduce(
          (center, hero) => ({ x: center.x + hero.x / heroes.length, y: center.y + hero.y / heroes.length }),
          { x: 0, y: 0 }
        );
  const halfW = state.view.w / 2;
  const halfH = state.view.h / 2;
  return {
    x: clamp(anchor.x, halfW, Math.max(halfW, playableWidth(state) - halfW)),
    y: clamp(anchor.y, halfH, Math.max(halfH, playableAreaDepth(state) - halfH))
  };
}

function playableAreaDepth(state: GameState) {
  return playableBottom(state);
}

export function areaBaseCenter(state: GameState) {
  return { x: playableWidth(state) / 2, y: playableAreaDepth(state) / 2 };
}

export function areaLocal(point: Point, state: GameState) {
  const center = areaBaseCenter(state);
  return new THREE.Vector3((point.x - center.x) / WORLD_SCALE, 0, (point.y - center.y) / WORLD_SCALE);
}
