'use client'
// Vendas e Números por marketplace (menu do módulo pago). Visão geral por canal + período,
// filtros, lista detalhada e estado vazio. Só leitura; fonte = PedidoMarketplace.
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Store, Filter, ShoppingBag } from 'lucide-react'

const CANAL_LABEL: Record<string, string> = {
  tiktokshop: 'TikTok Shop', mercadolivre: 'Mercado Livre', shopee: 'Shopee', amazon: 'Amazon',
}
const rotuloCanal = (c: string) => CANAL_LABEL[c] || c
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Resumo { canal: string; pedidos: number; bruto: number; taxas: number; liquido: number }
interface Linha { idExterno: string; canal: string; status: string | null; data: string | null; bruto: number; liquido: number; cliente: string | null; temPedido: boolean }
interface Dados { liberado: boolean; resumoPorCanal?: Resumo[]; totais?: { pedidos: number; bruto: number; taxas: number; liquido: number }; lista?: Linha[] }

export default function MarketplacePage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [f, setF] = useState({ de: '', ate: '', canal: '', status: '', busca: '', produto: '', valorMin: '', valorMax: '' })
  // Upsell / assinatura paga
  const [cpf, setCpf] = useState('')
  const [assinando, setAssinando] = useState(false)
  const [assinaMsg, setAssinaMsg] = useState('')
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)

  async function assinar() {
    setAssinando(true); setAssinaMsg('')
    try {
      const r = await fetch('/api/marketplace/assinar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setAssinaMsg(j.error || 'Não foi possível iniciar a assinatura.'); return }
      if (j.invoiceUrl) { setInvoiceUrl(j.invoiceUrl); setAssinaMsg('Assinatura criada! Conclua o pagamento no link abaixo — o módulo libera assim que o pagamento for confirmado.') }
      else setAssinaMsg('Assinatura criada! Você receberá a cobrança no Asaas; o módulo libera após o pagamento.')
    } catch { setAssinaMsg('Erro de conexão. Tente novamente.') }
    finally { setAssinando(false) }
  }

  const carregar = useCallback(async () => {
    setCarregando(true)
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v).map(([k, v]) => [k, v])).toString()
    const r = await fetch('/api/marketplace/vendas' + (qs ? '?' + qs : ''))
    setDados(r.ok ? await r.json() : { liberado: false })
    setCarregando(false)
  }, [f])
  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }))

  if (carregando && !dados) {
    return <div className="p-6 flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>
  }

  // Sem o módulo pago → upsell.
  if (dados && !dados.liberado) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/40 p-6 text-center">
          <Store className="w-10 h-10 text-orange-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Integração com Marketplaces</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Traga seus pedidos de TikTok Shop, Mercado Livre e Shopee automaticamente, com vendas e números por canal.
          </p>
          <p className="text-base font-semibold text-gray-900 dark:text-white mt-4">R$ 19,90/mês</p>

          {invoiceUrl ? (
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
              Pagar agora (Pix ou cartão)
            </a>
          ) : (
            <div className="mt-4 max-w-xs mx-auto text-left">
              <label className="text-xs text-gray-500">CPF do titular (para a cobrança)</label>
              <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" />
              <button onClick={assinar} disabled={assinando || cpf.trim().length < 11}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                {assinando ? 'Criando…' : 'Assinar por R$ 19,90/mês'}
              </button>
            </div>
          )}
          {assinaMsg && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{assinaMsg}</p>}
        </div>
      </div>
    )
  }

  const t = dados?.totais
  const resumo = dados?.resumoPorCanal ?? []
  const lista = dados?.lista ?? []

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Vendas e Números</h1>
      <p className="text-sm text-gray-500 mb-5">Suas vendas por marketplace, no período e com os filtros escolhidos.</p>

      {/* Filtros */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-5">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3"><Filter className="w-4 h-4" /> Filtros</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-xs text-gray-500">De<input type="date" value={f.de} onChange={set('de')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Até<input type="date" value={f.ate} onChange={set('ate')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Canal
            <select value={f.canal} onChange={set('canal')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
              <option value="">Todos</option>
              <option value="tiktokshop">TikTok Shop</option>
              <option value="mercadolivre">Mercado Livre</option>
              <option value="shopee">Shopee</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">Status<input value={f.status} onChange={set('status')} placeholder="ex.: COMPLETED" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Produto<input value={f.produto} onChange={set('produto')} placeholder="nome do produto" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Buscar<input value={f.busca} onChange={set('busca')} placeholder="cliente ou nº do pedido" className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Valor mín.<input type="text" inputMode="decimal" value={f.valorMin} onChange={set('valorMin')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
          <label className="text-xs text-gray-500">Valor máx.<input type="text" inputMode="decimal" value={f.valorMax} onChange={set('valorMax')} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700" /></label>
        </div>
        <button onClick={carregar} disabled={carregando}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Aplicar
        </button>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { rot: 'Pedidos', val: String(t?.pedidos ?? 0) },
          { rot: 'Faturamento bruto', val: brl(t?.bruto ?? 0) },
          { rot: 'Taxas', val: brl(t?.taxas ?? 0) },
          { rot: 'Líquido', val: brl(t?.liquido ?? 0) },
        ].map(c => (
          <div key={c.rot} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="text-xs text-gray-500">{c.rot}</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white mt-0.5 tabular-nums">{c.val}</div>
          </div>
        ))}
      </div>

      {/* Por canal */}
      {resumo.length > 0 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-5">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Por canal</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="py-1.5 pr-3">Canal</th><th className="py-1.5 pr-3 text-right">Pedidos</th><th className="py-1.5 pr-3 text-right">Bruto</th><th className="py-1.5 pr-3 text-right">Taxas</th><th className="py-1.5 text-right">Líquido</th>
              </tr></thead>
              <tbody>
                {resumo.map(r => (
                  <tr key={r.canal} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-1.5 pr-3 font-medium text-gray-900 dark:text-white">{rotuloCanal(r.canal)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{r.pedidos}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{brl(r.bruto)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{brl(r.taxas)}</td>
                    <td className="py-1.5 text-right tabular-nums">{brl(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista detalhada / vazio */}
      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">
          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          Nenhuma venda de marketplace no período. Conecte sua loja em <b>Conectar lojas</b> e clique em <b>Sincronizar</b>.
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vendas ({lista.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="py-1.5 pr-3">Data</th><th className="py-1.5 pr-3">Canal</th><th className="py-1.5 pr-3">Pedido</th><th className="py-1.5 pr-3">Cliente</th><th className="py-1.5 pr-3">Status</th><th className="py-1.5 pr-3 text-right">Bruto</th><th className="py-1.5 text-right">Líquido</th>
              </tr></thead>
              <tbody>
                {lista.map(l => (
                  <tr key={l.canal + l.idExterno} className="border-b border-gray-50 dark:border-gray-800/50">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{l.data ? l.data.split('-').reverse().join('/') : '—'}</td>
                    <td className="py-1.5 pr-3">{rotuloCanal(l.canal)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{l.idExterno}</td>
                    <td className="py-1.5 pr-3">{l.cliente || '—'}</td>
                    <td className="py-1.5 pr-3 text-xs">{l.status || '—'}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{brl(l.bruto)}</td>
                    <td className="py-1.5 text-right tabular-nums">{brl(l.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
