import { describe, it, expect } from 'vitest';
import { isHorizontallyVisible } from '@render/culling';

// viewWidth=320. Assinatura: (worldX, extentLeft, extentRight, cameraScrollX, viewWidth, margin)
describe('isHorizontallyVisible', () => {
  it('entidade no centro da tela é visível', () => {
    // worldX=160, scrollX=0 ⇒ tela [150,170] dentro de [0,320]
    expect(isHorizontallyVisible(160, -10, 10, 0, 320, 0)).toBe(true);
  });

  it('entidade totalmente à esquerda da câmera é cullada', () => {
    // worldX=100, scrollX=200 ⇒ right edge de tela = 100+10-200 = -90 < 0
    expect(isHorizontallyVisible(100, -10, 10, 200, 320, 0)).toBe(false);
  });

  it('entidade totalmente à direita do viewport é cullada', () => {
    // worldX=540, scrollX=0 ⇒ left edge de tela = 540-10-0 = 530 > 320
    expect(isHorizontallyVisible(540, -10, 10, 0, 320, 0)).toBe(false);
  });

  it('entidade tocando a borda esquerda (screen maxX = 0) é visível com margin 0', () => {
    // worldX=190, scrollX=200 ⇒ maxX de tela = 190+10-200 = 0 ⇒ >= 0 ⇒ visível
    expect(isHorizontallyVisible(190, -10, 10, 200, 320, 0)).toBe(true);
  });

  it('a margin amplia a janela visível (entidade logo à esquerda entra)', () => {
    // worldX=185, scrollX=200 ⇒ maxX de tela = 185+10-200 = -5. margin 0 ⇒ fora; margin 8 ⇒ dentro
    expect(isHorizontallyVisible(185, -10, 10, 200, 320, 0)).toBe(false);
    expect(isHorizontallyVisible(185, -10, 10, 200, 320, 8)).toBe(true);
  });
});
