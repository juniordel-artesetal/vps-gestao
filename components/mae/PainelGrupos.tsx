'use client'
'use no memo'
// Lote 5 — painéis da Base:
//  · item 72: GRUPOS DE PRODUTO (base de portfólio) — pastinhas no estilo camadas do Photoshop, cada uma ligada a
//    um produto do SOA; arrastar molde entre grupos (Alt = "usar também em", o mesmo molde em mais de um grupo);
//    criar, renomear, reordenar e excluir (os moldes vão para "Sem grupo");
//  · item 61: PRANCHETAS com painel próprio (lista, nova, tamanho/orientação, girar, duplicar, excluir, organizar).
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Folder, FolderPlus, Link2, Plus, RotateCw, Trash2, X } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { criarGrupo, excluirGrupo, gruposDa, ligarProduto, moldesSemGrupo, moverMoldeDeGrupo, renomearGrupo, reordenarGrupo, tirarDoGrupo, usarTambemEm } from '@/lib/mae/editor/grupos'
import { duplicarPrancheta, girarPrancheta, organizarPranchetas, redimensionarPrancheta, type ModoOrganizar } from '@/lib/mae/editor/pranchetas'
import { medidasFolha } from '@/lib/mae/schema'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { excluirSelecionada } from './PranchetasPalco'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ib = 'inline-flex items-center rounded p-0.5 text-gray-500 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-30'
const TIPO = 'application/x-mae-molde'

interface VariacaoSoa { id: string; produtoId?: string; nome: string | null; produtoNome: string }
let cacheProdutos: VariacaoSoa[] | null = null
async function produtosDoSoa(): Promise<VariacaoSoa[]> {
  if (cacheProdutos) return cacheProdutos
  const r = await fetch('/api/precificacao/variacoes').catch(() => null)
  const l = r?.ok ? await r.json().catch(() => []) : []
  cacheProdutos = Array.isArray(l) ? l : []
  return cacheProdutos
}

/** Item 72: o painel "Grupos de produto". */
export function PainelGrupos() {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const grupos = gruposDa(doc)
  const [produtos, setProdutos] = useState<VariacaoSoa[]>([])
  const [editando, setEditando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  useEffect(() => { void produtosDoSoa().then(setProdutos) }, [])
  const nomeMolde = (id: string) => doc.molds.find(m => m.id === id)?.name ?? id
  const semGrupo = moldesSemGrupo(doc)
  // produtos únicos (um por produto) + as variações (para ligar o grupo só a uma variação, ex.: Sacola P)
  const porProduto = new Map<string, { produtoId: string; nome: string; vars: VariacaoSoa[] }>()
  for (const v of produtos) {
    const pid = v.produtoId ?? `nome:${v.produtoNome}`
    const p = porProduto.get(pid) ?? { produtoId: pid, nome: v.produtoNome, vars: [] }
    p.vars.push(v); porProduto.set(pid, p)
  }

  function soltar(e: React.DragEvent, para: string | null) {
    e.preventDefault(); setSobre(null)
    const dado = e.dataTransfer.getData(TIPO)
    if (!dado) return
    const { molde, de } = JSON.parse(dado) as { molde: string; de: string | null }
    if (e.altKey && para) aplicar(`Usar ${nomeMolde(molde)} também em ${grupos.find(g => g.id === para)?.nome}`, d => usarTambemEm(d, molde, para))
    else aplicar(`${nomeMolde(molde)} → ${para ? grupos.find(g => g.id === para)?.nome : 'Sem grupo'}`, d => moverMoldeDeGrupo(d, molde, de, para))
  }
  const Molde = ({ id, de }: { id: string; de: string | null }) => (
    <li draggable onDragStart={e => { e.dataTransfer.setData(TIPO, JSON.stringify({ molde: id, de })); e.dataTransfer.effectAllowed = 'copyMove' }}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 cursor-grab" title="Arraste para outro grupo (Alt + arrastar: usar também lá)" data-molde-grupo={nomeMolde(id)}>
      <span className="truncate">{nomeMolde(id)}</span>
      {de && <span className="ml-auto flex items-center gap-0.5">
        <select value="" onChange={e => { const g = e.target.value; if (g) aplicar(`Usar ${nomeMolde(id)} também em…`, d => usarTambemEm(d, id, g)) }} className="bg-transparent text-[10px] text-gray-500 max-w-[5.5rem]" title="Usar também em… (mesmo molde, mesma arte)" data-usar-tambem>
          <option value="">Usar também em…</option>
          {grupos.filter(g => g.id !== de && !g.moldes.includes(id)).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <button className={ib} onClick={() => aplicar(`Tirar ${nomeMolde(id)} do grupo`, d => tirarDoGrupo(d, id, de))} title="Tirar deste grupo" aria-label="Tirar deste grupo"><X className="w-3 h-3" /></button>
      </span>}
    </li>
  )
  return (
    <section className="space-y-2" data-painel-grupos>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Grupos de produto</h2>
        <button className={btn} onClick={() => { let id = ''; aplicar('Novo grupo', d => { id = criarGrupo(d, `Grupo ${gruposDa(d).length + 1}`) }); setEditando(id) }} data-novo-grupo><FolderPlus className="w-3.5 h-3.5" /> Novo grupo</button>
      </div>
      <p className="text-[11px] text-gray-500">Uma base com todo o portfólio: cada grupo é um produto do SOA (Kit Festa, Sacola P, Tag…). O tema é criado uma vez e sai separado por grupo (&ldquo;Sereia · Kit Festa&rdquo;). Sem grupos, a base vale como um produto só.</p>
      <ul className="space-y-1.5" data-lista-grupos>
        {grupos.map((g, i) => (
          <li key={g.id} className={`rounded-lg border p-1.5 space-y-1 ${sobre === g.id ? 'border-orange-400 bg-orange-50/60' : 'border-gray-200 dark:border-gray-700'}`}
            onDragOver={e => { if (e.dataTransfer.types.includes(TIPO)) { e.preventDefault(); setSobre(g.id) } }} onDragLeave={() => setSobre(s => s === g.id ? null : s)} onDrop={e => soltar(e, g.id)} data-grupo={g.nome}>
            <div className="flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              {editando === g.id
                ? <input autoFocus defaultValue={g.nome} onFocus={e => e.target.select()} onBlur={e => { const v = e.target.value; aplicar('Renomear grupo', d => renomearGrupo(d, g.id, v)); setEditando(null) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditando(null) }} className="flex-1 min-w-0 rounded border border-orange-300 bg-transparent px-1 text-xs font-semibold" data-nome-grupo />
                : <b className="flex-1 min-w-0 truncate text-xs cursor-text" onDoubleClick={() => setEditando(g.id)} title="Clique duas vezes para renomear">{g.nome}</b>}
              <span className="text-[10px] text-gray-400">{g.moldes.length} molde{g.moldes.length === 1 ? '' : 's'}</span>
              <button className={ib} disabled={i === 0} onClick={() => aplicar('Subir grupo', d => reordenarGrupo(d, g.id, -1))} aria-label="Subir"><ChevronUp className="w-3.5 h-3.5" /></button>
              <button className={ib} disabled={i === grupos.length - 1} onClick={() => aplicar('Descer grupo', d => reordenarGrupo(d, g.id, 1))} aria-label="Descer"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button className={ib} onClick={() => { if (confirm(`Excluir o grupo ${g.nome}? Os moldes NÃO são apagados (ficam "Sem grupo").`)) aplicar('Excluir grupo', d => excluirGrupo(d, g.id)) }} aria-label="Excluir grupo" data-excluir-grupo><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            <label className="flex items-center gap-1 text-[11px] text-gray-600" title="O produto do SOA deste grupo — a edição em massa usa este grupo para os pedidos dele">
              <Link2 className="w-3 h-3 shrink-0" />
              <select value={g.variacaoId ? `v:${g.variacaoId}` : g.produtoId ? `p:${g.produtoId}` : ''} className="flex-1 min-w-0 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-[11px]" data-produto-grupo
                onChange={e => {
                  const v = e.target.value
                  if (!v) { aplicar('Desligar produto do grupo', d => ligarProduto(d, g.id, { produtoId: null })); return }
                  if (v.startsWith('p:')) { const p = porProduto.get(v.slice(2)); aplicar('Ligar grupo ao produto', d => ligarProduto(d, g.id, { produtoId: v.slice(2), produtoNome: p?.nome ?? null })); return }
                  const va = produtos.find(x => x.id === v.slice(2))
                  aplicar('Ligar grupo à variação', d => ligarProduto(d, g.id, { produtoId: va?.produtoId ?? null, variacaoId: v.slice(2), produtoNome: va ? `${va.produtoNome}${va.nome ? ` — ${va.nome}` : ''}` : null }))
                }}>
                <option value="">— ligar a um produto do SOA —</option>
                {[...porProduto.values()].map(p => (
                  <optgroup key={p.produtoId} label={p.nome}>
                    <option value={`p:${p.produtoId}`}>{p.nome} (todas as variações)</option>
                    {p.vars.filter(v => v.nome).map(v => <option key={v.id} value={`v:${v.id}`}>{p.nome} — {v.nome}</option>)}
                  </optgroup>
                ))}
                {g.produtoNome && !g.produtoId?.length && <option value="">{g.produtoNome}</option>}
              </select>
            </label>
            <ul className="space-y-0.5 pl-4">{g.moldes.map(m => <Molde key={m} id={m} de={g.id} />)}</ul>
            {!g.moldes.length && <p className="pl-4 text-[10px] text-gray-400">Arraste moldes para cá.</p>}
          </li>
        ))}
        <li className={`rounded-lg border border-dashed p-1.5 ${sobre === '_sem' ? 'border-orange-400 bg-orange-50/60' : 'border-gray-200 dark:border-gray-700'}`}
          onDragOver={e => { if (e.dataTransfer.types.includes(TIPO)) { e.preventDefault(); setSobre('_sem') } }} onDragLeave={() => setSobre(s => s === '_sem' ? null : s)} onDrop={e => soltar(e, null)} data-sem-grupo>
          <p className="text-[11px] font-semibold text-gray-500">Sem grupo ({semGrupo.length})</p>
          <ul className="space-y-0.5 pl-4 pt-0.5">{semGrupo.map(m => <Molde key={m} id={m} de={null} />)}</ul>
        </li>
      </ul>
      <p className="text-[10px] text-gray-400">As partes (FRENTE, LATERAL…) valem para a base toda: o papel arrastado uma vez vai para o portfólio inteiro.</p>
    </section>
  )
}

/** Item 72: no tema, quais grupos ele tem (ex.: tema sem rótulo → desmarca o grupo Rótulo). */
export function GruposDoTema() {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const grupos = gruposDa(doc)
  if (!tema || !grupos.length) return null
  const fora = new Set(tema.gruposDesligados ?? [])
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-0.5" data-grupos-tema>
      <p className="text-[11px] font-semibold">Este tema gera:</p>
      {grupos.map(g => (
        <label key={g.id} className="flex items-center gap-1.5 text-[11px]">
          <input type="checkbox" className="accent-orange-500" checked={!fora.has(g.id)} onChange={e => useMaeTema.getState().aplicar(e.target.checked ? `Tema com ${g.nome}` : `Tema sem ${g.nome}`, t => {
            const s = new Set((t as DocTema).gruposDesligados ?? [])
            if (e.target.checked) s.delete(g.id); else s.add(g.id)
            ;(t as DocTema).gruposDesligados = [...s]
          })} data-grupo-tema={g.nome} />
          {tema.name ?? 'Tema'} · {g.nome}{!g.produtoId && !g.variacaoId ? <span className="text-amber-700"> (sem produto do SOA)</span> : null}
        </label>
      ))}
    </div>
  )
}

/** Item 61: painel próprio das PRANCHETAS. */
export function PainelPranchetas() {
  const doc = useMaeDoc(s => s.hist.atual)
  const sel = useEditor(s => s.prancheta)
  const aplicar = useMaeDoc.getState().aplicar
  const [folha, setFolha] = useState<'A4' | 'A5' | 'A6'>('A4')
  const [ori, setOri] = useState<'retrato' | 'paisagem'>('retrato')
  const ab = doc.artboards.find(a => a.id === sel) ?? null
  const fmt = (n: number) => Math.round(n * 10) / 10
  return (
    <section className="space-y-2" data-painel-pranchetas>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pranchetas</h2>
      <ul className="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800" data-lista-pranchetas>
        {doc.artboards.map((a, i) => (
          <li key={a.id} className={`px-2 py-1 text-xs cursor-pointer ${a.id === sel ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`} onClick={() => useEditor.getState().set({ prancheta: a.id })} data-prancheta-lista={i + 1}>
            <b>{a.name || doc.molds.filter(m => m.artboardId === a.id).map(m => m.name).join(' + ') || `Prancheta ${i + 1}`}</b>
            <span className="ml-1 text-[11px] text-gray-500 tabular-nums">{fmt(a.widthMm)} × {fmt(a.heightMm)} mm · {a.widthMm > a.heightMm ? 'paisagem' : 'retrato'}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-1">
        <select value={folha} onChange={e => setFolha(e.target.value as 'A4')} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs"><option>A4</option><option>A5</option><option>A6</option></select>
        <select value={ori} onChange={e => setOri(e.target.value as 'retrato')} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs"><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option></select>
        <button className={btn} onClick={() => useMaeDoc.getState().adicionarPrancheta(folha, ori)} data-nova-prancheta-painel><Plus className="w-3.5 h-3.5" /> Nova prancheta</button>
      </div>
      {ab ? (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-prancheta-sel-painel>
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => aplicar('Girar prancheta', d => girarPrancheta(d, ab.id, { comMoldes: true, sentido: 1 }))}><RotateCw className="w-3.5 h-3.5" /> Girar</button>
            <select value="" onChange={e => { const v = e.target.value as 'A4'; if (v) { const m = medidasFolha(v, ab.widthMm > ab.heightMm ? 'paisagem' : 'retrato'); aplicar(`Redimensionar prancheta (${v})`, d => redimensionarPrancheta(d, ab.id, m.widthMm, m.heightMm)) } }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs"><option value="">Tamanho…</option><option>A4</option><option>A5</option><option>A6</option></select>
            <button className={btn} onClick={() => { let id: string | null = null; aplicar('Duplicar prancheta', d => { id = duplicarPrancheta(d, ab.id) }); if (id) useEditor.getState().set({ prancheta: id }) }}><Copy className="w-3.5 h-3.5" /> Duplicar</button>
            <button className={btn + ' text-red-600'} disabled={doc.artboards.length <= 1} onClick={() => excluirSelecionada()}><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
          </div>
        </div>
      ) : <p className="text-[11px] text-gray-400">Clique numa prancheta (aqui ou na barra dela) para girar, mudar o tamanho, duplicar ou excluir.</p>}
      {doc.artboards.length > 1 && (
        <select value="" onChange={e => { const m = e.target.value as ModoOrganizar; if (m) aplicar(`Organizar pranchetas (${m})`, d => organizarPranchetas(d, m)) }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs" data-organizar-painel>
          <option value="">Organizar…</option><option value="linha">Em linha</option><option value="coluna">Em coluna</option><option value="grade">Em grade</option>
        </select>
      )}
    </section>
  )
}
