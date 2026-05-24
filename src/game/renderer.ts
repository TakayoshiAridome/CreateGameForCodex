import * as THREE from "three";
import { clamp, type AreaId, type GameState, type Point } from "./core";
import { areaBaseCenter, cameraCenterForState, toWorld, WORLD_SCALE } from "./rendererCamera";
import { rebuildField } from "./rendererTerrain";
import { createEnemyMesh, createHeroMesh } from "./rendererUnits";
import { clearGroup, createTextSprite, disposeThreeView, sharedBasicMaterial, sharedGeometry, type ThreeView } from "./rendererShared";
import type { Particle } from "./types";

const CAMERA_RADIUS = 15.3;

function createSkillEffect(particle: Particle, state: GameState) {
  const kind = particle.kind ?? "text";
  if (kind === "text") return null;
  const group = new THREE.Group();
  const lifeRatio = clamp(particle.maxLife ? particle.life / particle.maxLife : particle.life, 0, 1);
  const radius = (particle.radius ?? 90) / WORLD_SCALE;
  const color = new THREE.Color(particle.color).getHex();
  const material = sharedBasicMaterial(`skill-effect-${kind}-${particle.color}`, { color, transparent: true, opacity: 0.56, side: THREE.DoubleSide });

  if (kind === "ring" || kind === "aura") {
    const ring = new THREE.Mesh(sharedGeometry(`skill-${kind}-torus`, () => new THREE.TorusGeometry(1, kind === "aura" ? 0.035 : 0.022, 8, 52)), material);
    ring.scale.setScalar(radius * (1.1 - lifeRatio * 0.25));
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    if (kind === "aura") {
      const disc = new THREE.Mesh(sharedGeometry("skill-aura-disc", () => new THREE.CircleGeometry(1, 42)), material);
      disc.scale.setScalar(radius * 0.72);
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.018;
      group.add(disc);
    }
    group.position.copy(toWorld(particle, state));
    group.position.y = 0.08 + (1 - lifeRatio) * 0.28;
    return group;
  }

  if (kind === "burst") {
    const burst = new THREE.Mesh(sharedGeometry("skill-burst-sphere", () => new THREE.SphereGeometry(1, 18, 10)), material);
    burst.scale.setScalar(radius * (1.15 - lifeRatio * 0.55));
    group.add(burst);
    group.position.copy(toWorld(particle, state));
    group.position.y = 0.45;
    return group;
  }

  if (kind === "slash") {
    const slash = new THREE.Mesh(sharedGeometry("skill-slash-plane", () => new THREE.PlaneGeometry(1, 0.16)), material);
    slash.scale.set(radius * 1.45, 1, 1);
    slash.rotation.set(-0.28, particle.angle ?? 0, 0.42);
    group.add(slash);
    group.position.copy(toWorld(particle, state));
    group.position.y = 0.82;
    return group;
  }

  if (kind === "beam" && particle.x2 !== undefined && particle.y2 !== undefined) {
    const from = toWorld(particle, state);
    const to = toWorld({ x: particle.x2, y: particle.y2 }, state);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const beam = new THREE.Mesh(sharedGeometry("skill-beam-box", () => new THREE.BoxGeometry(1, 0.035, 0.035)), material);
    beam.scale.x = Math.max(0.2, length);
    beam.rotation.y = -Math.atan2(dz, dx);
    group.add(beam);
    group.position.set((from.x + to.x) / 2, 0.64, (from.z + to.z) / 2);
    return group;
  }

  return null;
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
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.00018;
  const sunShadowCamera = sun.shadow.camera;
  sunShadowCamera.near = 0.5;
  sunShadowCamera.far = 42;
  const sunTarget = new THREE.Object3D();
  sunTarget.position.set(0, 0, 0);
  sun.target = sunTarget;
  scene.add(sun);
  scene.add(sunTarget);

  return { renderer, scene, camera, sun, sunTarget, field, units, effects };
}

function updateShadowCamera(view: ThreeView, state: GameState) {
  const halfW = state.view.w / WORLD_SCALE / 2 / Math.max(view.camera.zoom, 0.001);
  const halfH = state.view.h / WORLD_SCALE / 2 / Math.max(view.camera.zoom, 0.001);
  const radius = Math.max(CAMERA_RADIUS + 8, Math.hypot(halfW, halfH) + 8);
  const shadowCamera = view.sun.shadow.camera;
  shadowCamera.left = -radius;
  shadowCamera.right = radius;
  shadowCamera.top = radius;
  shadowCamera.bottom = -radius;
  shadowCamera.near = 0.5;
  shadowCamera.far = 42;
  shadowCamera.updateProjectionMatrix();
  view.sunTarget.position.set(0, 0, 0);
  view.sunTarget.updateMatrixWorld();
  view.sun.updateMatrixWorld();
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
  updateShadowCamera(view, state);
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
    const effect = createSkillEffect(p, state);
    if (effect) view.effects.add(effect);
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
    updateShadowCamera(this.view, this.state);
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
