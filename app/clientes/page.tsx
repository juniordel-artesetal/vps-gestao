'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Search, Plus, X, Phone, Mail, ShoppingBag, DollarSign, Trash2, Upload, ChevronLeft, ChevronRight, CheckCircle2, Ban, Pencil } from 'lucide-react'
import OrigemSelect from '@/components/OrigemSelect'
import ModalImportacaoClientes from '@/components/ModalImportacaoClientes'

type Contato  = { tipo: string; valor: string; label?: string; principal?: boolean }
type Endereco = { apelido?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; principal?: boolean }
type Cliente  = {
  id: string; nome: string; documento?: string; email?: string; telefone?: string
  origem?: string; tags?: string; ativo: boolean; qtdPedidos: number; valorTotal: number
  totalPedidos?: number
}

const LIMITE = 30
const ORDENACOES = [
  { v: 'nome_asc', label: 'Nome A→Z' },
  { v: 'nome_desc', label: 'Nome Z→A' },
  { v: 'pedidos_desc', label: 'Mais pedidos (SOA)' },
  { v: 'importados_desc', label: 'Mais pedidos (importados)' },
  { v: 'valor_desc', label: 'Maior valor' },
  { v: 'recentes', label: 'Mais recentes' },
]

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
  const [ordenacao, setOrdenacao] = useState('nome_asc')
  const [status, setStatus] = useState('') // '' todos | '1' ativos | '0' inativos
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [modalImport, setModalImport] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [aplicandoLote, setAplicandoLote] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  const carregar = useCallback(async (q: string, pag: number, ord: string, st: string) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set('busca', q)
      if (st) p.set('ativo', st)
      p.set('ordenacao', ord)
      p.set('pagina', String(pag))
      p.set('limite', String(LIMITE))
      const res = await fetch(`/api/clientes?${p.toString()}`)
      const data = await res.json()
      setClientes(data.clientes || [])
      setMetricas(data.metricas || { totalClientes: 0, totalAtivos: 0 })
      setTotal(data.total || 0)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  // Busca/filtros/ordenação → volta para a página 1 (com debounce na busca)
  useEffect(() => { setPagina(1) }, [busca, ordenacao, status])
  useEffect(() => {
    const t = setTimeout(() => carregar(busca, pagina, ordenacao, status), 250)
    return () => clearTimeout(t)
  }, [busca, pagina, ordenacao, status, carregar])

  // Limpa seleção ao trocar de página/filtro
  useEffect(() => { setSel(new Set()) }, [pagina, busca, ordenacao, status])

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todosMarcados = clientes.length > 0 && clientes.every(c => sel.has(c.id))
  const marcarTodosPagina = () => setSel(s => {
    const n = new Set(s)
    if (todosMarcados) clientes.forEach(c => n.delete(c.id))
    else clientes.forEach(c => n.add(c.id))
    return n
  })

  async function aplicarLote(acao: 'ativar' | 'inativar' | 'excluir') {
    if (sel.size === 0) return
    const msg = acao === 'excluir'
      ? `Excluir DEFINITIVAMENTE ${sel.size} cliente(s)? Esta ação não pode ser desfeita (pedidos serão desvinculados, não apagados).`
      : `${acao === 'ativar' ? 'Ativar' : 'Inativar'} ${sel.size} cliente(s) selecionado(s)?`
    if (!confirm(msg)) return
    setAplicandoLote(true)
    try {
      const res = await fetch('/api/clientes/lote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(sel), acao }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro')
      setSel(new Set())
      carregar(busca, pagina, ordenacao, status)
    } catch (e: any) { alert(e.message) }
    finally { setAplicandoLote(false) }
  }

  const recarregar = () => carregar(busca, pagina, ordenacao, status)

  function abrirNovo() {
    setEditId(null); setForm({ ...EMPTY_FORM }); setShowModal(true)
  }

  async function abrirEdicao(id: string) {
    try {
      const res = await fetch(`/api/clientes/${id}`)
      if (!res.ok) throw new Error('Erro ao carregar cliente')
      const d = await res.json()
      const cl = d.cliente
      setForm({
        nome: cl.nome || '', documento: cl.documento || '', email: cl.email || '', telefone: cl.telefone || '',
        origem: cl.origem || '', observacoes: cl.observacoes || '', tags: cl.tags || '', ativo: cl.ativo,
        contatos: d.contatos || [], enderecos: d.enderecos || [],
      })
      setEditId(id); setShowModal(true)
    } catch (e: any) { alert(e.message) }
  }

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      const url = editId ? `/api/clientes/${editId}` : '/api/clientes'
      const res = await fetch(url, {
        method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      if (editId) {
        setShowModal(false); setEditId(null); setForm({ ...EMPTY_FORM }); recarregar()
      } else {
        const { id } = await res.json()
        setShowModal(false); setForm({ ...EMPTY_FORM })
        router.push(`/clientes/${id}`)
      }
    } catch (e: any) { alert(e.message) }
    finally { setSalvando(false) }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir definitivamente "${nome}"? Esta ação não pode ser desfeita. Os pedidos vinculados serão desvinculados (não apagados).`)) return
    try {
      const res = await fetch(`/api/clientes/${id}?hard=1`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao excluir')
      setSel(s => { const n = new Set(s); n.delete(id); return n })
      recarregar()
    } catch (e: any) { alert(e.message) }
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
        <div className="flex items-center gap-2">
          <button onClick={() => setModalImport(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition">
            <Upload size={14} /> Importar planilha
          </button>
          <button onClick={abrirNovo}
            className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
            <Plus size={16} /> Novo cliente
          </button>
        </div>
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

      {/* Barra de pesquisa completa: busca + status + ordenação */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail, telefone ou contato…"
            className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          )}
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white">
          <option value="">Todos</option>
          <option value="1">Ativos</option>
          <option value="0">Inativos</option>
        </select>
        <select value={ordenacao} onChange={e => setOrdenacao(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white">
          {ORDENACOES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      </div>

      {/* Barra de ações em massa */}
      {sel.size > 0 && (
        <div className="flex items-center gap-2 mb-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <span className="text-sm text-orange-700 font-medium">{sel.size} selecionado(s)</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => aplicarLote('ativar')} disabled={aplicandoLote}
              className="flex items-center gap-1 text-xs font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
              <CheckCircle2 size={13} /> Ativar
            </button>
            <button onClick={() => aplicarLote('inativar')} disabled={aplicandoLote}
              className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-white border border-yellow-200 hover:bg-yellow-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
              <Ban size={13} /> Inativar
            </button>
            <button onClick={() => aplicarLote('excluir')} disabled={aplicandoLote}
              className="flex items-center gap-1 text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
              <Trash2 size={13} /> Excluir
            </button>
            <button onClick={() => setSel(new Set())} className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpar</button>
          </div>
        </div>
      )}

      {/* Cabeçalho: selecionar todos da página */}
      {clientes.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-gray-500 mb-2 px-1 cursor-pointer select-none">
          <input type="checkbox" checked={todosMarcados} onChange={marcarTodosPagina} className="accent-orange-500" />
          Selecionar todos desta página
        </label>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-gray-400 text-sm text-center py-10">Carregando…</p>
      ) : clientes.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-10">Nenhum cliente {busca || status ? 'encontrado' : 'cadastrado ainda'}.</p>
      ) : (
        <div className="space-y-2">
          {clientes.map(c => (
            <div key={c.id}
              className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition ${sel.has(c.id) ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-100 hover:border-orange-200 hover:shadow-sm'}`}>
              <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggleSel(c.id)} className="accent-orange-500 flex-shrink-0" />
              <button onClick={() => router.push(`/clientes/${c.id}`)} className="flex items-center justify-between flex-1 min-w-0 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 truncate">{c.nome}</span>
                    {!c.ativo && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">inativo</span>}
                    {c.origem === 'importacao' && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">importado</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {c.telefone && <span className="flex items-center gap-1"><Phone size={11} />{c.telefone}</span>}
                    {c.email && <span className="flex items-center gap-1 truncate"><Mail size={11} />{c.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 text-right pl-2">
                  <div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end"><ShoppingBag size={11} />Pedidos</p>
                    <p className="text-sm font-semibold text-gray-700">{c.qtdPedidos}</p>
                    {Number(c.totalPedidos) > 0 && <p className="text-[10px] text-amber-600">{c.totalPedidos} importados</p>}
                  </div>
                  <div><p className="text-[11px] text-gray-400 flex items-center gap-1 justify-end"><DollarSign size={11} />Total</p><p className="text-sm font-semibold text-gray-700">{fmtR(c.valorTotal)}</p></div>
                </div>
              </button>
              <div className="flex items-center gap-0.5 flex-shrink-0 pl-1 border-l border-gray-100">
                <button onClick={() => abrirEdicao(c.id)} title="Editar" className="p-2 text-gray-400 hover:text-orange-500 rounded-lg hover:bg-orange-50"><Pencil size={15} /></button>
                <button onClick={() => excluir(c.id, c.nome)} title="Excluir" className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}

          {/* Paginação */}
          <div className="flex items-center justify-between pt-3">
            <p className="text-xs text-gray-400">{total} cliente(s) · página {pagina} de {totalPaginas}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina <= 1}
                className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={15} /> Anterior
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina >= totalPaginas}
                className="flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
                Próxima <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar planilha */}
      {modalImport && (
        <ModalImportacaoClientes
          onClose={() => setModalImport(false)}
          onImportado={() => { setModalImport(false); recarregar() }}
        />
      )}

      {/* Modal Novo cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{editId ? 'Editar cliente' : 'Novo cliente'}</h2>
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
