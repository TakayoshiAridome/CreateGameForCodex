import type { AreaDefinition, AreaId, ConsumableItem, ElementId, Equipment, EquipmentBonus, EquipmentSlot, Formation, Hero, ShopDefinition, ShopId, SkillKey } from "./types";

export const formations: Formation[] = [
  {
    name: "一尖双翼",
    slots: [{ x: 94, y: 0 }, { x: -66, y: -92 }, { x: -66, y: 92 }, { x: -218, y: 0 }]
  },
  {
    name: "双牙護列",
    slots: [{ x: 84, y: -72 }, { x: 84, y: 72 }, { x: -86, y: 0 }, { x: -224, y: 0 }]
  },
  {
    name: "影羽の陣",
    slots: [{ x: 92, y: 0 }, { x: -82, y: 0 }, { x: -220, y: -88 }, { x: -220, y: 88 }]
  }
];

export const skillKeys: SkillKey[] = ["r", "f", "t", "g"];

export const elementLabels: Record<ElementId, string> = {
  neutral: "無",
  fire: "火",
  water: "水",
  wind: "風",
  earth: "土",
  light: "光",
  dark: "闇"
};

export const elementColors: Record<ElementId, string> = {
  neutral: "#d9c7aa",
  fire: "#ff8d62",
  water: "#72b7ff",
  wind: "#9de08f",
  earth: "#d4a76a",
  light: "#fff0a6",
  dark: "#b58cff"
};

export const elementAdvantage: Partial<Record<ElementId, ElementId>> = {
  fire: "wind",
  wind: "earth",
  earth: "water",
  water: "fire",
  light: "dark",
  dark: "light"
};

export const areas: Record<AreaId, AreaDefinition> = {
  aureleaf: {
    id: "aureleaf",
    name: "アウレリーフ",
    description: "広い街区を持つ補給と回復の拠点。敵は出現しません。",
    spawnRate: 0,
    bossInterval: Infinity,
    enemyScale: 0
  },
  spiritTreeForest01: {
    id: "spiritTreeForest01",
    name: "世界樹の森01",
    description: "世界樹の根元に広がる広大な探索地帯。一定数の敵が生息し、倒すとしばらくして再出現します。",
    spawnRate: 1,
    bossInterval: 28,
    enemyScale: 1
  },
  spiritRootCave01: {
    id: "spiritRootCave01",
    name: "精霊樹の根洞1F",
    description: "精霊樹の地下深くに広がる、巨大な根が絡み合ってできた神秘の洞窟1F。一定数の敵が巡回しています。",
    spawnRate: 1.45,
    bossInterval: 18,
    enemyScale: 1.35
  }
};

export const areaOrder: AreaId[] = ["aureleaf", "spiritTreeForest01", "spiritRootCave01"];

export const shops: Record<ShopId, ShopDefinition> = {
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

export const shopOrder: ShopId[] = ["weapon", "armor", "item", "inn"];

const emptySkillCooldowns = (): Record<SkillKey, number> => ({
  r: 0,
  f: 0,
  t: 0,
  g: 0
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

export const equipmentCatalog: Equipment[] = [
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

export function cloneEquipment(item: Equipment): Equipment {
  return structuredClone(item);
}

export const consumableCatalog: ConsumableItem[] = [
  {
    id: "potion",
    name: "ポーション",
    description: "選択中のキャラクターのHPを80回復します。",
    price: 35,
    healHp: 80
  }
];

export const initialHeroes: Hero[] = [
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
      { key: "r", id: "blade-lunge", name: "グランディア", cost: 30, cooldown: 4.2 },
      { key: "f", id: "blade-cleave", name: "クロスエッジ", cost: 34, cooldown: 5.2 },
      { key: "t", id: "blade-guard", name: "ロイヤルガード", cost: 24, cooldown: 7 },
      { key: "g", id: "blade-rally", name: "家門号令", cost: 42, cooldown: 9 }
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
      { key: "r", id: "rifle-shot", name: "集中射撃", cost: 28, cooldown: 3.8 },
      { key: "f", id: "rifle-grenade", name: "榴弾射撃", cost: 36, cooldown: 5.8 },
      { key: "t", id: "rifle-smoke", name: "煙幕展開", cost: 28, cooldown: 7 },
      { key: "g", id: "rifle-volley", name: "一斉掃射", cost: 48, cooldown: 10 }
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
      { key: "r", id: "staff-heal", name: "レメディ", cost: 32, cooldown: 4.2 },
      { key: "f", id: "staff-flare", name: "フレアリング", cost: 38, cooldown: 5.6 },
      { key: "t", id: "staff-mana", name: "マナタイド", cost: 26, cooldown: 7.2 },
      { key: "g", id: "staff-starfall", name: "星落とし", cost: 54, cooldown: 11 }
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
      { key: "r", id: "scout-firstaid", name: "ファーストエイド", cost: 30, cooldown: 3.8 },
      { key: "f", id: "scout-regeneration", name: "リジェネレート", cost: 34, cooldown: 6 },
      { key: "t", id: "scout-haste", name: "ヘイストオーダー", cost: 32, cooldown: 7.5 },
      { key: "g", id: "scout-sanctuary", name: "サンクチュアリ", cost: 58, cooldown: 12 }
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

export function createReserveHeroes(): Hero[] {
  const reserves = structuredClone([initialHeroes[1], initialHeroes[2], initialHeroes[0], initialHeroes[0]]);

  reserves[0] = {
    ...reserves[0],
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

  reserves[1] = {
    ...reserves[1],
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

  reserves[2] = {
    ...reserves[2],
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
      { key: "r", id: "blade-lunge", name: "セレスティアスラスト", cost: 30, cooldown: 4 },
      { key: "f", id: "blade-cleave", name: "スタークロス", cost: 36, cooldown: 5.4 },
      { key: "t", id: "blade-guard", name: "ルミナスガード", cost: 26, cooldown: 7 },
      { key: "g", id: "blade-rally", name: "ソードセイント", cost: 44, cooldown: 9.2 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "ルシェリア・クロスブレード",
      "星光の騎士鎧",
      "リボンの聖印",
      { attack: 8 },
      { maxHp: 30, speed: 3 },
      { maxMp: 10, attack: 3 }
    )
  };

  reserves[3] = {
    ...reserves[3],
    name: "コーデルス",
    role: "ファイター",
    color: "#5f2c22",
    trim: "#ffb15f",
    hair: "#2a1d18",
    accent: "#d7b98a",
    element: "fire",
    hp: 182,
    maxHp: 182,
    mp: 60,
    maxMp: 82,
    str: 18,
    vit: 14,
    agi: 11,
    int: 7,
    dex: 11,
    men: 8,
    attack: 26,
    range: 52,
    speed: 173,
    x: 0,
    y: 0,
    skills: [
      { key: "r", id: "cordels-flame-rush", name: "緋狼突", cost: 32, cooldown: 4.4 },
      { key: "f", id: "cordels-ash-break", name: "灰燼断", cost: 38, cooldown: 5.8 },
      { key: "t", id: "cordels-brand-guard", name: "火印の構え", cost: 28, cooldown: 7.4 },
      { key: "g", id: "cordels-warflame", name: "戦火鼓舞", cost: 46, cooldown: 9.6 }
    ],
    skillCooldowns: emptySkillCooldowns(),
    equipment: createEquipment(
      "紅鉄の長剣",
      "傭兵隊長の鎧",
      "火紋の徽章",
      { attack: 7 },
      { maxHp: 32 },
      { attack: 3, maxMp: 8 }
    )
  };

  return reserves;
}
