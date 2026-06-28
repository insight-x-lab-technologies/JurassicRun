# Fase 1 · Item 1.1 — RNG determinístico (design)

> Spec da feature. Fundação de toda a geração procedural do core.
> Contrato-mãe: `docs/architecture/DETERMINISM.md`. Convenções: `docs/conventions/CONVENTIONS.md`.

## Objetivo

Um gerador de números pseudoaleatórios **determinístico, portável e semeável**, vivendo em
`src/core/rng/`, que serve toda a geração procedural (obstáculos, coletáveis, clima,
power-ups) e suporta replay/golden master. Mesma seed ⇒ mesma sequência, em qualquer
dispositivo, navegador ou fps.

Escopo deste item: **apenas o RNG**. A *derivação* de seeds de modo (Endless / Diária /
Semanal) é o item 1.2 e mora em `src/core/seed/` — aqui só entregamos o motor que consome
uma seed já dada.

## Requisitos

1. **Determinístico e portável.** Sem dependência de implementação de engine. Aritmética em
   uint32 via `Math.imul(...)` e `>>> 0`. Nada de `Math.random`/`Date`/`performance` (proibido
   em `src/core/` pela guarda em dupla camada — ESLint + teste).
2. **Semeável por `string | number`.** Hash estável da seed ⇒ estado inicial uint32.
3. **API mínima e prática** (ver abaixo).
4. **Streams independentes via `fork`.** Geradores diferentes consomem RNGs independentes,
   derivados do **seed inicial** (não do estado corrente), para que adicionar/remover um
   gerador não desloque a sequência dos outros.
5. **Inspecionável para replay.** Estado exposto como uint32 ⇒ pode ser hasheado no
   `WorldState` (golden master, item 1.9) e clonado em testes.
6. **Sem alocação por chamada** no caminho quente (`next`/`nextUint32` não alocam objetos).

## Algoritmo escolhido

- **`mulberry32`** — PRNG de estado único de 32 bits. Simples, rápido, boa distribuição para
  jogo casual. Um passo:
  ```
  s = (s + 0x6D2B79F5) | 0
  t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return (t ^ (t >>> 14)) >>> 0      // uint32
  ```
- **`xmur3`** — hash de string → uint32, usado para transformar a seed (e chaves de fork) no
  estado inicial. Para seed numérica, convertê-la a string decimal antes do hash (caminho de
  código único ⇒ portável).

Justificativa vs. `xoshiro128**`: este tem estado de 128 bits e qualidade estatística
superior, mas é desnecessário para spawns de um side-scroller e mais código/estado = mais
superfície para divergência sutil entre alvos. Preferimos o caminho mínimo e auditável.
Se algum dia a qualidade for insuficiente, o `Rng` é uma interface trocável (só muda o
miolo de `nextUint32`), sem afetar consumidores.

## API pública (`src/core/rng/`)

```ts
// Cria um RNG a partir de uma seed estável.
export function createRng(seed: string | number): Rng;

// Hash estável exposto (útil para 1.2 e para fork keys); string|number -> uint32.
export function hashSeed(seed: string | number): number;

export interface Rng {
  /** Seed original normalizada (string), só leitura. */
  readonly seed: string;
  /** Estado interno corrente (uint32), para hashing/replay. Só leitura. */
  readonly state: number;

  /** Próximo uint32 cru [0, 2^32). Primitiva; avança o estado. */
  nextUint32(): number;
  /** Próximo float em [0, 1). */
  next(): number;
  /** Float em [min, max). Se min >= max, retorna min. */
  range(min: number, max: number): number;
  /** Inteiro em [min, max] inclusivo. Espera min <= max inteiros. */
  int(min: number, max: number): number;
  /** Elemento aleatório do array (índice via int). Lança se vazio. */
  pick<T>(array: readonly T[]): T;

  /** RNG independente para um stream nomeado, derivado do seed inicial. */
  fork(streamId: string | number): Rng;
  /** Cópia com o mesmo estado corrente (não compartilha mutação). */
  clone(): Rng;
}

// Reconstrói um RNG a partir de um estado uint32 salvo (replay/golden master).
export function rngFromState(seed: string | number, state: number): Rng;
```

Notas de contrato:
- `range`/`int`/`pick` são construídos sobre `nextUint32` (`next = nextUint32 / 2^32`), então
  toda a aleatoriedade flui por uma única primitiva ⇒ um só ponto de verdade determinístico.
- `int` usa rejeição? **Não** — usa `min + floor(next() * (max - min + 1))`. O viés de módulo
  é desprezível para os intervalos pequenos do jogo e mantém o caminho de código portável e
  sem laço. Documentado aqui como decisão consciente.
- `fork(id)`: estado inicial = `hashSeed(seedNormalizada + "::" + id)`. Independente de quanto
  o pai já consumiu ⇒ streams estáveis e reproduzíveis. A `seed` do filho reflete a chave
  combinada (para depuração/log).
- `clone()` preserva `state` corrente (diverge do pai a partir daí). Não confundir com `fork`,
  que reinicia de uma chave derivada do seed.

## Estrutura de arquivos

```
src/core/rng/
  mulberry32.ts   # passo puro do PRNG + xmur3 (hash). Funções livres, sem classe.
  rng.ts          # Rng (impl. de classe), createRng, rngFromState, hashSeed re-export.
  index.ts        # superfície pública (re-exporta de rng.ts).
tests/core/rng/
  rng.test.ts            # API, semântica de range/int/pick, fork, clone, state.
  rng.determinism.test.ts# reprodutibilidade + portabilidade (mesma seed/estado ⇒ idêntico).
  rng.distribution.test.ts# distribuição básica (uniformidade aproximada, cobertura de pick).
```

(Os `*.determinism.test.ts` entram automaticamente em `npm run test:determinism` via pasta
`tests/determinism`? Não — esse script aponta para `tests/determinism`. Para que a bateria de
determinismo do RNG rode no CI, os testes de determinismo do RNG ficam em
`tests/determinism/rng.determinism.test.ts`. Ver "Integração com CI" abaixo.)

## Testes (TDD — vermelho antes do verde)

**Reprodutibilidade / portabilidade** (`tests/determinism/`):
- Mesma seed ⇒ duas instâncias produzem sequências idênticas (N valores).
- `rngFromState(seed, r.state)` continua a sequência exatamente de onde `r` parou.
- `clone()` produz sequência idêntica ao original a partir do ponto de clonagem.
- **Vetor fixo (golden):** para uma seed conhecida (ex.: `"jurassic"`), os primeiros K
  `nextUint32()` batem com uma lista literal embutida no teste ⇒ trava o algoritmo contra
  regressão silenciosa entre máquinas/refactors.
- `fork(a)` e `fork(b)` (a≠b) geram sequências diferentes; `fork(a)` é estável mesmo que o
  pai tenha consumido valores antes do fork.

**Semântica da API** (`tests/core/rng/`):
- `next()` sempre em [0,1); `range(min,max)` em [min,max); `range` com min>=max ⇒ min.
- `int(min,max)` em [min,max] inclusive nas duas bordas (testar min e max alcançáveis).
- `pick` retorna elemento do array; array vazio lança.
- `seed`/`state` expostos e coerentes (state muda após `nextUint32`).

**Distribuição básica** (`tests/core/rng/`):
- Histograma de muitos `int(0, b-1)` em B baldes ⇒ cada balde dentro de tolerância folgada
  (não é teste estatístico rigoroso; pega quebras grosseiras como "sempre 0").
- Média de muitos `next()` ≈ 0.5 dentro de tolerância.
- `pick` cobre todos os índices ao longo de muitas amostras.

(Testes determinísticos: nada de `Math.random`; tolerâncias e amostras fixas.)

## Integração com CI / determinismo

- A guarda anti-API-proibida (`tests/determinism/no-forbidden-apis...`) já cobre `src/core/`
  inteiro — o novo código entra sob ela automaticamente.
- Os testes de determinismo do RNG vão em `tests/determinism/rng.determinism.test.ts` para
  serem incluídos por `npm run test:determinism` (já no CI). Os testes de API/distribuição
  ficam em `tests/core/rng/` e rodam no `npm test` geral.
- `npm run check` (tsc estrito + eslint) deve passar limpo.

## Fora de escopo (YAGNI agora)

- Derivação de seeds de modo (Endless/Diária/Semanal) → item 1.2.
- Distribuições gaussianas/poisson, shuffle, weighted-pick → adicionar quando um gerador
  concreto precisar (provável no 1.4/1.5), não especular agora.
- Serialização para disco/rede → o `state` uint32 já basta; formato de save é fase posterior.

## Definição de pronto

- `npm test`, `npm run check` e `npm run test:determinism` verdes.
- Vetor golden batendo; fork/clone/state cobertos.
- Skill `verify-determinism` passa.
