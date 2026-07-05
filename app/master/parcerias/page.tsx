'use client'
// app/master/parcerias/page.tsx
// Painel de Parcerias: visão de negócio/tração para vender publicidade a
// fornecedores. Métricas globais e agregadas. Só Master.

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, RefreshCw, ShoppingCart, DollarSign, Receipt, Users, Wifi,
  Building2, Store, Package, Search, Megaphone, MousePointerClick, Eye, TrendingUp,
} from 'lucide-react'

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number) => (Number(n) || 0).toLocaleString('pt-BR')
const mesLabel = (m: string) => { const [a, mm] = m.split('-'); return `${mm}/${a.slice(2)}` }

function Card({ icon: Icon, label, valor, sub, cor = 'text-white' }: { icon: any; label: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Icon size={13} /> {label}</div>
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function BarList({ dados, corBar = 'bg-orange-500' }: { dados: { rotulo: string; valor: number }[]; corBar?: string }) {
  const max = Math.max(1, ...dados.map(d => d.valor))
  if (dados.length === 0) return <p className="text-xs text-gray-600 py-4 text-center">Sem dados ainda.</p>
  return (
    <div className="space-y-1.5">
      {dados.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-28 truncate flex-shrink-0" title={d.rotulo}>{d.rotulo}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
            <div className={`h-full ${corBar} rounded-full`} style={{ width: `${Math.round((d.valor / max) * 100)}%` }} />
          </div>
          <span className="text-xs text-gray-300 w-10 text-right flex-shrink-0">{num(d.valor)}</span>
        </div>
      ))}
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">{titulo}</h2>
      {children}
    </div>
  )
}

export default function ParceriasPage() {
  const [d, setD] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try { const r = await fetch('/api/master/parcerias'); setD(r.ok ? await r.json() : null) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const ctr = d && d.anuncios.impressoes > 0 ? Math.round((d.anuncios.cliques / d.anuncios.impressoes) * 1000) / 10 : 0
  const maxCresc = d ? Math.max(1, ...d.crescimento.map((c: any) => c.novos)) : 1

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/master" className="text-gray-400 hover:text-white transition"><ArrowLeft size={18} /></a>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2"><TrendingUp size={15} className="text-emerald-400" /> Painel de Parcerias</h1>
            <p className="text-gray-500 text-xs">Visão de negócio e tração — material para parcerias e publicidade</p>
          </div>
        </div>
        <button onClick={carregar} className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"><RefreshCw size={13} /> Atualizar</button>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {loading ? <p className="text-gray-500 text-sm text-center py-16">Carregando...</p> : !d ? <p className="text-gray-600 text-sm text-center py-16">Sem dados.</p> : (
          <>
            <Bloco titulo="Atividade econômica na plataforma">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card icon={ShoppingCart} label="Pedidos no sistema" valor={num(d.economia.pedidos)} sub={`${num(d.economia.pedidosValidos)} não cancelados`} />
                <Card icon={DollarSign} label="GMV processado" valor={brl(d.economia.gmv)} cor="text-emerald-400" sub="exclui cancelados" />
                <Card icon={Receipt} label="Ticket médio" valor={brl(d.economia.ticketMedio)} cor="text-emerald-300" />
              </div>
            </Bloco>

            <Bloco titulo="Alcance e atividade">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card icon={Users} label="Assinantes ativas" valor={num(d.alcance.workspacesAtivos)} sub={`${num(d.alcance.workspacesTotal)} no total`} cor="text-blue-400" />
                <Card icon={Wifi} label="Online agora *" valor={num(d.alcance.online5min)} sub="* aprox. (últimos 5 min)" cor="text-green-400" />
                <Card icon={Users} label="Ativas (30 dias)" valor={num(d.alcance.ativas30d)} sub="usuárias c/ acesso recente" cor="text-teal-400" />
                <Card icon={Building2} label="Fornecedores" valor={num(d.inventario.fornecedores)} sub="cadastrados na base" cor="text-orange-400" />
              </div>
              <p className="text-[11px] text-gray-600 mt-2">* "Online agora" é uma aproximação por último acesso (últimos 5 min). Presença em tempo real fica para uma evolução futura.</p>
            </Bloco>

            <Bloco titulo="Inventário de anúncios (Assistente de Compras)">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card icon={Search} label="Buscas (30 dias)" valor={num(d.assistente.buscas30d)} cor="text-purple-400" />
                <Card icon={Eye} label="Impressões de patrocinados" valor={num(d.anuncios.impressoes)} />
                <Card icon={MousePointerClick} label="Cliques em patrocinados" valor={num(d.anuncios.cliques)} sub={`CTR ${ctr}%`} />
                <Card icon={Megaphone} label="Patrocinados ativos" valor={num(d.anuncios.patrocinadosAtivos)} sub={`${num(d.anuncios.patrocinados)} no total`} cor="text-orange-400" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
                <Card icon={Package} label="Materiais na base (índice)" valor={num(d.inventario.materiais)} cor="text-cyan-400" />
                <Card icon={Store} label="Lojas virtuais ativas" valor={num(d.inventario.lojasAtivas)} cor="text-pink-400" />
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mt-3">
                <p className="text-xs font-semibold text-gray-400 mb-3">🔎 Termos mais buscados (30 dias)</p>
                <BarList dados={(d.assistente.topTermos || []).map((t: any) => ({ rotulo: t.termo, valor: t.total }))} corBar="bg-purple-500" />
              </div>
            </Bloco>

            <Bloco titulo="Distribuição das assinantes">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Por segmento</p>
                  <BarList dados={(d.porSegmento || []).map((s: any) => ({ rotulo: s.segmento, valor: s.total }))} corBar="bg-blue-500" />
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 mb-3">Por estado</p>
                  <BarList dados={(d.porEstado || []).map((s: any) => ({ rotulo: s.estado, valor: s.total }))} corBar="bg-teal-500" />
                </div>
              </div>
            </Bloco>

            <Bloco titulo="Crescimento de assinantes (12 meses)">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                {(d.crescimento || []).length === 0 ? <p className="text-xs text-gray-600 py-4 text-center">Sem dados ainda.</p> : (
                  <div className="flex items-end gap-2 h-40">
                    {d.crescimento.map((c: any, i: number) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0">
                        <span className="text-[10px] text-gray-400">{c.novos}</span>
                        <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${Math.max(4, Math.round((c.novos / maxCresc) * 130))}px` }} />
                        <span className="text-[9px] text-gray-500">{mesLabel(c.mes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Bloco>

            <p className="text-[11px] text-gray-600 text-center mt-6">Dados agregados e globais · gerado {d.geradoEm ? new Date(d.geradoEm).toLocaleString('pt-BR') : ''}</p>
          </>
        )}
      </div>
    </div>
  )
}
