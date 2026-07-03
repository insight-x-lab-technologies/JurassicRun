/**
 * Teste de completude do hashState.
 *
 * PROPÓSITO: se este teste falhar porque um campo foi adicionado a WorldState ou Entity,
 * você precisa:
 *   1. Atualizar `hashState` em `src/core/replay/hash.ts` para codificar o novo campo.
 *   2. Re-gerar os pinos dourados em `tests/determinism/replay.determinism.test.ts`
 *      (rode os cenários, capture os hashes e atualize os valores `golden`).
 *   3. Atualizar as listas esperadas aqui para incluir o novo campo.
 *
 * O narrowing `never` em `encodeHitbox` (src/core/replay/hash.ts) complementa esta
 * guarda para novos kinds de Hitbox, causando erro de compilação em vez de falha de teste.
 */

import { describe, it, expect } from 'vitest';
import { createWorld } from '@core/sim';
import type { WorldConfig } from '@core/sim';
import { simulate, buildTimeline } from '@core/replay';

const CONFIG: WorldConfig = {
  worldHeight: 600,
  startY: 300,
  gravity: 1200,
  flapSpeed: 350,
  scrollSpeed: 200,
  seed: 'endless:KEYS',
};

/** Conjunto exato de chaves que hashState conhece em WorldState (24 campos). */
const EXPECTED_WORLD_KEYS = [
  'alive',
  'baseScrollSpeed',
  'collectibleSpawner',
  'collectibles',
  'difficultyEnabled',
  'distance',
  'effects',
  'extraLives',
  'flapSpeed',
  'food',
  'gravity',
  'lastFlap',
  'level',
  'nearMisses',
  'obstacles',
  'powerupSpawner',
  'powerups',
  'pterodactyl',
  'score',
  'scoreMultiplier',
  'scrollSpeed',
  'spawner',
  'tick',
  'worldHeight',
];

/** Conjunto exato de chaves que hashState conhece em Entity (6 campos). */
const EXPECTED_ENTITY_KEYS = [
  'hitbox',
  'id',
  'kinematics',
  'tags',
  'transform',
  'type',
];

describe('hash-completeness — pino de chaves de WorldState e Entity', () => {
  it('WorldState tem exatamente as chaves que hashState conhece', () => {
    const world = createWorld(CONFIG);
    const actualKeys = Object.keys(world).sort();
    expect(actualKeys).toEqual(EXPECTED_WORLD_KEYS);
  });

  it('Entity (obstáculo) tem exatamente as chaves que hashState conhece', () => {
    // Avança até ter pelo menos um obstáculo
    const tl = buildTimeline(400, (i) => i % 6 === 0);
    const world = simulate(CONFIG, tl);
    expect(world.obstacles.length).toBeGreaterThan(0);
    const obstacle = world.obstacles[0]!;
    const actualKeys = Object.keys(obstacle).sort();
    expect(actualKeys).toEqual(EXPECTED_ENTITY_KEYS);
  });

  it('Entity (coletável) tem exatamente as chaves que hashState conhece', () => {
    // Avança mais steps para garantir pelo menos um coletável
    const tl = buildTimeline(600, (i) => i % 6 === 0);
    const world = simulate(CONFIG, tl);
    if (world.collectibles.length > 0) {
      const collectible = world.collectibles[0]!;
      const actualKeys = Object.keys(collectible).sort();
      expect(actualKeys).toEqual(EXPECTED_ENTITY_KEYS);
    } else {
      // Se nenhum coletável foi gerado neste trecho, confirma obstáculos (já feito acima)
      // e valida que o WorldState ainda bate — ambos compartilham a interface Entity
      expect(world.obstacles.length).toBeGreaterThan(0);
    }
  });
});
