// SOA Design — ARQUIVOS DE CORTE (Fase 6, spec 47): as silhuetas expandidas que o motor de apliques já calculou
// (personagem + contorno dourado 3 mm + base rosa 2 mm…) viram linhas de corte VETORIAIS, uma por camada, alinhadas,
// na ESCALA REAL (mm) — SVG, DXF R12 (Silhouette/plotter) e PDF vetorial. A artesã imprime E corta do mesmo lugar.
export interface CamadaCorte { nome: string; contornos: [number, number][][] }
export interface ArquivoCorte { nome: string; blob: Blob }

const MARGEM = 3   // mm em volta
/** Leva tudo para coordenadas positivas (mm) com margem — a mesma âncora para todas as camadas (alinhadas). */
function normalizar(camadas: CamadaCorte[]) {
  const pts = camadas.flatMap(c => c.contornos.flat())
  if (!pts.length) throw new Error('Este aplique ainda não tem silhuetas — salve ou gere de novo.')
  const x0 = Math.min(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), x1 = Math.max(...pts.map(p => p[0])), y1 = Math.max(...pts.map(p => p[1]))
  const W = x1 - x0 + 2 * MARGEM, H = y1 - y0 + 2 * MARGEM
  const cs = camadas.map(c => ({ nome: c.nome, aneis: c.contornos.filter(a => a.length >= 3).map(a => a.map(([x, y]) => [x - x0 + MARGEM, y - y0 + MARGEM] as [number, number])) }))
  return { W, H, cs }
}
const CORES = ['#e11d48', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
const seguro = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 31) || 'CAMADA'

export function svgCorte(camadas: CamadaCorte[], titulo = 'aplique'): string {
  const { W, H, cs } = normalizar(camadas)
  const g = cs.map((c, i) => `  <g id="${seguro(c.nome)}" fill="none" stroke="${CORES[i % CORES.length]}" stroke-width="0.25">\n${c.aneis.map(a => `    <path d="M${a.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L')} Z"/>`).join('\n')}\n  </g>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- SOA Design · ${titulo} · linhas de corte por camada, escala real (mm) -->\n<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(2)}mm" height="${H.toFixed(2)}mm" viewBox="0 0 ${W.toFixed(3)} ${H.toFixed(3)}">\n${g}\n</svg>\n`
}

/** DXF R12 (AC1009): POLYLINE fechada por anel, uma LAYER por camada, unidades mm, Y para cima (padrão CAD). */
export function dxfCorte(camadas: CamadaCorte[]): string {
  const { H, cs } = normalizar(camadas)
  const L: string[] = []
  const p = (c: number | string, v: number | string) => { L.push(String(c), String(v)) }
  p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$INSUNITS'); p(70, 4); p(9, '$MEASUREMENT'); p(70, 1); p(0, 'ENDSEC')
  p(0, 'SECTION'); p(2, 'TABLES'); p(0, 'TABLE'); p(2, 'LAYER'); p(70, cs.length)
  cs.forEach((c, i) => { p(0, 'LAYER'); p(2, seguro(c.nome)); p(70, 0); p(62, [1, 5, 3, 6, 30, 4][i % 6]); p(6, 'CONTINUOUS') })
  p(0, 'ENDTAB'); p(0, 'ENDSEC')
  p(0, 'SECTION'); p(2, 'ENTITIES')
  for (const c of cs) for (const a of c.aneis) {
    p(0, 'POLYLINE'); p(8, seguro(c.nome)); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, 1)
    for (const [x, y] of a) { p(0, 'VERTEX'); p(8, seguro(c.nome)); p(10, x.toFixed(4)); p(20, (H - y).toFixed(4)); p(30, 0) }
    p(0, 'SEQEND'); p(8, seguro(c.nome))
  }
  p(0, 'ENDSEC'); p(0, 'EOF')
  return L.join('\r\n') + '\r\n'
}

/** PDF vetorial no tamanho real (1 mm = 72/25,4 pt), uma cor por camada. */
export async function pdfCorte(camadas: CamadaCorte[], titulo = 'aplique'): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib')
  const { W, H, cs } = normalizar(camadas)
  const k = 72 / 25.4
  const doc = await PDFDocument.create()
  doc.setTitle(`SOA Design · ${titulo} · corte`); doc.setCreator('SOA Design')
  const pg = doc.addPage([W * k, H * k])
  cs.forEach((c, i) => {
    const hx = CORES[i % CORES.length], n = parseInt(hx.slice(1), 16), cor = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
    for (const a of c.aneis) {
      // drawSvgPath: coordenadas SVG (y para baixo) a partir do canto superior-esquerdo (x, y = altura da página)
      const d = `M${a.map(([x, y]) => `${(x * k).toFixed(2)} ${(y * k).toFixed(2)}`).join(' L')} Z`
      pg.drawSvgPath(d, { x: 0, y: H * k, borderColor: cor, borderWidth: 0.5 })
    }
  })
  return doc.save()
}

export async function arquivosDeCorte(camadas: CamadaCorte[], nome: string, formatos: ('svg' | 'dxf' | 'pdf')[]): Promise<ArquivoCorte[]> {
  const out: ArquivoCorte[] = []
  if (formatos.includes('svg')) out.push({ nome: `${nome}_corte.svg`, blob: new Blob([svgCorte(camadas, nome)], { type: 'image/svg+xml' }) })
  if (formatos.includes('dxf')) out.push({ nome: `${nome}_corte.dxf`, blob: new Blob([dxfCorte(camadas)], { type: 'application/dxf' }) })
  if (formatos.includes('pdf')) out.push({ nome: `${nome}_corte.pdf`, blob: new Blob([(await pdfCorte(camadas, nome)) as BlobPart], { type: 'application/pdf' }) })
  return out
}
