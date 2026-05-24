import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { clamp, elementColors, heroStats, type Enemy, type GameState, type Hero } from "./core";
import { toWorld } from "./rendererCamera";
import { sharedBasicMaterial, sharedGeometry, sharedStandardMaterial, sharedTextureKeys } from "./rendererShared";

type LuceriaAnimationKind = "idle" | "run" | "attack";
type LuceriaAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
  baseY: number;
};
type WolfAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
};

const LUCERIA_MODEL_URL = "/assets/luceria_swordsaint_apoze.glb";
const LUCERIA_IDLE_MODEL_URL = "/assets/luceria_swordsaint_idle.glb";
const LUCERIA_RUN_MODEL_URL = "/assets/luceria_swordsaint_run.glb";
const LUCERIA_ATTACK_MODEL_URL = "/assets/luceria_swordsaint_attack.glb";
const LUCERIA_CROSSBLADE_MODEL_URL = "/assets/luceria_crossblade.glb";
const WOLF_MODEL_URL = "/assets/wolf.glb";
const BOAR_MODEL_URL = "/assets/boar.glb";
const LUCERIA_SATURATION = 1.62;
const LUCERIA_RUN_VERTICAL_OFFSET = 0.18;
const LUCERIA_RIGHT_HAND_BONE = "RightHand";
const LUCERIA_CROSSBLADE_SCALE = 1.18;
const LUCERIA_CROSSBLADE_ROTATION = new THREE.Euler(0.16, -0.08, -0.86);
const LUCERIA_CROSSBLADE_RUN_ROTATION = new THREE.Euler(0.18, -0.12, -0.82);
const LUCERIA_CROSSBLADE_RUN_EXTRA_ROTATION = new THREE.Euler(0, 0, Math.PI / 2);
const LUCERIA_CROSSBLADE_GRIP_OFFSET = new THREE.Vector3(-0.37, 0.22, 0.03);
const LUCERIA_CROSSBLADE_HAND_OFFSET = new THREE.Vector3();
const LUCERIA_CROSSBLADE_GRIP_POINT = LUCERIA_CROSSBLADE_GRIP_OFFSET.clone().negate().applyQuaternion(new THREE.Quaternion().setFromEuler(LUCERIA_CROSSBLADE_ROTATION).invert());
const LUCERIA_CROSSBLADE_RUN_LOCAL_GRIP_OFFSET = LUCERIA_CROSSBLADE_GRIP_POINT.clone().applyEuler(LUCERIA_CROSSBLADE_RUN_ROTATION).negate().multiplyScalar(100);
const LUCERIA_CROSSBLADE_RUN_SIDE_GRIP_SHIFT = 22;
const LUCERIA_CROSSBLADE_RUN_LEFT_GRIP_SHIFT = 42;
const LUCERIA_ATTACK_FALLBACK_DURATION = 0.92;
const BASIC_ATTACK_VISUAL_DURATION = 0.55;
const MIN_BASIC_ATTACK_VISUAL_DURATION = 0.28;
const luceriaHandWorldPosition = new THREE.Vector3();
const luceriaCrossbladeOffset = new THREE.Vector3();
const luceriaHandWorldQuaternion = new THREE.Quaternion();
const luceriaWeaponParentWorldQuaternion = new THREE.Quaternion();
const luceriaCrossbladeGripQuaternion = new THREE.Quaternion().setFromEuler(LUCERIA_CROSSBLADE_ROTATION);
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
let luceriaCrossbladeModel: THREE.Group | null = null;
let luceriaCrossbladeLoading = false;
let luceriaCrossbladeFailed = false;
const luceriaAnimationInstances: Partial<Record<LuceriaAnimationKind, LuceriaAnimationInstance>> = {};
let wolfGltfModel: THREE.Group | null = null;
let wolfGltfClips: THREE.AnimationClip[] = [];
let wolfGltfLoading = false;
let wolfGltfFailed = false;
const wolfAnimationInstances = new WeakMap<Enemy, WolfAnimationInstance>();
let boarGltfModel: THREE.Group | null = null;
let boarGltfClips: THREE.AnimationClip[] = [];
let boarGltfLoading = false;
let boarGltfFailed = false;
const boarAnimationInstances = new WeakMap<Enemy, WolfAnimationInstance>();

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

function basicAttackPulse(hero: Hero) {
  if (!hero.attacking || hero.skillPose) return 0;
  const duration = Math.max(MIN_BASIC_ATTACK_VISUAL_DURATION, BASIC_ATTACK_VISUAL_DURATION / heroStats(hero).attackSpeed);
  return Math.sin(clamp(hero.attackTime / duration, 0, 1) * Math.PI);
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

function normalizeLuceriaCrossblade(model: THREE.Group) {
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.06 / Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -center.y, -center.z);
}

function normalizeWolfModel(model: THREE.Group) {
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.48 / Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
}

function normalizeBoarModel(model: THREE.Group) {
  model.rotation.y = 0;
  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.48 / Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
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

function loadLuceriaCrossbladeModel() {
  if (luceriaCrossbladeModel || luceriaCrossbladeLoading || luceriaCrossbladeFailed) return luceriaCrossbladeModel;
  luceriaCrossbladeLoading = true;
  new GLTFLoader().load(
    LUCERIA_CROSSBLADE_MODEL_URL,
    (gltf) => {
      luceriaCrossbladeModel = gltf.scene;
      normalizeLuceriaCrossblade(luceriaCrossbladeModel);
      markSharedObject(luceriaCrossbladeModel);
      luceriaCrossbladeLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load Luceria Crossblade GLB model.", error);
      luceriaCrossbladeFailed = true;
      luceriaCrossbladeLoading = false;
    }
  );
  return luceriaCrossbladeModel;
}

function loadWolfGltfModel() {
  if (wolfGltfModel || wolfGltfLoading || wolfGltfFailed) return wolfGltfModel;
  wolfGltfLoading = true;
  new GLTFLoader().load(
    WOLF_MODEL_URL,
    (gltf) => {
      wolfGltfModel = gltf.scene;
      wolfGltfClips = gltf.animations;
      normalizeWolfModel(wolfGltfModel);
      markGenericSharedObject(wolfGltfModel);
      wolfGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load wolf GLB model.", error);
      wolfGltfFailed = true;
      wolfGltfLoading = false;
    }
  );
  return wolfGltfModel;
}

function createWolfGltfInstance(enemy: Enemy) {
  const source = loadWolfGltfModel();
  if (!source) return null;
  const cached = wolfAnimationInstances.get(enemy);
  if (cached) {
    if (cached.mixer && cached.clip) cached.mixer.setTime((enemy.animationTime ?? 0) % cached.clip.duration);
    return cached.model;
  }
  const model = cloneSkeleton(source) as THREE.Group;
  let mixer: THREE.AnimationMixer | null = null;
  let clip: THREE.AnimationClip | null = null;
  if (wolfGltfClips.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    clip = wolfGltfClips[0];
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime((enemy.animationTime ?? 0) % clip.duration);
  }
  wolfAnimationInstances.set(enemy, { model, mixer, clip });
  return model;
}

function loadBoarGltfModel() {
  if (boarGltfModel || boarGltfLoading || boarGltfFailed) return boarGltfModel;
  boarGltfLoading = true;
  new GLTFLoader().load(
    BOAR_MODEL_URL,
    (gltf) => {
      boarGltfModel = gltf.scene;
      boarGltfClips = gltf.animations;
      normalizeBoarModel(boarGltfModel);
      markGenericSharedObject(boarGltfModel);
      boarGltfLoading = false;
    },
    undefined,
    (error) => {
      console.warn("Failed to load boar GLB model.", error);
      boarGltfFailed = true;
      boarGltfLoading = false;
    }
  );
  return boarGltfModel;
}

function createBoarGltfInstance(enemy: Enemy) {
  const source = loadBoarGltfModel();
  if (!source) return null;
  const cached = boarAnimationInstances.get(enemy);
  if (cached) {
    if (cached.mixer && cached.clip) cached.mixer.setTime((enemy.animationTime ?? 0) % cached.clip.duration);
    return cached.model;
  }
  const model = cloneSkeleton(source) as THREE.Group;
  let mixer: THREE.AnimationMixer | null = null;
  let clip: THREE.AnimationClip | null = null;
  if (boarGltfClips.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    clip = boarGltfClips[0];
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime((enemy.animationTime ?? 0) % clip.duration);
  }
  boarAnimationInstances.set(enemy, { model, mixer, clip });
  return model;
}

function preloadLuceriaModels() {
  loadLuceriaGltfModel();
  loadLuceriaIdleGltfModel();
  loadLuceriaRunGltfModel();
  loadLuceriaAttackGltfModel();
  loadLuceriaCrossbladeModel();
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
  return createLuceriaAnimatedInstance("attack", loadLuceriaAttackGltfModel(), luceriaAttackGltfClips, hero.attackTime * 1.55 * heroStats(hero).attackSpeed);
}

function luceriaAttackFallbackPulse(hero: Hero) {
  return Math.sin(clamp(hero.attackTime / LUCERIA_ATTACK_FALLBACK_DURATION, 0, 1) * Math.PI);
}

function createLuceriaCrossbladeInstance() {
  const source = loadLuceriaCrossbladeModel();
  if (!source) return null;
  const weapon = cloneSkeleton(source) as THREE.Group;
  weapon.name = "LuceriaCrossblade";
  weapon.scale.multiplyScalar(LUCERIA_CROSSBLADE_SCALE);
  return weapon;
}

function createLuceriaVisibleFallbackBlade() {
  const weapon = new THREE.Group();
  weapon.name = "LuceriaCrossblade";
  const blade = new THREE.Mesh(
    sharedGeometry("luceria-visible-fallback-blade", () => new THREE.BoxGeometry(0.045, 1.05, 0.025)),
    sharedStandardMaterial("luceria-visible-fallback-blade", { color: 0xe8f3ff, roughness: 0.2, metalness: 0.82 })
  );
  blade.position.y = -0.38;
  weapon.add(blade);

  const guard = new THREE.Mesh(
    sharedGeometry("luceria-visible-fallback-guard", () => new THREE.BoxGeometry(0.36, 0.05, 0.06)),
    sharedStandardMaterial("luceria-visible-fallback-guard", { color: 0xd5a85d, roughness: 0.28, metalness: 0.75 })
  );
  guard.position.y = 0.12;
  weapon.add(guard);

  const gem = new THREE.Mesh(
    sharedGeometry("luceria-visible-fallback-gem", () => new THREE.OctahedronGeometry(0.065)),
    sharedStandardMaterial("luceria-visible-fallback-gem", { color: 0x2f8fff, roughness: 0.18, metalness: 0.15, emissive: 0x0b3b7a, emissiveIntensity: 0.55 })
  );
  gem.position.y = 0.12;
  weapon.add(gem);
  return weapon;
}

function crossbladeOffsetForRotation(rotation: THREE.Euler) {
  return luceriaCrossbladeOffset.copy(LUCERIA_CROSSBLADE_GRIP_POINT).applyEuler(rotation).negate();
}

function crossbladeOffsetForQuaternion(rotation: THREE.Quaternion) {
  return luceriaCrossbladeOffset.copy(LUCERIA_CROSSBLADE_GRIP_POINT).applyQuaternion(rotation).negate();
}

function placeLuceriaCrossbladeAtRightHand(gltfModel: THREE.Group, weaponParent: THREE.Group, weapon: THREE.Group, rotation: THREE.Euler, handOffset: THREE.Vector3, followHandRotation: boolean) {
  const rightHand = gltfModel.getObjectByName(LUCERIA_RIGHT_HAND_BONE);
  if (!rightHand) return false;
  weaponParent.updateMatrixWorld(true);
  gltfModel.updateMatrixWorld(true);
  rightHand.updateWorldMatrix(true, false);
  rightHand.getWorldPosition(luceriaHandWorldPosition);
  weaponParent.worldToLocal(luceriaHandWorldPosition);
  weapon.position.copy(luceriaHandWorldPosition);
  weapon.position.add(handOffset);
  if (followHandRotation) {
    rightHand.getWorldQuaternion(luceriaHandWorldQuaternion);
    weaponParent.getWorldQuaternion(luceriaWeaponParentWorldQuaternion).invert();
    weapon.quaternion.copy(luceriaWeaponParentWorldQuaternion).multiply(luceriaHandWorldQuaternion).multiply(luceriaCrossbladeGripQuaternion);
    weapon.position.add(crossbladeOffsetForQuaternion(weapon.quaternion));
  } else {
    weapon.rotation.copy(rotation);
    weapon.position.add(crossbladeOffsetForRotation(rotation));
  }
  return true;
}

function removeLuceriaCrossblade(parent: THREE.Group) {
  for (const child of [...parent.children]) {
    if (child.name === "LuceriaCrossblade") parent.remove(child);
  }
}

function attachLuceriaCrossblade(gltfModel: THREE.Group, weaponParent: THREE.Group, rotation: THREE.Euler, handOffset: THREE.Vector3, followHandRotation: boolean) {
  removeLuceriaCrossblade(weaponParent);
  const crossblade = createLuceriaCrossbladeInstance() ?? createLuceriaVisibleFallbackBlade();
  if (!placeLuceriaCrossbladeAtRightHand(gltfModel, weaponParent, crossblade, rotation, handOffset, followHandRotation)) {
    crossblade.position.set(0.37, 0.37, 0.06);
    crossblade.position.add(handOffset);
    crossblade.position.add(crossbladeOffsetForRotation(rotation));
    crossblade.rotation.copy(rotation);
  }
  weaponParent.add(crossblade);
  return true;
}

function attachLuceriaRunCrossblade(gltfModel: THREE.Group, horizontalMovement: number) {
  const rightHand = gltfModel.getObjectByName(LUCERIA_RIGHT_HAND_BONE);
  if (!rightHand) return false;
  const existing = rightHand.getObjectByName("LuceriaCrossblade");
  if (existing) rightHand.remove(existing);
  const holder = new THREE.Group();
  holder.name = "LuceriaCrossblade";
  holder.rotation.copy(LUCERIA_CROSSBLADE_RUN_EXTRA_ROTATION);
  const crossblade = createLuceriaCrossbladeInstance() ?? createLuceriaVisibleFallbackBlade();
  crossblade.name = "LuceriaCrossbladeMesh";
  crossblade.scale.multiplyScalar(100);
  crossblade.position.copy(LUCERIA_CROSSBLADE_RUN_LOCAL_GRIP_OFFSET);
  if (horizontalMovement > 0) crossblade.position.x += LUCERIA_CROSSBLADE_RUN_SIDE_GRIP_SHIFT;
  if (horizontalMovement < 0) crossblade.position.x += LUCERIA_CROSSBLADE_RUN_LEFT_GRIP_SHIFT;
  crossblade.rotation.copy(LUCERIA_CROSSBLADE_RUN_ROTATION);
  holder.add(crossblade);
  rightHand.add(holder);
  return true;
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
  const skillPulse = hero.skillPose ? Math.sin((1 - clamp(hero.skillTime ?? 0, 0, 0.8) / 0.8) * Math.PI) : 0;
  const attackPulse = basicAttackPulse(hero);
  model.position.y = run.bob;
  model.rotation.z = hero.moving ? Math.sin(run.phase * 2) * 0.035 : -0.045 * attackPulse;
  model.position.z = 0.03 * attackPulse;

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
    if (hero.skillPose === "slash") {
      arm.rotation.x = -0.9 * skillPulse;
      arm.rotation.z = side * (0.18 + 0.5 * skillPulse);
    } else if (hero.skillPose === "shoot") {
      arm.rotation.x = -0.42 * skillPulse;
      arm.rotation.z = side * (0.06 - 0.12 * skillPulse);
      arm.position.z += 0.08 * skillPulse;
    } else if (hero.skillPose === "cast") {
      arm.rotation.x = -0.72 * skillPulse;
      arm.rotation.z = side * (0.42 + 0.26 * skillPulse);
      arm.position.y += 0.12 * skillPulse;
    } else if (hero.skillPose === "guard") {
      arm.rotation.x = -0.25 * skillPulse;
      arm.rotation.z = side * (0.62 * skillPulse);
    } else if (hero.skillPose === "rally") {
      arm.rotation.x = -1.05 * skillPulse;
      arm.rotation.z = side * (0.28 + 0.36 * skillPulse);
      arm.position.y += 0.18 * skillPulse;
    } else if (attackPulse > 0 && hero.weapon === "rifle") {
      arm.rotation.x = side > 0 ? -0.62 * attackPulse : -0.38 * attackPulse;
      arm.rotation.z = side * (0.05 - 0.18 * attackPulse);
      arm.position.z += 0.1 * attackPulse;
    } else if (attackPulse > 0 && (hero.weapon === "staff" || hero.weapon === "scout")) {
      arm.rotation.x = -0.66 * attackPulse;
      arm.rotation.z = side * (0.36 + 0.2 * attackPulse);
      arm.position.y += 0.08 * attackPulse;
    } else if (attackPulse > 0) {
      arm.rotation.x = side > 0 ? -1.08 * attackPulse : -0.26 * attackPulse;
      arm.rotation.z = side > 0 ? -0.5 * attackPulse : -0.06 * attackPulse;
      if (side > 0) arm.position.z += 0.1 * attackPulse;
    }
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
  if (hero.skillPose === "slash") {
    weapon.rotation.z -= 0.75 * skillPulse;
    weapon.position.y += 0.12 * skillPulse;
  } else if (hero.skillPose === "shoot") {
    weapon.rotation.z = -Math.PI / 2;
    weapon.position.set(0.34 + 0.08 * skillPulse, 0.72, 0.13);
  } else if (hero.skillPose === "cast" || hero.skillPose === "rally") {
    weapon.position.y += 0.22 * skillPulse;
    weapon.rotation.z += 0.28 * skillPulse;
  } else if (hero.skillPose === "guard") {
    weapon.rotation.z = -0.18;
    weapon.position.set(0.2, 0.72, 0.14);
  } else if (attackPulse > 0 && hero.weapon === "rifle") {
    weapon.rotation.z = -Math.PI / 2;
    weapon.position.set(0.36 + 0.08 * attackPulse, 0.72, 0.14);
  } else if (attackPulse > 0 && (hero.weapon === "staff" || hero.weapon === "scout")) {
    weapon.rotation.z = 0.18 + 0.42 * attackPulse;
    weapon.position.set(0.26, 0.68 + 0.16 * attackPulse, 0.08);
  } else if (attackPulse > 0) {
    weapon.rotation.z = -0.75 - 0.95 * attackPulse;
    weapon.position.set(0.28 + 0.08 * attackPulse, 0.65 + 0.12 * attackPulse, 0.1);
  }
  model.add(weapon);

  if (hero.skillPose || attackPulse > 0) {
    const glow = new THREE.Mesh(
      sharedGeometry("hero-skill-glow-torus", () => new THREE.TorusGeometry(0.34, 0.018, 8, 36)),
      sharedBasicMaterial(`hero-skill-glow-${hero.trim}`, { color: hero.trim, transparent: true, opacity: 0.56 })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.y = 0.08 + Math.max(skillPulse, attackPulse) * 0.08;
    group.add(glow);
  }

  addHealthBar(group, hero.hp / heroStats(hero).maxHp, 0.92, selected ? 0xffe0a0 : 0xffffff);
  return group;
}

function createLuceriaMesh(hero: Hero, state: GameState, index: number) {
  preloadLuceriaModels();
  const group = new THREE.Group();
  group.position.copy(toWorld(hero, state));
  const model = new THREE.Group();
  model.rotation.y = heroFacingAngle(hero);
  group.add(model);
  const selected = state.selected === index;
  const run = runCycle(hero);
  model.position.y = run.bob;
  model.rotation.z = hero.moving ? Math.sin(run.phase * 2) * 0.028 : 0;
  const attackModel = hero.attacking ? createLuceriaAttackInstance(hero) : null;
  const gltfModel = attackModel ?? (hero.moving ? createLuceriaRunInstance(hero) : createLuceriaIdleInstance(hero)) ?? loadLuceriaGltfModel();
  if (gltfModel) {
    if (hero.attacking && !attackModel) {
      const pulse = luceriaAttackFallbackPulse(hero);
      model.rotation.y += 0.18 * pulse;
      model.rotation.z -= 0.13 * pulse;
      model.position.y += 0.04 * pulse;
    }
    model.add(gltfModel);
    if (hero.moving) {
      removeLuceriaCrossblade(model);
      attachLuceriaRunCrossblade(gltfModel, Number(state.movement.right) - Number(state.movement.left));
    } else {
      attachLuceriaCrossblade(gltfModel, model, LUCERIA_CROSSBLADE_ROTATION, LUCERIA_CROSSBLADE_HAND_OFFSET, false);
    }
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

  const crossblade = createLuceriaCrossbladeInstance();
  if (crossblade) {
    model.add(crossblade);
  } else {
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
  }

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
  const model = new THREE.Group();
  model.rotation.y = enemy.facing;
  group.add(model);
  const isBoss = enemy.type === "boss";
  const isWolf = enemy.type === "wolf";
  const isBoar = enemy.type === "boar";
  const radius = isBoss ? 0.38 : enemy.type === "duelist" ? 0.25 : isBoar ? 0.26 : 0.2;
  const elementColor = new THREE.Color(elementColors[enemy.element]).getHex();
  const wolfModel = isWolf ? createWolfGltfInstance(enemy) : null;
  const boarModel = isBoar ? createBoarGltfInstance(enemy) : null;
  if (wolfModel) {
    model.add(wolfModel);
  }
  if (boarModel) {
    model.add(boarModel);
  }
  const bodyGeometry = isBoss
    ? sharedGeometry(`enemy-boss-${radius}`, () => new THREE.DodecahedronGeometry(radius, 0))
    : isWolf
      ? sharedGeometry("enemy-wolf-body", () => new THREE.BoxGeometry(0.26, 0.24, 0.5))
      : isBoar
        ? sharedGeometry("enemy-boar-body", () => new THREE.SphereGeometry(0.34, 18, 12))
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
  body.position.y = isBoss ? 0.56 : isWolf ? 0.28 : 0.36;
  body.castShadow = true;
  if (!wolfModel && !boarModel) model.add(body);

  if (isWolf && !wolfModel) {
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

  if (isBoar && !boarModel) {
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

  if (isBoss) {
    const crown = new THREE.Mesh(
      sharedGeometry("enemy-boss-crown", () => new THREE.TorusGeometry(0.48, 0.025, 8, 36)),
      sharedBasicMaterial("enemy-boss-crown", { color: 0xffcf6f })
    );
    crown.position.y = 1.08;
    crown.rotation.x = Math.PI / 2;
    model.add(crown);
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

export { createEnemyMesh, createHeroMesh };
