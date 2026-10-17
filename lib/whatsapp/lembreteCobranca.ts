// LEMBRETE DE COBRANÇA por WhatsApp (17/10/2026) — recuperação de vendas: quem tem mensalidade EM ABERTO recebe, além
// do e-mail da régua (lib/cobranca/reguaMensal.ts, canal primário), um WhatsApp com o link de pagamento.
//
//  • Quem: o ESPELHO LOCAL (AsaasCobranca) escolhe as candidatas — PENDING/OVERDUE, mensalidade (com assinatura, até o
//    teto), vencida até hoje, de conta ATIVA com WhatsApp no perfil. NÃO varre o Asaas.
//  • Antes de mandar, cada candidata é CONFIRMADA no Asaas (1 GET por cobrança, 1 req/s; 403/429 → para a rodada): o
//    espelho pode estar velho (webhook perdido) e nunca se cobra quem já pagou.
//  • Dona e regras: as MESMAS da régua de e-mail (`identificar`): cortesia, cancelada, plano anual, origem Hotmart… ficam
//    de fora; cobrança antiga de quem está em dia também.
//  • Degraus: D0 (vence hoje), D+1, D+3, D+7 — o maior degrau já alcançado; 1 mensagem por (cobrança, degrau)
//    (tabela WhatsappLembrete, chave única). Falha temporária (serviço fora) libera o degrau para a próxima rodada;
//    falha permanente (número sem WhatsApp, PARAR) fica registrada e não repete.
//  • Só lembrete: nada de cobrança nova, estorno ou mudança de status. Começa com WHATSAPP_ATIVO=off.
//  • Piloto: WHATSAPP_PILOTO = ids de workspace separados por vírgula (vazio = todas). Teto por rodada: WHATSAPP_LIMITE.
import { prisma } from '@/lib/prisma'
import { withRetry } from '@/lib/dbRetry'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { identificar, destinataria, hojeSP, linkFatura, NOME_PRODUTO, TETO_MENSAL, type CobrancaAsaas, type Dona } from '@/lib/cobranca/reguaMensal'
import { enviar, whatsappLigado, mascarar, saiuDoWhatsapp, type ResultadoEnvio } from './index'
import { normalizarTelefone } from './mensagens'

export const DEGRAUS = [0, 1, 3, 7] as const

/** O degrau do dia: o maior já alcançado (D0, D+1, D+3, D+7), ou null antes do vencimento. Puro. */
export function degrauDoDia(diasDeAtraso: number): number | null {
  if (!Number.isFinite(diasDeAtraso) || diasDeAtraso < 0) return null
  let d: number | null = null
  for (const g of DEGRAUS) if (diasDeAtraso >= g) d = g
  return d
}
export const diasDeAtraso = (hoje: string, vencimento: string) =>
  Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(vencimento.slice(0, 10) + 'T12:00:00Z')) / 86_400_000)

export interface Candidata {
  paymentId: string; workspaceId: string; subscriptionId: string | null; referencia: string | null
  vencimento: string; valor: number; billingType: string | null; whatsapp: string | null; nomeProprietaria: string | null
}

export interface Deps {
  candidatas: (hoje: string) => Promise<Candidata[]>
  jaEnviados: (ids: string[]) => Promise<Set<string>>                  // "paymentId|degrau"
  saiu: (telefone: string) => Promise<boolean>
  confirmar: (paymentId: string) => Promise<{ aberta: boolean; parar?: boolean; cobranca?: CobrancaAsaas }>
  dona: (c: CobrancaAsaas, hoje: string) => Promise<Dona | null>
  nome: (d: Dona) => Promise<string | null>
  reservar: (c: Candidata, degrau: number, telefone: string) => Promise<string | null>   // id da linha, ou null (já existe)
  concluir: (id: string, r: ResultadoEnvio) => Promise<void>
  enviar: (template: string, destino: string, dados: Record<string, unknown>) => Promise<ResultadoEnvio>
  esperar: (ms: number) => Promise<void>
}

export interface ResultadoLembrete {
  hoje: string; seco: boolean; desligado?: boolean
  candidatas: number; semTelefone: number; foraDoPiloto: number; jaEnviados: number; optOut: number
  confirmadas: number; pagasOuApagadas: number; naoNossas: number; emDia: number
  enviados: number; falhasTemporarias: number; falhasPermanentes: number; limiteAtingido: boolean; paradoNoAsaas: boolean
  previa: { ws: string; degrau: number; telefone: string; venc: string }[]
}

type Env = Record<string, string | undefined>
const piloto = (env: Env) => new Set((env.WHATSAPP_PILOTO ?? '').split(',').map(s => s.trim()).filter(Boolean))
const limite = (env: Env) => Math.max(1, Math.min(200, Number(env.WHATSAPP_LIMITE) || 30))

/** A rodada do dia. `seco`: só calcula (não chama o Asaas, não reserva, não envia). */
export async function rodarLembreteCobranca(o: { seco?: boolean; agora?: Date; env?: Env; deps?: Partial<Deps> } = {}): Promise<ResultadoLembrete> {
  const env = o.env ?? process.env, seco = !!o.seco
  const d: Deps = { ...depsReais(), ...o.deps }
  const hoje = hojeSP(o.agora)
  const r: ResultadoLembrete = { hoje, seco, candidatas: 0, semTelefone: 0, foraDoPiloto: 0, jaEnviados: 0, optOut: 0, confirmadas: 0, pagasOuApagadas: 0, naoNossas: 0, emDia: 0, enviados: 0, falhasTemporarias: 0, falhasPermanentes: 0, limiteAtingido: false, paradoNoAsaas: false, previa: [] }
  if (!seco && !whatsappLigado(env)) return { ...r, desligado: true }

  const cs = await d.candidatas(hoje)
  r.candidatas = cs.length
  const pil = piloto(env)
  const enviados = await d.jaEnviados(cs.map(c => c.paymentId))
  const fila: { c: Candidata; degrau: number; tel: string }[] = []
  for (const c of cs) {
    const degrau = degrauDoDia(diasDeAtraso(hoje, c.vencimento))
    if (degrau === null) continue
    if (pil.size && !pil.has(c.workspaceId)) { r.foraDoPiloto++; continue }
    const tel = normalizarTelefone(c.whatsapp)
    if (!tel) { r.semTelefone++; continue }
    if (enviados.has(`${c.paymentId}|${degrau}`)) { r.jaEnviados++; continue }
    if (await d.saiu(tel)) { r.optOut++; continue }
    fila.push({ c, degrau, tel })
  }

  const max = limite(env)
  let primeira = true
  for (const { c, degrau, tel } of fila) {
    if (r.enviados >= max) { r.limiteAtingido = true; break }
    // seco: a prévia usa o espelho como está (sem chamar o Asaas)
    let cob: CobrancaAsaas = { id: c.paymentId, status: 'PENDING', value: c.valor, dueDate: c.vencimento.slice(0, 10), billingType: c.billingType ?? undefined, subscription: c.subscriptionId, externalReference: c.referencia }
    if (!seco) {
      if (!primeira) await d.esperar(1100)          // modo devagar: 1 req/s no Asaas
      primeira = false
      const v = await d.confirmar(c.paymentId)
      if (v.parar) { r.paradoNoAsaas = true; break }
      if (!v.aberta || !v.cobranca) { r.pagasOuApagadas++; continue }
      cob = v.cobranca
      r.confirmadas++
    }
    const dona = await d.dona(cob, hoje)
    if (!dona) { r.naoNossas++; continue }
    if (dona.emDia && degrau > 0) { r.emDia++; continue }   // cobrança antiga de quem pagou as seguintes: não é atraso dela
    if (seco) { r.previa.push({ ws: c.workspaceId, degrau, telefone: mascarar(tel), venc: c.vencimento.slice(0, 10) }); continue }
    const id = await d.reservar(c, degrau, tel)
    if (!id) { r.jaEnviados++; continue }
    const nome = (await d.nome(dona)) ?? c.nomeProprietaria
    const res = await d.enviar('lembrete_cobranca', tel, { nome, link: linkFatura(c.paymentId), produto: NOME_PRODUTO[dona.produto], degrau, chave: `${c.paymentId}|${degrau}` })
    await d.concluir(id, res)
    if (res.ok) r.enviados++
    else if (res.permanente) r.falhasPermanentes++
    else r.falhasTemporarias++
  }
  console.log(`[WHATSAPP LEMBRETE] ${hoje}${seco ? ' (seco)' : ''}: ${r.candidatas} candidatas · ${r.enviados} enviados · ${r.falhasTemporarias} falhas temp. · ${r.falhasPermanentes} perm. · ${r.pagasOuApagadas} já pagas${r.paradoNoAsaas ? ' · PAROU (Asaas 403/429)' : ''}`)
  return r
}

// ── dependências reais (banco + Asaas + serviço) ────────────────────────────────────────────────────────────────────
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

function depsReais(): Deps {
  return {
    candidatas: hoje => withRetry(() => prisma.$queryRaw<Candidata[]>`
      SELECT c."paymentId", c."workspaceId", c."subscriptionId", c."referencia", TO_CHAR(c."vencimento",'YYYY-MM-DD') AS "vencimento",
             c."valor"::float AS "valor", c."billingType", w."whatsapp", w."nomeProprietaria"
      FROM "AsaasCobranca" c JOIN "Workspace" w ON w."id" = c."workspaceId"
      WHERE c."status" IN ('PENDING','OVERDUE') AND c."vencimento" <= ${hoje}::date
        AND c."subscriptionId" IS NOT NULL AND c."valor" > 0 AND c."valor" <= ${TETO_MENSAL}
        AND w."ativo" = true AND COALESCE(w."whatsapp",'') <> ''
      ORDER BY c."vencimento" DESC`),
    jaEnviados: async ids => {
      if (!ids.length) return new Set()
      const rows = await prisma.$queryRaw<{ k: string }[]>`
        SELECT "cobrancaId" || '|' || "degrau" AS k FROM "WhatsappLembrete" WHERE "cobrancaId" = ANY(${ids})`.catch(() => [])
      return new Set(rows.map(x => x.k))
    },
    saiu: saiuDoWhatsapp,
    confirmar: async paymentId => {
      const v = await chamarAsaas<CobrancaAsaas & { deleted?: boolean }>(`/payments/${encodeURIComponent(paymentId)}`)
      if (v.status === 403 || v.status === 429) return { aberta: false, parar: true }
      if (!v.ok || !v.dados) return { aberta: false }
      const p = v.dados
      return { aberta: !p.deleted && (p.status === 'PENDING' || p.status === 'OVERDUE'), cobranca: p }
    },
    dona: async (c, hoje) => (await identificar([c], hoje)).get(c.id) ?? null,
    nome: async dona => (await destinataria(dona))?.nome ?? null,
    reservar: async (c, degrau, tel) => {
      const [x] = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO "WhatsappLembrete" ("id","workspaceId","cobrancaId","degrau","canal","status","telefone","createdAt")
        VALUES (${gid()}, ${c.workspaceId}, ${c.paymentId}, ${degrau}, 'whatsapp', 'ENVIANDO', ${tel}, NOW())
        ON CONFLICT ("cobrancaId","degrau","canal") DO NOTHING RETURNING "id"`
      return x?.id ?? null
    },
    concluir: async (id, res) => {
      if (res.ok) await prisma.$executeRaw`UPDATE "WhatsappLembrete" SET "status" = 'ENFILEIRADO', "envioId" = ${res.id ?? null}, "enviadoEm" = NOW() WHERE "id" = ${id}`
      else if (res.permanente) await prisma.$executeRaw`UPDATE "WhatsappLembrete" SET "status" = 'ERRO', "erro" = ${(res.erro ?? '').slice(0, 300)} WHERE "id" = ${id}`
      // temporária (serviço fora, desligado…): libera o degrau para a próxima rodada
      else await prisma.$executeRaw`DELETE FROM "WhatsappLembrete" WHERE "id" = ${id} AND "status" = 'ENVIANDO'`
    },
    enviar: (t, destino, dados) => enviar(t, destino, dados),
    esperar: ms => new Promise(x => setTimeout(x, ms)),
  }
}
