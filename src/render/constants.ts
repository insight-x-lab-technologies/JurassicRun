/** Tamanho lógico do canvas (px). VIEW_HEIGHT = WORLD_HEIGHT default ⇒ 1 unidade de mundo = 1px. */
export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 180;

/** x de tela fixo do pterodáctilo (≈¼ da largura); a câmera scrolla em x para segui-lo. */
export const DINO_SCREEN_X = 80;

/** Margem (px) do culling horizontal de render: evita "pop" de entidades entrando na borda. */
export const CULL_MARGIN = 4;

/** Clamp do dt de frame (s): evita spiral-of-death quando a aba volta do background. */
export const MAX_FRAME_TIME = 0.25;

/** Fator de escala de tempo do slow-mo (<1): durante o efeito, o dt real é encolhido antes
 * de entrar no acumulador de passo fixo ⇒ menos steps/segundo real (câmera lenta). O sim
 * fica byte-idêntico, só clocado devagar (mesma fps-independência já provada). Placeholder. */
export const SLOW_MO_TIME_SCALE = 0.4;

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

/** Prompt do estado `ready` (2.5): centralizado, entre HUD (900) e overlay de pausa (1000). */
export const READY_PROMPT_DEPTH = 950;
export const READY_PROMPT_FONT_SIZE = '12px';
export const READY_PROMPT_COLOR = '#ffffff';

/** Game Over (2.6): overlay no estado `dead`. Entre o HUD (900) e a pausa (1000). */
export const GAMEOVER_OVERLAY_ALPHA = 0.6;
export const GAMEOVER_OVERLAY_DEPTH = 960; // fundo escuro
export const GAMEOVER_CONTENT_DEPTH = 970; // título/stats/botões (acima do fundo)
export const GAMEOVER_TITLE_FONT_SIZE = '16px';
export const GAMEOVER_STAT_FONT_SIZE = '9px';
export const GAMEOVER_BUTTON_FONT_SIZE = '11px';
export const GAMEOVER_TEXT_COLOR = '#ffffff';
export const GAMEOVER_BUTTON_COLOR = '#ffe08a'; // Reiniciar (ativo)
export const GAMEOVER_BUTTON_DISABLED_COLOR = '#777777'; // Sair (stub desabilitado)

/** Teclas de confirmação que reiniciam quando em `dead` (conveniência desktop). */
export const CONFIRM_KEYS: readonly string[] = ['Space', 'ArrowUp', 'Enter'];
