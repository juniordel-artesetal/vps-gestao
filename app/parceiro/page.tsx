'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Handshake, Copy, Ticket, Link2, Users, DollarSign, LogOut, Gift, Package, Tag } from 'lucide-react'

interface Dados {
  parceiro: { tipo: string; nome: string; cupom: string | null; linkSlug: string | null; comissaoPercAnual: number; comissaoPercMensal: number; comissaoRecorrente: boolean; temWallet: boolean }
  leads: { id: string; nome: string; tipoAtribuicao: string | null; status: string; createdAt: string; telefoneMascarado: string; emailMascarado: string }[]
  comissoes: { id: string; competencia: string; base: number; percentual: number; valor: number; status: string; createdAt: string }[]
  resumo: { totalPendente: number; totalPago: number; leads: number }
}

const STATUS_LEAD: Record<string, { label: string; cls: string }> = {
  novo: { label: 'Novo', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  trial: { label: 'Em teste (30d)', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  convertido: { label: 'Convertido', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  perdido: { label: 'Perdido', cls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
}
function fmtBRL(v: number) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function ParceiroDashboard() {
  const router = useRouter()
  const [d, setD] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [copiado, setCopiado] = useState('')

  const carregar = useCallback(async () => {
    const res = await fetch('/api/parceiro/me')
    if (res.status === 401) { router.push('/parceiro/login'); return }
    if (res.ok) setD(await res.json())
    setCarregando(false)
  }, [router])

  useEffect(() => { carregar() }, [carregar])

  async function sair() {
    await fetch('/api/parceiro/logout', { method: 'POST' })
    router.push('/parceiro/login')
  }
  function copiar(txt: string, tag: string) {
    navigator.clipboard?.writeText(txt); setCopiado(tag); setTimeout(() => setCopiado(''), 1500)
  }

  if (carregando) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center text-sm">Carregando…</div>
  if (!d) return null

  const influencer = d.parceiro.tipo === 'influencer'
  const link = d.parceiro.linkSlug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${d.parceiro.linkSlug}` : ''

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center"><Handshake className="w-5 h-5 text-orange-500" /></div>
            <div>
              <h1 className="font-bold text-lg leading-tight">{d.parceiro.nome}</h1>
              <p className="text-xs text-gray-400">{influencer ? 'Influencer' : 'Distribuidor'} · Portal do Parceiro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!influencer && (
              <>
                <Link href="/parceiro/produtos" className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"><Package className="w-4 h-4" /> Lista de preços</Link>
                <Link href="/parceiro/promocoes" className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"><Tag className="w-4 h-4" /> Promoções</Link>
              </>
            )}
            <button onClick={sair} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><LogOut className="w-4 h-4" /> Sair</button>
          </div>
        </div>

        {/* Cupom + Link */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {d.parceiro.cupom && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Ticket className="w-3.5 h-3.5" /> Seu cupom</div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-orange-400 tracking-wide">{d.parceiro.cupom}</span>
                <button onClick={() => copiar(d.parceiro.cupom!, 'cupom')} className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center gap-1"><Copy className="w-3 h-3" /> {copiado === 'cupom' ? 'Copiado!' : 'Copiar'}</button>
              </div>
            </div>
          )}
          {link && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Link2 className="w-3.5 h-3.5" /> Seu link rastreável</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-200 truncate">{link}</span>
                <button onClick={() => copiar(link, 'link')} className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center gap-1 flex-shrink-0"><Copy className="w-3 h-3" /> {copiado === 'link' ? 'Copiado!' : 'Copiar'}</button>
              </div>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Indicações</div>
            <div className="text-2xl font-bold">{d.resumo.leads}</div>
          </div>
          {influencer ? (
            <>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> A receber</div>
                <div className="text-2xl font-bold text-amber-400">{fmtBRL(d.resumo.totalPendente)}</div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-xs text-gray-400 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Pago</div>
                <div className="text-2xl font-bold text-emerald-400">{fmtBRL(d.resumo.totalPago)}</div>
              </div>
            </>
          ) : (
            <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-2 text-sm text-gray-400">
              <Gift className="w-4 h-4 text-emerald-400" /> Cada indicação recebe 30 dias de acesso ao SOA.
            </div>
          )}
        </div>

        {/* Leads */}
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Minhas indicações</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
          {d.leads.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">Nenhuma indicação ainda. Compartilhe seu cupom/link!</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="bg-gray-800/50 text-gray-400">
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Nome</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Contato</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Via</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold">Data</th>
              </tr></thead>
              <tbody>{d.leads.map(l => {
                const st = STATUS_LEAD[l.status] || STATUS_LEAD.novo
                return (
                  <tr key={l.id} className="border-t border-gray-800">
                    <td className="px-4 py-2.5">{l.nome}</td>
                    <td className="px-4 py-2.5 text-gray-400">{l.emailMascarado}{l.telefoneMascarado !== '—' ? ` · ${l.telefoneMascarado}` : ''}</td>
                    <td className="px-4 py-2.5 text-gray-400">{l.tipoAtribuicao || '—'}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-2.5 text-gray-400">{l.createdAt}</td>
                  </tr>
                )
              })}</tbody>
            </table></div>
          )}
        </div>

        {/* Comissões (influencer) */}
        {influencer && (
          <>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Minhas comissões</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {d.comissoes.length === 0 ? (
                <div className="p-6 text-sm text-gray-500 text-center">Nenhuma comissão ainda. Elas aparecem quando uma indicação vira assinante.</div>
              ) : (
                <div className="overflow-x-auto"><table className="w-full text-sm">
                  <thead><tr className="bg-gray-800/50 text-gray-400">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold">Competência</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">Base</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">%</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">Valor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold">Status</th>
                  </tr></thead>
                  <tbody>{d.comissoes.map(c => (
                    <tr key={c.id} className="border-t border-gray-800">
                      <td className="px-4 py-2.5">{c.competencia}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{fmtBRL(c.base)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{c.percentual}%</td>
                      <td className="px-4 py-2.5 text-right font-semibold">{fmtBRL(c.valor)}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.status === 'pago' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{c.status === 'pago' ? 'Pago' : 'A receber'}</span></td>
                    </tr>
                  ))}</tbody>
                </table></div>
              )}
            </div>
            {!d.parceiro.temWallet && (
              <p className="text-xs text-gray-500 mt-2">💡 O repasse automático das comissões entra em breve (via Asaas). Por ora, o pagamento é combinado com a equipe SOA.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
