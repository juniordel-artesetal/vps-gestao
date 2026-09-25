'use client'
// SOA Edition — MAPEAR AS FACES (uma vez por molde): "papel da frente" → clica na frente da caixa 1, 2, 3…
// O clique acha o painel do molde (a área clara cercada pelas linhas) e vira a face daquele papel.
// Molde do acervo já vem mapeado (dá para corrigir). Molde próprio: mapeia 1x + medidas da caixa montada.
import { useEffect, useRef, useState } from 'react'
import { Loader2, RotateCw, Trash2, X, Save } from 'lucide-react'
import { FACE_ROLES, type FaceMolde, type FaceRole, type FormaFace, type MoldeCaixa } from '@/lib/estudio/caixasTipos'
import { carregarMoldeCaixa, type MoldeCarregado } from '@/lib/estudio/caixasCliente'
import { montagemCuboide } from '@/lib/estudio/montada'

const CORES: Record<FaceRole, string> = { frente: '#f97316', lateral_esquerda: '#0ea5e9', lateral_direita: '#22c55e', tras: '#a855f7', cima: '#eab308', fundo: '#64748b' }
const PREVIA = 560

/** Painel clicado: inunda a área clara a partir do clique com as linhas "engrossadas" (vinco tracejado não vaza). */
function regiaoDoClique(c: HTMLCanvasElement, px: number, py: number): { x: number; y: number; w: number; h: number } | null {
  const W = c.width, H = c.height
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data
  const escuro = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) { const l = 0.3 * d[p * 4] + 0.59 * d[p * 4 + 1] + 0.11 * d[p * 4 + 2]; if (d[p * 4 + 3] > 40 && l < 205) escuro[p] = 1 }
  const R = Math.max(2, Math.round(Math.max(W, H) / 220))
  const muro = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (escuro[y * W + x]) {
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) muro[ny * W + nx] = 1 }
  }
  const x0 = Math.round(px), y0 = Math.round(py)
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H || muro[y0 * W + x0]) return null
  const visto = new Uint8Array(W * H), fila = [y0 * W + x0]; visto[fila[0]] = 1
  let minX = x0, maxX = x0, minY = y0, maxY = y0, tocouBorda = false
  for (let q = 0; q < fila.length; q++) {
    const p = fila[q], x = p % W, y = (p - x) / W
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) tocouBorda = true
    for (const n of [p - 1, p + 1, p - W, p + W]) {
      if (n < 0 || n >= W * H || visto[n] || muro[n]) continue
      const nx = n % W; if (Math.abs(nx - x) > 1) continue
      visto[n] = 1; fila.push(n)
    }
  }
  if (tocouBorda) return null   // clicou fora do molde
  // devolve o que a linha engrossada "comeu"
  minX = Math.max(0, minX - R); minY = Math.max(0, minY - R); maxX = Math.min(W - 1, maxX + R); maxY = Math.min(H - 1, maxY + R)
  return { x: minX / W, y: minY / H, w: (maxX - minX + 1) / W, h: (maxY - minY + 1) / H }
}

export default function MapearFaces({ moldes, onFechar, onSalvo }: { moldes: MoldeCaixa[]; onFechar: () => void; onSalvo: () => void }) {
  const [carregados, setCarregados] = useState<MoldeCarregado[] | null>(null)
  const [faces, setFaces] = useState<Record<string, FaceMolde[]>>(() => Object.fromEntries(moldes.map(m => [m.id, m.faces || []])))
  const [dims, setDims] = useState<Record<string, { l: string; p: string; a: string }>>(() => Object.fromEntries(moldes.map(m => [m.id, { l: String(m.montagem?.dims.l || ''), p: String(m.montagem?.dims.p || ''), a: String(m.montagem?.dims.a || '') }])))
  const [papel, setPapel] = useState<FaceRole>('frente')
  const [sel, setSel] = useState<{ molde: string; face: string } | null>(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const previas = useRef<Record<string, HTMLCanvasElement>>({})

  useEffect(() => {
    let vivo = true
    Promise.all(moldes.map(carregarMoldeCaixa)).then(cs => { if (vivo) setCarregados(cs) }).catch(e => setErro((e as Error).message))
    return () => { vivo = false }
  }, [moldes])

  function previa(mc: MoldeCarregado): HTMLCanvasElement {
    let c = previas.current[mc.molde.id]
    if (!c) {
      const k = PREVIA / Math.max(mc.W, mc.H)
      c = document.createElement('canvas'); c.width = Math.round(mc.W * k); c.height = Math.round(mc.H * k)
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(mc.dieLine, 0, 0, c.width, c.height)
      previas.current[mc.molde.id] = c
    }
    return c
  }

  function clicar(mc: MoldeCarregado, e: React.MouseEvent<HTMLCanvasElement>) {
    const alvo = e.currentTarget, r = alvo.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width), y = ((e.clientY - r.top) / r.height)
    const lista = faces[mc.molde.id] || []
    const existente = lista.find(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h)
    if (existente) { setSel({ molde: mc.molde.id, face: existente.id }); return }
    const base = previa(mc)
    const reg = regiaoDoClique(base, x * base.width, y * base.height)
    if (!reg) { setErro('Clique DENTRO de um painel do molde (a área clara entre as linhas).'); return }
    setErro('')
    const iguais = lista.filter(f => f.role === papel).length
    const nova: FaceMolde = { id: iguais ? `${papel}_${iguais + 1}` : papel, role: papel, ...reg, rot: 0, forma: 'retangulo' }
    setFaces(fs => ({ ...fs, [mc.molde.id]: [...lista, nova] }))
    setSel({ molde: mc.molde.id, face: nova.id })
  }

  const mudarFace = (m: string, id: string, p: Partial<FaceMolde>) => setFaces(fs => ({ ...fs, [m]: (fs[m] || []).map(f => (f.id === id ? { ...f, ...p } : f)) }))
  const tirarFace = (m: string, id: string) => { setFaces(fs => ({ ...fs, [m]: (fs[m] || []).filter(f => f.id !== id) })); setSel(null) }

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      for (const m of moldes) {
        const fs = faces[m.id] || []
        const d = dims[m.id]
        const l = Number(String(d?.l).replace(',', '.')), p = Number(String(d?.p).replace(',', '.')), a = Number(String(d?.a).replace(',', '.'))
        const montagem = m.tipo === 'acervo' ? m.montagem : (l > 0 && p > 0 && a > 0 ? montagemCuboide(fs, { l, p, a }) : null)
        const r = await fetch(`/api/estudio/moldes-caixa/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ faces: fs, montagem }) })
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Não consegui salvar.')
      }
      onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  const faceSel = sel ? (faces[sel.molde] || []).find(f => f.id === sel.face) : null
  const inp = 'w-16 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs bg-white dark:bg-gray-800'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Mapear as faces</h3>
            <p className="text-xs text-gray-500">Escolha o papel (ex.: <b>Frente</b>) e clique na frente de cada caixa. Faça isso uma vez — depois o que você puser numa face vai para a mesma face de todas as caixas.</p>
          </div>
          <button onClick={onFechar}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FACE_ROLES.map(r => (
            <button key={r.id} onClick={() => setPapel(r.id)} className={`rounded-lg px-3 py-1.5 text-xs font-medium border ${papel === r.id ? 'text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'}`} style={papel === r.id ? { background: CORES[r.id] } : undefined}>
              Papel: {r.nome}
            </button>
          ))}
        </div>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        {!carregados ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo os moldes…</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {carregados.map(mc => (
              <div key={mc.molde.id} className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{mc.molde.nome}</p>
                <div className="relative inline-block max-w-full">
                  <CanvasPrevia fonte={previa(mc)} onClick={e => clicar(mc, e)} />
                  {(faces[mc.molde.id] || []).map(f => {
                    const ativa = sel?.molde === mc.molde.id && sel.face === f.id
                    return (
                      <div key={f.id} className="absolute pointer-events-none flex items-center justify-center" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`, background: `${CORES[f.role]}33`, outline: `2px solid ${CORES[f.role]}`, outlineOffset: ativa ? 2 : 0 }}>
                        <span className="text-[9px] font-bold text-white rounded px-1" style={{ background: CORES[f.role], transform: `rotate(${-f.rot}deg)` }}>↑ {FACE_ROLES.find(r => r.id === f.role)?.nome}</span>
                      </div>
                    )
                  })}
                </div>
                {mc.molde.tipo === 'proprio' && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500">
                    Caixa montada (cm):
                    {(['l', 'p', 'a'] as const).map(k => (
                      <input key={k} className={inp} placeholder={k === 'l' ? 'largura' : k === 'p' ? 'profund.' : 'altura'} inputMode="decimal" value={dims[mc.molde.id]?.[k] || ''} onChange={e => setDims(d => ({ ...d, [mc.molde.id]: { ...d[mc.molde.id], [k]: e.target.value.replace(/[^\d.,]/g, '') } }))} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {faceSel && sel && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold">Face selecionada:</span>
            <select className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800" value={faceSel.role} onChange={e => mudarFace(sel.molde, faceSel.id, { role: e.target.value as FaceRole })}>
              {FACE_ROLES.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            <button onClick={() => mudarFace(sel.molde, faceSel.id, { rot: (((faceSel.rot + 90) % 360) as FaceMolde['rot']) })} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1"><RotateCw className="w-3.5 h-3.5" /> Girar o topo ({faceSel.rot}°)</button>
            <select className="border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800" value={faceSel.forma} onChange={e => mudarFace(sel.molde, faceSel.id, { forma: e.target.value as FormaFace })}>
              <option value="retangulo">Retângulo</option><option value="triangulo">Triângulo</option><option value="coracao">Coração</option><option value="trapezio">Trapézio</option>
            </select>
            <button onClick={() => tirarFace(sel.molde, faceSel.id)} className="inline-flex items-center gap-1 text-red-600"><Trash2 className="w-3.5 h-3.5" /> Tirar</button>
            <span className="text-gray-400">A seta ↑ mostra o TOPO da face com a caixa em pé — gire até ela apontar para cima da caixa.</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onFechar} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !carregados} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar faces
          </button>
        </div>
      </div>
    </div>
  )
}

/** Mostra um canvas pronto (cópia) com largura responsiva. */
export function CanvasPrevia({ fonte, onClick, className, onPointerDown, onPointerMove, onPointerUp }: {
  fonte: HTMLCanvasElement; onClick?: (e: React.MouseEvent<HTMLCanvasElement>) => void; className?: string
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>) => void; onPointerMove?: (e: React.PointerEvent<HTMLCanvasElement>) => void; onPointerUp?: (e: React.PointerEvent<HTMLCanvasElement>) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    c.width = fonte.width; c.height = fonte.height
    c.getContext('2d')!.drawImage(fonte, 0, 0)
  }, [fonte])
  return <canvas ref={ref} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className={className || 'max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 cursor-crosshair touch-none'} />
}
