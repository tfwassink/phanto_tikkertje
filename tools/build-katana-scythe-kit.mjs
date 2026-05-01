import fs from "node:fs/promises";
import * as THREE from "/tmp/printprep/node_modules/three/build/three.module.js";
import { GLTFLoader } from "/tmp/printprep/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { STLExporter } from "/tmp/printprep/node_modules/three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "/tmp/printprep/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "/tmp/printprep/node_modules/three-bvh-csg/build/index.module.js";

const outputDir = "assets/print";
const katanaInput = `${outputDir}/katana-sword.glb`;
const scytheInput = `${outputDir}/scifi-scythe.glb`;

const katanaTargetLongestMm = 220;
const scytheTargetLongestMm = 220;
const rodRadiusMm = 3.8;
const katanaHoleRadiusMm = 4.2;
const scytheSocketInnerRadiusMm = 4.25;
const scytheSocketOuterRadiusMm = 6.8;
const scytheSocketLengthMm = 34;
const rodLengthMm = 280;

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function loadGLB(path) {
  const fileBuffer = await fs.readFile(path);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(toArrayBuffer(fileBuffer), "", resolve, reject);
  });
}

function setGrayMaterial(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    child.material = materials.map((material) => {
      const clone = material.clone();
      if ("color" in clone) {
        clone.color = new THREE.Color("#8e9198");
      }
      if ("emissive" in clone && clone.emissive) {
        clone.emissive = new THREE.Color("#101114");
        clone.emissiveIntensity = 0;
      }
      if ("metalness" in clone) {
        clone.metalness = Math.max(clone.metalness || 0, 0.25);
      }
      if ("roughness" in clone) {
        clone.roughness = 0.5;
      }
      return clone;
    });
  });
}

function scaleRootToLongest(root, targetLongestMm) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const scale = targetLongestMm / longest;
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
}

function groundAndCenter(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  root.updateMatrixWorld(true);
}

function mergedMeshFromRoot(root, predicate = () => true, material = null) {
  root.updateMatrixWorld(true);
  const geometries = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.geometry || !predicate(child)) {
      return;
    }
    const geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometries.push(geometry.toNonIndexed());
  });

  if (!geometries.length) {
    throw new Error("No mesh geometries matched the predicate.");
  }

  const merged = mergeGeometries(geometries, false);
  merged.computeVertexNormals();
  const mesh = new THREE.Mesh(
    merged,
    material || new THREE.MeshStandardMaterial({ color: "#b7bcc4", roughness: 0.5, metalness: 0.2 })
  );
  mesh.updateMatrixWorld(true);
  return mesh;
}

function cylinderBetweenPoints(start, end, radius, radialSegments = 32) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments),
    new THREE.MeshStandardMaterial({ color: "#888888" })
  );
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.updateMatrixWorld(true);
  return mesh;
}

async function writeSTL(path, object3d) {
  object3d.updateMatrixWorld(true);
  const exporter = new STLExporter();
  const stl = exporter.parse(object3d, { binary: false });
  await fs.writeFile(path, stl, "utf8");
}

function createSocketSleeve(innerRadius, outerRadius, length) {
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(outerRadius, outerRadius, length, 32));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(innerRadius, innerRadius, length + 2, 32));
  inner.updateMatrixWorld(true);
  outer.updateMatrixWorld(true);
  const evaluator = new Evaluator();
  const outerBrush = new Brush(outer.geometry.clone());
  const innerBrush = new Brush(inner.geometry.clone());
  const ring = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
  const mesh = new THREE.Mesh(ring.geometry, new THREE.MeshStandardMaterial({ color: "#8e9198" }));
  mesh.updateMatrixWorld(true);
  return mesh;
}

function buildRod(radius, length) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 32),
    new THREE.MeshStandardMaterial({ color: "#8a8f97" })
  );
  rod.position.y = length * 0.5;
  rod.updateMatrixWorld(true);
  return rod;
}

const katanaGltf = await loadGLB(katanaInput);
const katanaRoot = katanaGltf.scene || katanaGltf.scenes?.[0];
scaleRootToLongest(katanaRoot, katanaTargetLongestMm);
groundAndCenter(katanaRoot);

const katanaMesh = mergedMeshFromRoot(katanaRoot);
const katanaBounds = new THREE.Box3().setFromObject(katanaMesh);
const katanaMin = katanaBounds.min.clone();
const katanaMax = katanaBounds.max.clone();
const katanaCenter = katanaBounds.getCenter(new THREE.Vector3());

const katanaHandlePoint = new THREE.Vector3(katanaCenter.x, katanaMin.y + 8, katanaMax.z - 8);
const katanaTipPoint = new THREE.Vector3(katanaCenter.x, katanaMax.y - 18, katanaMin.z + 22);
const katanaHole = cylinderBetweenPoints(katanaHandlePoint, katanaTipPoint, katanaHoleRadiusMm);

const katanaEvaluator = new Evaluator();
const katanaBrush = new Brush(katanaMesh.geometry.clone());
const holeBrush = new Brush(katanaHole.geometry.clone().applyMatrix4(katanaHole.matrixWorld));
const katanaSocketResult = katanaEvaluator.evaluate(katanaBrush, holeBrush, SUBTRACTION);
const katanaSocketMesh = new THREE.Mesh(
  katanaSocketResult.geometry,
  new THREE.MeshStandardMaterial({ color: "#aeb5bd" })
);
katanaSocketMesh.updateMatrixWorld(true);

await writeSTL(`${outputDir}/katana-sword-socket-220mm.stl`, katanaSocketMesh);

const scytheGltf = await loadGLB(scytheInput);
const scytheRoot = scytheGltf.scene || scytheGltf.scenes?.[0];
setGrayMaterial(scytheRoot);
scaleRootToLongest(scytheRoot, scytheTargetLongestMm);
groundAndCenter(scytheRoot);

const scytheBounds = new THREE.Box3().setFromObject(scytheRoot);
const scytheSize = scytheBounds.getSize(new THREE.Vector3());
const cutoffY = scytheBounds.min.y + scytheSize.y * 0.62;

const scytheHeadMesh = mergedMeshFromRoot(
  scytheRoot,
  (child) => new THREE.Box3().setFromObject(child).getCenter(new THREE.Vector3()).y >= cutoffY
);

const scytheHeadBounds = new THREE.Box3().setFromObject(scytheHeadMesh);
const scytheHeadCenter = scytheHeadBounds.getCenter(new THREE.Vector3());
const scytheSocket = createSocketSleeve(scytheSocketInnerRadiusMm, scytheSocketOuterRadiusMm, scytheSocketLengthMm);
scytheSocket.rotation.z = Math.PI * 0.5;
scytheSocket.position.set(
  scytheHeadBounds.min.x + 6,
  scytheHeadBounds.min.y + 12,
  scytheHeadCenter.z
);
scytheSocket.updateMatrixWorld(true);

const scytheHeadGroup = new THREE.Group();
scytheHeadGroup.add(scytheHeadMesh);
scytheHeadGroup.add(scytheSocket);
scytheHeadGroup.updateMatrixWorld(true);

await writeSTL(`${outputDir}/scifi-scythe-head-socket.stl`, scytheHeadGroup);

const rod = buildRod(rodRadiusMm, rodLengthMm);
await writeSTL(`${outputDir}/scythe-katana-connector-rod.stl`, rod);

console.log("Built printable kit:");
console.log("- katana-sword-socket-220mm.stl");
console.log("- scifi-scythe-head-socket.stl");
console.log("- scythe-katana-connector-rod.stl");
