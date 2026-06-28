---
name: add-locale
description: Use ao adicionar ou alterar qualquer texto visível ao usuário no JurassicRun — garante chaves i18n em todos os 10 idiomas, sem strings hardcoded.
---

# Adicionar/Editar Locale (i18n)

Idiomas suportados: `en` (default), `es`, `pt-BR`, `fr`, `it`, `de`, `ja`, `zh`, `hi`.

## Regras
- Nenhuma string visível hardcoded no código. Sempre `t("namespace.chave")`.
- Toda chave deve existir em **todos** os locales. `en` é a fonte da verdade.

## Passos
1. Adicione a chave em `src/i18n/locales/en.json` (texto definitivo em inglês).
2. Propague a chave para os outros 9 locales com a tradução adequada.
   - Se a tradução de algum idioma não estiver disponível agora, copie o texto em inglês como
     placeholder e marque para revisão — mas a chave NÃO pode faltar.
3. Verifique paridade de chaves entre locales (todos os arquivos com o mesmo conjunto de chaves).
4. Use a chave no componente via `t()`.
5. Rode `npm run check` e teste a troca de idioma na UI.

## Dica
Mantenha namespaces por tela (`home.*`, `settings.*`, `shop.*`, `gameover.*`) para organização.
