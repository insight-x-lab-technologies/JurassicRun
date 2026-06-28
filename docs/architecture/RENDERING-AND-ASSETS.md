# Render e Pipeline de Assets — JurassicRun

> Como o jogo nasce geométrico e depois recebe arte PNG AAA **sem mudar a lógica** e **sem
> perder performance**.

## Princípio: lógica × visual são coisas separadas

- O `core` conhece **tipos lógicos** e **hitboxes**. Nunca conhece cor, sprite ou imagem.
- O `render` decide *como desenhar* cada tipo lógico, consultando o **manifesto de assets**.
- Trocar um obstáculo geométrico por um PNG = mudar a entrada do manifesto. Zero alteração
  em `core`. Zero alteração na colisão (que usa hitbox, não pixels).

## Manifesto de assets

Mapa de `tipo lógico/variante → representação visual`. Cada entrada é:

- `kind: "primitive"` → forma geométrica (retângulo, círculo, polígono, cor) — placeholder.
- `kind: "sprite"` → `{ atlas, frame }` ou `{ atlas, animation }` — arte PNG.

O render só conhece a interface `Renderable`. Adicionar arte = preencher o manifesto e
empacotar o atlas; nada mais muda.

Exemplo conceitual:

```ts
const ASSET_MANIFEST = {
  "obstacle.rock_arch": { kind: "primitive", shape: "polygon", color: 0x7a5230 },
  "obstacle.vine":      { kind: "primitive", shape: "rect",    color: 0x2f6b2f },
  "bird.coin":          { kind: "primitive", shape: "circle",  color: 0xffd54a },
  "dino.default":       { kind: "primitive", shape: "polygon", color: 0xcc5544 },
  // depois da arte:
  // "dino.default":    { kind: "sprite", atlas: "dinos", animation: "flap" },
};
```

## Performance com PNG (requisito crítico)

- **Texture atlases**: todas as variantes de um conjunto num único atlas → Phaser/WebGL
  faz batching, mantendo poucas draw calls mesmo com muitas imagens.
- **Budget**: manter draw calls e tamanho de textura sob controle; objetos fora da tela não
  são desenhados (culling). Pooling de objetos no render para evitar GC no hot path.
- **Mip/escala**: assets exportados em resolução adequada ao maior alvo; evitar upscale.
- Expansões/packs trocam atlases — **nunca** a hitbox nem a lógica (mantém determinismo).

## Parallax e camadas

- Várias camadas de fundo, cada uma com `scrollFactor` próprio → profundidade.
- Camadas são puramente visuais; não participam da simulação.

## Obstáculos de formatos variados

- Cada obstáculo é um **tipo lógico** com uma hitbox própria (não só retângulos).
- O catálogo de tipos vive em `core` (forma da hitbox + comportamento); o visual vive no
  manifesto. Adicionar um novo formato = nova entrada de tipo + hitbox + entrada de manifesto
  + asset-spec. Ver skill `add-gameplay-entity`.

## Asset specs (documentação para geração por IA)

**Toda** imagem trocável (dino, obstáculo, fundo, ícone, power-up, pássaro, UI) precisa de um
arquivo de especificação em `docs/assets/specs/`, seguindo
`docs/assets/asset-spec-template.md`. O índice de tudo é `docs/assets/asset-registry.md`.

O asset-spec contém: dimensões, pivô/âncora, hitbox correspondente, frames de animação,
paleta/estilo, formato de exportação e um **prompt pronto para gerar a imagem por IA**.
Use a skill `create-asset-spec`.

## Expansões / packs look&feel

- Um pack é um bundle de: atlases, locales extras (opcional), trilhas/SFX, e overrides do
  manifesto (apontando tipos lógicos para novos sprites).
- Trocar de pack = trocar overrides do manifesto + assets carregados. **A simulação e as
  hitboxes não mudam** → determinismo preservado, leaderboards continuam comparáveis.
