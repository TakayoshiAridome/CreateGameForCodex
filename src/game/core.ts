import { areaOrder, areas, cloneEquipment, consumableCatalog, createReserveHeroes, elementAdvantage, elementColors, elementLabels, equipmentCatalog, formations, initialHeroes, shopOrder, shops, skillKeys } from "./data";
import { clamp, distance, faceToward, facingAngle, moveToward } from "./coreMath";
import type { AreaId, ConsumableId, ElementId, Enemy, Equipment, EquipmentBonus, EquipmentSlot, GameState, Hero, HudState, Particle, Point, ShopId, SkillKey, WarpPoint } from "./types";

const HERO_DETECTION_RANGE = 360;
const HERO_DETECTION_RANGE_CAP = 440;
const PARTY_DETECTION_RANGE = 460;
const ENEMY_DETECTION_RANGE = 320;
const ELITE_DETECTION_BONUS = 60;
const BOSS_DETECTION_BONUS = 150;
const LUCERIA_ATTACK_MOTION_DURATION = 0.92;
const MIN_ATTACK_MOTION_DURATION = 0.28;
const MIN_LUCERIA_ATTACK_MOTION_DURATION = 0.46;
const MELEE_BASIC_ATTACK_BASE_COOLDOWN = 0.76;
const RIFLE_BASIC_ATTACK_BASE_COOLDOWN = 1.02;
const BASIC_ATTACK_MOTION_COOLDOWN_RATIO = 0.9;
const MOVE_TARGET_ARRIVAL_DISTANCE = 18;
const HERO_MOVEMENT_SPEED_MULTIPLIER = 1.35;
const HERO_SHARED_BASE_MOVEMENT_SPEED = 173;
const HERO_SHARED_MOVEMENT_SPEED = Math.round(HERO_SHARED_BASE_MOVEMENT_SPEED * HERO_MOVEMENT_SPEED_MULTIPLIER);
export const HERO_RUN_CYCLE_STEP_SCALE = 0.055;
export const HERO_GLB_RUN_ANIMATION_TIME_SCALE = 0.075;
const STANDARD_MOVEMENT_SPEED = 248;
const WOLF_MOVEMENT_SPEED_MULTIPLIER = 1.05;
const BOAR_MOVEMENT_SPEED_MULTIPLIER = 1.02;
const BEAR_MOVEMENT_SPEED_MULTIPLIER = 0.96;
const WOLF_ANIMATION_SPEED = 0.032;
const BOAR_ANIMATION_SPEED = 0.024;
const BEAR_ANIMATION_SPEED = 0.02;
const ENEMY_HP_MULTIPLIER = 3;
type ForestEnemyType = "wolf" | "boar" | "bear";

function createGameState(): GameState {
  const heroes = structuredClone(initialHeroes);
  const reserveHeroes = createReserveHeroes();
  const outgoingIndex = heroes.findIndex((hero) => hero.name === "アデリア" || hero.name === "アテリア");
  const incomingIndex = reserveHeroes.findIndex((hero) => hero.name === "ルシェリア");
  if (outgoingIndex >= 0 && incomingIndex >= 0) {
    const outgoing = heroes[outgoingIndex];
    const incoming = reserveHeroes[incomingIndex];
    heroes[outgoingIndex] = { ...incoming, x: outgoing.x, y: outgoing.y, moving: false, attacking: false };
    reserveHeroes[incomingIndex] = { ...outgoing, x: 0, y: 0, moving: false, attacking: false };
  }

  const state: GameState = {
    view: { w: 1280, h: 720 },
    selected: 0,
    paused: false,
    area: "aureleaf",
    formation: 0,
    score: 0,
    gold: 220,
    last: performance.now(),
    spawnTimer: 1.1,
    bossTimer: 28,
    bossCount: 0,
    cameraYaw: 0.725,
    formationFront: { x: 1, y: 0 },
    targetPoint: null,
    movement: {
      up: false,
      down: false,
      left: false,
      right: false
    },
    orderPulse: 0,
    heroes,
    reserveHeroes,
    inventory: [],
    consumables: [],
    enemies: [],
    particles: [],
    logs: ["アウレリーフ中央広場から出撃準備。"],
    status: "アウレリーフ中央から開始。クリック/WASDで移動、1-4で家門メンバーを選択してください。"
  };
  placePartyAtFormationAnchor(state, { x: playableWidth(state) / 2, y: playableBottom(state) / 2 });
  return state;
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
  const levelBonus = hero.level - 1;
  const physicalAttackBonus = Math.floor(hero.str * 0.7 + hero.dex * 0.2);
  const carryWeight = 25 + hero.str * 4;
  const physicalDefense = Math.floor(hero.vit * 0.8 + hero.str * 0.2);
  const attributeHp = hero.vit * 5 + Math.floor(hero.str * 1.2);
  const attackSpeed = 1 + hero.agi * 0.018 + hero.dex * 0.01;
  const evasion = clamp(0.04 + hero.agi * 0.006, 0.04, 0.32);
  const magicAttackBonus = Math.floor(hero.int * 0.85 + hero.men * 0.15);
  const magicDefense = Math.floor(hero.men * 0.8 + hero.vit * 0.2);
  const mpRegen = 3.2 + hero.men * 0.12;
  const attributeMp = hero.int * 3 + hero.men * 2;
  const accuracy = clamp(0.72 + hero.dex * 0.012, 0.72, 0.98);
  const skillCastSpeed = clamp(1 + hero.dex * 0.018, 1, 1.5);
  const physicalAttack = hero.attack + bonus.attack + physicalAttackBonus + levelBonus * 3;
  const magicAttack = hero.attack + bonus.attack + magicAttackBonus + levelBonus * 3;
  const primaryAttack = hero.weapon === "staff" || hero.weapon === "scout" ? magicAttack : physicalAttack;
  return {
    attack: primaryAttack,
    maxHp: hero.maxHp + bonus.maxHp + attributeHp + levelBonus * 18,
    maxMp: hero.maxMp + bonus.maxMp + attributeMp + levelBonus * 7,
    range: hero.range + bonus.range + Math.floor(levelBonus / 3) * 4,
    speed: HERO_SHARED_MOVEMENT_SPEED,
    physicalAttack,
    carryWeight,
    physicalDefense,
    attackSpeed,
    evasion,
    magicAttack,
    magicDefense,
    mpRegen,
    accuracy,
    skillCastSpeed
  };
}

function growHeroAttributes(hero: Hero) {
  if (hero.weapon === "sword") {
    hero.str += 2;
    hero.vit += 1;
    hero.agi += 1;
  } else if (hero.weapon === "rifle") {
    hero.dex += 2;
    hero.agi += 1;
    hero.men += 1;
  } else if (hero.weapon === "staff") {
    hero.int += 2;
    hero.dex += 1;
    hero.men += 1;
  } else {
    hero.int += 1;
    hero.agi += 1;
    hero.dex += 1;
    hero.men += 1;
  }
}

function expReward(enemy: Enemy) {
  return enemy.type === "boss" ? 140 : enemy.type === "duelist" ? 34 : 18;
}

function grantPartyExp(state: GameState, amount: number) {
  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  const receivers = aliveHeroes.length > 0 ? aliveHeroes : state.heroes;
  const share = Math.max(1, Math.floor(amount / receivers.length));
  for (const hero of receivers) {
    hero.exp += share;
    while (hero.exp >= hero.nextExp) {
      hero.exp -= hero.nextExp;
      hero.level += 1;
      growHeroAttributes(hero);
      hero.nextExp = Math.floor(hero.nextExp * 1.28 + 42);
      const stats = heroStats(hero);
      hero.hp = stats.maxHp;
      hero.mp = stats.maxMp;
      state.particles.push({ x: hero.x, y: hero.y - 46, text: `Lv ${hero.level}`, color: "#ffe08a", life: 1 });
      addLog(state, `${hero.name} reached Lv ${hero.level}.`);
      state.status = `${hero.name}がLv ${hero.level}になりました。`;
    }
  }
}

function recoverAtTown(state: GameState, penalty = false) {
  if (penalty) {
    state.gold = Math.floor(state.gold * 0.9);
    for (const hero of state.heroes) {
      hero.exp = Math.floor(hero.exp * 0.9);
    }
  }

  state.area = "aureleaf";
  state.paused = false;
  state.enemies = [];
  state.particles = [];
  state.targetPoint = null;
  state.spawnTimer = 1.1;
  state.bossTimer = areas.spiritTreeForest01.bossInterval;
  for (const [heroIndex, hero] of state.heroes.entries()) {
    const stats = heroStats(hero);
    setHeroHp(state, hero, heroIndex, Math.max(1, Math.floor(stats.maxHp * 0.55)));
    hero.mp = Math.max(hero.mp, Math.floor(stats.maxMp * 0.45));
    hero.cooldown = 0;
    for (const key of skillKeys) {
      hero.skillCooldowns[key] = 0;
    }
    moveHeroToFormationSlot(state, heroIndex);
  }
  addLog(state, penalty ? "Party wiped out. Returned to Aureleaf." : "Recovered in Aureleaf.");
  state.status = penalty
    ? "Party wiped out. EXP and Gold decreased by 10%, then returned to Aureleaf."
    : "The party recovered in Aureleaf.";
}

function combatBottom(state: GameState) {
  return state.view.h - (state.view.w < 700 ? 285 : 118);
}

function playableWidth(state: GameState) {
  if (state.area === "aureleaf") return Math.max(1900, state.view.w * 2.05);
  if (state.area === "spiritRootCave01") return Math.max(2300, state.view.w * 2.45);
  if (state.area === "spiritTreeForest01") return 4092;
  return state.view.w;
}

function playableBottom(state: GameState) {
  if (state.area === "aureleaf") return Math.max(1120, combatBottom(state) * 1.9);
  if (state.area === "spiritRootCave01") return Math.max(1420, combatBottom(state) * 2.35);
  if (state.area === "spiritTreeForest01") return 4092;
  return combatBottom(state);
}

function addLog(state: GameState, text: string) {
  state.logs = [text, ...state.logs].slice(0, 8);
}

function currentArea(state: GameState) {
  return areas[state.area];
}

function warpPointForArea(state: GameState): WarpPoint | null {
  if (state.area === "aureleaf") return { x: playableWidth(state) - 230, y: playableBottom(state) - 190, target: "spiritTreeForest01", label: "世界樹の森01へ" };
  if (state.area === "spiritTreeForest01") return { x: 210, y: playableBottom(state) - 190, target: "aureleaf", label: "アウレリーフへ" };
  return null;
}

function warpPointsForArea(state: GameState): WarpPoint[] {
  const primary = warpPointForArea(state);
  if (state.area === "spiritTreeForest01") {
    return [
      ...(primary ? [primary] : []),
      { x: playableWidth(state) - 240, y: 210, target: "spiritRootCave01", label: "精霊樹の根洞1Fへ" }
    ];
  }
  if (state.area === "spiritRootCave01") return [{ x: 210, y: playableBottom(state) - 190, target: "spiritTreeForest01", label: "世界樹の森01へ" }];
  return primary ? [primary] : [];
}

function ensureFormationIndex(state: GameState) {
  if (!formations[state.formation]) state.formation = 0;
}

function setFormationFront(state: GameState, vector: Point, blend = 1) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) return;
  const target = {
    x: vector.x / length,
    y: vector.y / length
  };
  const amount = clamp(blend, 0, 1);
  const next = {
    x: state.formationFront.x + (target.x - state.formationFront.x) * amount,
    y: state.formationFront.y + (target.y - state.formationFront.y) * amount
  };
  const nextLength = Math.hypot(next.x, next.y) || 1;
  state.formationFront = {
    x: next.x / nextLength,
    y: next.y / nextLength
  };
}

function setFormationFrontToward(state: GameState, from: Point, to: Point, blend = 1) {
  setFormationFront(state, { x: to.x - from.x, y: to.y - from.y }, blend);
}

function formationSlotForHero(state: GameState, heroIndex: number) {
  ensureFormationIndex(state);
  const slots = formations[state.formation].slots;
  const front = state.formationFront;
  const slotOrder = slots
    .map((slot, index) => ({ index, frontScore: slot.x * front.x + slot.y * front.y }))
    .sort((a, b) => b.frontScore - a.frontScore || a.index - b.index);
  const heroOrder = state.heroes
    .map((hero, index) => ({ index, frontRank: heroFrontRank(hero) }))
    .sort((a, b) => a.frontRank - b.frontRank || a.index - b.index);
  const assignedSlot = slotOrder[heroOrder.findIndex((entry) => entry.index === heroIndex)] ?? slotOrder[heroIndex] ?? slotOrder[0];
  return slots[assignedSlot.index];
}

function heroFrontRank(hero: Hero) {
  if (hero.role === "ファイター") return 0;
  if (hero.role === "ガンナー") return 1;
  if (hero.role === "ウィザード") return 2;
  if (hero.role === "ヒーラー") return 3;
  return 2;
}

function movePartyToAreaEntry(state: GameState, fromArea: AreaId) {
  ensureFormationIndex(state);
  const entryY = playableBottom(state) - 190;
  const entryAnchor =
    state.area === "aureleaf"
      ? { x: playableWidth(state) - 360, y: entryY }
      : state.area === "spiritTreeForest01"
        ? { x: fromArea === "aureleaf" ? 335 : playableWidth(state) - 370, y: fromArea === "aureleaf" ? entryY : 260 }
        : state.area === "spiritRootCave01"
          ? { x: 350, y: entryY }
        : currentFormationAnchor(state);
  for (let i = 0; i < state.heroes.length; i += 1) {
    placeHeroAtFormationSlot(state, i, entryAnchor);
  }
}

function placeHeroAtFormationSlot(state: GameState, heroIndex: number, anchor: Point) {
  const slot = formationSlotForHero(state, heroIndex);
  state.heroes[heroIndex].x = clamp(anchor.x + slot.x, 80, playableWidth(state) - 160);
  state.heroes[heroIndex].y = clamp(anchor.y + slot.y, 96, playableBottom(state));
  state.heroes[heroIndex].moving = false;
  state.heroes[heroIndex].attacking = false;
}

function placePartyAtFormationAnchor(state: GameState, anchor: Point) {
  ensureFormationIndex(state);
  for (let i = 0; i < state.heroes.length; i += 1) {
    placeHeroAtFormationSlot(state, i, anchor);
  }
}

function changeAreaState(state: GameState, area: AreaId) {
  if (state.area === area) return false;
  const fromArea = state.area;
  state.area = area;
  state.enemies = [];
  state.particles = [];
  state.targetPoint = null;
  state.spawnTimer = area === "spiritRootCave01" ? 0.65 : 1.1;
  state.bossTimer = areas[area].bossInterval;
  state.status = `${areas[area].name}へ移動しました。${areas[area].description}`;
  addLog(state, `${areas[area].name}へ移動。`);
  if (area === "aureleaf") {
    for (const hero of state.heroes) {
      const stats = heroStats(hero);
      setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp + 34);
      hero.mp = clamp(hero.mp + 28, 0, stats.maxMp);
    }
  }
  if (fromArea !== area) {
    movePartyToAreaEntry(state, fromArea);
    clearMovement(state);
  }
  return true;
}

function warpPartyIfOnPoint(state: GameState) {
  const anchor = currentFormationAnchor(state);
  const warpPoint = warpPointsForArea(state).find((candidate) => distance(anchor, candidate) <= 120);
  if (!warpPoint) return false;
  return changeAreaState(state, warpPoint.target);
}

function nearestEnemy(state: GameState, hero: Hero) {
  return nearestEnemyToPoint(state, hero, heroDetectionRange(hero));
}

function nearestEnemyToPoint(state: GameState, point: Point, maxDistance = Infinity) {
  let best: Enemy | null = null;
  let bestDist = maxDistance;
  for (const enemy of state.enemies) {
    const d = distance(point, enemy);
    if (d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }
  return best;
}

function heroDetectionRange(hero: Hero) {
  return clamp(heroStats(hero).range + 110, HERO_DETECTION_RANGE, HERO_DETECTION_RANGE_CAP);
}

function partyDetectionRange(state: GameState) {
  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  const heroes = aliveHeroes.length > 0 ? aliveHeroes : state.heroes;
  return Math.max(PARTY_DETECTION_RANGE, ...heroes.map((hero) => heroDetectionRange(hero)));
}

function enemyDetectionRange(enemy: Enemy) {
  return ENEMY_DETECTION_RANGE + (enemy.type === "boss" ? BOSS_DETECTION_BONUS : enemy.type === "duelist" ? ELITE_DETECTION_BONUS : 0);
}

function nearestHeroForEnemy(enemy: Enemy, heroes: Hero[]) {
  let best: Hero | null = null;
  let bestDist = enemyDetectionRange(enemy);
  for (const hero of heroes) {
    const d = distance(enemy, hero);
    if (d < bestDist) {
      best = hero;
      bestDist = d;
    }
  }
  return best;
}

function damage(state: GameState, target: Enemy | Hero, amount: number, color = "#ffd47d") {
  const heroIndex = state.heroes.indexOf(target as Hero);
  if (heroIndex >= 0) {
    setHeroHp(state, target as Hero, heroIndex, target.hp - amount);
  } else {
    target.hp -= amount;
  }
  state.particles.push({
    x: target.x,
    y: target.y - 20,
    text: Math.round(amount).toString(),
    color,
    life: 0.85
  });
}

function elementDamageMultiplier(source: ElementId, target: ElementId) {
  if (source === "neutral" || target === "neutral") return 1;
  if (elementAdvantage[source] === target) return 1.25;
  if (elementAdvantage[target] === source) return 0.82;
  return 1;
}

function elementalDamage(state: GameState, target: Enemy | Hero, amount: number, color = "#ffd47d", sourceElement: ElementId = "neutral") {
  const multiplier = elementDamageMultiplier(sourceElement, target.element);
  damage(state, target, amount * multiplier, color);
  if (multiplier > 1.05) {
    state.particles.push({ x: target.x, y: target.y - 42, text: "weak", color: elementColors[sourceElement], life: 0.55 });
  } else if (multiplier < 0.95) {
    state.particles.push({ x: target.x, y: target.y - 42, text: "resist", color: "#d9c7aa", life: 0.55 });
  }
}

function damageWithAccuracy(state: GameState, target: Enemy | Hero, accuracy: number, amount: number, color = "#ffd47d", sourceElement: ElementId = "neutral") {
  if (Math.random() > accuracy) {
    state.particles.push({ x: target.x, y: target.y - 28, text: "miss", color: "#d9c7aa", life: 0.45 });
    return false;
  }
  elementalDamage(state, target, amount, color, sourceElement);
  return true;
}

function skillPoseFor(skillId: string) {
  if (skillId.includes("rifle")) return "shoot" as const;
  if (skillId.includes("staff") || skillId.includes("scout")) return "cast" as const;
  if (skillId.includes("guard")) return "guard" as const;
  if (skillId.includes("rally")) return "rally" as const;
  return "slash" as const;
}

function startSkillAnimation(hero: Hero, skillId: string) {
  hero.attacking = true;
  hero.attackTime = 0;
  hero.pendingBasicAttack = undefined;
  hero.skillPose = skillPoseFor(skillId);
  hero.skillTime = hero.skillPose === "cast" || hero.skillPose === "rally" ? 0.78 : 0.58;
}

function basicAttackBaseCooldown(hero: Hero) {
  return hero.weapon === "rifle" ? RIFLE_BASIC_ATTACK_BASE_COOLDOWN : MELEE_BASIC_ATTACK_BASE_COOLDOWN;
}

export function basicAttackMotionDuration(hero: Hero) {
  const stats = heroStats(hero);
  const baseDuration =
    hero.name === "ルシェリア" ? LUCERIA_ATTACK_MOTION_DURATION : basicAttackBaseCooldown(hero) * BASIC_ATTACK_MOTION_COOLDOWN_RATIO;
  const minDuration = hero.name === "ルシェリア" ? MIN_LUCERIA_ATTACK_MOTION_DURATION : MIN_ATTACK_MOTION_DURATION;
  return Math.max(minDuration, baseDuration / stats.attackSpeed);
}

function beginBasicAttack(hero: Hero, target: Enemy, stats: ReturnType<typeof heroStats>) {
  faceToward(hero, target);
  hero.attacking = true;
  hero.attackTime = 0;
  const amount = stats.attack + Math.random() * 6;
  hero.pendingBasicAttack = { target, accuracy: stats.accuracy, amount, color: hero.trim, element: hero.element };
}

function resolvePendingBasicAttack(state: GameState, hero: Hero) {
  const pending = hero.pendingBasicAttack;
  if (!pending) return;
  hero.pendingBasicAttack = undefined;
  const target = pending.target.hp > 0 ? pending.target : nearestEnemy(state, hero);
  if (!target) return;
  faceToward(hero, target);
  if (damageWithAccuracy(state, target, pending.accuracy, pending.amount, pending.color, pending.element)) {
    state.particles.push({ x: target.x, y: target.y - 32, text: "hit", color: pending.color, life: 0.45 });
  }
}

function addSkillEffect(state: GameState, effect: Particle) {
  state.particles.push({
    maxLife: effect.life,
    ...effect
  });
}

function emitSkillEffect(state: GameState, skillId: string, hero: Hero, target: Point | null) {
  const center = target ?? hero;
  const angle = target ? facingAngle(hero, target) : hero.facing;
  const color =
    skillId.includes("rifle") ? "#d9ecff" :
      skillId.includes("staff") ? "#d7b5ff" :
        skillId.includes("scout") ? "#b7f0cf" :
          "#fff0a6";

  if (skillId === "blade-lunge") addSkillEffect(state, { x: hero.x, y: hero.y, x2: center.x, y2: center.y, text: "thrust", color, life: 0.45, kind: "beam", angle });
  else if (skillId === "blade-cleave") addSkillEffect(state, { x: center.x, y: center.y, text: "slash", color, life: 0.5, kind: "slash", radius: 118, angle });
  else if (skillId === "blade-guard") addSkillEffect(state, { x: hero.x, y: hero.y, text: "guard", color, life: 0.75, kind: "aura", radius: 92 });
  else if (skillId === "blade-rally") addSkillEffect(state, { x: hero.x, y: hero.y, text: "rally", color, life: 0.8, kind: "ring", radius: 168 });
  else if (skillId === "cordels-flame-rush") addSkillEffect(state, { x: hero.x, y: hero.y, x2: center.x, y2: center.y, text: "緋狼突", color: "#ff8d62", life: 0.5, kind: "beam", angle });
  else if (skillId === "cordels-ash-break") addSkillEffect(state, { x: center.x, y: center.y, text: "灰燼断", color: "#ffb15f", life: 0.58, kind: "slash", radius: 136, angle });
  else if (skillId === "cordels-brand-guard") addSkillEffect(state, { x: hero.x, y: hero.y, text: "火印", color: "#ff8d62", life: 0.85, kind: "aura", radius: 108 });
  else if (skillId === "cordels-warflame") addSkillEffect(state, { x: hero.x, y: hero.y, text: "戦火", color: "#ffb15f", life: 0.9, kind: "ring", radius: 182 });
  else if (skillId === "rifle-shot") addSkillEffect(state, { x: hero.x, y: hero.y, x2: center.x, y2: center.y, text: "shot", color, life: 0.32, kind: "beam", angle });
  else if (skillId === "rifle-grenade") addSkillEffect(state, { x: center.x, y: center.y, text: "blast", color: "#ffc27a", life: 0.62, kind: "burst", radius: 132 });
  else if (skillId === "rifle-smoke") addSkillEffect(state, { x: hero.x, y: hero.y, text: "smoke", color: "#c7d5e8", life: 0.9, kind: "aura", radius: 190 });
  else if (skillId === "rifle-volley") addSkillEffect(state, { x: hero.x + 120, y: hero.y, x2: hero.x + 430, y2: hero.y, text: "volley", color, life: 0.6, kind: "beam", angle: hero.facing });
  else if (skillId === "staff-heal") addSkillEffect(state, { x: hero.x, y: hero.y, text: "heal", color: "#aef2d0", life: 0.85, kind: "ring", radius: 180 });
  else if (skillId === "staff-flare") addSkillEffect(state, { x: center.x, y: center.y, text: "flare", color: "#ffb16f", life: 0.72, kind: "burst", radius: 145 });
  else if (skillId === "staff-mana") addSkillEffect(state, { x: hero.x, y: hero.y, text: "mana", color: "#86d8e5", life: 0.85, kind: "aura", radius: 170 });
  else if (skillId === "staff-starfall") addSkillEffect(state, { x: hero.x, y: hero.y, text: "stars", color, life: 0.85, kind: "ring", radius: 230 });
  else if (skillId === "scout-firstaid") addSkillEffect(state, { x: center.x, y: center.y, text: "aid", color, life: 0.72, kind: "aura", radius: 80 });
  else if (skillId === "scout-regeneration") addSkillEffect(state, { x: hero.x, y: hero.y, text: "regen", color, life: 0.9, kind: "ring", radius: 160 });
  else if (skillId === "scout-haste") addSkillEffect(state, { x: hero.x, y: hero.y, text: "haste", color: "#e6ffd2", life: 0.72, kind: "ring", radius: 150 });
  else if (skillId === "scout-sanctuary") addSkillEffect(state, { x: hero.x, y: hero.y, text: "sanct", color: "#fff0a6", life: 1, kind: "aura", radius: 210 });
  addSkillEffect(state, { x: hero.x, y: hero.y - 40, text: skillId.split("-").at(-1) ?? "skill", color, life: 0.55, kind: "text" });
}

function randomSpawnPoint(state: GameState) {
  let point = { x: 180, y: 160 };
  for (let i = 0; i < 12; i += 1) {
    point = {
      x: 150 + Math.random() * Math.max(180, playableWidth(state) - 330),
      y: 128 + Math.random() * Math.max(110, playableBottom(state) - 168)
    };
    if (state.heroes.every((hero) => hero.hp <= 0 || distance(hero, point) > 180)) return point;
  }
  return point;
}

function rollForestEnemyType(): ForestEnemyType {
  const roll = Math.random();
  if (roll < 0.32) return "boar";
  if (roll < 0.52) return "bear";
  return "wolf";
}

function forestEnemySkill(type: ForestEnemyType) {
  if (type === "wolf") return { id: "bite" as const, name: "かみつき" };
  if (type === "boar") return { id: "charge" as const, name: "突進" };
  return { id: "scratch" as const, name: "引っ掻き" };
}

function forestEnemyLabel(type: ForestEnemyType) {
  if (type === "wolf") return "ウルフ";
  if (type === "boar") return "ボア";
  return "ベア";
}

function forestEnemyStats(type: ForestEnemyType, pressure: number) {
  if (type === "wolf") {
    return {
      hp: 58 * pressure,
      speed: STANDARD_MOVEMENT_SPEED * WOLF_MOVEMENT_SPEED_MULTIPLIER,
      attack: 8,
      radius: 19
    };
  }
  if (type === "boar") {
    return {
      hp: 72 * pressure,
      speed: STANDARD_MOVEMENT_SPEED * BOAR_MOVEMENT_SPEED_MULTIPLIER,
      attack: 10,
      radius: 23
    };
  }
  return {
    hp: 96 * pressure,
    speed: STANDARD_MOVEMENT_SPEED * BEAR_MOVEMENT_SPEED_MULTIPLIER,
    attack: 13,
    radius: 28
  };
}

function standardEnemyType(elite: boolean) {
  return elite ? "duelist" : "corsair";
}

function standardEnemyStats(elite: boolean, pressure: number) {
  return {
    hp: (elite ? 88 : 48) * pressure,
    speed: STANDARD_MOVEMENT_SPEED,
    attack: elite ? 11 : 7,
    radius: elite ? 22 : 17
  };
}

function scaledEnemyHp(hp: number) {
  return Math.round(hp * ENEMY_HP_MULTIPLIER);
}

function spawnEnemy(state: GameState, boss = false) {
  if (state.area === "aureleaf") return;
  const point = randomSpawnPoint(state);
  const area = currentArea(state);
  const forestEnemyType = !boss && state.area === "spiritTreeForest01" ? rollForestEnemyType() : null;
  const forestEnemy = forestEnemyType !== null;
  const elite = !boss && !forestEnemy && Math.random() < 0.18 + Math.min(0.18, state.score / 5000);
  const pressure = (1 + Math.min(1.6, state.score / 2200)) * area.enemyScale;
  const enemyElements: ElementId[] = ["fire", "water", "wind", "earth", "dark"];
  const baseStats = boss
    ? {
      hp: 420 + state.bossCount * 120,
      speed: STANDARD_MOVEMENT_SPEED,
      attack: 18 + state.bossCount * 4,
      radius: 34
    }
    : forestEnemyType
      ? forestEnemyStats(forestEnemyType, pressure)
      : standardEnemyStats(elite, pressure);
  const enemyHp = scaledEnemyHp(baseStats.hp);
  state.enemies.push({
    type: boss ? "boss" : forestEnemyType ?? standardEnemyType(elite),
    element: boss ? (state.bossCount % 2 === 0 ? "dark" : "light") : forestEnemy ? "earth" : enemyElements[Math.floor(Math.random() * enemyElements.length)],
    skill: forestEnemyType ? forestEnemySkill(forestEnemyType) : undefined,
    x: point.x,
    y: point.y,
    facing: Math.random() * Math.PI * 2,
    hp: enemyHp,
    maxHp: enemyHp,
    speed: baseStats.speed,
    attack: baseStats.attack,
    cooldown: 0,
    radius: baseStats.radius
  });
  state.particles.push({
    x: point.x,
    y: point.y - (boss ? 54 : 34),
    text: boss ? "BOSS" : forestEnemyType ? forestEnemyLabel(forestEnemyType) : "pop",
    color: boss ? "#ffcf6f" : forestEnemy ? elementColors.earth : "#d9ecff",
    life: 1.1
  });
  if (boss) addLog(state, `Boss ${state.bossCount + 1} が出現。`);
}

function randomBeastWanderTarget(state: GameState, enemy: Enemy) {
  const angle = Math.random() * Math.PI * 2;
  const range = 120 + Math.random() * 240;
  return {
    x: clamp(enemy.x + Math.sin(angle) * range, 96, playableWidth(state) - 120),
    y: clamp(enemy.y + Math.cos(angle) * range, 96, playableBottom(state) - 120)
  };
}

function enemyAnimationSpeed(enemy: Enemy) {
  if (enemy.type === "boar") return BOAR_ANIMATION_SPEED;
  return enemy.type === "bear" ? BEAR_ANIMATION_SPEED : WOLF_ANIMATION_SPEED;
}

function updateBeastRandomWalk(state: GameState, enemy: Enemy, dt: number) {
  if (enemy.type !== "wolf" && enemy.type !== "boar" && enemy.type !== "bear") return;
  enemy.wanderTimer = Math.max(0, (enemy.wanderTimer ?? 0) - dt);
  if (!enemy.wanderTarget || enemy.wanderTimer <= 0 || distance(enemy, enemy.wanderTarget) < 12) {
    enemy.wanderTarget = randomBeastWanderTarget(state, enemy);
    enemy.wanderTimer = 1.4 + Math.random() * 2.4;
  }
  const step = moveToward(enemy, enemy.wanderTarget, dt);
  enemy.animationTime = (enemy.animationTime ?? 0) + step * enemyAnimationSpeed(enemy);
}

function performEnemyAttack(state: GameState, enemy: Enemy, target: Hero) {
  faceToward(enemy, target);
  const targetStats = heroStats(target);
  const isBite = enemy.skill?.id === "bite";
  const isCharge = enemy.skill?.id === "charge";
  const isScratch = enemy.skill?.id === "scratch";
  if (enemy.type === "wolf") enemy.animationTime = (enemy.animationTime ?? 0) + enemy.speed * WOLF_ANIMATION_SPEED * 0.32;
  if (isBite) {
    addSkillEffect(state, {
      x: target.x,
      y: target.y,
      text: enemy.skill?.name ?? "かみつき",
      color: elementColors.earth,
      life: 0.42,
      kind: "slash",
      radius: 74,
      angle: enemy.facing
    });
  }
  if (isCharge) {
    const impact = {
      x: target.x - Math.sin(enemy.facing) * 18,
      y: target.y - Math.cos(enemy.facing) * 18
    };
    addSkillEffect(state, {
      x: enemy.x,
      y: enemy.y,
      x2: impact.x,
      y2: impact.y,
      text: enemy.skill?.name ?? "突進",
      color: elementColors.earth,
      life: 0.35,
      kind: "beam",
      angle: enemy.facing
    });
    addSkillEffect(state, {
      x: target.x,
      y: target.y,
      text: enemy.skill?.name ?? "突進",
      color: elementColors.earth,
      life: 0.5,
      kind: "burst",
      radius: 64
    });
  }
  if (isScratch) {
    addSkillEffect(state, {
      x: target.x,
      y: target.y,
      text: enemy.skill?.name ?? "引っ掻き",
      color: elementColors.earth,
      life: 0.42,
      kind: "slash",
      radius: 96,
      angle: enemy.facing + 0.35
    });
    addSkillEffect(state, {
      x: target.x + Math.sin(enemy.facing) * 14,
      y: target.y + Math.cos(enemy.facing) * 14,
      text: enemy.skill?.name ?? "引っ掻き",
      color: "#d6b47a",
      life: 0.36,
      kind: "slash",
      radius: 72,
      angle: enemy.facing - 0.45
    });
  }
  if (Math.random() < targetStats.evasion) {
    state.particles.push({ x: target.x, y: target.y - 28, text: "evade", color: "#d9ecff", life: 0.45 });
    return;
  }
  const skillPower = isScratch ? 1.22 : isCharge ? 1.32 : isBite ? 1.18 : 1;
  const mitigatedDamage = Math.max(1, enemy.attack * skillPower + Math.random() * 4 - targetStats.physicalDefense * 0.35);
  elementalDamage(state, target, mitigatedDamage, isBite || isCharge || isScratch ? elementColors.earth : "#ff8d75", enemy.element);
  if (isBite) state.particles.push({ x: target.x, y: target.y - 42, text: "かみつき", color: elementColors.earth, life: 0.52 });
  if (isCharge) state.particles.push({ x: target.x, y: target.y - 42, text: "突進", color: elementColors.earth, life: 0.52 });
  if (isScratch) state.particles.push({ x: target.x, y: target.y - 42, text: "引っ掻き", color: elementColors.earth, life: 0.52 });
}

function currentFormationAnchor(state: GameState) {
  ensureFormationIndex(state);
  const aliveEntries = state.heroes
    .map((hero, index) => ({ hero, index }))
    .filter(({ hero }) => hero.hp > 0);
  const entries = aliveEntries.length > 0 ? aliveEntries : state.heroes.map((hero, index) => ({ hero, index }));
  const heroCenter = entries.reduce(
    (center, { hero }) => ({ x: center.x + hero.x / entries.length, y: center.y + hero.y / entries.length }),
    { x: 0, y: 0 }
  );
  const slotCenter = entries.reduce(
    (center, { index }) => ({
      x: center.x + formationSlotForHero(state, index).x / entries.length,
      y: center.y + formationSlotForHero(state, index).y / entries.length
    }),
    { x: 0, y: 0 }
  );

  return clampFormationAnchor(state, {
    x: heroCenter.x - slotCenter.x,
    y: heroCenter.y - slotCenter.y
  });
}

function moveHeroToFormationSlot(state: GameState, heroIndex: number) {
  ensureFormationIndex(state);
  const slot = formationSlotForHero(state, heroIndex);
  const anchor = currentFormationAnchor(state);
  const target = clampFormationAnchor(state, { x: anchor.x, y: anchor.y });
  const hero = state.heroes[heroIndex];
  hero.x = clamp(target.x + slot.x, 80, playableWidth(state) - 160);
  hero.y = clamp(target.y + slot.y, 96, playableBottom(state));
}

function setHeroHp(state: GameState, hero: Hero, heroIndex: number, hp: number) {
  const wasDown = hero.hp <= 0;
  const stats = heroStats(hero);
  const nextHp = clamp(hp, 0, stats.maxHp);
  if (wasDown && nextHp > 0) moveHeroToFormationSlot(state, heroIndex);
  hero.hp = nextHp;
  if (!wasDown && nextHp <= 0 && state.selected === heroIndex) selectNextAliveHero(state, heroIndex);
}

function selectNextAliveHero(state: GameState, fromIndex: number) {
  for (let offset = 1; offset <= state.heroes.length; offset += 1) {
    const nextIndex = (fromIndex + offset) % state.heroes.length;
    const nextHero = state.heroes[nextIndex];
    if (nextHero.hp <= 0) continue;
    state.selected = nextIndex;
    state.status = `${state.heroes[fromIndex].name}が倒れたため、${nextHero.name}を選択中。`;
    addLog(state, `${nextHero.name}に選択を切り替え。`);
    return;
  }
}

function clampFormationAnchor(state: GameState, anchor: Point) {
  ensureFormationIndex(state);
  const slots = state.heroes.map((_, index) => formationSlotForHero(state, index));
  const minX = Math.max(...slots.map((slot) => 80 - slot.x));
  const maxX = Math.min(...slots.map((slot) => playableWidth(state) - 160 - slot.x));
  const minY = Math.max(...slots.map((slot) => 96 - slot.y));
  const maxY = Math.min(...slots.map((slot) => playableBottom(state) - slot.y));

  return {
    x: clamp(anchor.x, minX, maxX),
    y: clamp(anchor.y, minY, maxY)
  };
}

function queueFormationMove(state: GameState) {
  ensureFormationIndex(state);
  state.targetPoint = currentFormationAnchor(state);
  state.orderPulse = 0.55;
  state.status = `隊列「${formations[state.formation].name}」に変更。`;
}

function movePartyWithKeyboard(state: GameState, dt: number) {
  const x = Number(state.movement.right) - Number(state.movement.left);
  const y = Number(state.movement.down) - Number(state.movement.up);
  if (x === 0 && y === 0) return false;

  const length = Math.hypot(x, y) || 1;
  const inputX = x / length;
  const inputY = y / length;
  const right = { x: Math.cos(state.cameraYaw), y: -Math.sin(state.cameraYaw) };
  const down = { x: Math.sin(state.cameraYaw), y: Math.cos(state.cameraYaw) };
  const movement = {
    x: right.x * inputX + down.x * inputY,
    y: right.y * inputX + down.y * inputY
  };
  const speed = STANDARD_MOVEMENT_SPEED;
  setFormationFront(state, movement, dt * 3.5);
  const anchor = currentFormationAnchor(state);
  anchor.x += movement.x * speed * dt;
  anchor.y += movement.y * speed * dt;
  const clampedAnchor = clampFormationAnchor(state, anchor);
  state.targetPoint = null;
  state.orderPulse = Math.max(state.orderPulse, 0.18);

  moveHeroesToFormationAnchor(state, clampedAnchor, dt, 0.65, { ...movement, speed });
  return true;
}

function formationSlotPoint(state: GameState, anchor: Point, index: number) {
  const slot = formationSlotForHero(state, index);
  return {
    x: anchor.x + slot.x,
    y: anchor.y + slot.y
  };
}

function movementDrift(from: Point, to: Point, speed: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 8) return undefined;
  return {
    x: dx / length,
    y: dy / length,
    speed
  };
}

function clearArrivedMoveTarget(state: GameState) {
  if (!state.targetPoint) return;
  if (distance(currentFormationAnchor(state), state.targetPoint) <= MOVE_TARGET_ARRIVAL_DISTANCE) {
    state.targetPoint = null;
  }
}

function heroHasAttackStance(state: GameState, hero: Hero) {
  if (hero.hp <= 0) return false;
  if (hero.attacking) return true;
  const target = nearestEnemy(state, hero);
  return !!target && distance(hero, target) <= heroStats(hero).range;
}

function moveHeroesToFormationAnchor(state: GameState, anchor: Point, dt: number, multiplier = 1.2, drift?: Point & { speed: number }, holdAttackStance = false) {
  for (const [index, hero] of state.heroes.entries()) {
    if (hero.hp <= 0) continue;
    if (holdAttackStance && heroHasAttackStance(state, hero)) {
      const target = nearestEnemy(state, hero);
      if (target) faceToward(hero, target);
      hero.moving = false;
      continue;
    }
    let driftFacing: number | null = null;
    if (drift) {
      const stats = heroStats(hero);
      const step = Math.min(drift.speed, stats.speed) * dt;
      hero.x += drift.x * step;
      hero.y += drift.y * step;
      driftFacing = Math.atan2(drift.x, drift.y);
      hero.facing = driftFacing;
      hero.moving = true;
      hero.runTime = (hero.runTime ?? 0) + step * HERO_RUN_CYCLE_STEP_SCALE;
    }
    moveToward(hero, formationSlotPoint(state, anchor, index), dt, multiplier, heroStats(hero).speed);
    if (driftFacing !== null) hero.facing = driftFacing;
    hero.x = clamp(hero.x, 80, playableWidth(state) - 160);
    hero.y = clamp(hero.y, 96, playableBottom(state));
  }
}

function keepFormationDuringCombat(state: GameState, dt: number) {
  let anchor = currentFormationAnchor(state);
  const target = nearestEnemyToPoint(state, anchor, partyDetectionRange(state));
  if (!target) {
    moveHeroesToFormationAnchor(state, anchor, dt, 0.75);
    return false;
  }
  setFormationFrontToward(state, anchor, target, dt * 3.2);
  anchor = currentFormationAnchor(state);

  const aliveEntries = state.heroes
    .map((hero, index) => ({ hero, index }))
    .filter(({ hero }) => hero.hp > 0);
  const needsApproach = aliveEntries.some(({ hero, index }) => distance(formationSlotPoint(state, anchor, index), target) > heroStats(hero).range * 0.92);
  if (!needsApproach) {
    moveHeroesToFormationAnchor(state, anchor, dt, 0.9, undefined, true);
    return false;
  }

  const slowestSpeed = Math.min(...aliveEntries.map(({ hero }) => heroStats(hero).speed));
  const nextAnchor = { ...anchor, speed: slowestSpeed };
  moveToward(nextAnchor, target, dt, 0.78, slowestSpeed);
  const clampedAnchor = clampFormationAnchor(state, nextAnchor);
  moveHeroesToFormationAnchor(state, clampedAnchor, dt, 0.55, movementDrift(anchor, clampedAnchor, slowestSpeed * 0.78), true);
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
  hero.skillCooldowns[key] = skill.cooldown / heroStats(hero).skillCastSpeed;
  addLog(state, `${key.toUpperCase()} ${hero.name}：${skill.name}`);

  const target = nearestEnemy(state, hero);
  const stats = heroStats(hero);
  const physicalPower = stats.physicalAttack;
  const magicPower = stats.magicAttack;
  const healPower = Math.floor(magicPower * 0.8);
  if (target) faceToward(hero, target);
  startSkillAnimation(hero, skill.id);
  emitSkillEffect(state, skill.id, hero, target);

  if (skill.id === "blade-lunge" && target) {
    moveToward(hero, target, 1, 3.2);
    damageWithAccuracy(state, target, stats.accuracy, physicalPower * 1.75, "#fff0a6", hero.element);
  }
  if (skill.id === "blade-cleave") {
    const center = target ?? hero;
    for (const enemy of enemiesNear(state, center, 98)) damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 1.08, "#ffd28a", hero.element);
  }
  if (skill.id === "blade-guard") {
    setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp + 24 + Math.floor(physicalPower * 0.35));
    state.particles.push({ x: hero.x, y: hero.y - 30, text: "guard", color: "#fff0a6", life: 0.9 });
  }
  if (skill.id === "blade-rally") {
    for (const [allyIndex, ally] of state.heroes.entries()) {
      setHeroHp(state, ally, allyIndex, ally.hp + 12 + Math.floor(physicalPower * 0.22));
      ally.mp = clamp(ally.mp + 12, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 30, text: "+", color: "#ffe2a0", life: 0.9 });
    }
  }

  if (skill.id === "cordels-flame-rush" && target) {
    moveToward(hero, target, 1, 3.45);
    damageWithAccuracy(state, target, stats.accuracy, physicalPower * 1.85, "#ff8d62", "fire");
  }
  if (skill.id === "cordels-ash-break") {
    const center = target ?? hero;
    for (const enemy of enemiesNear(state, center, 118)) {
      damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 1.12, "#ffb15f", "fire");
    }
  }
  if (skill.id === "cordels-brand-guard") {
    setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp + 18 + Math.floor(physicalPower * 0.42));
    hero.mp = clamp(hero.mp + 8, 0, stats.maxMp);
    state.particles.push({ x: hero.x, y: hero.y - 30, text: "fire guard", color: "#ff8d62", life: 0.9 });
  }
  if (skill.id === "cordels-warflame") {
    for (const [allyIndex, ally] of state.heroes.entries()) {
      setHeroHp(state, ally, allyIndex, ally.hp + 10 + Math.floor(physicalPower * 0.18));
      ally.mp = clamp(ally.mp + 10, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 30, text: "flame", color: "#ffb15f", life: 0.9 });
    }
    for (const enemy of enemiesNear(state, hero, 160)) damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 0.52, "#ff8d62", "fire");
  }

  if (skill.id === "rifle-shot" && target) damageWithAccuracy(state, target, stats.accuracy, physicalPower * 1.45, "#d9ecff", hero.element);
  if (skill.id === "rifle-grenade" && target) {
    for (const enemy of enemiesNear(state, target, 112)) damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 0.95, "#ffc27a", hero.element);
  }
  if (skill.id === "rifle-smoke") {
    for (const enemy of enemiesNear(state, hero, 190)) {
      enemy.speed *= 0.72;
      damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 0.34, "#c7d5e8", hero.element);
    }
  }
  if (skill.id === "rifle-volley") {
    for (const enemy of state.enemies) {
      if (Math.abs(enemy.y - hero.y) < 94) damageWithAccuracy(state, enemy, stats.accuracy, physicalPower * 1.12, "#d9ecff", hero.element);
    }
  }

  if (skill.id === "staff-heal") {
    for (const [allyIndex, ally] of state.heroes.entries()) {
      setHeroHp(state, ally, allyIndex, ally.hp + 18 + healPower);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "+", color: "#aef2d0", life: 0.9 });
    }
  }
  if (skill.id === "staff-flare" && target) {
    for (const enemy of enemiesNear(state, target, 125)) damageWithAccuracy(state, enemy, stats.accuracy, magicPower * 1.08, "#ffb16f", hero.element);
  }
  if (skill.id === "staff-mana") {
    for (const ally of state.heroes) {
      ally.mp = clamp(ally.mp + 14 + Math.floor(magicPower * 0.45), 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 28, text: "mp", color: "#86d8e5", life: 0.9 });
    }
  }
  if (skill.id === "staff-starfall") {
    for (const enemy of state.enemies) damageWithAccuracy(state, enemy, stats.accuracy, magicPower * 0.9, "#d7b5ff", hero.element);
  }

  if (skill.id === "scout-firstaid") {
    const targetAlly = state.heroes
      .filter((ally) => ally.hp > 0)
      .sort((a, b) => a.hp / heroStats(a).maxHp - b.hp / heroStats(b).maxHp)[0];
    if (targetAlly) {
      setHeroHp(state, targetAlly, state.heroes.indexOf(targetAlly), targetAlly.hp + 18 + healPower);
      state.particles.push({ x: targetAlly.x, y: targetAlly.y - 30, text: "+aid", color: "#b7f0cf", life: 1 });
    }
  }
  if (skill.id === "scout-regeneration") {
    for (const [allyIndex, ally] of state.heroes.entries()) {
      setHeroHp(state, ally, allyIndex, ally.hp + 10 + Math.floor(healPower * 0.55));
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
    for (const [allyIndex, ally] of state.heroes.entries()) {
      setHeroHp(state, ally, allyIndex, ally.hp + 16 + Math.floor(healPower * 0.75));
      ally.mp = clamp(ally.mp + 18, 0, heroStats(ally).maxMp);
      state.particles.push({ x: ally.x, y: ally.y - 32, text: "sanct", color: "#fff0a6", life: 1 });
    }
    for (const enemy of enemiesNear(state, hero, 170)) damageWithAccuracy(state, enemy, stats.accuracy, magicPower * 0.62, "#fff0a6", hero.element);
  }
}

function updateGame(state: GameState, dt: number) {
  if (state.paused) return;

  state.orderPulse = Math.max(0, state.orderPulse - dt);
  for (const hero of state.heroes) {
    hero.moving = false;
    hero.skillTime = Math.max(0, (hero.skillTime ?? 0) - dt);
    if ((hero.skillTime ?? 0) <= 0) hero.skillPose = undefined;
    if (hero.attacking) {
      hero.attackTime += dt;
      if (hero.attackTime > basicAttackMotionDuration(hero)) {
        resolvePendingBasicAttack(state, hero);
        hero.attacking = false;
        hero.attackTime = 0;
      }
    }
  }

  const aliveHeroes = state.heroes.filter((hero) => hero.hp > 0);
  if (aliveHeroes.length === 0) {
    recoverAtTown(state, true);
    return;
  }

  const keyboardMoved = movePartyWithKeyboard(state, dt);
  if (keyboardMoved && warpPartyIfOnPoint(state)) return;

  if (state.targetPoint && !keyboardMoved) {
    const anchor = currentFormationAnchor(state);
    setFormationFrontToward(state, anchor, state.targetPoint, dt * 3.5);
    moveHeroesToFormationAnchor(state, state.targetPoint, dt, 0.45, movementDrift(anchor, state.targetPoint, 150));
    clearArrivedMoveTarget(state);
  }

  if (state.area === "aureleaf") {
    state.enemies = [];
    for (const [heroIndex, hero] of state.heroes.entries()) {
      const stats = heroStats(hero);
      setHeroHp(state, hero, heroIndex, hero.hp + dt * 14);
      hero.mp = clamp(hero.mp + dt * (18 + stats.mpRegen), 0, stats.maxMp);
      hero.cooldown = Math.max(0, hero.cooldown - dt * 1.4);
      for (const key of skillKeys) {
        hero.skillCooldowns[key] = Math.max(0, hero.skillCooldowns[key] - dt * 1.4);
      }
    }
    state.particles = state.particles
      .map((p) => ({ ...p, y: p.y - dt * 24, life: p.life - dt }))
      .filter((p) => p.life > 0);
    return;
  }

  const area = currentArea(state);
  state.spawnTimer -= dt * area.spawnRate;
  state.bossTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy(state);
    state.spawnTimer = 0.75 + Math.random() * Math.max(0.55, 1.9 - Math.min(1, state.score / 2500));
  }
  if (state.bossTimer <= 0) {
    spawnEnemy(state, true);
    state.bossCount += 1;
    state.bossTimer = Math.max(14, area.bossInterval + 14 - state.bossCount * 2);
  }

  if (!state.targetPoint && !keyboardMoved) keepFormationDuringCombat(state, dt);

  for (const hero of state.heroes) {
    if (hero.hp <= 0) continue;
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    for (const key of skillKeys) {
      hero.skillCooldowns[key] = Math.max(0, hero.skillCooldowns[key] - dt);
    }
    const stats = heroStats(hero);
    setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp);
    hero.mp = clamp(hero.mp + dt * stats.mpRegen, 0, stats.maxMp);
    if (hero.attacking) continue;
    if (keyboardMoved) continue;
    if (state.targetPoint) continue;

    const target = nearestEnemy(state, hero);
    if (!target) continue;
    const d = distance(hero, target);
    if (d > stats.range && !state.targetPoint && !keyboardMoved) {
      moveToward(hero, target, dt, 1, stats.speed);
    } else if (d <= stats.range) {
      hero.moving = false;
      faceToward(hero, target);
      if (hero.cooldown > 0) continue;
      beginBasicAttack(hero, target, stats);
      hero.cooldown = basicAttackBaseCooldown(hero) / stats.attackSpeed;
    }
  }

  for (const enemy of state.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const target = nearestHeroForEnemy(enemy, aliveHeroes);
    if (!target) {
      updateBeastRandomWalk(state, enemy, dt);
      continue;
    }
    if (distance(enemy, target) > enemy.radius + 28) {
      enemy.wanderTarget = undefined;
      const step = moveToward(enemy, target, dt);
      enemy.animationTime = (enemy.animationTime ?? 0) + step * enemyAnimationSpeed(enemy);
    } else {
      if (enemy.type === "wolf" || enemy.type === "boar" || enemy.type === "bear") enemy.animationTime = (enemy.animationTime ?? 0) + enemy.speed * dt * enemyAnimationSpeed(enemy);
      if (enemy.cooldown <= 0) {
        performEnemyAttack(state, enemy, target);
        enemy.cooldown = enemy.skill?.id === "bite" ? 1.1 : enemy.skill?.id === "charge" ? 1.38 : enemy.skill?.id === "scratch" ? 1.22 : 1.28;
      }
    }
  }

  const before = state.enemies.length;
  const defeatedEnemies = state.enemies.filter((enemy) => enemy.hp <= 0);
  const defeatedScore = defeatedEnemies.reduce(
    (sum, enemy) => sum + (enemy.type === "boss" ? 300 : enemy.type === "duelist" ? 45 : 25),
    0
  );
  const droppedGold = defeatedEnemies.reduce(
    (sum, enemy) => sum + (enemy.type === "boss" ? 180 : enemy.type === "duelist" ? 38 : 18) + Math.floor(Math.random() * 12),
    0
  );
  const gainedExp = defeatedEnemies.reduce((sum, enemy) => sum + expReward(enemy), 0);
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);
  const defeated = before - state.enemies.length;
  if (defeated > 0) {
    state.score += defeatedScore;
    state.gold += droppedGold;
    grantPartyExp(state, gainedExp);
    addLog(state, `${droppedGold} goldを入手。`);
  }

  state.particles = state.particles
    .map((p) => ({ ...p, y: p.y - dt * 24, life: p.life - dt }))
    .filter((p) => p.life > 0);
}

function setMovementKey(state: GameState, key: string, pressed: boolean) {
  const normalized = key.toLowerCase();
  if (normalized === "w") state.movement.up = pressed;
  if (normalized === "a") state.movement.left = pressed;
  if (normalized === "s") state.movement.down = pressed;
  if (normalized === "d") state.movement.right = pressed;
}

function clearMovement(state: GameState) {
  state.movement.up = false;
  state.movement.down = false;
  state.movement.left = false;
  state.movement.right = false;
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
  if (state.gold < cost) {
    state.status = `${item.name} upgrade needs ${cost} gold.`;
    return;
  }
  state.gold -= cost;
  item.level += 1;
  const stats = heroStats(hero);
  setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp + (item.bonus.maxHp ?? 0));
  hero.mp = clamp(hero.mp + (item.bonus.maxMp ?? 0), 0, stats.maxMp);
  addLog(state, `${hero.name} upgraded ${item.name} to +${item.level}.`);
  state.status = `${item.name} is now +${item.level}.`;
}

function spendGold(state: GameState, cost: number, label: string) {
  if (state.gold < cost) {
    state.status = `${label} needs ${cost} gold.`;
    return false;
  }
  state.gold -= cost;
  return true;
}

function buyEquipment(state: GameState, itemId: string) {
  if (state.area !== "aureleaf") {
    state.status = "Equipment can be bought in Aureleaf.";
    return;
  }
  const item = equipmentCatalog.find((candidate) => candidate.id === itemId);
  if (!item) return;
  if (!spendGold(state, item.price, item.name)) return;
  state.inventory.push(cloneEquipment(item));
  addLog(state, `Bought ${item.name}.`);
  state.status = `Bought ${item.name}. Equip it from inventory.`;
}

function equipInventoryItem(state: GameState, index: number) {
  const item = state.inventory[index];
  if (!item) return;
  const hero = state.heroes[state.selected];
  const previous = hero.equipment[item.slot];
  hero.equipment[item.slot] = item;
  state.inventory.splice(index, 1, previous);
  const stats = heroStats(hero);
  setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp);
  hero.mp = clamp(hero.mp, 0, stats.maxMp);
  addLog(state, `${hero.name} equipped ${item.name}.`);
  state.status = `${hero.name} changed ${item.slot} to ${item.name}.`;
}

function buyConsumable(state: GameState, itemId: ConsumableId) {
  if (state.area !== "aureleaf") {
    state.status = "Items can be bought in Aureleaf.";
    return;
  }
  const item = consumableCatalog.find((candidate) => candidate.id === itemId);
  if (!item) return;
  if (!spendGold(state, item.price, item.name)) return;
  const stack = state.consumables.find((candidate) => candidate.item.id === item.id);
  if (stack) {
    stack.count += 1;
  } else {
    state.consumables.push({ item: structuredClone(item), count: 1 });
  }
  addLog(state, `Bought ${item.name}.`);
  state.status = `${item.name}を購入しました。`;
}

function useConsumable(state: GameState, itemId: ConsumableId) {
  const stack = state.consumables.find((candidate) => candidate.item.id === itemId);
  if (!stack || stack.count <= 0) {
    state.status = "ポーションを持っていません。";
    return;
  }
  const hero = state.heroes[state.selected];
  if (hero.hp <= 0) {
    state.status = `${hero.name}は戦闘不能です。`;
    return;
  }
  const before = hero.hp;
  setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp + stack.item.healHp);
  stack.count -= 1;
  if (stack.count <= 0) {
    state.consumables = state.consumables.filter((candidate) => candidate.count > 0);
  }
  const healed = Math.round(hero.hp - before);
  state.particles.push({ x: hero.x, y: hero.y - 32, text: `+${healed}`, color: "#7dffb2", life: 0.85 });
  addLog(state, `${hero.name} used ${stack.item.name}.`);
  state.status = `${hero.name}のHPが${healed}回復しました。`;
}

function useTownShop(state: GameState, shop: ShopId) {
  if (state.area !== "aureleaf") {
    state.status = "町の施設は町で利用できます。";
    return;
  }

  if (shop === "weapon") {
    upgradeEquipment(state, "weapon");
    return;
  }

  if (shop === "armor") {
    upgradeEquipment(state, "armor");
    return;
  }

  if (shop === "item") {
    const cost = shops.item.cost;
    if (!spendGold(state, cost, shops.item.name)) return;
    for (const hero of state.heroes) {
      const stats = heroStats(hero);
      hero.mp = clamp(hero.mp + 42, 0, stats.maxMp);
      for (const key of skillKeys) {
        hero.skillCooldowns[key] = Math.max(0, hero.skillCooldowns[key] - 3.5);
      }
    }
    addLog(state, "道具屋で補給しました。");
    state.status = "道具屋で全員のMPとスキル準備を整えました。";
    return;
  }

  const cost = shops.inn.cost;
  if (!spendGold(state, cost, shops.inn.name)) return;
  for (const hero of state.heroes) {
    const stats = heroStats(hero);
    setHeroHp(state, hero, state.heroes.indexOf(hero), stats.maxHp);
    hero.mp = stats.maxMp;
    hero.cooldown = 0;
    for (const key of skillKeys) {
      hero.skillCooldowns[key] = 0;
    }
  }
  addLog(state, "宿屋で休息しました。");
  state.status = "宿屋で全員が全回復しました。";
}

class GameEngine {
  readonly state: GameState;

  constructor() {
    this.state = createGameState();
  }

  snapshot() {
    return snapshotHud(this.state);
  }

  update(dt: number) {
    updateGame(this.state, dt);
  }

  selectHero(index: number) {
    this.state.selected = Math.trunc(clamp(index, 0, this.state.heroes.length - 1));
    this.state.status = `${this.state.heroes[this.state.selected].name} を選択中。`;
  }

  toggleHold() {
    this.state.paused = !this.state.paused;
  }

  changeFormation() {
    ensureFormationIndex(this.state);
    this.state.formation = (this.state.formation + 1) % formations.length;
    addLog(this.state, `隊列を ${formations[this.state.formation].name} に変更。`);
    queueFormationMove(this.state);
  }

  swapPartyMember(activeIndex: number, reserveIndex: number) {
    ensureFormationIndex(this.state);
    const activeSlot = Math.trunc(clamp(activeIndex, 0, this.state.heroes.length - 1));
    const reserveSlot = Math.trunc(clamp(reserveIndex, 0, this.state.reserveHeroes.length - 1));
    const activeHero = this.state.heroes[activeSlot];
    const reserveHero = this.state.reserveHeroes[reserveSlot];
    if (!activeHero || !reserveHero) return;

    const anchor = currentFormationAnchor(this.state);
    const formationSlot = formations[this.state.formation].slots[activeSlot];
    const incoming = structuredClone(reserveHero);
    const outgoing = structuredClone(activeHero);
    incoming.x = clamp(anchor.x + formationSlot.x, 80, playableWidth(this.state) - 160);
    incoming.y = clamp(anchor.y + formationSlot.y, 96, playableBottom(this.state));
    outgoing.x = 0;
    outgoing.y = 0;

    this.state.heroes[activeSlot] = incoming;
    this.state.reserveHeroes[reserveSlot] = outgoing;
    this.state.selected = activeSlot;
    this.state.targetPoint = null;
    this.state.orderPulse = 0.55;
    addLog(this.state, `${incoming.name} joined the party.`);
    this.state.status = `${incoming.name} is now in slot ${activeSlot + 1}.`;
  }

  changeArea(area: AreaId) {
    if (changeAreaState(this.state, area)) return;
    if (this.state.area === area) return;
    const fromArea = this.state.area;
    this.state.area = area;
    this.state.enemies = [];
    this.state.particles = [];
    this.state.targetPoint = null;
    this.state.spawnTimer = area === "spiritRootCave01" ? 0.65 : 1.1;
    this.state.bossTimer = areas[area].bossInterval;
    this.state.status = `${areas[area].name}へ移動しました。${areas[area].description}`;
    addLog(this.state, `${areas[area].name}へ移動。`);
    if (area === "aureleaf") {
      for (const hero of this.state.heroes) {
        const stats = heroStats(hero);
        setHeroHp(this.state, hero, this.state.heroes.indexOf(hero), hero.hp + 34);
        hero.mp = clamp(hero.mp + 28, 0, stats.maxMp);
      }
    }
    if ((fromArea === "aureleaf" && area === "spiritTreeForest01") || (fromArea === "spiritTreeForest01" && area === "aureleaf")) {
      movePartyToAreaEntry(this.state, fromArea);
    }
  }

  setMovement(key: string, pressed: boolean) {
    setMovementKey(this.state, key, pressed);
    if (pressed) this.state.status = "WASDで家門を移動中。";
  }

  clearMovement() {
    clearMovement(this.state);
  }

  setMoveTarget(point: Point) {
    ensureFormationIndex(this.state);
    this.state.targetPoint = {
      x: clamp(point.x, 100, playableWidth(this.state) - 160),
      y: clamp(point.y, 108, playableBottom(this.state))
    };
    this.state.orderPulse = 0.55;
    this.state.status = `隊列「${formations[this.state.formation].name}」で移動命令。`;
  }

  selectAt(point: Point) {
    const warpPoint = warpPointsForArea(this.state).find((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y) < 120);
    if (warpPoint) {
      this.changeArea(warpPoint.target);
      return;
    }
    const clickedHero = this.state.heroes.findIndex((hero) => Math.hypot(hero.x - point.x, hero.y - point.y) < 42);
    if (clickedHero >= 0) {
      this.selectHero(clickedHero);
      return;
    }
    const clickedEnemy = this.state.enemies.find((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - point.x, enemy.y - point.y) < enemy.radius + 48);
    if (clickedEnemy) {
      this.state.targetPoint = null;
      clearMovement(this.state);
      const selectedHero = this.state.heroes[this.state.selected];
      if (selectedHero?.hp > 0) faceToward(selectedHero, clickedEnemy);
      this.state.status = "敵をターゲット。攻撃態勢に移行。";
      return;
    }
    this.setMoveTarget(point);
  }

  triggerSkill(key: SkillKey) {
    useSkill(this.state, key);
  }

  enhanceEquipment(slot: EquipmentSlot) {
    upgradeEquipment(this.state, slot);
  }

  useTownShop(shop: ShopId) {
    useTownShop(this.state, shop);
  }

  buyEquipment(itemId: string) {
    buyEquipment(this.state, itemId);
  }

  equipInventoryItem(index: number) {
    equipInventoryItem(this.state, index);
  }

  buyConsumable(itemId: ConsumableId) {
    buyConsumable(this.state, itemId);
  }

  useConsumable(itemId: ConsumableId) {
    useConsumable(this.state, itemId);
  }
}
function snapshotHud(state: GameState): HudState {
  ensureFormationIndex(state);
  return {
    selected: state.selected,
    paused: state.paused,
    area: state.area,
    formation: state.formation,
    score: state.score,
    gold: state.gold,
    bossCount: state.bossCount,
    heroes: structuredClone(state.heroes),
    reserveHeroes: structuredClone(state.reserveHeroes),
    inventory: structuredClone(state.inventory),
    consumables: structuredClone(state.consumables),
    logs: [...state.logs],
    status: state.status
  };
}


export {
  GameEngine,
  areaOrder,
  areas,
  clamp,
  consumableCatalog,
  elementColors,
  elementLabels,
  equipmentCatalog,
  formations,
  heroStats,
  isMovementKey,
  playableBottom,
  playableWidth,
  shopOrder,
  shops,
  skillKeys,
  upgradeCost,
  warpPointForArea,
  warpPointsForArea
};

export type { AreaId, ConsumableId, ElementId, Enemy, EquipmentSlot, GameState, Hero, HudState, Point, ShopId, SkillKey, WarpPoint };
