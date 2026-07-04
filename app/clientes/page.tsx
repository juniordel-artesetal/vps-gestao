'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Plus, X, Phone, Mail, ShoppingBag, DollarSign, Trash2 } from 'lucide-react'
import OrigemSelect from '@/components/OrigemSelect'

type Contato  = { tipo: string; valor: string; label?: string; principal?: boolean }
type Endereco = { apelido?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; principal?: boolean }
type Cliente  = {
  id: string; nome: string; documento?: string; email?: string; telefone?: string
  origem?: string; tags?: string; ativo: boolean; qtdPedidos: number; valorTotal: number
}

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
const fmtR = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
const TIPOS_CONTATO = ['telefone', 'whatsapp', 'email', 'instagram', 'outro']

const EMPTY_FORM = {
  nome: '', documento: '', email: '', telefone: '', origem: '', observacoes: '', tags: '', ativo: true,
  contatos: [] as Contato[], enderecos: [] as Endereco[],
}

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [metricas, setMetricas] = useState<{ totalClientes: number; totalAtivos: number }>({ totalClientes: 0, totalAtivos: 0 })
  const [total, setTotal] = useState(0)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const carregar = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set('busca', q)
      const res = await fetch(`/api/clientes?${p.toString()}`)
      const data = await res.json()
      setClientes(data.clientes || [])
      setMetricas(data.metricas || { totalClientes: 0, totalAtivos: 0 })
      setTotal(data.total || 0)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { const t = setTimeout(() => carregar(busca), 300); return () => clearTimeout(t) }, [busca, carregar])

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      const { id } = await res.json()
      setShowModal(false); setForm({ ...EMPTY_FORM })
      router.push(`/clientes/${id}`)
    } catch (e: any) { alert(e.message) }
    finally { setSalvando(false) }
  }

  const addContato  = () => setForm(f => ({ ...f, contatos:  [...f.contatos,  { tipo: 'telefone', valor: '', principal: f.contatos.length === 0 }] }))
  const addEndereco = () => setForm(f => ({ ...f, enderecos: [...f.enderecos, { apelido: '', cep: '', principal: f.enderecos.length === 0 }] }))

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="text-orange-500" size={22} />
          <h1 className="text-xl font-bold text-gray-800">Clientes</h1>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Total de clientes</p>
          <p className="text-2xl font-bold text-gray-800">{metricas.totalClientes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400">Ativos</p>
          <p className="text-2xl font-bold text-green-600">{metricas.totalAtivos}</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail ou telefone…"
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
      </div>

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-sm text-center py-10">Carregando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-10">Nenhum cliente {busca ? 'encontrado' : 'cadastrado ainda'}.</p>
      ) : (
        <div className="space-y-2">
          {clientes.map(c => (
            <button key={c.id} onClick={() => router.push(`/clientes/${c.id}`)}
              className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-orange-200 hover:shadow-sm transition flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 truncate">{c.nome}</span>
                  {!c.ativo && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">inativo</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                  {c.telefone && <span className="flex items-center gap-1"><Phone size={11} />{c.telefone}</span>}
                  {c.email && <span className="flex items-center gap-1 truncate"><Mail size={11} />{c.email}</span>}
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 text-right">
                <div><p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end"><ShoppingBag size={11} />Pedidos</p><p className="text-sm font-semibold text-gray-700">{c.qtdPedidos}</p></div>
                <div><p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end"><DollarSign size={11} />Total</p><p className="text-sm font-semibold text-gray-700">{fmtR(c.valorTotal)}</p></div>
              </div>
            </button>
          ))}
          <p className="text-xs text-gray-400 text-center pt-2">{total} cliente(s)</p>
        </div>
      )}

      {/* Modal Novo cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Novo cliente</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputClass} placeholder="Nome do cliente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Documento (CPF/CNPJ)</label>
                  <input value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Origem</label>
                  <OrigemSelect value={form.origem} onChange={v => setForm(f => ({ ...f, origem: v }))} className={inputClass} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
                <div><label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} className={inputClass} /></div>
              </div>

              {/* Contatos */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Contatos adicionais</label>
                  <button onClick={addContato} className="text-xs text-orange-500 hover:underline font-medium">+ Contato</button>
                </div>
                {form.contatos.map((c, i) => (
                  <div key={i} className="flex gap-1.5 mb-1.5 items-center">
                    <select value={c.tipo} onChange={e => setForm(f => { const u = [...f.contatos]; u[i] = { ...u[i], tipo: e.target.value }; return { ...f, contatos: u } })}
                      className="px-2 py-2 border border-gray-200 rounded-lg text-xs">
                      {TIPOS_CONTATO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input value={c.valor} onChange={e => setForm(f => { const u = [...f.contatos]; u[i] = { ...u[i], valor: e.target.value }; return { ...f, contatos: u } })}
                      className={inputClass} placeholder="Valor" />
                    <label className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                      <input type="radio" name="contatoPrincipal" checked={!!c.principal}
                        onChange={() => setForm(f => ({ ...f, contatos: f.contatos.map((x, j) => ({ ...x, principal: j === i })) }))} />principal
                    </label>
                    <button onClick={() => setForm(f => ({ ...f, contatos: f.contatos.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              {/* Endereços */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Endereços</label>
                  <button onClick={addEndereco} className="text-xs text-orange-500 hover:underline font-medium">+ Endereço</button>
                </div>
                {form.enderecos.map((e, i) => (
                  <div key={i} className="mb-2 p-2 rounded-lg border border-gray-100 bg-gray-50 space-y-1.5">
                    <div className="flex gap-1.5 items-center">
                      <input value={e.apelido || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], apelido: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="Apelido (Casa, Trabalho…)" />
                      <label className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                        <input type="radio" name="endPrincipal" checked={!!e.principal}
                          onChange={() => setForm(f => ({ ...f, enderecos: f.enderecos.map((x, j) => ({ ...x, principal: j === i })) }))} />principal
                      </label>
                      <button onClick={() => setForm(f => ({ ...f, enderecos: f.enderecos.filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input value={e.cep || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], cep: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="CEP" />
                      <input value={e.cidade || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], cidade: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="Cidade" />
                      <input value={e.estado || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], estado: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="UF" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input value={e.logradouro || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], logradouro: ev.target.value }; return { ...f, enderecos: u } })} className={`${inputClass} col-span-2`} placeholder="Logradouro" />
                      <input value={e.numero || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], numero: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="Nº" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input value={e.bairro || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], bairro: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="Bairro" />
                      <input value={e.complemento || ''} onChange={ev => setForm(f => { const u = [...f.enderecos]; u[i] = { ...u[i], complemento: ev.target.value }; return { ...f, enderecos: u } })} className={inputClass} placeholder="Complemento" />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className={inputClass} rows={2} />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
