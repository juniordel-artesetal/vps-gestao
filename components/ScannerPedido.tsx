'use client'
// components/ScannerPedido.tsx
// Consulta de pedido na expedição (sector-agnostic). Auto-gated por ExpedicaoConfig.ativo.
// Três formas de encontrar o pedido, conforme "metodo" da config:
//   • QR/código de barras (etiqueta própria) — html5-qrcode
//   • OCR (etiqueta externa tipo Shopee: "Pedido: XXXX") — tesseract.js, SEMPRE com
//     passo de confirmação (OCR não é 100%)
//   • Digitação manual (fallback sempre disponível)
// Casa por numero, id interno OU id da plataforma (scoped). Abre um pop-up com os
// campos configurados (campoDestaque grande) e permite imprimir um QR confiável.

import { useEffect, useRef, useState, useCallback } from 'react'
import { ScanLine, X, Keyboard, Camera, Package, ScanText, QrCode, Check, Printer, Barcode } from 'lucide-react'

interface ExpConfig { ativo: boolean; campos: string[]; campoDestaque: string; tipoCodigo: string; metodo: string }
type Modo = 'qr' | 'ocr' | 'manual'

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
  const cv = pedido.camposExtras?.[key]
  return cv != null && cv !== '' ? String(cv) : '—'
}
function labelCampo(key: string) { return LABEL_PADRAO[key] || key }

// Extrai o código após "Pedido:" (etiqueta Shopee etc.); fallback = maior token alfanumérico
function extrairCodigo(txt: string): string {
  const m = txt.match(/pedido[^A-Za-z0-9]{0,4}([A-Za-z0-9][A-Za-z0-9\-]{4,})/i)
  if (m) return m[1]
  const toks = txt.match(/[A-Za-z0-9\-]{6,}/g) || []
  return toks.sort((a, b) => b.length - a.length)[0] || ''
}

// Recorta SÓ a faixa central (onde a moldura guia o "Pedido:"), faz upscale,
// escala de cinza e binarização — texto pequeno fica muito mais legível p/ OCR.
function preprocessFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const W = video.videoWidth, H = video.videoHeight
  const cropX = Math.floor(W * 0.05), cropW = Math.floor(W * 0.90)
  const cropY = Math.floor(H * 0.36), cropH = Math.floor(H * 0.28)
  const scale = 2.6
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(cropW * scale))
  canvas.height = Math.max(1, Math.floor(cropH * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g; sum += g
  }
  const mean = sum / (d.length / 4)
  const th = mean * 0.85 // threshold relativo à média (binariza)
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < th ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

// Votação: entre os códigos lidos em vários frames, escolhe o mais frequente
// (desempate pelo mais longo).
function votarCodigo(votos: string[]): string {
  if (votos.length === 0) return ''
  const count: Record<string, number> = {}
  for (const v of votos) count[v] = (count[v] || 0) + 1
  return Object.entries(count).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
}

export function ScannerPedido() {
  const [config, setConfig] = useState<ExpConfig | null>(null)
  const [open, setOpen] = useState(false)
  const [modo, setModo] = useState<Modo>('qr')
  const [manual, setManual] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [pedido, setPedido] = useState<any>(null)
  const [erro, setErro] = useState('')
  // OCR
  const [ocrLoading, setOcrLoading] = useState(false)
  const [confirmacao, setConfirmacao] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scannerRef = useRef<any>(null)
  const readerId = 'scanner-pedido-reader'

  useEffect(() => {
    fetch('/api/config/expedicao').then(r => r.ok ? r.json() : null).then(setConfig).catch(() => setConfig(null))
  }, [])

  const pararCamera = useCallback(async () => {
    const s = scannerRef.current
    if (s) { try { await s.stop() } catch {}; try { s.clear() } catch {}; scannerRef.current = null }
  }, [])
  const pararOcr = useCallback(() => {
    const st = streamRef.current
    if (st) { st.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])
  const pararTudo = useCallback(async () => { await pararCamera(); pararOcr() }, [pararCamera, pararOcr])

  const consultar = useCallback(async (codigo: string) => {
    const cod = codigo.trim()
    if (!cod) return
    setBuscando(true); setErro('')
    await pararTudo()
    try {
      const r = await fetch(`/api/producao/pedidos/consulta?codigo=${encodeURIComponent(cod)}`)
      if (r.status === 404) { setErro('Pedido não encontrado neste ateliê. Confira o código.'); return }
      if (!r.ok) { setErro('Erro ao consultar.'); return }
      setPedido(await r.json()); setConfirmacao(null)
    } finally { setBuscando(false) }
  }, [pararTudo])

  // ── Câmera leitor QR/Barras (html5-qrcode), formatos conforme o método ──
  const metodoCfg = config?.metodo || 'todos'
  useEffect(() => {
    if (!open || modo !== 'qr' || pedido) return
    let cancelado = false
    ;(async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelado) return
        let formats: any[] | undefined
        if (metodoCfg === 'qr') formats = [Html5QrcodeSupportedFormats.QR_CODE]
        else if (metodoCfg === 'barras') formats = [
          Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.ITF, Html5QrcodeSupportedFormats.CODABAR,
        ]
        const scanner = new Html5Qrcode(readerId, formats ? { formatsToSupport: formats, verbose: false } as any : undefined as any)
        scannerRef.current = scanner
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } },
          (texto: string) => { consultar(texto) }, () => {})
      } catch {
        if (!cancelado) { setErro('Não foi possível abrir a câmera. Use OCR ou o código manual.'); setModo('manual') }
      }
    })()
    return () => { cancelado = true; pararCamera() }
  }, [open, modo, pedido, metodoCfg, consultar, pararCamera])

  // ── Câmera OCR (getUserMedia) ──
  useEffect(() => {
    if (!open || modo !== 'ocr' || pedido || confirmacao !== null) return
    let cancelado = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
      } catch {
        if (!cancelado) { setErro('Não foi possível abrir a câmera. Use o código manual.'); setModo('manual') }
      }
    })()
    return () => { cancelado = true; pararOcr() }
  }, [open, modo, pedido, confirmacao, pararOcr])

  async function capturarOcr() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setOcrLoading(true); setErro('')
    let worker: any = null
    try {
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('eng')
      // Código do pedido é alfanumérico em maiúsculas; PSM 7 = linha única
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-',
        tessedit_pageseg_mode: '7',
      })
      // Vários frames (recorte + pré-processamento) → votação
      const votos: string[] = []
      for (let i = 0; i < 3; i++) {
        const canvas = preprocessFrame(video)
        const { data } = await worker.recognize(canvas)
        const cod = extrairCodigo(String(data?.text || '')).toUpperCase()
        if (cod) votos.push(cod)
        await new Promise(res => setTimeout(res, 120))
      }
      pararOcr()
      const escolhido = votarCodigo(votos)
      if (!escolhido) setErro('Não consegui ler o número. Ajuste a moldura e tente de novo, ou digite.')
      setConfirmacao(escolhido)
    } catch {
      setErro('Não consegui ler o texto. Tente de novo ou digite o código.')
    } finally {
      if (worker) { try { await worker.terminate() } catch {} }
      setOcrLoading(false)
    }
  }

  const modosDisp: Modo[] =
    metodoCfg === 'ocr' ? ['ocr', 'manual']
    : metodoCfg === 'qr' ? ['qr', 'manual']
    : metodoCfg === 'barras' ? ['qr', 'manual']
    : ['qr', 'ocr', 'manual'] // todos

  function abrir() { setOpen(true); setModo(modosDisp[0]); setPedido(null); setErro(''); setManual(''); setConfirmacao(null) }
  async function fechar() { await pararTudo(); setOpen(false); setPedido(null); setErro(''); setManual(''); setConfirmacao(null) }
  async function lerOutro() { await pararTudo(); setPedido(null); setErro(''); setManual(''); setConfirmacao(null); setModo(modosDisp[0]) }
  async function trocarModo(m: Modo) { await pararTudo(); setErro(''); setConfirmacao(null); setModo(m) }

  if (!config?.ativo) return null

  const campos = (config.campos && config.campos.length > 0) ? config.campos : ['numero', 'destinatario', 'produto', 'setor_atual_nome']
  const destaque = config.campoDestaque || 'numero'
  const readerLabel = metodoCfg === 'qr' ? 'QR-Code' : metodoCfg === 'barras' ? 'Cód. de barras' : 'QR/Barras'
  const readerIcon = metodoCfg === 'barras' ? Barcode : QrCode
  const MODO_META: Record<Modo, { label: string; icon: any }> = {
    qr: { label: readerLabel, icon: readerIcon }, ocr: { label: 'Foto (OCR)', icon: ScanText }, manual: { label: 'Manual', icon: Keyboard },
  }

  return (
    <>
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
                  <button onClick={() => window.open(`/dashboard/pedidos/${pedido.id}/qr`, '_blank')}
                    className="w-full mt-4 flex items-center justify-center gap-2 border border-orange-300 dark:border-orange-800 text-orange-600 dark:text-orange-400 rounded-lg py-2 text-sm font-semibold hover:bg-orange-50 dark:hover:bg-orange-900/20">
                    <Printer size={15} /> Imprimir QR deste pedido
                  </button>
                  <div className="flex gap-2 mt-3">
                    <button onClick={lerOutro} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold">Ler outro</button>
                    <button onClick={fechar} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg py-2.5 text-sm font-semibold">Fechar</button>
                  </div>
                </div>
              ) : confirmacao !== null ? (
                // ── Passo de CONFIRMAÇÃO do OCR ──
                <form onSubmit={e => { e.preventDefault(); consultar(confirmacao) }}>
                  <p className="text-sm text-gray-700 dark:text-gray-200 mb-1 font-medium">Confira o código lido</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">A leitura por foto pode errar. Ajuste se precisar antes de buscar.</p>
                  <input autoFocus value={confirmacao} onChange={e => setConfirmacao(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-base font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={() => trocarModo('ocr')} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg py-2.5 text-sm font-semibold">Tirar outra foto</button>
                    <button type="submit" disabled={buscando || !confirmacao.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1"><Check size={15} /> Buscar pedido</button>
                  </div>
                  {erro && <p className="text-sm text-red-500 text-center mt-3">{erro}</p>}
                </form>
              ) : (
                <>
                  {/* Alternador de métodos (conforme config.metodo) */}
                  <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-4">
                    {modosDisp.map(m => {
                      const Icon = MODO_META[m].icon
                      return (
                        <button key={m} onClick={() => trocarModo(m)} className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg ${modo === m ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-semibold shadow-sm' : 'text-gray-500'}`}>
                          <Icon size={15} /> {MODO_META[m].label}
                        </button>
                      )
                    })}
                  </div>

                  {modo === 'qr' && (
                    <div>
                      <div id={readerId} className="w-full rounded-xl overflow-hidden bg-black min-h-[240px]" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">Aponte para o QR ou código de barras da etiqueta.</p>
                    </div>
                  )}

                  {modo === 'ocr' && (
                    <div>
                      <div className="relative rounded-xl overflow-hidden bg-black min-h-[240px]">
                        <video ref={videoRef} playsInline muted className="w-full max-h-[300px] object-cover" />
                        {/* Mira guiada — alinhada à faixa que é recortada para o OCR (36%–64%) */}
                        <div className="pointer-events-none absolute border-2 border-orange-400 rounded-md" style={{ left: '5%', right: '5%', top: '36%', height: '28%' }} />
                        <div className="pointer-events-none absolute inset-x-0 text-center" style={{ top: 'calc(36% - 20px)' }}>
                          <span className="text-[11px] text-orange-200 bg-black/50 px-2 py-0.5 rounded">Encaixe o número do pedido na moldura</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">Alinhe a linha <strong>"Pedido: ..."</strong> dentro da moldura e toque em capturar.</p>
                      <button onClick={capturarOcr} disabled={ocrLoading} className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2">
                        <Camera size={16} /> {ocrLoading ? 'Lendo...' : 'Capturar e ler'}
                      </button>
                    </div>
                  )}

                  {modo === 'manual' && (
                    <form onSubmit={e => { e.preventDefault(); consultar(manual) }}>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Código / nº do pedido / ID da plataforma</label>
                      <div className="flex gap-2">
                        <input autoFocus value={manual} onChange={e => setManual(e.target.value)} placeholder="Ex.: 260628A47CAYQF"
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
