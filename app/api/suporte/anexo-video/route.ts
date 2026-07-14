// Upload de vídeo do chat de suporte → Google Drive do dono (plataforma).
// Vale pros DOIS lados: assinante (sessão) e atendente (master_token).
// ★LGPD: assinante só anexa em ticket do PRÓPRIO workspace; vídeo vai pro Drive do dono, link restrito por id imprevisível.
// Valida tipo (vídeo) e tamanho (~10MB) ANTES de subir. Gated: se o Drive não está conectado, 503.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadVideo, statusConexao, TIPOS_VIDEO, LIMITE_BYTES } from '@/lib/googledrive'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// GET — o front pergunta se o anexo de vídeo está habilitado (Drive conectado).
export async function GET() {
  const s = await statusConexao()
  return NextResponse.json({ habilitado: s.configurado && s.conectado })
}

export async function POST(req: NextRequest) {
  const master = await ehMaster()
  const session = master ? null : await getServerSession(authOptions)
  if (!master && !session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const status = await statusConexao()
  if (!status.configurado || !status.conectado)
    return NextResponse.json({ error: 'O envio de vídeos ainda não está disponível (Google Drive não conectado).' }, { status: 503 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Envio inválido.' }, { status: 400 }) }

  const file = form.get('file') as File | null
  const referenciaId = String(form.get('referenciaId') || '')
  const tipo = String(form.get('tipo') || '')
  const texto = String(form.get('texto') || '').trim()
  if (!file || !referenciaId || (tipo !== 'CHAMADO' && tipo !== 'FEEDBACK'))
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })

  // Validação de tipo e tamanho ANTES do upload
  const mime = file.type || 'application/octet-stream'
  if (!TIPOS_VIDEO.includes(mime))
    return NextResponse.json({ error: 'Formato não suportado. Envie um vídeo (MP4, WebM ou MOV).' }, { status: 415 })
  if (file.size > LIMITE_BYTES)
    return NextResponse.json({ error: `Vídeo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: ${(LIMITE_BYTES / 1024 / 1024).toFixed(0)}MB.` }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })

  // ★LGPD: confirma que o ticket existe e — se for assinante — que é do próprio workspace.
  const [dono] = await prisma.$queryRaw`
    SELECT "workspaceId" FROM "SuporteChamado"  WHERE "id" = ${referenciaId}
    UNION ALL SELECT "workspaceId" FROM "SuporteFeedback" WHERE "id" = ${referenciaId}
    LIMIT 1
  ` as any[]
  if (!dono) return NextResponse.json({ error: 'Ticket não encontrado.' }, { status: 404 })
  if (!master && dono.workspaceId !== session!.user.workspaceId)
    return NextResponse.json({ error: 'Sem acesso a este ticket.' }, { status: 403 })

  // Upload pro Drive
  let up: { fileId: string; url: string }
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4'
    const nome = `${tipo}_${referenciaId}_${Date.now()}.${ext}`
    up = await uploadVideo(buffer, nome, mime)
  } catch (e: any) {
    console.error('[anexo-video] upload:', e?.message)
    if (e?.message === 'DRIVE_DESCONECTADO')
      return NextResponse.json({ error: 'Google Drive desconectado. Avise o suporte.' }, { status: 503 })
    return NextResponse.json({ error: 'Falha ao enviar o vídeo. Tente novamente.' }, { status: 502 })
  }

  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  const remetente = master ? 'SUPORTE' : 'USUARIO'
  const textoFinal = texto || '🎬 Vídeo anexado'
  await prisma.$executeRaw`
    INSERT INTO "SuporteMensagem" ("id","tipo","referenciaId","remetente","texto","videoUrl","videoFileId","createdAt")
    VALUES (${id}, ${tipo}, ${referenciaId}, ${remetente}, ${textoFinal}, ${up.url}, ${up.fileId}, NOW())
  `

  // Reabrir/atualizar status como nas mensagens de texto
  if (!master) {
    if (tipo === 'CHAMADO') await prisma.$executeRaw`UPDATE "SuporteChamado" SET "status" = 'ABERTO' WHERE id = ${referenciaId} AND "status" = 'RESOLVIDO'`
    else await prisma.$executeRaw`UPDATE "SuporteFeedback" SET "status" = 'ABERTO' WHERE id = ${referenciaId} AND "status" = 'CONCLUIDO'`
  } else {
    if (tipo === 'CHAMADO') await prisma.$executeRaw`UPDATE "SuporteChamado" SET "status" = 'EM_ATENDIMENTO' WHERE id = ${referenciaId} AND "status" = 'ABERTO'`
    else await prisma.$executeRaw`UPDATE "SuporteFeedback" SET "status" = 'EM_ANALISE' WHERE id = ${referenciaId} AND "status" = 'ABERTO'`
  }

  return NextResponse.json({ ok: true, id, videoUrl: up.url })
}
