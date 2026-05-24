import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { elementColors, type Enemy, type GameState } from "./core";
import { toWorld } from "./rendererCamera";
import { addHealthBar } from "./rendererHealth";
import { sharedBasicMaterial, sharedGeometry, sharedStandardMaterial, sharedTextureKeys } from "./rendererShared";

type EnemyAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
};

const WOLF_MODEL_URL = "/assets/wolf.glb";
const BOAR_MODEL_URL = "/assets/boar.glb";
const BEAR_MODEL_URL = "/assets/bear.glb";

let wolfGltfModel: THREE.Group | null = null;
let wolfGltfClips: THREE.AnimationClip[] = [];
let wolfGltfLoading = false;
let wolfGltfFailed = false;
const wolfAnimationInstances = new WeakMap<Enemy, EnemyAnimationInstance>();

let boarGltfModel: THREE.Group | null = null;
let boarGltfClips: THREE.AnimationClip[] = [];
let boarGltfLoading = false;
let boarGltfFailed = false;
const boarAnimationInstances = new WeakMap<Enemy, EnemyAnimationInstance>();

let bearGltfModel: THREE.Group | null = null;
let bearGltfClips: THREE.AnimationClip[] = [];
let bearGltfLoading = false;
let bearGltfFailed = false;
const bearAnimationInstances = new WeakMap<Enemy, EnemyAnimationInstance>();

function markSharedMaterial(material: THREE.Material) {
  material.userData.shared = true;
  const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
  for (const key of sharedTextureKeys) {
    const texture = texturedMaterial[key];
    if (texture) texture.userData.shared = true;
  }
}

function markGenericSharedObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    child.castShadow = true;
    child.receiveShadow = true;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry.userData.shared = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      markSharedMaterial(material);
      const litMaterial = material as THREE.MeshStandardMaterial;
      const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
      if (texturedMaterial.map) {
        texturedMaterial.map.colorSpace = THREE.SRGBColorSpace;
        texturedMaterial.map.needsUpdate = true;
      }
      if (litMaterial.color) litMaterial.color.multiplyScalar(1.08);
      if (typeof litMaterial.roughness === "number") litMaterial.roughness = Math.min(0.88, litMaterial.roughness + 0.08);
    }
  });
}

function normalizeQuadrupedModel(model: THREE.Group, targetSize: number) {
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = targetSize / Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function loadEnemyGltfModel(
  url: string,
  label: string,
  setLoading: (loading: boolean) => void,
  setFailed: () => void,
  assign: (scene: THREE.Group, clips: THREE.AnimationClip[]) => void,
  normalize: (scene: THREE.Group) => void
) {
  setLoading(true);
  new GLTFLoader().load(
    url,
    (gltf) => {
      normalize(gltf.scene);
      markGenericSharedObject(gltf.scene);
      assign(gltf.scene, gltf.animations);
      setLoading(false);
    },
    undefined,
    (error) => {
      console.warn(`Failed to load ${label} GLB model.`, error);
      setFailed();
      setLoading(false);
    }
  );
}

function loadWolfGltfModel() {
  if (wolfGltfModel || wolfGltfLoading || wolfGltfFailed) return wolfGltfModel;
  loadEnemyGltfModel(
    WOLF_MODEL_URL,
    "wolf",
    (loading) => { wolfGltfLoading = loading; },
    () => { wolfGltfFailed = true; },
    (scene, clips) => {
      wolfGltfModel = scene;
      wolfGltfClips = clips;
    },
    (scene) => normalizeQuadrupedModel(scene, 1.48)
  );
  return wolfGltfModel;
}

function loadBoarGltfModel() {
  if (boarGltfModel || boarGltfLoading || boarGltfFailed) return boarGltfModel;
  loadEnemyGltfModel(
    BOAR_MODEL_URL,
    "boar",
    (loading) => { boarGltfLoading = loading; },
    () => { boarGltfFailed = true; },
    (scene, clips) => {
      boarGltfModel = scene;
      boarGltfClips = clips;
    },
    (scene) => normalizeQuadrupedModel(scene, 1.48)
  );
  return boarGltfModel;
}

function loadBearGltfModel() {
  if (bearGltfModel || bearGltfLoading || bearGltfFailed) return bearGltfModel;
  loadEnemyGltfModel(
    BEAR_MODEL_URL,
    "bear",
    (loading) => { bearGltfLoading = loading; },
    () => { bearGltfFailed = true; },
    (scene, clips) => {
      bearGltfModel = scene;
      bearGltfClips = clips;
    },
    (scene) => normalizeQuadrupedModel(scene, 1.62)
  );
  return bearGltfModel;
}

function createEnemyGltfInstance(enemy: Enemy, source: THREE.Group | null, clips: THREE.AnimationClip[], instances: WeakMap<Enemy, EnemyAnimationInstance>) {
  if (!source) return null;
  const cached = instances.get(enemy);
  if (cached) {
    if (cached.mixer && cached.clip) cached.mixer.setTime((enemy.animationTime ?? 0) % cached.clip.duration);
    return cached.model;
  }

  const model = cloneSkeleton(source) as THREE.Group;
  let mixer: THREE.AnimationMixer | null = null;
  let clip: THREE.AnimationClip | null = null;
  if (clips.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    clip = clips[0];
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime((enemy.animationTime ?? 0) % clip.duration);
  }
  instances.set(enemy, { model, mixer, clip });
  return model;
}

function createWolfGltfInstance(enemy: Enemy) {
  return createEnemyGltfInstance(enemy, loadWolfGltfModel(), wolfGltfClips, wolfAnimationInstances);
}

function createBoarGltfInstance(enemy: Enemy) {
  return createEnemyGltfInstance(enemy, loadBoarGltfModel(), boarGltfClips, boarAnimationInstances);
}

function createBearGltfInstance(enemy: Enemy) {
  return createEnemyGltfInstance(enemy, loadBearGltfModel(), bearGltfClips, bearAnimationInstances);
}

function createEnemyMesh(enemy: Enemy, state: GameState) {
  const group = new THREE.Group();
  group.position.copy(toWorld(enemy, state));
  const model = new THREE.Group();
  model.rotation.y = enemy.facing;
  group.add(model);

  const isBoss = enemy.type === "boss";
  const isWolf = enemy.type === "wolf";
  const isBoar = enemy.type === "boar";
  const isBear = enemy.type === "bear";
  const radius = isBoss ? 0.38 : enemy.type === "duelist" ? 0.25 : isBear ? 0.32 : isBoar ? 0.26 : 0.2;
  const elementColor = new THREE.Color(elementColors[enemy.element]).getHex();
  const wolfModel = isWolf ? createWolfGltfInstance(enemy) : null;
  const boarModel = isBoar ? createBoarGltfInstance(enemy) : null;
  const bearModel = isBear ? createBearGltfInstance(enemy) : null;

  if (wolfModel) model.add(wolfModel);
  if (boarModel) model.add(boarModel);
  if (bearModel) model.add(bearModel);

  const bodyGeometry = isBoss
    ? sharedGeometry(`enemy-boss-${radius}`, () => new THREE.DodecahedronGeometry(radius, 0))
    : isWolf
      ? sharedGeometry("enemy-wolf-body", () => new THREE.BoxGeometry(0.26, 0.24, 0.5))
      : isBoar
        ? sharedGeometry("enemy-boar-body", () => new THREE.SphereGeometry(0.34, 18, 12))
        : isBear
          ? sharedGeometry("enemy-bear-body", () => new THREE.CapsuleGeometry(0.36, 0.46, 8, 14))
          : sharedGeometry(`enemy-${enemy.type}-${radius}`, () => new THREE.ConeGeometry(radius, 0.56, 5));
  const body = new THREE.Mesh(
    bodyGeometry,
    sharedStandardMaterial(`enemy-${enemy.type}-${elementColor}`, {
      color: elementColor,
      roughness: 0.6,
      metalness: isBoss ? 0.18 : 0.04
    })
  );
  if (isBoar) body.scale.set(1.25, 0.72, 1.62);
  if (isBear) body.scale.set(1.18, 1.08, 1.38);
  body.position.y = isBoss ? 0.56 : isWolf ? 0.28 : isBear ? 0.44 : 0.36;
  body.castShadow = true;
  if (!wolfModel && !boarModel && !bearModel) model.add(body);

  if (isWolf && !wolfModel) addWolfFallback(model, elementColor);
  if (isBoar && !boarModel) addBoarFallback(model, elementColor);
  if (isBear && !bearModel) addBearFallback(model, elementColor);
  if (isBoss) addBossCrown(model);

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

function addWolfFallback(model: THREE.Group, elementColor: number) {
  const head = new THREE.Mesh(
    sharedGeometry("enemy-wolf-head", () => new THREE.ConeGeometry(0.18, 0.28, 4)),
    sharedStandardMaterial(`enemy-wolf-head-${elementColor}`, { color: elementColor, roughness: 0.66, metalness: 0.02 })
  );
  head.position.set(0, 0.34, 0.32);
  head.rotation.x = Math.PI / 2;
  head.castShadow = true;
  model.add(head);

  for (const x of [-0.09, 0.09]) {
    for (const z of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(
        sharedGeometry("enemy-wolf-leg", () => new THREE.BoxGeometry(0.05, 0.22, 0.05)),
        sharedStandardMaterial(`enemy-wolf-leg-${elementColor}`, { color: elementColor, roughness: 0.7 })
      );
      leg.position.set(x, 0.13, z);
      leg.castShadow = true;
      model.add(leg);
    }
  }
}

function addBoarFallback(model: THREE.Group, elementColor: number) {
  const snout = new THREE.Mesh(
    sharedGeometry("enemy-boar-snout", () => new THREE.CapsuleGeometry(0.1, 0.16, 4, 8)),
    sharedStandardMaterial(`enemy-boar-snout-${elementColor}`, { color: elementColor, roughness: 0.72, metalness: 0.02 })
  );
  snout.position.set(0, 0.36, 0.5);
  snout.rotation.x = Math.PI / 2;
  snout.castShadow = true;
  model.add(snout);

  for (const x of [-0.12, 0.12]) {
    const tusk = new THREE.Mesh(
      sharedGeometry("enemy-boar-tusk", () => new THREE.ConeGeometry(0.026, 0.18, 8)),
      sharedBasicMaterial("enemy-boar-tusk", { color: 0xf4ead2 })
    );
    tusk.position.set(x, 0.34, 0.58);
    tusk.rotation.x = Math.PI * 0.62;
    tusk.castShadow = true;
    model.add(tusk);
  }
}

function addBearFallback(model: THREE.Group, elementColor: number) {
  const head = new THREE.Mesh(
    sharedGeometry("enemy-bear-head", () => new THREE.SphereGeometry(0.22, 16, 12)),
    sharedStandardMaterial(`enemy-bear-head-${elementColor}`, { color: elementColor, roughness: 0.74, metalness: 0.02 })
  );
  head.position.set(0, 0.76, 0.38);
  head.scale.set(1.12, 0.92, 1);
  head.castShadow = true;
  model.add(head);

  for (const x of [-0.12, 0.12]) {
    const ear = new THREE.Mesh(
      sharedGeometry("enemy-bear-ear", () => new THREE.SphereGeometry(0.07, 10, 8)),
      sharedStandardMaterial(`enemy-bear-ear-${elementColor}`, { color: elementColor, roughness: 0.76 })
    );
    ear.position.set(x, 0.94, 0.34);
    ear.castShadow = true;
    model.add(ear);
  }

  for (const x of [-0.2, 0.2]) {
    for (const z of [-0.22, 0.2]) {
      const leg = new THREE.Mesh(
        sharedGeometry("enemy-bear-leg", () => new THREE.CapsuleGeometry(0.065, 0.24, 4, 8)),
        sharedStandardMaterial(`enemy-bear-leg-${elementColor}`, { color: elementColor, roughness: 0.76 })
      );
      leg.position.set(x, 0.18, z);
      leg.castShadow = true;
      model.add(leg);
    }
  }
}

function addBossCrown(model: THREE.Group) {
  const crown = new THREE.Mesh(
    sharedGeometry("enemy-boss-crown", () => new THREE.TorusGeometry(0.48, 0.025, 8, 36)),
    sharedBasicMaterial("enemy-boss-crown", { color: 0xffcf6f })
  );
  crown.position.y = 1.08;
  crown.rotation.x = Math.PI / 2;
  model.add(crown);
}

export { createEnemyMesh };
