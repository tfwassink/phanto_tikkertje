import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "./vendor/three/GLTFLoader.js";
import { clone as cloneSkinned } from "./vendor/three/SkeletonUtils.js";

const canvas = document.getElementById("game");
const restartButton = document.getElementById("restartButton");
const roleButton = document.getElementById("roleButton");
const menuButton = document.getElementById("menuButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const modelViewerButton = document.getElementById("modelViewerButton");
const startMapButton = document.getElementById("startMapButton");
const exploreMapButton = document.getElementById("exploreMapButton");
const closeViewerButton = document.getElementById("closeViewerButton");
const tutorialButton = document.getElementById("tutorialButton");
const menuOverlay = document.getElementById("menuOverlay");
const menuCard = document.getElementById("menuCard");
const modelViewerPanel = document.getElementById("modelViewerPanel");
const menuHint = document.getElementById("menuHint");
const summaryOverlay = document.getElementById("summaryOverlay");
const summaryTitle = document.getElementById("summaryTitle");
const summaryText = document.getElementById("summaryText");
const summaryStats = document.getElementById("summaryStats");
const playAgainButton = document.getElementById("playAgainButton");
const summaryMenuButton = document.getElementById("summaryMenuButton");
const colorWheelOverlay = document.getElementById("colorWheelOverlay");
const colorWheel = document.getElementById("colorWheel");
const colorWheelHint = document.getElementById("colorWheelHint");
const mapButtons = [...document.querySelectorAll(".map-card")];
const modelPreviewButtons = [...document.querySelectorAll(".viewer-chip")];
const hudTitle = document.getElementById("hudTitle");
const hudMap = document.getElementById("hudMap");
const hudRole = document.getElementById("hudRole");
const hudPlayers = document.getElementById("hudPlayers");
const hudPuzzles = document.getElementById("hudPuzzles");
const hudMessage = document.getElementById("hudMessage");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#efe4c7");
scene.fog = new THREE.Fog("#efe4c7", 65, 180);

const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 400);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const keys = new Set();
const tmpVec = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const gltfLoader = new GLTFLoader();

const worldRoot = new THREE.Group();
const gameplayRoot = new THREE.Group();
const viewerRoot = new THREE.Group();
const viewerLightRig = new THREE.Group();
const mapPreviewRoot = new THREE.Group();
scene.add(worldRoot);
scene.add(gameplayRoot);
scene.add(viewerRoot);
scene.add(viewerLightRig);
scene.add(mapPreviewRoot);

const world = {
  width: 184,
  depth: 132,
};

const SEEKER_VIEW_DISTANCE = 32;
const DISGUISE_STILL_SPEED = 0.02;
const JUMP_SPEED = 10.5;
const GRAVITY = 28;
const COLOR_WHEEL_RADIUS = 122;
const COLORABLE_DISGUISE_KINDS = new Set([
  "crate", "barrel", "bush", "lamp", "statue",
  "forestNature", "forestWalk", "forestPond", "forestBlock", "fallTree",
  "treeStump", "bushA", "pineA", "tallGrass", "twistedTreeA", "pineB",
  "birchTrees", "treesCluster", "fern", "mossyLog", "bushB", "resourceGold",
  "twistedTreeB", "pineC",
]);
const NON_DISGUISE_KINDS = new Set(["fantasySawmill", "bonfire"]);
const DISGUISE_COLOR_PRESETS = [
  { id: "sunset", label: "Zon", color: "#f09b41", accent: "#ffd272", materialNames: ["leaves", "leaf", "bush", "grass"] },
  { id: "mint", label: "Munt", color: "#4fbf84", accent: "#9df0c4", materialNames: ["leaves", "leaf", "bush", "grass"] },
  { id: "ocean", label: "Oceaan", color: "#3d84d9", accent: "#87c8ff", materialNames: ["leaves", "leaf", "bush", "grass"] },
  { id: "violet", label: "Paars", color: "#8b5cf0", accent: "#d2b3ff", materialNames: ["leaves", "leaf", "bush", "grass"] },
  { id: "rose", label: "Roze", color: "#d4578f", accent: "#ffb9d3", materialNames: ["leaves", "leaf", "bush", "grass"] },
  { id: "ember", label: "Gloed", color: "#b85a30", accent: "#f0b46c", materialNames: ["leaves", "leaf", "bush", "grass"] },
];
const DISGUISE_COLOR_BY_ID = Object.fromEntries(DISGUISE_COLOR_PRESETS.map((preset) => [preset.id, preset]));

const state = {
  currentMap: "plaza",
  mode: "menu",
  controlMode: "seeker",
  running: false,
  winner: "",
  timeLimit: 180,
  timeLeft: 180,
  puzzlePenalty: 16,
  mistCooldown: 0,
  message: "Kies in het menu een map of start de tutorial.",
  selectedMap: "plaza",
  lastTime: 0,
  statusTimer: 0,
  playedRound: false,
  summaryReady: false,
  mapName: "Gouden Plaza",
  stats: {
    solvedPuzzles: 0,
    taggedHiders: 0,
    roleAtStart: "Tikker",
  },
  tutorial: {
    stage: 0,
    walked: 0,
    transformed: false,
    solvedPuzzle: false,
    threwMist: false,
  },
  viewer: {
    active: false,
    mode: "model",
    currentModel: "seeker",
  },
  disguiseWheelOpen: false,
};

const seeker = {
  mesh: null,
  speed: 12,
  radius: 2.2,
  moveTarget: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  facing: new THREE.Vector3(1, 0, 0),
  flashTimer: 0,
  aiCooldown: 0,
  jumpHeight: 0,
  jumpVelocity: 0,
};

const explorer = {
  mesh: null,
  speed: 13,
  radius: 1.6,
  facing: new THREE.Vector3(0, 0, 1),
  jumpHeight: 0,
  jumpVelocity: 0,
  lastMoveAmount: 0,
  disguisedAs: null,
  disguisePartPath: null,
  disguiseMesh: null,
  disguiseColorId: DISGUISE_COLOR_PRESETS[0].id,
};

const hiders = [];
const props = [];
const puzzles = [];
const shots = [];
const clouds = [];
const mountainMeshes = [];
const decorativeClouds = [];
const villaDoors = [];
const worldDisguiseTargets = [];

const modelAssets = {
  seeker: { path: "assets/models/character-animated.glb", desiredHeight: 5.7, rotationY: 0, scene: null, size: null, center: null },
  hiderHuman: { path: "assets/models/hamster.glb", desiredHeight: 2.8, rotationY: 0, scene: null, size: null, center: null },
  seekerMask: { path: "assets/models/mask.glb", desiredHeight: 2.2, rotationY: Math.PI, scene: null, size: null, center: null },
  villaHouse: { path: "assets/models/villa-house.glb", desiredHeight: 28, rotationY: Math.PI, scene: null, size: null, center: null },
  forestNature: { path: "assets/models/forest-nature.glb", desiredHeight: 20, rotationY: 0, scene: null, size: null, center: null },
  forestWalk: { path: "assets/models/forest-walk.glb", desiredHeight: 16, rotationY: 0, scene: null, size: null, center: null },
  forestPond: { path: "assets/models/forest-pond.glb", desiredHeight: 10, rotationY: 0, scene: null, size: null, center: null },
  forestBlock: { path: "assets/models/forest-block.glb", desiredHeight: 12, rotationY: 0, scene: null, size: null, center: null },
  fallTree: { path: "assets/models/fall-tree.glb", desiredHeight: 14, rotationY: 0, scene: null, size: null, center: null },
  treeStump: { path: "assets/models/poly-forest/tree-stump.glb", desiredHeight: 2.4, rotationY: 0, scene: null, size: null, center: null },
  bushA: { path: "assets/models/poly-forest/bush-a.glb", desiredHeight: 3.2, rotationY: 0, scene: null, size: null, center: null },
  pineA: { path: "assets/models/poly-forest/pine-a.glb", desiredHeight: 22, rotationY: 0, scene: null, size: null, center: null },
  tallGrass: { path: "assets/models/poly-forest/tall-grass.glb", desiredHeight: 2.8, rotationY: 0, scene: null, size: null, center: null },
  twistedTreeA: { path: "assets/models/poly-forest/twisted-tree-a.glb", desiredHeight: 19, rotationY: 0, scene: null, size: null, center: null },
  pineB: { path: "assets/models/poly-forest/pine-b.glb", desiredHeight: 24, rotationY: 0, scene: null, size: null, center: null },
  birchTrees: { path: "assets/models/poly-forest/birch-trees.glb", desiredHeight: 18.5, rotationY: 0, scene: null, size: null, center: null },
  treesCluster: { path: "assets/models/poly-forest/trees-cluster.glb", desiredHeight: 20, rotationY: 0, scene: null, size: null, center: null },
  fern: { path: "assets/models/poly-forest/fern.glb", desiredHeight: 2.6, rotationY: 0, scene: null, size: null, center: null },
  mossyLog: { path: "assets/models/poly-forest/mossy-log.glb", desiredHeight: 2.2, rotationY: 0, scene: null, size: null, center: null },
  bushB: { path: "assets/models/poly-forest/bush-b.glb", desiredHeight: 3.4, rotationY: 0, scene: null, size: null, center: null },
  resourceGold: { path: "assets/models/poly-forest/resource-gold.glb", desiredHeight: 3.6, rotationY: 0, scene: null, size: null, center: null },
  twistedTreeB: { path: "assets/models/poly-forest/twisted-tree-b.glb", desiredHeight: 19.5, rotationY: 0, scene: null, size: null, center: null },
  pineC: { path: "assets/models/poly-forest/pine-c.glb", desiredHeight: 23, rotationY: 0, scene: null, size: null, center: null },
  fantasySawmill: { path: "assets/models/fantasy-sawmill.glb", desiredHeight: 12.5, rotationY: 0, scene: null, size: null, center: null },
  tentO: { path: "assets/models/tent-o.glb", desiredHeight: 6.6, rotationY: 0, scene: null, size: null, center: null },
  bonfire: { path: "assets/models/bonfire.glb", desiredHeight: 2.8, rotationY: 0, scene: null, size: null, center: null },
  crate: { path: "assets/models/crate.glb", desiredHeight: 3.6, rotationY: 0, scene: null, size: null, center: null },
  barrel: { path: "assets/models/barrel.glb", desiredHeight: 4.4, rotationY: 0, scene: null, size: null, center: null },
  bush: { path: "assets/models/bush.glb", desiredHeight: 3.1, rotationY: 0, scene: null, size: null, center: null },
  lamp: { path: "assets/models/lamp.glb", desiredHeight: 6.9, rotationY: 0, scene: null, size: null, center: null },
  statue: { path: "assets/models/horse-statue.glb", desiredHeight: 5.6, rotationY: Math.PI * 0.2, scene: null, size: null, center: null },
};

const propTypes = {
  crate: { color: "#9f6c42", accent: "#d8b077", radius: 2.4, scale: [3.5, 3.5, 3.5] },
  barrel: { color: "#7e5333", accent: "#c58b52", radius: 2.2, scale: [2.9, 4.3, 2.9] },
  bush: { color: "#699342", accent: "#9bd061", radius: 2.7, scale: [4.2, 3.2, 4.2] },
  lamp: { color: "#57506b", accent: "#f2cf67", radius: 1.9, scale: [1.3, 6.8, 1.3] },
  statue: { color: "#7f7d86", accent: "#c7c9d5", radius: 2.1, scale: [2.2, 5.8, 2.2] },
  forestNature: { color: "#6c8b50", accent: "#8ead68", radius: 4.8, scale: [8.5, 8.5, 8.5] },
  forestWalk: { color: "#719156", accent: "#3e5034", radius: 4.4, scale: [8.2, 8.2, 8.2] },
  forestPond: { color: "#5ea8d6", accent: "#7dcaf3", radius: 4.9, scale: [8.4, 3.2, 8.4] },
  forestBlock: { color: "#65804a", accent: "#8fb26f", radius: 4.6, scale: [7.8, 7.8, 7.8] },
  fallTree: { color: "#9f5f29", accent: "#d98b37", radius: 3.3, scale: [5.8, 10.5, 5.8] },
  treeStump: { color: "#685340", accent: "#8e775f", radius: 1.8, scale: [2.4, 1.8, 2.4] },
  bushA: { color: "#567144", accent: "#7ba164", radius: 2.5, scale: [3.6, 2.8, 3.6] },
  pineA: { color: "#496544", accent: "#678d5a", radius: 4.4, scale: [7.2, 21, 7.2] },
  tallGrass: { color: "#6f8a53", accent: "#97b56f", radius: 1.4, scale: [2.8, 2.4, 2.8] },
  twistedTreeA: { color: "#5d4837", accent: "#6f8a59", radius: 4.2, scale: [6.1, 18.6, 6.1] },
  pineB: { color: "#3c5641", accent: "#5c8057", radius: 4.8, scale: [7.5, 22.5, 7.5] },
  birchTrees: { color: "#8e9a88", accent: "#5d815b", radius: 4.8, scale: [8.8, 18.5, 8.8] },
  treesCluster: { color: "#55744e", accent: "#7a9e6c", radius: 5.1, scale: [9.1, 20, 9.1] },
  fern: { color: "#678750", accent: "#91b671", radius: 1.9, scale: [3.1, 2.6, 3.1] },
  mossyLog: { color: "#6d5a46", accent: "#6f8e5f", radius: 2.7, scale: [4.6, 1.9, 2.8] },
  bushB: { color: "#60764a", accent: "#88a764", radius: 2.8, scale: [3.8, 3, 3.8] },
  resourceGold: { color: "#9b7b2d", accent: "#f0d66b", radius: 2.1, scale: [2.8, 3.4, 2.8] },
  twistedTreeB: { color: "#594436", accent: "#6a8758", radius: 4.1, scale: [5.9, 19.2, 5.9] },
  pineC: { color: "#3e5943", accent: "#5d7b52", radius: 4.7, scale: [7.3, 22, 7.3] },
};

const MISTBOS_PROP_LAYOUT = [
  [-56, 0, -35, "treeStump"], [-45, 0, -39, "pineA"], [-29, 0, -31, "bushA"], [-15, 0, -37, "tallGrass"],
  [-2, 0, -29, "twistedTreeA"], [14, 0, -40, "pineB"], [21, 0, -30, "fern"], [40, 0, -37, "birchTrees"], [55, 0, -32, "bushB"],
  [-52, 0, -17, "mossyLog"], [-37, 0, -9, "treesCluster"], [-23, 0, -18, "tallGrass"], [-6, 0, -12, "pineC"],
  [11, 0, -16, "resourceGold"], [27, 0, -9, "twistedTreeB"], [35, 0, -18, "bushA"], [50, 0, -11, "treeStump"],
  [-57, 0, 5, "pineB"], [-42, 0, 11, "fern"], [-21, 0, 3, "birchTrees"], [-6, 0, 12, "bushB"],
  [10, 0, 4, "tallGrass"], [23, 0, 13, "pineA"], [33, 0, 1, "mossyLog"], [55, 0, 9, "bushA"],
  [-48, 0, 24, "twistedTreeA"], [-31, 0, 35, "pineC"], [-12, 0, 22, "treeStump"], [3, 0, 31, "treesCluster"],
  [18, 0, 25, "fern"], [34, 0, 34, "twistedTreeB"], [47, 0, 27, "bushB"],
];

const MISTBOS_WORLD_PLACEMENTS = [
  ["pineB", -60, -24, 1.26], ["pineA", -47, 29, 1.22], ["pineC", 57, -18, 1.28], ["treesCluster", 51, 23, 1.2],
  ["twistedTreeA", -31, 20, 1.18], ["twistedTreeB", 29, 20, 1.12], ["birchTrees", -4, -42, 1.24], ["birchTrees", 11, 40, 1.16],
  ["mossyLog", -10, 33, 1.14], ["treeStump", 19, -30, 1.18], ["bushA", -24, -28, 1.08], ["bushB", 36, -27, 1.06],
  ["fern", -38, 4, 1.26], ["fern", 42, 8, 1.22], ["tallGrass", -7, 23, 1.32], ["tallGrass", 7, -24, 1.32],
];

const MISTBOS_STRUCTURE_PLACEMENTS = [
  ["fantasySawmill", -2, -1.2, -36, 1.16, Math.PI * 0.08],
  ["bonfire", 27, -0.2, 33, 1.12, 0],
  ["tentO", 27, -0.2, 24, 1.18, Math.PI, "sunset"],
  ["tentO", 34.8, -0.2, 37.5, 1.18, -Math.PI * 0.66, "ocean"],
  ["tentO", 19.2, -0.2, 37.5, 1.18, Math.PI * 0.66, "mint"],
];

const MISTBOS_PREVIEW_PLACEMENTS = [
  ["pineA", -10, -5, 0.2],
  ["birchTrees", 8, -1, 0.18],
  ["mossyLog", 1, 10, 0.24],
  ["treeStump", -2, 8, 0.24],
  ["fern", 12, 10, 0.24],
];

const PARTIAL_DISGUISE_KINDS = new Set(["birchTrees", "treesCluster"]);
const MISTBOS_TREE_KINDS = new Set(["pineA", "pineB", "pineC", "twistedTreeA", "twistedTreeB", "birchTrees", "treesCluster"]);
const MISTBOS_ORGANIC_KINDS = new Set([
  "treeStump", "bushA", "bushB", "tallGrass", "fern", "mossyLog",
  "pineA", "pineB", "pineC", "twistedTreeA", "twistedTreeB", "birchTrees", "treesCluster",
]);

const mapConfigs = {
  plaza: {
    name: "Gouden Plaza",
    sky: "#efe4c7",
    fog: "#efe4c7",
    groundA: "#d7bf8d",
    groundB: "#b2875f",
    mountain: "#a97a59",
    timeLimit: 180,
    puzzlePenalty: 16,
    seekerSpawn: [0, 0, 0],
    hiderSpawns: [
      [-36, 0, 28],
      [36, 0, 24],
      [42, 0, -30],
    ],
    props: [
      [-50, 0, -34, "crate"], [-40, 0, -32, "statue"], [-27, 0, -30, "bush"], [-14, 0, -35, "lamp"],
      [0, 0, -34, "barrel"], [15, 0, -34, "crate"], [29, 0, -31, "bush"], [43, 0, -34, "statue"],
      [56, 0, -27, "crate"], [-52, 0, -6, "barrel"], [-33, 0, -10, "bush"], [-13, 0, -9, "crate"],
      [0, 0, -11, "statue"], [16, 0, -8, "lamp"], [34, 0, -8, "bush"], [53, 0, -10, "crate"],
      [-55, 0, 17, "bush"], [-42, 0, 27, "lamp"], [-22, 0, 18, "crate"], [-4, 0, 28, "statue"],
      [12, 0, 18, "barrel"], [29, 0, 22, "bush"], [47, 0, 28, "crate"], [59, 0, 16, "lamp"],
      [-48, 0, 42, "barrel"], [-26, 0, 44, "crate"], [-3, 0, 43, "bush"], [19, 0, 44, "lamp"],
      [40, 0, 42, "barrel"], [57, 0, 42, "crate"],
    ],
    puzzles: [
      [-41, 0, 5],
      [4, 0, -22],
      [37, 0, 9],
      [20, 0, 41],
    ],
  },
  garden: {
    name: "Mistbos",
    sky: "#a8bbb1",
    fog: "#c0d0c7",
    fogNear: 26,
    fogFar: 112,
    ambientSky: "#edf7f1",
    ambientGround: "#334238",
    ambientIntensity: 1.55,
    sunColor: "#f5fffb",
    sunIntensity: 1.18,
    groundA: "#526b58",
    groundB: "#39493d",
    mountain: "#24342e",
    timeLimit: 165,
    puzzlePenalty: 14,
    seekerSpawn: [0, 0, 44],
    hiderSpawns: [
      [-46, 0, -38],
      [44, 0, -32],
      [8, 0, -42],
    ],
    props: MISTBOS_PROP_LAYOUT,
    puzzles: [
      [-42, 0, -26],
      [38, 0, -20],
      [2, 0, -4],
      [-24, 0, 24],
      [30, 0, 28],
    ],
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function prepareImportedModel(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.side = THREE.FrontSide;
      }
    }
  });
}

function stylizeSeekerMaskModel(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material || !material.name) {
        return;
      }

      if (material.name === "Mask") {
        material.color = new THREE.Color("#e0b43a");
        material.metalness = 0.72;
        material.roughness = 0.24;
        material.emissive = new THREE.Color("#6b4c06");
        material.emissiveIntensity = 0.18;
      }

      if (material.name === "Strap" || material.name === "Holders") {
        material.transparent = true;
        material.opacity = 0;
        material.depthWrite = false;
      }
    });
  });
}

function stylizeHumanModel(root, tint) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material || !("color" in material)) {
        return;
      }
      material.color.lerp(new THREE.Color(tint), 0.22);
      if ("roughness" in material) {
        material.roughness = Math.max(0.35, material.roughness * 0.92);
      }
    });
  });
}

function cloneMaterialWithColor(material, tintColor, accentColor, options = {}) {
  if (!material || !("color" in material)) {
    return material;
  }

  const clone = material.clone();
  const tint = new THREE.Color(tintColor);
  const accent = new THREE.Color(accentColor || tintColor);
  const materialName = (clone.name || "").toLowerCase();
  const useAccent = (options.materialNames || []).some((name) => materialName.includes(name));

  clone.color = clone.color.clone().lerp(useAccent ? accent : tint, useAccent ? 0.75 : 0.6);
  if ("emissive" in clone && clone.emissive) {
    clone.emissive = clone.emissive.clone().lerp(accent, 0.28);
    clone.emissiveIntensity = Math.max(clone.emissiveIntensity || 0, 0.08);
  }
  if ("roughness" in clone) {
    clone.roughness = clamp((clone.roughness || 0.7) * 0.94, 0.15, 1);
  }
  return clone;
}

function applyTintToMesh(root, preset) {
  if (!root || !preset) {
    return;
  }

  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => cloneMaterialWithColor(material, preset.color, preset.accent, preset));
    } else {
      child.material = cloneMaterialWithColor(child.material, preset.color, preset.accent, preset);
    }
  });
}

function getDisguiseColorPreset(colorId) {
  return DISGUISE_COLOR_BY_ID[colorId] || DISGUISE_COLOR_PRESETS[0];
}

function canCustomizeDisguise(kind) {
  if (NON_DISGUISE_KINDS.has(kind)) {
    return false;
  }
  return COLORABLE_DISGUISE_KINDS.has(kind) || kind.endsWith("O");
}

function stylizeVillaModel(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material || !("color" in material)) {
        return;
      }
      material.color.lerp(new THREE.Color("#efe2cf"), 0.26);
      if ("roughness" in material) {
        material.roughness = clamp((material.roughness || 0.8) * 1.05, 0.35, 1);
      }
    });
  });
}

function getRenderableBounds(root) {
  const bounds = new THREE.Box3();
  let foundMesh = false;

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) {
      return;
    }

    if (!child.geometry.boundingBox) {
      child.geometry.computeBoundingBox();
    }

    const childBounds = child.geometry.boundingBox.clone();
    childBounds.applyMatrix4(child.matrixWorld);
    if (!foundMesh) {
      bounds.copy(childBounds);
      foundMesh = true;
    } else {
      bounds.union(childBounds);
    }
  });

  if (!foundMesh) {
    bounds.setFromObject(root);
  }

  return bounds;
}

function createAssetInstance(key) {
  const asset = modelAssets[key];
  if (!asset || !asset.scene || !asset.size || !asset.center) {
    return null;
  }

  try {
    const wrapper = new THREE.Group();
    const model = cloneSkinned(asset.scene);
    prepareImportedModel(model);
    if (key === "seekerMask") {
      stylizeSeekerMaskModel(model);
    }
    if (key === "seeker") {
      stylizeHumanModel(model, "#d68f52");
    }
    if (key === "hiderHuman") {
      stylizeHumanModel(model, "#8ab4e8");
    }
    if (key === "villaHouse") {
      stylizeVillaModel(model);
    }

    const scale = asset.desiredHeight / Math.max(asset.size.y, 0.001);
    model.scale.setScalar(scale);
    model.rotation.y = asset.rotationY || 0;

    const scaledCenter = asset.center.clone().multiplyScalar(scale);
    const minY = (asset.center.y - asset.size.y * 0.5) * scale;
    model.position.set(-scaledCenter.x, -minY, -scaledCenter.z);
    wrapper.add(model);
    wrapper.userData.assetKey = key;
    return wrapper;
  } catch (error) {
    console.warn(`Model fallback actief voor ${key}.`, error);
    return null;
  }
}

function replaceSeekerVisual() {
  if (!seeker.mesh || !modelAssets.seeker.scene) {
    return;
  }
  const previous = seeker.mesh;
  const replacement = createCharacter("#7c4a1f", true);
  replacement.position.copy(previous.position);
  replacement.rotation.copy(previous.rotation);
  replacement.visible = previous.visible;
  gameplayRoot.remove(previous);
  seeker.mesh = replacement;
  gameplayRoot.add(replacement);
}

function replacePropVisuals() {
  props.forEach((prop) => {
    if (!modelAssets[prop.kind]?.scene) {
      return;
    }
    const replacement = createPropMesh(prop.kind);
    replacement.position.copy(prop.mesh.position);
    replacement.rotation.copy(prop.mesh.rotation);
    gameplayRoot.remove(prop.mesh);
    gameplayRoot.add(replacement);
    prop.mesh = replacement;
  });
}

function refreshImportedVisuals() {
  replaceSeekerVisual();
  replacePropVisuals();

  hiders.forEach((hider) => {
    if (hider.disguisedAs) {
      applyDisguise(hider, hider.disguisedAs, { partPath: hider.disguisePartPath });
    }
  });

  if (state.viewer.active && state.viewer.mode === "model") {
    showViewerModel(state.viewer.currentModel);
  }
  if (state.viewer.active && state.viewer.mode === "map") {
    showMapPreview(state.selectedMap);
  }
  if (state.currentMap === "garden" || state.mapName.includes("Misttuin")) {
    const config = mapConfigs[state.currentMap] || mapConfigs.garden;
    createWorldDecor(config);
  }
}

function findDisguiseTargetFromObject(object) {
  let current = object;
  while (current) {
    const match = props.find((prop) => prop.mesh === current) || worldDisguiseTargets.find((target) => target.mesh === current);
    if (match) {
      return match;
    }
    current = current.parent;
  }
  return null;
}

function loadModelAsset(key) {
  const asset = modelAssets[key];
  if (!asset) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    gltfLoader.load(
      asset.path,
      (gltf) => {
        const sceneRoot = gltf.scene || gltf.scenes?.[0];
        if (!sceneRoot) {
          resolve();
          return;
        }
        prepareImportedModel(sceneRoot);
        const box = getRenderableBounds(sceneRoot);
        asset.scene = sceneRoot;
        asset.size = box.getSize(new THREE.Vector3());
        asset.center = box.getCenter(new THREE.Vector3());
        refreshImportedVisuals();
        resolve();
      },
      undefined,
      () => resolve()
    );
  });
}

function loadModelAssets() {
  return Promise.all(Object.keys(modelAssets).map((key) => loadModelAsset(key)));
}

function clearViewerModel() {
  viewerRoot.clear();
}

function createSeekerMaskFallback() {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({
      color: "#e0b43a",
      roughness: 0.24,
      metalness: 0.72,
      emissive: "#6b4c06",
      emissiveIntensity: 0.18,
    })
  );
  shell.scale.set(1.05, 1.02, 0.82);
  shell.castShadow = true;
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.07, 10, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#61101f", emissive: "#2d0006", emissiveIntensity: 0.6 })
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.2, 0.92);
  group.add(shell, smile);
  return group;
}

function createViewerModel(key) {
  if (key === "seeker") {
    return createCharacter("#7c4a1f", true);
  }
  if (key === "hider") {
    return createCharacter("#58b6ff", false);
  }
  if (key === "seekerMask") {
    return createAssetInstance("seekerMask") || createSeekerMaskFallback();
  }
  return createPropMesh(key);
}

function showViewerModel(key) {
  state.viewer.currentModel = key;
  clearViewerModel();

  viewerLightRig.clear();
  const ambient = new THREE.HemisphereLight("#fff8e8", "#d8c4a5", 2.4);
  const keyLight = new THREE.DirectionalLight("#fff5d2", 2.8);
  keyLight.position.set(8, 14, 10);
  const fillLight = new THREE.DirectionalLight("#f9e7c7", 1.6);
  fillLight.position.set(-10, 8, 7);
  const rimLight = new THREE.PointLight("#ffffff", 18, 30, 2);
  rimLight.position.set(0, 8, 8);
  viewerLightRig.add(ambient, keyLight, fillLight, rimLight);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(2.8, 3.3, 1.2, 28),
    new THREE.MeshStandardMaterial({ color: "#b69172", roughness: 0.72 })
  );
  pedestal.position.y = 0.6;
  pedestal.receiveShadow = true;
  viewerRoot.add(pedestal);

  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(6.4, 48),
    new THREE.MeshBasicMaterial({ color: "#fff1cf", transparent: true, opacity: 0.45 })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = 0.03;
  viewerRoot.add(floorGlow);

  const model = createViewerModel(key);
  if (model) {
    model.position.y = 1.2;
    viewerRoot.add(model);
    viewerRoot.userData.previewModel = model;
  }
}

function openModelViewer(defaultKey = "seeker") {
  state.viewer.active = true;
  state.viewer.mode = "model";
  menuOverlay.classList.add("viewer-mode");
  menuCard.classList.add("viewer-mode");
  modelViewerPanel.classList.add("visible");
  menuHint.textContent = "Klik op een mapkaart om een map te bekijken, of bekijk hieronder losse modellen.";
  showViewerModel(defaultKey);
}

function closeModelViewer() {
  state.viewer.active = false;
  state.viewer.mode = "model";
  menuOverlay.classList.remove("viewer-mode");
  menuCard.classList.remove("viewer-mode");
  modelViewerPanel.classList.remove("visible");
  viewerLightRig.clear();
  clearViewerModel();
  menuHint.textContent = "Klik op een mapkaart om hem rustig te bekijken. Start daarna de geselecteerde map of begin de tutorial.";
}

function showMenu() {
  menuOverlay.classList.add("visible");
  showMapPreview(state.selectedMap || state.currentMap || "plaza");
}

function hideMenu() {
  menuOverlay.classList.remove("visible");
}

function showSummary() {
  summaryOverlay.classList.add("visible");
}

function hideSummary() {
  summaryOverlay.classList.remove("visible");
}

function resetTutorialProgress() {
  state.tutorial = {
    stage: 0,
    walked: 0,
    transformed: false,
    solvedPuzzle: false,
    threwMist: false,
  };
}

function tutorialMessage() {
  if (state.mode !== "tutorial") {
    return state.message;
  }
  if (state.tutorial.stage === 0) {
    return "Tutorial stap 1: loop eerst rond met WASD of de pijltjes.";
  }
  if (state.tutorial.stage === 1) {
    return "Tutorial stap 2: klik op een voorwerp dicht bij je om erin te veranderen.";
  }
  if (state.tutorial.stage === 2) {
    return "Tutorial stap 3: ga naast een puzzel staan en houd E ingedrukt om hem op te lossen.";
  }
  if (state.tutorial.stage === 3) {
    return "Tutorial stap 4: je bent nu de tikker, gooi mist met Shift.";
  }
  return "Tutorial klaar. Je kent nu de basis van Phanto Tikkertje.";
}

function advanceTutorialStage(nextStage) {
  if (state.mode !== "tutorial" || nextStage <= state.tutorial.stage) {
    return;
  }
  state.tutorial.stage = nextStage;
  if (nextStage === 3) {
    const player = getPlayerHider();
    state.controlMode = "seeker";
    if (player && seeker.mesh) {
      seeker.mesh.visible = true;
      seeker.mesh.position.copy(player.mesh.position);
      seeker.mesh.rotation.y = player.mesh.rotation.y;
      seeker.facing.copy(player.moveMemory || new THREE.Vector3(0, 0, 1));
      player.mesh.visible = false;
    }
    updateRoleButton();
  }
  state.message = tutorialMessage();
}

function updateRoleButton() {
  if (state.mode === "explore") {
    roleButton.textContent = "Bestuur: Verkenner";
    return;
  }
  roleButton.textContent = state.controlMode === "seeker" ? "Bestuur: Tikker" : "Bestuur: Verstopper";
}

function assignRandomControlRole() {
  state.controlMode = Math.random() < 0.5 ? "seeker" : "hider";
  updateRoleButton();
  state.stats.roleAtStart = state.controlMode === "seeker" ? "Tikker" : "Verstopper";
}

function getPlayerHider() {
  return hiders.find((hider) => hider.control === "player") || null;
}

function activeHiders() {
  return hiders.filter((hider) => !hider.out);
}

function updateHud() {
  hudTitle.textContent = state.mode === "explore"
    ? "Vrij Verkennen"
    : state.running ? `Tijd: ${Math.max(0, Math.ceil(state.timeLeft))}` : "Tijd: --";
  hudMap.textContent = `Map: ${state.mapName}`;
  hudRole.textContent = `Bestuurd: ${state.mode === "explore" ? "Verkenner" : state.controlMode === "seeker" ? "Tikker" : "Verstopper"}`;
  hudPlayers.textContent = state.mode === "explore" ? "Spelers: 0" : `Spelers: ${1 + hiders.length}`;
  hudPuzzles.textContent = state.mode === "explore" ? "Puzzels: uit" : `Puzzels nog te doen: ${puzzles.filter((puzzle) => !puzzle.solved).length}`;
  hudMessage.textContent = state.mode === "tutorial" ? tutorialMessage() : state.message;
}

function clearGameplay() {
  gameplayRoot.clear();
  props.length = 0;
  puzzles.length = 0;
  hiders.length = 0;
  shots.length = 0;
  clouds.length = 0;
  explorer.mesh = null;
}

function displayPropName(kind) {
  const names = {
    crate: "krat",
    barrel: "ton",
    bush: "struik",
    lamp: "lamp",
    statue: "standbeeld",
    forestNature: "bosgroep",
    forestWalk: "bospad",
    forestPond: "vijver",
    forestBlock: "rotsblok",
    fallTree: "herfstboom",
    treeStump: "boomstronk",
    bushA: "struik",
    pineA: "den",
    tallGrass: "hoog gras",
    twistedTreeA: "scheve boom",
    pineB: "grote den",
    birchTrees: "berken",
    treesCluster: "boomgroep",
    fern: "varen",
    mossyLog: "mosstam",
    bushB: "struik",
    resourceGold: "goudsteen",
    twistedTreeB: "scheve boom",
    pineC: "mistden",
  };
  return names[kind] || kind;
}

function getObjectPathFromAncestor(root, object) {
  if (!root || !object) {
    return null;
  }

  const path = [];
  let current = object;
  while (current && current !== root) {
    const parent = current.parent;
    if (!parent) {
      return null;
    }
    const index = parent.children.indexOf(current);
    if (index < 0) {
      return null;
    }
    path.unshift(index);
    current = parent;
  }

  return current === root ? path : null;
}

function resolveObjectPath(root, path) {
  if (!root || !Array.isArray(path)) {
    return null;
  }

  let current = root;
  for (const index of path) {
    current = current?.children?.[index] || null;
    if (!current) {
      return null;
    }
  }
  return current;
}

function getDisguiseSelectionNode(root, hitObject) {
  if (!root || !hitObject) {
    return null;
  }

  let current = hitObject;
  while (current && current.parent && current.parent !== root) {
    if (current.parent.parent === root) {
      return current;
    }
    current = current.parent;
  }

  return current && current !== root ? current : null;
}

function createPartialDisguiseMesh(kind, options = {}) {
  if (!PARTIAL_DISGUISE_KINDS.has(kind)) {
    return null;
  }

  let sourceRoot = options.targetMesh || null;
  let partPath = Array.isArray(options.partPath) ? options.partPath : null;

  if (!sourceRoot) {
    sourceRoot = createAssetInstance(kind);
  }
  if (!sourceRoot) {
    return null;
  }

  let selection = partPath ? resolveObjectPath(sourceRoot, partPath) : null;
  if (!selection) {
    selection = getDisguiseSelectionNode(sourceRoot, options.hitObject);
    partPath = getObjectPathFromAncestor(sourceRoot, selection);
  }
  if (!selection) {
    return null;
  }

  const clone = cloneSkinned(selection);
  prepareImportedModel(clone);

  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  selection.updateWorldMatrix(true, true);
  selection.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

  clone.position.copy(worldPosition);
  clone.quaternion.copy(worldQuaternion);
  clone.scale.copy(worldScale);

  const wrapper = new THREE.Group();
  const bounds = getRenderableBounds(clone);
  const center = bounds.getCenter(new THREE.Vector3());
  clone.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  wrapper.add(clone);
  wrapper.userData.kind = kind;

  return { mesh: wrapper, partPath };
}

function createCharacter(color, isSeeker = false) {
  const group = new THREE.Group();
  group.castShadow = true;
  const characterModel = createAssetInstance(isSeeker ? "seeker" : "hiderHuman");

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.05, 1.8, 6, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.72 })
  );
  body.position.y = 2.8;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 18),
    new THREE.MeshStandardMaterial({ color: isSeeker ? "#f0a33a" : "#f5dfc4", roughness: 0.52 })
  );
  head.position.y = 4.8;
  head.castShadow = true;
  group.add(head);

  let mask = null;
  if (isSeeker) {
    mask = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.62),
      new THREE.MeshStandardMaterial({
        color: "#e0b43a",
        roughness: 0.24,
        metalness: 0.72,
        emissive: "#6b4c06",
        emissiveIntensity: 0.18,
      })
    );
    mask.position.set(0, 4.78, 0.28);
    mask.scale.set(1.06, 1.02, 0.78);
    mask.castShadow = true;
    group.add(mask);
  }

  const eyeMaterial = new THREE.MeshStandardMaterial({
    color: isSeeker ? "#d30d18" : "#2a2730",
    emissive: isSeeker ? "#8a0a12" : "#000000",
    emissiveIntensity: isSeeker ? 1.2 : 0,
  });
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), eyeMaterial);
  const rightEye = leftEye.clone();
  leftEye.position.set(-0.34, 4.95, isSeeker ? 0.98 : 0.74);
  rightEye.position.set(0.34, 4.95, isSeeker ? 0.98 : 0.74);
  if (isSeeker) {
    leftEye.scale.set(1.1, 1.7, 0.9);
    rightEye.scale.set(1.1, 1.7, 0.9);
  }
  group.add(leftEye, rightEye);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.08, 10, 18, Math.PI),
    new THREE.MeshStandardMaterial({
      color: isSeeker ? "#5a0010" : "#4d3a2e",
      emissive: isSeeker ? "#220006" : "#000000",
      emissiveIntensity: isSeeker ? 0.4 : 0,
    })
  );
  smile.position.set(0, 4.4, isSeeker ? 1.02 : 0.82);
  smile.rotation.z = Math.PI;
  group.add(smile);

  const shadow = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.5, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: "#403224", transparent: true, opacity: 0.28 })
  );
  shadow.position.y = 0.08;
  shadow.receiveShadow = true;
  group.add(shadow);

  if (characterModel) {
    characterModel.position.set(0, 0.08, 0.14);
    characterModel.scale.multiplyScalar(isSeeker ? 1.04 : 1.08);
    group.add(characterModel);
    body.visible = false;
    head.visible = false;
    leftEye.visible = false;
    rightEye.visible = false;
    smile.visible = false;
  }

  const importedMask = isSeeker ? createAssetInstance("seekerMask") : null;
  if (importedMask) {
    importedMask.position.set(0, 4.62, 0.46);
    importedMask.rotation.y += Math.PI;
    importedMask.scale.multiplyScalar(0.62);
    group.add(importedMask);
    if (mask) {
      mask.visible = false;
    }
  }

  group.userData = { body, head, mask, leftEye, rightEye, smile, shadow, importedMask, importedModel: characterModel };
  return group;
}

function createPropMesh(kind) {
  const importedModel = createAssetInstance(kind);
  if (importedModel) {
    importedModel.position.y = 0;
    importedModel.userData.kind = kind;
    importedModel.userData.baseKind = kind;
    return importedModel;
  }

  const config = propTypes[kind];
  const group = new THREE.Group();
  let mainMesh;

  if (kind === "crate") {
    mainMesh = new THREE.Mesh(
      new THREE.BoxGeometry(config.scale[0], config.scale[1], config.scale[2]),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.85 })
    );
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(config.scale[0] + 0.12, 0.35, config.scale[2] + 0.12),
      new THREE.MeshStandardMaterial({ color: config.accent, roughness: 0.8 })
    );
    trim.position.y = 0.3;
    group.add(trim);
  } else if (kind === "barrel") {
    mainMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(config.scale[0] * 0.5, config.scale[2] * 0.5, config.scale[1], 18),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.74 })
    );
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(config.scale[0] * 0.52, 0.12, 8, 18),
      new THREE.MeshStandardMaterial({ color: config.accent, metalness: 0.2, roughness: 0.5 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.4;
    const band2 = band.clone();
    band2.position.y = -0.6;
    group.add(band, band2);
  } else if (kind === "bush") {
    mainMesh = new THREE.Mesh(
      new THREE.SphereGeometry(config.scale[0] * 0.45, 18, 18),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 1 })
    );
    mainMesh.scale.set(1.2, 0.9, 1.15);
    const puff = mainMesh.clone();
    puff.scale.set(0.95, 0.75, 0.95);
    puff.position.set(1.2, 0.5, 0.6);
    const puff2 = mainMesh.clone();
    puff2.scale.set(0.9, 0.72, 0.88);
    puff2.position.set(-1.15, 0.3, 0.35);
    group.add(puff, puff2);
  } else if (kind === "lamp") {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, config.scale[1], 14),
      new THREE.MeshStandardMaterial({ color: config.color, metalness: 0.25, roughness: 0.58 })
    );
    pole.position.y = config.scale[1] * 0.5;
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.4, 1.1),
      new THREE.MeshStandardMaterial({ color: config.accent, emissive: config.accent, emissiveIntensity: 0.6 })
    );
    lantern.position.y = config.scale[1] + 0.25;
    group.add(pole, lantern);
    mainMesh = pole;
  } else if (kind === "forestPond") {
    mainMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(config.scale[0] * 0.48, config.scale[2] * 0.52, config.scale[1], 26),
      new THREE.MeshStandardMaterial({ color: config.color, emissive: config.accent, emissiveIntensity: 0.15, transparent: true, opacity: 0.88 })
    );
  } else if (kind === "fallTree") {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.65, config.scale[1], 12),
      new THREE.MeshStandardMaterial({ color: "#6f4a2e", roughness: 0.92 })
    );
    trunk.position.y = config.scale[1] * 0.5;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(config.scale[0] * 0.45, config.scale[1] * 0.78, 12),
      new THREE.MeshStandardMaterial({ color: config.accent, roughness: 1 })
    );
    leaves.position.y = config.scale[1] + 1.8;
    group.add(trunk, leaves);
    mainMesh = trunk;
  } else if (kind === "forestNature" || kind === "forestWalk" || kind === "forestBlock") {
    mainMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(config.scale[0] * 0.42, config.scale[2] * 0.48, config.scale[1], 10),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.96 })
    );
    mainMesh.position.y = config.scale[1] * 0.5;
    const topper = new THREE.Mesh(
      new THREE.ConeGeometry(config.scale[0] * 0.5, config.scale[1] * 0.8, 10),
      new THREE.MeshStandardMaterial({ color: config.accent, roughness: 1 })
    );
    topper.position.y = config.scale[1] * 1.05;
    group.add(topper);
  } else {
    mainMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(config.scale[0] * 0.6, config.scale[0] * 0.7, config.scale[1], 12),
      new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.82 })
    );
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 14, 14),
      new THREE.MeshStandardMaterial({ color: config.accent, roughness: 0.6 })
    );
    orb.position.y = config.scale[1] * 0.5;
    group.add(orb);
  }

  mainMesh.castShadow = true;
  mainMesh.receiveShadow = true;
  mainMesh.position.y = kind === "lamp" ? 0 : config.scale[1] * 0.5;
  group.add(mainMesh);
  group.userData.kind = kind;
  group.userData.baseKind = kind;
  return group;
}

function tintPropMesh(mesh, kind, colorId) {
  if (!mesh || !canCustomizeDisguise(kind)) {
    return;
  }

  const preset = getDisguiseColorPreset(colorId);
  applyTintToMesh(mesh, preset);
  mesh.userData.disguiseColorId = preset.id;
}

function colorPresetForWorldProp(kind, index) {
  if (!canCustomizeDisguise(kind)) {
    return null;
  }
  return DISGUISE_COLOR_PRESETS[index % DISGUISE_COLOR_PRESETS.length];
}

function buildColorWheel() {
  colorWheel.innerHTML = "";

  DISGUISE_COLOR_PRESETS.forEach((preset, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-wheel-option";
    button.dataset.colorId = preset.id;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", preset.label);
    button.style.background = `radial-gradient(circle at 35% 30%, ${preset.accent}, ${preset.color})`;

    const angle = (Math.PI * 2 * index) / DISGUISE_COLOR_PRESETS.length - Math.PI / 2;
    const x = Math.cos(angle) * COLOR_WHEEL_RADIUS;
    const y = Math.sin(angle) * COLOR_WHEEL_RADIUS;
    button.style.setProperty("--wheel-x", `${x}px`);
    button.style.setProperty("--wheel-y", `${y}px`);
    button.innerHTML = `<span>${preset.label}</span>`;
    colorWheel.append(button);
  });
}

function activeDisguiseActor() {
  if (!state.running || state.controlMode !== "hider") {
    return null;
  }

  if (menuOverlay.classList.contains("visible") || summaryOverlay.classList.contains("visible")) {
    return null;
  }

  const actor = state.mode === "explore" ? explorer : getPlayerHider();
  if (!actor?.disguisedAs || !actor.disguiseMesh) {
    return null;
  }

  return actor;
}

function syncColorWheelSelection(colorId) {
  [...colorWheel.querySelectorAll(".color-wheel-option")].forEach((button) => {
    const isActive = button.dataset.colorId === colorId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function openDisguiseColorWheel() {
  const actor = activeDisguiseActor();
  if (!actor || !canCustomizeDisguise(actor.disguisedAs)) {
    state.message = "Deze vermomming heeft nu nog geen kleurkeuzes.";
    updateHud();
    return;
  }

  state.disguiseWheelOpen = true;
  colorWheelOverlay.classList.add("visible");
  colorWheelHint.textContent = `Kies een kleur voor je ${displayPropName(actor.disguisedAs)}.`;
  syncColorWheelSelection(actor.disguiseColorId || DISGUISE_COLOR_PRESETS[0].id);
}

function closeDisguiseColorWheel() {
  state.disguiseWheelOpen = false;
  colorWheelOverlay.classList.remove("visible");
}

function setActorDisguiseColor(actor, colorId) {
  if (!actor?.disguiseMesh || !actor.disguisedAs || !canCustomizeDisguise(actor.disguisedAs)) {
    return;
  }

  const nextColorId = getDisguiseColorPreset(colorId).id;
  actor.disguiseColorId = nextColorId;
  applyDisguise(actor, actor.disguisedAs, { partPath: actor.disguisePartPath, colorId: nextColorId });
  state.message = `Vermomming aangepast naar ${getDisguiseColorPreset(nextColorId).label.toLowerCase()}.`;
  updateHud();
}

function applyMistbosPropVariation(mesh, kind, index) {
  if (!mesh || !MISTBOS_ORGANIC_KINDS.has(kind)) {
    return;
  }

  const spinSeed = Math.sin((index + 1) * 12.9898) * 43758.5453;
  const scaleSeed = Math.sin((index + 1) * 78.233) * 43758.5453;
  const jitterSeed = Math.sin((index + 1) * 43.531) * 43758.5453;
  const spinNoise = spinSeed - Math.floor(spinSeed);
  const scaleNoise = scaleSeed - Math.floor(scaleSeed);
  const jitterNoise = jitterSeed - Math.floor(jitterSeed);

  mesh.rotation.y = spinNoise * Math.PI * 2;

  let scale = 0.92 + scaleNoise * 0.22;
  if (MISTBOS_TREE_KINDS.has(kind)) {
    scale = 1.08 + scaleNoise * 0.32;
  }
  mesh.scale.multiplyScalar(scale);

  mesh.position.x += (jitterNoise - 0.5) * (MISTBOS_TREE_KINDS.has(kind) ? 1.9 : 1.1);
  mesh.position.z += (spinNoise - 0.5) * (MISTBOS_TREE_KINDS.has(kind) ? 1.7 : 1);
}

function createHedge(width, depth, height = 3.1) {
  const hedge = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color: "#6c924b", roughness: 0.95 })
  );
  hedge.position.y = height * 0.5;
  hedge.castShadow = true;
  hedge.receiveShadow = true;
  return hedge;
}

function createFountain(scale = 1) {
  const group = new THREE.Group();

  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4 * scale, 5.4 * scale, 1.2 * scale, 28),
    new THREE.MeshStandardMaterial({ color: "#d9dce6", roughness: 0.55 })
  );
  basin.position.y = 0.6 * scale;
  basin.receiveShadow = true;

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.7 * scale, 4.4 * scale, 0.36 * scale, 28),
    new THREE.MeshStandardMaterial({
      color: "#7cd0ff",
      roughness: 0.2,
      metalness: 0.08,
      emissive: "#4bb8ff",
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.88,
    })
  );
  water.position.y = 1.04 * scale;

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9 * scale, 1.1 * scale, 3.5 * scale, 18),
    new THREE.MeshStandardMaterial({ color: "#c8cbd7", roughness: 0.45 })
  );
  column.position.y = 2.2 * scale;
  column.castShadow = true;

  const topper = new THREE.Mesh(
    new THREE.SphereGeometry(0.75 * scale, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#f3e4b2", roughness: 0.3, emissive: "#d3bd63", emissiveIntensity: 0.15 })
  );
  topper.position.y = 4.3 * scale;
  topper.castShadow = true;

  group.add(basin, water, column, topper);
  return group;
}

function createVillaStructure() {
  const group = new THREE.Group();
  const shellMaterial = new THREE.MeshStandardMaterial({ color: "#e5dbc8", roughness: 0.84 });
  const upperMaterial = new THREE.MeshStandardMaterial({ color: "#efe6d6", roughness: 0.8 });

  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(28, 12, 2), shellMaterial);
  frontLeft.position.set(-20, 6, 12.9);
  frontLeft.castShadow = true;
  frontLeft.receiveShadow = true;

  const frontRight = frontLeft.clone();
  frontRight.position.x = 20;

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(68, 12, 2), shellMaterial);
  backWall.position.set(0, 6, -20.9);
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 34), shellMaterial);
  leftWall.position.set(-33, 6, -4);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;

  const rightWall = leftWall.clone();
  rightWall.position.x = 33;

  const upperFront = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 2), upperMaterial);
  upperFront.position.set(0, 17, 3.9);
  upperFront.castShadow = true;
  upperFront.receiveShadow = true;

  const upperBack = new THREE.Mesh(new THREE.BoxGeometry(34, 10, 2), upperMaterial);
  upperBack.position.set(0, 17, -15.9);
  upperBack.castShadow = true;
  upperBack.receiveShadow = true;

  const upperLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 20), upperMaterial);
  upperLeft.position.set(-16, 17, -6);
  upperLeft.castShadow = true;
  upperLeft.receiveShadow = true;

  const upperRight = upperLeft.clone();
  upperRight.position.x = 16;

  const upperCore = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 16), upperMaterial);
  upperCore.position.set(0, 17, -6);
  upperCore.castShadow = true;
  upperCore.receiveShadow = true;

  const roofMain = new THREE.Mesh(
    new THREE.ConeGeometry(29, 11, 4),
    new THREE.MeshStandardMaterial({ color: "#5e4436", roughness: 0.92 })
  );
  roofMain.rotation.y = Math.PI * 0.25;
  roofMain.position.set(0, 27, -4);
  roofMain.scale.z = 0.7;
  roofMain.castShadow = true;

  const roofUpper = roofMain.clone();
  roofUpper.scale.set(0.66, 0.72, 0.54);
  roofUpper.position.set(0, 33, -6);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(58, 0.6, 24),
    new THREE.MeshStandardMaterial({ color: "#a7815d", roughness: 0.88 })
  );
  floor.position.set(0, 0.3, -2);
  floor.receiveShadow = true;

  const terrace = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.5, 12),
    new THREE.MeshStandardMaterial({ color: "#cfb692", roughness: 0.85 })
  );
  terrace.position.set(0, 0.25, 18);
  terrace.receiveShadow = true;

  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(58, 0.45, 24),
    new THREE.MeshStandardMaterial({ color: "#f3ecdf", roughness: 0.9 })
  );
  ceiling.position.set(0, 11.7, -2);
  ceiling.receiveShadow = true;

  const stairHall = new THREE.Mesh(
    new THREE.BoxGeometry(12, 6, 10),
    new THREE.MeshStandardMaterial({ color: "#ddd1bb", roughness: 0.88, transparent: true, opacity: 0.92 })
  );
  stairHall.position.set(0, 3, -8);
  stairHall.receiveShadow = true;

  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-0.2, 0, 12.6);
  const leftDoor = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 8.8, 0.38),
    new THREE.MeshStandardMaterial({ color: "#76482c", roughness: 0.58 })
  );
  leftDoor.position.set(-1.7, 4.4, 0);
  leftDoor.castShadow = true;
  leftDoorPivot.add(leftDoor);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(0.2, 0, 12.6);
  const rightDoor = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 8.8, 0.38),
    new THREE.MeshStandardMaterial({ color: "#76482c", roughness: 0.58 })
  );
  rightDoor.position.set(1.7, 4.4, 0);
  rightDoor.castShadow = true;
  rightDoorPivot.add(rightDoor);

  group.add(
    frontLeft,
    frontRight,
    backWall,
    leftWall,
    rightWall,
    upperFront,
    upperBack,
    upperLeft,
    upperRight,
    upperCore,
    roofMain,
    roofUpper,
    floor,
    terrace,
    ceiling,
    stairHall,
    leftDoorPivot,
    rightDoorPivot
  );

  for (let x = -24; x <= 24; x += 12) {
    const windowFrame = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 5.2, 0.7),
      new THREE.MeshStandardMaterial({ color: "#4f5d6f", emissive: "#f7d47a", emissiveIntensity: 0.12 })
    );
    windowFrame.position.set(x, 8, 12.95);
    windowFrame.castShadow = true;
    group.add(windowFrame);
  }

  for (let x = -12; x <= 12; x += 12) {
    const upperWindow = new THREE.Mesh(
      new THREE.BoxGeometry(4.4, 4.8, 0.7),
      new THREE.MeshStandardMaterial({ color: "#4f5d6f", emissive: "#f7d47a", emissiveIntensity: 0.1 })
    );
    upperWindow.position.set(x, 18, 5.8);
    upperWindow.castShadow = true;
    group.add(upperWindow);
  }

  for (const x of [-33, 33]) {
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(8, 9, 14),
      new THREE.MeshStandardMaterial({ color: "#ded2bc", roughness: 0.84 })
    );
    wing.position.set(x, 4.5, 0);
    wing.castShadow = true;
    wing.receiveShadow = true;
      group.add(wing);
  }

  group.userData.doors = [
    { pivot: leftDoorPivot, closed: 0, open: -Math.PI * 0.5, trigger: new THREE.Vector3(-2.2, 0, 15.5), current: 0 },
    { pivot: rightDoorPivot, closed: 0, open: Math.PI * 0.5, trigger: new THREE.Vector3(2.2, 0, 15.5), current: 0 },
  ];

  return group;
}

function createImportedVillaExterior() {
  const importedVilla = createAssetInstance("villaHouse");
  if (!importedVilla) {
    return null;
  }
  importedVilla.position.set(0, 0, -4);
  importedVilla.scale.multiplyScalar(1.18);
  importedVilla.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return importedVilla;
}

function createPuzzle(position, index) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.4, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: "#6e5f79", roughness: 0.6 })
  );
  base.position.y = 0.6;
  base.receiveShadow = true;
  base.castShadow = true;

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.95),
    new THREE.MeshStandardMaterial({ color: "#f0d86f", emissive: "#e6bf4a", emissiveIntensity: 1.2, roughness: 0.2 })
  );
  core.position.y = 2.15;
  core.castShadow = true;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.12, 12, 24),
    new THREE.MeshStandardMaterial({ color: "#f6ebbb", emissive: "#fff0b4", emissiveIntensity: 1.1 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.35;

  if (state.currentMap === "garden") {
    const forestMarker = createAssetInstance("resourceGold");
    if (forestMarker) {
      forestMarker.position.y = 1.05;
      forestMarker.scale.multiplyScalar(0.82);
      group.add(forestMarker);
    }
  }

  group.add(base, core, ring);
  group.position.copy(position);
  group.userData.core = core;
  group.userData.ring = ring;

  return {
    id: `puzzle-${index}`,
    mesh: group,
    progress: 0,
    solved: false,
    pulse: rand(0, Math.PI * 2),
  };
}

function createShot(origin, direction) {
  const group = new THREE.Group();
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 14),
    new THREE.MeshStandardMaterial({ color: "#8f49cc", emissive: "#8f49cc", emissiveIntensity: 1.3, transparent: true, opacity: 0.9 })
  );
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.06, 8, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#d9b7ff", emissive: "#d9b7ff", emissiveIntensity: 1.6 })
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.08, 0.68);
  group.add(orb, smile);
  group.position.copy(origin);
  group.userData.orb = orb;
  gameplayRoot.add(group);

  return {
    mesh: group,
    direction: direction.clone().normalize(),
    speed: 16,
    life: 1.05,
    maxDistance: 12,
    travelled: 0,
  };
}

function createCloud(position) {
  const group = new THREE.Group();
  const puff = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#8d53cf", emissive: "#6e33b6", emissiveIntensity: 1.4, transparent: true, opacity: 0.35 })
  );
  puff.scale.set(1.5, 0.95, 1.2);

  const puff2 = puff.clone();
  puff2.scale.set(1.1, 0.75, 1.0);
  puff2.position.set(1.2, 0.5, 0.2);

  const puff3 = puff.clone();
  puff3.scale.set(1.0, 0.65, 0.9);
  puff3.position.set(-1.1, 0.2, 0.35);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.08, 10, 18, Math.PI),
    new THREE.MeshStandardMaterial({ color: "#d8c5ff", emissive: "#d8c5ff", emissiveIntensity: 1.6 })
  );
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.1, 1.05);

  group.add(puff, puff2, puff3, smile);
  group.position.copy(position);
  gameplayRoot.add(group);

  return {
    mesh: group,
    life: 1.2,
    radius: 3.2,
    hitSet: new Set(),
  };
}

function createHider(index, position, color, control) {
  const mesh = createCharacter(color, false);
  mesh.position.copy(position);
  gameplayRoot.add(mesh);

  return {
    id: `hider-${index + 1}`,
    mesh,
    speed: 9.4,
    radius: 1.9,
    control,
    out: false,
    disguisedAs: null,
    disguisePartPath: null,
    disguiseMesh: null,
    disguiseColorId: DISGUISE_COLOR_PRESETS[index % DISGUISE_COLOR_PRESETS.length].id,
    facing: new THREE.Vector3(1, 0, 0),
    moveTarget: position.clone(),
    aiTimer: rand(1.2, 3.2),
    targetPuzzleId: null,
    solving: 0,
    moveMemory: new THREE.Vector3(1, 0, 0),
    lastMoveAmount: 0,
    jumpHeight: 0,
    jumpVelocity: 0,
  };
}

function setCharacterVisible(actor, visible) {
  const parts = actor.mesh.userData;
  parts.body.visible = visible;
  parts.head.visible = visible;
  parts.leftEye.visible = visible;
  parts.rightEye.visible = visible;
  parts.smile.visible = visible;
  parts.shadow.visible = visible;
  if (parts.importedModel) {
    parts.importedModel.visible = visible;
  }
}

function clearDisguise(hider) {
  if (hider.disguiseMesh) {
    hider.mesh.remove(hider.disguiseMesh);
    hider.disguiseMesh = null;
  }
  hider.disguisedAs = null;
  hider.disguisePartPath = null;
  if (state.disguiseWheelOpen) {
    const activeActor = state.mode === "explore" ? explorer : getPlayerHider();
    if (activeActor === hider) {
      closeDisguiseColorWheel();
    }
  }
  setCharacterVisible(hider, true);
}

function applyDisguise(hider, kind, options = {}) {
  clearDisguise(hider);
  const partialDisguise = createPartialDisguiseMesh(kind, options);
  const disguise = partialDisguise?.mesh || createPropMesh(kind);
  const colorId = options.colorId || hider.disguiseColorId || DISGUISE_COLOR_PRESETS[0].id;
  disguise.position.set(0, 0, 0);
  if (canCustomizeDisguise(kind)) {
    tintPropMesh(disguise, kind, colorId);
  }
  hider.mesh.add(disguise);
  hider.disguiseMesh = disguise;
  hider.disguisedAs = kind;
  hider.disguisePartPath = partialDisguise?.partPath || null;
  hider.disguiseColorId = colorId;
  setCharacterVisible(hider, false);
}

function createWorldDecor(config) {
  scene.background = new THREE.Color(config.sky);
  scene.fog = new THREE.Fog(config.fog, config.fogNear || 65, config.fogFar || 180);

  worldRoot.clear();
  mapPreviewRoot.clear();
  mountainMeshes.length = 0;
  decorativeClouds.length = 0;
  villaDoors.length = 0;
  worldDisguiseTargets.length = 0;

  const ambient = new THREE.HemisphereLight(
    config.ambientSky || "#fff5d9",
    config.ambientGround || "#8f7757",
    config.ambientIntensity || 1.25
  );
  const sun = new THREE.DirectionalLight(config.sunColor || "#fff3c4", config.sunIntensity || 1.8);
  sun.position.set(26, 48, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 180;
  worldRoot.add(ambient, sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(world.width, world.depth, 18, 18),
    new THREE.MeshStandardMaterial({ color: config.groundA, roughness: 0.98, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  worldRoot.add(ground);

  if (!config.name.includes("Mistbos")) {
    const plazaBand = new THREE.Mesh(
      new THREE.PlaneGeometry(world.width * 0.7, world.depth * 0.45),
      new THREE.MeshStandardMaterial({ color: config.groundB, roughness: 0.82, transparent: true, opacity: 0.88 })
    );
    plazaBand.rotation.x = -Math.PI / 2;
    plazaBand.position.y = 0.02;
    worldRoot.add(plazaBand);
  }

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const distance = 74 + (index % 2 === 0 ? 5 : 12);
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(rand(10, 18), rand(16, 28), 6),
      new THREE.MeshStandardMaterial({ color: config.mountain, roughness: 1 })
    );
    mountain.position.set(Math.cos(angle) * distance, 8, Math.sin(angle) * distance);
    mountain.castShadow = true;
    worldRoot.add(mountain);
    mountainMeshes.push(mountain);
  }

  for (let index = 0; index < 8; index += 1) {
    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(rand(2.8, 4.4), 16, 16),
      new THREE.MeshBasicMaterial({ color: "#fff7ef", transparent: true, opacity: 0.55 })
    );
    cloud.scale.set(1.8, 0.75, 1.05);
    cloud.position.set(rand(-58, 58), rand(18, 28), rand(-44, 44));
    worldRoot.add(cloud);
    decorativeClouds.push(cloud);
  }

  if (config.name.includes("Mistbos")) {
    const fogSheet = new THREE.Mesh(
      new THREE.CircleGeometry(58, 48),
      new THREE.MeshBasicMaterial({ color: "#f4fbf7", transparent: true, opacity: 0.14 })
    );
    fogSheet.rotation.x = -Math.PI / 2;
    fogSheet.position.set(0, 0.18, 0);
    worldRoot.add(fogSheet);

    const pathSpine = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 76),
      new THREE.MeshStandardMaterial({ color: "#6f6552", roughness: 0.98, transparent: true, opacity: 0.58 })
    );
    pathSpine.rotation.x = -Math.PI / 2;
    pathSpine.position.set(0, 0.03, 0);
    worldRoot.add(pathSpine);

    const sidePath = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 34),
      new THREE.MeshStandardMaterial({ color: "#756b56", roughness: 0.98, transparent: true, opacity: 0.52 })
    );
    sidePath.rotation.x = -Math.PI / 2;
    sidePath.rotation.z = Math.PI * 0.32;
    sidePath.position.set(-16, 0.035, 12);
    worldRoot.add(sidePath);

    MISTBOS_WORLD_PLACEMENTS.forEach(([kind, x, z, scale]) => {
      const asset = createAssetInstance(kind);
      if (!asset) {
        return;
      }
      const worldPreset = colorPresetForWorldProp(kind, Math.abs(x) + Math.abs(z));
      if (worldPreset) {
        tintPropMesh(asset, kind, worldPreset.id);
      }
      asset.position.set(x, 0, z);
      asset.scale.multiplyScalar(scale);
      worldRoot.add(asset);
      worldDisguiseTargets.push({
        id: `world-${kind}-${x}-${z}`,
        kind,
        mesh: asset,
        radius: propTypes[kind].radius * Math.max(0.85, scale * 0.72),
      });
    });

    MISTBOS_STRUCTURE_PLACEMENTS.forEach(([kind, x, y, z, scale, rotationY, colorId]) => {
      const asset = createAssetInstance(kind);
      if (!asset) {
        return;
      }
      if (colorId && canCustomizeDisguise(kind)) {
        tintPropMesh(asset, kind, colorId);
      }
      asset.position.set(x, y, z);
      asset.scale.multiplyScalar(scale);
      asset.rotation.y = rotationY || 0;
      worldRoot.add(asset);
    });
  }
}

function setSelectedMap(mapKey) {
  state.selectedMap = mapKey;
  mapButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.map === mapKey);
  });
}

function createMapPreview(mapKey) {
  const config = mapConfigs[mapKey] || mapConfigs.plaza;
  const group = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 30, 1.8, 40),
    new THREE.MeshStandardMaterial({ color: config.groundA, roughness: 0.96 })
  );
  ground.receiveShadow = true;
  group.add(ground);

  const accent = new THREE.Mesh(
    new THREE.CylinderGeometry(21, 21, 0.3, 32),
    new THREE.MeshStandardMaterial({ color: config.groundB, roughness: 0.88 })
  );
  accent.position.y = 0.95;
  group.add(accent);

  if (mapKey === "garden") {
    MISTBOS_PREVIEW_PLACEMENTS
      .forEach(([kind, x, z, scale]) => {
        const asset = createAssetInstance(kind);
        if (!asset) {
          return;
        }
        asset.scale.multiplyScalar(scale);
        asset.position.set(x, 0.95, z);
        group.add(asset);
      });

    const previewPath = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.2, 24),
      new THREE.MeshStandardMaterial({ color: "#6e6755", roughness: 0.96 })
    );
    previewPath.position.set(0, 0.92, 3);
    group.add(previewPath);
  } else {
    for (const [x, , z, kind] of config.props.slice(0, 8)) {
      const prop = createPropMesh(kind);
      prop.position.set(x * 0.28, 0.9, z * 0.28);
      prop.scale.multiplyScalar(0.42);
      group.add(prop);
    }
  }

  return group;
}

function showMapPreview(mapKey) {
  state.viewer.active = true;
  state.viewer.mode = "map";
  menuOverlay.classList.add("viewer-mode");
  menuCard.classList.add("viewer-mode");
  modelViewerPanel.classList.remove("visible");
  viewerLightRig.clear();
  clearViewerModel();

  const ambient = new THREE.HemisphereLight("#fff8e8", "#d8c4a5", 2.1);
  const keyLight = new THREE.DirectionalLight("#fff5d2", 2.3);
  keyLight.position.set(8, 14, 10);
  const fillLight = new THREE.DirectionalLight("#f9e7c7", 1.4);
  fillLight.position.set(-10, 8, 7);
  viewerLightRig.add(ambient, keyLight, fillLight);

  const preview = createMapPreview(mapKey);
  viewerRoot.add(preview);
  viewerRoot.userData.previewModel = preview;

  const config = mapConfigs[mapKey] || mapConfigs.plaza;
  menuHint.textContent = `${config.name} geselecteerd. Bekijk de map rustig en klik daarna op Start Geselecteerde Map.`;
  setSelectedMap(mapKey);
}

function setupRound(config, mode) {
  clearGameplay();
  hideSummary();
  state.currentMap = Object.keys(mapConfigs).find((key) => mapConfigs[key] === config) || state.currentMap;
  state.selectedMap = state.currentMap;
  state.mapName = config.name;
  state.mode = mode;
  state.running = true;
  state.winner = "";
  state.timeLimit = config.timeLimit;
  state.timeLeft = config.timeLimit;
  state.puzzlePenalty = config.puzzlePenalty;
  state.mistCooldown = 0;
  state.statusTimer = 0;
  state.summaryReady = false;
  state.playedRound = true;
  state.stats = {
    solvedPuzzles: 0,
    taggedHiders: 0,
    roleAtStart: "Tikker",
  };

  resetTutorialProgress();
  state.message = mode === "tutorial"
    ? tutorialMessage()
    : mode === "explore"
      ? "Rustige verkenmodus: loop vrij door de map zonder tikker of verstoppers."
      : "De ronde is gestart. Los puzzels op of jaag de verstoppers op.";
  createWorldDecor(config);

  if (mode === "explore") {
    explorer.mesh = createCharacter("#8ec5ff", false);
    explorer.mesh.position.set(...config.seekerSpawn);
    explorer.mesh.position.y = 0;
    explorer.jumpHeight = 0;
    explorer.jumpVelocity = 0;
    explorer.facing.set(0, 0, 1);
    explorer.lastMoveAmount = 0;
    explorer.disguisedAs = null;
    explorer.disguisePartPath = null;
    explorer.disguiseMesh = null;
    gameplayRoot.add(explorer.mesh);
  } else {
    seeker.mesh = createCharacter("#7c4a1f", true);
    seeker.mesh.position.set(...config.seekerSpawn);
    seeker.mesh.position.y = 0;
    seeker.facing.set(-1, 0, 0);
    seeker.jumpHeight = 0;
    seeker.jumpVelocity = 0;
    seeker.moveTarget.copy(seeker.mesh.position);
    seeker.aiCooldown = rand(0.5, 1.2);
    gameplayRoot.add(seeker.mesh);

    const spawnCount = mode === "tutorial" ? 1 : config.hiderSpawns.length;
    for (let index = 0; index < spawnCount; index += 1) {
      const spawn = new THREE.Vector3(...config.hiderSpawns[index]);
      const color = ["#58b6ff", "#ff7aa2", "#67d66d"][index] || "#8ec5ff";
      const control = index === 0 ? "player" : "ai";
      hiders.push(createHider(index, spawn, color, control));
    }
  }

  config.props.forEach((entry, index) => {
    const [x, y, z, kind] = entry;
    const mesh = createPropMesh(kind);
    const worldPreset = colorPresetForWorldProp(kind, index);
    if (worldPreset) {
      tintPropMesh(mesh, kind, worldPreset.id);
    }
    mesh.position.set(x, y, z);
    if (config.name.includes("Mistbos")) {
      applyMistbosPropVariation(mesh, kind, index);
    }
    mesh.userData.propId = `prop-${index}`;
    gameplayRoot.add(mesh);
    props.push({ id: `prop-${index}`, kind, mesh, radius: propTypes[kind].radius });
  });

  if (mode !== "explore") {
    const puzzleLayout = mode === "tutorial" ? [config.puzzles[0]] : config.puzzles;
    puzzleLayout.forEach((coords, index) => {
      const puzzle = createPuzzle(new THREE.Vector3(...coords), index);
      puzzles.push(puzzle);
      gameplayRoot.add(puzzle.mesh);
    });
  }

  if (mode === "tutorial") {
    state.controlMode = "hider";
    state.stats.roleAtStart = "Verstopper";
    seeker.mesh.visible = false;
    state.message = "Tutorial stap 1: loop eerst rond met WASD of de pijltjes.";
  } else if (mode === "explore") {
    state.controlMode = "hider";
    state.stats.roleAtStart = "Verkenner";
  } else {
    assignRandomControlRole();
  }
  updateRoleButton();
  setSelectedMap(state.currentMap);
  updateHud();
}

function startMap(mapKey) {
  const config = mapConfigs[mapKey] || mapConfigs.plaza;
  hideMenu();
  setupRound(config, "round");
}

function startTutorial() {
  hideMenu();
  setupRound(mapConfigs.garden, "tutorial");
}

function exploreMap(mapKey) {
  const config = mapConfigs[mapKey] || mapConfigs.plaza;
  hideMenu();
  setupRound(config, "explore");
}

function cycleControlMode() {
  if (!state.running) {
    return;
  }
  if (state.mode === "explore") {
    state.message = "In de verkenmodus bestuur je alleen de verkenner.";
    updateHud();
    return;
  }
  if (state.mode === "tutorial" && state.tutorial.stage < 3) {
    state.message = tutorialMessage();
    updateHud();
    return;
  }
  state.controlMode = state.controlMode === "seeker" ? "hider" : "seeker";
  updateRoleButton();
  state.message = state.controlMode === "seeker" ? "Je bestuurt nu de tikker." : "Je bestuurt nu de verstopper.";
  updateHud();
}

function movementVector() {
  const direction = new THREE.Vector3();
  if (keys.has("w") || keys.has("arrowup")) {
    direction.z -= 1;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    direction.z += 1;
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    direction.x -= 1;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    direction.x += 1;
  }
  if (direction.lengthSq() > 0) {
    direction.normalize();
  }
  return direction;
}

function keepInBounds(position) {
  position.x = clamp(position.x, -world.width * 0.5 + 3, world.width * 0.5 - 3);
  position.z = clamp(position.z, -world.depth * 0.5 + 3, world.depth * 0.5 - 3);
}

function resolvePropCollisions(position, radius) {
  props.forEach((prop) => {
    tmpVec.copy(position).sub(prop.mesh.position);
    tmpVec.y = 0;
    const distance = tmpVec.length();
    const minimum = radius + prop.radius * 0.78;
    if (distance > 0 && distance < minimum) {
      tmpVec.normalize().multiplyScalar(minimum - distance);
      position.add(tmpVec);
    }
  });
}

function moveActor(actor, direction, delta) {
  if (!actor || direction.lengthSq() === 0) {
    if (actor && "lastMoveAmount" in actor) {
      actor.lastMoveAmount = 0;
    }
    return 0;
  }
  tmpVec.copy(direction).multiplyScalar(actor.speed * delta);
  actor.mesh.position.add(tmpVec);
  keepInBounds(actor.mesh.position);
  resolvePropCollisions(actor.mesh.position, actor.radius);
  actor.facing.copy(direction);
  if (actor.moveMemory) {
    actor.moveMemory.copy(direction);
  }
  actor.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  const moved = tmpVec.length();
  if ("lastMoveAmount" in actor) {
    actor.lastMoveAmount = moved;
  }
  return moved;
}

function updateActorJump(actor, delta) {
  if (!actor || !actor.mesh) {
    return;
  }
  if (actor.jumpHeight > 0 || actor.jumpVelocity !== 0) {
    actor.jumpVelocity -= GRAVITY * delta;
    actor.jumpHeight = Math.max(0, actor.jumpHeight + actor.jumpVelocity * delta);
    if (actor.jumpHeight === 0 && actor.jumpVelocity < 0) {
      actor.jumpVelocity = 0;
    }
  }
  actor.mesh.position.y = actor.jumpHeight;
}

function tryJump() {
  if (!state.running) {
    return;
  }
  const actor = controlledActor();
  if (!actor || actor.jumpHeight > 0.02) {
    return;
  }
  actor.jumpVelocity = JUMP_SPEED;
}

function hiderVisibleToSeeker(hider) {
  if (!hider || hider.out) {
    return false;
  }
  const distance = seeker.mesh.position.distanceTo(hider.mesh.position);
  if (distance > SEEKER_VIEW_DISTANCE) {
    return false;
  }
  if (hider.disguisedAs && hider.lastMoveAmount <= DISGUISE_STILL_SPEED) {
    return false;
  }
  return true;
}

function burstShot(shot) {
  const cloud = createCloud(shot.mesh.position.clone());
  clouds.push(cloud);
  gameplayRoot.remove(shot.mesh);
  shot.dead = true;
}

function tagHider(hider) {
  if (hider.out) {
    return;
  }
  hider.out = true;
  clearDisguise(hider);
  hider.mesh.visible = false;
  state.stats.taggedHiders += 1;
  const remaining = activeHiders().length;
  state.message = remaining > 0 ? `Een verstopper is getikt. Nog ${remaining} over.` : "Alle verstoppers zijn getikt.";
}

function launchMist(direction, isPlayerShot = false) {
  if (!state.running || state.mistCooldown > 0) {
    return false;
  }
  const forward = direction ? direction.clone() : seeker.facing.clone();
  if (forward.lengthSq() === 0) {
    forward.set(0, 0, 1);
  }
  forward.normalize();

  const origin = seeker.mesh.position.clone().add(forward.clone().multiplyScalar(2.2));
  origin.y = 2.8;
  shots.push(createShot(origin, forward));
  state.mistCooldown = 0.7;
  state.message = "Je gooit een korte Phanto-mistworp.";

  if (isPlayerShot && state.mode === "tutorial" && state.tutorial.stage >= 3) {
    state.tutorial.threwMist = true;
    finishRound("Tutorial voltooid", "Je hebt alle tutorialstappen afgerond.");
  }
  return true;
}

function tryThrowMist(autoDirection = null) {
  if (state.controlMode !== "seeker") {
    return;
  }
  launchMist(autoDirection, true);
}

function solvePuzzle(puzzle, delta, solver) {
  if (puzzle.solved) {
    return;
  }
  puzzle.progress = clamp(puzzle.progress + delta, 0, 1);
  if (puzzle.progress >= 1) {
    puzzle.solved = true;
    state.stats.solvedPuzzles += 1;
    state.timeLeft = Math.max(0, state.timeLeft - state.puzzlePenalty);
    if (solver && solver.control === "player") {
      state.message = `Puzzel opgelost. De tijd van de tikker is ${state.puzzlePenalty} seconden korter.`;
    }
    if (state.mode === "tutorial") {
      state.tutorial.solvedPuzzle = true;
      advanceTutorialStage(3);
    }
  }
}

function nearestPuzzle(actor) {
  let best = null;
  let bestDistance = Infinity;
  puzzles.forEach((puzzle) => {
    if (puzzle.solved) {
      return;
    }
    const distance = actor.mesh.position.distanceToSquared(puzzle.mesh.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = puzzle;
    }
  });
  return best;
}

function controlledActor() {
  const actor = state.mode === "explore"
    ? explorer
    : state.controlMode === "seeker" ? seeker : getPlayerHider();
  return actor && actor.mesh ? actor : null;
}

function updatePlayer(delta) {
  const actor = controlledActor();
  if (!actor) {
    return;
  }
  updateActorJump(actor, delta);
  const direction = movementVector();
  const walked = moveActor(actor, direction, delta);

  if (state.mode === "tutorial" && state.tutorial.stage === 0 && walked > 0) {
    state.tutorial.walked += walked;
    if (state.tutorial.walked > 10) {
      advanceTutorialStage(1);
    }
  }

  if (state.mode === "explore") {
    return;
  }

  if (state.controlMode === "hider") {
    const player = getPlayerHider();
    const puzzle = nearestPuzzle(player);
    const closeEnough = puzzle && player.mesh.position.distanceTo(puzzle.mesh.position) < 4.2;
    if (closeEnough && keys.has("e") && (state.mode !== "tutorial" || state.tutorial.stage >= 2)) {
      solvePuzzle(puzzle, delta * 0.85, player);
    } else if (puzzle && !puzzle.solved) {
      puzzle.progress = clamp(puzzle.progress - delta * 0.4, 0, 1);
    }
  }
}

function updateAiHiders(delta) {
  if (state.mode === "explore") {
    return;
  }
  hiders.forEach((hider) => {
    if (hider.out || hider.control === "player") {
      return;
    }

    updateActorJump(hider, delta);
    hider.lastMoveAmount = 0;
    hider.aiTimer -= delta;
    const nearest = nearestPuzzle(hider);
    const seekerDistance = hider.mesh.position.distanceTo(seeker.mesh.position);

    if (seekerDistance < 15) {
      tmpVec.copy(hider.mesh.position).sub(seeker.mesh.position).setY(0).normalize();
      hider.moveTarget.copy(hider.mesh.position).add(tmpVec.multiplyScalar(12));
      hider.aiTimer = 0.5;
      clearDisguise(hider);
    } else if (nearest && (!hider.targetPuzzleId || hider.aiTimer <= 0)) {
      hider.targetPuzzleId = nearest.id;
      hider.moveTarget.copy(nearest.mesh.position);
      hider.aiTimer = rand(1.8, 3.4);
    } else if (hider.aiTimer <= 0) {
      hider.moveTarget.set(rand(-58, 58), 0, rand(-42, 42));
      hider.aiTimer = rand(1.8, 3.8);
      if (!hider.disguisedAs && Math.random() < 0.35) {
        const prop = props[(Math.random() * props.length) | 0];
        applyDisguise(hider, prop.kind);
      }
    }

    tmpVec.copy(hider.moveTarget).sub(hider.mesh.position).setY(0);
    if (tmpVec.lengthSq() > 1) {
      tmpVec.normalize();
      moveActor(hider, tmpVec, delta);
    }

    if (nearest && !nearest.solved && hider.mesh.position.distanceTo(nearest.mesh.position) < 4.1) {
      solvePuzzle(nearest, delta * 0.45, hider);
    }
  });
}

function updateAiSeeker(delta) {
  if (state.mode === "explore" || state.controlMode === "seeker" || state.mode === "tutorial") {
    return;
  }
  updateActorJump(seeker, delta);
  seeker.aiCooldown -= delta;
  const targets = activeHiders().filter((hider) => hiderVisibleToSeeker(hider));
  if (!targets.length) {
    return;
  }

  let target = targets[0];
  let bestDistance = seeker.mesh.position.distanceToSquared(target.mesh.position);
  for (let index = 1; index < targets.length; index += 1) {
    const distance = seeker.mesh.position.distanceToSquared(targets[index].mesh.position);
    if (distance < bestDistance) {
      bestDistance = distance;
      target = targets[index];
    }
  }

  tmpVec.copy(target.mesh.position).sub(seeker.mesh.position).setY(0);
  const distance = tmpVec.length();
  if (distance > 0.8) {
    tmpVec.normalize();
    moveActor(seeker, tmpVec, delta);
  }

  if (distance < 12 && seeker.aiCooldown <= 0) {
    const throwDirection = target.mesh.position.clone().sub(seeker.mesh.position).setY(0).normalize();
    launchMist(throwDirection);
    seeker.aiCooldown = rand(0.9, 1.5);
  }
}

function updateShots(delta) {
  if (state.mode === "explore") {
    return;
  }
  for (let index = shots.length - 1; index >= 0; index -= 1) {
    const shot = shots[index];
    if (shot.dead) {
      shots.splice(index, 1);
      continue;
    }

    const step = shot.speed * delta;
    tmpVec.copy(shot.direction).multiplyScalar(step);
    shot.mesh.position.add(tmpVec);
    shot.travelled += step;
    shot.life -= delta;
    shot.mesh.rotation.y += delta * 4;

    const pos = shot.mesh.position;
    if (
      shot.life <= 0 ||
      shot.travelled >= shot.maxDistance ||
      Math.abs(pos.x) > world.width * 0.5 - 2 ||
      Math.abs(pos.z) > world.depth * 0.5 - 2
    ) {
      burstShot(shot);
      shots.splice(index, 1);
      continue;
    }

    let hitProp = false;
    props.forEach((prop) => {
      if (hitProp) {
        return;
      }
      if (pos.distanceTo(prop.mesh.position) < prop.radius + 1.1) {
        hitProp = true;
      }
    });
    if (hitProp) {
      burstShot(shot);
      shots.splice(index, 1);
      continue;
    }

    const hiderHit = activeHiders().find((hider) => pos.distanceTo(hider.mesh.position) < hider.radius + 1.2);
    if (hiderHit) {
      burstShot(shot);
      shots.splice(index, 1);
    }
  }
}

function updateClouds(delta) {
  if (state.mode === "explore") {
    return;
  }
  for (let index = clouds.length - 1; index >= 0; index -= 1) {
    const cloud = clouds[index];
    cloud.life -= delta;
    cloud.mesh.position.y += delta * 0.6;
    cloud.mesh.scale.multiplyScalar(1 + delta * 0.18);
    cloud.mesh.children.forEach((child, childIndex) => {
      if (child.material && "opacity" in child.material) {
        child.material.opacity = Math.max(0, 0.45 * cloud.life);
      }
      if (childIndex === cloud.mesh.children.length - 1) {
        child.rotation.y += delta * 1.2;
      }
    });

    activeHiders().forEach((hider) => {
      if (cloud.hitSet.has(hider.id)) {
        return;
      }
      if (cloud.mesh.position.distanceTo(hider.mesh.position) < cloud.radius) {
        cloud.hitSet.add(hider.id);
        tagHider(hider);
      }
    });

    if (cloud.life <= 0) {
      gameplayRoot.remove(cloud.mesh);
      clouds.splice(index, 1);
    }
  }
}

function finishRound(title, text) {
  state.running = false;
  state.summaryReady = true;
  state.winner = title;
  summaryTitle.textContent = title;
  summaryText.textContent = text;
  summaryStats.innerHTML = "";

  const stats = [];
  if (state.mode === "tutorial") {
    stats.push(`Map: ${state.mapName}`);
    stats.push("Jouw rol: Verstopper");
    stats.push(`Tutorialstap bereikt: ${state.tutorial.threwMist ? "Alle stappen" : state.tutorial.stage + 1}`);
    stats.push(`Puzzels nog te doen: ${puzzles.filter((puzzle) => !puzzle.solved).length}`);
  } else {
    stats.push(`Map: ${state.mapName}`);
    stats.push(`Jouw rol: ${state.stats.roleAtStart}`);
    stats.push(`Verstoppers getikt: ${state.stats.taggedHiders}`);
    stats.push(`Puzzels opgelost: ${state.stats.solvedPuzzles}`);
    stats.push(`Puzzels nog te doen: ${puzzles.filter((puzzle) => !puzzle.solved).length}`);
    stats.push(`Resterende tijd: ${Math.max(0, Math.ceil(state.timeLeft))}`);
  }

  stats.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    summaryStats.appendChild(item);
  });
  showSummary();
  updateHud();
}

function checkWinConditions() {
  if (!state.running) {
    return;
  }
  if (state.mode === "explore") {
    return;
  }
  if (activeHiders().length === 0) {
    finishRound("Tikker wint", "Alle verstoppers zijn gepakt door de Phanto-mist.");
    return;
  }
  if (state.timeLeft <= 0) {
    finishRound("Verstoppers winnen", "De tijd van de tikker is op en niet iedereen is gepakt.");
  }
}

function updatePuzzles(delta) {
  if (state.mode === "explore") {
    return;
  }
  puzzles.forEach((puzzle) => {
    puzzle.pulse += delta * 2.2;
    puzzle.mesh.userData.core.rotation.y += delta * 1.1;
    puzzle.mesh.userData.ring.rotation.z += delta * 0.8;
    const glow = puzzle.solved ? 0.18 : 1 + Math.sin(puzzle.pulse) * 0.15;
    puzzle.mesh.userData.core.material.emissiveIntensity = glow;
    puzzle.mesh.userData.ring.material.emissiveIntensity = puzzle.solved ? 0.2 : 0.8;
    puzzle.mesh.position.y = puzzle.solved ? -0.2 : 0;
  });
}

function updateSeekerVisual(delta) {
  if (state.mode === "explore") {
    return;
  }
  if (!seeker.mesh) {
    return;
  }
  seeker.flashTimer = Math.max(0, seeker.flashTimer - delta);
  const smile = seeker.mesh.userData.smile;
  smile.material.emissiveIntensity = 0.4 + Math.sin(state.lastTime * 0.004) * 0.12;
}

function updateCamera(delta) {
  if (state.viewer.active) {
    const previewModel = viewerRoot.userData.previewModel;
    if (previewModel && state.viewer.mode === "model") {
      previewModel.rotation.y += delta * 0.75;
    }
    scene.background = new THREE.Color("#f6e7c7");
    worldRoot.visible = false;
    gameplayRoot.visible = false;
    mapPreviewRoot.visible = false;
    viewerRoot.visible = true;
    viewerLightRig.visible = true;
    const desired = state.viewer.mode === "map"
      ? new THREE.Vector3(0, 17, 27)
      : new THREE.Vector3(0, 9.5, 16);
    camera.position.lerp(desired, 1 - Math.exp(-delta * 3));
    camera.lookAt(0, state.viewer.mode === "map" ? 4.2 : 4.4, 0);
    return;
  }

  viewerLightRig.visible = false;
  worldRoot.visible = true;
  gameplayRoot.visible = true;
  viewerRoot.visible = false;
  mapPreviewRoot.visible = false;
  const actor = controlledActor();
  const target = actor ? actor.mesh.position : new THREE.Vector3(0, 0, 0);
  const desired = new THREE.Vector3(target.x + 22, 34, target.z + 30);
  camera.position.lerp(desired, 1 - Math.exp(-delta * 3));
  camera.lookAt(target.x, 2.8, target.z);
}

function updateDecor(delta) {
  decorativeClouds.forEach((cloud, index) => {
    cloud.position.x += Math.sin(state.lastTime * 0.00015 + index) * delta * 1.1;
    cloud.position.z += Math.cos(state.lastTime * 0.00012 + index * 2) * delta * 0.8;
  });
  mountainMeshes.forEach((mountain, index) => {
    mountain.rotation.y += delta * 0.03 * (index % 2 === 0 ? 1 : -1);
  });
  villaDoors.forEach((door) => {
    const actors = [seeker, ...hiders].filter((actor) => actor?.mesh && actor.mesh.visible && !actor.out);
    const shouldOpen = actors.some((actor) => actor.mesh.position.distanceToSquared(door.trigger) < 30);
    const target = shouldOpen ? door.open : door.closed;
    door.current = THREE.MathUtils.lerp(door.current, target, 1 - Math.exp(-delta * 8));
    door.pivot.rotation.y = door.current;
  });
}

function resizeRenderer() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}

function handlePointer(event) {
  if (!state.running || (state.controlMode !== "hider" && state.mode !== "explore")) {
    return;
  }
  if (state.disguiseWheelOpen) {
    return;
  }
  if (state.mode === "tutorial" && state.tutorial.stage < 1) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const player = state.mode === "explore" ? explorer : getPlayerHider();
  if (!player) {
    return;
  }

  const clickableTargets = [...props, ...worldDisguiseTargets];
  const intersections = raycaster.intersectObjects(clickableTargets.map((target) => target.mesh), true);
  if (!intersections.length) {
    return;
  }

  const hit = intersections[0].object;
  const hitPoint = intersections[0].point.clone();
  const propMesh = findDisguiseTargetFromObject(hit);
  if (!propMesh) {
    return;
  }
  hitPoint.y = player.mesh.position.y;
  if (player.mesh.position.distanceTo(hitPoint) > 6.5) {
    state.message = "Dat voorwerp is te ver weg om in te veranderen.";
    updateHud();
    return;
  }

  applyDisguise(player, propMesh.kind, { targetMesh: propMesh.mesh, hitObject: hit });
  state.message = `Je bent nu vermomd als ${displayPropName(propMesh.kind)}.`;
  if (state.mode === "tutorial") {
    state.tutorial.transformed = true;
    advanceTutorialStage(2);
  }
  updateHud();
}

function tick(time) {
  const delta = Math.min(0.05, clock.getDelta());
  state.lastTime = time;

  if (state.running) {
    if (state.mode !== "explore") {
      state.timeLeft -= delta;
    }
    state.mistCooldown = Math.max(0, state.mistCooldown - delta);
    updatePlayer(delta);
    updateAiHiders(delta);
    updateAiSeeker(delta);
    updateShots(delta);
    updateClouds(delta);
    updatePuzzles(delta);
    updateSeekerVisual(delta);
    checkWinConditions();
  }

  updateDecor(delta);
  updateCamera(delta);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener("resize", resizeRenderer);
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);

  if (key === "tab") {
    event.preventDefault();
    cycleControlMode();
  }
  if (key === "shift" && state.controlMode === "seeker") {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    tryThrowMist();
    return;
  }
  if (key === "shift" && state.controlMode === "hider") {
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    if (state.disguiseWheelOpen) {
      closeDisguiseColorWheel();
    } else {
      openDisguiseColorWheel();
    }
    return;
  }
  if (key === " " || key === "spacebar") {
    event.preventDefault();
    tryJump();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", handlePointer);
colorWheelOverlay.addEventListener("pointerdown", (event) => {
  if (event.target === colorWheelOverlay) {
    closeDisguiseColorWheel();
  }
});
colorWheel.addEventListener("click", (event) => {
  const button = event.target.closest(".color-wheel-option");
  if (!button) {
    return;
  }
  const actor = activeDisguiseActor();
  if (!actor) {
    closeDisguiseColorWheel();
    return;
  }
  setActorDisguiseColor(actor, button.dataset.colorId);
  syncColorWheelSelection(button.dataset.colorId);
  closeDisguiseColorWheel();
});

restartButton.addEventListener("click", () => {
  if (!state.playedRound) {
    state.message = "Start eerst een map of de tutorial vanuit het menu.";
    updateHud();
    return;
  }
  const config = mapConfigs[state.currentMap] || mapConfigs.plaza;
  setupRound(config, state.mode === "tutorial" ? "tutorial" : "round");
});

menuButton.addEventListener("click", () => {
  showMenu();
});

closeMenuButton.addEventListener("click", () => {
  closeModelViewer();
  hideMenu();
});

roleButton.addEventListener("click", () => {
  cycleControlMode();
});

modelViewerButton.addEventListener("click", () => {
  openModelViewer(state.viewer.currentModel);
});

closeViewerButton.addEventListener("click", () => {
  showMapPreview(state.selectedMap);
});

tutorialButton.addEventListener("click", () => {
  closeModelViewer();
  startTutorial();
});

mapButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showMapPreview(button.dataset.map);
  });
});

startMapButton.addEventListener("click", () => {
  closeModelViewer();
  startMap(state.selectedMap);
});

exploreMapButton.addEventListener("click", () => {
  closeModelViewer();
  exploreMap(state.selectedMap);
});

modelPreviewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    openModelViewer(button.dataset.preview);
  });
});

playAgainButton.addEventListener("click", () => {
  const config = mapConfigs[state.currentMap] || mapConfigs.plaza;
  setupRound(config, state.mode === "tutorial" ? "tutorial" : "round");
});

summaryMenuButton.addEventListener("click", () => {
  hideSummary();
  showMenu();
});

buildColorWheel();
resizeRenderer();
createWorldDecor(mapConfigs.plaza);
setSelectedMap(state.selectedMap);
showMapPreview(state.selectedMap);
updateRoleButton();
updateHud();
loadModelAssets();
requestAnimationFrame(tick);
