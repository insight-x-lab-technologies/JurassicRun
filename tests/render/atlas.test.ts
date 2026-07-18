import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ATLAS_FRAMES, renderAtlas } from '../../scripts/gen-atlas.mjs';
import { ASSET_MANIFEST } from '@render/manifest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('atlas placeholder de entidades', () => {
  it('renderAtlas gera PNG com assinatura + IHDR válidos', () => {
    const { png } = renderAtlas();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); // \x89PNG
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  });

  it('encoder é determinístico (mesmos bytes a cada run)', () => {
    expect(renderAtlas().png.equals(renderAtlas().png)).toBe(true);
  });

  it('JSON tem um frame por id de ATLAS_FRAMES com geometria válida', () => {
    const { json } = renderAtlas();
    for (const f of ATLAS_FRAMES) {
      const frame = json.frames[f.id];
      expect(frame, `frame ausente: ${f.id}`).toBeDefined();
      if (frame) {
        expect(frame.frame.w).toBeGreaterThan(0);
        expect(frame.frame.h).toBeGreaterThan(0);
      }
    }
  });

  it('COMPLETUDE: todo id sprite do manifesto tem frame no atlas', () => {
    const frameIds = new Set(ATLAS_FRAMES.map((f) => f.id));
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind === 'sprite') {
        expect(frameIds.has(id), `manifesto sprite sem frame no atlas: ${id}`).toBe(true);
      }
    }
  });

  it('sem frame órfão: todo id de ATLAS_FRAMES existe no manifesto', () => {
    for (const f of ATLAS_FRAMES) {
      expect(ASSET_MANIFEST[f.id], `frame órfão no atlas: ${f.id}`).toBeDefined();
    }
  });

  it('os arquivos commitados existem e o PNG bate com o gerado', () => {
    const png = readFileSync(path.join(root, 'public/atlas/entities.png'));
    expect(png.equals(renderAtlas().png)).toBe(true);
  });
});
