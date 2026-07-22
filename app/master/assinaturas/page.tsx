'use client'
// /master/assinaturas — gestão das assinaturas ASAAS.
//
// Fonte ADICIONAL: a visão Hotmart (/master/hotmart) segue intocada. Aqui só
// aparece quem tem assinaturaOrigem='asaas'.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, ShieldCheck, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Assinatura {
  workspaceId: string; workspace: string; status: string; ativo: boolean
  liberacaoManual: boolean; liberacaoMotivo: string | null
  trialAte: string | null; expiraEm: string | null
  subscriptionId: string | null; ciclo: string | null; valor: number | null
  proximoVencimento: string | null
  canceladaEm: string | null; canceladaPor: string | null; canceladaMotivo: string | null
  splitWalletId: string | null; splitValor: number | null; splitErro: string | null
  parceiro: string | null; parceiroWallet: string | null; emailAdmin: string | null
}
interface Falha {
  workspace: string; workspaceId: string; parceiro: string | null
  parceiroWallet: string | null; splitErro: string | null
  valorPlano: number | null; ciclo: string | null; desde: string
}
interface Dados {
  assinaturas: Assinatura[]
  comissoes: { status: string; quantidade: number; total: number }[]
  falhasSplit: Falha[]
  anomalias: { paymentId: string; anomalia: string; valor: number; workspace: string; workspaceId: string; pagoEm: string | null }[]
  totais: Record<string, number>
}

const brl = (v: number | null) => v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const COR: Record<string, string> = {
  TRIAL: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  ATIVA: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  INADIMPLENTE: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  CORTADA: 'bg-red-500/20 text-red-300 border-red-500/30',
  CANCELADA: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

export default function MasterAssinaturasPage() {
  const router = useRouter()
  const [d, setD] = useState<Dados | null>(null)
  const [filtro, setFiltro] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/master/assinaturas${filtro ? `?status=${filtro}` : ''}`)
    if (r.status === 401) { router.push('/master/login'); return }
    if (r.ok) setD(await r.json())
  }, [router, filtro])
  useEffect(() => { carregar() }, [carregar])

  async function acao(acaoNome: string, workspaceId: string, confirmacao?: string) {
    if (confirmacao && !confirm(confirmacao)) return
    setOcupado(workspaceId)
    const r = await fetch('/api/master/assinaturas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: acaoNome, workspaceId }),
    })
    const j = await r.json().catch(() => ({}))
    setOcupado('')
    setMsg(r.ok ? 'Feito.' : (j.error || 'Falhou.'))
    setTimeout(() => setMsg(''), 5000)
    carregar()
  }

  if (!d) return <div className="p-6 text-gray-500 text-sm">Carregando…</div>

  const t = d.totais ?? {}

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <CreditCard className="w-6 h-6 text-orange-500" />
        <h1 className="text-xl font-bold">Assinaturas Asaas</h1>
        <span className="text-xs text-gray-500">Hotmart segue em /master/hotmart</span>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-200 text-sm">{msg}</div>}

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        {[['total', 'Total'], ['trial', 'Trial'], ['ativa', 'Ativas'], ['inadimplente', 'Inadimplentes'],
          ['cortada', 'Cortadas'], ['cancelada', 'Canceladas'], ['liberadas', 'Liberadas']].map(([k, r]) => (
          <div key={k} className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2">
            <div className="text-xl font-bold text-gray-100">{t[k] ?? 0}</div>
            <div className="text-xs text-gray-500">{r}</div>
          </div>
        ))}
      </div>

      {/* ⚠️ Falhas de split — exigência da revisão: comissão manual não pode ser invisível */}
      {d.falhasSplit?.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-amber-200">
              Comissões que precisam de repasse manual ({d.falhasSplit.length})
            </h2>
          </div>
          <p className="text-xs text-amber-200/70 mb-3">
            O split não foi aplicado nestas assinaturas. A cobrança funciona normalmente —
            o que falta é repassar a comissão ao parceiro por fora.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-amber-200/60 border-b border-amber-500/20">
                <tr>
                  <th className="text-left py-1.5">Ateliê</th><th className="text-left">Parceiro</th>
                  <th className="text-left">Plano</th><th className="text-left">Motivo</th><th className="text-left">Desde</th>
                </tr>
              </thead>
              <tbody className="text-amber-100/90">
                {d.falhasSplit.map(f => (
                  <tr key={f.workspaceId} className="border-b border-amber-500/10">
                    <td className="py-1.5 pr-3">{f.workspace}</td>
                    <td className="pr-3">{f.parceiro ?? '—'}</td>
                    <td className="pr-3">{f.ciclo} {brl(f.valorPlano)}</td>
                    <td className="pr-3">{f.splitErro ?? 'parceiro sem walletId'}</td>
                    <td>{f.desde}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ⚠️ Cobrança divergente — borda do 12x pago em 1x */}
      {d.anomalias?.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="font-semibold text-amber-200">
              Cobranças fora do preço combinado ({d.anomalias.length})
            </h2>
          </div>
          <p className="text-xs text-amber-200/70 mb-3">
            A artesã escolheu parcelar mas pagou de uma vez, então foi cobrada acima do
            preço à vista. Decida o gesto: estorno da diferença, crédito ou um contato.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-amber-200/60 border-b border-amber-500/20">
                <tr>
                  <th className="text-left py-1.5">Ateliê</th><th className="text-left">Cobrança</th>
                  <th className="text-left">Pago</th><th className="text-left">O que houve</th>
                </tr>
              </thead>
              <tbody className="text-amber-100/90">
                {d.anomalias.map(a => (
                  <tr key={a.paymentId} className="border-b border-amber-500/10">
                    <td className="py-1.5 pr-3">{a.workspace}</td>
                    <td className="pr-3 font-mono text-[11px]">{a.paymentId}</td>
                    <td className="pr-3">{brl(a.valor)}{a.pagoEm ? ` · ${a.pagoEm}` : ''}</td>
                    <td className="pr-3">{a.anomalia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comissões */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-gray-100 mb-3">Comissões</h2>
        {d.comissoes?.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma comissão registrada.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {d.comissoes.map(c => (
              <div key={c.status} className="bg-gray-800/60 rounded-lg px-3 py-2">
                <div className="text-sm font-semibold text-gray-100">{brl(c.total)}</div>
                <div className="text-xs text-gray-500">{c.status} · {c.quantidade}x</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtro + lista */}
      <div className="flex flex-wrap gap-2 mb-3">
        {['', 'TRIAL', 'ATIVA', 'INADIMPLENTE', 'CORTADA', 'CANCELADA'].map(s => (
          <button key={s} onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-lg text-xs ${filtro === s ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {s || 'Todas'}
          </button>
        ))}
        <button onClick={carregar} className="px-3 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-gray-500 border-b border-gray-800">
            <tr>
              <th className="text-left p-3">Ateliê</th><th className="text-left">Status</th>
              <th className="text-left">Plano</th><th className="text-left">Trial até</th>
              <th className="text-left">Próx. venc.</th><th className="text-left">Parceiro</th>
              <th className="text-left">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {d.assinaturas.map(a => (
              <tr key={a.workspaceId} className="border-b border-gray-800/60">
                <td className="p-3">
                  <div className="font-medium text-gray-100">{a.workspace}</div>
                  <div className="text-gray-600">{a.emailAdmin}</div>
                </td>
                <td>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] ${COR[a.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {a.status}
                  </span>
                  {a.liberacaoManual && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-emerald-400" title={a.liberacaoMotivo ?? ''}>
                      <ShieldCheck className="w-3 h-3" /> liberada
                    </span>
                  )}
                  {a.canceladaEm && (
                    <div className="text-gray-600 mt-0.5">cancelada {a.canceladaEm} ({a.canceladaPor})</div>
                  )}
                </td>
                <td className="pr-3">{a.ciclo ? `${a.ciclo} ${brl(a.valor)}` : '—'}</td>
                <td className="pr-3">{a.trialAte ?? '—'}</td>
                <td className="pr-3">{a.proximoVencimento ?? a.expiraEm ?? '—'}</td>
                <td className="pr-3">
                  {a.parceiro ?? '—'}
                  {a.parceiro && !a.splitWalletId && (
                    <span className="block text-amber-400 text-[11px]">sem split</span>
                  )}
                  {a.splitValor && <span className="block text-emerald-400 text-[11px]">{brl(a.splitValor)}</span>}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {a.liberacaoManual ? (
                      <button disabled={!!ocupado} onClick={() => acao('revogarLiberacao', a.workspaceId,
                        `Revogar a liberação de ${a.workspace}? Ela volta a seguir a régua normal.`)}
                        className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-[11px] disabled:opacity-40">
                        Revogar liberação
                      </button>
                    ) : (
                      <button disabled={!!ocupado} onClick={() => acao('liberar', a.workspaceId,
                        `Liberar ${a.workspace}? Ela deixa de ser cortada por falta de pagamento, até você revogar.`)}
                        className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] disabled:opacity-40">
                        Liberar
                      </button>
                    )}
                    {a.subscriptionId && a.status !== 'CANCELADA' && (
                      <button disabled={!!ocupado} onClick={() => acao('cancelar', a.workspaceId,
                        `Cancelar a assinatura de ${a.workspace}?\n\nAs cobranças futuras deixam de existir. Ela mantém o acesso até o fim do período já pago.`)}
                        className="px-2 py-1 rounded text-red-300 hover:bg-red-500/10 text-[11px] disabled:opacity-40 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {d.assinaturas.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-500">Nenhuma assinatura Asaas ainda.</p>
        )}
      </div>
    </div>
  )
}
