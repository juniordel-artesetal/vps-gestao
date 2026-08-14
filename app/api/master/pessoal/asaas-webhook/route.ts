// Master — registra/lista o webhook do módulo PESSOAL VIA API do Asaas (não painel).
// Roda no servidor de PROD, então usa a chave de produção (credsPessoal → getCredenciais).
// NUNCA mexe no webhook da plataforma: cria/consulta APENAS o do Pessoal (pela URL).
//   GET  → lista os webhooks e mostra o do Pessoal (confirmação do registro).
//   POST → registra o webhook do Pessoal (idempotente: se já existe pela URL, não duplica).
// Segurança: guarda master; authToken do webhook = credsPessoal().webhookToken (não vaza).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { chamarAsaasPessoal, credsPessoal } from '@/lib/pessoal/asaas'
import { baseUrlDeHeaders } from '@/lib/baseUrl'

export const dynamic = 'force-dynamic'

const EVENTOS_PADRAO = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE']
const CAMINHO_WH = '/api/pessoal/asaas/webhook'

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  return (await cookies()).get('master_token')?.value === seg
}

interface WebhookAsaas { id: string; name?: string; url: string; enabled?: boolean; events?: string[] }

async function listar(): Promise<WebhookAsaas[]> {
  const r = await chamarAsaasPessoal<{ data?: WebhookAsaas[] }>('/webhooks')
  return r.ok ? (r.dados?.data ?? []) : []
}
function acharPessoal(list: WebhookAsaas[]): WebhookAsaas | undefined {
  return list.find(w => (w.url || '').includes(CAMINHO_WH))
}
// Mascara a URL só pra devolver algo legível sem expor nada sensível (URL não é segredo, mas evita ruído).
function resumo(w: WebhookAsaas) { return { id: w.id, name: w.name, url: w.url, enabled: w.enabled, events: w.events } }

export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cred = await credsPessoal()
  const list = await listar()
  const pessoal = acharPessoal(list)
  return NextResponse.json({
    ambiente: cred.sandbox ? 'sandbox' : 'producao',
    totalWebhooks: list.length,
    pessoalRegistrado: !!pessoal,
    pessoal: pessoal ? resumo(pessoal) : null,
  })
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const cred = await credsPessoal()
  if (!cred.webhookToken) return NextResponse.json({ error: 'Sem webhook token (defina ASAAS_PESSOAL_WEBHOOK_TOKEN ou o token da plataforma).' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const events: string[] = Array.isArray(body?.events) && body.events.length ? body.events : EVENTOS_PADRAO
  const email: string | undefined = body?.email || process.env.ASAAS_WEBHOOK_EMAIL || undefined
  const base = baseUrlDeHeaders(req.headers)
  const url = `${base}${CAMINHO_WH}`

  // Idempotência: se já existe um webhook do Pessoal (pela URL), não cria outro.
  const jaExiste = acharPessoal(await listar())
  if (jaExiste) return NextResponse.json({ ok: true, jaExistia: true, pessoal: resumo(jaExiste) })

  const r = await chamarAsaasPessoal<WebhookAsaas>('/webhooks', {
    metodo: 'POST',
    corpo: {
      name: 'SOA Pessoal',
      url,
      email,
      enabled: true,
      interrupted: false,
      authToken: cred.webhookToken,
      sendType: 'SEQUENTIALLY',
      events,
    },
  })
  if (!r.ok) return NextResponse.json({ error: r.erro || 'Falha ao registrar webhook.' }, { status: 400 })
  return NextResponse.json({ ok: true, criado: true, pessoal: r.dados ? resumo(r.dados) : null, url, events })
}
