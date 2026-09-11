'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Loader2, Link2, Unlink, RefreshCw } from 'lucide-react'

interface StatusML { conectado: boolean; sellerId: string | null; nickname: string | null; expiraEm: string | null; credenciais: boolean }
interface StatusTikTok { gate: boolean; conectado?: boolean; sellerName?: string | null; shopId?: string | null; regiao?: string | null; expiraEm?: string | null; credenciais?: boolean }

export default function IntegracoesPage() {
  const sp = useSearchParams()
  const [ml, setMl] = useState<StatusML | null>(null)
  const [tt, setTt] = useState<StatusTikTok | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [sincResumo, setSincResumo] = useState<string>('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [rml, rtt] = await Promise.all([
      fetch('/api/integracoes/ml/status'),
      fetch('/api/integracoes/tiktok/status'),
    ])
    if (rml.ok) setMl(await rml.json())
    if (rtt.ok) setTt(await rtt.json())
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const flag = sp.get('ml')
  const bannerML = flag === 'ok' ? { tipo: 'ok', txt: 'Mercado Livre conectado! 🎉' }
    : flag === 'erro' ? { tipo: 'erro', txt: 'Não consegui concluir a conexão. Tente novamente.' }
    : flag === 'recusado' ? { tipo: 'erro', txt: 'Você recusou a autorização no Mercado Livre.' }
    : flag === 'state' ? { tipo: 'erro', txt: 'Link de retorno inválido ou expirado. Comece de novo.' }
    : null

  const ftt = sp.get('tiktok')
  const bannerTT = ftt === 'ok' ? { tipo: 'ok', txt: 'Loja do TikTok Shop conectada! 🎉' }
    : ftt === 'erro' ? { tipo: 'erro', txt: 'Não consegui concluir a conexão com o TikTok. Tente novamente.' }
    : ftt === 'recusado' ? { tipo: 'erro', txt: 'Você recusou a autorização no TikTok.' }
    : ftt === 'state' ? { tipo: 'erro', txt: 'Link de retorno inválido ou expirado. Comece pelo botão "Conectar" aqui.' }
    : null
  const banner = bannerML || bannerTT

  async function desconectarML() {
    if (!confirm('Desconectar sua conta do Mercado Livre? As taxas voltam a usar o catálogo padrão.')) return
    setOcupado(true)
    await fetch('/api/integracoes/ml/desconectar', { method: 'POST' })
    setOcupado(false)
    carregar()
  }
  async function sincronizarML() {
    setOcupado(true); setSincResumo('')
    const r = await fetch('/api/integracoes/ml/sincronizar', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    setSincResumo(r.ok ? `Pedidos sincronizados: ${j.importados ?? 0} (de ${j.encontrados ?? 0}). Taxas: ${j.taxasAtualizadas ? 'atualizadas' : '—'}.` : (j.error || 'Falha ao sincronizar.'))
  }
  async function desconectarTikTok() {
    if (!confirm('Desconectar sua loja do TikTok Shop?')) return
    setOcupado(true)
    await fetch('/api/integracoes/tiktok/desconectar', { method: 'POST' })
    setOcupado(false)
    carregar()
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Integrações</h1>
      <p className="text-sm text-gray-500 mb-6">Conecte seus canais para trazer taxas reais e pedidos automaticamente.</p>

      {banner && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${banner.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {banner.txt}
        </div>
      )}

      {/* ── Mercado Livre ── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🛒</span>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">Mercado Livre</h2>
            <p className="text-xs text-gray-500">Comissão real (Listing Prices) na precificação + pedidos e repasses.</p>
          </div>
          {carregando && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
        </div>

        {!carregando && ml && (
          <>
            {!ml.credenciais ? (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Integração ainda não liberada pelo SOA. Em breve você poderá conectar sua conta.
              </div>
            ) : ml.conectado ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Conectado{ml.nickname ? ` como ${ml.nickname}` : ml.sellerId ? ` (conta ${ml.sellerId})` : ''}.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={sincronizarML} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    <RefreshCw className="w-4 h-4" /> Sincronizar pedidos e taxas
                  </button>
                  <button onClick={desconectarML} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                    <Unlink className="w-4 h-4" /> Desconectar
                  </button>
                </div>
                {sincResumo && <p className="text-xs text-gray-500">{sincResumo}</p>}
              </div>
            ) : (
              <a href="/api/integracoes/ml/conectar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFE600] px-4 py-2 text-sm font-semibold text-gray-900 hover:brightness-95">
                <Link2 className="w-4 h-4" /> Conectar Mercado Livre
              </a>
            )}
          </>
        )}
      </div>

      {/* ── TikTok Shop (gate INTEGRACOES_ATIVO) ── */}
      {!carregando && tt?.gate && (
        <div className="mt-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">🎵</span>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white">TikTok Shop</h2>
              <p className="text-xs text-gray-500">Conecte sua loja para trazer pedidos automaticamente.</p>
            </div>
          </div>

          {!tt.credenciais ? (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              Integração ainda não liberada pelo SOA. Em breve você poderá conectar sua loja.
            </div>
          ) : tt.conectado ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span>Conectado{tt.sellerName ? ` — ${tt.sellerName}` : tt.shopId ? ` (loja ${tt.shopId})` : ''}.</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/api/integracoes/tiktok/conectar"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <RefreshCw className="w-4 h-4" /> Reconectar
                </a>
                <button onClick={desconectarTikTok} disabled={ocupado}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                  <Unlink className="w-4 h-4" /> Desconectar
                </button>
              </div>
            </div>
          ) : (
            <a href="/api/integracoes/tiktok/conectar"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:opacity-90">
              <Link2 className="w-4 h-4" /> Conectar minha loja
            </a>
          )}
        </div>
      )}
    </div>
  )
}
