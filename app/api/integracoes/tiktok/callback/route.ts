// Callback do OAuth do TikTok Shop — a rota que hoje dá 404.
// O TikTok redireciona para cá com ?app_key&code&locale&shop_region (e &state quando
// a artesã começou pelo nosso botão "Conectar"). O workspaceId vem do STATE assinado,
// NUNCA da sessão (o navegador que volta pode não ter sessão). Sem state válido não
// conectamos às cegas: pedimos para recomeçar pelo botão do SOA (segurança).
import { NextRequest, NextResponse } from 'next/server'
import { validarState, conectarComCode } from '@/lib/tiktok/conta'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const destino = (q: string) => NextResponse.redirect(new URL(`/integracoes?tiktok=${q}`, url.origin))

  if (url.searchParams.get('error')) return destino('recusado')

  const code = url.searchParams.get('code')
  const workspaceId = validarState(url.searchParams.get('state'))
  // Sem state válido (ex.: fluxo iniciado fora do SOA ou link expirado): não conecta
  // às cegas — orienta a começar pelo botão "Conectar" do SOA.
  if (!workspaceId) return destino('state')
  if (!code) return destino('erro')

  const r = await conectarComCode(workspaceId, code)
  return destino(r.ok ? 'ok' : 'erro')
}
