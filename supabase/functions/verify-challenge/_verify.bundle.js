// GERADO por scripts/build-edge.mjs — NÃO editar à mão. Rode `npm run build:edge`.

// src/core/sim/hitbox.ts
function aabb(halfW, halfH) {
  return { kind: "aabb", halfW, halfH };
}
function circle(radius) {
  return { kind: "circle", radius };
}
function cloneHitbox(h) {
  switch (h.kind) {
    case "aabb":
      return { kind: "aabb", halfW: h.halfW, halfH: h.halfH };
    case "circle":
      return { kind: "circle", radius: h.radius };
    case "polygon":
      return { kind: "polygon", points: h.points.map((p) => ({ x: p.x, y: p.y })) };
  }
}
function polygon(points) {
  return { kind: "polygon", points: points.map((p) => ({ x: p.x, y: p.y })) };
}
function rightExtent(h) {
  switch (h.kind) {
    case "aabb":
      return h.halfW;
    case "circle":
      return h.radius;
    case "polygon": {
      let maxX = -Infinity;
      for (const p of h.points) if (p.x > maxX) maxX = p.x;
      return maxX;
    }
  }
}
function boundsOf(h) {
  switch (h.kind) {
    case "aabb":
      return { minX: -h.halfW, maxX: h.halfW, minY: -h.halfH, maxY: h.halfH };
    case "circle":
      return { minX: -h.radius, maxX: h.radius, minY: -h.radius, maxY: h.radius };
    case "polygon": {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of h.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, maxX, minY, maxY };
    }
  }
}

// src/core/sim/constants.ts
var FIXED_DT = 1 / 60;
var WORLD_HEIGHT = 180;
var START_Y = WORLD_HEIGHT / 2;
var GRAVITY = 540;
var FLAP_SPEED = 170;
var SCROLL_SPEED = 120;
var PTERODACTYL_HITBOX = aabb(10, 8);
var DEFAULT_WORLD_CONFIG = {
  worldHeight: WORLD_HEIGHT,
  gravity: GRAVITY,
  flapSpeed: FLAP_SPEED,
  scrollSpeed: SCROLL_SPEED,
  startY: START_Y,
  pterodactylHitbox: PTERODACTYL_HITBOX
};
var SPAWN_LOOKAHEAD = 400;
var CULL_MARGIN = 100;
var NEAR_MISS_MARGIN = 12;

// src/core/rng/mulberry32.ts
var MULBERRY32_INCREMENT = 1831565813;
function scramble(state) {
  let t = state;
  t = Math.imul(t ^ t >>> 15, 1 | t);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return (t ^ t >>> 14) >>> 0;
}
function xmur3Hash(input) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

// src/core/rng/rng.ts
var UINT32 = 4294967296;
function hashSeed(seed) {
  return xmur3Hash(String(seed));
}
var Mulberry32Rng = class _Mulberry32Rng {
  seed;
  _state;
  constructor(seed, state) {
    this.seed = seed;
    this._state = state | 0;
  }
  get state() {
    return this._state >>> 0;
  }
  nextUint32() {
    this._state = this._state + MULBERRY32_INCREMENT | 0;
    return scramble(this._state);
  }
  next() {
    return this.nextUint32() / UINT32;
  }
  range(min, max) {
    if (min >= max) return min;
    return min + this.next() * (max - min);
  }
  int(min, max) {
    if (min >= max) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick(array) {
    if (array.length === 0) throw new Error("pick: array vazio");
    return array[this.int(0, array.length - 1)];
  }
  fork(streamId) {
    const childSeed = `${this.seed}::${streamId}`;
    return new _Mulberry32Rng(childSeed, hashSeed(childSeed));
  }
  clone() {
    return new _Mulberry32Rng(this.seed, this._state);
  }
};
function createRng(seed) {
  const normalized = String(seed);
  return new Mulberry32Rng(normalized, hashSeed(normalized));
}

// src/core/spawn/catalog.ts
var OBSTACLE_CATALOG = [
  // Tronco subindo do chão.
  { id: "obstacle.tree", anchor: "floor", makeHitbox: (rng) => aabb(6, rng.range(24, 40)) },
  // Cipó pendendo do teto.
  { id: "obstacle.vine", anchor: "ceiling", makeHitbox: (rng) => aabb(4, rng.range(20, 34)) },
  // Pedregulho flutuante.
  { id: "obstacle.boulder", anchor: "floating", makeHitbox: (rng) => circle(rng.range(10, 18)) },
  // Estalactite: triângulo convexo apontando para baixo (ápice embaixo).
  {
    id: "obstacle.stalactite",
    anchor: "ceiling",
    makeHitbox: (rng) => {
      const halfW = rng.range(8, 14);
      const halfH = rng.range(11, 18);
      return polygon([
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
        { x: 0, y: halfH }
      ]);
    }
  }
];
var COLLECTIBLE_CATALOG = [
  // Pássaro-moeda flutuante (comida). Corpo compacto ⇒ hitbox circular.
  { id: "bird.coin", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) }
];

// src/core/spawn/generator.ts
function noScale(_x) {
  return 1;
}
function placeY(anchor, hitbox, config, rng) {
  const b = boundsOf(hitbox);
  const m = config.yMargin;
  switch (anchor) {
    case "floor":
      return config.worldHeight - m - b.maxY;
    case "ceiling":
      return m - b.minY;
    case "floating": {
      const lo = m - b.minY;
      const hi = config.worldHeight - m - b.maxY;
      const t = rng.next();
      return hi > lo ? lo + t * (hi - lo) : (lo + hi) / 2;
    }
  }
}
var SpawnGenerator = class _SpawnGenerator {
  rng;
  config;
  catalog;
  entityType;
  gapScale;
  nextSpawnX;
  nextId;
  constructor(rng, config, catalog = OBSTACLE_CATALOG, entityType = "obstacle", gapScale = noScale) {
    this.rng = rng;
    this.config = config;
    this.catalog = catalog;
    this.entityType = entityType;
    this.gapScale = gapScale;
    this.nextSpawnX = config.startX;
    this.nextId = 0;
  }
  /** Empurra em `sink` toda entidade com spawnX <= upToX (ordem de x crescente). */
  generateUpTo(upToX, sink) {
    while (this.nextSpawnX <= upToX) {
      const type = this.rng.pick(this.catalog);
      const hitbox = type.makeHitbox(this.rng);
      const y = placeY(type.anchor, hitbox, this.config, this.rng);
      sink.push({
        id: this.nextId,
        type: this.entityType,
        tags: [type.id],
        transform: { position: { x: this.nextSpawnX, y } },
        kinematics: { velocity: { x: 0, y: 0 } },
        hitbox
      });
      this.nextId += 1;
      const s = this.gapScale(this.nextSpawnX);
      this.nextSpawnX += this.rng.range(this.config.gapMin * s, this.config.gapMax * s);
    }
  }
  /** Cópia independente (rng clonado + cursor). Para cloneWorld/snapshots. */
  clone() {
    const c = new _SpawnGenerator(
      this.rng.clone(),
      this.config,
      this.catalog,
      this.entityType,
      this.gapScale
    );
    c.nextSpawnX = this.nextSpawnX;
    c.nextId = this.nextId;
    return c;
  }
};

// src/core/spawn/constants.ts
var SPAWN_START_X = 200;
var SPAWN_GAP_MIN = 120;
var SPAWN_GAP_MAX = 220;
var SPAWN_Y_MARGIN = 8;
var DEFAULT_SPAWN_CONFIG = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: SPAWN_START_X,
  gapMin: SPAWN_GAP_MIN,
  gapMax: SPAWN_GAP_MAX
});
var COLLECTIBLE_START_X = 150;
var COLLECTIBLE_GAP_MIN = 90;
var COLLECTIBLE_GAP_MAX = 160;
var DEFAULT_COLLECTIBLE_CONFIG = Object.freeze({
  worldHeight: WORLD_HEIGHT,
  yMargin: SPAWN_Y_MARGIN,
  startX: COLLECTIBLE_START_X,
  gapMin: COLLECTIBLE_GAP_MIN,
  gapMax: COLLECTIBLE_GAP_MAX
});

// src/core/difficulty/constants.ts
var SPEED_SCALE_MAX = 2;
var SPEED_HALF_DISTANCE = 3e3;
var GAP_SCALE_MIN = 0.6;
var GAP_HALF_DISTANCE = 3e3;
var DISTANCE_PER_LEVEL = 500;

// src/core/difficulty/curve.ts
function levelForDistance(distance) {
  const d = distance > 0 ? distance : 0;
  return 1 + Math.floor(d / DISTANCE_PER_LEVEL);
}
function difficultyAt(distance) {
  const d = distance > 0 ? distance : 0;
  const speedT = d / (d + SPEED_HALF_DISTANCE);
  const gapT = d / (d + GAP_HALF_DISTANCE);
  return {
    level: levelForDistance(d),
    speedScale: 1 + (SPEED_SCALE_MAX - 1) * speedT,
    gapScale: 1 - (1 - GAP_SCALE_MIN) * gapT
  };
}

// src/core/powerup/effects.ts
function activateEffect(effects, kind, durationSteps) {
  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];
    if (e.kind === kind) {
      if (durationSteps > e.remaining) e.remaining = durationSteps;
      return;
    }
  }
  effects.push({ kind, remaining: durationSteps });
}
function tickEffects(effects) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.remaining -= 1;
    if (e.remaining <= 0) effects.splice(i, 1);
  }
}
function isEffectActive(effects, kind) {
  for (let i = 0; i < effects.length; i++) {
    if (effects[i].kind === kind) return true;
  }
  return false;
}

// src/core/powerup/catalog.ts
var POWERUP_CATALOG = [
  { id: "powerup.shield", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: "powerup.extraLife", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: "powerup.magnet", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: "powerup.doubleCoin", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) },
  { id: "powerup.slowMo", anchor: "floating", makeHitbox: (rng) => circle(rng.range(7, 9)) }
];
var KIND_BY_TAG = {
  "powerup.shield": "shield",
  "powerup.extraLife": "extraLife",
  "powerup.magnet": "magnet",
  "powerup.doubleCoin": "doubleCoin",
  "powerup.slowMo": "slowMo"
};
function powerupKindForTag(tag) {
  return KIND_BY_TAG[tag] ?? null;
}
var DEFAULT_POWERUP_CONFIG = Object.freeze({
  worldHeight: 0,
  // sobrescrito por createWorld
  yMargin: 24,
  startX: 320,
  gapMin: 600,
  gapMax: 1e3
});

// src/core/powerup/constants.ts
var SHIELD_DURATION_STEPS = 300;
var MAGNET_DURATION_STEPS = 360;
var DOUBLE_COIN_DURATION_STEPS = 480;
var EXTRA_LIFE_GRACE_STEPS = 60;
var SLOW_MO_DURATION_STEPS = 180;
var MAGNET_RADIUS = 60;
var MAGNET_PULL_SPEED = 220;
var DOUBLE_COIN_FOOD_GAIN = 2;

// src/core/powerup/apply.ts
function durationFor(kind) {
  switch (kind) {
    case "shield":
      return SHIELD_DURATION_STEPS;
    case "magnet":
      return MAGNET_DURATION_STEPS;
    case "doubleCoin":
      return DOUBLE_COIN_DURATION_STEPS;
    case "slowMo":
      return SLOW_MO_DURATION_STEPS;
  }
}
function pickupPowerup(world, entity) {
  const i = world.powerups.indexOf(entity);
  if (i < 0) return false;
  const kind = powerupKindForTag(entity.tags[0] ?? "");
  world.powerups.splice(i, 1);
  if (kind === null) return true;
  if (kind === "extraLife") {
    world.extraLives += 1;
  } else {
    activateEffect(world.effects, kind, durationFor(kind));
  }
  return true;
}
function applyMagnet(world) {
  const p = world.pterodactyl.transform.position;
  const pullStep = MAGNET_PULL_SPEED * FIXED_DT;
  const cols = world.collectibles;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i].transform.position;
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0 && dist <= MAGNET_RADIUS) {
      const move = dist < pullStep ? dist : pullStep;
      c.x += dx / dist * move;
      c.y += dy / dist * move;
    }
  }
}
function killOrRevive(world) {
  if (world.extraLives > 0) {
    world.extraLives -= 1;
    const ptero = world.pterodactyl;
    ptero.transform.position.y = world.worldHeight / 2;
    ptero.kinematics.velocity.y = 0;
    activateEffect(world.effects, "shield", EXTRA_LIFE_GRACE_STEPS);
    return;
  }
  world.alive = false;
}

// src/core/weather/constants.ts
var WEATHER_WARMUP_DISTANCE = 600;
var WEATHER_SEGMENT_MIN = 800;
var WEATHER_SEGMENT_MAX = 1600;
var RAIN_GRAVITY_SCALE = 1.15;
var WIND_UPDRAFT = -120;
var STORM_GRAVITY_SCALE = 1.25;
var STORM_DOWNDRAFT = 90;
var SNOW_GRAVITY_SCALE = 0.8;

// src/core/weather/catalog.ts
var WEATHER_KINDS = ["clear", "rain", "wind", "storm", "snow"];
var WEATHER_PICK_CATALOG = WEATHER_KINDS;
var WEATHER_PHYSICS = Object.freeze({
  clear: Object.freeze({ gravityScale: 1, windY: 0 }),
  rain: Object.freeze({ gravityScale: RAIN_GRAVITY_SCALE, windY: 0 }),
  wind: Object.freeze({ gravityScale: 1, windY: WIND_UPDRAFT }),
  storm: Object.freeze({ gravityScale: STORM_GRAVITY_SCALE, windY: STORM_DOWNDRAFT }),
  snow: Object.freeze({ gravityScale: SNOW_GRAVITY_SCALE, windY: 0 })
});
function weatherPhysics(kind) {
  return WEATHER_PHYSICS[kind];
}

// src/core/weather/generator.ts
var DEFAULT_WEATHER_CONFIG = Object.freeze({
  warmupDistance: WEATHER_WARMUP_DISTANCE,
  segmentMin: WEATHER_SEGMENT_MIN,
  segmentMax: WEATHER_SEGMENT_MAX
});
var WeatherGenerator = class _WeatherGenerator {
  rng;
  config;
  currentKind;
  nextChangeX;
  constructor(rng, config = DEFAULT_WEATHER_CONFIG) {
    this.rng = rng;
    this.config = config;
    this.currentKind = "clear";
    this.nextChangeX = config.warmupDistance;
  }
  get current() {
    return this.currentKind;
  }
  /** Avança o cursor até `distance`, atualizando o clima corrente. Monótona quando `distance`
   * não recua; alocação-zero (só escalares + pick/range). */
  advanceTo(distance) {
    while (distance >= this.nextChangeX) {
      this.currentKind = this.rng.pick(WEATHER_PICK_CATALOG);
      this.nextChangeX += this.rng.range(this.config.segmentMin, this.config.segmentMax);
    }
  }
  /** Cópia independente (rng clonado + cursor + kind). Para cloneWorld/snapshots. */
  clone() {
    const c = new _WeatherGenerator(this.rng.clone(), this.config);
    c.currentKind = this.currentKind;
    c.nextChangeX = this.nextChangeX;
    return c;
  }
};

// src/core/dino/catalog.ts
var HEAD_START_SHIELD_STEPS = 180;
var NEUTRAL = { magnetAlways: false, foodMultiplier: 1, startExtraLives: 0, startShieldSteps: 0 };
var TRAIT_CATALOG = Object.freeze({
  none: Object.freeze({ ...NEUTRAL }),
  magnet: Object.freeze({ ...NEUTRAL, magnetAlways: true }),
  doubleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 2 }),
  tripleFood: Object.freeze({ ...NEUTRAL, foodMultiplier: 3 }),
  startLife: Object.freeze({ ...NEUTRAL, startExtraLives: 1 }),
  headStart: Object.freeze({ ...NEUTRAL, startShieldSteps: HEAD_START_SHIELD_STEPS })
});
var DINO_TRAITS = Object.freeze([
  "none",
  "magnet",
  "doubleFood",
  "tripleFood",
  "startLife",
  "headStart"
]);
function traitModifiers(trait) {
  return TRAIT_CATALOG[trait];
}

// src/core/sim/world.ts
var OBSTACLE_GAP_SCALE = (x) => difficultyAt(x).gapScale;
function buildSpawner(seed, worldHeight, override, gapScale) {
  const config = { ...DEFAULT_SPAWN_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork("obstacles"), config, void 0, void 0, gapScale);
}
function buildCollectibleSpawner(seed, worldHeight, override) {
  const config = { ...DEFAULT_COLLECTIBLE_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork("collectibles"), config, COLLECTIBLE_CATALOG, "collectible");
}
function buildPowerupSpawner(seed, worldHeight, override) {
  const config = { ...DEFAULT_POWERUP_CONFIG, ...override, worldHeight };
  return new SpawnGenerator(createRng(seed).fork("powerups"), config, POWERUP_CATALOG, "collectible");
}
function buildWeatherGenerator(seed) {
  return new WeatherGenerator(createRng(seed).fork("weather"));
}
function createWorld(config = {}) {
  const c = { ...DEFAULT_WORLD_CONFIG, ...config };
  const difficultyEnabled = config.difficulty ?? true;
  const gapScale = difficultyEnabled ? OBSTACLE_GAP_SCALE : void 0;
  const spawner = config.seed === void 0 ? null : buildSpawner(config.seed, c.worldHeight, config.spawn, gapScale);
  const collectibleSpawner = config.seed === void 0 ? null : buildCollectibleSpawner(config.seed, c.worldHeight, config.collectibleSpawn);
  const powerupSpawner = config.seed === void 0 ? null : buildPowerupSpawner(config.seed, c.worldHeight, config.powerupSpawn);
  const weatherEnabled = config.weather ?? true;
  const weatherGenerator = config.seed === void 0 || !weatherEnabled ? null : buildWeatherGenerator(config.seed);
  const trait = config.trait ?? "none";
  const mods = traitModifiers(trait);
  const effects = [];
  if (mods.startShieldSteps > 0) activateEffect(effects, "shield", mods.startShieldSteps);
  return {
    tick: 0,
    distance: 0,
    food: 0,
    nearMisses: 0,
    score: 0,
    scoreMultiplier: 1,
    alive: true,
    lastFlap: false,
    scrollSpeed: c.scrollSpeed,
    baseScrollSpeed: c.scrollSpeed,
    level: 1,
    difficultyEnabled,
    gravity: c.gravity,
    flapSpeed: c.flapSpeed,
    worldHeight: c.worldHeight,
    pterodactyl: {
      transform: { position: { x: 0, y: c.startY } },
      kinematics: { velocity: { x: 0, y: 0 } },
      hitbox: cloneHitbox(c.pterodactylHitbox)
    },
    obstacles: [],
    collectibles: [],
    spawner,
    collectibleSpawner,
    powerups: [],
    powerupSpawner,
    effects,
    extraLives: mods.startExtraLives,
    weather: "clear",
    weatherGenerator,
    trait
  };
}

// src/core/sim/collect.ts
function collect(world, entity) {
  const i = world.collectibles.indexOf(entity);
  if (i < 0) return false;
  world.collectibles.splice(i, 1);
  const base = isEffectActive(world.effects, "doubleCoin") ? DOUBLE_COIN_FOOD_GAIN : 1;
  world.food += base * traitModifiers(world.trait).foodMultiplier;
  return true;
}

// src/core/collision/overlap.ts
function overlaps(ha, pa, hb, pb) {
  if (ha.kind === "aabb" && hb.kind === "aabb") {
    return Math.abs(pa.x - pb.x) <= ha.halfW + hb.halfW && Math.abs(pa.y - pb.y) <= ha.halfH + hb.halfH;
  }
  if (ha.kind === "circle" && hb.kind === "circle") {
    const dx = pa.x - pb.x;
    const dy = pa.y - pb.y;
    const r = ha.radius + hb.radius;
    return dx * dx + dy * dy <= r * r;
  }
  if (ha.kind === "aabb" && hb.kind === "circle") return aabbCircle(ha, pa, hb, pb);
  if (ha.kind === "circle" && hb.kind === "aabb") return aabbCircle(hb, pb, ha, pa);
  return satOverlap(ha, pa, hb, pb);
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function aabbCircle(box, pBox, circ, pCirc) {
  const nx = clamp(pCirc.x, pBox.x - box.halfW, pBox.x + box.halfW);
  const ny = clamp(pCirc.y, pBox.y - box.halfH, pBox.y + box.halfH);
  const dx = pCirc.x - nx;
  const dy = pCirc.y - ny;
  return dx * dx + dy * dy <= circ.radius * circ.radius;
}
function satOverlap(ha, pa, hb, pb) {
  if (edgeAxesSeparate(ha, pa, hb, pb)) return false;
  if (edgeAxesSeparate(hb, pb, ha, pa)) return false;
  if (ha.kind === "circle" && circleVertexAxisSeparates(ha, pa, hb, pb)) return false;
  if (hb.kind === "circle" && circleVertexAxisSeparates(hb, pb, ha, pa)) return false;
  return true;
}
function edgeAxesSeparate(host, pHost, other, pOther) {
  switch (host.kind) {
    case "circle":
      return false;
    // sem arestas
    case "aabb":
      return axisSeparates(1, 0, host, pHost, other, pOther) || axisSeparates(0, 1, host, pHost, other, pOther);
    case "polygon": {
      const pts = host.points;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        if (axisSeparates(-(b.y - a.y), b.x - a.x, host, pHost, other, pOther)) return true;
      }
      return false;
    }
  }
}
function circleVertexAxisSeparates(circ, pCirc, other, pOther) {
  if (other.kind !== "polygon") return false;
  let best = Infinity;
  let nx = 0;
  let ny = 0;
  for (const pt of other.points) {
    const wx = pOther.x + pt.x;
    const wy = pOther.y + pt.y;
    const dx = wx - pCirc.x;
    const dy = wy - pCirc.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      nx = pCirc.x - wx;
      ny = pCirc.y - wy;
    }
  }
  if (nx === 0 && ny === 0) return false;
  return axisSeparates(nx, ny, circ, pCirc, other, pOther);
}
function axisSeparates(ax, ay, ha, pa, hb, pb) {
  const aMin = projectMin(ha, pa, ax, ay);
  const aMax = projectMax(ha, pa, ax, ay);
  const bMin = projectMin(hb, pb, ax, ay);
  const bMax = projectMax(hb, pb, ax, ay);
  return aMax < bMin || bMax < aMin;
}
function projectMin(h, p, ax, ay) {
  const c = p.x * ax + p.y * ay;
  switch (h.kind) {
    case "aabb":
      return c - (Math.abs(ax) * h.halfW + Math.abs(ay) * h.halfH);
    case "circle":
      return c - h.radius * Math.sqrt(ax * ax + ay * ay);
    case "polygon": {
      let min = Infinity;
      for (const pt of h.points) {
        const proj = (p.x + pt.x) * ax + (p.y + pt.y) * ay;
        if (proj < min) min = proj;
      }
      return min;
    }
  }
}
function projectMax(h, p, ax, ay) {
  const c = p.x * ax + p.y * ay;
  switch (h.kind) {
    case "aabb":
      return c + (Math.abs(ax) * h.halfW + Math.abs(ay) * h.halfH);
    case "circle":
      return c + h.radius * Math.sqrt(ax * ax + ay * ay);
    case "polygon": {
      let max = -Infinity;
      for (const pt of h.points) {
        const proj = (p.x + pt.x) * ax + (p.y + pt.y) * ay;
        if (proj > max) max = proj;
      }
      return max;
    }
  }
}

// src/core/economy/constants.ts
var DISTANCE_SCORE_WEIGHT = 1;
var FOOD_SCORE_VALUE = 10;
var NEAR_MISS_SCORE_VALUE = 5;

// src/core/economy/score.ts
function scoreDelta(distanceDelta, foodDelta, nearMissDelta, multiplier) {
  const base = distanceDelta * DISTANCE_SCORE_WEIGHT + foodDelta * FOOD_SCORE_VALUE + nearMissDelta * NEAR_MISS_SCORE_VALUE;
  return base * multiplier;
}

// src/core/sim/step.ts
function step(world, input) {
  if (!world.alive) return;
  world.tick += 1;
  const traitMods = traitModifiers(world.trait);
  if (world.weatherGenerator) {
    world.weatherGenerator.advanceTo(world.distance);
    world.weather = world.weatherGenerator.current;
  }
  const weather = weatherPhysics(world.weather);
  const ptero = world.pterodactyl;
  const vel = ptero.kinematics.velocity;
  const pos = ptero.transform.position;
  if (input.flap && !world.lastFlap) {
    vel.y = -world.flapSpeed;
  }
  world.lastFlap = input.flap;
  vel.y += (world.gravity * weather.gravityScale + weather.windY) * FIXED_DT;
  pos.y += vel.y * FIXED_DT;
  const dx = world.scrollSpeed * FIXED_DT;
  pos.x += dx;
  world.distance += dx;
  const foodBefore = world.food;
  const nearMissBefore = world.nearMisses;
  if (world.difficultyEnabled) {
    const d = difficultyAt(world.distance);
    world.scrollSpeed = world.baseScrollSpeed * d.speedScale;
    world.level = d.level;
  }
  const halfH = ptero.hitbox.kind === "aabb" ? ptero.hitbox.halfH : 0;
  if (pos.y - halfH < 0) {
    pos.y = halfH;
    vel.y = 0;
  }
  if (pos.y + halfH >= world.worldHeight) {
    if (world.extraLives > 0) {
      killOrRevive(world);
    } else {
      pos.y = world.worldHeight - halfH;
      killOrRevive(world);
    }
  }
  if (world.spawner) {
    world.spawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.obstacles);
    const cullX = pos.x - CULL_MARGIN;
    const obs = world.obstacles;
    while (obs.length > 0 && obs[0].transform.position.x + rightExtent(obs[0].hitbox) < cullX) {
      obs.shift();
    }
  }
  if (world.collectibleSpawner) {
    world.collectibleSpawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.collectibles);
    const cullX = pos.x - CULL_MARGIN;
    const cols = world.collectibles;
    while (cols.length > 0 && cols[0].transform.position.x + rightExtent(cols[0].hitbox) < cullX) {
      cols.shift();
    }
  }
  if (world.powerupSpawner) {
    world.powerupSpawner.generateUpTo(world.distance + SPAWN_LOOKAHEAD, world.powerups);
    const cullX = pos.x - CULL_MARGIN;
    const pw = world.powerups;
    while (pw.length > 0 && pw[0].transform.position.x + rightExtent(pw[0].hitbox) < cullX) {
      pw.shift();
    }
  }
  if (world.alive) {
    const dinoHalfW = rightExtent(ptero.hitbox);
    const dinoHalfH = ptero.hitbox.kind === "aabb" ? ptero.hitbox.halfH : 0;
    const dinoLeft = pos.x - dinoHalfW;
    const obstacles = world.obstacles;
    let shielded = isEffectActive(world.effects, "shield");
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const oPos = o.transform.position;
      if (overlaps(ptero.hitbox, pos, o.hitbox, oPos)) {
        if (!shielded) {
          killOrRevive(world);
          if (!world.alive) break;
          shielded = true;
        }
      }
      const obsRight = oPos.x + rightExtent(o.hitbox);
      if (dinoLeft - dx <= obsRight && obsRight < dinoLeft) {
        const ob = boundsOf(o.hitbox);
        const obsTop = oPos.y + ob.minY;
        const obsBot = oPos.y + ob.maxY;
        const gap = Math.max(0, Math.max(pos.y - dinoHalfH - obsBot, obsTop - (pos.y + dinoHalfH)));
        if (gap > 0 && gap <= NEAR_MISS_MARGIN) world.nearMisses += 1;
      }
    }
  }
  if (world.alive && (traitMods.magnetAlways || isEffectActive(world.effects, "magnet"))) applyMagnet(world);
  if (world.alive) {
    const collectibles = world.collectibles;
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const c = collectibles[i];
      if (overlaps(ptero.hitbox, pos, c.hitbox, c.transform.position)) {
        collect(world, c);
      }
    }
  }
  if (world.alive) {
    const powerups = world.powerups;
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      if (overlaps(ptero.hitbox, pos, p.hitbox, p.transform.position)) {
        pickupPowerup(world, p);
      }
    }
  }
  world.score += scoreDelta(dx, world.food - foodBefore, world.nearMisses - nearMissBefore, world.scoreMultiplier);
  tickEffects(world.effects);
}

// src/core/replay/simulate.ts
function simulate(config, timeline) {
  const world = createWorld(config);
  for (const frame of timeline) step(world, frame);
  return world;
}

// src/core/replay/hash.ts
var FLOAT_BUF = new ArrayBuffer(8);
var FLOAT_VIEW = new DataView(FLOAT_BUF);
function mixLane(h, w, prime) {
  const x = Math.imul(h ^ w, prime);
  return (x << 13 | x >>> 19) >>> 0;
}
function avalanche(h) {
  let x = h >>> 0;
  x = Math.imul(x ^ x >>> 16, 2246822507);
  x = Math.imul(x ^ x >>> 13, 3266489909);
  x ^= x >>> 16;
  return x >>> 0;
}
function word8(n) {
  return (n >>> 0).toString(16).padStart(8, "0");
}
var Digest = class {
  h0 = 2166136261 | 0;
  h1 = 2654435769 | 0;
  h2 = 2246822507 | 0;
  h3 = 3266489909 | 0;
  /** Absorve uma palavra (int32 bit-a-bit). */
  word(w) {
    const x = w | 0;
    this.h0 = mixLane(this.h0, x, 16777619);
    this.h1 = mixLane(this.h1, x, 2246822519);
    this.h2 = mixLane(this.h2, x, 3266489917);
    this.h3 = mixLane(this.h3, x, 668265263);
  }
  /** Absorve um float pelos seus 64 bits IEEE-754 (LE). Normaliza -0 → +0. */
  number(n) {
    FLOAT_VIEW.setFloat64(0, n === 0 ? 0 : n, true);
    this.word(FLOAT_VIEW.getUint32(0, true));
    this.word(FLOAT_VIEW.getUint32(4, true));
  }
  bool(b) {
    this.word(b ? 1 : 0);
  }
  string(s) {
    this.word(s.length);
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
  }
  hex() {
    return word8(avalanche(this.h0)) + word8(avalanche(this.h1)) + word8(avalanche(this.h2)) + word8(avalanche(this.h3));
  }
};
function encodeVec2(d, v) {
  d.number(v.x);
  d.number(v.y);
}
function encodeHitbox(d, h) {
  d.string(h.kind);
  switch (h.kind) {
    case "aabb":
      d.number(h.halfW);
      d.number(h.halfH);
      break;
    case "circle":
      d.number(h.radius);
      break;
    case "polygon":
      d.word(h.points.length);
      for (const p of h.points) encodeVec2(d, p);
      break;
    default: {
      const _exhaustive = h;
      void _exhaustive;
    }
  }
}
function encodeEntity(d, e) {
  d.number(e.id);
  d.string(e.type);
  d.word(e.tags.length);
  for (const t of e.tags) d.string(t);
  encodeVec2(d, e.transform.position);
  encodeVec2(d, e.kinematics.velocity);
  encodeHitbox(d, e.hitbox);
}
function encodePterodactyl(d, p) {
  encodeVec2(d, p.transform.position);
  encodeVec2(d, p.kinematics.velocity);
  encodeHitbox(d, p.hitbox);
}
function hashState(world) {
  const d = new Digest();
  d.number(world.tick);
  d.number(world.distance);
  d.number(world.food);
  d.number(world.nearMisses);
  d.number(world.score);
  d.number(world.scoreMultiplier);
  d.bool(world.alive);
  d.bool(world.lastFlap);
  d.number(world.scrollSpeed);
  d.number(world.baseScrollSpeed);
  d.number(world.level);
  d.bool(world.difficultyEnabled);
  d.number(world.gravity);
  d.number(world.flapSpeed);
  d.number(world.worldHeight);
  d.string(world.weather);
  encodePterodactyl(d, world.pterodactyl);
  d.word(world.obstacles.length);
  for (const e of world.obstacles) encodeEntity(d, e);
  d.word(world.collectibles.length);
  for (const e of world.collectibles) encodeEntity(d, e);
  d.word(world.powerups.length);
  for (const e of world.powerups) encodeEntity(d, e);
  d.word(world.effects.length);
  for (const eff of world.effects) {
    d.string(eff.kind);
    d.number(eff.remaining);
  }
  d.number(world.extraLives);
  d.bool(world.spawner !== null);
  d.bool(world.collectibleSpawner !== null);
  d.bool(world.powerupSpawner !== null);
  d.bool(world.weatherGenerator !== null);
  d.string(world.trait);
  return d.hex();
}

// src/services/online/verifyChallenge.ts
function verifyChallengeSubmission(sub) {
  const timeline = sub.timeline.map((flap) => ({ flap }));
  const world = simulate({ seed: sub.seed, trait: "none" }, timeline);
  const expectedHash = hashState(world);
  const hashMatches = expectedHash === sub.finalHash;
  const fieldsMatch = world.score === sub.score && world.distance === sub.distance && world.food === sub.food && world.nearMisses === sub.nearMisses;
  return { valid: hashMatches && fieldsMatch, expectedHash, hashMatches, fieldsMatch };
}
export {
  verifyChallengeSubmission
};
