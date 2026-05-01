import fs from "node:fs/promises";
import * as THREE from "/tmp/printprep/node_modules/three/build/three.module.js";
import { GLTFLoader } from "/tmp/printprep/node_modules/three/examples/jsm/loaders/GLTFLoader.js";
import { STLExporter } from "/tmp/printprep/node_modules/three/examples/jsm/exporters/STLExporter.js";

const [inputPath, outputPath, targetLongestMmRaw] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error("Usage: node tools/export-printable-katana.mjs <input.glb> <output.stl> [target-longest-mm]");
  process.exit(1);
}

function getArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

const fileBuffer = await fs.readFile(inputPath);
const loader = new GLTFLoader();

const gltf = await new Promise((resolve, reject) => {
  loader.parse(getArrayBuffer(fileBuffer), "", resolve, reject);
});

const root = gltf.scene || gltf.scenes?.[0];
if (!root) {
  throw new Error("No scene found in GLB file.");
}

root.updateMatrixWorld(true);
const originalBounds = new THREE.Box3().setFromObject(root);
const size = originalBounds.getSize(new THREE.Vector3());
const longestSide = Math.max(size.x, size.y, size.z);

if (targetLongestMmRaw) {
  const targetLongestMm = Number(targetLongestMmRaw);
  if (!Number.isFinite(targetLongestMm) || targetLongestMm <= 0) {
    throw new Error("target-longest-mm must be a positive number.");
  }
  const scaleFactor = targetLongestMm / longestSide;
  root.scale.multiplyScalar(scaleFactor);
  root.updateMatrixWorld(true);
}

const centeredBounds = new THREE.Box3().setFromObject(root);
const centeredSize = centeredBounds.getSize(new THREE.Vector3());
const center = centeredBounds.getCenter(new THREE.Vector3());

root.position.sub(new THREE.Vector3(center.x, centeredBounds.min.y, center.z));
root.updateMatrixWorld(true);

root.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = false;
    child.receiveShadow = false;
  }
});

const exporter = new STLExporter();
const stl = exporter.parse(root, { binary: false });
await fs.writeFile(outputPath, stl, "utf8");

const finalBounds = new THREE.Box3().setFromObject(root);
const finalSize = finalBounds.getSize(new THREE.Vector3());

console.log(`STL written to ${outputPath}`);
console.log(`Original size: ${size.x.toFixed(3)} x ${size.y.toFixed(3)} x ${size.z.toFixed(3)}`);
console.log(`Scaled size before centering: ${centeredSize.x.toFixed(3)} x ${centeredSize.y.toFixed(3)} x ${centeredSize.z.toFixed(3)}`);
console.log(`Final size: ${finalSize.x.toFixed(3)} x ${finalSize.y.toFixed(3)} x ${finalSize.z.toFixed(3)}`);
