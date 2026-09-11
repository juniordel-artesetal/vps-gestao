'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Loader2, Link2, Unlink, RefreshCw, Clock } from 'lucide-react'

interface StatusML { conectado: boolean; sellerId: string | null; nickname: string | null; expiraEm: string | null; credenciais: boolean }
interface StatusTikTok { gate: boolean; conectado?: boolean; sellerName?: string | null; shopId?: string | null; regiao?: string | null; expiraEm?: string | null; ultimaSync?: string | null; credenciais?: boolean }

function quando(iso?: string | null): string {
  if (!iso) return 'ainda não sincronizado'
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

// Casca visual comum de um card de canal.
function Card({ emoji, nome, desc, children }: { emoji: string; nome: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{emoji}</span>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900 dark:text-white">{nome}</h2>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

function EmBreve({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      {texto}
    </div>
  )
}

export default function IntegracoesPage() {
  const sp = useSearchParams()
  const [ml, setMl] = useState<StatusML | null>(null)
  const [tt, setTt] = useState<StatusTikTok | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [resumoML, setResumoML] = useState('')
  const [resumoTT, setResumoTT] = useState('')

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
  const ftt = sp.get('tiktok')
  const banner = flag === 'ok' ? { ok: true, txt: 'Mercado Livre conectado! 🎉' }
    : flag === 'erro' ? { ok: false, txt: 'Não consegui concluir a conexão. Tente novamente.' }
    : flag === 'recusado' ? { ok: false, txt: 'Você recusou a autorização no Mercado Livre.' }
    : flag === 'state' ? { ok: false, txt: 'Link de retorno inválido ou expirado. Comece de novo.' }
    : ftt === 'ok' ? { ok: true, txt: 'Loja do TikTok Shop conectada! 🎉' }
    : ftt === 'erro' ? { ok: false, txt: 'Não consegui concluir a conexão com o TikTok. Tente novamente.' }
    : ftt === 'recusado' ? { ok: false, txt: 'Você recusou a autorização no TikTok.' }
    : ftt === 'state' ? { ok: false, txt: 'Link de retorno inválido ou expirado. Comece pelo botão "Conectar" aqui.' }
    : null

  async function acao(url: string, setResumo: (s: string) => void, msgOk: (j: any) => string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setOcupado(true); setResumo('')
    const r = await fetch(url, { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (msgOk) setResumo(r.ok ? msgOk(j) : (j.error || 'Não foi possível concluir.'))
    carregar()
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Integrações</h1>
      <p className="text-sm text-gray-500 mb-6">Conecte suas lojas para trazer seus pedidos automaticamente — é só clicar em conectar e autorizar. Você não precisa digitar nenhuma chave.</p>

      {banner && (
        <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm border ${banner.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {banner.txt}
        </div>
      )}

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── TikTok Shop (conector funcional; gated por INTEGRACOES_ATIVO) ── */}
          <Card emoji="🎵" nome="TikTok Shop" desc="Traz seus pedidos do TikTok Shop automaticamente.">
            {!tt?.gate ? (
              <EmBreve texto="Em breve! Estamos liberando a conexão com o TikTok Shop aos poucos." />
            ) : !tt.credenciais ? (
              <EmBreve texto="Integração ainda não liberada pelo SOA. Em breve você poderá conectar sua loja." />
            ) : tt.conectado ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Conectada{tt.sellerName ? ` · ${tt.sellerName}` : tt.shopId ? ` · loja ${tt.shopId}` : ''}.</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" /> Última sincronização: {quando(tt.ultimaSync)}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => acao('/api/integracoes/tiktok/sincronizar', setResumoTT, j => `Pedidos sincronizados: ${j.importados ?? 0} (de ${j.encontrados ?? 0}).`)} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    <RefreshCw className="w-4 h-4" /> Sincronizar agora
                  </button>
                  <a href="/api/integracoes/tiktok/conectar"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <RefreshCw className="w-4 h-4" /> Reconectar
                  </a>
                  <button onClick={() => acao('/api/integracoes/tiktok/desconectar', setResumoTT, () => 'Loja desconectada.', 'Desconectar sua loja do TikTok Shop?')} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                    <Unlink className="w-4 h-4" /> Desconectar
                  </button>
                </div>
                {resumoTT && <p className="text-xs text-gray-500">{resumoTT}</p>}
              </div>
            ) : (
              <a href="/api/integracoes/tiktok/conectar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-gray-900 hover:opacity-90">
                <Link2 className="w-4 h-4" /> Conectar minha loja
              </a>
            )}
          </Card>

          {/* ── Mercado Livre (conector existe; "em breve" enquanto não liberado) ── */}
          <Card emoji="🛒" nome="Mercado Livre" desc="Comissão real (Listing Prices) na precificação + pedidos e repasses.">
            {!ml ? (
              <EmBreve texto="Em breve." />
            ) : !ml.credenciais ? (
              <EmBreve texto="Em breve! A conexão com o Mercado Livre está sendo liberada aos poucos." />
            ) : ml.conectado ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Conectada{ml.nickname ? ` · ${ml.nickname}` : ml.sellerId ? ` · conta ${ml.sellerId}` : ''}.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => acao('/api/integracoes/ml/sincronizar', setResumoML, j => `Pedidos: ${j.importados ?? 0} (de ${j.encontrados ?? 0}). Taxas: ${j.taxasAtualizadas ? 'atualizadas' : '—'}.`)} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                    <RefreshCw className="w-4 h-4" /> Sincronizar agora
                  </button>
                  <button onClick={() => acao('/api/integracoes/ml/desconectar', setResumoML, () => 'Conta desconectada.', 'Desconectar sua conta do Mercado Livre? As taxas voltam a usar o catálogo padrão.')} disabled={ocupado}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                    <Unlink className="w-4 h-4" /> Desconectar
                  </button>
                </div>
                {resumoML && <p className="text-xs text-gray-500">{resumoML}</p>}
              </div>
            ) : (
              <a href="/api/integracoes/ml/conectar"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFE600] px-5 py-2.5 text-sm font-semibold text-gray-900 hover:brightness-95">
                <Link2 className="w-4 h-4" /> Conectar Mercado Livre
              </a>
            )}
          </Card>

          {/* ── Shopee (conector ainda não existe) ── */}
          <Card emoji="🧡" nome="Shopee" desc="Traz seus pedidos e repasses da Shopee automaticamente.">
            <EmBreve texto="Em breve! A conexão com a Shopee está no nosso roteiro." />
          </Card>

        </div>
      )}
    </div>
  )
}
