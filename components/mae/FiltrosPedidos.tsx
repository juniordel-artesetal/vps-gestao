'use client'
// BUSCA + FILTROS EM CHIPS da edição em massa (Lote 7, item 116): uma busca só (pedido, cliente, aniversariante,
// tema) e chips combináveis — tema, produto, status, canal, loja, prazo de envio, sem tema, com observação,
// ajustado. Filtros salvos com nome ("Hoje – Shopee") ficam na Biblioteca. Contador "12 pedidos · 5 selecionados".
import { useState } from 'react'
import { Search, X, Bookmark, Trash2 } from 'lucide-react'
import { nFiltros, presetEnvio, type Filtros, type FiltroSalvo, type Prazo } from '@/lib/mae/pedidos/filtros'
import CalendarioEnvio from './CalendarioEnvio'

type Lista = 'temas' | 'produtos' | 'status' | 'canais' | 'lojas'
const ROTULO: Record<Lista, string> = { temas: 'Tema', produtos: 'Produto', status: 'Status', canais: 'Canal', lojas: 'Loja' }
const PRAZOS: [Prazo, string][] = [['hoje', 'Despacha hoje'], ['amanha', 'Até amanhã'], ['atrasados', 'Atrasados']]
const chip = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400'}`

export default function FiltrosPedidos({ filtros, setFiltros, opcoes, salvos, onSalvar, onExcluirSalvo, total, selecionados, hoje, contagemDia }: {
  filtros: Filtros; setFiltros: (f: Filtros) => void
  /** Lote 13 (item 182): hoje (AAAA-MM-DD) e quantos pedidos por dia de envio (o calendário). */
  hoje: string; contagemDia: Record<string, number>
  opcoes: Record<Lista, string[]>
  salvos: FiltroSalvo[]; onSalvar: (nome: string) => void; onExcluirSalvo: (nome: string) => void
  total: number; selecionados: number
}) {
  const [salvando, setSalvando] = useState(false)
  const [nome, setNome] = useState('')
  const alternar = (k: Lista, v: string) => { const l = filtros[k] ?? []; setFiltros({ ...filtros, [k]: l.includes(v) ? l.filter(x => x !== v) : [...l, v] }) }
  const n = nFiltros(filtros)
  return (
    <div className="space-y-1.5" data-filtros-pedidos>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[16rem]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={filtros.busca ?? ''} onChange={e => setFiltros({ ...filtros, busca: e.target.value })} placeholder="buscar pedido, cliente, aniversariante, tema…"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-7 pr-2 py-1.5 text-xs" aria-label="Buscar pedidos" data-busca-pedidos />
        </label>
        <span className="text-xs text-gray-600 dark:text-gray-300 tabular-nums" data-contador-pedidos>{total} pedido{total === 1 ? '' : 's'} · {selecionados} selecionado{selecionados === 1 ? '' : 's'}</span>
        {n > 0 && <button className="text-xs text-gray-500 underline" onClick={() => setFiltros({})} data-limpar-filtros>Limpar filtros ({n})</button>}
        {n > 0 && !salvando && <button className="inline-flex items-center gap-1 text-xs text-orange-700" onClick={() => setSalvando(true)} data-salvar-filtro><Bookmark className="w-3.5 h-3.5" /> Salvar filtro</button>}
        {salvando && (
          <span className="inline-flex items-center gap-1">
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && nome.trim()) { onSalvar(nome); setNome(''); setSalvando(false) } if (e.key === 'Escape') setSalvando(false) }}
              placeholder='ex.: Hoje – Shopee' className="w-36 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs" aria-label="Nome do filtro" data-nome-filtro />
            <button className="text-xs text-orange-700 disabled:opacity-40" disabled={!nome.trim()} onClick={() => { onSalvar(nome); setNome(''); setSalvando(false) }}>Guardar</button>
            <button onClick={() => setSalvando(false)} aria-label="Cancelar"><X className="w-3 h-3" /></button>
          </span>
        )}
      </div>
      {salvos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1" data-filtros-salvos>
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Salvos</span>
          {salvos.map(s => (
            <span key={s.nome} className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 text-[11px]">
              <button className="px-2 py-0.5" onClick={() => setFiltros(s.filtros)} data-filtro-salvo={s.nome}>{s.nome}</button>
              <button className="pr-1.5 text-gray-400 hover:text-red-600" onClick={() => onExcluirSalvo(s.nome)} aria-label={`Excluir o filtro ${s.nome}`}><Trash2 className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1" data-chips-pedidos>
        {/* Lote 13 (item 182): os atalhos viram presets da DATA DE ENVIO (relativa) + o calendário com a quantidade por dia */}
        {PRAZOS.map(([p, r]) => { const ativo = filtros.envio?.rotulo === r || filtros.prazo === p
          return <button key={p} className={chip(ativo)} onClick={() => setFiltros({ ...filtros, prazo: null, envio: ativo ? null : presetEnvio(p === 'amanha' ? 'amanha' : p, hoje) })} data-chip-prazo={p}>{r}</button> })}
        <CalendarioEnvio valor={filtros.envio && !PRAZOS.some(([, r]) => r === filtros.envio?.rotulo) ? filtros.envio : null} hoje={hoje} contagem={contagemDia} onMudar={e => setFiltros({ ...filtros, prazo: null, envio: e })} />
        <span className="mx-0.5 h-4 w-px bg-gray-200" />
        <button className={chip(!!filtros.semTema)} onClick={() => setFiltros({ ...filtros, semTema: !filtros.semTema })} data-chip-sem-tema>Sem tema vinculado</button>
        <button className={chip(!!filtros.comObs)} onClick={() => setFiltros({ ...filtros, comObs: !filtros.comObs })} data-chip-com-obs>Com observação</button>
        <button className={chip(!!filtros.ajustado)} onClick={() => setFiltros({ ...filtros, ajustado: !filtros.ajustado })} data-chip-ajustado>Ajustado</button>
        {/* Lote 13 (item 180) */}
        {/* Lote 13 (item 183) */}
        <button className={chip(!!filtros.semNome)} onClick={() => setFiltros({ ...filtros, semNome: !filtros.semNome })} title="Pedidos que vieram sem nome (não estão aguardando a cliente)" data-chip-sem-nome>Sem nome</button>
        <button className={chip(!!filtros.aguardando)} onClick={() => setFiltros({ ...filtros, aguardando: !filtros.aguardando })} title="A loja ainda espera os dados da cliente (ex.: AGUARDANDO DADOS, PEDI O NOME)" data-chip-aguardando>Aguardando dados</button>
        <button className={chip(!!filtros.letraFaltando)} onClick={() => setFiltros({ ...filtros, letraFaltando: !filtros.letraFaltando })} title="Nome/hashtag com letra que a fonte do tema não tem" data-chip-letra-faltando>Letra faltando</button>
        {(Object.keys(ROTULO) as Lista[]).filter(k => opcoes[k].length > 0).map(k => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="mx-0.5 h-4 w-px bg-gray-200" />
            {(filtros[k] ?? []).map(v => <button key={v} className={chip(true)} onClick={() => alternar(k, v)} title={`Tirar o filtro ${ROTULO[k]}: ${v}`} data-chip-ativo={k}>{ROTULO[k]}: {v} <X className="w-3 h-3" /></button>)}
            <select value="" onChange={e => { if (e.target.value) alternar(k, e.target.value) }} className="rounded-full border border-dashed border-gray-300 dark:border-gray-600 bg-transparent px-2 py-0.5 text-[11px] text-gray-600" aria-label={`Filtrar por ${ROTULO[k].toLowerCase()}`} data-chip-lista={k}>
              <option value="">+ {ROTULO[k]}</option>
              {opcoes[k].filter(v => !(filtros[k] ?? []).includes(v)).map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </span>
        ))}
      </div>
    </div>
  )
}
