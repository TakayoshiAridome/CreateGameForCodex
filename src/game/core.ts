
type Point = { x: number; y: number };
type Weapon = "sword" | "rifle" | "staff" | "scout";
type SkillKey = "e" | "r" | "t" | "y";
type AreaId = "town" | "field" | "dungeon";
type ShopId = "weapon" | "armor" | "item" | "inn";
type ConsumableId = "potion";

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
  id: string;
  slot: EquipmentSlot;
  name: string;
  level: number;
  price: number;
  bonus: EquipmentBonus;
};

type ConsumableItem = {
  id: ConsumableId;
  name: string;
  description: string;
  price: number;
  healHp: number;
};

type ConsumableStack = {
  item: ConsumableItem;
  count: number;
};

type Hero = Point & {
  name: string;
  role: string;
  level: number;
  exp: number;
  nextExp: number;
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

type AreaDefinition = {
  id: AreaId;
  name: string;
  description: string;
  spawnRate: number;
  bossInterval: number;
  enemyScale: number;
};

type ShopDefinition = {
  id: ShopId;
  name: string;
  description: string;
  cost: number;
};

type GameState = {
  view: { w: number; h: number };
  selected: number;
  paused: boolean;
  area: AreaId;
  formation: number;
  score: number;
  gold: number;
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
  inventory: Equipment[];
  consumables: ConsumableStack[];
  enemies: Enemy[];
  particles: Particle[];
  logs: string[];
  status: string;
};

type HudState = Pick<
  GameState,
  | "selected"
  | "paused"
  | "area"
  | "formation"
  | "score"
  | "gold"
  | "bossCount"
  | "heroes"
  | "inventory"
  | "consumables"
  | "logs"
  | "status"
>;

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

const areas: Record<AreaId, AreaDefinition> = {
  town: {
    id: "town",
    name: "町",
    description: "補給と回復の拠点。敵は出現しません。",
    spawnRate: 0,
    bossInterval: Infinity,
    enemyScale: 0
  },
  field: {
    id: "field",
    name: "フィールド",
    description: "通常の探索地帯。敵がランダムに出現します。",
    spawnRate: 1,
    bossInterval: 28,
    enemyScale: 1
  },
  dungeon: {
    id: "dungeon",
    name: "ダンジョン",
    description: "危険な地下区域。敵が強く、ボスも早く現れます。",
    spawnRate: 1.45,
    bossInterval: 18,
    enemyScale: 1.35
  }
};

const areaOrder: AreaId[] = ["town", "field", "dungeon"];

const shops: Record<ShopId, ShopDefinition> = {
  weapon: {
    id: "weapon",
    name: "武器屋",
    description: "選択中のキャラクターの武器を強化します。",
    cost: 0
  },
  armor: {
    id: "armor",
    name: "防具屋",
    description: "選択中のキャラクターの防具を強化します。",
    cost: 0
  },
  item: {
    id: "item",
    name: "道具屋",
    description: "全員のMPを回復し、スキル再使用までの時間を短縮します。",
    cost: 90
  },
  inn: {
    id: "inn",
    name: "宿屋",
    description: "全員のHPとMPを全回復します。",
    cost: 160
  }
};

const shopOrder: ShopId[] = ["weapon", "armor", "item", "inn"];

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
  weapon: { id: `starter-weapon-${weaponName}`, slot: "weapon", name: weaponName, level: 1, price: 0, bonus: weaponBonus },
  armor: { id: `starter-armor-${armorName}`, slot: "armor", name: armorName, level: 1, price: 0, bonus: armorBonus },
  trinket: { id: `starter-trinket-${trinketName}`, slot: "trinket", name: trinketName, level: 1, price: 0, bonus: trinketBonus }
});

const equipmentCatalog: Equipment[] = [
  { id: "iron-saber", slot: "weapon", name: "鉄のサーベル", level: 1, price: 140, bonus: { attack: 9 } },
  { id: "duelist-rapier", slot: "weapon", name: "決闘士のレイピア", level: 1, price: 260, bonus: { attack: 14, speed: 6 } },
  { id: "long-rifle", slot: "weapon", name: "ロングライフル", level: 1, price: 240, bonus: { attack: 12, range: 34 } },
  { id: "sage-staff", slot: "weapon", name: "賢者の杖", level: 1, price: 250, bonus: { attack: 10, maxMp: 22 } },
  { id: "guard-coat", slot: "armor", name: "守備隊のコート", level: 1, price: 150, bonus: { maxHp: 42 } },
  { id: "plate-mail", slot: "armor", name: "プレートメイル", level: 1, price: 300, bonus: { maxHp: 72, speed: -8 } },
  { id: "silk-robe", slot: "armor", name: "シルクローブ", level: 1, price: 230, bonus: { maxMp: 30, speed: 5 } },
  { id: "ruby-charm", slot: "trinket", name: "紅玉の護符", level: 1, price: 180, bonus: { attack: 4, maxHp: 18 } },
  { id: "wind-ring", slot: "trinket", name: "疾風の指輪", level: 1, price: 220, bonus: { speed: 14, range: 8 } }
];

function cloneEquipment(item: Equipment): Equipment {
  return structuredClone(item);
}

const consumableCatalog: ConsumableItem[] = [
  {
    id: "potion",
    name: "ポーション",
    description: "選択中のキャラクターのHPを80回復します。",
    price: 35,
    healHp: 80
  }
];

const initialHeroes: Hero[] = [
  {
    name: "アデリア",
    role: "Fencer",
    level: 1,
    exp: 0,
    nextExp: 100,
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
    level: 1,
    exp: 0,
    nextExp: 100,
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
    level: 1,
    exp: 0,
    nextExp: 100,
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
    level: 1,
    exp: 0,
    nextExp: 100,
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
    area: "field",
    formation: 0,
    score: 0,
    gold: 220,
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
    inventory: [],
    consumables: [],
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
  const levelBonus = hero.level - 1;
  return {
    attack: hero.attack + bonus.attack + levelBonus * 3,
    maxHp: hero.maxHp + bonus.maxHp + levelBonus * 18,
    maxMp: hero.maxMp + bonus.maxMp + levelBonus * 7,
    range: hero.range + bonus.range + Math.floor(levelBonus / 3) * 4,
    speed: hero.speed + bonus.speed + levelBonus * 2
  };
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

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function combatBottom(state: GameState) {
  return state.view.h - (state.view.w < 700 ? 285 : 118);
}

function addLog(state: GameState, text: string) {
  state.logs = [text, ...state.logs].slice(0, 8);
}

function currentArea(state: GameState) {
  return areas[state.area];
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
  if (state.area === "town") return;
  const point = randomSpawnPoint(state);
  const area = currentArea(state);
  const elite = !boss && Math.random() < 0.18 + Math.min(0.18, state.score / 5000);
  const pressure = (1 + Math.min(1.6, state.score / 2200)) * area.enemyScale;
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

  state.orderPulse = Math.max(0, state.orderPulse - dt);

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

  if (state.area === "town") {
    state.enemies = [];
    for (const hero of state.heroes) {
      const stats = heroStats(hero);
      hero.hp = clamp(hero.hp + dt * 14, 0, stats.maxHp);
      hero.mp = clamp(hero.mp + dt * 18, 0, stats.maxMp);
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
  hero.hp = clamp(hero.hp + (item.bonus.maxHp ?? 0), 0, stats.maxHp);
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
  if (state.area !== "town") {
    state.status = "Equipment can be bought in town.";
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
  hero.hp = clamp(hero.hp, 0, stats.maxHp);
  hero.mp = clamp(hero.mp, 0, stats.maxMp);
  addLog(state, `${hero.name} equipped ${item.name}.`);
  state.status = `${hero.name} changed ${item.slot} to ${item.name}.`;
}

function buyConsumable(state: GameState, itemId: ConsumableId) {
  if (state.area !== "town") {
    state.status = "Items can be bought in town.";
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
  const stats = heroStats(hero);
  const before = hero.hp;
  hero.hp = clamp(hero.hp + stack.item.healHp, 0, stats.maxHp);
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
  if (state.area !== "town") {
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
    hero.hp = stats.maxHp;
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
    this.state.formation = (this.state.formation + 1) % formations.length;
    addLog(this.state, `隊列を ${formations[this.state.formation].name} に変更。`);
    queueFormationMove(this.state);
  }

  changeArea(area: AreaId) {
    if (this.state.area === area) return;
    this.state.area = area;
    this.state.enemies = [];
    this.state.particles = [];
    this.state.targetPoint = null;
    this.state.spawnTimer = area === "dungeon" ? 0.65 : 1.1;
    this.state.bossTimer = areas[area].bossInterval;
    this.state.status = `${areas[area].name}へ移動しました。${areas[area].description}`;
    addLog(this.state, `${areas[area].name}へ移動。`);
    if (area === "town") {
      for (const hero of this.state.heroes) {
        const stats = heroStats(hero);
        hero.hp = clamp(hero.hp + 34, 0, stats.maxHp);
        hero.mp = clamp(hero.mp + 28, 0, stats.maxMp);
      }
    }
  }

  setMovement(key: string, pressed: boolean) {
    setMovementKey(this.state, key, pressed);
    if (pressed) this.state.status = "WASDで家門を移動中。";
  }

  setMoveTarget(point: Point) {
    this.state.targetPoint = {
      x: clamp(point.x, 100, this.state.view.w - 160),
      y: clamp(point.y, 108, combatBottom(this.state))
    };
    this.state.orderPulse = 0.55;
    this.state.status = `隊列「${formations[this.state.formation].name}」で移動命令。`;
  }

  selectAt(point: Point) {
    const clickedHero = this.state.heroes.findIndex((hero) => Math.hypot(hero.x - point.x, hero.y - point.y) < 42);
    if (clickedHero >= 0) {
      this.selectHero(clickedHero);
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
  return {
    selected: state.selected,
    paused: state.paused,
    area: state.area,
    formation: state.formation,
    score: state.score,
    gold: state.gold,
    bossCount: state.bossCount,
    heroes: structuredClone(state.heroes),
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
  equipmentCatalog,
  formations,
  heroStats,
  isMovementKey,
  shopOrder,
  shops,
  skillKeys,
  upgradeCost
};

export type { AreaId, ConsumableId, Enemy, EquipmentSlot, GameState, Hero, HudState, Point, ShopId, SkillKey };
