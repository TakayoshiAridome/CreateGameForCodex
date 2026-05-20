import * as THREE from "three";
import { clamp, type AreaId, type GameState, type Point } from "./core";
import { areaBaseCenter, cameraCenterForState, toWorld, WORLD_SCALE } from "./rendererCamera";
import { rebuildField } from "./rendererTerrain";
import { createEnemyMesh, createHeroMesh } from "./rendererUnits";
import { clearGroup, createTextSprite, disposeThreeView, sharedBasicMaterial, sharedGeometry, type ThreeView } from "./rendererShared";

const CAMERA_RADIUS = 15.3;

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

function renderGame(view: ThreeView, state: GameState) {
  clearGroup(view.units);
  clearGroup(view.effects);
  const cameraCenter = cameraCenterForState(state);
  const baseCenter = areaBaseCenter(state);
  view.field.position.set(
    (baseCenter.x - cameraCenter.x) / WORLD_SCALE,
    0,
    (baseCenter.y - cameraCenter.y) / WORLD_SCALE
  );

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

  screenToGamePoint(point: Point) {
    const center = cameraCenterForState(this.state);
    return {
      x: point.x + center.x - this.state.view.w / 2,
      y: point.y + center.y - this.state.view.h / 2
    };
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
