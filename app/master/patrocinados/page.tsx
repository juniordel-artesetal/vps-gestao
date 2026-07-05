'use client'

import { useEffect, useState } from 'react'
import { Megaphone, Plus, Trash2, Eye, MousePointerClick, X, BarChart3 } from 'lucide-react'

export default function MasterPatrocinados() {
  const [loading, setLoading] = useState(true)
  const [lista, setLista] = useState<any[]>([])
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', anunciante: '', contato: '', link: '', palavrasChave: '', precoExibido: '', prioridade: 0, dataInicio: '', dataFim: '', ativo: true })

  // Relatório simples (impressões/cliques/CTR)
  const [relModal, setRelModal] = useState(false)
  const [relLoading, setRelLoading] = useState(false)
  const [rel, setRel] = useState<any>(null)
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  useEffect(() => { carregar() }, [])
  async function carregar() {
    try { const r = await fetch('/api/master/patrocinados'); setLista(r.ok ? await r.json() : []) } finally { setLoading(false) }
  }
  function novo() { setEditId(null); setForm({ nome: '', anunciante: '', contato: '', link: '', palavrasChave: '', precoExibido: '', prioridade: 0, dataInicio: '', dataFim: '', ativo: true }); setModal(true) }
  function editar(p: any) {
    setEditId(p.id)
    setForm({
      nome: p.nome, anunciante: p.anunciante || '', contato: p.contato || '', link: p.link || '',
      palavrasChave: p.palavrasChave || '', precoExibido: p.precoExibido || '', prioridade: p.prioridade || 0,
      dataInicio: p.dataInicio ? String(p.dataInicio).slice(0, 10) : '', dataFim: p.dataFim ? String(p.dataFim).slice(0, 10) : '', ativo: p.ativo,
    })
    setModal(true)
  }
  async function salvar() {
    if (!form.nome.trim()) return
    if (editId) await fetch(`/api/master/patrocinados/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    else await fetch('/api/master/patrocinados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setModal(false); carregar()
  }
  async function toggleAtivo(p: any) { await fetch(`/api/master/patrocinados/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !p.ativo }) }); carregar() }
  async function excluir(p: any) { if (!confirm(`Excluir "${p.nome}"?`)) return; await fetch(`/api/master/patrocinados/${p.id}`, { method: 'DELETE' }); carregar() }

  async function abrirRelatorio() { setRelModal(true); await carregarRelatorio() }
  async function carregarRelatorio() {
    setRelLoading(true)
    try {
      const qs = new URLSearchParams()
      if (de) qs.set('de', de)
      if (ate) qs.set('ate', ate)
      const r = await fetch(`/api/master/patrocinados/relatorio?${qs.toString()}`)
      setRel(r.ok ? await r.json() : null)
    } finally { setRelLoading(false) }
  }

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  const fmtPeriodo = (p: any) => {
    const i = p.dataInicio ? String(p.dataInicio).slice(0, 10).split('-').reverse().join('/') : null
    const f = p.dataFim ? String(p.dataFim).slice(0, 10).split('-').reverse().join('/') : null
    if (!i && !f) return 'sem prazo'
    return `${i || '…'} → ${f || '…'}`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-orange-500" /><h1 className="text-xl font-semibold text-gray-900">Patrocinados — Assistente de Compras</h1></div>
          <div className="flex items-center gap-2">
            <button onClick={abrirRelatorio} className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-3 py-2 rounded-lg"><BarChart3 size={15} /> Relatório</button>
            <button onClick={novo} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"><Plus size={15} /> Novo</button>
          </div>
        </div>

        {loading ? <p className="text-gray-400 text-sm py-12 text-center">Carregando...</p>
          : lista.length === 0 ? <p className="text-gray-400 text-sm py-12 text-center">Nenhum anúncio ainda.</p> : (
            <div className="space-y-2">
              {lista.map(p => (
                <div key={p.id} className={`bg-white rounded-xl border p-4 ${p.ativo ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{p.nome} {p.anunciante && <span className="text-xs font-normal text-gray-400">· {p.anunciante}</span>} {!p.ativo && <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">inativo</span>}</p>
                      <p className="text-xs text-gray-400 truncate">Palavras: {p.palavrasChave || '—'}{p.precoExibido ? ` · ${p.precoExibido}` : ''}{p.link ? ` · ${p.link}` : ''}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={12} /> {p.impressoes} impressões</span>
                        <span className="flex items-center gap-1"><MousePointerClick size={12} /> {p.cliques} cliques</span>
                        <span className="text-gray-400">prioridade {p.prioridade}</span>
                        <span className="text-gray-400">{fmtPeriodo(p)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => toggleAtivo(p)} className={`text-xs px-2 py-1 rounded-lg border ${p.ativo ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</button>
                      <button onClick={() => editar(p)} className="text-xs text-blue-500 hover:underline">Editar</button>
                      <button onClick={() => excluir(p)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-gray-800">{editId ? 'Editar' : 'Novo'} patrocinado</h2><button onClick={() => setModal(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="space-y-3">
              <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da loja/anúncio *" className={input} />
              <div className="flex items-center gap-3">
                <input value={form.anunciante} onChange={e => setForm(f => ({ ...f, anunciante: e.target.value }))} placeholder="Anunciante (fornecedor)" className={input} />
                <input value={form.contato} onChange={e => setForm(f => ({ ...f, contato: e.target.value }))} placeholder="Contato (email/WhatsApp)" className={input} />
              </div>
              <input value={form.palavrasChave} onChange={e => setForm(f => ({ ...f, palavrasChave: e.target.value }))} placeholder="Palavras-chave (ex: cola, feltro, tecido)" className={input} />
              <input value={form.precoExibido} onChange={e => setForm(f => ({ ...f, precoExibido: e.target.value }))} placeholder="Preço/oferta exibida (texto livre)" className={input} />
              <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} placeholder="Link (https://...)" className={input} />
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500 w-full">Início do contrato<input type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} className={input} /></label>
                <label className="text-xs text-gray-500 w-full">Fim do contrato<input type="date" value={form.dataFim} onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} className={input} /></label>
              </div>
              <p className="text-[11px] text-gray-400 -mt-1">Sem datas = sempre ativo enquanto marcado como ativo.</p>
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-500">Prioridade (destaque)<input type="number" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) || 0 }))} className={input + ' w-32'} /></label>
                <label className="flex items-center gap-2 text-sm text-gray-600 mt-4"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="accent-orange-500" /> Ativo</label>
              </div>
              <button onClick={salvar} disabled={!form.nome.trim()} className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50">{editId ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {relModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-gray-800 flex items-center gap-2"><BarChart3 size={18} className="text-orange-500" /> Relatório de desempenho</h2><button onClick={() => setRelModal(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="flex items-end gap-3 mb-4">
              <label className="text-xs text-gray-500">De<input type="date" value={de} onChange={e => setDe(e.target.value)} className={input} /></label>
              <label className="text-xs text-gray-500">Até<input type="date" value={ate} onChange={e => setAte(e.target.value)} className={input} /></label>
              <button onClick={carregarRelatorio} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Aplicar</button>
            </div>
            <p className="text-[11px] text-gray-400 mb-2">Sem período = desde o início. CTR = cliques ÷ impressões.</p>
            {relLoading ? <p className="text-gray-400 text-sm py-8 text-center">Carregando...</p>
              : !rel?.linhas?.length ? <p className="text-gray-400 text-sm py-8 text-center">Sem dados.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                        <th className="py-2 pr-3">Anúncio</th>
                        <th className="py-2 px-2 text-right">Impressões</th>
                        <th className="py-2 px-2 text-right">Cliques</th>
                        <th className="py-2 pl-2 text-right">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rel.linhas.map((l: any) => (
                        <tr key={l.id} className="border-b border-gray-50">
                          <td className="py-2 pr-3">
                            <p className="font-medium text-gray-800">{l.nome} {!l.ativo && <span className="text-[10px] text-gray-400">(inativo)</span>}</p>
                            {l.anunciante && <p className="text-xs text-gray-400">{l.anunciante}</p>}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-700">{l.impressoes}</td>
                          <td className="py-2 px-2 text-right text-gray-700">{l.cliques}</td>
                          <td className="py-2 pl-2 text-right font-semibold text-gray-800">{l.ctr}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
