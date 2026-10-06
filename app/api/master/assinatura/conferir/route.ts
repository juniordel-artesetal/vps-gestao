// Master — CONFERÊNCIA AO VIVO (somente leitura) de contas pagantes: Asaas (assinatura + últimas cobranças
// da subscription e cobranças avulsas/Pix Automático da conta) e Hotmart (assinatura do produto SOA pelo
// e-mail de quem acessa). Não grava NADA: serve para decidir, conta a conta, quem está mesmo em dia.
// Uso: POST { workspaceIds: string[] } (até 15 por chamada). Auth: x-master-token ou cookie master_token.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { assinaturaSoaPorEmail } from '@/lib/hotmart'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

interface Cob { id: string; status: string; value: number; dueDate: string; paymentDate?: string | null; billingType?: string; subscription?: string | null }
const resumo = (x: Cob) => ({ id: x.id, status: x.status, valor: x.value, vencimento: x.dueDate, pagoEm: x.paymentDate ?? null, tipo: x.billingType ?? null })

async function conferir(workspaceId: string) {
  const [w] = await prisma.$queryRaw`
    SELECT "id", "nome", "assinaturaStatus", "assinaturaOrigem", "assinaturaExpira"::date AS expira, "liberacaoManual"
    FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { id: string; nome: string; assinaturaStatus: string; assinaturaOrigem: string | null; expira: Date | null; liberacaoManual: boolean }[]
  if (!w) return { workspaceId, erro: 'workspace não encontrada' }
  const emails = (await prisma.$queryRaw`SELECT DISTINCT lower("email") AS email FROM "User" WHERE "workspaceId" = ${workspaceId} AND "ativo" = true` as { email: string }[]).map(e => e.email)
  const subs = await prisma.$queryRaw`
    SELECT "subscriptionId", "status", "ciclo", "valor"::float AS valor, "proximoVencimento"::date AS prox
    FROM "AsaasAssinatura" WHERE "workspaceId" = ${workspaceId} ORDER BY "createdAt" DESC
  ` as { subscriptionId: string; status: string; ciclo: string; valor: number; prox: Date | null }[]

  // Asaas ao vivo
  const asaas = []
  for (const s of subs.slice(0, 3)) {
    const [info, cobs] = await Promise.all([
      chamarAsaas<{ status?: string; nextDueDate?: string; value?: number; cycle?: string; deleted?: boolean }>(`/subscriptions/${s.subscriptionId}`, { exigirAtivo: false }),
      chamarAsaas<{ data?: Cob[] }>(`/payments?subscription=${encodeURIComponent(s.subscriptionId)}&limit=4`, { exigirAtivo: false }),
    ])
    asaas.push({
      subscriptionId: s.subscriptionId, noSoa: { status: s.status, ciclo: s.ciclo, valor: s.valor, proximo: s.prox },
      aoVivo: info.ok ? { status: info.dados?.status ?? null, proximo: info.dados?.nextDueDate ?? null, valor: info.dados?.value ?? null, ciclo: info.dados?.cycle ?? null, excluida: !!info.dados?.deleted } : { erro: info.erro },
      ultimasCobrancas: cobs.ok ? (cobs.dados?.data ?? []).map(resumo) : { erro: cobs.erro },
    })
  }
  // cobranças avulsas da conta (Pix Automático e Pix da regularização usam externalReference = workspaceId)
  const avulsas = await chamarAsaas<{ data?: Cob[] }>(`/payments?externalReference=${encodeURIComponent(workspaceId)}&limit=4`, { exigirAtivo: false })
  const pixAuto = await prisma.$queryRaw`
    SELECT "status", "criadoEm"::date AS desde FROM "AsaasPixAutoAutorizacao" WHERE "workspaceId" = ${workspaceId} ORDER BY "criadoEm" DESC LIMIT 1
  `.catch(() => []) as { status: string; desde: Date }[]

  // Hotmart ao vivo (produto SOA), por e-mail de acesso
  const hotmart = []
  for (const e of emails.slice(0, 3)) {
    const h = await assinaturaSoaPorEmail(e)
    hotmart.push({ email: e.replace(/^(.).*(@.*)$/, '$1***$2'), status: h.status, ciclo: h.ciclo })
  }
  return {
    workspaceId, nome: w.nome, soa: { status: w.assinaturaStatus, origem: w.assinaturaOrigem, expira: w.expira, cortesia: w.liberacaoManual },
    asaas, avulsas: avulsas.ok ? (avulsas.dados?.data ?? []).map(resumo) : { erro: avulsas.erro },
    pixAutomatico: pixAuto[0] ?? null, hotmart,
  }
}

export async function POST(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const ids = (Array.isArray(b?.workspaceIds) ? b.workspaceIds : []).map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 15)
  if (!ids.length) return NextResponse.json({ error: 'Informe workspaceIds (até 15)' }, { status: 400 })
  const contas = []
  for (const id of ids) {
    try { contas.push(await conferir(id)) }
    catch (e) { contas.push({ workspaceId: id, erro: String((e as Error)?.message || e).slice(0, 200) }) }
  }
  return NextResponse.json(serialize({ contas }))
}
