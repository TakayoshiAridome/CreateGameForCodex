
type Point = { x: number; y: number };
type Weapon = "sword" | "rifle" | "staff" | "scout";
type SkillKey = "e" | "r" | "t" | "y";
type AreaId = "town" | "field" | "dungeon";
type ShopId = "weapon" | "armor" | "item" | "inn";
type ConsumableId = "potion";
type ElementId = "neutral" | "fire" | "water" | "wind" | "earth" | "light" | "dark";

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
  element: ElementId;
  facing: number;
  moving: boolean;
  runTime: number;
  attacking: boolean;
  attackTime: number;
  str: number;
  vit: number;
  agi: number;
  int: number;
  dex: number;
  men: number;
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
  element: ElementId;
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
  cameraYaw: number;
  targetPoint: Point | null;
  movement: {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
  };
  orderPulse: number;
  heroes: Hero[];
  reserveHeroes: Hero[];
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
  | "reserveHeroes"
  | "inventory"
  | "consumables"
  | "logs"
  | "status"
>;

const formations: Formation[] = [
  {
    name: "スペキュレイション風",
    slots: [{ x: 44, y: 0 }, { x: -18, y: -44 }, { x: -76, y: 42 }, { x: -146, y: 0 }]
  },
  {
    name: "ワールウインド風",
    slots: [{ x: 18, y: -72 }, { x: 18, y: 72 }, { x: -78, y: -42 }, { x: -78, y: 42 }]
  },
  {
    name: "鳳天舞の陣風",
    slots: [{ x: -24, y: 0 }, { x: -104, y: -68 }, { x: -104, y: 68 }, { x: -164, y: 0 }]
  },
  {
    name: "玄武陣風",
    slots: [{ x: -28, y: -34 }, { x: -28, y: 34 }, { x: -108, y: -34 }, { x: -108, y: 34 }]
  },
  {
    name: "パワーレイズ風",
    slots: [{ x: -18, y: 0 }, { x: -90, y: -58 }, { x: -90, y: 58 }, { x: -156, y: 0 }]
  },
  {
    name: "虎穴陣風",
    slots: [{ x: -72, y: -52 }, { x: -72, y: 52 }, { x: -12, y: 0 }, { x: -142, y: 0 }]
  },
  {
    name: "デザートランス風",
    slots: [{ x: 52, y: 0 }, { x: -48, y: -64 }, { x: -48, y: 64 }, { x: -136, y: 0 }]
  }
];

const skillKeys: SkillKey[] = ["e", "r", "t", "y"];

const elementLabels: Record<ElementId, string> = {
  neutral: "無",
  fire: "火",
  water: "水",
  wind: "風",
  earth: "土",
  light: "光",
  dark: "闇"
};

const elementColors: Record<ElementId, string> = {
  neutral: "#d9c7aa",
  fire: "#ff8d62",
  water: "#72b7ff",
  wind: "#9de08f",
  earth: "#d4a76a",
  light: "#fff0a6",
  dark: "#b58cff"
};

const elementAdvantage: Partial<Record<ElementId, ElementId>> = {
  fire: "wind",
  wind: "earth",
  earth: "water",
  water: "fire",
  light: "dark",
  dark: "light"
};

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
    role: "ファイター",
    level: 1,
    exp: 0,
    nextExp: 100,
    color: "#314f8f",
    trim: "#f2c772",
    hair: "#5b3027",
    accent: "#efe4d0",
    weapon: "sword",
    element: "fire",
    facing: 0,
    moving: false,
    runTime: 0,
    attacking: false,
    attackTime: 0,
    str: 15,
    vit: 13,
    agi: 12,
    int: 7,
    dex: 10,
    men: 8,
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
    role: "ガンナー",
    level: 1,
    exp: 0,
    nextExp: 100,
    color: "#56636f",
    trim: "#ffd87b",
    hair: "#d7d0c5",
    accent: "#8f3143",
    weapon: "rifle",
    element: "wind",
    facing: 0,
    moving: false,
    runTime: 0,
    attacking: false,
    attackTime: 0,
    str: 9,
    vit: 9,
    agi: 11,
    int: 8,
    dex: 16,
    men: 9,
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
    role: "ウィザード",
    level: 1,
    exp: 0,
    nextExp: 100,
    color: "#7f4168",
    trim: "#86d8e5",
    hair: "#f1c16e",
    accent: "#fff0d5",
    weapon: "staff",
    element: "water",
    facing: 0,
    moving: false,
    runTime: 0,
    attacking: false,
    attackTime: 0,
    str: 6,
    vit: 8,
    agi: 9,
    int: 17,
    dex: 11,
    men: 14,
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
    role: "ヒーラー",
    level: 1,
    exp: 0,
    nextExp: 100,
    color: "#3c7f63",
    trim: "#b7f0cf",
    hair: "#334039",
    accent: "#f4f0dc",
    weapon: "scout",
    element: "light",
    facing: 0,
    moving: false,
    runTime: 0,
    attacking: false,
    attackTime: 0,
    str: 7,
    vit: 10,
    agi: 16,
    int: 13,
    dex: 13,
    men: 16,
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

function createReserveHeroes(): Hero[] {
  const reserves = structuredClone([initialHeroes[0], initialHeroes[1], initialHeroes[2], initialHeroes[0]]);

  reserves[0] = {
    ...reserves[0],
    name: "Leona",
    role: "ファイター",
    color: "#8a4f52",
    trim: "#ffd7a2",
    hair: "#3e2c2e",
    accent: "#f4e2c0",
    element: "earth",
    hp: 186,
    maxHp: 186,
    mp: 54,
    maxMp: 76,
    str: 16,
    vit: 16,
    agi: 9,
    int: 6,
    dex: 9,
    men: 9,
    attack: 22,
    speed: 152,
    x: 0,
    y: 0,
    skillCooldowns: emptySkillCooldowns()
  };

  reserves[1] = {
    ...reserves[1],
    name: "Noel",
    role: "ガンナー",
    color: "#445d79",
    trim: "#cde6ff",
    hair: "#1f2735",
    accent: "#e8eef5",
    element: "water",
    hp: 118,
    maxHp: 118,
    mp: 84,
    maxMp: 106,
    str: 8,
    vit: 8,
    agi: 12,
    int: 9,
    dex: 18,
    men: 8,
    attack: 24,
    range: 284,
    speed: 136,
    x: 0,
    y: 0,
    skillCooldowns: emptySkillCooldowns()
  };

  reserves[2] = {
    ...reserves[2],
    name: "Fiona",
    role: "ウィザード",
    color: "#5f4b91",
    trim: "#d8c6ff",
    hair: "#e8d49c",
    accent: "#fff4de",
    element: "dark",
    hp: 104,
    maxHp: 104,
    mp: 122,
    maxMp: 148,
    str: 5,
    vit: 7,
    agi: 10,
    int: 18,
    dex: 12,
    men: 15,
    attack: 15,
    range: 196,
    speed: 138,
    x: 0,
    y: 0,
    skillCooldowns: emptySkillCooldowns()
  };

  reserves[3] = {
    ...reserves[3],
    name: "ルシェリア",
    role: "ファイター",
    color: "#171d31",
    trim: "#d5a85d",
    hair: "#e8c690",
    accent: "#f7f0e4",
    element: "light",
    hp: 174,
    maxHp: 174,
    mp: 66,
    maxMp: 88,
    str: 17,
    vit: 13,
    agi: 13,
    int: 8,
    dex: 13,
    men: 10,
    attack: 25,
    range: 54,
    speed: 170,
    x: 0,
    y: 0,
    skills: [
      { key: "e", id: "blade-lunge", name: "セレスティアスラスト", cost: 30, cooldown: 4 },
      { key: "r", id: "blade-cleave", name: "スタークロス", cost: 36, cooldown: 5.4 },
      { key: "t", id: "blade-guard", name: "ルミナスガード", cost: 26, cooldown: 7 },
      { key: "y", id: "blade-rally", name: "ソードセイント", cost: 44, cooldown: 9.2 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "セレスティアブレード",
      "星光の騎士鎧",
      "リボンの聖印",
      { attack: 8 },
      { maxHp: 30, speed: 3 },
      { maxMp: 10, attack: 3 }
    )
  };

  return reserves;
}

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
    cameraYaw: 0.725,
    targetPoint: null,
    movement: {
      up: false,
      down: false,
      left: false,
      right: false
    },
    orderPulse: 0,
    heroes: structuredClone(initialHeroes),
    reserveHeroes: createReserveHeroes(),
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
    speed: hero.speed + bonus.speed + levelBonus * 2,
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

  state.area = "town";
  state.paused = false;
  state.enemies = [];
  state.particles = [];
  state.targetPoint = null;
  state.spawnTimer = 1.1;
  state.bossTimer = areas.field.bossInterval;
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
  addLog(state, penalty ? "Party wiped out. Returned to town." : "Recovered in town.");
  state.status = penalty
    ? "Party wiped out. EXP and Gold decreased by 10%, then returned to town."
    : "The party recovered in town.";
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
  if (d < 2) return;
  faceToward(unit, point);
  const step = Math.min(d, (speedOverride ?? unit.speed) * multiplier * dt);
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
  const animatedUnit = unit as Point & { moving?: boolean; runTime?: number };
  if ("moving" in animatedUnit) {
    animatedUnit.moving = true;
    animatedUnit.runTime = (animatedUnit.runTime ?? 0) + step * 0.055;
  }
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
  const enemyElements: ElementId[] = ["fire", "water", "wind", "earth", "dark"];
  state.enemies.push({
    type: boss ? "boss" : elite ? "duelist" : "corsair",
    element: boss ? (state.bossCount % 2 === 0 ? "dark" : "light") : enemyElements[Math.floor(Math.random() * enemyElements.length)],
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
  const aliveEntries = state.heroes
    .map((hero, index) => ({ hero, index }))
    .filter(({ hero }) => hero.hp > 0);
  const entries = aliveEntries.length > 0 ? aliveEntries : state.heroes.map((hero, index) => ({ hero, index }));
  const heroCenter = entries.reduce(
    (center, { hero }) => ({ x: center.x + hero.x / entries.length, y: center.y + hero.y / entries.length }),
    { x: 0, y: 0 }
  );
  const slots = formations[state.formation].slots;
  const slotCenter = entries.reduce(
    (center, { index }) => ({
      x: center.x + slots[index].x / entries.length,
      y: center.y + slots[index].y / entries.length
    }),
    { x: 0, y: 0 }
  );

  return clampFormationAnchor(state, {
    x: heroCenter.x - slotCenter.x,
    y: heroCenter.y - slotCenter.y
  });
}

function moveHeroToFormationSlot(state: GameState, heroIndex: number) {
  const slot = formations[state.formation].slots[heroIndex];
  const anchor = currentFormationAnchor(state);
  const target = clampFormationAnchor(state, { x: anchor.x, y: anchor.y });
  const hero = state.heroes[heroIndex];
  hero.x = clamp(target.x + slot.x, 80, state.view.w - 160);
  hero.y = clamp(target.y + slot.y, 96, combatBottom(state));
}

function setHeroHp(state: GameState, hero: Hero, heroIndex: number, hp: number) {
  const wasDown = hero.hp <= 0;
  const stats = heroStats(hero);
  const nextHp = clamp(hp, 0, stats.maxHp);
  if (wasDown && nextHp > 0) moveHeroToFormationSlot(state, heroIndex);
  hero.hp = nextHp;
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
  const inputX = x / length;
  const inputY = y / length;
  const right = { x: Math.cos(state.cameraYaw), y: -Math.sin(state.cameraYaw) };
  const down = { x: Math.sin(state.cameraYaw), y: Math.cos(state.cameraYaw) };
  const movement = {
    x: right.x * inputX + down.x * inputY,
    y: right.y * inputX + down.y * inputY
  };
  const speed = 178;
  const anchor = currentFormationAnchor(state);
  anchor.x += movement.x * speed * dt;
  anchor.y += movement.y * speed * dt;
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
  hero.skillCooldowns[key] = skill.cooldown / heroStats(hero).skillCastSpeed;
  addLog(state, `${key.toUpperCase()} ${hero.name}：${skill.name}`);

  const target = nearestEnemy(state, hero);
  const stats = heroStats(hero);
  const physicalPower = stats.physicalAttack;
  const magicPower = stats.magicAttack;
  const healPower = Math.floor(magicPower * 0.8);
  if (target) faceToward(hero, target);

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
    if (hero.attacking) {
      hero.attackTime += dt;
      if (hero.attackTime > 0.55) {
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

  for (const hero of state.heroes) {
    if (hero.hp <= 0) continue;
    hero.cooldown = Math.max(0, hero.cooldown - dt);
    for (const key of skillKeys) {
      hero.skillCooldowns[key] = Math.max(0, hero.skillCooldowns[key] - dt);
    }
    const stats = heroStats(hero);
    setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp);
    hero.mp = clamp(hero.mp + dt * stats.mpRegen, 0, stats.maxMp);

    const target = nearestEnemy(state, hero);
    if (!target) continue;
    const d = distance(hero, target);
    if (d > stats.range && !state.targetPoint && !keyboardMoved) {
      moveToward(hero, target, dt, 0.62, stats.speed);
    } else if (d <= stats.range && hero.cooldown <= 0) {
      faceToward(hero, target);
      hero.attacking = true;
      hero.attackTime = 0;
      if (damageWithAccuracy(state, target, stats.accuracy, stats.attack + Math.random() * 6, hero.trim, hero.element)) {
        state.particles.push({ x: hero.x, y: hero.y - 32, text: "hit", color: hero.trim, life: 0.45 });
      }
      const baseCooldown = hero.weapon === "rifle" ? 1.02 : 0.76;
      hero.cooldown = baseCooldown / stats.attackSpeed;
    }
  }

  for (const enemy of state.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const target = aliveHeroes.reduce((best, hero) => (distance(enemy, hero) < distance(enemy, best) ? hero : best), aliveHeroes[0]);
    if (distance(enemy, target) > enemy.radius + 28) {
      moveToward(enemy, target, dt);
    } else if (enemy.cooldown <= 0) {
      const targetStats = heroStats(target);
      if (Math.random() < targetStats.evasion) {
        state.particles.push({ x: target.x, y: target.y - 28, text: "evade", color: "#d9ecff", life: 0.45 });
      } else {
        const mitigatedDamage = Math.max(1, enemy.attack + Math.random() * 4 - targetStats.physicalDefense * 0.35);
        elementalDamage(state, target, mitigatedDamage, "#ff8d75", enemy.element);
      }
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
  setHeroHp(state, hero, state.heroes.indexOf(hero), hero.hp);
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
    this.state.formation = (this.state.formation + 1) % formations.length;
    addLog(this.state, `隊列を ${formations[this.state.formation].name} に変更。`);
    queueFormationMove(this.state);
  }

  swapPartyMember(activeIndex: number, reserveIndex: number) {
    const activeSlot = Math.trunc(clamp(activeIndex, 0, this.state.heroes.length - 1));
    const reserveSlot = Math.trunc(clamp(reserveIndex, 0, this.state.reserveHeroes.length - 1));
    const activeHero = this.state.heroes[activeSlot];
    const reserveHero = this.state.reserveHeroes[reserveSlot];
    if (!activeHero || !reserveHero) return;

    const anchor = currentFormationAnchor(this.state);
    const formationSlot = formations[this.state.formation].slots[activeSlot];
    const incoming = structuredClone(reserveHero);
    const outgoing = structuredClone(activeHero);
    incoming.x = clamp(anchor.x + formationSlot.x, 80, this.state.view.w - 160);
    incoming.y = clamp(anchor.y + formationSlot.y, 96, combatBottom(this.state));
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
        setHeroHp(this.state, hero, this.state.heroes.indexOf(hero), hero.hp + 34);
        hero.mp = clamp(hero.mp + 28, 0, stats.maxMp);
      }
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
  shopOrder,
  shops,
  skillKeys,
  upgradeCost
};

export type { AreaId, ConsumableId, ElementId, Enemy, EquipmentSlot, GameState, Hero, HudState, Point, ShopId, SkillKey };
