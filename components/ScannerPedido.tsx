'use client'
// components/ScannerPedido.tsx
// Consulta de pedido por leitura de QR/código de barras na expedição.
// Auto-gated: só renderiza o botão quando ExpedicaoConfig.ativo. Lê pela câmera
// (html5-qrcode, QR + 1D como Code128) com entrada manual como fallback, e abre um
// pop-up com os campos configurados (campoDestaque grande, para picking físico).

import { useEffect, useRef, useState, useCallback } from 'react'
import { ScanLine, X, Keyboard, Camera, Package } from 'lucide-react'

interface ExpConfig { ativo: boolean; campos: string[]; campoDestaque: string; tipoCodigo: string }

const CAMPOS_PADRAO: { key: string; label: string }[] = [
  { key: 'numero', label: 'Nº do pedido' },
  { key: 'destinatario', label: 'Cliente' },
  { key: 'produto', label: 'Produto(s)' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'valor', label: 'Valor' },
  { key: 'status', label: 'Status' },
  { key: 'prioridade', label: 'Prioridade' },
  { key: 'canal', label: 'Canal' },
  { key: 'dataEntrada', label: 'Entrada' },
  { key: 'dataEnvio', label: 'Envio' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'observacoes', label: 'Observações' },
  { key: 'setor_atual_nome', label: 'Setor atual' },
]
const LABEL_PADRAO: Record<string, string> = Object.fromEntries(CAMPOS_PADRAO.map(c => [c.key, c.label]))
const STATUS_PT: Record<string, string> = { ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção', CONCLUIDO: 'Concluído', ENVIADO: 'Enviado', CANCELADO: 'Cancelado' }

function fmtValor(v: any) { const n = parseFloat(String(v)); return isNaN(n) ? '—' : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
function fmtData(s: any) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('pt-BR') } catch { return String(s) } }

function valorCampo(pedido: any, key: string): string {
  if (key === 'valor') return fmtValor(pedido.valor)
  if (key === 'quantidade') return pedido.quantidade != null ? String(pedido.quantidade) : '—'
  if (key === 'status') return STATUS_PT[pedido.status] || pedido.status || '—'
  if (key === 'dataEntrada') return fmtData(pedido.dataEntrada)
  if (key === 'dataEnvio') return fmtData(pedido.dataEnvio)
  if (key in LABEL_PADRAO) { const v = pedido[key]; return v != null && v !== '' ? String(v) : '—' }
  // campo personalizado (camposExtras)
  const cv = pedido.camposExtras?.[key]
  return cv != null && cv !== '' ? String(cv) : '—'
}
function labelCampo(key: string) { return LABEL_PADRAO[key] || key }

export function ScannerPedido() {
  const [config, setConfig] = useState<ExpConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<'camera' | 'manual'>('camera')
  const [manual, setManual] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [pedido, setPedido] = useState<any>(null)
  const [erro, setErro] = useState('')
  const scannerRef = useRef<any>(null)
  const readerId = 'scanner-pedido-reader'

  useEffect(() => {
    fetch('/api/config/expedicao').then(r => r.ok ? r.json() : null).then(setConfig).catch(() => setConfig(null))
  }, [])

  const pararCamera = useCallback(async () => {
    const s = scannerRef.current
    if (s) { try { await s.stop() } catch {}; try { s.clear() } catch {}; scannerRef.current = null }
  }, [])

  const consultar = useCallback(async (codigo: string) => {
    const cod = codigo.trim()
    if (!cod) return
    setBuscando(true); setErro('')
    await pararCamera()
    try {
      const r = await fetch(`/api/producao/pedidos/consulta?codigo=${encodeURIComponent(cod)}`)
      if (r.status === 404) { setErro('Pedido não encontrado neste ateliê.'); setModo('manual'); return }
      if (!r.ok) { setErro('Erro ao consultar.'); return }
      setPedido(await r.json())
    } finally { setBuscando(false) }
  }, [pararCamera])

  // Inicia a câmera quando o modal abre em modo câmera e ainda não há resultado
  useEffect(() => {
    if (!open || modo !== 'camera' || pedido) return
    let cancelado = false
    ;(async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelado) return
        const scanner = new Html5Qrcode(readerId)
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (texto: string) => { consultar(texto) },
          () => { /* ignora frames sem código */ }
        )
      } catch {
        if (!cancelado) { setErro('Não foi possível abrir a câmera. Use o código manual.'); setModo('manual') }
      }
    })()
    return () => { cancelado = true; pararCamera() }
  }, [open, modo, pedido, consultar, pararCamera])

  function abrir() { setOpen(true); setModo('camera'); setPedido(null); setErro(''); setManual('') }
  async function fechar() { await pararCamera(); setOpen(false); setPedido(null); setErro(''); setManual('') }
  async function lerOutro() { await pararCamera(); setPedido(null); setErro(''); setManual(''); setModo('camera') }

  if (!config?.ativo) return null

  const campos = (config.campos && config.campos.length > 0) ? config.campos : ['numero', 'destinatario', 'produto', 'setor_atual_nome']
  const destaque = config.campoDestaque || 'numero'

  return (
    <>
      {/* Botão flutuante (FAB) — bom para mobile na expedição */}
      <button onClick={abrir}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-3 rounded-full shadow-lg print:hidden">
        <ScanLine size={20} /> <span className="hidden sm:inline">Ler pedido</span>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={fechar}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><ScanLine size={18} className="text-orange-500" /> Consultar pedido</h2>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
            </div>

            <div className="p-5">
              {pedido ? (
                // ── POP-UP do pedido (picking) ──
                <div>
                  <div className="text-center bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-5 mb-4">
                    <p className="text-xs uppercase tracking-wide text-orange-600 dark:text-orange-400 font-semibold mb-1">{labelCampo(destaque)}</p>
                    <p className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white break-words leading-tight">{valorCampo(pedido, destaque)}</p>
                  </div>
                  <div className="space-y-2">
                    {campos.filter(k => k !== destaque).map(k => (
                      <div key={k} className="flex items-baseline justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-1.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{labelCampo(k)}</span>
                        <span className="text-base font-semibold text-gray-900 dark:text-white text-right break-words">{valorCampo(pedido, k)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={lerOutro} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold">Ler outro</button>
                    <button onClick={fechar} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg py-2.5 text-sm font-semibold">Fechar</button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Alternador câmera / manual */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
                    <button onClick={() => setModo('camera')} className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${modo === 'camera' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow-sm' : 'text-gray-500'}`}><Camera size={15} /> Câmera</button>
                    <button onClick={() => { pararCamera(); setModo('manual') }} className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${modo === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow-sm' : 'text-gray-500'}`}><Keyboard size={15} /> Manual</button>
                  </div>

                  {modo === 'camera' ? (
                    <div>
                      <div id={readerId} className="w-full rounded-xl overflow-hidden bg-black min-h-[240px]" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">Aponte a câmera para o QR ou código de barras da etiqueta.</p>
                    </div>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); consultar(manual) }}>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Código / nº do pedido</label>
                      <div className="flex gap-2">
                        <input autoFocus value={manual} onChange={e => setManual(e.target.value)} placeholder="Ex.: LID-MQ1DHW0F"
                          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                        <button type="submit" disabled={buscando || !manual.trim()} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 text-sm font-semibold disabled:opacity-50 flex items-center gap-1"><Package size={15} /></button>
                      </div>
                    </form>
                  )}

                  {buscando && <p className="text-xs text-gray-500 text-center mt-3">Consultando...</p>}
                  {erro && <p className="text-sm text-red-500 text-center mt-3">{erro}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
