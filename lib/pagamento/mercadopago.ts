// Adaptador Mercado Pago — cobrança PIX na conta DA ARTESÃ (token do workspace).
// O token NUNCA vai ao client nem a rota pública; usado só server-side aqui.

const MP_BASE = 'https://api.mercadopago.com'

function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Cria um pagamento PIX no Mercado Pago. Retorna id + copia-e-cola + QR base64.
export async function criarPagamentoPix(token: string, args: { valor: number; descricao: string; email?: string; ref?: string }) {
  const res = await fetch(`${MP_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': args.ref || novoId(),
    },
    body: JSON.stringify({
      transaction_amount: Number(Number(args.valor).toFixed(2)),
      description: String(args.descricao || 'Pedido').slice(0, 200),
      payment_method_id: 'pix',
      payer: { email: args.email || 'comprador@loja.com' },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Mercado Pago: ${data?.message || res.status}`)
  }
  const td = data?.point_of_interaction?.transaction_data || {}
  return {
    id: String(data.id),
    copiaECola: td.qr_code || null,
    qrBase64: td.qr_code_base64 ? `data:image/png;base64,${td.qr_code_base64}` : null,
    status: mapStatus(data.status),
  }
}

// Re-consulta o pagamento no MP pelo id (fonte da verdade — nunca confiar no webhook).
export async function consultarPagamento(token: string, paymentId: string): Promise<{ status: 'pago' | 'pendente' | 'cancelado'; valor: number | null }> {
  const res = await fetch(`${MP_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Mercado Pago consulta: ${data?.message || res.status}`)
  return { status: mapStatus(data.status), valor: data.transaction_amount != null ? Number(data.transaction_amount) : null }
}

function mapStatus(s: string): 'pago' | 'pendente' | 'cancelado' {
  if (s === 'approved') return 'pago'
  if (s === 'cancelled' || s === 'rejected' || s === 'refunded' || s === 'charged_back') return 'cancelado'
  return 'pendente'
}
