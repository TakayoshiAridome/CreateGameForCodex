import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HERO_GLB_RUN_ANIMATION_TIME_SCALE, basicAttackMotionDuration, clamp, heroStats, type GameState, type Hero } from "./core";
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
const CORDELS_HEART_SABER_MODEL_URL = "/assets/cordelsheart_saber.glb";
const CORDELS_RIGHT_HAND_BONE = "RightHand";
const CORDELS_RUN_VERTICAL_OFFSET = 0.06;
const CORDELS_ATTACK_VERTICAL_OFFSET = 0.02;
const CORDELS_HEART_SABER_SCALE = 100;
const CORDELS_HEART_SABER_ROTATION = new THREE.Euler(0.08, -0.12, -0.74 - Math.PI / 4);
const CORDELS_HEART_SABER_GRIP_POINT = new THREE.Vector3(0, -0.34, 0);
const CORDELS_HEART_SABER_HAND_OFFSET = new THREE.Vector3(-0.035, 0.085, 0);
const CORDELS_HEART_SABER_SCALED_GRIP_OFFSET = CORDELS_HEART_SABER_GRIP_POINT.clone().multiplyScalar(-CORDELS_HEART_SABER_SCALE);
const CORDELS_HEART_SABER_SCALED_HAND_OFFSET = CORDELS_HEART_SABER_HAND_OFFSET.clone().multiplyScalar(CORDELS_HEART_SABER_SCALE);
const CORDELS_RUN_ANIMATION_SPEED_MULTIPLIER = 1.22;
const CORDELS_MATERIAL_BRIGHTNESS = 1.58;
const CORDELS_MATERIAL_EMISSIVE_INTENSITY = 0.13;
const CORDELS_SHADOW_LIFT = 0.3;
const CORDELS_SATURATION = 1.92;
const CORDELS_MATERIAL_ROUGHNESS = 0.62;
const CORDELS_MATERIAL_SPECULAR_INTENSITY = 0.22;
const CORDELS_HEART_SABER_BRIGHTNESS = 1.68;
const CORDELS_HEART_SABER_EMISSIVE_INTENSITY = 0.14;
const CORDELS_HEART_SABER_SHADOW_LIFT = 0.32;
const CORDELS_HEART_SABER_SATURATION = 2.08;

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
let cordelsHeartSaberModel: THREE.Group | null = null;
let cordelsHeartSaberLoading = false;
let cordelsHeartSaberFailed = false;

function markSharedMaterial(
  material: THREE.Material,
  brightness = CORDELS_MATERIAL_BRIGHTNESS,
  emissiveIntensity = CORDELS_MATERIAL_EMISSIVE_INTENSITY,
  shadowLift = CORDELS_SHADOW_LIFT,
  saturation = CORDELS_SATURATION
) {
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
  if (litMaterial.color) litMaterial.color.multiplyScalar(brightness);
  if (litMaterial.emissive) {
    litMaterial.emissive.set(0xffffff);
    litMaterial.emissiveIntensity = emissiveIntensity;
  }
  if (typeof litMaterial.roughness === "number") litMaterial.roughness = CORDELS_MATERIAL_ROUGHNESS;
  const specularMaterial = material as THREE.MeshPhysicalMaterial;
  if (typeof specularMaterial.specularIntensity === "number") specularMaterial.specularIntensity = CORDELS_MATERIAL_SPECULAR_INTENSITY;
  if (specularMaterial.specularColor) specularMaterial.specularColor.setScalar(0.55);
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float cordelsLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb += (1.0 - smoothstep(0.12, 0.62, cordelsLuma)) * ${shadowLift.toFixed(2)};
      float cordelsLiftedLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(cordelsLiftedLuma), diffuseColor.rgb, ${saturation.toFixed(2)});`
    );
  };
  material.customProgramCacheKey = () => `cordels-brightness-${brightness}-emissive-${emissiveIntensity}-shadow-lift-${shadowLift}-saturation-${saturation}`;
  material.needsUpdate = true;
}

function markSharedObject(
  object: THREE.Object3D,
  brightness = CORDELS_MATERIAL_BRIGHTNESS,
  emissiveIntensity = CORDELS_MATERIAL_EMISSIVE_INTENSITY,
  shadowLift = CORDELS_SHADOW_LIFT,
  saturation = CORDELS_SATURATION
) {
  object.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = false;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry) mesh.geometry.userData.shared = true;
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) markSharedMaterial(item, brightness, emissiveIntensity, shadowLift, saturation);
    } else if (material) {
      markSharedMaterial(material, brightness, emissiveIntensity, shadowLift, saturation);
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

function normalizeCordelsHeartSaber(model: THREE.Group) {
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 0.95 / Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -center.y, -center.z);
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
      cordelsAttackClips = gltf.animations;
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

function loadCordelsHeartSaberModel() {
  if (cordelsHeartSaberModel || cordelsHeartSaberLoading || cordelsHeartSaberFailed) return cordelsHeartSaberModel;
  cordelsHeartSaberLoading = true;
  loadCachedGltf(CORDELS_HEART_SABER_MODEL_URL)
    .then((gltf) => {
      cordelsHeartSaberModel = gltf.scene;
      normalizeCordelsHeartSaber(cordelsHeartSaberModel);
      markSharedObject(
        cordelsHeartSaberModel,
        CORDELS_HEART_SABER_BRIGHTNESS,
        CORDELS_HEART_SABER_EMISSIVE_INTENSITY,
        CORDELS_HEART_SABER_SHADOW_LIFT,
        CORDELS_HEART_SABER_SATURATION
      );
      cordelsHeartSaberLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Cordels Heart Saber GLB model.", error);
      cordelsHeartSaberFailed = true;
      cordelsHeartSaberLoading = false;
    });
  return cordelsHeartSaberModel;
}

function createCordelsAnimatedInstance(
  instance: CordelsAnimationInstance | null,
  setInstance: (next: CordelsAnimationInstance) => void,
  source: THREE.Group | null,
  clips: THREE.AnimationClip[],
  time: number,
  verticalOffset = 0,
  loop = true
) {
  if (!source) return null;
  const clip = clips[0] ?? null;
  if (!instance) {
    const model = cloneSkeleton(source) as THREE.Group;
    let mixer: THREE.AnimationMixer | null = null;
    if (clip && clip.duration > 0) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      if (!loop) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      action.play();
    }
    instance = { model, mixer, clip, baseY: model.position.y };
    setInstance(instance);
  }
  instance.model.position.y = instance.baseY + verticalOffset;
  if (instance.mixer && instance.clip && instance.clip.duration > 0) {
    instance.mixer.setTime(loop ? time % instance.clip.duration : clamp(time, 0, instance.clip.duration));
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
  const clipDuration = cordelsAttackClips[0]?.duration ?? 0;
  const attackProgress = clamp(hero.attackTime / basicAttackMotionDuration(hero), 0, 1);
  return createCordelsAnimatedInstance(
    cordelsAttackInstance,
    (next) => {
      cordelsAttackInstance = next;
    },
    loadCordelsAttackModel(),
    cordelsAttackClips,
    clipDuration * attackProgress,
    CORDELS_ATTACK_VERTICAL_OFFSET,
    false
  );
}

function createCordelsHeartSaberInstance() {
  const source = loadCordelsHeartSaberModel();
  if (!source) return null;
  const weapon = cloneSkeleton(source) as THREE.Group;
  weapon.name = "CordelsHeartSaberMesh";
  weapon.scale.multiplyScalar(CORDELS_HEART_SABER_SCALE);
  weapon.position.copy(CORDELS_HEART_SABER_SCALED_GRIP_OFFSET);
  return weapon;
}

function attachCordelsHeartSaber(gltfModel: THREE.Group) {
  const rightHand = gltfModel.getObjectByName(CORDELS_RIGHT_HAND_BONE);
  if (!rightHand) return;
  const existing = rightHand.getObjectByName("CordelsHeartSaber");
  const holder = existing ?? new THREE.Group();
  holder.name = "CordelsHeartSaber";
  holder.position.copy(CORDELS_HEART_SABER_SCALED_HAND_OFFSET);
  holder.rotation.copy(CORDELS_HEART_SABER_ROTATION);
  if (existing) return;
  const weapon = createCordelsHeartSaberInstance();
  if (!weapon) return;
  holder.add(weapon);
  rightHand.add(holder);
}

function preloadCordelsModels() {
  loadCordelsIdleModel();
  loadCordelsCombatStanceModel();
  loadCordelsRunModel();
  loadCordelsAttackModel();
  loadCordelsHeartSaberModel();
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
  attachCordelsHeartSaber(gltfModel);
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
