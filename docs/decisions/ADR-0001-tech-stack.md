# ADR-0001 — Stack técnica
- Status: Aceita
- Data: 2026-06-27

## Contexto
PWA mobile-first, 60fps, troca de arte sem perda de performance, 15+ telas responsivas em
10 idiomas, hobby sem frameworks pagos.

## Decisão
Phaser 3 (WebGL) para gameplay; Preact + Signals (DOM) para UI/telas; Vite + vite-plugin-pwa
para build/PWA; TypeScript; Vitest para testes; i18next para i18n; Supabase JS (fase tardia).

## Consequências
- Dois mundos de render (canvas Phaser + DOM Preact) coexistem; fronteira clara via services.
- Tudo gratuito/open-source. Build estático compatível com GitHub Pages e itch.io.

## Alternativas consideradas
- UI inteiramente em Phaser: pior para telas responsivas, i18n e acessibilidade. Rejeitada.
- Engine custom em canvas: esforço desnecessário, sem batching WebGL pronto. Rejeitada.
- React em vez de Preact: maior, sem ganho relevante para hobby. Preact preferido.
