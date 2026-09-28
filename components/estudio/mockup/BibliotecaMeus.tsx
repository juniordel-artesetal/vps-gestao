'use client'
// SOA Design — BIBLIOTECA = os mockups que ELA criou (o espaço dela): usar, editar as faces, duplicar, renomear,
// apelidos (para o matcher reconhecer "cx_milk", "mk"…) e excluir. As bases prontas do SOA ficam em
// "Criar mockup → Escolher do acervo" — aqui não entra modelo pronto.
'use no memo'
import { useMemo, useState } from 'react'
import { ArrowRight, Pencil, Copy, Type, Tag, Trash2, Search } from 'lucide-react'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import { novoCanvas } from '@/lib/estudio/mockup'
import { cartao, inp } from '../caixas/comum'
import { apelidosDe } from './UsarMockup'

const json = (v: unknown) => (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v)

export default function BibliotecaMeus({ itens, onUsar, onEditar, onMudou }: { itens: MockupPronto[]; onUsar: (id: string) => void; onEditar: (m: MockupPronto) => void; onMudou: () => void }) {
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const lista = itens.filter(m => !busca.trim() || `${m.nome} ${apelidosDe(m).join(' ')}`.toLowerCase().includes(busca.trim().toLowerCase()))

  async function put(m: MockupPronto, corpo: Record<string, unknown>) {
    const r = await fetch(`/api/estudio/mockups/${m.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Não consegui salvar.')
  }
  const agir = (f: () => Promise<void>) => { setErro(''); f().then(onMudou).catch(e => setErro((e as Error).message)) }
  const renomear = (m: MockupPronto) => { const n = prompt('Novo nome do mockup:', m.nome)?.trim(); if (n && n !== m.nome) agir(() => put(m, { nome: n.slice(0, 120) })) }
  const apelidos = (m: MockupPronto) => {
    const atual = apelidosDe(m).join(', ')
    const n = prompt(`Apelidos de “${m.nome}” (separados por vírgula) — o nome dos arquivos com isso vai sozinho para este mockup.\nEx.: cx_milk, milk, mk`, atual)
    if (n === null) return
    const lista = [...new Set(n.split(',').map(x => x.trim()).filter(Boolean))].slice(0, 20)
    agir(() => put(m, { config: { ...((json(m.linha?.config) as Record<string, unknown>) || {}), aliases: lista } }))
  }
  const duplicar = (m: MockupPronto) => agir(async () => {
    const l = m.linha || {}
    const copia: Record<string, unknown> = { nome: `${m.nome} (cópia)`.slice(0, 120), tipo: l.tipo || 'foto' }
    for (const k of ['fotoAssetId', 'produtoRecortadoAssetId', 'fotoUrl', 'recorteUrl', 'moldeCaixaId', 'previewUrl']) if (l[k]) copia[k] = l[k]
    for (const k of ['areaAplicacao', 'sombra', 'luz', 'config']) if (l[k]) copia[k] = json(l[k])
    const r = await fetch('/api/estudio/mockups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(copia) })
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Não consegui duplicar.')
  })
  const excluir = (m: MockupPronto) => { if (confirm(`Excluir o mockup “${m.nome}”? As fotos já geradas não são apagadas.`)) agir(async () => { await fetch(`/api/estudio/mockups/${m.id}`, { method: 'DELETE' }) }) }

  if (!itens.length) return <div className={cartao}><p className="text-sm text-gray-600 dark:text-gray-300">Sua biblioteca está vazia. Crie seu primeiro mockup em <b>Criar mockup</b> — ele aparece aqui e fica pronto para usar com qualquer arte.</p></div>
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">Seus mockups — criados uma vez, reutilizados sempre. {itens.length} no total.</p>
        <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-gray-400" /><input className={inp + ' !pl-7 !w-56'} placeholder="Buscar por nome ou apelido" value={busca} onChange={e => setBusca(e.target.value)} /></div>
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" data-biblioteca>
        {lista.map(m => (
          <div key={m.id} className={`${cartao} !p-2 space-y-1`} data-meu-mockup={m.nome}>
            <Mini m={m} />
            <p className="text-xs font-medium truncate" title={m.nome}>{m.nome}</p>
            <p className="text-[10px] text-gray-400 truncate">{m.smart ? m.smart.cfg.areas.map(a => a.nome).join(', ') : 'mockup antigo'}{apelidosDe(m).length ? ` · apelidos: ${apelidosDe(m).join(', ')}` : ''}</p>
            <div className="flex items-center gap-2 pt-0.5">
              <button onClick={() => onUsar(m.id)} title="Usar (gerar fotos)" data-acao="usar"><ArrowRight className="w-3.5 h-3.5 text-orange-500 hover:text-orange-700" /></button>
              <button onClick={() => onEditar(m)} title="Editar as faces" data-acao="editar"><Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
              <button onClick={() => duplicar(m)} title="Duplicar" data-acao="duplicar"><Copy className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
              <button onClick={() => renomear(m)} title="Renomear" data-acao="renomear"><Type className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
              <button onClick={() => apelidos(m)} title="Apelidos (para reconhecer pelo nome do arquivo)" data-acao="apelidos"><Tag className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
              <span className="flex-1" />
              <button onClick={() => excluir(m)} title="Excluir" data-acao="excluir"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Mini({ m }: { m: MockupPronto }) {
  const url = useMemo(() => {
    const prev = m.linha?.previewUrl
    if (typeof prev === 'string' && prev.startsWith('data:')) return prev
    const src = m.smart?.foto || m.produto
    const k = 200 / Math.max(src.width, src.height), c = novoCanvas(src.width * k, src.height * k)
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [m])
  return <img src={url} alt={m.nome} className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" />
}
