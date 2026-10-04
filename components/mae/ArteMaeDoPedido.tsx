'use client'
// Card "Arte MAE" na tela do PEDIDO (Sprint 12): status (não gerada / Arte gerada ✓ / revisar) + nome do
// arquivo + histórico, tema que o SOA achou, campos que faltam, e "Gerar arte" (abre o editor MAE já
// personalizado). Só aparece para contas com o Método MAE liberado (add-on ou beta).
import { useEffect, useState } from 'react'
import { Wand2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { statusDoCard, camposDoPedido, faltando, type ArteRegistro } from '@/lib/mae/pedidos/pedidos'

interface Pedido { id: string; numero: string; campos: Record<string, string>; artes: ArteRegistro[] }

export default function ArteMaeDoPedido({ pedidoId }: { pedidoId: string }) {
  const [p, setP] = useState<Pedido | null>(null)
  const [oculto, setOculto] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch(`/api/mae/pedidos?id=${encodeURIComponent(pedidoId)}`).then(async r => {
      if (!r.ok) { if (vivo) setOculto(true); return }
      const j = await r.json(); if (vivo) setP(j.pedidos?.[0] ?? null)
    }).catch(() => vivo && setOculto(true))
    return () => { vivo = false }
  }, [pedidoId])
  if (oculto || !p) return null
  const st = statusDoCard(p.artes)
  const falta = faltando(camposDoPedido(p.campos))
  const nomeArq = (a: string | null) => a?.split('/').slice(-2).join('/') ?? '—'
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2" data-card-arte-mae>
      <div className="flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-orange-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">Arte (Método MAE)</h3>
        {st.status === 'gerada' && <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1" data-status-card="gerada"><CheckCircle2 className="w-3.5 h-3.5" /> Arte gerada ✓</span>}
        {st.status === 'revisar' && <span className="text-xs font-semibold text-amber-700 flex items-center gap-1" data-status-card="revisar"><AlertTriangle className="w-3.5 h-3.5" /> Revisar</span>}
        {st.status === 'nao_gerada' && <span className="text-xs text-gray-500" data-status-card="nao_gerada">Não gerada</span>}
      </div>
      {st.ultima && <p className="text-[11px] text-gray-600 dark:text-gray-300 break-all">Arquivo: <b>{nomeArq(st.ultima.arquivo)}</b> · tema v{st.ultima.themeVersion}</p>}
      {falta.length > 0 && <p className="text-[11px] text-amber-700">Faltam os campos: {falta.join(', ')} (crie em Configurações → Campos do pedido).</p>}
      <a href={`/estudio/mae?pedido=${encodeURIComponent(p.id)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600" data-gerar-arte-pedido>
        <Wand2 className="w-3.5 h-3.5" /> {st.status === 'nao_gerada' ? 'Gerar arte' : 'Gerar de novo'}
      </a>
      {st.historico.length > 1 && (
        <details className="text-[11px] text-gray-500"><summary className="cursor-pointer">Histórico ({st.historico.length})</summary>
          <ul className="mt-1 space-y-0.5">{st.historico.map((a, i) => <li key={i}>{new Date(a.criadoEm).toLocaleString('pt-BR')} · {a.status} · {nomeArq(a.arquivo)}</li>)}</ul>
        </details>
      )}
    </div>
  )
}
