'use client'
// app/master/parceiros/page.tsx — CRUD de parceiros (influencer/distribuidor),
// credenciais do portal, e gestão de comissões (marcar pago). Cookie master_token.
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Handshake, X, Ticket, Link2, DollarSign, CheckCircle2, CreditCard } from 'lucide-react'
import Link from 'next/link'

interface Parceiro {
  id: string; tipo: string; nome: string; email: string | null; contato: string | null; ativo: boolean
  cupom: string | null; linkSlug: string | null; comissaoPercAnual: number; comissaoPercMensal: number
  comissaoRecorrente: boolean; walletId: string | null; createdAt: string
  totalLeads: number; convertidos: number; comissaoPendente: number; temLogin: boolean
}
interface Comissao { id: string; parceiroNome: string; competencia: string; base: number; percentual: number; valor: number; status: string; createdAt: string }
interface Promo { id: string; parceiroNome: string; titulo: string; descricao: string | null; cupom: string | null; prioridade: number; ativo: boolean; impressoes: number; cliques: number; dataFim: string | null }

const VAZIO = {
  id: '', tipo: 'influencer', nome: '', email: '', contato: '', ativo: true,
  cupom: '', linkSlug: '', comissaoPercAnual: 0, comissaoPercMensal: 0, comissaoRecorrente: false,
  walletId: '', loginEmail: '', loginSenha: '', temLogin: false,
}
function fmtBRL(v: number) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function MasterParceirosPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'parceiros' | 'comissoes' | 'promocoes'>('parceiros')
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [comissoes, setComissoes] = useState<Comissao[]>([])
  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof VAZIO | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const carregarParceiros = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/master/parceiros')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) setParceiros(await res.json())
    setLoading(false)
  }, [router])

  const carregarComissoes = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/master/parceiros/comissoes')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) setComissoes(await res.json())
    setLoading(false)
  }, [router])

  const carregarPromos = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/master/promocoes')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) setPromos(await res.json())
    setLoading(false)
  }, [router])

  useEffect(() => {
    if (tab === 'parceiros') carregarParceiros()
    else if (tab === 'comissoes') carregarComissoes()
    else carregarPromos()
  }, [tab, carregarParceiros, carregarComissoes, carregarPromos])

  async function moderarPromo(id: string, patch: { prioridade?: number; ativo?: boolean }) {
    const res = await fetch('/api/master/promocoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
    if (res.ok) carregarPromos()
  }

  function aviso(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!form) return
    if (!form.nome.trim()) { aviso('Nome obrigatório.'); return }
    setSalvando(true)
    const res = await fetch('/api/master/parceiros', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    setSalvando(false)
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setForm(null); aviso('Parceiro salvo.'); carregarParceiros() }
    else aviso(d.error || 'Erro ao salvar.')
  }

  async function marcarPago(id: string) {
    if (!confirm('Marcar esta comissão como PAGA?')) return
    const res = await fetch('/api/master/parceiros/comissoes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (res.ok) { aviso('Comissão marcada como paga.'); carregarComissoes() }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <Handshake className="w-6 h-6 text-orange-500" />
        <h1 className="text-xl font-bold">Parceiros</h1>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-200 text-sm">{msg}</div>}

      <div className="flex gap-2 mb-6">
        {(['parceiros', 'comissoes', 'promocoes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {t === 'parceiros' ? 'Parceiros' : t === 'comissoes' ? 'Comissões' : 'Promoções'}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-500 text-sm">Carregando…</div>}

      {/* PARCEIROS */}
      {!loading && tab === 'parceiros' && (
        <div>
          <button onClick={() => setForm({ ...VAZIO })} className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium">
            <Plus className="w-4 h-4" /> Novo parceiro
          </button>
          <div className="space-y-2">
            {parceiros.length === 0 && <div className="p-6 text-gray-500 text-sm text-center bg-gray-900 border border-gray-800 rounded-xl">Nenhum parceiro.</div>}
            {parceiros.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-100">{p.nome}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${p.tipo === 'influencer' ? 'bg-purple-500/20 text-purple-300' : 'bg-sky-500/20 text-sky-300'}`}>{p.tipo}</span>
                      {!p.ativo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">inativo</span>}
                      {!p.temLogin && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">sem login</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                      {p.cupom && <span className="flex items-center gap-1"><Ticket className="w-3 h-3" /> {p.cupom}</span>}
                      {p.linkSlug && <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> /r/{p.linkSlug}</span>}
                      <span>{p.totalLeads} leads · {p.convertidos} convertidos</span>
                      {p.tipo === 'influencer' && <span className="text-amber-400">{fmtBRL(p.comissaoPendente)} pendente</span>}
                    </div>
                  </div>
                  <button onClick={() => setForm({ ...VAZIO, ...p, email: p.email || '', contato: p.contato || '', cupom: p.cupom || '', linkSlug: p.linkSlug || '', walletId: p.walletId || '', loginEmail: '', loginSenha: '' })}
                    className="text-gray-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMISSÕES */}
      {!loading && tab === 'comissoes' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {comissoes.length === 0 ? (
            <div className="p-6 text-gray-500 text-sm text-center">Nenhuma comissão registrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-800/50 text-gray-400">
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Parceiro</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Competência</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold">Base</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold">%</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold">Valor</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr></thead>
              <tbody>{comissoes.map(c => (
                <tr key={c.id} className="border-t border-gray-800">
                  <td className="px-4 py-2.5 text-gray-200">{c.parceiroNome}</td>
                  <td className="px-4 py-2.5 text-gray-400">{c.competencia}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{fmtBRL(c.base)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{c.percentual}%</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-100">{fmtBRL(c.valor)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'pago' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>{c.status === 'pago' ? 'Pago' : 'Pendente'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.status !== 'pago' && (
                      <div className="flex items-center gap-2 justify-end">
                        <button disabled title="Aguardando conexão Asaas" className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-500 cursor-not-allowed flex items-center gap-1"><CreditCard className="w-3 h-3" /> Pagar via Asaas</button>
                        <button onClick={() => marcarPago(c.id)} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Marcar pago</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <div className="flex items-center justify-between p-3">
            <p className="text-xs text-gray-500">O payout automático via Asaas entra depois; por ora, "marcar pago" é manual.</p>
            <Link href="/master/asaas" className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"><CreditCard className="w-3 h-3" /> Configurar Asaas</Link>
          </div>
        </div>
      )}

      {/* PROMOÇÕES (moderação: prioridade + ativar/pausar) */}
      {!loading && tab === 'promocoes' && (
        <div className="space-y-2">
          {promos.length === 0 && <div className="p-6 text-gray-500 text-sm text-center bg-gray-900 border border-gray-800 rounded-xl">Nenhuma promoção cadastrada pelos parceiros.</div>}
          {promos.map(p => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-100">{p.titulo}</span>
                  <span className="text-xs text-gray-400">· {p.parceiroNome}</span>
                  {!p.ativo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">pausada</span>}
                  {p.cupom && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">{p.cupom}</span>}
                </div>
                {p.descricao && <p className="text-xs text-gray-400 mt-0.5">{p.descricao}</p>}
                <div className="text-xs text-gray-500 mt-1">{p.impressoes} impressões · {p.cliques} cliques{p.dataFim ? ` · até ${p.dataFim}` : ''}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-gray-400">Prioridade
                  <input type="number" defaultValue={p.prioridade} onBlur={e => { const v = parseInt(e.target.value) || 0; if (v !== p.prioridade) moderarPromo(p.id, { prioridade: v }) }}
                    className="ml-1 w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100" />
                </label>
                <button onClick={() => moderarPromo(p.id, { ativo: !p.ativo })}
                  className={`text-xs px-3 py-1.5 rounded-lg ${p.ativo ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                  {p.ativo ? 'Pausar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-500">Maior prioridade aparece primeiro na fila (teto 2x/dia por assinante, rotacionado).</p>
        </div>
      )}

      {/* Modal criar/editar */}
      {form && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><Handshake className="w-5 h-5 text-orange-500" /> {form.id ? 'Editar' : 'Novo'} parceiro</h3>
              <button onClick={() => setForm(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Sel label="Tipo" value={form.tipo} onChange={v => setForm({ ...form, tipo: v })} options={[['influencer', 'Influencer'], ['distribuidor', 'Distribuidor']]} />
                <label className="flex items-center gap-2 text-sm text-gray-300 mt-6"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
              </div>
              <Campo label="Nome" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="E-mail (contato)" value={form.email} onChange={v => setForm({ ...form, email: v })} />
                <Campo label="Contato (WhatsApp)" value={form.contato} onChange={v => setForm({ ...form, contato: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cupom" value={form.cupom} onChange={v => setForm({ ...form, cupom: v.toUpperCase() })} placeholder={form.id ? '' : '(auto se vazio)'} />
                <Campo label="Link (slug)" value={form.linkSlug} onChange={v => setForm({ ...form, linkSlug: v.toLowerCase() })} placeholder={form.id ? '' : '(auto se vazio)'} />
              </div>
              {form.tipo === 'influencer' && (
                <div className="border border-gray-800 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Regra de comissão</div>
                  <div className="grid grid-cols-2 gap-3">
                    <CampoNum label="% plano mensal" value={form.comissaoPercMensal} onChange={v => setForm({ ...form, comissaoPercMensal: v })} />
                    <CampoNum label="% plano anual" value={form.comissaoPercAnual} onChange={v => setForm({ ...form, comissaoPercAnual: v })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-300 mt-2">
                    <input type="checkbox" checked={form.comissaoRecorrente} onChange={e => setForm({ ...form, comissaoRecorrente: e.target.checked })} />
                    Recorrente (a cada pagamento). Desmarcado = só a 1ª parcela.
                  </label>
                  <Campo label="Wallet Asaas (opcional)" value={form.walletId} onChange={v => setForm({ ...form, walletId: v })} placeholder="para o payout futuro" />
                </div>
              )}
              <div className="border border-gray-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-400 mb-2">Acesso ao portal do parceiro</div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="E-mail de login" value={form.loginEmail} onChange={v => setForm({ ...form, loginEmail: v })} />
                  <Campo label={form.temLogin ? 'Nova senha' : 'Senha'} value={form.loginSenha} onChange={v => setForm({ ...form, loginSenha: v })} placeholder={form.id ? 'deixe vazio p/ manter' : ''} />
                </div>
              </div>
            </div>
            <button onClick={salvar} disabled={salvando} className="mt-5 w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar parceiro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
    </div>
  )
}
function CampoNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input type="number" step="0.1" min="0" value={value} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
    </div>
  )
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}
