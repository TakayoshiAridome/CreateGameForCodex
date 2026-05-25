import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HERO_GLB_RUN_ANIMATION_TIME_SCALE, clamp, heroStats, type GameState, type Hero } from "./core";
import { toWorld } from "./rendererCamera";
import { loadCachedGltf } from "./rendererGltfCache";
import { addHealthBar } from "./rendererHealth";
import { sharedTextureKeys } from "./rendererShared";

type CordelsAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
  baseY: number;
};

const CORDELS_IDLE_MODEL_URL = "/assets/cordels_idle_02.glb";
const CORDELS_COMBAT_STANCE_MODEL_URL = "/assets/cordels_combat_stance.glb";
const CORDELS_RUN_MODEL_URL = "/assets/cordels_run.glb";
const CORDELS_ATTACK_MODEL_URL = "/assets/cordels_attack.glb";
const CORDELS_RUN_VERTICAL_OFFSET = 0.06;
const CORDELS_ATTACK_VERTICAL_OFFSET = 0.02;
const CORDELS_RUN_ANIMATION_SPEED_MULTIPLIER = 1.22;
const CORDELS_ATTACK_ANIMATION_SPEED_MULTIPLIER = 1.45;

let cordelsIdleModel: THREE.Group | null = null;
let cordelsIdleClips: THREE.AnimationClip[] = [];
let cordelsIdleLoading = false;
let cordelsIdleFailed = false;
let cordelsIdleInstance: CordelsAnimationInstance | null = null;
let cordelsCombatStanceModel: THREE.Group | null = null;
let cordelsCombatStanceClips: THREE.AnimationClip[] = [];
let cordelsCombatStanceLoading = false;
let cordelsCombatStanceFailed = false;
let cordelsCombatStanceInstance: CordelsAnimationInstance | null = null;
let cordelsRunModel: THREE.Group | null = null;
let cordelsRunClips: THREE.AnimationClip[] = [];
let cordelsRunLoading = false;
let cordelsRunFailed = false;
let cordelsRunInstance: CordelsAnimationInstance | null = null;
let cordelsAttackModel: THREE.Group | null = null;
let cordelsAttackClips: THREE.AnimationClip[] = [];
let cordelsAttackLoading = false;
let cordelsAttackFailed = false;
let cordelsAttackInstance: CordelsAnimationInstance | null = null;

function markSharedMaterial(material: THREE.Material) {
  material.userData.shared = true;
  const texturedMaterial = material as THREE.Material & Partial<Record<(typeof sharedTextureKeys)[number], THREE.Texture>>;
  for (const key of sharedTextureKeys) {
    const texture = texturedMaterial[key];
    if (!texture) continue;
    texture.userData.shared = true;
    if (key === "map" || key === "emissiveMap") texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }

  const litMaterial = material as THREE.MeshStandardMaterial;
  if (litMaterial.color) litMaterial.color.multiplyScalar(1.16);
  if (litMaterial.emissive) {
    litMaterial.emissive.set(0x221006);
    litMaterial.emissiveIntensity = 0.04;
  }
  if (typeof litMaterial.roughness === "number") litMaterial.roughness = Math.min(Math.max(litMaterial.roughness, 0.38), 0.72);
}

function markSharedObject(object: THREE.Object3D) {
  object.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry.userData.shared = true;
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) markSharedMaterial(item);
    } else if (material) {
      markSharedMaterial(material);
    }
  });
}

function normalizeCordelsModel(model: THREE.Group) {
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.68 / Math.max(initialSize.y, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y - 0.28, -center.z);
}

function removeCordelsAttackRootMotion(clips: THREE.AnimationClip[]) {
  return clips.map((clip) => {
    const tracks = clip.tracks.filter((track) => !track.name.startsWith("Hips.position") && !track.name.startsWith("Hips.quaternion"));
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  });
}

function loadCordelsIdleModel() {
  if (cordelsIdleModel || cordelsIdleLoading || cordelsIdleFailed) return cordelsIdleModel;
  cordelsIdleLoading = true;
  loadCachedGltf(CORDELS_IDLE_MODEL_URL)
    .then((gltf) => {
      cordelsIdleModel = gltf.scene;
      cordelsIdleClips = gltf.animations;
      normalizeCordelsModel(cordelsIdleModel);
      markSharedObject(cordelsIdleModel);
      cordelsIdleLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Cordels idle GLB model.", error);
      cordelsIdleFailed = true;
      cordelsIdleLoading = false;
    });
  return cordelsIdleModel;
}

function loadCordelsCombatStanceModel() {
  if (cordelsCombatStanceModel || cordelsCombatStanceLoading || cordelsCombatStanceFailed) return cordelsCombatStanceModel;
  cordelsCombatStanceLoading = true;
  loadCachedGltf(CORDELS_COMBAT_STANCE_MODEL_URL)
    .then((gltf) => {
      cordelsCombatStanceModel = gltf.scene;
      cordelsCombatStanceClips = gltf.animations;
      normalizeCordelsModel(cordelsCombatStanceModel);
      markSharedObject(cordelsCombatStanceModel);
      cordelsCombatStanceLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Cordels combat stance GLB model.", error);
      cordelsCombatStanceFailed = true;
      cordelsCombatStanceLoading = false;
    });
  return cordelsCombatStanceModel;
}

function loadCordelsRunModel() {
  if (cordelsRunModel || cordelsRunLoading || cordelsRunFailed) return cordelsRunModel;
  cordelsRunLoading = true;
  loadCachedGltf(CORDELS_RUN_MODEL_URL)
    .then((gltf) => {
      cordelsRunModel = gltf.scene;
      cordelsRunClips = gltf.animations;
      normalizeCordelsModel(cordelsRunModel);
      markSharedObject(cordelsRunModel);
      cordelsRunLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Cordels run GLB model.", error);
      cordelsRunFailed = true;
      cordelsRunLoading = false;
    });
  return cordelsRunModel;
}

function loadCordelsAttackModel() {
  if (cordelsAttackModel || cordelsAttackLoading || cordelsAttackFailed) return cordelsAttackModel;
  cordelsAttackLoading = true;
  loadCachedGltf(CORDELS_ATTACK_MODEL_URL)
    .then((gltf) => {
      cordelsAttackModel = gltf.scene;
      cordelsAttackClips = removeCordelsAttackRootMotion(gltf.animations);
      normalizeCordelsModel(cordelsAttackModel);
      markSharedObject(cordelsAttackModel);
      cordelsAttackLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Cordels attack GLB model.", error);
      cordelsAttackFailed = true;
      cordelsAttackLoading = false;
    });
  return cordelsAttackModel;
}

function createCordelsAnimatedInstance(
  instance: CordelsAnimationInstance | null,
  setInstance: (next: CordelsAnimationInstance) => void,
  source: THREE.Group | null,
  clips: THREE.AnimationClip[],
  time: number,
  verticalOffset = 0
) {
  if (!source) return null;
  const clip = clips[0] ?? null;
  if (!instance) {
    const model = cloneSkeleton(source) as THREE.Group;
    let mixer: THREE.AnimationMixer | null = null;
    if (clip && clip.duration > 0) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(clip).play();
    }
    instance = { model, mixer, clip, baseY: model.position.y };
    setInstance(instance);
  }
  instance.model.position.y = instance.baseY + verticalOffset;
  if (instance.mixer && instance.clip && instance.clip.duration > 0) {
    instance.mixer.setTime(time % instance.clip.duration);
  }
  return instance.model;
}

function createCordelsIdleInstance(hero: Hero) {
  return createCordelsAnimatedInstance(
    cordelsIdleInstance,
    (next) => {
      cordelsIdleInstance = next;
    },
    loadCordelsIdleModel(),
    cordelsIdleClips,
    hero.hp > 0 ? performance.now() * 0.001 : 0
  );
}

function createCordelsCombatStanceInstance(hero: Hero) {
  return createCordelsAnimatedInstance(
    cordelsCombatStanceInstance,
    (next) => {
      cordelsCombatStanceInstance = next;
    },
    loadCordelsCombatStanceModel(),
    cordelsCombatStanceClips,
    hero.hp > 0 ? performance.now() * 0.001 : 0
  );
}

function createCordelsSkillInstance(hero: Hero) {
  if (hero.skillPose === "guard" || hero.skillPose === "rally") return createCordelsCombatStanceInstance(hero);
  return createCordelsAttackInstance(hero);
}

function createCordelsRunInstance(hero: Hero) {
  return createCordelsAnimatedInstance(
    cordelsRunInstance,
    (next) => {
      cordelsRunInstance = next;
    },
    loadCordelsRunModel(),
    cordelsRunClips,
    hero.runTime * HERO_GLB_RUN_ANIMATION_TIME_SCALE * CORDELS_RUN_ANIMATION_SPEED_MULTIPLIER,
    CORDELS_RUN_VERTICAL_OFFSET
  );
}

function hasCordelsCombatStanceTarget(hero: Hero, state: GameState) {
  if (hero.hp <= 0 || hero.moving || hero.attacking) return false;
  const range = heroStats(hero).range;
  return state.enemies.some((enemy) => enemy.hp > 0 && Math.hypot(enemy.x - hero.x, enemy.y - hero.y) <= range);
}

function createCordelsAttackInstance(hero: Hero) {
  return createCordelsAnimatedInstance(
    cordelsAttackInstance,
    (next) => {
      cordelsAttackInstance = next;
    },
    loadCordelsAttackModel(),
    cordelsAttackClips,
    hero.attackTime * heroStats(hero).attackSpeed * CORDELS_ATTACK_ANIMATION_SPEED_MULTIPLIER,
    CORDELS_ATTACK_VERTICAL_OFFSET
  );
}

function preloadCordelsModels() {
  loadCordelsIdleModel();
  loadCordelsCombatStanceModel();
  loadCordelsRunModel();
  loadCordelsAttackModel();
}

function cordelsSkillPulse(hero: Hero) {
  if (!hero.skillPose) return 0;
  const duration = hero.skillPose === "cast" || hero.skillPose === "rally" ? 0.78 : 0.58;
  return Math.sin((1 - clamp((hero.skillTime ?? 0) / duration, 0, 1)) * Math.PI);
}

function createCordelsMesh(hero: Hero, state: GameState, index: number) {
  preloadCordelsModels();
  const skillModel = hero.skillPose ? createCordelsSkillInstance(hero) : null;
  const attackModel = hero.attacking ? createCordelsAttackInstance(hero) : null;
  const runModel = hero.moving ? createCordelsRunInstance(hero) : null;
  const combatStanceModel = hasCordelsCombatStanceTarget(hero, state) ? createCordelsCombatStanceInstance(hero) : null;
  const gltfModel = skillModel ?? attackModel ?? runModel ?? combatStanceModel ?? createCordelsIdleInstance(hero);
  if (!gltfModel) return null;

  const group = new THREE.Group();
  group.position.copy(toWorld(hero, state));
  const model = new THREE.Group();
  model.rotation.y = hero.hp > 0 ? hero.facing : 0;
  const skillPulse = cordelsSkillPulse(hero);
  if (hero.skillPose === "slash") {
    model.rotation.y += 0.24 * skillPulse;
    model.rotation.z -= 0.16 * skillPulse;
    model.position.y += 0.04 * skillPulse;
    model.position.z += 0.1 * skillPulse;
  } else if (hero.skillPose === "guard") {
    model.rotation.z -= 0.05 * skillPulse;
    model.position.y += 0.03 * skillPulse;
  } else if (hero.skillPose === "rally") {
    model.rotation.y += 0.14 * skillPulse;
    model.position.y += 0.08 * skillPulse;
  } else if (hero.skillPose) {
    model.rotation.y += 0.18 * skillPulse;
    model.position.z += 0.06 * skillPulse;
  }
  model.add(gltfModel);
  group.add(model);

  const selected = state.selected === index;
  const selection = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.025, 8, 36),
    new THREE.MeshBasicMaterial({ color: selected ? 0xffe0a0 : hero.trim })
  );
  selection.rotation.x = Math.PI / 2;
  selection.position.y = -0.28;
  group.add(selection);
  if (hero.skillPose) {
    const glow = new THREE.Mesh(
      new THREE.TorusGeometry(0.42 + skillPulse * 0.18, 0.018, 8, 42),
      new THREE.MeshBasicMaterial({ color: hero.trim, transparent: true, opacity: 0.42 + skillPulse * 0.18 })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.24 + skillPulse * 0.08;
    group.add(glow);
  }
  addHealthBar(group, hero.hp / heroStats(hero).maxHp, 1.54, selected ? 0xffe0a0 : 0xffffff);
  return group;
}

export { createCordelsMesh };
