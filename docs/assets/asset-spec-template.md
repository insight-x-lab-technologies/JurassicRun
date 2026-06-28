# Asset Spec — <id> (TEMPLATE)

> Copie este arquivo para `docs/assets/specs/<id>.md` e preencha. O `<id>` deve casar com a
> chave no manifesto de assets e no `asset-registry.md`.

## Identidade
- **id:** `categoria.nome` (ex.: `obstacle.rock_arch`)
- **Categoria:** personagem | obstáculo | coletável | power-up | fundo | clima | ui | logo
- **Substitui o placeholder geométrico:** (descrição da primitiva atual)

## Especificação técnica
- **Dimensões alvo (px):** largura × altura (no maior alvo de resolução)
- **Pivô / âncora:** (ex.: centro; pés; bico) — DEVE bater com o pivô usado no render
- **Hitbox lógica associada:** forma + dimensões relativas (a arte NUNCA muda a hitbox)
- **Animação:** nº de frames, fps, lista de estados (ex.: `idle`, `flap`, `hit`)
- **Atlas de destino:** nome do atlas onde será empacotado
- **Formato de exportação:** PNG com alpha; (opcional) variações @1x/@2x
- **Margens/padding seguros:** para não cortar no atlas

## Direção de arte
- **Estilo:** (ex.: cartoon vetorial chapado, contorno definido, sombreamento simples)
- **Paleta:** cores-chave (hex)
- **Iluminação/ângulo:** (ex.: luz superior, vista lateral 2D)
- **Coerência:** com qual conjunto/pack deve combinar

## Prompt para geração por IA
> Prompt pronto, em inglês, descrevendo o asset, estilo, fundo transparente, vista lateral 2D,
> proporções, e o que evitar. Ex.:
>
> "Side-view 2D game sprite of a <thing>, flat cartoon vector style, bold outline, simple
> shading, transparent background, centered, <palette>, no text, no shadow on ground."

## Checklist de aceite
- [ ] Fundo transparente, recortado corretamente.
- [ ] Pivô e proporções batem com a hitbox lógica.
- [ ] Empacotado no atlas correto; 60fps preservado.
- [ ] Entrada no `asset-registry.md` atualizada para `art`.
