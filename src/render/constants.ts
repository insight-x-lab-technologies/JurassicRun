/** Tamanho lógico do canvas (px). VIEW_HEIGHT = WORLD_HEIGHT default ⇒ 1 unidade de mundo = 1px. */
export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 180;

/** x de tela fixo do pterodáctilo (≈¼ da largura); a câmera scrolla em x para segui-lo. */
export const DINO_SCREEN_X = 80;

/** Clamp do dt de frame (s): evita spiral-of-death quando a aba volta do background. */
export const MAX_FRAME_TIME = 0.25;

// Cores de cenário fixo (céu de fundo, faixas de teto/chão). Parallax multicamadas: parallax.ts.
export const SKY_COLOR = 0x9ad4e6;
export const GROUND_COLOR = 0x4a7a3a;
export const CEILING_COLOR = 0x3a2f4a;
export const GROUND_THICKNESS = 6;

/** event.code das teclas. Flap e pausa são DISJUNTAS (pausar nunca conta como flap). */
export const FLAP_KEYS: readonly string[] = ['Space', 'ArrowUp'];
export const PAUSE_KEYS: readonly string[] = ['KeyP', 'Escape'];

/** Overlay de pausa: escurecimento sem texto (rótulo i18n é 2.4/2.6). */
export const PAUSE_OVERLAY_COLOR = 0x000000;
export const PAUSE_OVERLAY_ALPHA = 0.45;

/** HUD (2.4): texto de leitura da partida. Depth abaixo do overlay de pausa (1000). */
export const HUD_DEPTH = 900;
export const HUD_TEXT_X = 4;
export const HUD_TEXT_Y = 4;
export const HUD_FONT_SIZE = '8px';
export const HUD_TEXT_COLOR = '#ffffff';
