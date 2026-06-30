import type { Entity, Hitbox, Pterodactyl, Vec2, WorldState } from '@core/sim';

// Buffer de módulo p/ extrair os bits IEEE-754 de um float64 sem alocação por chamada.
// Endianness FIXA (littleEndian=true) ⇒ o golden é portável entre engines/plataformas.
const FLOAT_BUF = new ArrayBuffer(8);
const FLOAT_VIEW = new DataView(FLOAT_BUF);

function mixLane(h: number, w: number, prime: number): number {
  const x = Math.imul(h ^ w, prime);
  return (((x << 13) | (x >>> 19)) >>> 0);
}

function avalanche(h: number): number {
  let x = h >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function word8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0');
}

/** Acumulador de digest de 128 bits (4 lanes uint32), mistura estilo xmur3/scramble. */
class Digest {
  private h0 = 0x811c9dc5 | 0;
  private h1 = 0x9e3779b9 | 0;
  private h2 = 0x85ebca6b | 0;
  private h3 = 0xc2b2ae35 | 0;

  /** Absorve uma palavra (int32 bit-a-bit). */
  word(w: number): void {
    const x = w | 0;
    this.h0 = mixLane(this.h0, x, 0x01000193);
    this.h1 = mixLane(this.h1, x, 0x85ebca77);
    this.h2 = mixLane(this.h2, x, 0xc2b2ae3d);
    this.h3 = mixLane(this.h3, x, 0x27d4eb2f);
  }

  /** Absorve um float pelos seus 64 bits IEEE-754 (LE). Normaliza -0 → +0. */
  number(n: number): void {
    FLOAT_VIEW.setFloat64(0, n === 0 ? 0 : n, true);
    this.word(FLOAT_VIEW.getUint32(0, true));
    this.word(FLOAT_VIEW.getUint32(4, true));
  }

  bool(b: boolean): void {
    this.word(b ? 1 : 0);
  }

  string(s: string): void {
    this.word(s.length);
    for (let i = 0; i < s.length; i++) this.word(s.charCodeAt(i));
  }

  hex(): string {
    return word8(avalanche(this.h0)) + word8(avalanche(this.h1)) +
      word8(avalanche(this.h2)) + word8(avalanche(this.h3));
  }
}

function encodeVec2(d: Digest, v: Vec2): void {
  d.number(v.x);
  d.number(v.y);
}

function encodeHitbox(d: Digest, h: Hitbox): void {
  d.string(h.kind);
  switch (h.kind) {
    case 'aabb':
      d.number(h.halfW);
      d.number(h.halfH);
      break;
    case 'circle':
      d.number(h.radius);
      break;
    case 'polygon':
      d.word(h.points.length);
      for (const p of h.points) encodeVec2(d, p);
      break;
    default: {
      // Se um novo kind for adicionado a Hitbox sem atualizar este switch,
      // o TypeScript emite erro de compilação aqui (narrowing para never).
      const _exhaustive: never = h;
      void _exhaustive;
    }
  }
}

function encodeEntity(d: Digest, e: Entity): void {
  d.number(e.id);
  d.string(e.type);
  d.word(e.tags.length);
  for (const t of e.tags) d.string(t);
  encodeVec2(d, e.transform.position);
  encodeVec2(d, e.kinematics.velocity);
  encodeHitbox(d, e.hitbox);
}

function encodePterodactyl(d: Digest, p: Pterodactyl): void {
  encodeVec2(d, p.transform.position);
  encodeVec2(d, p.kinematics.velocity);
  encodeHitbox(d, p.hitbox);
}

/**
 * Digest canônico, estável e portável do estado VISÍVEL do mundo (escalares + pterodáctilo +
 * obstáculos + coletáveis + presença dos geradores). Não lê o estado interno privado dos
 * SpawnGenerator: numa timeline fixa todo draw de RNG já se manifesta nas entidades emitidas.
 * Saída: 32 chars hex (128 bits).
 *
 * MANUTENCAO: se você adicionar um campo a WorldState ou Entity (src/core/sim/types.ts),
 * ou um novo kind a Hitbox, você DEVE:
 *   1. Codificar o novo campo aqui (em encodeHitbox/encodeEntity/hashState).
 *   2. Re-gerar os pinos dourados em tests/determinism/replay.determinism.test.ts.
 *   3. Atualizar o teste de completude em tests/core/replay/hash-completeness.test.ts.
 * O teste de completude e o narrowing `never` no encodeHitbox existem para forçar
 * esse lembrete de forma ruidosa (falha de compilação ou falha de teste).
 */
export function hashState(world: WorldState): string {
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
  encodePterodactyl(d, world.pterodactyl);
  d.word(world.obstacles.length);
  for (const e of world.obstacles) encodeEntity(d, e);
  d.word(world.collectibles.length);
  for (const e of world.collectibles) encodeEntity(d, e);
  d.bool(world.spawner !== null);
  d.bool(world.collectibleSpawner !== null);
  return d.hex();
}
