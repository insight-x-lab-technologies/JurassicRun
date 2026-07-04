# Relatório — 3.3 Task 1: módulo puro `daynight.ts`

**Branch:** `feat/3.3-time-of-day`
**Escopo:** apenas a Task 1 do plano `docs/superpowers/plans/2026-07-03-time-of-day.md`
(catálogo de paletas + seleção determinística por seed). Task 2 (casca `GameScene`) NÃO
implementada — fora do escopo pedido.

## O que foi feito

1. **Teste (TDD, escrito primeiro):** `tests/render/daynight.test.ts` — copiado verbatim do
   plano. 5 casos: catálogo completo/sem órfãs, cores válidas (inteiro, 0..0xffffff), seleção
   determinística por seed, seleção sempre dentro de `TIME_OF_DAY_ORDER`, seleção varia entre
   seeds.
2. **Confirmação de falha:** `npm test -- daynight` falhou com
   `Cannot find package '@render/daynight'` (módulo ainda não existia) — como esperado.
3. **Implementação:** `src/render/daynight.ts` — módulo PURO (sem `phaser`/DOM), verbatim do
   plano:
   - `type TimeOfDay = 'morning' | 'afternoon' | 'dusk' | 'night'`
   - `interface DayNightPalette { sky, ground, ceiling, parallaxTint }` (todas `readonly`)
   - `TIME_OF_DAY_ORDER: readonly TimeOfDay[]`
   - `DAY_NIGHT_PALETTES: Readonly<Record<TimeOfDay, DayNightPalette>>` (4 paletas, cores
     placeholder de tuning declaradas no plano)
   - `paletteFor(tod)` e `timeOfDayForSeed(seed)` (usa `hashSeed` de `@core/rng`, módulo
     `%` `TIME_OF_DAY_ORDER.length`)
   - `src/core/` não foi tocado; único import externo é `hashSeed` de `@core/rng` (import
     permitido: render pode consumir core, nunca o inverso).
4. **Reexport:** `src/render/index.ts` ganhou `export * from './daynight';` logo após
   `export * from './parallax';` (mantendo o padrão de barrel só-de-módulos-puros).
5. **Testes rodando verde:** `npm test -- daynight` → 5/5 passando.
6. **Check limpo:** `npm run check` (`tsc --noEmit && eslint .`) sem erros.
7. **Suíte completa:** `npm test` → 54 arquivos, 308 testes passando (303 anteriores + 5 novos).
8. **Commit:** feito só com os 3 arquivos da Task 1 (não incluí `scripts/run.sh`/`scripts/stop.sh`,
   que já estavam modificados na árvore antes desta tarefa e são fora de escopo).

## Arquivos alterados/criados

- `src/render/daynight.ts` (novo)
- `tests/render/daynight.test.ts` (novo)
- `src/render/index.ts` (modificado — 1 linha adicionada)

## Saída dos testes

```
npm test -- daynight
...
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

```
npm test
...
 Test Files  54 passed (54)
      Tests  308 passed (308)
```

## Saída do `npm run check`

```
> tsc --noEmit && eslint .
(sem output — limpo)
```

## Commit

```
03357df feat(3.3): módulo puro daynight (paletas + seleção determinística por seed)
3 files changed, 96 insertions(+)
```

## Notas / pendências (fora do escopo desta task)

- `npm run test:determinism` não foi rodado isoladamente nesta task porque o módulo é
  puramente de render/cosmético e não toca `src/core/`; a suíte completa (`npm test`, que
  inclui os testes de determinismo) rodou verde com 308/308. Recomendo rodar
  `npm run test:determinism` explicitamente antes do merge final (após a Task 2), como já
  previsto na "Verificação final" do plano.
- Task 2 (aplicar a paleta na `GameScene`, notas de asset-spec, build de sanidade, marcar 3.3
  como concluído no roadmap/CLAUDE.md) permanece pendente, conforme instrução de escopo.
- `scripts/run.sh`/`scripts/stop.sh` seguem com modificações não-commitadas pré-existentes
  (não relacionadas a esta task); não staged nem tocados.
