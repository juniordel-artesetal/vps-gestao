'use client'
// Painel de Postagem para o pedido/expedição. Gated por moduloPostagem (some se OFF).
// Fonte por CANAL: "Direta"/não-marketplace → cota + compra etiqueta (Melhor Envio);
// marketplace (Shopee/ML…) → etiqueta do próprio canal (stub até a Integração de Lojas).
// Impressão unificada: um botão resolve a fonte certa.
import { useEffect, useState, useCallback } from 'react'
import { Truck, Package, Printer, MapPin, Loader2, AlertTriangle, ShoppingBag } from 'lucide-react'

interface Envio {
  id: string; fonte: string; provedor: string | null; transportadora: string | null
  servico: string | null; preco: number | null; prazoDias: number | null
  etiquetaUrl: string | null; rastreio: string | null; status: string; createdAt: string
}
interface Opcao { provedor: string; servicoId: string; transportadora: string; servico: string; preco: number; prazoDias: number | null }

const CANAIS_MKT = ['shopee', 'mercado livre', 'mercadolivre', 'ml', 'tiktok', 'shein', 'amazon']
function ehMarketplace(canal: string | null | undefined) {
  const c = (canal || '').trim().toLowerCase()
  return CANAIS_MKT.some(m => c === m || c.includes(m))
}
function fmtBRL(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PostagemPanel({ orderId, canal, cepDestinoInicial, valor, destinatario }: {
  orderId: string
  canal: string | null
  cepDestinoInicial?: string | null
  valor?: number | null
  destinatario?: { nome?: string | null; cep?: string | null; logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null }
}) {
  const [moduloOn, setModuloOn] = useState<boolean | null>(null)
  const [conectado, setConectado] = useState(false)
  const [envios, setEnvios] = useState<Envio[]>([])
  const [cep, setCep] = useState((cepDestinoInicial || destinatario?.cep || '').replace(/\D/g, ''))
  const [peso, setPeso] = useState('0.3')
  const [valorSeg, setValorSeg] = useState(valor ? String(valor) : '')
  const [cotando, setCotando] = useState(false)
  const [opcoes, setOpcoes] = useState<Opcao[]>([])
  const [escolhido, setEscolhido] = useState<Opcao | null>(null)
  const [comprando, setComprando] = useState(false)
  const [msg, setMsg] = useState('')
  const [rastreando, setRastreando] = useState<string | null>(null)

  const marketplace = ehMarketplace(canal)

  const carregar = useCallback(async () => {
    const [rCfg, rEnv] = await Promise.all([
      fetch('/api/config/logistica'),
      fetch(`/api/logistica/envio?orderId=${orderId}`),
    ])
    if (rCfg.ok) {
      const d = await rCfg.json()
      setModuloOn(!!d.moduloPostagem)
      setConectado(!!d.config?.conectado)
    } else setModuloOn(false)
    if (rEnv.ok) setEnvios(await rEnv.json())
  }, [orderId])

  useEffect(() => { carregar() }, [carregar])

  function aviso(m: string) { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  async function cotar() {
    if (cep.replace(/\D/g, '').length !== 8) { aviso('Informe o CEP de destino.'); return }
    setCotando(true); setOpcoes([]); setEscolhido(null)
    try {
      const res = await fetch('/api/logistica/cotar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cepDestino: cep, peso: Number(peso) || 0.3, valor: Number(valorSeg) || 0 }),
      })
      const d = await res.json()
      if (res.ok) setOpcoes(d.opcoes || [])
      else aviso(d.error || 'Falha na cotação.')
    } finally { setCotando(false) }
  }

  async function comprar() {
    if (!escolhido) return
    setComprando(true)
    try {
      const res = await fetch('/api/logistica/envio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId, canal, servicoId: escolhido.servicoId,
          transportadora: escolhido.transportadora, servico: escolhido.servico,
          preco: escolhido.preco, prazoDias: escolhido.prazoDias,
          destinatario: { ...destinatario, cep },
          pacote: { peso: Number(peso) || 0.3, valor: Number(valorSeg) || 0 },
        }),
      })
      const d = await res.json()
      if (res.ok && d.ok) { aviso('Etiqueta gerada!'); setOpcoes([]); setEscolhido(null); carregar() }
      else aviso(d.erro || d.error || 'Falha ao gerar etiqueta.')
    } finally { setComprando(false) }
  }

  async function registrarMarketplace() {
    setComprando(true)
    try {
      const res = await fetch('/api/logistica/envio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, canal }),
      })
      const d = await res.json()
      aviso(d.mensagem || d.error || 'Registrado.')
      carregar()
    } finally { setComprando(false) }
  }

  async function imprimir(id: string) {
    const res = await fetch(`/api/logistica/etiqueta/${id}/imprimir`)
    const d = await res.json()
    if (res.ok && d.url) window.open(d.url, '_blank')
    else aviso(d.error || 'Etiqueta indisponível.')
  }

  async function rastrear(id: string) {
    setRastreando(id)
    try {
      const res = await fetch(`/api/logistica/rastrear/${id}`)
      const d = await res.json()
      if (res.ok) { aviso(`Status: ${d.status || '—'}${d.rastreio ? ' · ' + d.rastreio : ''}`); carregar() }
      else aviso(d.error || 'Rastreio indisponível.')
    } finally { setRastreando(null) }
  }

  if (moduloOn === null) return null       // ainda carregando
  if (!moduloOn) return null                // módulo OFF → nada aparece

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-4 h-4 text-orange-500" />
        <h3 className="font-semibold text-gray-800 dark:text-gray-100">Postagem</h3>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
          {marketplace ? `Etiqueta via ${canal}` : 'Venda direta'}
        </span>
      </div>

      {msg && <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">{msg}</div>}

      {/* MARKETPLACE — stub até a Integração de Lojas */}
      {marketplace ? (
        <div className="text-sm text-gray-600 dark:text-gray-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg p-3 flex gap-2">
          <ShoppingBag className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            A etiqueta deste canal é emitida pelo próprio <strong>{canal}</strong>. Ela será puxada
            automaticamente quando a <strong>Integração de Lojas</strong> for ativada.
            <button onClick={registrarMarketplace} disabled={comprando}
              className="mt-2 block text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
              Preparar etiqueta do marketplace
            </button>
          </div>
        </div>
      ) : !conectado ? (
        <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>Conecte a conta de transportadora em <a href="/config/logistica" className="underline font-medium">Configurações → Postagem</a> para cotar e gerar etiquetas.</div>
        </div>
      ) : (
        <>
          {/* Cotação */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <label className="text-[11px] text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> CEP destino</label>
              <input value={cep} onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="00000000" className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Peso (kg)</label>
              <input type="number" step="0.1" min="0.05" value={peso} onChange={e => setPeso(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Valor seg. (R$)</label>
              <input type="number" step="0.01" min="0" value={valorSeg} onChange={e => setValorSeg(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <button onClick={cotar} disabled={cotando}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5">
            {cotando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} Cotar frete
          </button>

          {opcoes.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {opcoes.map((o) => (
                <label key={o.servicoId} className={`flex items-center justify-between gap-2 p-2 rounded-lg border cursor-pointer text-sm ${escolhido?.servicoId === o.servicoId ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="servico" checked={escolhido?.servicoId === o.servicoId} onChange={() => setEscolhido(o)} className="accent-orange-500" />
                    <span className="text-gray-700 dark:text-gray-200">{o.transportadora} · {o.servico}</span>
                  </div>
                  <span className="text-gray-500">{fmtBRL(o.preco)}{o.prazoDias != null ? ` · ${o.prazoDias}d` : ''}</span>
                </label>
              ))}
              <button onClick={comprar} disabled={!escolhido || comprando}
                className="mt-1 text-sm px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1.5">
                {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Comprar &amp; gerar etiqueta
              </button>
            </div>
          )}
        </>
      )}

      {/* Envios já criados */}
      {envios.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Etiquetas</div>
          {envios.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 text-sm border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <div className="text-gray-700 dark:text-gray-200 truncate">
                  {e.fonte === 'marketplace' ? `${e.provedor || 'Marketplace'}` : `${e.transportadora || 'Transportadora'} · ${e.servico || ''}`}
                  {e.preco != null && <span className="text-gray-400"> · {fmtBRL(e.preco)}</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {e.status}{e.rastreio ? ` · ${e.rastreio}` : ''}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => imprimir(e.id)} title="Imprimir etiqueta"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Printer className="w-4 h-4" /></button>
                <button onClick={() => rastrear(e.id)} disabled={rastreando === e.id} title="Rastrear"
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                  {rastreando === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
