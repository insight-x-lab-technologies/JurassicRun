# Contrato de Determinismo — JurassicRun

> Este é o documento mais sensível do projeto. Os modos Desafio Diário e Semanal só são
> justos se a simulação for **bit-determinística** entre dispositivos. Qualquer agente que
> tocar em `src/core/` DEVE respeitar este contrato.

## Definição

Dado uma `seed` e uma `InputTimeline` (sequência de inputs por step), a simulação produz
**sempre o mesmo `WorldState`** final, em qualquer dispositivo, qualquer fps de tela,
qualquer navegador.

## Regras

1. **Fontes de não-determinismo proibidas em `src/core/`:**
   - `Math.random()` → use o serviço `Rng` (semeado).
   - `Date.now()`, `Date`, `performance.now()` → use o relógio da simulação (acumulado a
     partir de `FIXED_DT`).
   - Iteração sobre `Set`/`Map`/`Object.keys` cuja ordem dependa de inserção não-determinística
     → use arrays com ordem explícita e estável.
   - APIs de browser/IO (DOM, fetch, localStorage) → não existem em `core`.
   - `setTimeout`/`requestAnimationFrame` → render apenas, nunca core.

2. **Passo fixo.** A simulação avança apenas em incrementos de `FIXED_DT = 1/60 s`.
   O acumulador de tempo vive na camada de render; o core nunca recebe um `dt` variável.

3. **PRNG.** Algoritmo determinístico e portável (ex.: mulberry32 / xoshiro128**), semeado
   por uma função de hash estável da seed. Sem dependência de implementação de engine.
   - Seed Endless: aleatória na criação da partida (gerada fora do core) e exibida no HUD.
   - Seed Diária: `hash("daily:" + dataUTC_YYYY-MM-DD)`.
   - Seed Semanal: `hash("weekly:" + anoISO + "-W" + semanaISO)`.

4. **Geração keyed por mundo.** Spawns/clima/power-ups são amostrados em cadência de
   **distância/posição**, não de tempo de parede. Conteúdo = `f(seed, distância)`.

5. **Matemática portável.** Evitar dependência de precisão de `Math.sin`/`cos` para lógica
   crítica quando possível; se usadas, manter o mesmo caminho de código em todos os alvos.
   Preferir inteiros/ponto-fixo em contadores de progressão. Documentar qualquer uso de
   float sensível.

6. **Clima afeta gameplay deterministicamente.** Vento/tempestade/neve alteram física, mas
   sempre como função do estado determinístico — nunca aleatório fora do `Rng` semeado.
   Manhã/tarde/noite são puramente cosméticos e não tocam a simulação.

## Anti-cheat (porta aberta para fase online)

Como `resultado = f(seed, InputTimeline)`, podemos gravar a `InputTimeline` e a `seed` de
uma submissão de desafio e **re-simular no servidor** (Supabase Edge Function) para validar
o score. Projetar o core para suportar replay headless desde já.

## Como testar (obrigatório no CI a partir da Fase 1)

- **Teste de reprodutibilidade:** rodar `sim(seed, inputs)` duas vezes, comparar hash do
  estado final. Devem ser idênticos.
- **Teste de independência de fps:** rodar a mesma partida com agrupamentos diferentes de
  steps por frame (1, 2, 5 steps/frame). Resultado idêntico.
- **Teste de golden master:** para um conjunto de seeds fixas, salvar o hash esperado do
  estado em marcos de distância e detectar regressões.
- **Teste de proibição:** lint/grep que falha se `Math.random|Date.now|performance.now`
  aparecer em `src/core/`.

Ver skill `verify-determinism`.
