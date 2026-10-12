// MAE — gera o KIT DE DESEMPENHO (Lote 9, item 135): base com 9 pranchetas (os 6 moldes reais de
// docs/mae-exemplos/moldes + MILK, CUBO e PIRÂMIDE de novo), FRENTE (sugestão por molde) e FUNDO (o resto das
// faces), tema com papel por parte, 3 elementos com efeitos e o bloco Nome + idade com frase. Usado pelo harness
// de desempenho no Chrome (fabtest/ui_mae_lote9_perf.mts). Saída: JSON com base, tema e os arquivos usados.
//   npx tsx scripts/mae-gerar-kit-perf.mts <saida.json>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { atribuirFace, garantirPartesPadrao, sugerirParaParte } from '@/lib/mae/vinculo/partes'
import { facesParaReceita } from '@/lib/mae/editor/moldes'
import { novoDocumento } from '@/lib/mae/schema/documento'
import { DocTema } from '@/lib/mae/schema/tema'
import { ESTILO_PADRAO } from '@/lib/mae/texto/noTexto'
import { abrirMoldeReal, MOLDES } from '@/lib/mae/__tests__/moldesReais'

const saida = process.argv[2] || 'kit-perf.json'
const TEMA_DIR = join(process.cwd(), 'docs/mae-exemplos/tema-exemplo')
const sha = (f: string) => createHash('sha256').update(readFileSync(join(TEMA_DIR, f))).digest('hex')
const arqs = readdirSync(TEMA_DIR).filter(f => f.endsWith('.png')).sort()
const papeis = arqs.filter(f => f.includes('10_38_12') || f.includes('09_48_09'))
const elementos = arqs.filter(f => !papeis.includes(f)).slice(0, 3)
const img = (pasta: string, f: string) => ({ path: `${pasta}/${f}`, sha256: sha(f), aspect: 1 })

const d = novoDocumento('A4')
d.name = 'KIT PERF 9 pranchetas'
d.artboards = []
const nomes = [...MOLDES, 'MILK.pdf', 'CUBO COM ALÇA.pdf', 'PIRÂMIDE.pdf']
const cache = new Map<string, Awaited<ReturnType<typeof abrirMoldeReal>>>()
let i = 0
for (const nome of nomes) {
  const m = cache.get(nome) ?? await abrirMoldeReal(nome)
  cache.set(nome, m)
  const id = `m${++i}`
  const { wMm, hMm } = m.prep.recorte
  d.artboards.push({ id: `ab${i}`, widthMm: 297, heightMm: 210, name: `${nome.replace('.pdf', '')} ${i}` })
  d.molds.push({ id, name: nome.replace('.pdf', ''), artboardId: `ab${i}`, transform: { xMm: Math.round((297 - wMm) / 2), yMm: Math.round((210 - hMm) / 2), rotationDeg: 0 },
    source: { path: `Bases/moldes/${nome}`, sha256: String(i).padEnd(64, '0'), widthMm: wMm, heightMm: hMm, kind: 'pdf', page: 1, crop: m.prep.recorte },
    faces: facesParaReceita(id, m.det.faces) })
}
garantirPartesPadrao(d)
const area = (p: [number, number][]) => { let s = 0; for (let a = 0, b = p.length - 1; a < p.length; b = a++) s += p[b][0] * p[a][1] - p[a][0] * p[b][1]; return Math.abs(s / 2) }
const milk = d.molds[0]
atribuirFace(d, 'p_frente', [...milk.faces].filter(f => !f.hole).sort((a, b) => area(b.polygonMm as never) - area(a.polygonMm as never))[0].id)
for (const s of sugerirParaParte(d, 'p_frente')) atribuirFace(d, 'p_frente', s.faceId)
const naFrente = new Set(d.parts.find(p => p.id === 'p_frente')!.instances.map(x => x.faceId))
const fundo = d.parts.find(p => p.id !== 'p_frente') ?? d.parts[1]
for (const m of d.molds) for (const f of m.faces) if (!f.hole && !naFrente.has(f.id) && area(f.polygonMm as never) > 200) atribuirFace(d, fundo.id, f.id)
for (const p of d.parts) if (p.id === 'p_frente') p.referenceAspect = 1
d.textSlots = d.parts.find(p => p.id === 'p_frente')!.instances.map((x, j) => ({
  id: `t${j}`, variable: 'NOME_IDADE', faceId: x.faceId, box: { x: 0.1, y: 0.55, w: 0.8, h: 0.35 },
  single: { lines: 1, sizePt: 30 }, compound: { lines: 2, sizePt: 24 },
  frase: { posicao: 'acima', tamanhoPct: 0.45, espaco: 0.05 }, bloco: { arranjo: 'empilhado', idadePct: 0.55, espaco: 0.05 },
})) as never
const efeitos = [
  { type: 'dropShadow', color: '#000000', opacity: 0.45, angleDeg: 120, distanceMm: 0.7, sizeMm: 0.8, spread: 0, blendMode: 'multiply', enabled: true },
  { type: 'stroke', sizeMm: 1, color: '#ffffff', position: 'outside', enabled: true, opacity: 1 },
]
const tema = DocTema.parse({
  schemaVersion: 1, type: 'theme', id: 'tema_perf', version: 1, name: 'KIT PERF', baseId: d.id, baseVersion: d.version ?? 1,
  partContent: {
    p_frente: [
      { id: 'papel_f', type: 'image', anchor: 'paper', ...img('Papéis', papeis[0]) },
      ...elementos.map((e, k) => ({ id: `el${k}`, type: 'image', anchor: 'face', ...img('Elementos', e), effects: efeitos, transform: { x: 0.25 + k * 0.25, y: 0.3, scale: 0.3, rotationDeg: 0 } })),
    ],
    [fundo.id]: [{ id: 'papel_b', type: 'image', anchor: 'paper', ...img('Papéis', papeis[1] ?? papeis[0]) }],
  },
  textStyles: { NOME: { ...JSON.parse(JSON.stringify(ESTILO_PADRAO)), color: '#7c2d12', effects: [{ type: 'stroke', sizeMm: 1.2, color: '#ffffff', position: 'outside', enabled: true, opacity: 1 }] } },
  sample: { NOME: 'Maria Júlia', IDADE: '5', FRASE: 'A Pequena' },
})
writeFileSync(saida, JSON.stringify({ base: d, tema, arquivos: [...papeis.map(f => `Papéis/${f}`), ...elementos.map(f => `Elementos/${f}`)] }))
console.log(`ok: ${d.artboards.length} pranchetas, ${d.molds.reduce((s, m) => s + m.faces.length, 0)} faces, frente ${naFrente.size}, ${fundo.name ?? fundo.id} ${fundo.instances.length}`)
