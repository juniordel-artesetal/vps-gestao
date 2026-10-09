'use client'
'use no memo'
// Lote 5 (item 76): FOLHAS DE IMPRESSÃO MONTADAS (Base) — rótulos, adesivos, etiquetas: várias peças numa folha.
// Criar a folha (tamanho + marca de registro, cuja área fica livre), "Preencher folha" com uma peça (o máximo que
// cabe, em pé ou deitada), folha MISTA (4 de 9×5 + 10 de 5×2), ajuste à mão (arrastar, girar 90°), aproveitamento
// ("38 peças · 87% da folha usada") e o grupo do produto que usa a folha (1 kit = 1 folha).
import { useEffect, useRef, useState } from 'react'
import { FilePlus2, LayoutGrid, RotateCw, Trash2, Wand2 } from 'lucide-react'
import { useBiblioteca, useMaeDoc } from '@/lib/mae/editor/loja'
import { aproveitamento, criarFolha, excluirFolha, folhasDa, organizarFolha, sobrepostas, tamanhoPeca } from '@/lib/mae/editor/folhaMontada'
import { gruposDa } from '@/lib/mae/editor/grupos'
import { marcaNaFolha, zonasNaFolha } from '@/lib/mae/exportar/marca'
import { medidasFolha } from '@/lib/mae/schema'
import { useMarcas, carregarMarcas, marcaDaPrancheta } from './marcasMae'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const sel = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs'

export default function PainelFolhas() {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const marcas = useMarcas(s => s.marcas)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  useEffect(() => { if (raiz && liberada && !useMarcas.getState().marcas.length) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])
  const folhas = folhasDa(doc)
  const [atual, setAtual] = useState<string | null>(folhas[0]?.id ?? null)
  const f = folhas.find(x => x.id === atual) ?? folhas[0] ?? null
  const [peca, setPeca] = useState<string>('')
  const [qtd, setQtd] = useState('')
  const [mista, setMista] = useState<{ moldeId: string; quantidade: number }[]>([])
  const [selPeca, setSelPeca] = useState<number | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{ i: number; dx: number; dy: number } | null>(null)

  const marca = f ? marcaDaPrancheta(f, marcas) : null
  const zonas = f && marca ? zonasNaFolha(marca.zonas, marcaNaFolha(f.widthMm, f.heightMm, marca.wMm, marca.hMm), marca.hMm) : []
  const mudarFolha = (label: string, g: (x: NonNullable<typeof f>) => void, j?: string) => { if (f) aplicar(label, d => { const x = folhasDa(d).find(y => y.id === f.id); if (x) g(x) }, j) }
  function organizarCom(pedidas: { moldeId: string; quantidade?: number }[], label: string) {
    if (!f) return
    const r = organizarFolha(f, pedidas, doc.molds, zonas)
    mudarFolha(label, x => { x.pecas = r.pecas })
    setAviso(r.ficaram ? `${r.ficaram} peça(s) não couberam nesta folha.` : null)
  }
  // coordenadas do ponteiro em mm da folha
  const emMm = (e: React.PointerEvent) => { const s = svg.current; if (!s) return [0, 0]; const p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(s.getScreenCTM()!.inverse()); return [q.x, q.y] }
  const ap = f ? aproveitamento(f, doc.molds) : null
  const sobre = f ? sobrepostas(f, doc.molds) : []
  return (
    <section className="space-y-2" data-painel-folhas>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Folhas de impressão</h2>
        <button className={btn} onClick={() => { const m = medidasFolha('A4', 'retrato'); let id = ''; aplicar('Nova folha de impressão', d => { id = criarFolha(d, { nome: `Folha ${folhasDa(d).length + 1}`, ...m, ...(marcas[0] ? { registrationPresetId: marcas[0].id, registrationPresetSha: marcas[0].sha256 } : {}) }) }); setAtual(id) }} data-nova-folha><FilePlus2 className="w-3.5 h-3.5" /> Nova folha</button>
      </div>
      <p className="text-[11px] text-gray-500">Para peças pequenas (rótulo, adesivo, etiqueta): cada peça é um molde desta base; a folha diz quantas cabem e onde. Na edição em massa, o produto ligado à folha sai com a folha montada (1 kit = 1 folha), com a marca de registro e o arquivo de corte.</p>
      {folhas.length > 1 && <select className={sel + ' w-full'} value={f?.id ?? ''} onChange={e => setAtual(e.target.value)}>{folhas.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>}
      {!f ? <p className="text-[11px] text-gray-400">Nenhuma folha ainda.</p> : (
        <div className="space-y-2" data-folha={f.nome}>
          <div className="flex flex-wrap items-center gap-1">
            <input defaultValue={f.nome} key={f.id} onBlur={e => mudarFolha('Nome da folha', x => { x.nome = e.target.value.trim().slice(0, 80) || x.nome })} className={sel + ' flex-1 min-w-0 font-semibold'} data-nome-folha />
            <button className={btn} onClick={() => { if (confirm(`Excluir a folha ${f.nome}?`)) aplicar('Excluir folha', d => excluirFolha(d, f.id)) }} aria-label="Excluir folha"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <select className={sel} value="" onChange={e => { const v = e.target.value as 'A4'; if (!v) return; const [fo, ori] = v.split(':') as ['A4', 'retrato']; const m = medidasFolha(fo, ori); mudarFolha('Tamanho da folha', x => { x.widthMm = m.widthMm; x.heightMm = m.heightMm; x.pecas = [] }) }}>
              <option value="">{Math.round(f.widthMm)} × {Math.round(f.heightMm)} mm…</option>
              {(['A4', 'A5'] as const).flatMap(fo => (['retrato', 'paisagem'] as const).map(o => <option key={fo + o} value={`${fo}:${o}`}>{fo} {o}</option>))}
            </select>
            <select className={sel} value={f.registrationPresetId ?? ''} onChange={e => { const m = marcas.find(x => x.id === e.target.value); mudarFolha('Marca da folha', x => { if (m) { x.registrationPresetId = m.id; x.registrationPresetSha = m.sha256 } else { delete x.registrationPresetId; delete x.registrationPresetSha } }) }} data-marca-folha>
              <option value="">Sem marca de registro</option>{marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            <label className="flex items-center gap-1">Espaço <input type="text" inputMode="decimal" defaultValue={String(f.espacoMm).replace('.', ',')} key={`e${f.id}`} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v >= 0 && v <= 50) mudarFolha('Espaço entre as peças', x => { x.espacoMm = v }) }} className="w-10 rounded border border-gray-200 bg-transparent px-1" /> mm</label>
          </div>
          {/* Lote 5 (item 76): como os pedidos ocupam a folha na edição em massa */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <select className={sel} value={f.tipo ?? 'kit'} onChange={e => mudarFolha('Tipo da folha', x => { x.tipo = e.target.value as 'kit' | 'avulso' })} title="Kit: as peças de um pedido nunca se dividem entre folhas. Avulso: peças soltas preenchem os buracos e continuam na próxima folha." data-tipo-folha>
              <option value="kit">Kit (não divide entre folhas)</option><option value="avulso">Avulso (preenche e continua)</option>
            </select>
            {f.tipo === 'avulso' && <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={!!f.completarUltima} onChange={e => mudarFolha('Completar a última folha', x => { x.completarUltima = e.target.checked })} data-completar-ultima /> Completar a última folha com cópias</label>}
          </div>
          {/* preencher com uma peça / folha mista */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <select className={sel + ' flex-1 min-w-0'} value={peca} onChange={e => setPeca(e.target.value)} data-peca-folha>
                <option value="">Peça (molde)…</option>{doc.molds.map(m => <option key={m.id} value={m.id}>{m.name} ({Math.round(m.source.widthMm)}×{Math.round(m.source.heightMm ?? m.source.widthMm)} mm)</option>)}
              </select>
              <input type="text" inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, ''))} placeholder="máx." className="w-12 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs" title="Quantas (vazio = o máximo que cabe)" />
              <button className={btn} disabled={!peca} onClick={() => organizarCom([{ moldeId: peca, ...(qtd ? { quantidade: Number(qtd) } : {}) }], 'Preencher folha')} data-preencher-folha><Wand2 className="w-3.5 h-3.5" /> Preencher folha</button>
              <button className={btn} disabled={!peca || !qtd} onClick={() => setMista(l => [...l.filter(x => x.moldeId !== peca), { moldeId: peca, quantidade: Number(qtd) }])} title="Junta na lista da folha mista" data-somar-mista>+ na mista</button>
            </div>
            {mista.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px]" data-lista-mista>
                {mista.map(x => <span key={x.moldeId} className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5">{x.quantidade} × {doc.molds.find(m => m.id === x.moldeId)?.name}<button className="ml-1 text-gray-400" onClick={() => setMista(l => l.filter(y => y.moldeId !== x.moldeId))}>×</button></span>)}
                <button className={btn} onClick={() => organizarCom(mista, 'Folha mista')} data-organizar-mista><LayoutGrid className="w-3.5 h-3.5" /> Organizar folha mista</button>
              </div>
            )}
          </div>
          {ap && <p className="text-xs font-semibold text-gray-700 dark:text-gray-200" data-aproveitamento>{ap.pecas} peça{ap.pecas === 1 ? '' : 's'} · {ap.pct}% da folha usada{sobre.length ? <span className="text-amber-700 font-normal"> · {sobre.length} peça(s) se sobrepondo</span> : null}</p>}
          {aviso && <p className="text-[11px] text-amber-700">{aviso}</p>}
          {/* prévia: arrastar = mover; clique = escolher (Girar 90° / Tirar) */}
          <svg ref={svg} viewBox={`0 0 ${f.widthMm} ${f.heightMm}`} className="w-full rounded border border-gray-300 bg-white touch-none" style={{ aspectRatio: `${f.widthMm} / ${f.heightMm}` }} data-previa-folha
            onPointerMove={e => { const a = arrasto.current; if (!a) return; const [x, y] = emMm(e); mudarFolha('Mover peça', z => { const p = z.pecas[a.i]; if (p) { p.xMm = Math.round((x - a.dx) * 2) / 2; p.yMm = Math.round((y - a.dy) * 2) / 2 } }, `folha:mover:${a.i}`) }}
            onPointerUp={() => { arrasto.current = null }} onPointerLeave={() => { arrasto.current = null }}>
            {zonas.map((z, i) => <rect key={`z${i}`} x={z.x} y={z.y} width={z.w} height={z.h} fill="#94a3b8" opacity={0.35} />)}
            {f.pecas.map((p, i) => {
              const m = doc.molds.find(x => x.id === p.moldeId); if (!m) return null
              const t = tamanhoPeca(m, p.rot as 0 | 90)
              return (
                <g key={i} onPointerDown={e => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); const [x, y] = emMm(e); arrasto.current = { i, dx: x - p.xMm, dy: y - p.yMm }; setSelPeca(i) }} style={{ cursor: 'move' }} data-peca-na-folha={i}>
                  <rect x={p.xMm} y={p.yMm} width={t.w} height={t.h} fill={sobre.includes(i) ? '#fecaca' : '#ffedd5'} stroke={selPeca === i ? '#ea580c' : '#fb923c'} strokeWidth={selPeca === i ? 0.8 : 0.4} />
                  <text x={p.xMm + t.w / 2} y={p.yMm + t.h / 2} fontSize={Math.min(6, t.h / 3)} textAnchor="middle" dominantBaseline="middle" fill="#9a3412" pointerEvents="none">{m.name}</text>
                </g>
              )
            })}
          </svg>
          {selPeca !== null && f.pecas[selPeca] && (
            <div className="flex gap-1">
              <button className={btn} onClick={() => mudarFolha('Girar peça 90°', x => { const p = x.pecas[selPeca]; if (p) p.rot = p.rot === 90 ? 0 : 90 })} data-girar-peca><RotateCw className="w-3.5 h-3.5" /> Girar 90°</button>
              <button className={btn} onClick={() => { mudarFolha('Tirar peça', x => { x.pecas.splice(selPeca, 1) }); setSelPeca(null) }} data-tirar-peca><Trash2 className="w-3.5 h-3.5" /> Tirar</button>
            </div>
          )}
          {/* qual produto usa esta folha */}
          <label className="block text-[11px] text-gray-600">Produto (grupo) que sai nesta folha
            <select className={sel + ' w-full mt-0.5'} value={gruposDa(doc).find(g => g.folhaId === f.id)?.id ?? ''} onChange={e => aplicar('Grupo da folha', d => { for (const g of gruposDa(d)) { if (g.folhaId === f.id) delete g.folhaId; if (g.id === e.target.value) g.folhaId = f.id } })} data-grupo-folha>
              <option value="">— nenhum (crie grupos em Grupos de produto) —</option>
              {gruposDa(doc).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
            </select>
          </label>
        </div>
      )}
    </section>
  )
}
