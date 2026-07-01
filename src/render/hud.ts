// Módulo PURO (sem phaser): throttle de refresh do HUD + medidor de fps e formatação dos valores.
// O gate de throttle produz o fps (frames ÷ tempo da janela) ⇒ uma peça, fps suavizado na janela.

/** Intervalo de refresh do HUD (s). ~5 Hz: barato o bastante p/ não custar fps. */
export const HUD_REFRESH_INTERVAL = 0.2;

/** Throttle do HUD que, ao fechar a janela, devolve o fps medido. Alocação-zero no tick. */
export class HudTicker {
  private readonly interval: number;
  private elapsed = 0;
  private frames = 0;

  constructor(intervalSeconds: number = HUD_REFRESH_INTERVAL) {
    this.interval = intervalSeconds;
  }

  /** Chamar 1×/frame. Só escalares. Retorna o fps ao fechar a janela, senão null. */
  tick(dtSeconds: number): number | null {
    this.elapsed += dtSeconds;
    this.frames += 1;
    if (this.elapsed < this.interval) return null;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    return fps;
  }
}

/** Valores crus do HUD (números do mundo + fps do render + seed injetada). */
export interface HudRaw {
  distance: number;
  food: number;
  fps: number;
  level: number;
  speed: number;
  seed: string;
}

/** Valores formatados (strings). Rótulos/unidades vivem nas chaves i18n `hud.*`. */
export interface HudView {
  distance: string;
  food: string;
  fps: string;
  level: string;
  speed: string;
  seed: string;
}

/** Formatação canônica: floor de contagens, round de fps/velocidade, seed literal. */
export function formatHudValues(raw: HudRaw): HudView {
  return {
    distance: String(Math.floor(raw.distance)),
    food: String(Math.floor(raw.food)),
    fps: String(Math.round(raw.fps)),
    level: String(Math.floor(raw.level)),
    speed: String(Math.round(raw.speed)),
    seed: raw.seed,
  };
}
