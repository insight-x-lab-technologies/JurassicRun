import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderAtlas, ATLAS_SOURCES, ATLAS_VARIANTS } from '../../scripts/gen-atlas.mjs';
import { ASSET_MANIFEST } from '@render/manifest';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('atlas de entidades (arte real)', () => {
  it('renderAtlas gera PNG com assinatura + IHDR válidos', () => {
    const { png } = renderAtlas();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
  });

  it(
    'encoder é determinístico (mesmos bytes a cada run)',
    () => {
      // renderAtlas() decodifica ~10 PNGs grandes por pixel (~2-3s cada chamada) —
      // timeout estendido p/ acomodar as 2 chamadas nesta asserção (default 5000ms é justo).
      expect(renderAtlas().png.equals(renderAtlas().png)).toBe(true);
    },
    20000,
  );

  it('COMPLETUDE: todo id sprite do manifesto tem frame no atlas', () => {
    const { json } = renderAtlas();
    for (const [id, r] of Object.entries(ASSET_MANIFEST)) {
      if (r.kind === 'sprite') {
        expect(json.frames[id], `manifesto sprite sem frame: ${id}`).toBeDefined();
      }
    }
  });

  it('o dino tem 6 frames de flap + alias, cada um com geometria válida', () => {
    const { json } = renderAtlas();
    for (let i = 0; i < 6; i++) expect(json.frames[`dino.default.${i}`], `frame ${i}`).toBeDefined();
    expect(json.frames['dino.default']).toEqual(json.frames['dino.default.0']);
    for (const f of Object.values(json.frames)) {
      expect(f.frame.w).toBeGreaterThan(0);
      expect(f.frame.h).toBeGreaterThan(0);
    }
  });

  it('sem frame órfão: todo id (sem sufixo .N de animação) existe no manifesto', () => {
    const { json } = renderAtlas();
    for (const name of Object.keys(json.frames)) {
      const base = name.replace(/\.\d+$/, '');
      expect(ASSET_MANIFEST[base], `frame órfão: ${name}`).toBeDefined();
    }
  });

  it('os arquivos commitados existem e o PNG bate com o gerado', () => {
    const png = readFileSync(path.join(root, 'public/atlas/entities.png'));
    expect(png.equals(renderAtlas().png)).toBe(true);
  });

  it('ATLAS_VARIANTS inclui o atlas default entities', () => {
    expect(ATLAS_VARIANTS.some((v) => v.key === 'entities')).toBe(true);
  });

  it('renderAtlas aceita uma lista de fontes (multi-atlas)', () => {
    const subset = ATLAS_SOURCES.filter((s) => s.frames === 1).slice(0, 3);
    const { png, json } = renderAtlas(subset);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    for (const s of subset) expect(json.frames[s.id], s.id).toBeDefined();
  });
});
