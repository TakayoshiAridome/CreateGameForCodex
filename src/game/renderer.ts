import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { clamp, elementColors, heroStats, warpPointsForArea, type AreaId, type Enemy, type GameState, type Hero, type Point, type WarpPoint } from "./core";

type ThreeView = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  field: THREE.Group;
  units: THREE.Group;
  effects: THREE.Group;
};

type LuceriaAnimationKind = "idle" | "run" | "attack";
type LuceriaAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
  baseY: number;
};

const WORLD_SCALE = 74;
const LUCERIA_MODEL_URL = "/assets/luceria_swordsaint_apoze.glb";
const LUCERIA_IDLE_MODEL_URL = "/assets/luceria_swordsaint_idle.glb";
const LUCERIA_RUN_MODEL_URL = "/assets/luceria_swordsaint_run.glb";
const LUCERIA_ATTACK_MODEL_URL = "/assets/luceria_swordsaint_attack.glb";
const CAMERA_RADIUS = 15.3;
const LUCERIA_SATURATION = 1.62;
const LUCERIA_RUN_VERTICAL_OFFSET = 0.18;
const sharedTextureKeys = [
  "map",
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "emissiveMap",
  "aoMap",
  "alphaMap"
] as const;
const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.Material>();
const textTextureCache = new Map<string, THREE.CanvasTexture>();
let luceriaTexture: THREE.Texture | null = null;
let luceriaGltfModel: THREE.Group | null = null;
let luceriaGltfLoading = false;
let luceriaGltfFailed = false;
let luceriaIdleGltfModel: THREE.Group | null = null;
let luceriaIdleGltfClips: THREE.AnimationClip[] = [];
let luceriaIdleGltfLoading = false;
let luceriaIdleGltfFailed = false;
let luceriaRunGltfModel: THREE.Group | null = null;
let luceriaRunGltfClips: THREE.AnimationClip[] = [];
let luceriaRunGltfLoading = false;
let luceriaRunGltfFailed = false;
let luceriaAttackGltfModel: THREE.Group | null = null;
let luceriaAttackGltfClips: THREE.AnimationClip[] = [];
let luceriaAttackGltfLoading = false;
let luceriaAttackGltfFailed = false;
const luceriaAnimationInstances: Partial<Record<LuceriaAnimationKind, LuceriaAnimationInstance>> = {};

function toWorld(point: Point, state: GameState) {
  return new THREE.Vector3((point.x - state.view.w / 2) / WORLD_SCALE, 0, (point.y - state.view.h / 2) / WORLD_SCALE);
}

function sharedGeometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
  const cached = geometryCache.get(key) as T | undefined;
  if (cached) return cached;
  const geometry = create();
  geometry.userData.shared = true;
  geometryCache.set(key, geometry);
  return geometry;
}

function colorKey(color: THREE.ColorRepresentation) {
  return new THREE.Color(color).getHexString();
}

function sharedStandardMaterial(key: string, options: THREE.MeshStandardMaterialParameters) {
  const cacheKey = `standard:${key}:${colorKey(options.color ?? 0xffffff)}:${options.roughness ?? ""}:${options.metalness ?? ""}:${options.emissive ? colorKey(options.emissive) : ""}:${options.emissiveIntensity ?? ""}`;
  const cached = materialCache.get(cacheKey) as THREE.MeshStandardMaterial | undefined;
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial(options);
  material.userData.shared = true;
  materialCache.set(cacheKey, material);
  return material;
}

function sharedBasicMaterial(key: string, options: THREE.MeshBasicMaterialParameters) {
  const cacheKey = `basic:${key}:${colorKey(options.color ?? 0xffffff)}:${options.transparent ?? ""}:${options.opacity ?? ""}:${options.alphaTest ?? ""}:${options.side ?? ""}`;
  const cached = materialCache.get(cacheKey) as THREE.MeshBasicMaterial | undefined;
  if (cached) return cached;
  const material = new THREE.MeshBasicMaterial(options);
  material.userData.shared = true;
  materialCache.set(cacheKey, material);
  return material;
}

function heroFacingAngle(hero: Hero) {
  return hero.hp > 0 ? hero.facing : 0;
}

function runCycle(hero: Hero) {
  if (!hero.moving || hero.hp <= 0) return { phase: 0, stride: 0, bob: 0 };
  const phase = hero.runTime;
  return {
    phase,
    stride: Math.sin(phase) * 0.34,
    bob: Math.abs(Math.sin(phase * 2)) * 0.045
  };
}

function getLuceriaTexture() {
  if (!luceriaTexture) {
    luceriaTexture = new THREE.TextureLoader().load("/assets/luceria_front_cutout.png");
    luceriaTexture.colorSpace = THREE.SRGBColorSpace;
    luceriaTexture.anisotropy = 4;
    luceriaTexture.userData.shared = true;
  }
  return luceriaTexture;
}

function markSharedMaterial(material: THREE.Material) {
  material.userData.shared = true;
  const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
  for (const key of sharedTextureKeys) {
    const texture = texturedMaterial[key];
    if (texture) texture.userData.shared = true;
  }
}

function prepareLuceriaMaterial(material: THREE.Material) {
  const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
  if (texturedMaterial.map) {
    texturedMaterial.map.colorSpace = THREE.SRGBColorSpace;
    texturedMaterial.map.needsUpdate = true;
  }
  if (texturedMaterial.emissiveMap) {
    texturedMaterial.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    texturedMaterial.emissiveMap.needsUpdate = true;
  }

  const litMaterial = material as THREE.MeshStandardMaterial;
  if (litMaterial.color && texturedMaterial.map) litMaterial.color.setScalar(1.22);
  if (litMaterial.emissive) {
    litMaterial.emissive.set(0xffffff);
    litMaterial.emissiveIntensity = 0.08;
  }
  if (typeof litMaterial.metalness === "number") litMaterial.metalness = Math.min(litMaterial.metalness, 0.35);
  if (typeof litMaterial.roughness === "number") litMaterial.roughness = Math.min(Math.max(litMaterial.roughness, 0.34), 0.66);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float luceriaLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(luceriaLuma), diffuseColor.rgb, ${LUCERIA_SATURATION.toFixed(2)});`
    );
  };
  material.customProgramCacheKey = () => `luceria-saturation-${LUCERIA_SATURATION}`;
  material.needsUpdate = true;
}

function markSharedObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    child.castShadow = true;
    child.receiveShadow = true;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry.userData.shared = true;
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        prepareLuceriaMaterial(item);
        markSharedMaterial(item);
      }
    } else if (material) {
      prepareLuceriaMaterial(material);
      markSharedMaterial(material);
    }
  });
}

function applyLuceriaRunFallbackMaterial(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const litMaterial = material as THREE.MeshStandardMaterial;
      const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
      if (!litMaterial.color || texturedMaterial.map) continue;
      litMaterial.color.set(0x26345a);
      litMaterial.emissive?.set(0x101626);
      litMaterial.emissiveIntensity = 0.06;
      if (typeof litMaterial.metalness === "number") litMaterial.metalness = 0.28;
      if (typeof litMaterial.roughness === "number") litMaterial.roughness = 0.42;
    }
  });
}

function normalizeLuceriaModel(model: THREE.Group) {
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.75 / Math.max(initialSize.y, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y - 0.3, -center.z);
}

function loadLuceriaGltfModel() {
  if (luceriaGltfModel || luceriaGltfLoading || luceriaGltfFailed) return luceriaGltfModel;
  luceriaGltfLoading = true;
  new GLTFLoader().load(
    LUCERIA_MODEL_URL,
    (gltf) => {
      luceriaGltfModel = gltf.scene;
      normalizeLuceriaModel(luceriaGltfModel);
      markSharedObject(luceriaGltfModel);
      luceriaGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load Luceria GLB model.", error);
      luceriaGltfFailed = true;
      luceriaGltfLoading = false;
    }
  );
  return luceriaGltfModel;
}

function loadLuceriaIdleGltfModel() {
  if (luceriaIdleGltfModel || luceriaIdleGltfLoading || luceriaIdleGltfFailed) return luceriaIdleGltfModel;
  luceriaIdleGltfLoading = true;
  new GLTFLoader().load(
    LUCERIA_IDLE_MODEL_URL,
    (gltf) => {
      luceriaIdleGltfModel = gltf.scene;
      luceriaIdleGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaIdleGltfModel);
      markSharedObject(luceriaIdleGltfModel);
      luceriaIdleGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load Luceria idle GLB model.", error);
      luceriaIdleGltfFailed = true;
      luceriaIdleGltfLoading = false;
    }
  );
  return luceriaIdleGltfModel;
}

function loadLuceriaRunGltfModel() {
  if (luceriaRunGltfModel || luceriaRunGltfLoading || luceriaRunGltfFailed) return luceriaRunGltfModel;
  luceriaRunGltfLoading = true;
  new GLTFLoader().load(
    LUCERIA_RUN_MODEL_URL,
    (gltf) => {
      luceriaRunGltfModel = gltf.scene;
      luceriaRunGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaRunGltfModel);
      applyLuceriaRunFallbackMaterial(luceriaRunGltfModel);
      markSharedObject(luceriaRunGltfModel);
      luceriaRunGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load Luceria run GLB model.", error);
      luceriaRunGltfFailed = true;
      luceriaRunGltfLoading = false;
    }
  );
  return luceriaRunGltfModel;
}

function loadLuceriaAttackGltfModel() {
  if (luceriaAttackGltfModel || luceriaAttackGltfLoading || luceriaAttackGltfFailed) return luceriaAttackGltfModel;
  luceriaAttackGltfLoading = true;
  new GLTFLoader().load(
    LUCERIA_ATTACK_MODEL_URL,
    (gltf) => {
      luceriaAttackGltfModel = gltf.scene;
      luceriaAttackGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaAttackGltfModel);
      markSharedObject(luceriaAttackGltfModel);
      luceriaAttackGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load Luceria attack GLB model.", error);
      luceriaAttackGltfFailed = true;
      luceriaAttackGltfLoading = false;
    }
  );
  return luceriaAttackGltfModel;
}

function createLuceriaAnimatedInstance(kind: LuceriaAnimationKind, source: THREE.Group | null, clips: THREE.AnimationClip[], time: number, verticalOffset = 0) {
  if (!source) return null;
  const clip = clips[0] ?? null;
  let instance = luceriaAnimationInstances[kind];
  if (!instance) {
    const model = cloneSkeleton(source) as THREE.Group;
    let mixer: THREE.AnimationMixer | null = null;
    if (clip && clip.duration > 0) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.play();
    }
    instance = { model, mixer, clip, baseY: model.position.y };
    luceriaAnimationInstances[kind] = instance;
  }
  instance.model.position.y = instance.baseY + verticalOffset;
  if (instance.mixer && instance.clip && instance.clip.duration > 0) instance.mixer.setTime(time % instance.clip.duration);
  return instance.model;
}

function createLuceriaIdleInstance(hero: Hero) {
  const idleTime = hero.hp > 0 ? performance.now() * 0.001 : 0;
  return createLuceriaAnimatedInstance("idle", loadLuceriaIdleGltfModel(), luceriaIdleGltfClips, idleTime);
}

function createLuceriaRunInstance(hero: Hero) {
  return createLuceriaAnimatedInstance("run", loadLuceriaRunGltfModel(), luceriaRunGltfClips, hero.runTime * 0.075, LUCERIA_RUN_VERTICAL_OFFSET);
}

function createLuceriaAttackInstance(hero: Hero) {
  return createLuceriaAnimatedInstance("attack", loadLuceriaAttackGltfModel(), luceriaAttackGltfClips, hero.attackTime * 1.55);
}

function createThreeView(canvas: HTMLCanvasElement): ThreeView {
  const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
  renderer.setClearColor(0x1b1b28);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1b1b28, 12, 34);
  const camera = new THREE.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);

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

function disposeMaterial(material: THREE.Material) {
  if (material.userData.shared) return;
  const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture | null>>;
  for (const key of sharedTextureKeys) {
    const texture = texturedMaterial[key];
    if (texture && !texture.userData.shared) texture.dispose();
  }
  material.dispose();
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !mesh.geometry.userData.shared) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) disposeMaterial(item);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    disposeObject(child);
    group.remove(child);
  }
}

function disposeThreeView(view: ThreeView) {
  clearGroup(view.field);
  clearGroup(view.units);
  clearGroup(view.effects);
  view.renderer.dispose();
}

function createWarpPointMesh(warpPoint: WarpPoint, state: GameState) {
  const group = new THREE.Group();
  group.position.copy(toWorld(warpPoint, state));
  const isDungeonGate = warpPoint.target === "dungeon" || state.area === "dungeon";

  const pad = new THREE.Mesh(
    sharedGeometry("warp-pad-cylinder", () => new THREE.CylinderGeometry(0.48, 0.58, 0.045, 36)),
    sharedStandardMaterial(`warp-pad-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0xb889ff : state.area === "town" ? 0x71d8ff : 0xffd071,
      emissive: isDungeonGate ? 0x3d1e68 : state.area === "town" ? 0x1c5f82 : 0x6d4214,
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
      color: isDungeonGate ? 0xd8bdff : state.area === "town" ? 0xb9f4ff : 0xffe4a3
    })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  const arch = new THREE.Mesh(
    sharedGeometry("warp-arch-torus", () => new THREE.TorusGeometry(0.38, 0.025, 10, 34, Math.PI)),
    sharedBasicMaterial(`warp-arch-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0xc89cff : state.area === "town" ? 0x9eeaff : 0xffcf6f
    })
  );
  arch.rotation.z = Math.PI;
  arch.position.y = 0.7;
  group.add(arch);

  const core = new THREE.Mesh(
    sharedGeometry("warp-core-plane", () => new THREE.PlaneGeometry(0.5, 0.78)),
    sharedBasicMaterial(`warp-core-${state.area}-${warpPoint.target}`, {
      color: isDungeonGate ? 0x9c63ff : state.area === "town" ? 0x4fbfff : 0xffb24a,
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

function rebuildField(view: ThreeView, state: GameState) {
  clearGroup(view.field);
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
    for (const warpPoint of warpPointsForArea(state)) view.field.add(createWarpPointMesh(warpPoint, state));
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

  for (const warpPoint of warpPointsForArea(state)) view.field.add(createWarpPointMesh(warpPoint, state));

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
  if (hero.name === "ルシェリア") return createLuceriaMesh(hero, state, index);

  const group = new THREE.Group();
  const pos = toWorld(hero, state);
  group.position.copy(pos);
  const model = new THREE.Group();
  model.rotation.y = heroFacingAngle(hero);
  group.add(model);
  const selected = state.selected === index;
  const run = runCycle(hero);
  model.position.y = run.bob;
  model.rotation.z = hero.moving ? Math.sin(run.phase * 2) * 0.035 : 0;

  const body = new THREE.Mesh(
    sharedGeometry("hero-body-capsule", () => new THREE.CapsuleGeometry(0.18, 0.46, 5, 10)),
    sharedStandardMaterial(`hero-body-${hero.color}`, { color: hero.color, roughness: 0.55, metalness: 0.05 })
  );
  body.position.y = 0.55;
  body.castShadow = true;
  model.add(body);

  const head = new THREE.Mesh(
    sharedGeometry("hero-head-sphere", () => new THREE.SphereGeometry(0.18, 16, 12)),
    sharedStandardMaterial("hero-skin", { color: 0xf0c7a5, roughness: 0.65 })
  );
  head.position.y = 1.04;
  head.castShadow = true;
  model.add(head);

  const hair = new THREE.Mesh(
    sharedGeometry("hero-hair-shell", () => new THREE.SphereGeometry(0.19, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58)),
    sharedStandardMaterial(`hero-hair-${hero.hair}`, { color: hero.hair, roughness: 0.72 })
  );
  hair.position.set(0, 1.1, -0.035);
  hair.rotation.x = -0.3;
  model.add(hair);

  const ponytail = new THREE.Mesh(
    sharedGeometry("hero-ponytail-capsule", () => new THREE.CapsuleGeometry(0.065, 0.42, 4, 8)),
    sharedStandardMaterial(`hero-ponytail-${hero.hair}`, { color: hero.hair, roughness: 0.75 })
  );
  ponytail.position.set(0.14, 0.88, -0.2);
  ponytail.rotation.x = 0.72;
  ponytail.rotation.z = -0.28;
  model.add(ponytail);

  const chestAccent = new THREE.Mesh(
    sharedGeometry("hero-chest-accent-box", () => new THREE.BoxGeometry(0.18, 0.18, 0.035)),
    sharedStandardMaterial(`hero-accent-${hero.accent}`, { color: hero.accent, roughness: 0.52 })
  );
  chestAccent.position.set(0, 0.67, 0.17);
  model.add(chestAccent);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      sharedGeometry("hero-arm-capsule", () => new THREE.CapsuleGeometry(0.045, 0.28, 4, 8)),
      sharedStandardMaterial(`hero-arm-${hero.color}`, { color: hero.color, roughness: 0.58, metalness: 0.04 })
    );
    arm.position.set(side * 0.23, 0.55, 0.02);
    arm.rotation.x = side * run.stride;
    arm.rotation.z = side * 0.18;
    model.add(arm);

    const leg = new THREE.Mesh(
      sharedGeometry("hero-leg-capsule", () => new THREE.CapsuleGeometry(0.055, 0.32, 4, 8)),
      sharedStandardMaterial(`hero-leg-${hero.color}`, { color: hero.color, roughness: 0.6, metalness: 0.04 })
    );
    leg.position.set(side * 0.08, 0.12, 0.01);
    leg.rotation.x = -side * run.stride * 0.85;
    model.add(leg);
  }

  const trim = new THREE.Mesh(
    sharedGeometry("hero-selection-torus", () => new THREE.TorusGeometry(0.25, 0.025, 8, 28)),
    sharedBasicMaterial(`hero-selection-${selected ? "selected" : hero.trim}`, { color: selected ? 0xffe0a0 : hero.trim })
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.04;
  group.add(trim);

  const weaponLength = hero.weapon === "rifle" ? 0.72 : hero.weapon === "staff" ? 0.82 : 0.46;
  const weapon = new THREE.Mesh(
    sharedGeometry(`hero-weapon-${weaponLength}`, () => new THREE.CylinderGeometry(0.025, 0.025, weaponLength, 8)),
    sharedStandardMaterial(`hero-weapon-${hero.trim}`, { color: hero.trim, roughness: 0.45, metalness: 0.4 })
  );
  weapon.rotation.z = hero.weapon === "staff" ? 0.18 : -0.75;
  weapon.position.set(0.32, 0.65, 0.03);
  model.add(weapon);

  addHealthBar(group, hero.hp / heroStats(hero).maxHp, 0.92, selected ? 0xffe0a0 : 0xffffff);
  return group;
}

function createLuceriaMesh(hero: Hero, state: GameState, index: number) {
  const group = new THREE.Group();
  group.position.copy(toWorld(hero, state));
  const model = new THREE.Group();
  model.rotation.y = heroFacingAngle(hero);
  group.add(model);
  const selected = state.selected === index;
  const run = runCycle(hero);
  model.position.y = run.bob;
  model.rotation.z = hero.moving ? Math.sin(run.phase * 2) * 0.028 : 0;
  const gltfModel = (hero.attacking ? createLuceriaAttackInstance(hero) : hero.moving ? createLuceriaRunInstance(hero) : createLuceriaIdleInstance(hero)) ?? loadLuceriaGltfModel();
  if (gltfModel) {
    model.add(gltfModel);
    const selection = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: selected ? 0xffe0a0 : hero.trim })
    );
    selection.rotation.x = Math.PI / 2;
    selection.position.y = -0.3;
    group.add(selection);
    addHealthBar(group, hero.hp / heroStats(hero).maxHp, 1.62, selected ? 0xffe0a0 : 0xffffff);
    return group;
  }

  const navy = new THREE.MeshStandardMaterial({ color: 0x171d31, roughness: 0.48, metalness: 0.18 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd5a85d, roughness: 0.34, metalness: 0.72 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf7f0e4, roughness: 0.56, metalness: 0.05 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xe8c690, roughness: 0.72 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c7a5, roughness: 0.65 });
  const blueGem = new THREE.MeshStandardMaterial({ color: 0x2f8fff, emissive: 0x0b3b7a, emissiveIntensity: 0.45, roughness: 0.22, metalness: 0.1 });

  const imageModel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.66),
    new THREE.MeshBasicMaterial({
      map: getLuceriaTexture(),
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide
    })
  );
  imageModel.position.set(0.02, 0.54, 0.19);
  imageModel.rotation.y = -0.18;
  model.add(imageModel);

  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 1.52, 3, 1),
    new THREE.MeshBasicMaterial({ color: 0x11182c, transparent: true, opacity: 0.74, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.48, -0.24);
  cape.rotation.x = -0.22;
  model.add(cape);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.46, 5, 12), navy);
  body.position.y = 0.58;
  body.castShadow = true;
  model.add(body);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.045), white);
  chest.position.set(0, 0.74, 0.17);
  model.add(chest);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 0.28, 8, 1, true), white);
  skirt.position.y = 0.31;
  skirt.castShadow = true;
  model.add(skirt);

  const waist = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 8, 32), gold);
  waist.rotation.x = Math.PI / 2;
  waist.position.y = 0.47;
  model.add(waist);

  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), gold);
    shoulder.position.set(side * 0.25, 0.82, 0.02);
    shoulder.scale.set(1.25, 0.72, 0.9);
    model.add(shoulder);

    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.36, 4, 8), navy);
    arm.position.set(side * 0.31, 0.53, 0.02);
    arm.rotation.z = side * 0.22;
    model.add(arm);

    const bracer = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), gold);
    bracer.position.set(side * 0.36, 0.37, 0.03);
    bracer.rotation.z = side * 0.24;
    model.add(bracer);

    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42, 4, 8), navy);
    leg.position.set(side * 0.12, 0.03, 0.02);
    model.add(leg);

    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 4, 8), gold);
    boot.position.set(side * 0.12, -0.19, 0.03);
    model.add(boot);

    const trimLine = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 6), gold);
    trimLine.position.set(side * 0.12, 0.49, 0.2);
    trimLine.rotation.z = side * 0.42;
    model.add(trimLine);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), skin);
  head.position.y = 1.05;
  head.castShadow = true;
  model.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hair.position.set(0, 1.11, -0.03);
  hair.rotation.x = -0.28;
  model.add(hair);

  const forelock = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), hairMat);
  forelock.position.set(-0.06, 1.0, 0.14);
  forelock.rotation.x = 0.55;
  model.add(forelock);

  const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 5, 10), hairMat);
  ponytail.position.set(0.18, 0.87, -0.24);
  ponytail.rotation.x = 0.88;
  ponytail.rotation.z = -0.34;
  model.add(ponytail);

  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 18), navy);
  ribbon.position.set(0.12, 1.18, -0.1);
  ribbon.rotation.set(0.2, 0.25, 0.8);
  model.add(ribbon);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.05, 0.018), new THREE.MeshStandardMaterial({ color: 0xdfe8f4, roughness: 0.22, metalness: 0.85 }));
  blade.position.set(0.47, 0.32, 0.05);
  blade.rotation.z = -0.86;
  model.add(blade);

  const swordCore = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.78, 0.022), blueGem);
  swordCore.position.copy(blade.position);
  swordCore.rotation.copy(blade.rotation);
  model.add(swordCore);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.045), gold);
  guard.position.set(0.24, 0.54, 0.08);
  guard.rotation.z = -0.86;
  model.add(guard);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055), blueGem);
  gem.position.set(0.25, 0.53, 0.12);
  model.add(gem);

  const selection = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.025, 8, 32),
    new THREE.MeshBasicMaterial({ color: selected ? 0xffe0a0 : hero.trim })
  );
  selection.rotation.x = Math.PI / 2;
  selection.position.y = -0.28;
  group.add(selection);

  addHealthBar(group, hero.hp / heroStats(hero).maxHp, 1.36, selected ? 0xffe0a0 : 0xffffff);
  return group;
}

function createEnemyMesh(enemy: Enemy, state: GameState) {
  const group = new THREE.Group();
  group.position.copy(toWorld(enemy, state));
  const isBoss = enemy.type === "boss";
  const radius = isBoss ? 0.38 : enemy.type === "duelist" ? 0.25 : 0.2;
  const elementColor = new THREE.Color(elementColors[enemy.element]).getHex();
  const body = new THREE.Mesh(
    isBoss
      ? sharedGeometry(`enemy-boss-${radius}`, () => new THREE.DodecahedronGeometry(radius, 0))
      : sharedGeometry(`enemy-${enemy.type}-${radius}`, () => new THREE.ConeGeometry(radius, isBoss ? 0.9 : 0.56, 5)),
    sharedStandardMaterial(`enemy-${enemy.type}-${elementColor}`, {
      color: elementColor,
      roughness: 0.6,
      metalness: isBoss ? 0.18 : 0.04
    })
  );
  body.position.y = isBoss ? 0.56 : 0.36;
  body.castShadow = true;
  group.add(body);

  if (isBoss) {
    const crown = new THREE.Mesh(
      sharedGeometry("enemy-boss-crown", () => new THREE.TorusGeometry(0.48, 0.025, 8, 36)),
      sharedBasicMaterial("enemy-boss-crown", { color: 0xffcf6f })
    );
    crown.position.y = 1.08;
    crown.rotation.x = Math.PI / 2;
    group.add(crown);
  }

  const elementRing = new THREE.Mesh(
    sharedGeometry(`enemy-ring-${radius}`, () => new THREE.TorusGeometry(radius + 0.08, 0.015, 8, 30)),
    sharedBasicMaterial(`enemy-ring-${elementColor}`, { color: elementColor })
  );
  elementRing.position.y = 0.06;
  elementRing.rotation.x = Math.PI / 2;
  group.add(elementRing);

  addHealthBar(group, enemy.hp / enemy.maxHp, isBoss ? 1.35 : 0.82, isBoss ? 0xffcf6f : 0xffffff);
  return group;
}

function addHealthBar(group: THREE.Group, ratio: number, y: number, frameColor: number) {
  const back = new THREE.Mesh(
    sharedGeometry("health-back-box", () => new THREE.BoxGeometry(0.72, 0.045, 0.035)),
    sharedBasicMaterial(`health-back-${frameColor}`, { color: frameColor })
  );
  back.position.set(0, y, 0);
  group.add(back);
  const fillWidth = 0.68 * clamp(ratio, 0, 1);
  const fill = new THREE.Mesh(
    sharedGeometry("health-fill-box", () => new THREE.BoxGeometry(1, 0.05, 0.04)),
    sharedBasicMaterial(`health-fill-${ratio > 0.35 ? "high" : "low"}`, { color: ratio > 0.35 ? 0xde5665 : 0xff9b5f })
  );
  fill.scale.x = fillWidth;
  fill.position.set(-0.34 + fillWidth / 2, y + 0.004, 0.005);
  group.add(fill);
}

function createTextSprite(text: string, color: string, opacity: number) {
  const cacheKey = `${text}:${color}`;
  let texture = textTextureCache.get(cacheKey);
  if (!texture) {
    const canvas = document.createElement("canvas");
    canvas.width = 192;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "700 28px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 96, 32);
    texture = new THREE.CanvasTexture(canvas);
    texture.userData.shared = true;
    textTextureCache.set(cacheKey, texture);
  }
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.55, 0.52, 1);
  return sprite;
}

function renderGame(view: ThreeView, state: GameState) {
  clearGroup(view.units);
  clearGroup(view.effects);

  if (state.targetPoint) {
    const marker = new THREE.Mesh(
      sharedGeometry("target-marker-torus", () => new THREE.TorusGeometry(0.26, 0.025, 8, 40)),
      sharedBasicMaterial("target-marker", { color: 0xffd980 })
    );
    marker.scale.setScalar(1 + state.orderPulse * 0.54);
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
      sharedGeometry("pause-veil-plane", () => new THREE.PlaneGeometry(1, 1)),
      sharedBasicMaterial("pause-veil", { color: 0x000000, transparent: true, opacity: 0.36 })
    );
    veil.scale.set(state.view.w / WORLD_SCALE, state.view.h / WORLD_SCALE, 1);
    veil.position.set(0, 2.6, 0);
    veil.rotation.x = -Math.PI / 2;
    view.effects.add(veil);
  }

  view.renderer.render(view.scene, view.camera);
}

class ThreeGameRenderer {
  private view: ThreeView | null = null;
  private dpr = 1;
  private zoom = 1.35;
  private cameraYaw = 0.725;
  private cameraPitch = 0.62;
  private renderedArea: AreaId | null = null;
  private contextLost = false;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly state: GameState
  ) {
    this.canvas.addEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored);
    this.recreateView();
  }

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.state.status = "WebGL context lost. Waiting for restore.";
  };

  private readonly handleContextRestored = () => {
    if (this.disposed) return;
    this.state.status = "WebGL context restored. Rebuilding preview.";
    this.recreateView();
  };

  private recreateView() {
    if (this.disposed) return;
    try {
      if (this.view) disposeThreeView(this.view);
      this.view = createThreeView(this.canvas);
      this.contextLost = false;
      this.renderedArea = null;
      this.resize();
    } catch (error) {
      console.warn("Failed to initialize WebGL renderer.", error);
      this.view = null;
      this.contextLost = true;
      this.state.status = "WebGL renderer could not be initialized. Reloading the preview may recover it.";
    }
  }

  resize() {
    if (!this.view || this.contextLost) return;
    this.dpr = Math.max(1, Math.min(1.35, window.devicePixelRatio || 1));
    resizeThreeView(this.view, this.state, this.canvas, this.dpr);
    this.applyCamera();
  }

  zoomBy(deltaY: number) {
    const direction = deltaY > 0 ? -1 : 1;
    const factor = direction > 0 ? 1.16 : 1 / 1.08;
    this.zoom = clamp(this.zoom * factor, 0.95, 4.2);
    this.applyCamera();
  }

  rotateCamera(deltaX: number, deltaY: number) {
    this.cameraYaw -= deltaX * 0.006;
    this.cameraPitch = clamp(this.cameraPitch - deltaY * 0.004, 0.18, 0.94);
    this.applyCamera();
  }

  private applyCamera() {
    if (!this.view || this.contextLost) return;
    this.state.cameraYaw = this.cameraYaw;
    const horizontalRadius = Math.cos(this.cameraPitch) * CAMERA_RADIUS;
    this.view.camera.position.set(
      Math.sin(this.cameraYaw) * horizontalRadius,
      Math.sin(this.cameraPitch) * CAMERA_RADIUS,
      Math.cos(this.cameraYaw) * horizontalRadius
    );
    this.view.camera.lookAt(0, 0, 0);
    this.view.camera.zoom = this.zoom;
    this.view.camera.updateProjectionMatrix();
  }

  render() {
    if (!this.view || this.contextLost) return;
    if (this.renderedArea !== this.state.area) {
      rebuildField(this.view, this.state);
      this.renderedArea = this.state.area;
    }
    try {
      renderGame(this.view, this.state);
    } catch (error) {
      console.warn("WebGL render failed.", error);
      this.contextLost = true;
      this.state.status = "WebGL rendering stopped. Waiting for context restore.";
    }
  }

  dispose() {
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.handleContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored);
    if (!this.view) return;
    disposeThreeView(this.view);
    this.view = null;
  }
}

export { ThreeGameRenderer };
