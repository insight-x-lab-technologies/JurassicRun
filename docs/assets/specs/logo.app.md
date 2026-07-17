# Asset Spec — logo.app

## Identidade
- **id:** `logo.app`
- **Categoria:** UI / marca (Tier 1)
- **Substitui o placeholder:** título textual "JurassicRun" renderizado em CSS.

## Especificação técnica
- **Dimensões alvo (px):** 1024 × 384 (@1x; exportar também @2x = 2048 × 768)
- **Pivô / âncora:** centro; usado centralizado no topo de Home/Placar/Expansões.
- **Hitbox lógica associada:** nenhuma — asset puramente visual.
- **Animação:** nenhuma (estático). Brilho/glint é CSS opcional, não frames.
- **Atlas de destino:** `ui` (ou imagem solta; não é hot path).
- **Formato de exportação:** PNG com alpha (fundo transparente).
- **Margens/padding seguros:** 24px em volta do wordmark para não cortar a ornamentação.

## Direção de arte
> **Coerência:** seguir `docs/assets/ART-DIRECTION.md` (Style Bible). Asset **Tier 1**.
- **Estilo:** wordmark em display serif ornamentada gravada, dourada (ouro `#c9a227`, realce
  `#f2d878`, sombra `#8a6d1b`), com bisel metálico. Emblema de crista de pterodáctilo heráldico
  dourado acima ou entrelaçado ao texto (como em `ref/ref_Home.png` e `ref/ref_LeaderBoard.png`).
- **Texto exato:** `JurassicRun` (uma palavra, camelCase; NÃO "Ptero Ascent").
- **Iluminação/ângulo:** frontal, luz superior, realce metálico no topo das letras.
- **Coerência:** mesma linguagem dourada das molduras e headers.

## Prompt para geração por IA
> "Ornate golden game logo wordmark reading exactly 'JurassicRun', a heraldic pterodactyl crest
> emblem above the text, engraved metallic gold with dark outline and beveled highlights, dark
> fantasy AAA game title style, transparent background, no photographic scenery, centered, sharp
> and legible."

## Checklist de aceite
- [ ] Fundo transparente; ornamentação não cortada (24px de respiro).
- [ ] Texto legível e correto: "JurassicRun".
- [ ] Ouro/bisel coerente com o Style Bible.
- [ ] Entrada no `asset-registry.md` = `spec` (→ `art` quando o PNG existir).
