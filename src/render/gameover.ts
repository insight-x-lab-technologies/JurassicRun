// Módulo PURO (sem phaser): formatação canônica das estatísticas do Game Over.
// Espelha formatHudValues (hud.ts). Rótulos/unidades vivem nas chaves i18n `gameover.*`.

/** Valores crus lidos do WorldState ao morrer. */
export interface GameOverRaw {
  distance: number;
  food: number;
  nearMisses: number;
}

/** Valores formatados (strings). Rótulos/unidades vêm das chaves i18n. */
export interface GameOverView {
  distance: string;
  food: string;
  nearMisses: string;
}

/** Floor de contagens inteiras. Sem estado, sem alocação por frame (chamado 1× ao morrer). */
export function formatGameOverStats(raw: GameOverRaw): GameOverView {
  return {
    distance: String(Math.floor(raw.distance)),
    food: String(Math.floor(raw.food)),
    nearMisses: String(Math.floor(raw.nearMisses)),
  };
}
