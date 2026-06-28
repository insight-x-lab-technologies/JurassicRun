# ADR-0003 — Separação arte × lógica (manifesto de assets)
- Status: Aceita
- Data: 2026-06-27

## Contexto
O jogo nasce geométrico e depois recebe arte PNG AAA. Expansões devem alterar **apenas**
cosméticos, sem afetar gameplay nem determinismo, e sem perda de performance.

## Decisão
Entidades têm hitbox lógica no `core`, separada do visual. Um manifesto de assets mapeia
tipo lógico → representação (primitiva geométrica ou frame de atlas PNG). Colisão usa hitbox,
nunca pixels. Arte vai em texture atlases (batching WebGL). Ver
`docs/architecture/RENDERING-AND-ASSETS.md`.

## Consequências
- Trocar geométrico↔PNG = editar manifesto; zero mudança em core/colisão.
- Packs/expansões só trocam atlases/overrides → determinismo e leaderboards preservados.
- Toda imagem trocável exige um asset-spec (geração por IA reproduzível).

## Alternativas consideradas
- Colisão baseada em pixels/arte: quebraria determinismo ao trocar arte. Rejeitada.
- Imagens soltas sem atlas: muitas draw calls, perda de fps. Rejeitada.
