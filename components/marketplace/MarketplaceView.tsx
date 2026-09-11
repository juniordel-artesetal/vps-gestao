'use client'
// View compartilhada dos submenus de Marketplaces. `modo` decide o recorte:
//   geral | vendas | entregas | devolucoes | repasses
// Fonte: /api/marketplace/vendas (só lojas sincronizadas). Sem o módulo → upsell (assinar).
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Filter, ShoppingBag, Store, Truck, RotateCcw, DollarSign } from 'lucide-react'

const CANAL: Record<string, string> = { tiktokshop: 'TikTok Shop', mercadolivre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon' }
const rotulo = (c: string) => CANAL[c] || c
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dataBR = (s: string | null) => s ? s.split('-').reverse().join('/') : '—'

export type Modo = 'geral' | 'vendas' | 'entregas' | 'devolucoes' | 'repasses'
const TITULOS: Record<Modo, { t: string; s: string }> = {
  geral: { t: 'Visão Geral', s: 'Seus números por marketplace, só das lojas conectadas.' },
  vendas: { t: 'Vendas / Pedidos', s: 'Todos os pedidos sincronizados, com filtros.' },
  entregas: { t: 'Entregas', s: 'Status de envio e rastreio dos pedidos.' },
  devolucoes: { t: 'Cancelamentos e Devoluções', s: 'Pedidos cancelados, devoluções e reembolsos.' },
  repasses: { t: 'Repasses', s: 'Taxas do canal e líquido a receber (repasse estimado).' },
}

interface Dados {
  liberado: boolean
  lojasConectadas?: { canal: string; sellerName: string | null; shopId: string | null; ultimaSync: string | null }[]
  resumoPorCanal?: any[]
  totais?: { pedidos: number; bruto: number; taxas: number; liquido: number; entregues: number; cancelados: number; ticketMedio: number; aReceber: number; recebido: number }
  serie?: { dia: string; pedidos: number; bruto: number }[]
  topProdutos?: { produto: string; qtd: number; total: number }[]
  lista?: { idExterno: string; canal: string; status: string | null; data: string | null; bruto: number; liquido: number; taxa: number; cliente: string | null; rastreio: string | null; fulfillmentStatus: string | null; temPedido: boolean }[]
}

export default function MarketplaceView({ modo }: { modo: Modo }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [f, setF] = useState({ de: '', ate: '', canal: '', status: '', busca: '', produto: '', valorMin: '', valorMax: '' })
  const [cpf, setCpf] = useState(''); const [assinando, setAssinando] = useState(false); const [assinaMsg, setAssinaMsg] = useState(''); const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)

  const categoria = modo === 'entregas' ? 'entregas' : modo === 'devolucoes' ? 'cancelados' : ''
  const carregar = useCallback(async () => {
    setCarregando(true)
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][])
    if (categoria) q.set('categoria', categoria)
    const r = await fetch('/api/marketplace/vendas' + (q.toString() ? '?' + q.toString() : ''))
    setDados(r.ok ? await r.json() : { liberado: false })
    setCarregando(false)
  }, [f, categoria])
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setC = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  async function assinar() {
    setAssinando(true); setAssinaMsg('')
    try {
      const r = await fetch('/api/marketplace/assinar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setAssinaMsg(j.error || 'Não foi possível iniciar a assinatura.'); return }
      if (j.invoiceUrl) { setInvoiceUrl(j.invoiceUrl); setAssinaMsg('Assinatura criada! Conclua o pagamento — o módulo libera assim que confirmar.') }
      else setAssinaMsg('Assinatura criada! O módulo libera após o pagamento.')
    } catch { setAssinaMsg('Erro de conexão.') } finally { setAssinando(false) }
  }

  if (carregando && !dados) return <div className="p-6 flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>

  // Upsell (sem o módulo pago)
  if (dados && !dados.liberado) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 p-6 text-center">
          <Store className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Integração com Marketplaces</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Traga seus pedidos de TikTok Shop, Mercado Livre e Shopee automaticamente, com vendas e números por canal.</p>
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-4">R$ 19,90/mês</p>
          {invoiceUrl ? (
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">Pagar agora (Pix ou cartão)</a>
          ) : (
            <div className="mt-4 max-w-xs mx-auto text-left">
              <label className="text-xs text-gray-500">CPF do titular (para a cobrança)</label>
              <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" />
              <button onClick={assinar} disabled={assinando || cpf.trim().length < 11} className="mt-2 w-full rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{assinando ? 'Criando…' : 'Assinar por R$ 19,90/mês'}</button>
            </div>
          )}
          {assinaMsg && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{assinaMsg}</p>}
        </div>
      </div>
    )
  }

  const t = dados?.totais
  const lista = dados?.lista ?? []
  const semLojas = (dados?.lojasConectadas?.length ?? 0) === 0
  const cab = TITULOS[modo]

  // KPIs por modo
  const kpis = modo === 'repasses'
    ? [{ r: 'Taxas do canal', v: brl(t?.taxas ?? 0) }, { r: 'A receber (previsto)', v: brl(t?.aReceber ?? 0) }, { r: 'Recebido', v: brl(t?.recebido ?? 0) }, { r: 'Líquido total', v: brl(t?.liquido ?? 0) }]
    : [{ r: 'Pedidos', v: String(t?.pedidos ?? 0) }, { r: 'Faturamento bruto', v: brl(t?.bruto ?? 0) }, { r: 'Ticket médio', v: brl(t?.ticketMedio ?? 0) }, { r: 'Líquido', v: brl(t?.liquido ?? 0) }, { r: 'Entregues', v: String(t?.entregues ?? 0) }, { r: 'Cancelados', v: String(t?.cancelados ?? 0) }, { r: 'A receber', v: brl(t?.aReceber ?? 0) }, { r: 'Recebido', v: brl(t?.recebido ?? 0) }]

  const serie = dados?.serie ?? []
  const maxBruto = Math.max(1, ...serie.map(s => s.bruto))

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{cab.t}</h1>
      <p className="text-sm text-gray-500 mb-5">{cab.s}</p>

      {/* Lojas conectadas */}
      {modo === 'geral' && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(dados?.lojasConectadas ?? []).map((l, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300">
              <Store className="w-3.5 h-3.5" /> {l.canal}{l.sellerName ? ` · ${l.sellerName}` : ''}{l.ultimaSync ? ` · sync ${l.ultimaSync.replace('T', ' ')}` : ''}
            </span>
          ))}
          {semLojas && <span className="text-xs text-gray-500">Nenhuma loja conectada ainda — conecte em <b>Conectar lojas</b>.</span>}
        </div>
      )}

      {/* Filtros (nas telas de lista) */}
      {modo !== 'geral' && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-5">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"><Filter className="w-4 h-4" /> Filtros</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="text-xs text-gray-500">De<input type="date" value={f.de} onChange={setC('de')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
            <label className="text-xs text-gray-500">Até<input type="date" value={f.ate} onChange={setC('ate')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
            <label className="text-xs text-gray-500">Canal
              <select value={f.canal} onChange={setC('canal')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
                <option value="">Todos</option><option value="tiktokshop">TikTok Shop</option><option value="mercadolivre">Mercado Livre</option><option value="shopee">Shopee</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">Buscar<input value={f.busca} onChange={setC('busca')} placeholder="cliente ou nº" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          </div>
          <button onClick={carregar} disabled={carregando} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Aplicar
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className={`grid grid-cols-2 ${modo === 'geral' ? 'sm:grid-cols-4' : 'sm:grid-cols-4'} gap-3 mb-5`}>
        {kpis.map(c => (
          <div key={c.r} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs text-gray-500">{c.r}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">{c.v}</div>
          </div>
        ))}
      </div>

      {/* Gráfico vendas/dia + por canal + top produtos (só na Visão Geral) */}
      {modo === 'geral' && (
        <>
          {serie.length > 0 && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-5">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Faturamento por dia</div>
              <div className="flex items-end gap-1 h-32 overflow-x-auto">
                {serie.map(s => (
                  <div key={s.dia} className="flex-1 min-w-[8px] flex flex-col items-center justify-end" title={`${dataBR(s.dia)}: ${brl(s.bruto)} (${s.pedidos} ped.)`}>
                    <div className="w-full rounded-t bg-orange-400" style={{ height: `${Math.max(3, (s.bruto / maxBruto) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 flex justify-between"><span>{dataBR(serie[0]?.dia)}</span><span>{dataBR(serie[serie.length - 1]?.dia)}</span></div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Por canal</div>
              {(dados?.resumoPorCanal ?? []).length === 0 ? <p className="text-xs text-gray-500">Sem vendas ainda.</p> : (dados?.resumoPorCanal ?? []).map((r: any) => (
                <div key={r.canal} className="flex justify-between text-sm py-1 border-b border-gray-50 dark:border-gray-800/50">
                  <span>{rotulo(r.canal)} <span className="text-xs text-gray-400">({r.pedidos})</span></span>
                  <span className="tabular-nums">{brl(r.bruto)}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mais vendidos</div>
              {(dados?.topProdutos ?? []).length === 0 ? <p className="text-xs text-gray-500">Sem dados de produtos.</p> : (dados?.topProdutos ?? []).map((p, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50 dark:border-gray-800/50">
                  <span className="truncate pr-2">{p.produto} <span className="text-xs text-gray-400">×{p.qtd}</span></span>
                  <span className="tabular-nums">{brl(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Lista (todas as telas menos a Visão Geral) */}
      {modo !== 'geral' && (
        lista.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">
            {modo === 'entregas' ? <Truck className="w-8 h-8 mx-auto mb-2 text-gray-400" /> : modo === 'devolucoes' ? <RotateCcw className="w-8 h-8 mx-auto mb-2 text-gray-400" /> : modo === 'repasses' ? <DollarSign className="w-8 h-8 mx-auto mb-2 text-gray-400" /> : <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-gray-400" />}
            {semLojas ? 'Conecte uma loja em Conectar lojas e clique em Sincronizar.' : 'Nada por aqui no período/filtro selecionado.'}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{cab.t} ({lista.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                  <th className="py-1.5 pr-3">Data</th><th className="py-1.5 pr-3">Canal</th><th className="py-1.5 pr-3">Pedido</th><th className="py-1.5 pr-3">Cliente</th>
                  <th className="py-1.5 pr-3">Status</th>
                  {modo === 'entregas' && <th className="py-1.5 pr-3">Rastreio</th>}
                  {modo === 'repasses' && <th className="py-1.5 pr-3 text-right">Taxa</th>}
                  <th className="py-1.5 pr-3 text-right">Bruto</th><th className="py-1.5 text-right">Líquido</th>
                </tr></thead>
                <tbody>
                  {lista.map(l => (
                    <tr key={l.canal + l.idExterno} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{dataBR(l.data)}</td>
                      <td className="py-1.5 pr-3">{rotulo(l.canal)}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{l.idExterno}</td>
                      <td className="py-1.5 pr-3">{l.cliente || '—'}</td>
                      <td className="py-1.5 pr-3 text-xs">{l.status || '—'}</td>
                      {modo === 'entregas' && <td className="py-1.5 pr-3 font-mono text-xs">
                        {l.rastreio || '—'}
                        {l.fulfillmentStatus === 'pendente' && <span className="ml-1 font-sans text-amber-600" title="A expedição concluiu; o aviso ao TikTok será reenviado automaticamente.">⏳ envio ao TikTok pendente</span>}
                        {(l.fulfillmentStatus === 'aguardando_coleta' || l.status === 'AWAITING_COLLECTION') && (l.status !== 'IN_TRANSIT' && l.status !== 'DELIVERED' && l.status !== 'COMPLETED') && <span className="ml-1 font-sans inline-flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 px-1.5 text-blue-700 dark:text-blue-300">📦 aguardando coleta</span>}
                      </td>}
                      {modo === 'repasses' && <td className="py-1.5 pr-3 text-right tabular-nums">{brl(l.taxa)}</td>}
                      <td className="py-1.5 pr-3 text-right tabular-nums">{brl(l.bruto)}</td>
                      <td className="py-1.5 text-right tabular-nums">{brl(l.liquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
