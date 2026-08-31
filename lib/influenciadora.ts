// Programa de Influenciadoras (frente Parceiras). Link de ENTRADA da própria influenciadora
// (≠ /r/{cupom} que ela divulga). Ela é artesã (workspace) E parceira (Parceiro) ao mesmo
// tempo (dual-identidade por userId). Cortesia = acesso garantido via liberacaoManual (não é
// plano Asaas). Tudo atrás da flag INFLUENCIADORAS_ATIVO (default OFF). RAW only.
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { garantirColuna } from '@/lib/ddlGuard'
import { codigoDisponivel } from '@/lib/parceiras/candidatura'
import { aprovarParceira } from '@/lib/parceiras/candidatura'
import { emailBoasVindasInfluenciadora, emailCarenciaCortesia } from '@/lib/parceiras/emails'
import { enviarEmailParceira } from '@/lib/parceiras/emails'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function influenciadorasAtivo(): boolean {
  return String(process.env.INFLUENCIADORAS_ATIVO || '').toLowerCase() === 'on'
}

// Migração ADITIVA idempotente e segura (garantirColuna checa o catálogo antes de ALTER —
// não repete o thundering-herd de DDL na Workspace). Roda 1x; depois é só leitura barata.
let colunasOk = false
export async function garantirColunasInfluenciadora(): Promise<void> {
  if (colunasOk) return
  await garantirColuna('Workspace', 'selo', 'TEXT')
  await garantirColuna('Workspace', 'origemCadastro', 'TEXT')
  await garantirColuna('Workspace', 'conviteCampanha', 'TEXT')
  await garantirColuna('Workspace', 'cortesiaAtivadaEm', 'TIMESTAMPTZ')
  await garantirColuna('Workspace', 'cortesiaAtivadaPor', 'TEXT')
  await garantirColuna('Workspace', 'cortesiaEncerradaEm', 'TIMESTAMPTZ')
  await garantirColuna('Workspace', 'cortesiaMotivo', 'TEXT')
  colunasOk = true
}

function gerarSlug(nome: string, id: string): string {
  return nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').slice(0, 30) + '-' + id.slice(0, 4)
}

// Cupom a partir do @ do Instagram (é o que ela lembra/divulga). 3–20 alfanum MAIÚSCULO,
// único por (cupom, linkSlug). Colisão → sufixo numérico. Editável depois em /parceira.
async function cupomDoInstagram(instagram: string): Promise<string> {
  let base = String(instagram || '').replace(/^@+/, '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18)
  if (base.length < 3) base = (base + 'SOA').slice(0, 18)
  if (await codigoDisponivel(base)) return base
  for (let i = 2; i < 1000; i++) {
    const cand = (base.slice(0, 16) + i).slice(0, 20)
    if (await codigoDisponivel(cand)) return cand
  }
  return (base.slice(0, 12) + gid().slice(0, 6)).toUpperCase()
}

const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())

export type CadastroInflu = {
  nome: string; email: string; senha: string; whatsapp: string; instagram: string
  nomeNegocio: string; segmento?: string | null; conviteCampanha?: string | null
}

// Cria a conta (workspace + user + parceira pendente), SEM portão de pagamento. Estado inicial:
// TRIAL 14 dias (a régua protege se o Master não ativar a cortesia). Idempotente por e-mail.
export async function cadastrarInfluenciadora(p: CadastroInflu, ehSegmentoValido: (s: any) => boolean): Promise<{ ok: boolean; erro?: string; jaTemConta?: boolean; workspaceId?: string; parceiroId?: string; cupom?: string }> {
  const nome = String(p.nome || '').trim()
  const email = String(p.email || '').trim().toLowerCase()
  const whatsapp = String(p.whatsapp || '').trim()
  const instagram = String(p.instagram || '').trim().replace(/^@+/, '')
  const nomeNegocio = String(p.nomeNegocio || '').trim()
  const segmento = p.segmento && ehSegmentoValido(p.segmento) ? p.segmento : null
  const conviteCampanha = p.conviteCampanha ? String(p.conviteCampanha).slice(0, 60) : null

  if (!nome || nome.length < 2) return { ok: false, erro: 'Informe seu nome.' }
  if (!emailValido(email)) return { ok: false, erro: 'Informe um e-mail válido.' }
  if (String(p.senha || '').length < 6) return { ok: false, erro: 'A senha precisa de ao menos 6 caracteres.' }
  if (whatsapp.replace(/\D/g, '').length < 10) return { ok: false, erro: 'WhatsApp inválido — inclua o DDD.' }
  if (!instagram) return { ok: false, erro: 'Informe seu @ do Instagram.' }
  if (!nomeNegocio) return { ok: false, erro: 'Informe o nome do seu ateliê.' }

  await garantirColunasInfluenciadora()

  // Já tem conta? (não vaza outros dados)
  const [jaUser] = await prisma.$queryRaw`SELECT "id" FROM "User" WHERE lower("email") = ${email} LIMIT 1` as { id: string }[]
  if (jaUser) return { ok: false, jaTemConta: true, erro: 'Você já tem conta no SOA. Entre e clique em "Quero ser parceira".' }
  const [jaParc] = await prisma.$queryRaw`SELECT "id" FROM "Parceiro" WHERE lower("email") = ${email} LIMIT 1` as { id: string }[]
  if (jaParc) return { ok: false, jaTemConta: true, erro: 'Já existe uma parceria com este e-mail. Entre no SOA para continuar.' }

  const wsId = gid(), userId = gid(), themeId = gid(), parceiroId = gid()
  const slug = gerarSlug(nomeNegocio, wsId)
  const hash = await bcrypt.hash(String(p.senha), 10)
  const cupom = await cupomDoInstagram(instagram)

  await prisma.$transaction(async (tx) => {
    // Workspace: TRIAL 14d imediato (sem AGUARDANDO_PAGAMENTO). origem 'asaas' = governado
    // pela régua; se o Master não ativar a cortesia em 14 dias, a régua segue (proteção).
    await tx.$executeRaw`
      INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem","segmento",
                               "trialAte","selo","origemCadastro","conviteCampanha")
      VALUES (${wsId}, ${nomeNegocio}, ${slug}, 'TRIAL', true, 'TRIAL', 'asaas', ${segmento},
              (CURRENT_DATE + 14::int), 'influenciadora', 'influenciadora', ${conviteCampanha})
    `
    await tx.$executeRaw`INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo") VALUES (${userId}, ${wsId}, ${nome}, ${email}, ${hash}, 'ADMIN', true)`
    await tx.$executeRaw`INSERT INTO "WorkspaceTheme" ("id","workspaceId","modo","corPrimaria","presetNome") VALUES (${themeId}, ${wsId}, 'light', '#f97316', 'laranja')`
    // Parceira PENDENTE já com cupom (do @) + senhaCripto (mesma senha, dual-identidade) +
    // userId → o "Ativar influenciadora" chama aprovarParceira SEM modificar a função.
    await tx.$executeRaw`
      INSERT INTO "Parceiro" ("id","tipo","nome","email","whatsapp","instagram","userId","ativo","status",
                              "comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","cupom","linkSlug","senhaCripto","createdAt")
      VALUES (${parceiroId}, 'influencer', ${nome}, ${email}, ${whatsapp}, ${instagram}, ${userId}, false, 'pendente',
              30, 40, true, ${cupom}, ${cupom}, ${hash}, NOW())
    `
  })

  // Telegram (best-effort, fora da transação)
  try {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const texto = [`🌟 <b>Nova influenciadora cadastrada</b>`, ``,
        `👤 ${nome}`, `📸 @${instagram}`, `📧 ${email}`, `📱 ${whatsapp}`,
        conviteCampanha ? `🏷️ campanha: ${conviteCampanha}` : '',
        ``, `➡️ ativar em /master/parceiros`].filter(Boolean).join('\n')
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: texto, parse_mode: 'HTML', disable_web_page_preview: true }),
      })
    }
  } catch (e) { console.error('[INFLU] telegram:', (e as Error)?.message) }

  return { ok: true, workspaceId: wsId, parceiroId, cupom }
}

// "Ativar influenciadora" (Master): liga a cortesia (acesso garantido) E aprova a parceira,
// numa ação só. Idempotente: 2º clique não duplica nem reenvia e-mail.
export async function ativarInfluenciadora(workspaceId: string, por = 'master'): Promise<{ ok: boolean; erro?: string }> {
  await garantirColunasInfluenciadora()
  const [w] = await prisma.$queryRaw`
    SELECT w."id", w."selo", w."cortesiaAtivadaEm", w."liberacaoManual",
           (SELECT "id" FROM "Parceiro" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN') ORDER BY "createdAt" ASC LIMIT 1) AS "parceiroId"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  ` as { id: string; selo: string | null; cortesiaAtivadaEm: Date | null; liberacaoManual: boolean; parceiroId: string | null }[]
  if (!w) return { ok: false, erro: 'Workspace não encontrado.' }
  if (w.selo !== 'influenciadora') return { ok: false, erro: 'Este workspace não é de influenciadora.' }

  // 1) Cortesia (acesso garantido). Guard: só liga se ainda não estava ativa (idempotência).
  const jaAtiva = !!w.cortesiaAtivadaEm && !!w.liberacaoManual
  if (!jaAtiva) {
    await prisma.$executeRaw`
      UPDATE "Workspace" SET "liberacaoManual" = true, "assinaturaStatus" = 'ATIVA',
        "liberacaoMotivo" = 'influenciadora', "liberacaoEm" = NOW(),
        "cortesiaAtivadaEm" = NOW(), "cortesiaAtivadaPor" = ${por}, "cortesiaMotivo" = 'influenciadora',
        "cortesiaEncerradaEm" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${workspaceId}
    `
  }

  // 2) Aprova a parceira (reaproveita a função existente; e-mail próprio da influenciadora).
  if (w.parceiroId) {
    const [pj] = await prisma.$queryRaw`SELECT "status","cupom","nome","email" FROM "Parceiro" WHERE "id" = ${w.parceiroId} LIMIT 1` as { status: string; cupom: string | null; nome: string | null; email: string | null }[]
    if (pj && pj.status !== 'aprovada') {
      // Reaproveita a aprovação existente, mas com enviarEmail=false — a copy da
      // influenciadora é enviada aqui (evita 2 e-mails). Idempotente: só quando não-aprovada.
      const r = await aprovarParceira(w.parceiroId, { aprovadoPor: por, enviarEmail: false })
      if (!r.ok) return { ok: false, erro: r.erro }
      if (pj.email) { const e = emailBoasVindasInfluenciadora(pj.nome || 'Parceira', pj.cupom || ''); try { await enviarEmailParceira(pj.email, e.assunto, e.corpo) } catch {} }
    }
  }
  return { ok: true }
}

// "Encerrar cortesia" (Master): desliga o acesso gratuito e dá 14 dias de carência p/ ela
// assinar normal. A PARCERIA CONTINUA (segue ganhando comissão). E-mail gentil.
export async function encerrarCortesia(workspaceId: string, motivo: string | null, por = 'master'): Promise<{ ok: boolean; erro?: string }> {
  await garantirColunasInfluenciadora()
  const [w] = await prisma.$queryRaw`
    SELECT w."id", w."selo", w."cortesiaAtivadaEm",
           (SELECT "email" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1) AS email,
           (SELECT "nome" FROM "User" WHERE "workspaceId" = w."id" AND "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1) AS "nomeUser"
    FROM "Workspace" w WHERE w."id" = ${workspaceId} LIMIT 1
  ` as { id: string; selo: string | null; cortesiaAtivadaEm: Date | null; email: string | null; nomeUser: string | null }[]
  if (!w) return { ok: false, erro: 'Workspace não encontrado.' }
  if (!w.cortesiaAtivadaEm) return { ok: false, erro: 'Não há cortesia ativa para encerrar.' }

  // Desliga o acesso garantido e joga numa carência de 14 dias (origem asaas → régua normal
  // cuida daqui pra frente). NÃO mexe no Parceiro (parceria continua aprovada).
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "liberacaoManual" = false, "liberacaoMotivo" = NULL,
      "assinaturaStatus" = 'INADIMPLENTE', "assinaturaExpira" = (CURRENT_DATE + 14::int),
      "cortesiaEncerradaEm" = NOW(), "cortesiaMotivo" = ${motivo || 'encerrada pelo Master'}, "updatedAt" = NOW()
    WHERE "id" = ${workspaceId}
  `
  if (w.email) { const e = emailCarenciaCortesia(w.nomeUser || 'Parceira'); try { await enviarEmailParceira(w.email, e.assunto, e.corpo) } catch {} }
  return { ok: true }
}
