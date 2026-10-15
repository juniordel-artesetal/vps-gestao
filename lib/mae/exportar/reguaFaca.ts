// Lote 19 (item 236): CORTE COM FACA (corte e vinco manual) — sem marca de registro, o papel encosta no esquadro e o
// desvio vem da faca. A FOLHA DE TESTE leva só o contorno de corte + réguas milimetradas atravessando a linha nos 4 lados
// de cada peça (−5 a +5 mm, o 0 em cima da linha certa). A usuária corta com a faca, lê onde o corte caiu e digita; o
// ajuste X/Y move a ARTE (e as linhas) na folha. Puro.

export type Caixa = { x: number; y: number; w: number; h: number }
export interface Regua { tracos: string; textos: { xMm: number; yMm: number; texto: string }[] }

/**
 * As réguas de uma peça (caixa do corte, mm da folha). Lados esquerdo/direito: régua na horizontal, + para a DIREITA;
 * topo/base: régua na vertical, + para BAIXO. Tracinho a cada 1 mm (maior no 0 e nos ±5) e número a cada 1 mm.
 */
export function reguasDaPeca(c: Caixa, alcance = 5): Regua {
  const partes: string[] = [], textos: Regua['textos'] = []
  const f = (v: number) => Math.round(v * 1000) / 1000
  const xm = c.x + c.w / 2, ym = c.y + c.h / 2
  for (const lado of ['esq', 'dir', 'topo', 'base'] as const) {
    for (let k = -alcance; k <= alcance; k++) {
      const t = k === 0 ? 3 : Math.abs(k) === alcance ? 2 : 1.2
      if (lado === 'esq' || lado === 'dir') {
        const x = (lado === 'esq' ? c.x : c.x + c.w) + k
        partes.push(`M${f(x)} ${f(ym - t / 2)}L${f(x)} ${f(ym + t / 2)}`)
        textos.push({ xMm: x, yMm: ym + (lado === 'esq' ? -2.6 : 3.4), texto: k > 0 ? `+${k}` : String(k) })
      } else {
        const y = (lado === 'topo' ? c.y : c.y + c.h) + k
        partes.push(`M${f(xm - t / 2)} ${f(y)}L${f(xm + t / 2)} ${f(y)}`)
        textos.push({ xMm: xm + (lado === 'topo' ? 2.2 : -4.2), yMm: y + 0.6, texto: k > 0 ? `+${k}` : String(k) })
      }
    }
    // o eixo da régua
    if (lado === 'esq' || lado === 'dir') { const x0 = lado === 'esq' ? c.x : c.x + c.w; partes.push(`M${f(x0 - alcance)} ${f(ym)}L${f(x0 + alcance)} ${f(ym)}`) }
    else { const y0 = lado === 'topo' ? c.y : c.y + c.h; partes.push(`M${f(xm)} ${f(y0 - alcance)}L${f(xm)} ${f(y0 + alcance)}`) }
  }
  return { tracos: partes.join(''), textos }
}

/**
 * "Onde a faca cortou em cada lado?" → quanto a ARTE anda (mm) para cair onde a faca corta. A faca deslocada corta
 * os dois lados opostos para o MESMO lado (esq +2 e dir +2 = a faca está 2 mm à direita); a média tira o erro de leitura.
 * Lado em branco = só usa o outro. Soma ao ajuste que já existe (a folha de teste sai com ele).
 */
export function ajusteDaFaca(lido: { esq?: number | null; dir?: number | null; topo?: number | null; base?: number | null }, atual = { xMm: 0, yMm: 0 }): { xMm: number; yMm: number } | null {
  const media = (a?: number | null, b?: number | null) => { const v = [a, b].filter((x): x is number => typeof x === 'number' && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null }
  const dx = media(lido.esq, lido.dir), dy = media(lido.topo, lido.base)
  if (dx === null && dy === null) return null
  const r2 = (v: number) => Math.round(v * 100) / 100
  return { xMm: r2(atual.xMm + (dx ?? 0)), yMm: r2(atual.yMm + (dy ?? 0)) }
}
