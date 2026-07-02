/**
 * Culling horizontal de render (REGRA 3, alocação-zero). O mundo cabe na ALTURA da view
 * (VIEW_HEIGHT == worldHeight), então num side-scroller só o eixo x sai da tela.
 * Uma entidade em worldX ocupa, em coords de tela, [worldX+extentLeft−scrollX,
 * worldX+extentRight−scrollX]; é visível sse esse intervalo intersecta [−margin, viewWidth+margin].
 */
export function isHorizontallyVisible(
  worldX: number,
  extentLeft: number,
  extentRight: number,
  cameraScrollX: number,
  viewWidth: number,
  margin: number,
): boolean {
  const screenMinX = worldX + extentLeft - cameraScrollX;
  const screenMaxX = worldX + extentRight - cameraScrollX;
  return screenMaxX >= -margin && screenMinX <= viewWidth + margin;
}
