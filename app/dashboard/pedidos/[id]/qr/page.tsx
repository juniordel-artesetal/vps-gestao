'use client'
// app/dashboard/pedidos/[id]/qr/page.tsx
// Criador de QR do pedido: etiqueta pequena e imprimível com QR (e opcional Code128)
// do NÚMERO do pedido, para a usuária colar e ler de forma confiável depois.
// Aditivo — NÃO altera a ficha/impressão existente do pedido.
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

function safe(url: string, fb: any) { return fetch(url).then(r => r.ok ? r.json() : fb).catch(() => fb) }

export default function QrPedidoPage() {
  const params = useParams() as { id: string }
  const id = params.id
  const [numero, setNumero] = useState('')
  const [destinatario, setDestinatario] = useState('')
  const [tipoCodigo, setTipoCodigo] = useState('ambos')
  const [qrImg, setQrImg] = useState('')
  const [barrasImg, setBarrasImg] = useState('')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!id || id === 'undefined') return
    const [p, exp] = await Promise.all([
      safe(`/api/producao/pedidos/${id}`, null),
      safe('/api/config/expedicao', { tipoCodigo: 'ambos' }),
    ])
    const pedido = p?.pedido || p
    if (!pedido?.numero) { setErro('Pedido não encontrado'); setLoading(false); return }
    setNumero(pedido.numero); setDestinatario(pedido.destinatario || '')
    setTipoCodigo(exp?.tipoCodigo || 'ambos')
    setLoading(false)
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.body.style.background = 'white'; document.body.style.color = '#111827'
  }, [])

  // Gera os códigos do NÚMERO do pedido
  useEffect(() => {
    if (!numero) return
    let cancel = false
    ;(async () => {
      try {
        if (tipoCodigo === 'qr' || tipoCodigo === 'ambos') {
          const QRCode = (await import('qrcode')).default
          const url = await QRCode.toDataURL(numero, { margin: 1, width: 220 })
          if (!cancel) setQrImg(url)
        }
        if (tipoCodigo === 'barras' || tipoCodigo === 'ambos') {
          const JsBarcode = (await import('jsbarcode')).default
          const c = document.createElement('canvas')
          JsBarcode(c, numero, { format: 'CODE128', width: 2, height: 50, fontSize: 14, margin: 6 })
          if (!cancel) setBarrasImg(c.toDataURL('image/png'))
        }
      } catch { /* silencioso */ }
    })()
    return () => { cancel = true }
  }, [numero, tipoCodigo])

  const pronto = (tipoCodigo === 'qr' ? !!qrImg : tipoCodigo === 'barras' ? !!barrasImg : (!!qrImg && !!barrasImg))
  useEffect(() => {
    if (!loading && numero && pronto) { const t = setTimeout(() => window.print(), 500); return () => clearTimeout(t) }
  }, [loading, numero, pronto])

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#9ca3af' }}>Gerando etiqueta...</p></div>
  if (erro) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: '#ef4444' }}>{erro}</p></div>

  return (
    <>
      <style>{`@media print { .no-print { display:none !important } @page { margin: 8mm } }`}</style>
      <div className="no-print" style={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 8, zIndex: 9 }}>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#f97316', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>🖨️ Imprimir</button>
        <button onClick={() => window.close()} style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Fechar</button>
      </div>

      {/* Etiqueta pequena centralizada */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
        <div style={{
          width: 300, border: '2px dashed #9ca3af', borderRadius: 10, padding: 16,
          textAlign: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif", color: '#111827',
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Pedido</div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', marginBottom: 10, wordBreak: 'break-all' }}>{numero}</div>
          {qrImg && <img src={qrImg} alt="QR do pedido" style={{ width: 180, height: 180, display: 'block', margin: '0 auto' }} />}
          {barrasImg && <img src={barrasImg} alt="Código de barras do pedido" style={{ maxWidth: '100%', marginTop: 10 }} />}
          {destinatario && <div style={{ fontSize: 13, color: '#374151', marginTop: 10, fontWeight: 600 }}>{destinatario}</div>}
        </div>
      </div>
    </>
  )
}
