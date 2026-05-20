import * as THREE from "three";

export type ThreeView = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  field: THREE.Group;
  units: THREE.Group;
  effects: THREE.Group;
};

export const sharedTextureKeys = [
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

export function sharedGeometry<T extends THREE.BufferGeometry>(key: string, create: () => T): T {
  const cached = geometryCache.get(key) as T | undefined;
  if (cached) return cached;
  const geometry = create();
  geometry.userData.shared = true;
  geometryCache.set(key, geometry);
  return geometry;
}

export function colorKey(color: THREE.ColorRepresentation) {
  return new THREE.Color(color).getHexString();
}

export function sharedStandardMaterial(key: string, options: THREE.MeshStandardMaterialParameters) {
  const cacheKey =
    "standard:" +
    key +
    ":" +
    colorKey(options.color ?? 0xffffff) +
    ":" +
    (options.roughness ?? "") +
    ":" +
    (options.metalness ?? "") +
    ":" +
    (options.emissive ? colorKey(options.emissive) : "") +
    ":" +
    (options.emissiveIntensity ?? "");
  const cached = materialCache.get(cacheKey) as THREE.MeshStandardMaterial | undefined;
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial(options);
  material.userData.shared = true;
  materialCache.set(cacheKey, material);
  return material;
}

export function sharedBasicMaterial(key: string, options: THREE.MeshBasicMaterialParameters) {
  const cacheKey =
    "basic:" +
    key +
    ":" +
    colorKey(options.color ?? 0xffffff) +
    ":" +
    (options.transparent ?? "") +
    ":" +
    (options.opacity ?? "") +
    ":" +
    (options.alphaTest ?? "") +
    ":" +
    (options.side ?? "");
  const cached = materialCache.get(cacheKey) as THREE.MeshBasicMaterial | undefined;
  if (cached) return cached;
  const material = new THREE.MeshBasicMaterial(options);
  material.userData.shared = true;
  materialCache.set(cacheKey, material);
  return material;
}

export function createTextSprite(text: string, color: string, opacity: number) {
  const cacheKey = text + ":" + color;
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

export function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    disposeObject(child);
    group.remove(child);
  }
}

export function disposeThreeView(view: ThreeView) {
  clearGroup(view.field);
  clearGroup(view.units);
  clearGroup(view.effects);
  view.renderer.dispose();
}
