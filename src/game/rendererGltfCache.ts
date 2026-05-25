import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

THREE.Cache.enabled = true;

const gameGltfAssets = [
  "/assets/spiritTreeForest01.glb",
  "/assets/grass01.glb",
  "/assets/grass02.glb",
  "/assets/grass03.glb",
  "/assets/grass04.glb",
  "/assets/luceria_swordsaint_apoze.glb",
  "/assets/luceria_swordsaint_idle.glb",
  "/assets/luceria_swordsaint_run.glb",
  "/assets/luceria_swordsaint_attack.glb",
  "/assets/luceria_crossblade.glb",
  "/assets/cordels_idle_02.glb",
  "/assets/cordels_combat_stance.glb",
  "/assets/cordels_run.glb",
  "/assets/cordels_attack.glb",
  "/assets/wolf.glb",
  "/assets/boar.glb",
  "/assets/bear.glb"
] as const;

const gltfLoader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF>>();
const gltfStatus = new Map<string, "pending" | "loaded" | "failed">();

function loadCachedGltf(url: string) {
  const cached = gltfCache.get(url);
  if (cached) return cached;

  gltfStatus.set(url, "pending");
  const load = new Promise<GLTF>((resolve, reject) => {
    gltfLoader.load(url, resolve, undefined, reject);
  })
    .then((gltf) => {
      gltfStatus.set(url, "loaded");
      return gltf;
    })
    .catch((error) => {
      gltfStatus.set(url, "failed");
      gltfCache.delete(url);
      throw error;
    });
  gltfCache.set(url, load);
  return load;
}

function getGltfCacheSnapshot() {
  const total = gameGltfAssets.length;
  const loaded = gameGltfAssets.filter((url) => gltfStatus.get(url) === "loaded").length;
  const failed = gameGltfAssets.filter((url) => gltfStatus.get(url) === "failed").length;
  const pending = gameGltfAssets.filter((url) => gltfStatus.get(url) === "pending").length;
  return { total, loaded, failed, pending, ready: loaded + failed >= total };
}

async function preloadGameGltfAssets() {
  await Promise.allSettled(gameGltfAssets.map((url) => loadCachedGltf(url)));
  return getGltfCacheSnapshot();
}

export { getGltfCacheSnapshot, loadCachedGltf, preloadGameGltfAssets };
