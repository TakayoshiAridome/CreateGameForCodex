import * as THREE from "three";
import { clamp, heroStats, type AreaId, type Enemy, type GameState, type Hero, type Point } from "./core";

type ThreeView = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  field: THREE.Group;
  units: THREE.Group;
  effects: THREE.Group;
};

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
  const groundColor = state.area === "town" ? 0x6d6f59 : state.area === "dungeon" ? 0x393446 : 0x7b6747;
  const gridColor = state.area === "town" ? 0xd8c799 : state.area === "dungeon" ? 0x886ab0 : 0xd2b477;
  const gridFloorColor = state.area === "town" ? 0x60664b : state.area === "dungeon" ? 0x272233 : 0x66543b;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  view.field.add(ground);

  const grid = new THREE.GridHelper(Math.max(width, depth), 18, gridColor, gridFloorColor);
  grid.position.y = 0.012;
  view.field.add(grid);

  if (state.area === "town") {
    const shopBuildings = [
      { name: "武器屋", x: -3.3, color: 0x8b5a4c, roof: 0x7d3344 },
      { name: "防具屋", x: -1.1, color: 0x5f6f80, roof: 0x36465f },
      { name: "道具屋", x: 1.1, color: 0x6f7653, roof: 0x5f6f38 },
      { name: "宿屋", x: 3.3, color: 0x8b6b55, roof: 0x8a4a36 }
    ];
    for (const shop of shopBuildings) {
      const building = new THREE.Group();
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(1.18, 0.78, 0.92),
        new THREE.MeshStandardMaterial({ color: shop.color, roughness: 0.78 })
      );
      wall.position.y = 0.39;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.84, 0.48, 4),
        new THREE.MeshStandardMaterial({ color: shop.roof, roughness: 0.72 })
      );
      roof.position.y = 0.98;
      roof.rotation.y = Math.PI / 4;
      const sign = createTextSprite(shop.name, "#fff0c2", 1);
      sign.scale.set(0.9, 0.3, 1);
      sign.position.set(0, 1.38, 0.03);
      building.add(wall, roof, sign);
      building.position.set(shop.x, 0, -depth / 2 + 1.18);
      view.field.add(building);
    }
    for (let i = -2; i <= 2; i += 1) {
      const house = new THREE.Group();
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.82, 0.62, 0.7),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x8b6b55 : 0x6d7a70, roughness: 0.78 })
      );
      wall.position.y = 0.35;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.76, 0.44, 4),
        new THREE.MeshStandardMaterial({ color: 0x7d3344, roughness: 0.72 })
      );
      roof.position.y = 0.92;
      roof.rotation.y = Math.PI / 4;
      house.add(wall, roof);
      house.position.set(i * 1.65, 0, depth / 2 - 1.0 - Math.abs(i) * 0.2);
      view.field.add(house);
    }
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.12, 0.035, 42),
      new THREE.MeshStandardMaterial({ color: 0xb6a06e, roughness: 0.88 })
    );
    plaza.position.y = 0.025;
    view.field.add(plaza);
    return;
  }

  if (state.area === "field") {
    for (let i = 0; i < 10; i += 1) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.1, 0.42, 8),
        new THREE.MeshStandardMaterial({ color: 0x61442e, roughness: 0.8 })
      );
      trunk.position.y = 0.21;
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(0.36, 0.72, 9),
        new THREE.MeshStandardMaterial({ color: 0x365f46, roughness: 0.86 })
      );
      leaves.position.y = 0.74;
      tree.add(trunk, leaves);
      const side = i % 2 === 0 ? -1 : 1;
      tree.position.set(side * (width / 2 - 0.8 - (i % 3) * 0.38), 0, -depth / 2 + 1.0 + i * 0.7);
      view.field.add(tree);
    }
  }

  for (let i = -3; i <= 3; i += 1) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: state.area === "dungeon" ? 0x272230 : 0x3b3a4a, roughness: 0.8 })
    );
    column.position.set(i * 1.9, 0.9, -depth / 2 + 0.9);
    column.castShadow = true;
    view.field.add(column);
  }

  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.18, 0.42),
    new THREE.MeshStandardMaterial({ color: state.area === "dungeon" ? 0x5c4a6f : 0x9d8155, roughness: 0.7 })
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

class ThreeGameRenderer {
  private readonly view: ThreeView;
  private dpr = 1;
  private renderedArea: AreaId | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: GameState
  ) {
    this.view = createThreeView(canvas);
  }

  resize() {
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    resizeThreeView(this.view, this.state, this.canvas, this.dpr);
  }

  render() {
    if (this.renderedArea !== this.state.area) {
      rebuildField(this.view, this.state);
      this.renderedArea = this.state.area;
    }
    renderGame(this.view, this.state);
  }

  dispose() {
    this.view.renderer.dispose();
  }
}

export { ThreeGameRenderer };
