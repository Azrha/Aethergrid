import fs from "node:fs/promises";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      if (this.onloadend) this.onloadend();
    });
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((buffer) => {
      const base64 = Buffer.from(buffer).toString("base64");
      this.result = `data:${blob.type};base64,${base64}`;
      if (this.onloadend) this.onloadend();
    });
  }
}

if (!globalThis.FileReader) {
  globalThis.FileReader = NodeFileReader;
}

const OUT_DIR = path.resolve("public/assets/models/generated");

const exportGLB = async (name, object) => {
  const exporter = new GLTFExporter();
  const scene = new THREE.Scene();
  scene.add(object);
  const arrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => resolve(result),
      (error) => reject(error),
      { binary: true }
    );
  });
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(path.join(OUT_DIR, `${name}.glb`), Buffer.from(arrayBuffer));
};

const material = (color, roughness = 0.6, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const makeTree = () => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 10), material("#5a3a2a"));
  trunk.position.y = 1.1;
  group.add(trunk);

  const canopy = material("#3f8b4a", 0.7, 0.0);
  const crownA = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), canopy);
  crownA.position.set(0.0, 2.4, 0.1);
  group.add(crownA);
  const crownB = new THREE.Mesh(new THREE.SphereGeometry(0.7, 18, 14), canopy);
  crownB.position.set(0.7, 2.1, -0.3);
  group.add(crownB);
  const crownC = new THREE.Mesh(new THREE.SphereGeometry(0.65, 18, 14), canopy);
  crownC.position.set(-0.6, 2.0, 0.4);
  group.add(crownC);
  const branchMat = material("#6a4b2f", 0.8, 0.0);
  const branchA = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.1, 8), branchMat);
  branchA.position.set(0.5, 1.6, 0.2);
  branchA.rotation.z = Math.PI / 4;
  group.add(branchA);
  const branchB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.9, 8), branchMat);
  branchB.position.set(-0.5, 1.5, -0.2);
  branchB.rotation.z = -Math.PI / 4;
  group.add(branchB);
  return group;
};

const makeCycad = () => {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 10), material("#6b4a2f"));
  trunk.position.y = 0.8;
  group.add(trunk);
  const leafMat = material("#4f7f3d", 0.7, 0.0);
  for (let i = 0; i < 10; i += 1) {
    const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.08, 1.3, 6), leafMat);
    const angle = (i / 10) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.1, 1.3, Math.sin(angle) * 0.1);
    leaf.rotation.z = Math.PI / 2.4;
    leaf.rotation.y = angle;
    group.add(leaf);
  }
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), material("#7b5a3b", 0.8, 0.0));
  bulb.position.set(0, 0.2, 0);
  group.add(bulb);
  return group;
};

const makeHabitat = () => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 1.6), material("#9b8b7f", 0.7, 0.05));
  base.position.y = 0.8;
  group.add(base);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.9, 4), material("#c7a07a", 0.5, 0.1));
  roof.position.y = 1.85;
  roof.rotation.y = Math.PI * 0.25;
  group.add(roof);
  const windowMat = new THREE.MeshStandardMaterial({ color: "#f6dba3", emissive: "#f6dba3", emissiveIntensity: 0.6 });
  const windowA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), windowMat);
  windowA.position.set(0.5, 0.9, 0.82);
  group.add(windowA);
  const windowB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), windowMat);
  windowB.position.set(-0.4, 0.9, -0.82);
  group.add(windowB);
  const porch = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 0.8), material("#7e6f63", 0.8, 0.1));
  porch.position.set(0, 0.1, 1.0);
  group.add(porch);
  return group;
};

const makeObelisk = () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.7), material("#b7a6d8", 0.35, 0.2));
  body.position.y = 1.3;
  group.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.8), material("#d2c0ff", 0.2, 0.3));
  cap.position.y = 2.65;
  group.add(cap);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.25, 1),
    material("#caa6ff", 0.1, 0.6)
  );
  gem.position.y = 2.2;
  group.add(gem);
  return group;
};

const makeAlien = () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 6, 12), material("#6fd8ff", 0.4, 0.1));
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), material("#a8e8ff", 0.4, 0.1));
  head.position.set(0, 1.8, 0.0);
  group.add(head);
  const crest = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 10, 20), material("#c9b7ff", 0.3, 0.2));
  crest.position.y = 1.5;
  crest.rotation.x = Math.PI / 2;
  group.add(crest);
  const armGeom = new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8);
  const armMat = material("#79c9ff", 0.5, 0.1);
  const armL = new THREE.Mesh(armGeom, armMat);
  armL.position.set(-0.45, 1.2, 0.1);
  armL.rotation.z = Math.PI / 3;
  group.add(armL);
  const armR = new THREE.Mesh(armGeom, armMat);
  armR.position.set(0.45, 1.2, 0.1);
  armR.rotation.z = -Math.PI / 3;
  group.add(armR);
  return group;
};

const makeDino = () => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.8, 6, 12), material("#6fa86a", 0.6, 0.05));
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.75;
  group.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.8, 8), material("#7dbc74", 0.6, 0.05));
  neck.position.set(0, 1.0, 1.2);
  neck.rotation.x = Math.PI / 6;
  group.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), material("#9acf84", 0.6, 0.05));
  head.position.set(0, 1.35, 1.55);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 12), material("#6fa86a", 0.6, 0.05));
  tail.position.set(0, 0.6, -1.6);
  tail.rotation.x = -Math.PI / 2;
  group.add(tail);
  const plateMat = material("#5f8f5a", 0.7, 0.05);
  for (let i = 0; i < 5; i += 1) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), plateMat);
    plate.position.set(0, 1.0 + i * 0.15, -0.6 + i * 0.35);
    group.add(plate);
  }
  const legGeom = new THREE.CylinderGeometry(0.12, 0.2, 0.9, 8);
  const legMat = material("#5b7f52", 0.7, 0.05);
  [
    [-0.45, 0.35, 0.6],
    [0.45, 0.35, 0.6],
    [-0.5, 0.35, -0.3],
    [0.5, 0.35, -0.3],
  ].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(x, y, z);
    group.add(leg);
  });
  return group;
};

const main = async () => {
  await exportGLB("tree", makeTree());
  await exportGLB("cycad", makeCycad());
  await exportGLB("habitat", makeHabitat());
  await exportGLB("obelisk", makeObelisk());
  await exportGLB("alien", makeAlien());
  await exportGLB("dino", makeDino());
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
