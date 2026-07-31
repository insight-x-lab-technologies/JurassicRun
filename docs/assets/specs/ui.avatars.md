# Asset Spec — ui.avatars

## Identidade
- **id (base):** `ui.avatars` — conjunto de 12 avatares de perfil
- **Categoria:** UI / chrome (Tier 1) — medalhões de identidade de jogador
- **Substitui o placeholder:** o medalhão procedural gerado por `scripts/gen-avatar-placeholder.mjs`
  (disco radial por matiz + aro dourado + silhueta do pterodáctilo tingida, `public/ui/avatar.aNN.png`,
  128×128). O catálogo/ids/persistência (10.6) **já existem** e não mudam quando a arte real entrar —
  só o PNG-fonte troca.

## Conjunto (ids concretos)

12 ids fixos `avatar.a01` … `avatar.a12` (`AVATAR_IDS` em `src/services/profile/avatars.ts`), cada
um um retrato individual de pterodáctilo/dinossauro do universo do jogo — não repetir pose nem
paleta entre os 12, para funcionarem como grade de identidade visual reconhecível a distância.

| id | Retrato descrito |
|----|-------------------|
| `avatar.a01` | pterodáctilo clássico, bico dourado, olhar de frente, tons de bronze/dourado |
| `avatar.a02` | pterodáctilo de crista alta, perfil ¾, tons verde-oliva |
| `avatar.a03` | pterodáctilo com escamas azul-petróleo, olhar feroz |
| `avatar.a04` | pterodáctilo jovem, cores mais claras, expressão curiosa |
| `avatar.a05` | pterodáctilo de fogo (tons vermelho/laranja), tema Vulcão |
| `avatar.a06` | pterodáctilo glacial (tons azul-gelo/branco), tema Geleira |
| `avatar.a07` | pterodáctilo noturno, escamas roxo-escuro, olhos luminosos |
| `avatar.a08` | pterodáctilo dourado puro, aspecto "lendário"/prestígio |
| `avatar.a09` | pterodáctilo de couro verde-floresta, silhueta robusta |
| `avatar.a10` | pterodáctilo de crista dupla, tons de coral/rosa |
| `avatar.a11` | pterodáctilo camuflado em tons terrosos, marrom/areia |
| `avatar.a12` | pterodáctilo prateado/metálico, aspecto "campeão" |

## Especificação técnica
- **Folha de origem:** grade **4 colunas × 3 linhas**, célula **256 × 256 px**, PNG com alpha
  (fundo transparente — cada medalhão é um disco/retrato recortado, não um quadro opaco).
- **Ordem de leitura da grade:** esquerda→direita, topo→baixo = `a01..a04` (linha 1), `a05..a08`
  (linha 2), `a09..a12` (linha 3) — mesma convenção de `grid.names` usada em `ATLAS_SOURCES`/
  `UI_SOURCES` no projeto.
- **Saída de runtime:** um PNG por id, **128 × 128 px**, em `public/ui/avatar.a01.png` …
  `public/ui/avatar.a12.png` (mesmo caminho/tamanho que o placeholder já produz — trocar a fonte
  não muda o contrato de arquivo consumido por `Avatar.tsx`).
- **Pivô / âncora:** centro; o retrato preenche o disco, sem cortar o topo da cabeça/crista.
- **Hitbox lógica associada:** nenhuma (é UI, não entidade de jogo).
- **Margens/padding seguros:** conteúdo dentro de um círculo inscrito de 92% da célula (o aro
  dourado ocupa a faixa externa restante), para não ser cortado por uma máscara circular no CSS.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** retrato/medalhão de pterodáctilo em ilustração AAA dark-fantasy, mesmo tratamento de
  luz e mesma "câmera" (enquadramento de busto/cabeça) nos 12, variando só cor de escamas, pose e
  acessórios sutis (crista, olhar) — para não parecerem 12 estilos diferentes colados lado a lado.
- **Aro/moldura:** anel dourado fino (`#c9a227`/`#f2d878`) contornando o disco, coerente com a
  moldura de medalhas (`ui.medals`) e ícones (`ui.icons`) já existentes.
- **Legibilidade:** silhueta reconhecível a 128px e também no tamanho reduzido usado em listas
  (~32–48px), sem detalhe fino que vire ruído nesse tamanho.

## Prompt para geração por IA
Template compartilhado (trocar `<DESC>` pela coluna "Retrato descrito" da tabela):
> "Circular portrait medallion of a pterodactyl, <DESC>, dark fantasy AAA game avatar icon,
> dramatic rim lighting, thin gold ring border (#c9a227 with #f2d878 highlights), centered bust
> framing, transparent background outside the circle, no text, consistent painterly style across
> the set."

Gerar as 12 variações com o mesmo prompt-base trocando `<DESC>`, depois compor em uma folha 4×3 de
células 256×256 (ou gerar 12 arquivos individuais e montar a grade em pós-processo) antes de
alimentar o pipeline.

## Pipeline (quando a arte real existir)
Entrada nova em `UI_SOURCES` (`scripts/gen-ui.mjs`):

```js
{ out: 'avatars', file: 'ui/ui.avatars.png', maxDim: 128,
  grid: { cols: 4, rows: 3, names: [
    'avatar.a01','avatar.a02','avatar.a03','avatar.a04',
    'avatar.a05','avatar.a06','avatar.a07','avatar.a08',
    'avatar.a09','avatar.a10','avatar.a11','avatar.a12'] } },
```

Fonte em `public/art/ui/ui.avatars.png` (4×3, 256px/célula) → `npm run gen:ui` recorta e escala
cada célula para `public/ui/avatar.aNN.png` (128×128), o mesmo caminho já consumido por
`Avatar.tsx` e coberto por `tests/assets/avatars.test.ts`.

**Ao adotar a arte real, apagar `scripts/gen-avatar-placeholder.mjs`** (e o script `gen:avatars`
do `package.json`) — precedente dos geradores `gen-{parallax,obstacle}-placeholder`, removidos na
Fase 9 por sobrescreverem a arte real ao rodar de novo. Enquanto a folha real não existir, o
placeholder permanece a única fonte e continua protegido pela guarda anti-sobrescrita
(`--force` obrigatório para regravar um PNG já presente).

## Checklist de aceite
- [ ] 12 retratos, grade 4×3 de células 256×256, fundo transparente fora do disco.
- [ ] Mesmo tratamento de luz/enquadramento nos 12; variação só de cor/pose/acessório.
- [ ] Aro dourado fino, coerente com `ui.medals`/`ui.icons`.
- [ ] Legível a 128px e a ~32px (uso em lista).
- [ ] Entrada em `UI_SOURCES` recorta para `public/ui/avatar.aNN.png` (128×128) sem quebrar
      `tests/assets/avatars.test.ts`; os 12 ids no `asset-registry.md` = `art`.
- [ ] `scripts/gen-avatar-placeholder.mjs` removido do repositório e do `package.json` na mesma
      mudança que introduz a arte real.
