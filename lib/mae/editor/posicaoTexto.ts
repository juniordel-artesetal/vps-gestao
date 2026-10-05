// Posição de texto da base (Lote 1): mudar o TAMANHO mantendo a proporção — caixa e fonte juntas.
/** Tamanho da posição de texto × k em volta do centro (caixa e tamanho da fonte juntos = proporção mantida). */
export function escalarPosicao(s: { box: { x: number; y: number; w: number; h: number }; single?: { sizePt: number }; compound?: { sizePt: number } }, k: number) {
  const r3 = (x: number) => Math.round(x * 1000) / 1000
  const kk = Math.min(4, Math.max(0.25, k))
  const cx = s.box.x + s.box.w / 2, cy = s.box.y + s.box.h / 2
  s.box.w = r3(Math.min(2, s.box.w * kk)); s.box.h = r3(Math.min(2, s.box.h * kk))
  s.box.x = r3(cx - s.box.w / 2); s.box.y = r3(cy - s.box.h / 2)
  if (s.single) s.single.sizePt = Math.round(s.single.sizePt * kk * 10) / 10
  if (s.compound) s.compound.sizePt = Math.round(s.compound.sizePt * kk * 10) / 10
}
