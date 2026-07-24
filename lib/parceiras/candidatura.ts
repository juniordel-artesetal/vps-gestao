// Auto-cadastro + aprovação de parceira.
//
// Fluxo: candidata se cadastra (dados + walletId + código desejado) → nasce
// Parceiro(status='pendente', ativo=false). Só vira parceira ativa quando o Master
// aprova (status='aprovada', ativo=true) — e aí recebe o e-mail com o link do painel.
//
// walletId: validado só de FORMATO no cadastro; a verificação REAL acontece no 1º
// split (se a wallet for inválida, o accrual nasce 'pendente' com a causa — nada some).
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { enviarEmailParceira, emailAprovacao, emailRecusa } from '@/lib/parceiras/emails'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Código do link/cupom: 3–20 alfanuméricos, normalizado em MAIÚSCULO. */
export function normalizarCodigo(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}
export function codigoValido(codigo: string): boolean {
  return /^[A-Z0-9]{3,20}$/.test(codigo)
}

/** walletId do Asaas é um UUID v4. Só formato — a verdade é o 1º split. */
export function walletIdFormatoOk(w: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(w || '').trim())
}

/** Código livre? Confere contra cupom E linkSlug (são o mesmo código). */
export async function codigoDisponivel(codigo: string, excetoId?: string): Promise<boolean> {
  const [row] = await prisma.$queryRaw`
    SELECT "id" FROM "Parceiro"
    WHERE (lower("cupom") = lower(${codigo}) OR lower("linkSlug") = lower(${codigo}))
      AND (${excetoId ?? null}::text IS NULL OR "id" <> ${excetoId ?? null})
    LIMIT 1
  ` as { id: string }[]
  return !row
}

export interface ResultadoCandidatura { ok: boolean; erro?: string; campo?: string; parceiroId?: string }

/**
 * Candidatura LEVE (só contato). Nasce Parceiro(status='pendente') sem senha, sem
 * código, sem walletId — ela completa isso depois, já dentro da área dela (sessão
 * de onboarding). Retorna o parceiroId para o route emitir essa sessão.
 */
export async function criarCandidatura(p: {
  nome: string; whatsapp: string; email: string; instagram: string
}): Promise<ResultadoCandidatura> {
  const nome = String(p.nome || '').trim()
  const whatsapp = String(p.whatsapp || '').trim()
  const email = String(p.email || '').trim().toLowerCase()
  const instagram = String(p.instagram || '').trim().replace(/^@+/, '')

  if (!nome || !whatsapp || !email || !instagram) return { ok: false, erro: 'Preencha nome, WhatsApp, e-mail e Instagram.' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.', campo: 'email' }
  if (whatsapp.replace(/\D/g, '').length < 10) return { ok: false, erro: 'WhatsApp inválido — inclua o DDD.', campo: 'whatsapp' }

  const [jaParc] = await prisma.$queryRaw`SELECT "id" FROM "Parceiro" WHERE lower("email") = ${email} LIMIT 1` as { id: string }[]
  if (jaParc) return { ok: false, erro: 'Já existe uma candidatura com este e-mail.', campo: 'email' }

  const id = gerarId()
  await prisma.$executeRaw`
    INSERT INTO "Parceiro" ("id","tipo","nome","email","whatsapp","instagram","ativo","status",
                            "comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","createdAt")
    VALUES (${id}, 'influencer', ${nome}, ${email}, ${whatsapp}, ${instagram}, false, 'pendente',
            30, 40, true, NOW())
  `
  console.log(`[PARCEIRA] candidatura leve criada email=${email} id=${id}`)
  return { ok: true, parceiroId: id }
}

/** Onboarding — define a SENHA (bcrypt). Só na própria parceira (id da sessão). */
export async function definirSenhaParceira(id: string, senha: string): Promise<ResultadoCandidatura> {
  if (String(senha || '').length < 6) return { ok: false, erro: 'A senha precisa de ao menos 6 caracteres.', campo: 'senha' }
  const senhaCripto = await bcrypt.hash(String(senha), 10)
  await prisma.$executeRaw`UPDATE "Parceiro" SET "senhaCripto" = ${senhaCripto} WHERE "id" = ${id}`
  return { ok: true }
}

/** Onboarding — define o CÓDIGO (cupom = linkSlug), validando unicidade. */
export async function definirCodigoParceira(id: string, codigoRaw: string): Promise<ResultadoCandidatura> {
  const codigo = normalizarCodigo(codigoRaw)
  if (!codigoValido(codigo)) return { ok: false, erro: 'Código: 3 a 20 letras/números.', campo: 'codigo' }
  if (!(await codigoDisponivel(codigo, id))) return { ok: false, erro: 'Este código já está em uso — escolha outro.', campo: 'codigo' }
  await prisma.$executeRaw`UPDATE "Parceiro" SET "cupom" = ${codigo}, "linkSlug" = ${codigo} WHERE "id" = ${id}`
  return { ok: true }
}

/** Aprova (Master pode ajustar o código). Idempotente-ish: só age em pendente. */
export async function aprovarParceira(id: string, opts: { codigo?: string; aprovadoPor: string }): Promise<ResultadoCandidatura> {
  const [p] = await prisma.$queryRaw`SELECT "id","nome","email","status","cupom","linkSlug","senhaCripto" FROM "Parceiro" WHERE "id" = ${id} LIMIT 1` as { id: string; nome: string; email: string | null; status: string; cupom: string | null; linkSlug: string | null; senhaCripto: string | null }[]
  if (!p) return { ok: false, erro: 'Parceira não encontrada.' }

  // Só aprova quem já completou o cadastro: sem senha/código o e-mail de
  // boas-vindas sairia sem link e ela não conseguiria logar.
  if (!p.senhaCripto || !(opts.codigo || p.cupom)) {
    return { ok: false, erro: 'A parceira ainda não completou o cadastro (senha + código).' }
  }

  let codigo = p.cupom
  if (opts.codigo) {
    codigo = normalizarCodigo(opts.codigo)
    if (!codigoValido(codigo)) return { ok: false, erro: 'Código ajustado inválido.', campo: 'codigo' }
    if (!(await codigoDisponivel(codigo, id))) return { ok: false, erro: 'Código ajustado já está em uso.', campo: 'codigo' }
  }

  await prisma.$executeRaw`
    UPDATE "Parceiro" SET "status" = 'aprovada', "ativo" = true, "cupom" = ${codigo}, "linkSlug" = ${codigo},
                          "aprovadoEm" = NOW(), "aprovadoPor" = ${opts.aprovadoPor}
    WHERE "id" = ${id} AND "status" <> 'aprovada'
  `
  if (p.email) { const e = emailAprovacao(p.nome, codigo || ''); await enviarEmailParceira(p.email, e.assunto, e.corpo) }
  console.log(`[PARCEIRA] aprovada id=${id} codigo=${codigo} por=${opts.aprovadoPor}`)
  return { ok: true }
}

export async function recusarParceira(id: string, aprovadoPor: string): Promise<ResultadoCandidatura> {
  const [p] = await prisma.$queryRaw`SELECT "nome","email" FROM "Parceiro" WHERE "id" = ${id} LIMIT 1` as { nome: string | null; email: string | null }[]
  await prisma.$executeRaw`
    UPDATE "Parceiro" SET "status" = 'recusada', "ativo" = false, "aprovadoEm" = NOW(), "aprovadoPor" = ${aprovadoPor}
    WHERE "id" = ${id}
  `
  if (p?.email) { const e = emailRecusa(p.nome); await enviarEmailParceira(p.email, e.assunto, e.corpo) }
  console.log(`[PARCEIRA] recusada id=${id} por=${aprovadoPor}`)
  return { ok: true }
}

