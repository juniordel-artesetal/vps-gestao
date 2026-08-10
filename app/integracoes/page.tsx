'use client'
import { useEffect, useState, useCallback } from 'react'
import { Store, CheckCircle2, XCircle, Link2, RefreshCw, Package, Tag } from 'lucide-react'

interface Cfg { conectado: boolean; syncEstoque: string; importarPedidos: boolean; temCredencial: boolean }
const MARKETPLACES = [
  { key: 'mercadolivre', nome: 'Mercado Livre', cor: '#ffe600', nota: 'API pública — 1º a integrar' },
  { key: 'shopee', nome: 'Shopee', cor: '#ee4d2d', nota: 'Depende da aprovação do ISV' },
  { key: 'tiktok', nome: 'TikTok Shop', cor: '#000000', nota: 'Depende da aprovação do ISV' },
]

// Pedidos/anúncios mock (a integração real substitui amanhã)
const PEDIDOS_MOCK = [
  { id: '2000012345', canal: 'Mercado Livre', comprador: 'A***a', valor: 79.9, status: 'A enviar' },
  { id: '2000012346', canal: 'Shopee', comprador: 'M***s', valor: 34.5, status: 'Pago' },
]
const ANUNCIOS_MOCK = [
  { titulo: 'Chaveiro personalizado', canal: 'Mercado Livre', vinculado: 'Chaveiro EVA', estoque: 12 },
  { titulo: 'Kit lembrancinha', canal: 'Shopee', vinculado: '—', estoque: 0 },
]

export default function IntegracoesPage() {
  const [cfgs, setCfgs] = useState<Record<string, Cfg>>({})
  const [cred, setCred] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [msg, setMsg] = useState('')
  const [aba, setAba] = useState<'conexoes' | 'pedidos' | 'anuncios'>('conexoes')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/integracoes/config')
      if (res.ok) setCfgs((await res.json()).integracoes || {})
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function cfgDe(k: string): Cfg { return cfgs[k] || { conectado: false, syncEstoque: 'puxar', importarPedidos: false, temCredencial: false } }

  async function salvar(mkt: string, patch: Partial<Cfg> & { credencial?: string }) {
    const atual = cfgDe(mkt)
    await fetch('/api/integracoes/config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketplace: mkt, syncEstoque: patch.syncEstoque ?? atual.syncEstoque, importarPedidos: patch.importarPedidos ?? atual.importarPedidos, credencial: patch.credencial }),
    })
    setCred(p => ({ ...p, [mkt]: '' }))
    setMsg('Configuração salva.'); setTimeout(() => setMsg(''), 2500)
    carregar()
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center"><Store className="w-5 h-5 text-orange-500" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Integração de Lojas</h1>
          <p className="text-sm text-gray-500">Conecte seus marketplaces (em preparação).</p>
        </div>
      </div>

      <div className="mb-4 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        🚧 Integrações em preparação. As telas já estão prontas; a sincronização real entra assim que cada marketplace for conectado.
      </div>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm">{msg}</div>}

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {([['conexoes', 'Conexões'], ['pedidos', 'Pedidos sincronizados'], ['anuncios', 'Anúncios/Produtos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k as any)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === k ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
        ))}
      </div>

      {carregando ? <div className="text-gray-400 text-sm">Carregando…</div> : aba === 'conexoes' ? (
        <div className="space-y-3">
          {MARKETPLACES.map(m => {
            const c = cfgDe(m.key)
            return (
              <div key={m.key} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: m.cor, color: m.cor === '#000000' ? '#fff' : '#333' }}>{m.nome[0]}</div>
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-gray-100">{m.nome}</div>
                      <div className="text-[11px] text-gray-400">{m.nota}</div>
                    </div>
                  </div>
                  {c.conectado
                    ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Conectado</span>
                    : <span className="flex items-center gap-1 text-sm text-gray-400"><XCircle className="w-4 h-4" /> Desconectado</span>}
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Credencial/API {c.temCredencial && <span className="text-emerald-600">(salva)</span>}</label>
                    <div className="flex gap-2">
                      <input type="password" value={cred[m.key] || ''} onChange={e => setCred(p => ({ ...p, [m.key]: e.target.value }))} placeholder={c.temCredencial ? '•••• (mantém)' : 'colar credencial'}
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
                      <button onClick={() => salvar(m.key, { credencial: cred[m.key] })} title="Conectar (mock)"
                        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm flex items-center gap-1"><Link2 className="w-4 h-4" /> Conectar</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Estoque</label>
                    <select value={c.syncEstoque} onChange={e => salvar(m.key, { syncEstoque: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                      <option value="puxar">Puxar do marketplace</option>
                      <option value="duplo">Sincronizar (mão dupla)</option>
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 mt-3">
                  <input type="checkbox" checked={c.importarPedidos} onChange={e => salvar(m.key, { importarPedidos: e.target.checked })} className="accent-orange-500" />
                  Importar pedidos automaticamente
                </label>
              </div>
            )
          })}
        </div>
      ) : aba === 'pedidos' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/40 flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Prévia com dados de exemplo — a importação real entra com a integração.</div>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500"><th className="text-left px-4 py-2 text-xs">Pedido</th><th className="text-left px-4 py-2 text-xs">Canal</th><th className="text-left px-4 py-2 text-xs">Comprador</th><th className="text-right px-4 py-2 text-xs">Valor</th><th className="text-left px-4 py-2 text-xs">Status</th></tr></thead>
            <tbody>{PEDIDOS_MOCK.map(p => (
              <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700"><td className="px-4 py-2">#{p.id}</td><td className="px-4 py-2 text-gray-500">{p.canal}</td><td className="px-4 py-2 text-gray-500">{p.comprador}</td><td className="px-4 py-2 text-right">R$ {p.valor.toFixed(2)}</td><td className="px-4 py-2"><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{p.status}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/40 flex items-center gap-1"><Tag className="w-3 h-3" /> Prévia com dados de exemplo — o vínculo anúncio↔produto entra com a integração.</div>
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500"><th className="text-left px-4 py-2 text-xs">Anúncio</th><th className="text-left px-4 py-2 text-xs">Canal</th><th className="text-left px-4 py-2 text-xs">Produto vinculado</th><th className="text-right px-4 py-2 text-xs">Estoque</th></tr></thead>
            <tbody>{ANUNCIOS_MOCK.map((a, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-700"><td className="px-4 py-2 flex items-center gap-1"><Package className="w-3.5 h-3.5 text-gray-400" /> {a.titulo}</td><td className="px-4 py-2 text-gray-500">{a.canal}</td><td className="px-4 py-2 text-gray-500">{a.vinculado}</td><td className="px-4 py-2 text-right">{a.estoque}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
