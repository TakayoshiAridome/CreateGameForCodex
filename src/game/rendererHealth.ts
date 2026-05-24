import * as THREE from "three";
import { clamp } from "./core";
import { sharedBasicMaterial, sharedGeometry } from "./rendererShared";

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

export { addHealthBar };
