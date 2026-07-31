import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AVATAR_IDS } from '@services/profile/avatars';

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
});
