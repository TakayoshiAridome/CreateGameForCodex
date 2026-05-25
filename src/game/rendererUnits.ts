import * as THREE from "three";
import { clamp, heroStats, type GameState, type Hero } from "./core";
import { toWorld } from "./rendererCamera";
import { createCordelsMesh } from "./rendererCordels";
import { addHealthBar } from "./rendererHealth";
import { createLuceriaMesh } from "./rendererLuceria";
import { sharedBasicMaterial, sharedGeometry, sharedStandardMaterial } from "./rendererShared";

const BASIC_ATTACK_VISUAL_DURATION = 0.55;
const MIN_BASIC_ATTACK_VISUAL_DURATION = 0.28;
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

function createHeroMesh(hero: Hero, state: GameState, index: number) {
  if (hero.name === "ルシェリア") return createLuceriaMesh(hero, state, index);
  if (hero.name === "コーデルス") {
    const cordelsModel = createCordelsMesh(hero, state, index);
    if (cordelsModel) return cordelsModel;
  }

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

export { createHeroMesh };
