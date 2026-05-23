import * as THREE from "three";
import { playableBottom, playableWidth, warpPointsForArea, type GameState, type Point, type WarpPoint } from "./core";
import { areaLocal, WORLD_SCALE } from "./rendererCamera";
import { clearGroup, colorKey, createTextSprite, sharedBasicMaterial, sharedGeometry, sharedStandardMaterial, type ThreeView } from "./rendererShared";

function createWarpPointMesh(warpPoint: WarpPoint, state: GameState) {
  const group = new THREE.Group();
  group.position.copy(areaLocal(warpPoint, state));
  const isDungeonGate = warpPoint.target === "spiritRootCave01" || state.area === "spiritRootCave01";

  const pad = new THREE.Mesh(
    sharedGeometry("warp-pad-cylinder", () => new THREE.CylinderGeometry(0.48, 0.58, 0.045, 36)),
    sharedStandardMaterial(`warp-pad-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0xb889ff : state.area === "aureleaf" ? 0x71d8ff : 0xffd071,
      emissive: isDungeonGate ? 0x3d1e68 : state.area === "aureleaf" ? 0x1c5f82 : 0x6d4214,
      emissiveIntensity: 0.28,
      roughness: 0.38,
      metalness: 0.1
    })
  );
  pad.position.y = 0.035;
  group.add(pad);

  const ring = new THREE.Mesh(
    sharedGeometry("warp-ring-torus", () => new THREE.TorusGeometry(0.54, 0.025, 8, 42)),
    sharedBasicMaterial(`warp-ring-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0xd8bdff : state.area === "aureleaf" ? 0xb9f4ff : 0xffe4a3
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  const arch = new THREE.Mesh(
    sharedGeometry("warp-arch-torus", () => new THREE.TorusGeometry(0.38, 0.025, 10, 34, Math.PI)),
    sharedBasicMaterial(`warp-arch-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0xc89cff : state.area === "aureleaf" ? 0x9eeaff : 0xffcf6f
    })
  );
  arch.rotation.z = Math.PI;
  arch.position.y = 0.7;
  group.add(arch);

  const core = new THREE.Mesh(
    sharedGeometry("warp-core-plane", () => new THREE.PlaneGeometry(0.5, 0.78)),
    sharedBasicMaterial(`warp-core-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0x9c63ff : state.area === "aureleaf" ? 0x4fbfff : 0xffb24a,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide
    })
  );
  core.position.y = 0.6;
  core.rotation.y = Math.PI / 4;
  group.add(core);

  const label = createTextSprite(warpPoint.label, "#fff0c2", 0.96);
  label.position.set(0, 1.32, 0);
  label.scale.set(1.3, 0.44, 1);
  group.add(label);

  return group;
}

function addFieldPatch(group: THREE.Group, state: GameState, point: Point, size: Point, color: THREE.ColorRepresentation, rotation = 0, y = 0.018) {
  const patch = new THREE.Mesh(
    sharedGeometry(`field-patch-${size.x}-${size.y}`, () => new THREE.PlaneGeometry(size.x / WORLD_SCALE, size.y / WORLD_SCALE)),
    sharedStandardMaterial(`field-patch-${colorKey(color)}`, { color, roughness: 0.9, metalness: 0.02 })
  );
  patch.position.copy(areaLocal(point, state));
  patch.position.y = y;
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = rotation;
  group.add(patch);
}

function addFieldRock(group: THREE.Group, state: GameState, point: Point, radius: number, height: number, color: THREE.ColorRepresentation) {
  const rock = new THREE.Mesh(
    sharedGeometry(`field-rock-${radius}-${height}`, () => new THREE.DodecahedronGeometry(radius / WORLD_SCALE, 0)),
    sharedStandardMaterial(`field-rock-${colorKey(color)}`, { color, roughness: 0.86, metalness: 0.04 })
  );
  rock.position.copy(areaLocal(point, state));
  rock.position.y = height / WORLD_SCALE / 2;
  rock.scale.y = height / Math.max(radius, 1);
  rock.castShadow = true;
  group.add(rock);
}

function addFieldTree(group: THREE.Group, state: GameState, point: Point, scale = 1) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    sharedGeometry("field-tree-trunk", () => new THREE.CylinderGeometry(0.07, 0.1, 0.42, 8)),
    sharedStandardMaterial("field-tree-trunk", { color: 0x61442e, roughness: 0.8 })
  );
  trunk.position.y = 0.21 * scale;
  trunk.scale.setScalar(scale);
  const leaves = new THREE.Mesh(
    sharedGeometry("field-tree-leaves", () => new THREE.ConeGeometry(0.36, 0.72, 9)),
    sharedStandardMaterial("field-tree-leaves", { color: 0x365f46, roughness: 0.86 })
  );
  leaves.position.y = 0.74 * scale;
  leaves.scale.setScalar(scale);
  tree.add(trunk, leaves);
  tree.position.copy(areaLocal(point, state));
  tree.castShadow = true;
  group.add(tree);
}

function addExpandedFieldTerrain(group: THREE.Group, state: GameState) {
  const width = playableWidth(state);
  const bottom = playableBottom(state);
  addFieldPatch(group, state, { x: width * 0.5, y: bottom * 0.58 }, { x: width * 0.9, y: 160 }, 0x5f7b49, -0.16, 0.02);
  addFieldPatch(group, state, { x: width * 0.46, y: bottom * 0.52 }, { x: width * 0.92, y: 68 }, 0x4e88a4, -0.16, 0.026);
  addFieldPatch(group, state, { x: width * 0.5, y: bottom * 0.83 }, { x: width * 0.78, y: 96 }, 0xb19a68, 0.08, 0.024);
  addFieldPatch(group, state, { x: width * 0.32, y: bottom * 0.27 }, { x: 520, y: 260 }, 0x6d5f44, 0.36, 0.024);
  addFieldPatch(group, state, { x: width * 0.75, y: bottom * 0.34 }, { x: 620, y: 230 }, 0x59704c, -0.28, 0.024);

  for (let i = 0; i < 18; i += 1) {
    const x = 260 + ((i * 331) % Math.max(800, width - 520));
    const y = 210 + ((i * 227) % Math.max(640, bottom - 420));
    if (Math.abs(y - bottom * 0.52) < 90) continue;
    addFieldTree(group, state, { x, y }, 0.85 + (i % 4) * 0.11);
  }

  for (let i = 0; i < 11; i += 1) {
    addFieldRock(
      group,
      state,
      { x: width * 0.12 + i * 92, y: bottom * 0.18 + Math.sin(i * 1.7) * 42 },
      18 + (i % 3) * 7,
      42 + (i % 4) * 16,
      i % 2 === 0 ? 0x6f6b5d : 0x4c4b4f
    );
  }

  for (let i = 0; i < 9; i += 1) {
    addFieldRock(
      group,
      state,
      { x: width * 0.72 + i * 58, y: bottom * 0.72 + Math.cos(i * 1.2) * 70 },
      16 + (i % 2) * 10,
      34 + (i % 5) * 12,
      0x5a5d68
    );
  }

  addFieldPatch(group, state, { x: 205, y: bottom - 190 }, { x: 220, y: 140 }, 0x9d8155, -0.05, 0.035);
  addFieldPatch(group, state, { x: width - 240, y: 210 }, { x: 220, y: 140 }, 0x6f5a91, 0.22, 0.035);
}

function addExpandedTownTerrain(group: THREE.Group, state: GameState) {
  const width = playableWidth(state);
  const bottom = playableBottom(state);
  addFieldPatch(group, state, { x: width * 0.5, y: bottom * 0.52 }, { x: width * 0.82, y: 120 }, 0xb6a06e, -0.08, 0.025);
  addFieldPatch(group, state, { x: width * 0.5, y: bottom * 0.5 }, { x: 130, y: bottom * 0.82 }, 0xa58b5f, 0.04, 0.027);
  addFieldPatch(group, state, { x: width * 0.32, y: bottom * 0.34 }, { x: 420, y: 260 }, 0x738063, 0.22, 0.02);
  addFieldPatch(group, state, { x: width * 0.68, y: bottom * 0.66 }, { x: 480, y: 250 }, 0x606e5a, -0.18, 0.02);
  addFieldPatch(group, state, { x: width - 230, y: bottom - 190 }, { x: 240, y: 150 }, 0x9d8155, 0.08, 0.036);

  for (let i = 0; i < 12; i += 1) {
    const x = width * 0.18 + ((i * 173) % Math.max(420, width * 0.62));
    const y = bottom * 0.18 + ((i * 131) % Math.max(360, bottom * 0.64));
    if (Math.abs(x - width * 0.5) < 110 || Math.abs(y - bottom * 0.52) < 95) continue;
    addFieldTree(group, state, { x, y }, 0.72 + (i % 3) * 0.08);
  }
}

function addExpandedDungeonTerrain(group: THREE.Group, state: GameState) {
  const width = playableWidth(state);
  const bottom = playableBottom(state);
  addFieldPatch(group, state, { x: width * 0.5, y: bottom * 0.5 }, { x: width * 0.72, y: 150 }, 0x4d435f, 0.13, 0.024);
  addFieldPatch(group, state, { x: width * 0.48, y: bottom * 0.5 }, { x: 150, y: bottom * 0.72 }, 0x343040, -0.05, 0.026);
  addFieldPatch(group, state, { x: width * 0.28, y: bottom * 0.28 }, { x: 520, y: 240 }, 0x2f293c, 0.32, 0.024);
  addFieldPatch(group, state, { x: width * 0.72, y: bottom * 0.68 }, { x: 560, y: 280 }, 0x262535, -0.22, 0.024);
  addFieldPatch(group, state, { x: 210, y: bottom - 190 }, { x: 240, y: 150 }, 0x594878, -0.08, 0.036);

  for (let i = 0; i < 16; i += 1) {
    addFieldRock(
      group,
      state,
      { x: width * 0.14 + ((i * 211) % Math.max(620, width * 0.72)), y: bottom * 0.16 + ((i * 167) % Math.max(520, bottom * 0.72)) },
      20 + (i % 4) * 8,
      46 + (i % 5) * 18,
      i % 2 === 0 ? 0x3b3946 : 0x5a5067
    );
  }

  for (let i = 0; i < 10; i += 1) {
    const pillar = new THREE.Mesh(
      sharedGeometry("dungeon-wide-pillar", () => new THREE.CylinderGeometry(0.16, 0.22, 1.45, 12)),
      sharedStandardMaterial("dungeon-wide-pillar", { color: 0x2d2937, roughness: 0.84 })
    );
    pillar.position.copy(areaLocal({ x: width * 0.2 + i * (width * 0.06), y: bottom * 0.42 + Math.sin(i) * 120 }, state));
    pillar.position.y = 0.72;
    pillar.castShadow = true;
    group.add(pillar);
  }
}

function rebuildField(view: ThreeView, state: GameState) {
  clearGroup(view.field);
  const worldWidth = playableWidth(state);
  const worldDepth = playableBottom(state);
  const width = worldWidth / WORLD_SCALE;
  const depth = worldDepth / WORLD_SCALE;
  const groundColor = state.area === "aureleaf" ? 0x6d6f59 : state.area === "spiritRootCave01" ? 0x393446 : 0x66724a;
  const gridColor = state.area === "aureleaf" ? 0xd8c799 : state.area === "spiritRootCave01" ? 0x886ab0 : 0xb7a56f;
  const gridFloorColor = state.area === "aureleaf" ? 0x60664b : state.area === "spiritRootCave01" ? 0x272233 : 0x4f5c3d;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.92 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  view.field.add(ground);

  const grid = new THREE.GridHelper(Math.max(width, depth), state.area === "spiritTreeForest01" ? 42 : 18, gridColor, gridFloorColor);
  grid.position.y = 0.012;
  view.field.add(grid);

  if (state.area === "aureleaf") {
    addExpandedTownTerrain(view.field, state);
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
    for (const warpPoint of warpPointsForArea(state)) view.field.add(createWarpPointMesh(warpPoint, state));
    return;
  }

  if (state.area === "spiritTreeForest01") {
    addExpandedFieldTerrain(view.field, state);
  }

  if (state.area === "spiritRootCave01") {
    addExpandedDungeonTerrain(view.field, state);
  }

  for (const warpPoint of warpPointsForArea(state)) view.field.add(createWarpPointMesh(warpPoint, state));

  for (let i = -3; i <= 3; i += 1) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: state.area === "spiritRootCave01" ? 0x272230 : 0x3b3a4a, roughness: 0.8 })
    );
    column.position.set(i * 1.9, 0.9, -depth / 2 + 0.9);
    column.castShadow = true;
    view.field.add(column);
  }

  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.18, 0.42),
    new THREE.MeshStandardMaterial({ color: state.area === "spiritRootCave01" ? 0x5c4a6f : 0x9d8155, roughness: 0.7 })
  );
  arch.position.set(0, 1.92, -depth / 2 + 0.85);
  arch.castShadow = true;
  view.field.add(arch);
}

export { rebuildField };
