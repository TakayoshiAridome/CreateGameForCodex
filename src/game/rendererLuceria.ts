import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { HERO_GLB_RUN_ANIMATION_TIME_SCALE, basicAttackMotionDuration, clamp, heroStats, type GameState, type Hero } from "./core";
import { toWorld } from "./rendererCamera";
import { loadCachedGltf } from "./rendererGltfCache";
import { addHealthBar } from "./rendererHealth";
import { sharedGeometry, sharedStandardMaterial, sharedTextureKeys } from "./rendererShared";

type LuceriaAnimationKind = "idle" | "run" | "attack";
type LuceriaAnimationInstance = {
  model: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  clip: THREE.AnimationClip | null;
  baseY: number;
};

const LUCERIA_MODEL_URL = "/assets/luceria_swordsaint_apoze.glb";
const LUCERIA_IDLE_MODEL_URL = "/assets/luceria_swordsaint_idle.glb";
const LUCERIA_RUN_MODEL_URL = "/assets/luceria_swordsaint_run.glb";
const LUCERIA_ATTACK_MODEL_URL = "/assets/luceria_swordsaint_attack.glb";
const LUCERIA_CROSSBLADE_MODEL_URL = "/assets/luceria_crossblade.glb";
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

function loadLuceriaGltfModel() {
  if (luceriaGltfModel || luceriaGltfLoading || luceriaGltfFailed) return luceriaGltfModel;
  luceriaGltfLoading = true;
  loadCachedGltf(LUCERIA_MODEL_URL)
    .then((gltf) => {
      luceriaGltfModel = gltf.scene;
      normalizeLuceriaModel(luceriaGltfModel);
      markSharedObject(luceriaGltfModel);
      luceriaGltfLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Luceria GLB model.", error);
      luceriaGltfFailed = true;
      luceriaGltfLoading = false;
    });
  return luceriaGltfModel;
}

function loadLuceriaIdleGltfModel() {
  if (luceriaIdleGltfModel || luceriaIdleGltfLoading || luceriaIdleGltfFailed) return luceriaIdleGltfModel;
  luceriaIdleGltfLoading = true;
  loadCachedGltf(LUCERIA_IDLE_MODEL_URL)
    .then((gltf) => {
      luceriaIdleGltfModel = gltf.scene;
      luceriaIdleGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaIdleGltfModel);
      markSharedObject(luceriaIdleGltfModel);
      luceriaIdleGltfLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Luceria idle GLB model.", error);
      luceriaIdleGltfFailed = true;
      luceriaIdleGltfLoading = false;
    });
  return luceriaIdleGltfModel;
}

function loadLuceriaRunGltfModel() {
  if (luceriaRunGltfModel || luceriaRunGltfLoading || luceriaRunGltfFailed) return luceriaRunGltfModel;
  luceriaRunGltfLoading = true;
  loadCachedGltf(LUCERIA_RUN_MODEL_URL)
    .then((gltf) => {
      luceriaRunGltfModel = gltf.scene;
      luceriaRunGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaRunGltfModel);
      applyLuceriaRunFallbackMaterial(luceriaRunGltfModel);
      markSharedObject(luceriaRunGltfModel);
      luceriaRunGltfLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Luceria run GLB model.", error);
      luceriaRunGltfFailed = true;
      luceriaRunGltfLoading = false;
    });
  return luceriaRunGltfModel;
}

function loadLuceriaAttackGltfModel() {
  if (luceriaAttackGltfModel || luceriaAttackGltfLoading || luceriaAttackGltfFailed) return luceriaAttackGltfModel;
  luceriaAttackGltfLoading = true;
  loadCachedGltf(LUCERIA_ATTACK_MODEL_URL)
    .then((gltf) => {
      luceriaAttackGltfModel = gltf.scene;
      luceriaAttackGltfClips = gltf.animations;
      normalizeLuceriaModel(luceriaAttackGltfModel);
      markSharedObject(luceriaAttackGltfModel);
      luceriaAttackGltfLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Luceria attack GLB model.", error);
      luceriaAttackGltfFailed = true;
      luceriaAttackGltfLoading = false;
    });
  return luceriaAttackGltfModel;
}

function loadLuceriaCrossbladeModel() {
  if (luceriaCrossbladeModel || luceriaCrossbladeLoading || luceriaCrossbladeFailed) return luceriaCrossbladeModel;
  luceriaCrossbladeLoading = true;
  loadCachedGltf(LUCERIA_CROSSBLADE_MODEL_URL)
    .then((gltf) => {
      luceriaCrossbladeModel = gltf.scene;
      normalizeLuceriaCrossblade(luceriaCrossbladeModel);
      markSharedObject(luceriaCrossbladeModel);
      luceriaCrossbladeLoading = false;
    })
    .catch((error) => {
      console.warn("Failed to load Luceria Crossblade GLB model.", error);
      luceriaCrossbladeFailed = true;
      luceriaCrossbladeLoading = false;
    });
  return luceriaCrossbladeModel;
}

function preloadLuceriaModels() {
  loadLuceriaGltfModel();
  loadLuceriaIdleGltfModel();
  loadLuceriaRunGltfModel();
  loadLuceriaAttackGltfModel();
  loadLuceriaCrossbladeModel();
}

function createLuceriaAnimatedInstance(kind: LuceriaAnimationKind, source: THREE.Group | null, clips: THREE.AnimationClip[], time: number, verticalOffset = 0, loop = true) {
  if (!source) return null;
  const clip = clips[0] ?? null;
  let instance = luceriaAnimationInstances[kind];
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
    luceriaAnimationInstances[kind] = instance;
  }
  instance.model.position.y = instance.baseY + verticalOffset;
  if (instance.mixer && instance.clip && instance.clip.duration > 0) {
    instance.mixer.setTime(loop ? time % instance.clip.duration : clamp(time, 0, instance.clip.duration));
  }
  return instance.model;
}

function createLuceriaIdleInstance(hero: Hero) {
  const idleTime = hero.hp > 0 ? performance.now() * 0.001 : 0;
  return createLuceriaAnimatedInstance("idle", loadLuceriaIdleGltfModel(), luceriaIdleGltfClips, idleTime);
}

function createLuceriaRunInstance(hero: Hero) {
  return createLuceriaAnimatedInstance(
    "run",
    loadLuceriaRunGltfModel(),
    luceriaRunGltfClips,
    hero.runTime * HERO_GLB_RUN_ANIMATION_TIME_SCALE,
    LUCERIA_RUN_VERTICAL_OFFSET
  );
}

function createLuceriaAttackInstance(hero: Hero) {
  const clipDuration = luceriaAttackGltfClips[0]?.duration ?? 0;
  const attackProgress = clamp(hero.attackTime / basicAttackMotionDuration(hero), 0, 1);
  return createLuceriaAnimatedInstance("attack", loadLuceriaAttackGltfModel(), luceriaAttackGltfClips, clipDuration * attackProgress, 0, false);
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

export { createLuceriaMesh };
