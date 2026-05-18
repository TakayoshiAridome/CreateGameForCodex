import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Point = { x: number; y: number };
type Weapon = "sword" | "rifle" | "staff" | "scout";
type SkillKey = "e" | "r" | "t" | "y";

type Skill = {
  key: SkillKey;
  id: string;
  name: string;
  cost: number;
  cooldown: number;
};

type EquipmentSlot = "weapon" | "armor" | "trinket";

type EquipmentBonus = {
  attack?: number;
  maxHp?: number;
  maxMp?: number;
  range?: number;
  speed?: number;
};

type Equipment = {
  slot: EquipmentSlot;
  name: string;
  level: number;
  bonus: EquipmentBonus;
};

type Hero = Point & {
  name: string;
  role: string;
  color: string;
  trim: string;
  hair: string;
  accent: string;
  weapon: Weapon;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  range: number;
  speed: number;
  attack: number;
  cooldown: number;
  skills: Skill[];
  skillCooldowns: Record<SkillKey, number>;
  equipment: Record<EquipmentSlot, Equipment>;
};

type Enemy = Point & {
  type: "corsair" | "duelist" | "boss";
  hp: number;
  maxHp: number;
  speed: number;
  attack: number;
  cooldown: number;
  radius: number;
};

type Particle = Point & {
  text: string;
  color: string;
  life: number;
};

type Formation = {
  name: string;
  slots: Point[];
};

type ThreeView = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  field: THREE.Group;
  units: THREE.Group;
  effects: THREE.Group;
};

type GameState = {
  view: { w: number; h: number };
  selected: number;
  paused: boolean;
  formation: number;
  score: number;
  last: number;
  spawnTimer: number;
  bossTimer: number;
  bossCount: number;
  targetPoint: Point | null;
  movement: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  orderPulse: number;
  heroes: Hero[];
  enemies: Enemy[];
  particles: Particle[];
  logs: string[];
  status: string;
};

type HudState = Pick<GameState, "selected" | "paused" | "formation" | "score" | "bossCount" | "heroes" | "logs" | "status">;

const formations: Formation[] = [
  { name: "デルタ", slots: [{ x: -62, y: -46 }, { x: -78, y: 42 }, { x: 18, y: 0 }, { x: -142, y: 0 }] },
  { name: "ライン", slots: [{ x: -108, y: 0 }, { x: -36, y: -58 }, { x: -36, y: 58 }, { x: 34, y: 0 }] },
  { name: "ヴァンガード", slots: [{ x: -44, y: -62 }, { x: -44, y: 62 }, { x: 42, y: 0 }, { x: -126, y: 0 }] },
  { name: "ファランクス", slots: [{ x: -96, y: -38 }, { x: -96, y: 38 }, { x: -22, y: -38 }, { x: -22, y: 38 }] },
  { name: "スカーミッシュ", slots: [{ x: -128, y: -72 }, { x: -128, y: 72 }, { x: 8, y: -44 }, { x: 8, y: 44 }] },
  { name: "ピアース", slots: [{ x: 34, y: 0 }, { x: -42, y: -52 }, { x: -92, y: 52 }, { x: -144, y: 0 }] },
  { name: "リトリート", slots: [{ x: -34, y: -22 }, { x: -112, y: -78 }, { x: -112, y: 78 }, { x: -176, y: 0 }] }
];

const skillKeys: SkillKey[] = ["e", "r", "t", "y"];

const emptySkillCooldowns = (): Record<SkillKey, number> => ({
  e: 0,
  r: 0,
  t: 0,
  y: 0
});

const createEquipment = (
  weaponName: string,
  armorName: string,
  trinketName: string,
  weaponBonus: EquipmentBonus,
  armorBonus: EquipmentBonus,
  trinketBonus: EquipmentBonus
): Record<EquipmentSlot, Equipment> => ({
  weapon: { slot: "weapon", name: weaponName, level: 1, bonus: weaponBonus },
  armor: { slot: "armor", name: armorName, level: 1, bonus: armorBonus },
  trinket: { slot: "trinket", name: trinketName, level: 1, bonus: trinketBonus }
});

const initialHeroes: Hero[] = [
  {
    name: "アデリア",
    role: "Fencer",
    color: "#314f8f",
    trim: "#f2c772",
    hair: "#5b3027",
    accent: "#efe4d0",
    weapon: "sword",
    x: 420,
    y: 292,
    hp: 168,
    maxHp: 168,
    mp: 58,
    maxMp: 82,
    range: 48,
    speed: 174,
    attack: 24,
    cooldown: 0,
    skills: [
      { key: "e", id: "blade-lunge", name: "グランディア", cost: 30, cooldown: 4.2 },
      { key: "r", id: "blade-cleave", name: "クロスエッジ", cost: 34, cooldown: 5.2 },
      { key: "t", id: "blade-guard", name: "ロイヤルガード", cost: 24, cooldown: 7 },
      { key: "y", id: "blade-rally", name: "家門号令", cost: 42, cooldown: 9 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "開拓長剣",
      "決闘礼装",
      "金翼の徽章",
      { attack: 6 },
      { maxHp: 28, speed: 5 },
      { maxMp: 8, attack: 2 }
    )
  },
  {
    name: "セリオ",
    role: "Musketeer",
    color: "#56636f",
    trim: "#ffd87b",
    hair: "#d7d0c5",
    accent: "#8f3143",
    weapon: "rifle",
    x: 350,
    y: 352,
    hp: 126,
    maxHp: 126,
    mp: 72,
    maxMp: 94,
    range: 255,
    speed: 142,
    attack: 21,
    cooldown: 0,
    skills: [
      { key: "e", id: "rifle-shot", name: "集中射撃", cost: 28, cooldown: 3.8 },
      { key: "r", id: "rifle-grenade", name: "榴弾射撃", cost: 36, cooldown: 5.8 },
      { key: "t", id: "rifle-smoke", name: "煙幕展開", cost: 28, cooldown: 7 },
      { key: "y", id: "rifle-volley", name: "一斉掃射", cost: 48, cooldown: 10 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "精密マスケット",
      "射手の外套",
      "測距器",
      { attack: 5, range: 24 },
      { maxHp: 22 },
      { range: 18, maxMp: 8 }
    )
  },
  {
    name: "ミレーヌ",
    role: "Elementalist",
    color: "#7f4168",
    trim: "#86d8e5",
    hair: "#f1c16e",
    accent: "#fff0d5",
    weapon: "staff",
    x: 372,
    y: 252,
    hp: 112,
    maxHp: 112,
    mp: 100,
    maxMp: 124,
    range: 182,
    speed: 130,
    attack: 17,
    cooldown: 0,
    skills: [
      { key: "e", id: "staff-heal", name: "レメディ", cost: 32, cooldown: 4.2 },
      { key: "r", id: "staff-flare", name: "フレアリング", cost: 38, cooldown: 5.6 },
      { key: "t", id: "staff-mana", name: "マナタイド", cost: 26, cooldown: 7.2 },
      { key: "y", id: "staff-starfall", name: "星落とし", cost: 54, cooldown: 11 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "星詠みの杖",
      "賢者のローブ",
      "蒼晶の指輪",
      { attack: 4, maxMp: 14 },
      { maxHp: 24, maxMp: 10 },
      { maxMp: 18, speed: 4 }
    )
  },
  {
    name: "イリス",
    role: "Scout",
    color: "#3c7f63",
    trim: "#b7f0cf",
    hair: "#334039",
    accent: "#f4f0dc",
    weapon: "scout",
    x: 304,
    y: 292,
    hp: 104,
    maxHp: 104,
    mp: 112,
    maxMp: 136,
    range: 138,
    speed: 176,
    attack: 12,
    cooldown: 0,
    skills: [
      { key: "e", id: "scout-firstaid", name: "ファーストエイド", cost: 30, cooldown: 3.8 },
      { key: "r", id: "scout-regeneration", name: "リジェネレート", cost: 34, cooldown: 6 },
      { key: "t", id: "scout-haste", name: "ヘイストオーダー", cost: 32, cooldown: 7.5 },
      { key: "y", id: "scout-sanctuary", name: "サンクチュアリ", cost: 58, cooldown: 12 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "救護短剣",
      "偵察医のコート",
      "生命のチャーム",
      { attack: 3, speed: 8 },
      { maxHp: 26, maxMp: 10 },
      { maxMp: 20, speed: 6 }
    )
  }
];

function createGameState(): GameState {
  return {
    view: { w: 1280, h: 720 },
    selected: 0,
    paused: false,
    formation: 0,
    score: 0,
    last: performance.now(),
    spawnTimer: 1.1,
    bossTimer: 28,
    bossCount: 0,
    targetPoint: null,
    movement: {
      up: false,
      down: false,
      left: false,
      right: false
    },
    orderPulse: 0,
    heroes: structuredClone(initialHeroes),
    enemies: [],
    particles: [],
    logs: ["アルカディア開拓団、出撃。"],
    status: "クリックで移動、1-3で家門メンバーを選択。三人を同時に動かして、迫る敵を迎撃してください。"
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function equipmentBonus(hero: Hero): Required<EquipmentBonus> {
  const total = { attack: 0, maxHp: 0, maxMp: 0, range: 0, speed: 0 };
  for (const item of Object.values(hero.equipment)) {
    const scale = item.level;
    total.attack += (item.bonus.attack ?? 0) * scale;
    total.maxHp += (item.bonus.maxHp ?? 0) * scale;
    total.maxMp += (item.bonus.maxMp ?? 0) * scale;
    total.range += (item.bonus.range ?? 0) * scale;
    total.speed += (item.bonus.speed ?? 0) * scale;
  }
  return total;
}

function heroStats(hero: Hero) {
  const bonus = equipmentBonus(hero);
  return {
    attack: hero.attack + bonus.attack,
    maxHp: hero.maxHp + bonus.maxHp,
    maxMp: hero.maxMp + bonus.maxMp,
    range: hero.range + bonus.range,
    speed: hero.speed + bonus.speed
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function combatBottom(state: GameState) {
  return state.view.h - (state.view.w < 700 ? 285 : 118);
}

function addLog(state: GameState, text: string) {
  state.logs = [text, ...state.logs].slice(0, 8);
}

function nearestEnemy(state: GameState, hero: Hero) {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    const d = distance(hero, enemy);
    if (d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }
  return best;
}

function moveToward(unit: Point & { speed: number }, point: Point, dt: number, multiplier = 1, speedOverride?: number) {
  const dx = point.x - unit.x;
  const dy = point.y - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return;
  const step = Math.min(d, (speedOverride ?? unit.speed) * multiplier * dt);
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
}

function damage(state: GameState, target: Enemy | Hero, amount: number, color = "#ffd47d") {
  target.hp -= amount;
  state.particles.push({
    x: target.x,
    y: target.y - 20,
    text: Math.round(amount).toString(),
    color,
    life: 0.85
  });
}

function randomSpawnPoint(state: GameState) {
  let point = { x: 180, y: 160 };
  for (let i = 0; i < 12; i += 1) {
    point = {
      x: 150 + Math.random() * Math.max(180, state.view.w - 330),
      y: 128 + Math.random() * Math.max(110, combatBottom(state) - 168)
    };
    if (state.heroes.every((hero) => hero.hp <= 0 || distance(hero, point) > 180)) return point;
  }
  return point;
}

function spawnEnemy(state: GameState, boss = false) {
  const point = randomSpawnPoint(state);
  const elite = !boss && Math.random() < 0.18 + Math.min(0.18, state.score / 5000);
  const pressure = 1 + Math.min(1.6, state.score / 2200);
  state.enemies.push({
    type: boss ? "boss" : elite ? "duelist" : "corsair",
    x: point.x,
    y: point.y,
    hp: boss ? 420 + state.bossCount * 120 : elite ? 88 * pressure : 48 * pressure,
    maxHp: boss ? 420 + state.bossCount * 120 : elite ? 88 * pressure : 48 * pressure,
    speed: boss ? 34 : elite ? 52 : 70,
    attack: boss ? 18 + state.bossCount * 4 : elite ? 11 : 7,
    cooldown: 0,
    radius: boss ? 34 : elite ? 22 : 17
  });
  state.particles.push({
    x: point.x,
    y: point.y - (boss ? 54 : 34),
    text: boss ? "BOSS" : "pop",
    color: boss ? "#ffcf6f" : "#d9ecff",
    life: 1.1
  });
  if (boss) addLog(state, `Boss ${state.bossCount + 1} が出現。`);
}

function currentFormationAnchor(state: GameState) {
  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  const heroes = aliveHeroes.length > 0 ? aliveHeroes : state.heroes;
  const heroCenter = heroes.reduce(
    (center, hero) => ({ x: center.x + hero.x / heroes.length, y: center.y + hero.y / heroes.length }),
    { x: 0, y: 0 }
  );
  const slots = formations[state.formation].slots;
  const slotCenter = slots.reduce(
    (center, slot) => ({ x: center.x + slot.x / slots.length, y: center.y + slot.y / slots.length }),
    { x: 0, y: 0 }
  );

  return clampFormationAnchor(state, {
    x: heroCenter.x - slotCenter.x,
    y: heroCenter.y - slotCenter.y
  });
}

function clampFormationAnchor(state: GameState, anchor: Point) {
  const slots = formations[state.formation].slots;
  const minX = Math.max(...slots.map((slot) => 80 - slot.x));
  const maxX = Math.min(...slots.map((slot) => state.view.w - 160 - slot.x));
  const minY = Math.max(...slots.map((slot) => 96 - slot.y));
  const maxY = Math.min(...slots.map((slot) => combatBottom(state) - slot.y));

  return {
    x: clamp(anchor.x, minX, maxX),
    y: clamp(anchor.y, minY, maxY)
  };
}

function queueFormationMove(state: GameState) {
  state.targetPoint = currentFormationAnchor(state);
  state.orderPulse = 0.55;
  state.status = `隊列「${formations[state.formation].name}」に変更。`;
}

function movePartyWithKeyboard(state: GameState, dt: number) {
  const x = Number(state.movement.right) - Number(state.movement.left);
  const y = Number(state.movement.down) - Number(state.movement.up);
  if (x === 0 && y === 0) return false;

  const length = Math.hypot(x, y) || 1;
  const speed = 178;
  const anchor = currentFormationAnchor(state);
  anchor.x += (x / length) * speed * dt;
  anchor.y += (y / length) * speed * dt;
  const clampedAnchor = clampFormationAnchor(state, anchor);
  state.targetPoint = null;
  state.orderPulse = Math.max(state.orderPulse, 0.18);

  for (const [index, hero] of state.heroes.entries()) {
    if (hero.hp <= 0) continue;
    const slot = formations[state.formation].slots[index];
    moveToward(hero, { x: clampedAnchor.x + slot.x, y: clampedAnchor.y + slot.y }, dt, 3.6, heroStats(hero).speed);
    hero.x = clamp(hero.x, 80, state.view.w - 160);
    hero.y = clamp(hero.y, 96, combatBottom(state));
  }
  return true;
}

function enemiesNear(state: GameState, point: Point, radius: number) {
  return state.enemies.filter((enemy) => distance(enemy, point) <= radius);
}

function useSkill(state: GameState, key: SkillKey) {
  const hero = state.heroes[state.selected];
  const skill = hero.skills.find((candidate) => candidate.key === key);
  if (!skill || hero.hp <= 0) return;
  if (hero.skillCooldowns[key] > 0 || hero.mp < skill.cost) {
    state.status = `${hero.name}：${skill.name} はまだ使えません。`;
    return;
  }

  hero.mp -= skill.cost;
  hero.skillCooldowns[key] = skill.cooldown;
  addLog(state, `${key.toUpperCase()} ${hero.name}：${skill.name}`);

  const target = nearestEnemy(state, hero);

  if (skill.id === "blade-lunge" && target) {
    moveToward(hero, target, 1, 3.2);
    damage(state, target, 72, "#fff0a6");
  }
  if (skill.id === "blade-cleave") {
    const center = target ?? hero;
    for (const enemy of enemiesNear(state, center, 98)) damage(state, enemy, 44, "#ffd28a");
  }
  if (skill.id === "blade-guard") {
    hero.hp = clamp(hero.hp + 38, 0, heroStats(hero).maxHp);
    state.particles.push({ x: hero.x, y: hero.y - 30, text: "guard", color: "#fff0a6", life: 0.9 });
  }
  if (skill.id === "blade-rally") {
    for (const ally of state.heroes) {
      ally.hp = clamp(ally.hp + 22, 0, heroStats(ally).maxHp);
      ally.mp = clamp(ally.mp + 12, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 30, text: "+", color: "#ffe2a0", life: 0.9 });
    }
  }

  if (skill.id === "rifle-shot" && target) damage(state, target, 58, "#d9ecff");
  if (skill.id === "rifle-grenade" && target) {
    for (const enemy of enemiesNear(state, target, 112)) damage(state, enemy, 39, "#ffc27a");
  }
  if (skill.id === "rifle-smoke") {
    for (const enemy of enemiesNear(state, hero, 190)) {
      enemy.speed *= 0.72;
      damage(state, enemy, 14, "#c7d5e8");
    }
  }
  if (skill.id === "rifle-volley") {
    for (const enemy of state.enemies) {
      if (Math.abs(enemy.y - hero.y) < 94) damage(state, enemy, 47, "#d9ecff");
    }
  }

  if (skill.id === "staff-heal") {
    for (const ally of state.heroes) {
      ally.hp = clamp(ally.hp + 32, 0, heroStats(ally).maxHp);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "+", color: "#aef2d0", life: 0.9 });
    }
  }
  if (skill.id === "staff-flare" && target) {
    for (const enemy of enemiesNear(state, target, 125)) damage(state, enemy, 43, "#ffb16f");
  }
  if (skill.id === "staff-mana") {
    for (const ally of state.heroes) {
      ally.mp = clamp(ally.mp + 28, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "mp", color: "#86d8e5", life: 0.9 });
    }
  }
  if (skill.id === "staff-starfall") {
    for (const enemy of state.enemies) damage(state, enemy, 36, "#d7b5ff");
  }

  if (skill.id === "scout-firstaid") {
    const targetAlly = state.heroes
      .filter((ally) => ally.hp > 0)
      .sort((a, b) => a.hp / heroStats(a).maxHp - b.hp / heroStats(b).maxHp)[0];
    if (targetAlly) {
      targetAlly.hp = clamp(targetAlly.hp + 54, 0, heroStats(targetAlly).maxHp);
      state.particles.push({ x: targetAlly.x, y: targetAlly.y - 30, text: "+aid", color: "#b7f0cf", life: 1 });
    }
  }
  if (skill.id === "scout-regeneration") {
    for (const ally of state.heroes) {
      ally.hp = clamp(ally.hp + 24, 0, heroStats(ally).maxHp);
      ally.mp = clamp(ally.mp + 8, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "regen", color: "#b7f0cf", life: 0.9 });
    }
  }
  if (skill.id === "scout-haste") {
    for (const ally of state.heroes) {
      ally.cooldown = Math.max(0, ally.cooldown - 0.35);
      ally.mp = clamp(ally.mp + 14, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "haste", color: "#e6ffd2", life: 0.9 });
    }
  }
  if (skill.id === "scout-sanctuary") {
    for (const ally of state.heroes) {
      ally.hp = clamp(ally.hp + 46, 0, heroStats(ally).maxHp);
      ally.mp = clamp(ally.mp + 18, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 32, text: "sanct", color: "#fff0a6", life: 1 });
    }
    for (const enemy of enemiesNear(state, hero, 170)) damage(state, enemy, 26, "#fff0a6");
  }
}

function updateGame(state: GameState, dt: number) {
  if (state.paused) return;

  state.spawnTimer -= dt;
  state.bossTimer -= dt;
  state.orderPulse = Math.max(0, state.orderPulse - dt);
  if (state.spawnTimer <= 0) {
    spawnEnemy(state);
    state.spawnTimer = 0.75 + Math.random() * Math.max(0.65, 1.9 - Math.min(1, state.score / 2500));
  }
  if (state.bossTimer <= 0) {
    spawnEnemy(state, true);
    state.bossCount += 1;
    state.bossTimer = Math.max(22, 42 - state.bossCount * 3);
  }

  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  if (aliveHeroes.length === 0) {
    state.paused = true;
    state.status = "家門は全滅しました。ページを再読み込みすると再挑戦できます。";
    addLog(state, "開拓地に静寂が戻った。");
    return;
  }

  const keyboardMoved = movePartyWithKeyboard(state, dt);

  if (state.targetPoint && !keyboardMoved) {
    state.heroes.forEach((hero, index) => {
      if (hero.hp <= 0) return;
      const slot = formations[state.formation].slots[index];
      moveToward(hero, { x: state.targetPoint!.x + slot.x, y: state.targetPoint!.y + slot.y }, dt, 1, heroStats(hero).speed);
      hero.x = clamp(hero.x, 80, state.view.w - 160);
      hero.y = clamp(hero.y, 96, combatBottom(state));
    });
  }

  for (const hero of state.heroes) {
    if (hero.hp <= 0) continue;
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    for (const key of skillKeys) {
      hero.skillCooldowns[key] = Math.max(0, hero.skillCooldowns[key] - dt);
    }
    const stats = heroStats(hero);
    hero.hp = clamp(hero.hp, 0, stats.maxHp);
    hero.mp = clamp(hero.mp + dt * 4.5, 0, stats.maxMp);

    const target = nearestEnemy(state, hero);
    if (!target) continue;
    const d = distance(hero, target);
    if (d > stats.range && !state.targetPoint && !keyboardMoved) {
      moveToward(hero, target, dt, 0.62, stats.speed);
    } else if (d <= stats.range && hero.cooldown <= 0) {
      damage(state, target, stats.attack + Math.random() * 6, hero.trim);
      hero.cooldown = hero.weapon === "rifle" ? 1.02 : 0.76;
      state.particles.push({ x: hero.x, y: hero.y - 32, text: "hit", color: hero.trim, life: 0.45 });
    }
  }

  for (const enemy of state.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const target = aliveHeroes.reduce((best, hero) => (distance(enemy, hero) < distance(enemy, best) ? hero : best), aliveHeroes[0]);
    if (distance(enemy, target) > enemy.radius + 28) {
      moveToward(enemy, target, dt);
    } else if (enemy.cooldown <= 0) {
      damage(state, target, enemy.attack + Math.random() * 4, "#ff8d75");
      enemy.cooldown = 1.28;
    }
  }

  const before = state.enemies.length;
  const defeatedScore = state.enemies
    .filter((enemy) => enemy.hp <= 0)
    .reduce((sum, enemy) => sum + (enemy.type === "boss" ? 300 : enemy.type === "duelist" ? 45 : 25), 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const defeated = before - state.enemies.length;
  if (defeated > 0) {
    state.score += defeatedScore;
  }

  state.particles = state.particles
    .map((p) => ({ ...p, y: p.y - dt * 24, life: p.life - dt }))
    .filter((p) => p.life > 0);
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const { w, h } = state.view;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#272034");
  g.addColorStop(0.46, "#344053");
  g.addColorStop(1, "#8b6842");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(255, 221, 145, 0.58)";
  ctx.fillRect(0, 0, w, 58);
  ctx.fillStyle = "rgba(30, 26, 38, 0.64)";
  for (let x = -40; x < w + 80; x += 118) {
    ctx.beginPath();
    ctx.moveTo(x, 58);
    ctx.lineTo(x + 42, 8);
    ctx.lineTo(x + 84, 58);
    ctx.fill();
  }

  ctx.fillStyle = "#3b3a4a";
  for (let x = -60; x < w + 160; x += 210) {
    ctx.fillRect(x, 74, 78, h - 148);
    ctx.fillStyle = "#222231";
    ctx.fillRect(x + 15, 118, 48, 82);
    ctx.fillStyle = "#3b3a4a";
  }

  ctx.fillStyle = "#8f724c";
  ctx.fillRect(0, h - 128, w, 128);
  ctx.fillStyle = "#a88a5d";
  for (let y = h - 124; y < h; y += 32) {
    for (let x = (y % 64) - 64; x < w; x += 96) {
      ctx.fillRect(x, y, 88, 26);
    }
  }

  ctx.strokeStyle = "rgba(255, 222, 150, 0.18)";
  ctx.lineWidth = 1;
  for (let y = 142; y < h - 132; y += 86) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.28, y - 24, w * 0.56, y + 20, w, y - 12);
    ctx.stroke();
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, state: GameState, unit: Hero | Enemy, isHero: boolean, index = 0) {
  const r = isHero ? 24 : (unit as Enemy).radius;
  ctx.save();
  ctx.translate(unit.x, unit.y);

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, r + 22, r * 1.35, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isHero && state.selected === index) {
    ctx.strokeStyle = "#ffe0a0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 18 + state.orderPulse * 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isHero) {
    const hero = unit as Hero;
    ctx.strokeStyle = "#161824";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.fillStyle = hero.accent;
    ctx.beginPath();
    ctx.moveTo(-27, -10);
    ctx.quadraticCurveTo(-50, -2, -36, 24);
    ctx.quadraticCurveTo(-20, 15, -17, 0);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hero.color;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(24, 10);
    ctx.lineTo(14, 43);
    ctx.lineTo(-16, 43);
    ctx.lineTo(-25, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hero.trim;
    ctx.beginPath();
    ctx.moveTo(-18, 8);
    ctx.lineTo(0, 27);
    ctx.lineTo(19, 8);
    ctx.lineTo(11, 43);
    ctx.lineTo(-10, 43);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = hero.trim;
    ctx.beginPath();
    if (hero.weapon === "rifle") {
      ctx.moveTo(18, 0);
      ctx.lineTo(58, -12);
      ctx.moveTo(30, 6);
      ctx.lineTo(45, 18);
    } else if (hero.weapon === "scout") {
      ctx.moveTo(24, -6);
      ctx.lineTo(42, 18);
      ctx.moveTo(33, 5);
      ctx.lineTo(48, -8);
    } else if (hero.weapon === "staff") {
      ctx.moveTo(26, -22);
      ctx.lineTo(38, 38);
      ctx.moveTo(31, -22);
      ctx.arc(31, -22, 7, 0, Math.PI * 2);
    } else {
      ctx.moveTo(20, 6);
      ctx.lineTo(50, -30);
      ctx.moveTo(43, -31);
      ctx.lineTo(54, -23);
    }
    ctx.stroke();

    ctx.fillStyle = "#f0c7a5";
    ctx.strokeStyle = "#161824";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -27, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hero.hair;
    ctx.beginPath();
    ctx.arc(-2, -35, 20, Math.PI * 0.92, Math.PI * 2.08);
    ctx.lineTo(20, -24);
    ctx.quadraticCurveTo(2, -20, -18, -25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#151720";
    ctx.beginPath();
    ctx.arc(-6, -28, 2.2, 0, Math.PI * 2);
    ctx.arc(7, -28, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const enemy = unit as Enemy;
    ctx.fillStyle = enemy.type === "boss" ? "#332144" : enemy.type === "duelist" ? "#6f4b8f" : "#9d4f59";
    ctx.strokeStyle = "#161824";
    ctx.lineWidth = enemy.type === "boss" ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(0, -r - 9);
    ctx.lineTo(r + 14, 0);
    ctx.lineTo(0, r + 18);
    ctx.lineTo(-r - 14, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (enemy.type === "boss") {
      ctx.strokeStyle = "#ffcf6f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffcf6f";
      ctx.fillRect(-18, -r - 28, 36, 8);
    }

    ctx.fillStyle = enemy.type === "boss" ? "#f4d1a5" : "#e8c09e";
    ctx.beginPath();
    ctx.arc(0, -r - 9, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  const hpWidth = 54;
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fillRect(-hpWidth / 2, r + 36, hpWidth, 7);
  ctx.fillStyle = unit.hp / unit.maxHp > 0.35 ? "#de5665" : "#ff9b5f";
  ctx.fillRect(-hpWidth / 2, r + 36, hpWidth * clamp(unit.hp / unit.maxHp, 0, 1), 7);
  ctx.restore();
}

const WORLD_SCALE = 74;

function toWorld(point: Point, state: GameState) {
  return new THREE.Vector3((point.x - state.view.w / 2) / WORLD_SCALE, 0, (point.y - state.view.h / 2) / WORLD_SCALE);
}

function createThreeView(canvas: HTMLCanvasElement): ThreeView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setClearColor(0x1b1b28);
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1b1b28, 12, 34);
  const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
  camera.position.set(7.8, 9.8, 8.8);
  camera.lookAt(0, 0, 0);

  const field = new THREE.Group();
  const units = new THREE.Group();
  const effects = new THREE.Group();
  scene.add(field, units, effects);
  scene.add(new THREE.HemisphereLight(0xfff2d0, 0x253344, 1.7));
  const sun = new THREE.DirectionalLight(0xffdf9a, 2.2);
  sun.position.set(-5, 10, 6);
  sun.castShadow = true;
  scene.add(sun);

  return { renderer, scene, camera, field, units, effects };
}

function resizeThreeView(view: ThreeView, state: GameState, canvas: HTMLCanvasElement, dpr: number) {
  const rect = canvas.getBoundingClientRect();
  state.view.w = Math.max(900, rect.width);
  state.view.h = Math.max(560, rect.height);
  view.renderer.setPixelRatio(dpr);
  view.renderer.setSize(state.view.w, state.view.h, false);
  view.camera.left = -state.view.w / WORLD_SCALE / 2;
  view.camera.right = state.view.w / WORLD_SCALE / 2;
  view.camera.top = state.view.h / WORLD_SCALE / 2;
  view.camera.bottom = -state.view.h / WORLD_SCALE / 2;
  view.camera.updateProjectionMatrix();
  rebuildField(view, state);
}

function rebuildField(view: ThreeView, state: GameState) {
  view.field.clear();
  const width = state.view.w / WORLD_SCALE;
  const depth = state.view.h / WORLD_SCALE;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x7b6747, roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  view.field.add(ground);

  const grid = new THREE.GridHelper(Math.max(width, depth), 18, 0xd2b477, 0x66543b);
  grid.position.y = 0.012;
  view.field.add(grid);

  for (let i = -3; i <= 3; i += 1) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x3b3a4a, roughness: 0.8 })
    );
    column.position.set(i * 1.9, 0.9, -depth / 2 + 0.9);
    column.castShadow = true;
    view.field.add(column);
  }

  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.18, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x9d8155, roughness: 0.7 })
  );
  arch.position.set(0, 1.92, -depth / 2 + 0.85);
  arch.castShadow = true;
  view.field.add(arch);
}

function createHeroMesh(hero: Hero, state: GameState, index: number) {
  const group = new THREE.Group();
  const pos = toWorld(hero, state);
  group.position.copy(pos);
  const selected = state.selected === index;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.46, 5, 10),
    new THREE.MeshStandardMaterial({ color: hero.color, roughness: 0.55, metalness: 0.05 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0c7a5, roughness: 0.65 })
  );
  head.position.y = 1.04;
  head.castShadow = true;
  group.add(head);

  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.025, 8, 28),
    new THREE.MeshBasicMaterial({ color: selected ? 0xffe0a0 : hero.trim })
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.04;
  group.add(trim);

  const weaponLength = hero.weapon === "rifle" ? 0.72 : hero.weapon === "staff" ? 0.82 : 0.46;
  const weapon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, weaponLength, 8),
    new THREE.MeshStandardMaterial({ color: hero.trim, roughness: 0.45, metalness: 0.4 })
  );
  weapon.rotation.z = hero.weapon === "staff" ? 0.18 : -0.75;
  weapon.position.set(0.32, 0.65, 0.03);
  group.add(weapon);

  addHealthBar(group, hero.hp / heroStats(hero).maxHp, 0.92, selected ? 0xffe0a0 : 0xffffff);
  return group;
}

function createEnemyMesh(enemy: Enemy, state: GameState) {
  const group = new THREE.Group();
  group.position.copy(toWorld(enemy, state));
  const isBoss = enemy.type === "boss";
  const radius = isBoss ? 0.38 : enemy.type === "duelist" ? 0.25 : 0.2;
  const body = new THREE.Mesh(
    isBoss ? new THREE.DodecahedronGeometry(radius, 0) : new THREE.ConeGeometry(radius, isBoss ? 0.9 : 0.56, 5),
    new THREE.MeshStandardMaterial({
      color: isBoss ? 0x332144 : enemy.type === "duelist" ? 0x6f4b8f : 0x9d4f59,
      roughness: 0.6,
      metalness: isBoss ? 0.18 : 0.04
    })
  );
  body.position.y = isBoss ? 0.56 : 0.36;
  body.castShadow = true;
  group.add(body);

  if (isBoss) {
    const crown = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xffcf6f })
    );
    crown.position.y = 1.08;
    crown.rotation.x = Math.PI / 2;
    group.add(crown);
  }

  addHealthBar(group, enemy.hp / enemy.maxHp, isBoss ? 1.35 : 0.82, isBoss ? 0xffcf6f : 0xffffff);
  return group;
}

function addHealthBar(group: THREE.Group, ratio: number, y: number, frameColor: number) {
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.045, 0.035),
    new THREE.MeshBasicMaterial({ color: frameColor })
  );
  back.position.set(0, y, 0);
  group.add(back);
  const fill = new THREE.Mesh(
    new THREE.BoxGeometry(0.68 * clamp(ratio, 0, 1), 0.05, 0.04),
    new THREE.MeshBasicMaterial({ color: ratio > 0.35 ? 0xde5665 : 0xff9b5f })
  );
  fill.position.set(-0.34 + (0.68 * clamp(ratio, 0, 1)) / 2, y + 0.004, 0.005);
  group.add(fill);
}

function createTextSprite(text: string, color: string, opacity: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "700 28px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, 96, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.55, 0.52, 1);
  return sprite;
}

function renderGame(view: ThreeView, state: GameState) {
  void drawBackground;
  void drawUnit;
  view.units.clear();
  view.effects.clear();

  if (state.targetPoint) {
    const marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.26 + state.orderPulse * 0.14, 0.025, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd980 })
    );
    marker.rotation.x = Math.PI / 2;
    marker.position.copy(toWorld(state.targetPoint, state));
    marker.position.y = 0.04;
    view.effects.add(marker);
  }

  [...state.enemies].sort((a, b) => a.y - b.y).forEach((enemy) => view.units.add(createEnemyMesh(enemy, state)));
  [...state.heroes]
    .sort((a, b) => a.y - b.y)
    .forEach((hero) => view.units.add(createHeroMesh(hero, state, state.heroes.indexOf(hero))));

  for (const p of state.particles) {
    const sprite = createTextSprite(p.text, p.color, clamp(p.life, 0, 1));
    sprite.position.copy(toWorld(p, state));
    sprite.position.y = 1.6 + (1 - p.life) * 0.7;
    view.effects.add(sprite);
  }

  if (state.paused) {
    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(state.view.w / WORLD_SCALE, state.view.h / WORLD_SCALE),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.36 })
    );
    veil.position.set(0, 2.6, 0);
    veil.rotation.x = -Math.PI / 2;
    view.effects.add(veil);
  }

  view.renderer.render(view.scene, view.camera);
}

function setMovementKey(state: GameState, key: string, pressed: boolean) {
  const normalized = key.toLowerCase();
  if (normalized === "w") state.movement.up = pressed;
  if (normalized === "a") state.movement.left = pressed;
  if (normalized === "s") state.movement.down = pressed;
  if (normalized === "d") state.movement.right = pressed;
}

function isMovementKey(key: string) {
  return key.length === 1 && "wasd".includes(key.toLowerCase());
}

function upgradeCost(item: Equipment) {
  return 120 * item.level;
}

function upgradeEquipment(state: GameState, slot: EquipmentSlot) {
  const hero = state.heroes[state.selected];
  const item = hero.equipment[slot];
  const cost = upgradeCost(item);
  if (state.score < cost) {
    state.status = `${item.name} 強化には ${cost} 点必要です。`;
    return;
  }
  state.score -= cost;
  item.level += 1;
  const stats = heroStats(hero);
  hero.hp = clamp(hero.hp + (item.bonus.maxHp ?? 0), 0, stats.maxHp);
  hero.mp = clamp(hero.mp + (item.bonus.maxMp ?? 0), 0, stats.maxMp);
  addLog(state, `${hero.name} の ${item.name} が +${item.level} に強化。`);
  state.status = `${item.name} を +${item.level} に強化しました。`;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createGameState());
  const [hud, setHud] = useState<HudState>(() => snapshotHud(stateRef.current));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const view = createThreeView(canvas);
    const state = stateRef.current;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    let animationId = 0;
    let hudTimer = 0;

    const resize = () => {
      resizeThreeView(view, state, canvas, dpr);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.04, (now - state.last) / 1000);
      state.last = now;
      updateGame(state, dt);
      renderGame(view, state);
      hudTimer += dt;
      if (hudTimer > 0.12) {
        hudTimer = 0;
        setHud(snapshotHud(state));
      }
      animationId = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    animationId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      view.renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (isMovementKey(event.key)) {
        event.preventDefault();
        setMovementKey(state, event.key, true);
        state.status = "WASDで家門を移動中。";
      }
      if (event.key >= "1" && event.key <= "4") {
        state.selected = Number(event.key) - 1;
        state.status = `${state.heroes[state.selected].name} を選択中。`;
      }
      if (event.code === "Space") state.paused = !state.paused;
      if (event.key.toLowerCase() === "q") {
        state.formation = (state.formation + 1) % formations.length;
        addLog(state, `隊列を ${formations[state.formation].name} に変更。`);
        queueFormationMove(state);
      }
      const skillKey = event.key.toLowerCase() as SkillKey;
      if (skillKeys.includes(skillKey)) {
        event.preventDefault();
        useSkill(state, skillKey);
      }
      setHud(snapshotHud(state));
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!isMovementKey(event.key)) return;
      event.preventDefault();
      setMovementKey(state, event.key, false);
      setHud(snapshotHud(state));
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const state = stateRef.current;
    const rect = canvas.getBoundingClientRect();
    const point = {
      x: (event.clientX - rect.left) * (state.view.w / rect.width),
      y: (event.clientY - rect.top) * (state.view.h / rect.height)
    };

    const clickedHero = state.heroes.findIndex((hero) => Math.hypot(hero.x - point.x, hero.y - point.y) < 42);
    if (clickedHero >= 0) {
      state.selected = clickedHero;
      state.status = `${state.heroes[state.selected].name} を選択中。`;
    } else {
      state.targetPoint = {
        x: clamp(point.x, 100, state.view.w - 160),
        y: clamp(point.y, 108, combatBottom(state))
      };
      state.orderPulse = 0.55;
      state.status = `隊列「${formations[state.formation].name}」で移動命令。`;
    }
    setHud(snapshotHud(state));
  };

  const selectHero = (index: number) => {
    const state = stateRef.current;
    state.selected = index;
    state.status = `${state.heroes[state.selected].name} を選択中。`;
    setHud(snapshotHud(state));
  };

  const toggleHold = () => {
    const state = stateRef.current;
    state.paused = !state.paused;
    setHud(snapshotHud(state));
  };

  const changeFormation = () => {
    const state = stateRef.current;
    state.formation = (state.formation + 1) % formations.length;
    addLog(state, `隊列を ${formations[state.formation].name} に変更。`);
    queueFormationMove(state);
    setHud(snapshotHud(state));
  };

  const triggerSkill = (key: SkillKey) => {
    const state = stateRef.current;
    useSkill(state, key);
    setHud(snapshotHud(state));
  };

  const enhanceEquipment = (slot: EquipmentSlot) => {
    const state = stateRef.current;
    upgradeEquipment(state, slot);
    setHud(snapshotHud(state));
  };

  const selectedHero = hud.heroes[hud.selected];
  const selectedStats = heroStats(selectedHero);

  return (
    <main className="shell">
      <section className="stage-wrap" aria-label="game stage">
        <canvas ref={canvasRef} width={1280} height={720} onClick={handleCanvasClick} />
        <div className="topbar">
          <div>
            <p className="eyebrow">Arcadia Frontier</p>
            <h1>家門戦記</h1>
          </div>
          <div className="resource">
            <span>Boss {hud.bossCount}</span>
            <strong>{hud.score}</strong>
          </div>
        </div>
        <div className="hud">
          <div className="party">
            {hud.heroes.map((hero, index) => (
              <button
                className={`member ${index === hud.selected ? "active" : ""}`}
                key={hero.name}
                onClick={() => selectHero(index)}
                type="button"
              >
                <span className="member-head">
                  <strong>{hero.name}</strong>
                  <span className="role">{hero.role}</span>
                </span>
                <span className="bar">
                  <span className="fill" style={{ width: `${clamp(hero.hp / heroStats(hero).maxHp, 0, 1) * 100}%` }} />
                </span>
                <span className="bar mana">
                  <span className="fill" style={{ width: `${clamp(hero.mp / heroStats(hero).maxMp, 0, 1) * 100}%` }} />
                </span>
              </button>
            ))}
          </div>
          <div className="controls">
            <button type="button" title="一時停止 / 再開" onClick={toggleHold}>
              {hud.paused ? "Resume" : "Hold"}
            </button>
            <button type="button" title="隊列変更" onClick={changeFormation}>
              {formations[hud.formation].name}
            </button>
            {hud.heroes[hud.selected].skills.map((skill) => {
              const cooldown = hud.heroes[hud.selected].skillCooldowns[skill.key];
              const disabled = cooldown > 0 || selectedHero.mp < skill.cost;
              return (
                <button
                  disabled={disabled}
                  key={skill.key}
                  onClick={() => triggerSkill(skill.key)}
                  title={`${skill.key.toUpperCase()} ${skill.name}`}
                  type="button"
                >
                  {skill.key.toUpperCase()} {cooldown > 0 ? Math.ceil(cooldown) : skill.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="panel">
        <div className="crest">A</div>
        <h2>アルカディア開拓団</h2>
        <p className="status">{hud.status}</p>
        <div className="equipment">
          <div className="equipment-head">
            <strong>{selectedHero.name}</strong>
            <span>ATK {selectedStats.attack} / HP {selectedStats.maxHp} / MP {selectedStats.maxMp}</span>
          </div>
          {(Object.keys(selectedHero.equipment) as EquipmentSlot[]).map((slot) => {
            const item = selectedHero.equipment[slot];
            return (
              <button className="equipment-item" key={slot} onClick={() => enhanceEquipment(slot)} type="button">
                <span>
                  {item.name} +{item.level}
                </span>
                <small>{upgradeCost(item)} pts</small>
              </button>
            );
          })}
        </div>
        <div className="log" aria-live="polite">
          {hud.logs.map((log, index) => (
            <p key={`${log}-${index}`}>{log}</p>
          ))}
        </div>
        <div className="help">
          <span>WASD</span> 移動
          <span>Click</span> 選択 / 移動
          <span>1-4</span> メンバー選択
          <span>Space</span> Hold
          <span>Q</span> 隊列変更
          <span>ERTY</span> スキル
        </div>
      </aside>
    </main>
  );
}

function snapshotHud(state: GameState): HudState {
  return {
    selected: state.selected,
    paused: state.paused,
    formation: state.formation,
    score: state.score,
    bossCount: state.bossCount,
    heroes: structuredClone(state.heroes),
    logs: [...state.logs],
    status: state.status
  };
}

export default App;
