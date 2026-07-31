import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AVATAR_IDS, AVATARS } from '@services/profile/avatars';
import { AVATAR_IDS as GEN_AVATAR_IDS, hueFor } from '../../scripts/gen-avatar-placeholder.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('arte dos avatares', () => {
  it('todo id do catálogo tem PNG em public/ui', () => {
    const missing = AVATAR_IDS.filter(
      (id) => !existsSync(join(ROOT, `public/ui/avatar.${id}.png`)),
    );
    expect(missing).toEqual([]);
  });

  it('nenhum PNG de avatar está vazio', () => {
    for (const id of AVATAR_IDS) {
      expect(statSync(join(ROOT, `public/ui/avatar.${id}.png`)).size).toBeGreaterThan(200);
    }
  });

  it('o catálogo do gerador de placeholder bate com o catálogo do serviço (ids, ordem e matiz)', () => {
    // Sem isto, um reordenamento/13º id/nova fórmula de matiz em avatars.ts faria o gerador
    // continuar produzindo arte para os ids/matizes ERRADOS, e o teste de "arquivo existe"
    // acima não pegaria a divergência.
    expect(GEN_AVATAR_IDS).toEqual(AVATAR_IDS);
    AVATARS.forEach((def, i) => {
      expect(hueFor(i)).toBe(def.hue);
    });
  });
});
