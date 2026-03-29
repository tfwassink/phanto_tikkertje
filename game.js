const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const restartButton = document.getElementById("restartButton");
const roleButton = document.getElementById("roleButton");
const menuButton = document.getElementById("menuButton");
const closeMenuButton = document.getElementById("closeMenuButton");
const tutorialButton = document.getElementById("tutorialButton");
const menuOverlay = document.getElementById("menuOverlay");
const summaryOverlay = document.getElementById("summaryOverlay");
const summaryTitle = document.getElementById("summaryTitle");
const summaryText = document.getElementById("summaryText");
const summaryStats = document.getElementById("summaryStats");
const playAgainButton = document.getElementById("playAgainButton");
const summaryMenuButton = document.getElementById("summaryMenuButton");
const mapButtons = [...document.querySelectorAll(".map-card")];

const TAU = Math.PI * 2;
const keys = new Set();
const mouse = { x: canvas.width * 0.5, y: canvas.height * 0.5 };

const world = {
  width: 2100,
  height: 1500,
  floorGrid: 160,
};

const state = {
  controlMode: "seeker",
  timeLimit: 180,
  timeLeft: 180,
  lastTime: 0,
  statusTimer: 0,
  mistCooldown: 0,
  running: false,
  winner: "",
  message: "Kies in het menu een map of start de tutorial.",
  seekerShots: [],
  mistClouds: [],
  particles: [],
  puzzlePenalty: 16,
  currentMap: "plaza",
  mode: "menu",
  stats: {
    solvedPuzzles: 0,
    taggedHiders: 0,
    roleAtStart: "hider",
  },
};

const camera = {
  x: 0,
  y: 0,
};

const seeker = {
  x: 980,
  y: 760,
  radius: 28,
  speed: 240,
  facing: 0,
  maskHue: "#ffb038",
};

const hiders = [];
const props = [];
const puzzles = [];

const propTemplates = {
  crate: { color: "#9f6c42", accent: "#d8b077", w: 56, h: 56, type: "box" },
  barrel: { color: "#7e5333", accent: "#c58b52", w: 48, h: 64, type: "round" },
  bush: { color: "#699342", accent: "#9bd061", w: 64, h: 54, type: "blob" },
  lamp: { color: "#57506b", accent: "#f2cf67", w: 34, h: 82, type: "lamp" },
  statue: { color: "#7f7d86", accent: "#c7c9d5", w: 46, h: 88, type: "tall" },
};

const mapConfigs = {
  plaza: {
    name: "Gouden Plaza",
    timeLimit: 180,
    puzzlePenalty: 16,
    seekerSpawn: { x: 980, y: 760 },
    hiderSpawns: [
      { id: "hider-1", x: 520, y: 1180, color: "#58b6ff" },
      { id: "hider-2", x: 1610, y: 1160, color: "#ff7aa2" },
      { id: "hider-3", x: 1650, y: 360, color: "#67d66d" },
    ],
    props: [
      [280, 260, "crate"], [430, 240, "statue"], [620, 300, "bush"], [770, 220, "lamp"],
      [980, 280, "barrel"], [1180, 250, "crate"], [1340, 300, "bush"], [1540, 230, "statue"],
      [1760, 280, "crate"], [1860, 420, "lamp"], [310, 520, "barrel"], [540, 610, "bush"],
      [760, 520, "crate"], [980, 580, "statue"], [1180, 500, "lamp"], [1420, 610, "bush"],
      [1680, 540, "crate"], [1860, 610, "barrel"], [290, 900, "bush"], [470, 1000, "lamp"],
      [660, 920, "crate"], [820, 1060, "statue"], [1070, 980, "barrel"], [1260, 900, "bush"],
      [1510, 1010, "crate"], [1710, 950, "statue"], [1870, 1070, "lamp"], [360, 1250, "barrel"],
      [590, 1280, "crate"], [860, 1240, "bush"], [1080, 1300, "lamp"], [1380, 1240, "barrel"],
      [1640, 1280, "crate"], [1880, 1220, "bush"],
    ],
    puzzles: [
      { id: "p1", x: 410, y: 780 },
      { id: "p2", x: 1040, y: 360 },
      { id: "p3", x: 1620, y: 800 },
      { id: "p4", x: 1220, y: 1210 },
    ],
  },
  garden: {
    name: "Misttuin",
    timeLimit: 165,
    puzzlePenalty: 14,
    seekerSpawn: { x: 1120, y: 720 },
    hiderSpawns: [
      { id: "hider-1", x: 390, y: 1100, color: "#58b6ff" },
      { id: "hider-2", x: 1780, y: 1180, color: "#ff7aa2" },
      { id: "hider-3", x: 1710, y: 290, color: "#67d66d" },
    ],
    props: [
      [240, 240, "bush"], [350, 320, "bush"], [470, 230, "crate"], [620, 280, "barrel"],
      [760, 210, "lamp"], [920, 310, "bush"], [1100, 250, "crate"], [1240, 200, "statue"],
      [1400, 320, "bush"], [1570, 240, "barrel"], [1760, 280, "crate"], [1910, 360, "lamp"],
      [250, 520, "crate"], [410, 620, "bush"], [590, 520, "lamp"], [760, 610, "barrel"],
      [950, 520, "bush"], [1120, 620, "crate"], [1310, 550, "bush"], [1490, 640, "statue"],
      [1680, 540, "bush"], [1870, 620, "crate"], [280, 900, "lamp"], [440, 1010, "bush"],
      [620, 880, "crate"], [820, 980, "bush"], [1030, 900, "barrel"], [1220, 1000, "lamp"],
      [1420, 890, "bush"], [1620, 980, "crate"], [1830, 900, "bush"], [330, 1250, "barrel"],
      [560, 1280, "bush"], [790, 1200, "crate"], [1000, 1300, "lamp"], [1220, 1220, "bush"],
      [1470, 1300, "barrel"], [1730, 1220, "crate"], [1910, 1280, "bush"],
    ],
    puzzles: [
      { id: "p1", x: 520, y: 760 },
      { id: "p2", x: 930, y: 370 },
      { id: "p3", x: 1520, y: 760 },
      { id: "p4", x: 960, y: 1180 },
      { id: "p5", x: 1710, y: 470 },
    ],
  },
};

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function createProps(layout) {
  return layout.map(([x, y, kind], index) => ({ id: `prop-${index}`, x, y, kind }));
}

function createPuzzles(layout) {
  return layout.map((puzzle) => ({ ...puzzle, progress: 0, solved: false }));
}

function createHider(id, x, y, color) {
  return {
    id,
    x,
    y,
    radius: 22,
    speed: 190,
    color,
    disguisedAs: null,
    out: false,
    aiTimer: rand(0.5, 2.5),
    targetPuzzleId: null,
    control: id === "hider-1" ? "player" : "ai",
  };
}

function showMenu() {
  menuOverlay.classList.add("visible");
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

function updateRoleButton() {
  roleButton.textContent = state.controlMode === "seeker" ? "Bestuur: Tikker" : "Bestuur: Verstopper";
}

function updateStatusPanel() {
  state.stats.solvedPuzzles = puzzles.filter((puzzle) => puzzle.solved).length;
}

function assignRandomControlRole() {
  state.controlMode = Math.random() < 0.5 ? "seeker" : "hider";
  updateRoleButton();
  return state.controlMode;
}

function setupRound(config, mode) {
  state.mode = mode;
  state.timeLimit = config.timeLimit;
  state.timeLeft = config.timeLimit;
  state.puzzlePenalty = config.puzzlePenalty;
  state.statusTimer = 0;
  state.mistCooldown = 0;
  state.running = true;
  state.winner = "";
  state.stats = {
    solvedPuzzles: 0,
    taggedHiders: 0,
    roleAtStart: "hider",
  };
  state.seekerShots = [];
  state.mistClouds = [];
  state.particles = [];

  seeker.x = config.seekerSpawn.x;
  seeker.y = config.seekerSpawn.y;
  seeker.facing = 0;

  props.splice(0, props.length, ...createProps(config.props));
  puzzles.splice(0, puzzles.length, ...createPuzzles(config.puzzles));
  hiders.splice(0, hiders.length, ...config.hiderSpawns.map((hider) => createHider(hider.id, hider.x, hider.y, hider.color)));

  const drawnRole = mode === "tutorial" ? "hider" : assignRandomControlRole();
  if (mode === "tutorial") {
    state.controlMode = "hider";
    updateRoleButton();
  }
  state.stats.roleAtStart = drawnRole;

  state.message = mode === "tutorial"
    ? "Tutorial: loop met WASD, verander met klik in een voorwerp, druk op E bij een puzzel en gooi met Shift mist als tikker."
    : drawnRole === "seeker"
      ? `Map geladen: ${config.name}. De loting zegt dat jij de tikker bent. Druk op Shift voor mist.`
      : `Map geladen: ${config.name}. De loting zegt dat jij een verstopper bent. Zoek props en puzzels.`;

  updateStatusPanel();
  hideMenu();
  hideSummary();
}

function startMap(mapId) {
  state.currentMap = mapId;
  setupRound(mapConfigs[mapId], "match");
}

function startTutorial() {
  const tutorialConfig = {
    name: "Tutorial",
    timeLimit: 999,
    puzzlePenalty: 0,
    seekerSpawn: { x: 760, y: 820 },
    hiderSpawns: [
      { id: "hider-1", x: 1120, y: 860, color: "#58b6ff" },
      { id: "hider-2", x: 1450, y: 860, color: "#ff7aa2" },
    ],
    props: [
      [620, 540, "crate"], [810, 560, "barrel"], [980, 520, "bush"], [1180, 540, "lamp"],
      [1380, 540, "statue"], [620, 980, "bush"], [820, 1020, "crate"], [1020, 980, "barrel"],
      [1240, 1000, "bush"], [1450, 980, "lamp"],
    ],
    puzzles: [
      { id: "tp1", x: 720, y: 760 },
      { id: "tp2", x: 1260, y: 760 },
    ],
  };
  setupRound(tutorialConfig, "tutorial");
}

function resetRound() {
  if (state.mode === "tutorial") {
    startTutorial();
  } else {
    startMap(state.currentMap);
  }
}

function worldToScreen(x, y) {
  return { x: x - camera.x, y: y - camera.y };
}

function screenToWorld(x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (x - rect.left) * scaleX + camera.x,
    y: (y - rect.top) * scaleY + camera.y,
  };
}

function moveEntity(entity, dx, dy, dt) {
  if (dx === 0 && dy === 0) {
    return;
  }
  const length = Math.hypot(dx, dy) || 1;
  entity.x = clamp(entity.x + (dx / length) * entity.speed * dt, 80, world.width - 80);
  entity.y = clamp(entity.y + (dy / length) * entity.speed * dt, 80, world.height - 80);
}

function getMovementInput() {
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  return {
    dx: (right ? 1 : 0) - (left ? 1 : 0),
    dy: (down ? 1 : 0) - (up ? 1 : 0),
  };
}

function getPlayerHider() {
  return hiders.find((hider) => hider.control === "player");
}

function getNearestProp(entity, maxDistance = 90) {
  let closest = null;
  let best = maxDistance;
  for (const prop of props) {
    const d = distance(entity, prop);
    if (d < best) {
      best = d;
      closest = prop;
    }
  }
  return closest;
}

function getNearestPuzzle(entity, maxDistance = 84) {
  let closest = null;
  let best = maxDistance;
  for (const puzzle of puzzles) {
    if (puzzle.solved) {
      continue;
    }
    const d = distance(entity, puzzle);
    if (d < best) {
      best = d;
      closest = puzzle;
    }
  }
  return closest;
}

function launchMist() {
  if (!state.running || state.mistCooldown > 0) {
    return;
  }
  const angle = seeker.facing;
  state.mistCooldown = 0.4;
  state.seekerShots.push({
    x: seeker.x + Math.cos(angle) * 34,
    y: seeker.y + Math.sin(angle) * 34,
    vx: Math.cos(angle) * 185,
    vy: Math.sin(angle) * 185,
    radius: 22,
    life: 0.38,
  });
}

function morphHider(hider, prop) {
  hider.disguisedAs = { id: prop.id, kind: prop.kind };
  state.message = `Verstopper veranderde in ${prop.kind}.`;
  updateStatusPanel();
}

function solvePuzzle(hider, puzzle, dt) {
  if (puzzle.solved || hider.out) {
    return;
  }
  puzzle.progress += dt;
  if (puzzle.progress >= 2.4) {
    puzzle.solved = true;
    puzzle.progress = 1;
    if (state.mode !== "tutorial") {
      state.timeLeft = Math.max(18, state.timeLeft - state.puzzlePenalty);
      state.message = `Puzzel opgelost. De tikker verloor ${state.puzzlePenalty} seconden.`;
    } else {
      state.message = "Tutorial puzzel opgelost. Mooi, je snapt het systeem.";
    }
    updateStatusPanel();
  }
}

function updateSeeker(dt) {
  if (!state.running) {
    return;
  }
  const { dx, dy } = getMovementInput();
  if (state.controlMode === "seeker") {
    moveEntity(seeker, dx, dy, dt);
    if (dx !== 0 || dy !== 0) {
      seeker.facing = Math.atan2(dy, dx);
    }
  }
}

function chooseAiPuzzle(hider) {
  const options = puzzles.filter((puzzle) => !puzzle.solved);
  if (!options.length) {
    hider.targetPuzzleId = null;
    return null;
  }
  const choice = options[Math.floor(Math.random() * options.length)];
  hider.targetPuzzleId = choice.id;
  return choice;
}

function updateAiHider(hider, dt) {
  hider.aiTimer -= dt;
  if (hider.aiTimer <= 0) {
    hider.aiTimer = rand(1.8, 3.8);
    const prop = getNearestProp(hider, 140);
    if (prop && Math.random() < 0.75) {
      morphHider(hider, prop);
    }
    chooseAiPuzzle(hider);
  }

  let targetPuzzle = puzzles.find((puzzle) => puzzle.id === hider.targetPuzzleId && !puzzle.solved);
  if (!targetPuzzle) {
    targetPuzzle = chooseAiPuzzle(hider);
  }

  if (targetPuzzle) {
    const d = distance(hider, targetPuzzle);
    if (d > 44) {
      moveEntity(hider, targetPuzzle.x - hider.x, targetPuzzle.y - hider.y, dt);
    } else {
      solvePuzzle(hider, targetPuzzle, dt * 0.65);
    }
  }
}

function updatePlayerHider(hider, dt) {
  if (state.controlMode === "hider") {
    const { dx, dy } = getMovementInput();
    moveEntity(hider, dx, dy, dt);
  }
  const nearbyPuzzle = getNearestPuzzle(hider);
  if (state.controlMode === "hider" && nearbyPuzzle && keys.has("KeyE")) {
    solvePuzzle(hider, nearbyPuzzle, dt);
  }
}

function updateHiders(dt) {
  for (const hider of hiders) {
    if (hider.out) {
      continue;
    }
    if (hider.control === "player") {
      updatePlayerHider(hider, dt);
    } else {
      updateAiHider(hider, dt);
    }
  }
}

function burstMist(shot) {
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * TAU;
    state.particles.push({
      x: shot.x,
      y: shot.y,
      vx: Math.cos(angle) * rand(30, 120),
      vy: Math.sin(angle) * rand(30, 120),
      life: rand(0.35, 0.8),
      radius: rand(10, 26),
    });
  }
  state.mistClouds.push({ x: shot.x, y: shot.y, radius: 108, life: 1.2 });
}

function tagHidersNear(x, y, radius) {
  for (const hider of hiders) {
    if (hider.out) {
      continue;
    }
    if (distance(hider, { x, y }) < radius + hider.radius) {
      hider.out = true;
      hider.disguisedAs = null;
      state.stats.taggedHiders += 1;
      state.message = `${hider.id} is getikt door de paarse mist.`;
      updateStatusPanel();
    }
  }
}

function fillSummary() {
  const mapLabel = state.mode === "tutorial" ? "Tutorial" : mapConfigs[state.currentMap].name;
  const roleLabel = state.stats.roleAtStart === "seeker" ? "Tikker" : "Verstopper";
  const remainingPuzzles = puzzles.length - state.stats.solvedPuzzles;
  const roleWon = (state.winner === "tikker" && state.stats.roleAtStart === "seeker") ||
    (state.winner === "verstoppers" && state.stats.roleAtStart === "hider");

  summaryTitle.textContent = state.mode === "tutorial"
    ? "Tutorial Klaar"
    : state.winner === "tikker"
      ? "De Tikker Wint"
      : "De Verstoppers Winnen";

  summaryText.textContent = state.mode === "tutorial"
    ? "Je tutorialronde is afgerond. Je kunt nog een keer oefenen of terug naar het menu."
    : roleWon
      ? "Mooie ronde. Jouw rol heeft gewonnen."
      : "De ronde is klaar. Jouw rol heeft deze keer niet gewonnen.";

  summaryStats.innerHTML = "";
  [
    `Map: ${mapLabel}`,
    `Jouw rol: ${roleLabel}`,
    `Puzzels opgelost: ${state.stats.solvedPuzzles}/${puzzles.length}`,
    `Verstoppers getikt: ${state.stats.taggedHiders}`,
    state.mode === "tutorial"
      ? `Tutorial status: ${state.stats.solvedPuzzles === puzzles.length ? "alles gehaald" : "nog oefenruimte"}`
      : `Puzzels nog te doen: ${remainingPuzzles}`,
    state.mode === "tutorial"
      ? "Tijd speelde hier geen rol."
      : `Resterende tijd op de klok: ${Math.ceil(state.timeLeft)} sec`,
  ].forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line;
    summaryStats.appendChild(item);
  });
}

function updateShots(dt) {
  const nextShots = [];
  for (const shot of state.seekerShots) {
    shot.life -= dt;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.radius += dt * 42;
    const hitProp = props.some((prop) => distance(shot, prop) < shot.radius + 30);
    const expired = shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > world.width || shot.y > world.height || hitProp;
    if (expired) {
      burstMist(shot);
      tagHidersNear(shot.x, shot.y, 92);
    } else {
      nextShots.push(shot);
    }
  }
  state.seekerShots = nextShots;
}

function updateMistClouds(dt) {
  for (const cloud of state.mistClouds) {
    cloud.life -= dt;
    cloud.radius *= 0.992;
    tagHidersNear(cloud.x, cloud.y, cloud.radius * 0.55);
  }
  state.mistClouds = state.mistClouds.filter((cloud) => cloud.life > 0);
}

function updateParticles(dt) {
  state.particles = state.particles.filter((particle) => {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.radius *= 0.987;
    return particle.life > 0;
  });
}

function updateCamera() {
  const focus = state.controlMode === "seeker" ? seeker : getPlayerHider() || seeker;
  camera.x = clamp(focus.x - canvas.width * 0.5, 0, world.width - canvas.width);
  camera.y = clamp(focus.y - canvas.height * 0.5, 0, world.height - canvas.height);
}

function checkWinState() {
  if (state.mode === "tutorial") {
    return;
  }
  const activeHiders = hiders.filter((hider) => !hider.out);
  if (!activeHiders.length && state.running) {
    state.running = false;
    state.winner = "tikker";
    state.message = "Alle verstoppers zijn getikt. De tikker wint.";
    fillSummary();
    showSummary();
  } else if (state.timeLeft <= 0 && state.running) {
    state.running = false;
    state.winner = "verstoppers";
    state.message = "De tijd is op. De verstoppers winnen.";
    fillSummary();
    showSummary();
  }
}

function update(dt) {
  if (!state.running) {
    updateParticles(dt);
    return;
  }
  if (state.mode !== "tutorial") {
    state.timeLeft = Math.max(0, state.timeLeft - dt);
  }
  state.statusTimer -= dt;
  state.mistCooldown = Math.max(0, state.mistCooldown - dt);
  updateSeeker(dt);
  updateHiders(dt);
  updateShots(dt);
  updateMistClouds(dt);
  updateParticles(dt);
  updateCamera();
  checkWinState();
  if (state.statusTimer <= 0) {
    state.statusTimer = 0.25;
    updateStatusPanel();
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, state.currentMap === "garden" ? "#e3efd5" : "#f3ead1");
  sky.addColorStop(0.4, state.currentMap === "garden" ? "#b6cf9f" : "#dbc89f");
  sky.addColorStop(1, state.currentMap === "garden" ? "#7c9366" : "#9b845f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const horizon = 188;
  ctx.fillStyle = state.currentMap === "garden" ? "#7e8f63" : "#c5af87";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);
  ctx.fillStyle = state.currentMap === "garden" ? "#97a97b" : "#ad8e60";
  for (let x = -world.floorGrid; x < world.width; x += world.floorGrid) {
    const sx = worldToScreen(x, 0).x;
    ctx.fillRect(sx, horizon, 2, canvas.height - horizon);
  }
  for (let y = 0; y < world.height; y += world.floorGrid) {
    const sy = worldToScreen(0, y).y;
    ctx.fillRect(0, sy, canvas.width, 2);
  }
}

function drawShadow(x, y, radiusX, radiusY, alpha = 0.18) {
  const p = worldToScreen(x, y);
  ctx.fillStyle = `rgba(41, 25, 23, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 14, radiusX, radiusY, 0, 0, TAU);
  ctx.fill();
}

function drawProp(prop) {
  const template = propTemplates[prop.kind];
  const p = worldToScreen(prop.x, prop.y);
  drawShadow(prop.x, prop.y, template.w * 0.42, 14);
  if (template.type === "box") {
    ctx.fillStyle = template.color;
    ctx.fillRect(p.x - template.w * 0.5, p.y - template.h + 8, template.w, template.h);
    ctx.strokeStyle = template.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(p.x - template.w * 0.5 + 6, p.y - template.h + 16, template.w - 12, template.h - 20);
  } else if (template.type === "round") {
    ctx.fillStyle = template.color;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 22, template.w * 0.5, template.h * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = template.accent;
    ctx.fillRect(p.x - template.w * 0.42, p.y - 40, template.w * 0.84, 10);
    ctx.fillRect(p.x - template.w * 0.42, p.y - 8, template.w * 0.84, 10);
  } else if (template.type === "blob") {
    ctx.fillStyle = template.color;
    ctx.beginPath();
    ctx.arc(p.x - 18, p.y - 20, 24, 0, TAU);
    ctx.arc(p.x + 8, p.y - 24, 28, 0, TAU);
    ctx.arc(p.x + 26, p.y - 10, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = template.accent;
    ctx.beginPath();
    ctx.arc(p.x + 10, p.y - 28, 11, 0, TAU);
    ctx.fill();
  } else if (template.type === "lamp") {
    ctx.fillStyle = template.color;
    ctx.fillRect(p.x - 6, p.y - template.h + 10, 12, template.h - 10);
    ctx.fillStyle = template.accent;
    ctx.beginPath();
    ctx.arc(p.x, p.y - template.h + 10, 16, 0, TAU);
    ctx.fill();
  } else if (template.type === "tall") {
    ctx.fillStyle = template.color;
    ctx.fillRect(p.x - template.w * 0.5, p.y - template.h + 6, template.w, template.h);
    ctx.fillStyle = template.accent;
    ctx.beginPath();
    ctx.arc(p.x, p.y - template.h + 2, 16, 0, TAU);
    ctx.fill();
  }
}

function drawPuzzle(puzzle) {
  const p = worldToScreen(puzzle.x, puzzle.y);
  drawShadow(puzzle.x, puzzle.y, 34, 12, 0.14);
  ctx.fillStyle = puzzle.solved ? "#75c36a" : "#4936a6";
  ctx.fillRect(p.x - 26, p.y - 42, 52, 42);
  ctx.fillStyle = "#efe4ff";
  ctx.fillRect(p.x - 18, p.y - 34, 36, 8);
  ctx.fillRect(p.x - 18, p.y - 18, 36 * puzzle.progress, 8);
  ctx.font = "bold 16px Georgia";
  ctx.fillText(puzzle.solved ? "OK" : "?", p.x - 8, p.y - 14);
}

function drawMask(cx, cy, scale, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = seeker.maskHue;
  ctx.beginPath();
  ctx.moveTo(-28, -4);
  ctx.quadraticCurveTo(-10, -36, 0, -34);
  ctx.quadraticCurveTo(10, -36, 28, -4);
  ctx.quadraticCurveTo(20, 28, 0, 34);
  ctx.quadraticCurveTo(-20, 28, -28, -4);
  ctx.fill();
  ctx.fillStyle = "#cf1f2e";
  ctx.beginPath();
  ctx.arc(-10, -4, 7, 0, TAU);
  ctx.arc(10, -4, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#5a2a18";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-16, 14);
  ctx.quadraticCurveTo(0, 28, 16, 14);
  ctx.stroke();
  ctx.restore();
}

function drawMistSmile(cx, cy, scale, alpha) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#e5c8ff";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, 12);
  ctx.quadraticCurveTo(0, 28, 16, 12);
  ctx.stroke();
  ctx.restore();
}

function drawSeeker() {
  const p = worldToScreen(seeker.x, seeker.y);
  drawShadow(seeker.x, seeker.y, 32, 14, 0.22);
  ctx.fillStyle = "#8247e6";
  ctx.beginPath();
  ctx.arc(p.x, p.y - 10, seeker.radius, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#f2c59c";
  ctx.beginPath();
  ctx.arc(p.x, p.y - 48, 18, 0, TAU);
  ctx.fill();
  drawMask(p.x, p.y - 48, 0.7, 1);
}

function drawHider(hider) {
  const p = worldToScreen(hider.x, hider.y);
  const showBody = !hider.disguisedAs;
  if (hider.disguisedAs) {
    const prop = props.find((item) => item.id === hider.disguisedAs.id);
    if (prop) {
      drawProp({ ...prop, x: hider.x, y: hider.y, kind: hider.disguisedAs.kind });
    }
  }
  if (showBody) {
    drawShadow(hider.x, hider.y, 24, 10, 0.18);
    ctx.fillStyle = hider.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - 12, hider.radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff6ef";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 40, 14, 0, TAU);
    ctx.fill();
  }
  if (hider.out) {
    ctx.strokeStyle = "#ff3366";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(p.x - 30, p.y - 60);
    ctx.lineTo(p.x + 30, p.y);
    ctx.moveTo(p.x + 30, p.y - 60);
    ctx.lineTo(p.x - 30, p.y);
    ctx.stroke();
  }
}

function drawShot(shot) {
  const p = worldToScreen(shot.x, shot.y);
  const gradient = ctx.createRadialGradient(p.x, p.y, 6, p.x, p.y, shot.radius * 1.9);
  gradient.addColorStop(0, "rgba(255,255,255,0.92)");
  gradient.addColorStop(0.25, "rgba(191,144,255,0.95)");
  gradient.addColorStop(1, "rgba(104,35,198,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, shot.radius * 1.9, 0, TAU);
  ctx.fill();
  drawMistSmile(p.x, p.y, 0.52 + shot.radius * 0.008, 0.95);
}

function drawParticle(particle) {
  const p = worldToScreen(particle.x, particle.y);
  ctx.fillStyle = `rgba(139, 77, 255, ${particle.life})`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, particle.radius, 0, TAU);
  ctx.fill();
  drawMistSmile(p.x, p.y, particle.radius * 0.014, particle.life * 0.6);
}

function drawMistCloud(cloud) {
  const p = worldToScreen(cloud.x, cloud.y);
  const alpha = cloud.life / 1.2;
  const gradient = ctx.createRadialGradient(p.x, p.y, 12, p.x, p.y, cloud.radius);
  gradient.addColorStop(0, `rgba(242, 224, 255, ${0.55 * alpha})`);
  gradient.addColorStop(0.35, `rgba(162, 89, 255, ${0.45 * alpha})`);
  gradient.addColorStop(1, "rgba(104,35,198,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, cloud.radius, 0, TAU);
  ctx.fill();
  drawMistSmile(p.x, p.y, 1.05 + (1 - alpha) * 0.22, 0.55 * alpha);
}

function drawWorld() {
  drawBackground();
  const drawables = [];
  props.forEach((prop) => drawables.push({ y: prop.y, fn: () => drawProp(prop) }));
  puzzles.forEach((puzzle) => drawables.push({ y: puzzle.y, fn: () => drawPuzzle(puzzle) }));
  hiders.forEach((hider) => drawables.push({ y: hider.y, fn: () => drawHider(hider) }));
  drawables.push({ y: seeker.y, fn: drawSeeker });
  state.seekerShots.forEach((shot) => drawables.push({ y: shot.y, fn: () => drawShot(shot) }));
  state.mistClouds.forEach((cloud) => drawables.push({ y: cloud.y, fn: () => drawMistCloud(cloud) }));
  state.particles.forEach((particle) => drawables.push({ y: particle.y, fn: () => drawParticle(particle) }));
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((item) => item.fn());
}

function drawHud() {
  ctx.fillStyle = "rgba(28, 20, 35, 0.68)";
  ctx.fillRect(18, 18, 450, 118);
  ctx.fillStyle = "#fff8ef";
  ctx.font = "bold 34px Georgia";
  ctx.fillText(state.mode === "tutorial" ? "Tutorial" : `Tijd: ${Math.ceil(state.timeLeft)}`, 34, 56);
  ctx.font = "18px Georgia";
  ctx.fillText(`Map: ${state.mode === "tutorial" ? "Leerzone" : mapConfigs[state.currentMap].name}`, 34, 86);
  ctx.fillText(`Bestuurd: ${state.controlMode === "seeker" ? "Tikker" : "Verstopper"}`, 34, 112);
  ctx.textAlign = "right";
  ctx.fillText(`Verstoppers over: ${hiders.filter((hider) => !hider.out).length}`, canvas.width - 30, 48);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255, 249, 242, 0.9)";
  ctx.fillRect(18, canvas.height - 92, canvas.width - 36, 58);
  ctx.fillStyle = "#271b29";
  ctx.font = "18px Georgia";
  ctx.fillText(state.message, 34, canvas.height - 56);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld();
  drawHud();
}

function frame(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }
  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (event.code === "Tab") {
    event.preventDefault();
    state.controlMode = state.controlMode === "seeker" ? "hider" : "seeker";
    state.message = state.controlMode === "seeker"
      ? "Je bestuurt nu de tikker. Druk op Shift voor mist."
      : "Je bestuurt nu de verstopper. Klik op een voorwerp om te veranderen.";
    updateRoleButton();
    updateStatusPanel();
  } else if ((event.code === "ShiftLeft" || event.code === "ShiftRight") && state.controlMode === "seeker") {
    event.preventDefault();
    launchMist();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = event.clientX - rect.left;
  mouse.y = event.clientY - rect.top;
});

canvas.addEventListener("click", (event) => {
  if (state.controlMode !== "hider" || !state.running) {
    return;
  }
  const point = screenToWorld(event.clientX, event.clientY);
  const hider = getPlayerHider();
  if (!hider || hider.out) {
    return;
  }
  let clickedProp = null;
  let best = 42;
  for (const prop of props) {
    const d = Math.hypot(prop.x - point.x, prop.y - point.y);
    if (d < best && distance(hider, prop) < 110) {
      best = d;
      clickedProp = prop;
    }
  }
  if (clickedProp) {
    morphHider(hider, clickedProp);
  } else {
    state.message = "Klik dichter op een voorwerp in de buurt van je verstopper om te veranderen.";
  }
});

restartButton.addEventListener("click", () => {
  if (state.mode === "menu") {
    showMenu();
    return;
  }
  resetRound();
  state.lastTime = 0;
});

roleButton.addEventListener("click", () => {
  state.controlMode = state.controlMode === "seeker" ? "hider" : "seeker";
  state.message = state.controlMode === "seeker"
    ? "Je bestuurt nu de tikker. Druk op Shift voor mist."
    : "Je bestuurt nu de verstopper. Klik op een voorwerp om te veranderen.";
  updateRoleButton();
  updateStatusPanel();
});

menuButton.addEventListener("click", showMenu);
closeMenuButton.addEventListener("click", hideMenu);
tutorialButton.addEventListener("click", () => {
  state.currentMap = "plaza";
  startTutorial();
});
playAgainButton.addEventListener("click", () => {
  hideSummary();
  resetRound();
  state.lastTime = 0;
});
summaryMenuButton.addEventListener("click", () => {
  hideSummary();
  showMenu();
});
mapButtons.forEach((button) => {
  button.addEventListener("click", () => startMap(button.dataset.map));
});
hideSummary();
updateRoleButton();
requestAnimationFrame(frame);
