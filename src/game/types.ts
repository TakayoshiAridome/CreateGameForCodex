
export type Point = { x: number; y: number };
export type Weapon = "sword" | "rifle" | "staff" | "scout";
export type SkillKey = "e" | "r" | "t" | "y";
export type AreaId = "town" | "field" | "dungeon";
export type ShopId = "weapon" | "armor" | "item" | "inn";
export type ConsumableId = "potion";
export type ElementId = "neutral" | "fire" | "water" | "wind" | "earth" | "light" | "dark";

export type Skill = {
  key: SkillKey;
  id: string;
  name: string;
  cost: number;
  cooldown: number;
};

export type EquipmentSlot = "weapon" | "armor" | "trinket";

export type EquipmentBonus = {
  attack?: number;
  maxHp?: number;
  maxMp?: number;
  range?: number;
  speed?: number;
};

export type Equipment = {
  id: string;
  slot: EquipmentSlot;
  name: string;
  level: number;
  price: number;
  bonus: EquipmentBonus;
};

export type ConsumableItem = {
  id: ConsumableId;
  name: string;
  description: string;
  price: number;
  healHp: number;
};

export type ConsumableStack = {
  item: ConsumableItem;
  count: number;
};

export type Hero = Point & {
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

export type Enemy = Point & {
  type: "corsair" | "duelist" | "boss";
  element: ElementId;
  hp: number;
  maxHp: number;
  speed: number;
  attack: number;
  cooldown: number;
  radius: number;
};

export type Particle = Point & {
  text: string;
  color: string;
  life: number;
};

export type Formation = {
  name: string;
  slots: Point[];
};

export type AreaDefinition = {
  id: AreaId;
  name: string;
  description: string;
  spawnRate: number;
  bossInterval: number;
  enemyScale: number;
};

export type WarpPoint = Point & {
  target: AreaId;
  label: string;
};

export type ShopDefinition = {
  id: ShopId;
  name: string;
  description: string;
  cost: number;
};

export type GameState = {
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

export type HudState = Pick<
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
