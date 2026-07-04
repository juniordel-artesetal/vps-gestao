'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, Plus, User, Phone, MapPin, ShoppingBag, BarChart3 } from 'lucide-react'
import OrigemSelect from '@/components/OrigemSelect'

type Contato  = { id?: string; tipo: string; valor: string; label?: string; principal?: boolean }
type Endereco = { id?: string; apelido?: string; cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; principal?: boolean }
type Pedido   = { id: string; numero: string; produto?: string; canal?: string; status: string; valor: number; dataEntrada?: string; createdAt: string }
type Resumo   = { totalPedidos: number; valorTotal: number; ticketMedio: number; primeiroPedido?: string | null; ultimoPedido?: string | null }

const inputClass = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-300'
const fmtR = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`
const fmtData = (s?: string | null) => s ? new Date(s).toLocaleDateString('pt-BR') : '—'
const TIPOS_CONTATO = ['telefone', 'whatsapp', 'email', 'instagram', 'outro']

const ABAS = [
  { id: 'dados',     label: 'Dados',     icon: User },
  { id: 'contatos',  label: 'Contatos',  icon: Phone },
  { id: 'enderecos', label: 'Endereços', icon: MapPin },
  { id: 'historico', label: 'Histórico', icon: ShoppingBag },
  { id: 'resumo',    label: 'Resumo',    icon: BarChart3 },
] as const

export default function ClienteFichaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [aba, setAba] = useState<string>('dados')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState<any>({ nome: '', documento: '', email: '', telefone: '', origem: '', observacoes: '', tags: '', ativo: true })
  const [contatos, setContatos]   = useState<Contato[]>([])
  const [enderecos, setEnderecos] = useState<Endereco[]>([])
  const [historico, setHistorico] = useState<Pedido[]>([])
  const [resumo, setResumo]       = useState<Resumo>({ totalPedidos: 0, valorTotal: 0, ticketMedio: 0 })
  const [histImport, setHistImport] = useState<any>(null)
  const [financeiro, setFinanceiro] = useState<any>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${id}`)
      if (!res.ok) throw new Error('Cliente não encontrado')
      const d = await res.json()
      setForm({
        nome: d.cliente.nome || '', documento: d.cliente.documento || '', email: d.cliente.email || '',
        telefone: d.cliente.telefone || '', origem: d.cliente.origem || '', observacoes: d.cliente.observacoes || '',
        tags: d.cliente.tags || '', ativo: d.cliente.ativo,
      })
      setContatos(d.contatos || [])
      setEnderecos(d.enderecos || [])
      setHistorico(d.historico || [])
      setResumo(d.resumo || { totalPedidos: 0, valorTotal: 0, ticketMedio: 0 })
      const cl = d.cliente
      const temHist = cl.origem === 'importacao' || cl.ultimoPedidoData || cl.ultimoPedidoStatus
        || Number(cl.totalPedidos) || Number(cl.pedidosFinalizados) || Number(cl.pedidosEmAberto)
      setHistImport(temHist ? {
        ultimoPedidoData: cl.ultimoPedidoData, ultimoPedidoStatus: cl.ultimoPedidoStatus,
        totalPedidos: cl.totalPedidos ?? 0, pedidosFinalizados: cl.pedidosFinalizados ?? 0, pedidosEmAberto: cl.pedidosEmAberto ?? 0,
      } : null)
      setFinanceiro(d.financeiro || null)
    } catch (e: any) { alert(e.message); router.push('/clientes') }
    finally { setLoading(false) }
  }, [id, router])

  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório'); return }
    setSalvando(true)
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contatos, enderecos }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar')
      await carregar()
      alert('Cliente salvo!')
    } catch (e: any) { alert(e.message) }
    finally { setSalvando(false) }
  }

  async function inativar() {
    if (!confirm('Inativar este cliente? Ele deixa de aparecer nas listas ativas, mas o histórico é preservado.')) return
    await fetch(`/api/clientes/${id}`, { method: 'DELETE' })
    router.push('/clientes')
  }

  const addContato  = () => setContatos(c => [...c, { tipo: 'telefone', valor: '', principal: c.length === 0 }])
  const addEndereco = () => setEnderecos(e => [...e, { apelido: '', principal: e.length === 0 }])

  if (loading) return <div className="p-5 text-gray-400 text-sm">Carregando…</div>

  return (
    <div className="p-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/clientes')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} /> Clientes</button>
        <div className="flex gap-2">
          <button onClick={inativar} className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 px-3 py-2"><Trash2 size={15} /> Inativar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"><Save size={15} /> {salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xl font-bold text-gray-800">{form.nome || 'Cliente'}</h1>
        {!form.ativo && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">inativo</span>}
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-gray-100 mb-4 overflow-x-auto">
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${aba === a.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <a.icon size={15} /> {a.label}
            {a.id === 'historico' && historico.length > 0 && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 rounded-full">{historico.length}</span>}
          </button>
        ))}
      </div>

      {/* ── Aba Dados ── */}
      {aba === 'dados' && (
        <div className="space-y-3 bg-white rounded-xl border border-gray-100 p-5">
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
            <input value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Documento (CPF/CNPJ)</label>
              <input value={form.documento} onChange={e => setForm((f: any) => ({ ...f, documento: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Origem</label>
              <OrigemSelect value={form.origem} onChange={v => setForm((f: any) => ({ ...f, origem: v }))} className={inputClass} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">E-mail</label>
              <input value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} className={inputClass} /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Telefone</label>
              <input value={form.telefone} onChange={e => setForm((f: any) => ({ ...f, telefone: e.target.value }))} className={inputClass} /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Tags</label>
            <input value={form.tags} onChange={e => setForm((f: any) => ({ ...f, tags: e.target.value }))} className={inputClass} placeholder="vip, atacado…" /></div>
          <div><label className="block text-xs font-medium text-gray-500 mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => setForm((f: any) => ({ ...f, observacoes: e.target.value }))} className={inputClass} rows={3} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.ativo} onChange={e => setForm((f: any) => ({ ...f, ativo: e.target.checked }))} /> Cliente ativo
          </label>
        </div>
      )}

      {/* ── Aba Contatos ── */}
      {aba === 'contatos' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <button onClick={addContato} className="text-sm text-orange-500 hover:underline font-medium mb-3 flex items-center gap-1"><Plus size={14} /> Adicionar contato</button>
          {contatos.length === 0 ? <p className="text-gray-400 text-sm">Nenhum contato.</p> : contatos.map((c, i) => (
            <div key={i} className="flex gap-1.5 mb-2 items-center">
              <select value={c.tipo} onChange={e => setContatos(u => u.map((x, j) => j === i ? { ...x, tipo: e.target.value } : x))} className="px-2 py-2 border border-gray-200 rounded-lg text-xs">
                {TIPOS_CONTATO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={c.valor} onChange={e => setContatos(u => u.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} className={inputClass} placeholder="Valor" />
              <label className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                <input type="radio" name="contatoPrincipal" checked={!!c.principal} onChange={() => setContatos(u => u.map((x, j) => ({ ...x, principal: j === i })))} /> principal
              </label>
              <button onClick={() => setContatos(u => u.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── Aba Endereços ── */}
      {aba === 'enderecos' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <button onClick={addEndereco} className="text-sm text-orange-500 hover:underline font-medium mb-3 flex items-center gap-1"><Plus size={14} /> Adicionar endereço</button>
          {enderecos.length === 0 ? <p className="text-gray-400 text-sm">Nenhum endereço.</p> : enderecos.map((e, i) => (
            <div key={i} className="mb-2 p-3 rounded-lg border border-gray-100 bg-gray-50 space-y-1.5">
              <div className="flex gap-1.5 items-center">
                <input value={e.apelido || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, apelido: ev.target.value } : x))} className={inputClass} placeholder="Apelido" />
                <label className="flex items-center gap-1 text-[11px] text-gray-500 flex-shrink-0">
                  <input type="radio" name="endPrincipal" checked={!!e.principal} onChange={() => setEnderecos(u => u.map((x, j) => ({ ...x, principal: j === i })))} /> principal
                </label>
                <button onClick={() => setEnderecos(u => u.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input value={e.cep || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, cep: ev.target.value } : x))} className={inputClass} placeholder="CEP" />
                <input value={e.cidade || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, cidade: ev.target.value } : x))} className={inputClass} placeholder="Cidade" />
                <input value={e.estado || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, estado: ev.target.value } : x))} className={inputClass} placeholder="UF" />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input value={e.logradouro || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, logradouro: ev.target.value } : x))} className={`${inputClass} col-span-2`} placeholder="Logradouro" />
                <input value={e.numero || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, numero: ev.target.value } : x))} className={inputClass} placeholder="Nº" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <input value={e.bairro || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, bairro: ev.target.value } : x))} className={inputClass} placeholder="Bairro" />
                <input value={e.complemento || ''} onChange={ev => setEnderecos(u => u.map((x, j) => j === i ? { ...x, complemento: ev.target.value } : x))} className={inputClass} placeholder="Complemento" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Aba Histórico ── */}
      {aba === 'historico' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {historico.length === 0 ? <p className="text-gray-400 text-sm p-5">Nenhum pedido vinculado a este cliente.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-2 text-left">Nº</th><th className="px-4 py-2 text-left">Produto</th>
                  <th className="px-4 py-2 text-center">Status</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Data</th>
                </tr></thead>
                <tbody>
                  {historico.map(p => (
                    <tr key={p.id} className="border-t border-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">{p.numero}</td>
                      <td className="px-4 py-2 text-gray-600 truncate max-w-[180px]">{p.produto || '—'}</td>
                      <td className="px-4 py-2 text-center"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.status}</span></td>
                      <td className="px-4 py-2 text-right text-gray-700">{fmtR(p.valor)}</td>
                      <td className="px-4 py-2 text-right text-gray-500 text-xs">{fmtData(p.dataEntrada || p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba Resumo ── */}
      {aba === 'resumo' && (
        <div className="space-y-5">
          {/* Métricas AO VIVO — derivadas dos pedidos do SOA (Fase 1) */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Métricas do SOA (ao vivo)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Total de pedidos</p><p className="text-2xl font-bold text-gray-800">{resumo.totalPedidos}</p></div>
              <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Valor total</p><p className="text-2xl font-bold text-green-600">{fmtR(resumo.valorTotal)}</p></div>
              <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Ticket médio</p><p className="text-xl font-bold text-gray-800">{fmtR(resumo.ticketMedio)}</p></div>
              <div className="bg-white rounded-xl border border-gray-100 p-4"><p className="text-xs text-gray-400">Último pedido</p><p className="text-sm font-semibold text-gray-700 mt-1">{fmtData(resumo.ultimoPedido)}</p><p className="text-xs text-gray-400 mt-1">1º: {fmtData(resumo.primeiroPedido)}</p></div>
            </div>
          </div>

          {/* Histórico IMPORTADO (snapshot Calcularte) — distinto das métricas ao vivo */}
          {histImport && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">📥 Histórico importado (Calcularte)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4"><p className="text-xs text-amber-700/70">Último pedido</p><p className="text-sm font-semibold text-amber-800 mt-1">{histImport.ultimoPedidoData ? String(histImport.ultimoPedidoData).split('-').reverse().join('/') : '—'}</p></div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4"><p className="text-xs text-amber-700/70">Status último pedido</p><p className="text-sm font-semibold text-amber-800 mt-1">{histImport.ultimoPedidoStatus || '—'}</p></div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4"><p className="text-xs text-amber-700/70">Total de pedidos</p><p className="text-2xl font-bold text-amber-800">{histImport.totalPedidos}</p></div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4"><p className="text-xs text-amber-700/70">Finalizados</p><p className="text-2xl font-bold text-amber-800">{histImport.pedidosFinalizados}</p></div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4"><p className="text-xs text-amber-700/70">Em aberto</p><p className="text-2xl font-bold text-amber-800">{histImport.pedidosEmAberto}</p></div>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">Dados migrados da planilha (snapshot). Não se misturam com as métricas ao vivo acima, que vêm dos pedidos registrados no SOA.</p>
            </div>
          )}

          {/* Financeiro do cliente — derivado dos lançamentos vinculados */}
          {financeiro && financeiro.qtd > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">💰 Financeiro do cliente</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-green-50 rounded-xl border border-green-100 p-4"><p className="text-xs text-green-700/70">Recebido</p><p className="text-2xl font-bold text-green-700">{fmtR(financeiro.recebido)}</p></div>
                <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-4"><p className="text-xs text-yellow-700/70">Em aberto</p><p className="text-2xl font-bold text-yellow-700">{fmtR(financeiro.emAberto)}</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-center">Tipo</th>
                    <th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-right">Data</th>
                  </tr></thead>
                  <tbody>
                    {financeiro.lancamentos.map((l: any) => (
                      <tr key={l.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 text-gray-700 truncate max-w-[200px]">{l.descricao}</td>
                        <td className="px-3 py-2 text-center text-xs text-gray-500">{l.tipo === 'RECEITA' ? '↑ Receita' : '↓ Despesa'}</td>
                        <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'PAGO' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>{l.status}</span></td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtR(l.valor)}</td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">{l.data ? l.data.split('-').reverse().join('/') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
