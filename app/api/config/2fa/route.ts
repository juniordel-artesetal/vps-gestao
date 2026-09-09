// 2FA (TOTP) da usuária logada. Fluxo:
//   GET    → status (ativo?, quantos códigos de recuperação restam)
//   POST   → INICIAR: gera segredo (cifrado no banco, enabled=false) e devolve QR
//   PUT    → ATIVAR: confere o 1º código, liga o 2FA e devolve os backup codes (1x)
//   DELETE → DESATIVAR: exige código TOTP (ou backup) válido e limpa tudo
// Sempre escopado a session.user.id. Segredo NUNCA trafega/vive em texto puro no banco.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { garantirColunas2FA } from '@/lib/doisFatoresSchema'
import {
  gerarSegredo, uriOtpauth, verificarTotp, cifrarSegredo, decifrarSegredo,
  gerarBackupCodes, consumirBackupCode,
} from '@/lib/doisFatores'
import QRCode from 'qrcode'

async function usuarioDaSessao() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return { id: session.user.id as string, email: session.user.email as string }
}

export async function GET() {
  const u = await usuarioDaSessao()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await garantirColunas2FA()
  const rows = await prisma.$queryRaw<{ twoFactorEnabled: boolean | null; twoFactorBackup: string | null }[]>`
    SELECT "twoFactorEnabled", "twoFactorBackup" FROM "User" WHERE "id" = ${u.id} LIMIT 1
  `
  const r = rows[0]
  let restantes = 0
  try { restantes = r?.twoFactorBackup ? (JSON.parse(r.twoFactorBackup) as string[]).length : 0 } catch { restantes = 0 }
  return NextResponse.json({ ativo: !!r?.twoFactorEnabled, backupRestantes: restantes })
}

// INICIAR — gera segredo novo, guarda cifrado (enabled=false) e devolve QR + segredo manual.
export async function POST() {
  const u = await usuarioDaSessao()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await garantirColunas2FA()
  try {
    const segredo = gerarSegredo()
    const uri = uriOtpauth(segredo, u.email || 'conta')
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 })
    await prisma.$executeRaw`
      UPDATE "User" SET "twoFactorSecret" = ${cifrarSegredo(segredo)}, "twoFactorEnabled" = false
      WHERE "id" = ${u.id}
    `
    // Devolve o segredo em base32 para entrada manual (quem não consegue ler o QR).
    return NextResponse.json({ qr, segredo, uri })
  } catch (e) {
    console.error('[POST /api/config/2fa]', e)
    return NextResponse.json({ error: 'Não foi possível iniciar o 2FA.' }, { status: 500 })
  }
}

// ATIVAR — confere o código do app e liga o 2FA; devolve os códigos de recuperação (única vez).
export async function PUT(req: NextRequest) {
  const u = await usuarioDaSessao()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await garantirColunas2FA()
  const { codigo } = await req.json().catch(() => ({ codigo: '' }))
  const rows = await prisma.$queryRaw<{ twoFactorSecret: string | null }[]>`
    SELECT "twoFactorSecret" FROM "User" WHERE "id" = ${u.id} LIMIT 1
  `
  const cifrado = rows[0]?.twoFactorSecret
  if (!cifrado) return NextResponse.json({ error: 'Inicie a configuração do 2FA primeiro.' }, { status: 400 })

  let segredo: string
  try { segredo = decifrarSegredo(cifrado) } catch { return NextResponse.json({ error: 'Configuração inválida, reinicie o 2FA.' }, { status: 400 }) }

  if (!verificarTotp(segredo, String(codigo || ''))) {
    return NextResponse.json({ error: 'Código incorreto. Verifique o app autenticador e tente de novo.' }, { status: 400 })
  }

  const { codigos, hashes } = gerarBackupCodes(10)
  await prisma.$executeRaw`
    UPDATE "User" SET "twoFactorEnabled" = true, "twoFactorBackup" = ${JSON.stringify(hashes)}
    WHERE "id" = ${u.id}
  `
  return NextResponse.json({ ok: true, backupCodes: codigos })
}

// DESATIVAR — exige um código válido (TOTP ou de recuperação) para desligar.
export async function DELETE(req: NextRequest) {
  const u = await usuarioDaSessao()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  await garantirColunas2FA()
  const { codigo } = await req.json().catch(() => ({ codigo: '' }))
  const rows = await prisma.$queryRaw<{ twoFactorSecret: string | null; twoFactorBackup: string | null; twoFactorEnabled: boolean | null }[]>`
    SELECT "twoFactorSecret", "twoFactorBackup", "twoFactorEnabled" FROM "User" WHERE "id" = ${u.id} LIMIT 1
  `
  const r = rows[0]
  if (!r?.twoFactorEnabled) return NextResponse.json({ ok: true }) // já desligado

  let ok = false
  try { if (r.twoFactorSecret) ok = verificarTotp(decifrarSegredo(r.twoFactorSecret), String(codigo || '')) } catch { ok = false }
  if (!ok && r.twoFactorBackup) {
    try { ok = consumirBackupCode(String(codigo || ''), JSON.parse(r.twoFactorBackup)) !== null } catch { ok = false }
  }
  if (!ok) return NextResponse.json({ error: 'Código incorreto. Informe um código do app ou de recuperação.' }, { status: 400 })

  await prisma.$executeRaw`
    UPDATE "User" SET "twoFactorEnabled" = false, "twoFactorSecret" = NULL, "twoFactorBackup" = NULL
    WHERE "id" = ${u.id}
  `
  return NextResponse.json({ ok: true })
}
