import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

async function verificarMaster() {
  const cookieStore = await cookies()
  return cookieStore.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

function toCSV(rows: any[], colunas: string[]): string {
  const header = colunas.join(';')
  const lines  = rows.map(row =>
    colunas.map(col => {
      const val = row[col] ?? ''
      const str = String(val).replace(/"/g, '""')
      return str.includes(';') || str.includes('"') || str.includes('\n') ? `"${str}"` : str
    }).join(';')
  )
  return '\uFEFF' + [header, ...lines].join('\n') // BOM para Excel abrir corretamente
}

export async function GET(req: NextRequest) {
  if (!await verificarMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tipo = new URL(req.url).searchParams.get('tipo') ?? 'workspaces'
  let csv = ''
  let filename = ''

  if (tipo === 'workspaces') {
    const rows = await prisma.$queryRaw`
      SELECT
        w.id, w.nome, w.slug, w.plano,
        CASE WHEN w.ativo THEN 'Ativo' ELSE 'Bloqueado' END AS status,
        COUNT(DISTINCT u.id)::int AS total_usuarios,
        w."createdAt"
      FROM "Workspace" w
      LEFT JOIN "User" u ON u."workspaceId" = w.id
      GROUP BY w.id, w.nome, w.slug, w.plano, w.ativo, w."createdAt"
      ORDER BY w."createdAt" DESC
    ` as any[]
    csv      = toCSV(rows, ['id', 'nome', 'slug', 'plano', 'status', 'total_usuarios', 'createdAt'])
    filename = 'workspaces.csv'
  }

  else if (tipo === 'usuarios') {
    const rows = await prisma.$queryRaw`
      SELECT
        u.id, u.nome, u.email, u.role,
        CASE WHEN u.ativo THEN 'Ativo' ELSE 'Inativo' END AS status,
        w.nome AS workspace,
        u."createdAt"
      FROM "User" u
      JOIN "Workspace" w ON w.id = u."workspaceId"
      ORDER BY u."createdAt" DESC
    ` as any[]
    csv      = toCSV(rows, ['id', 'nome', 'email', 'role', 'status', 'workspace', 'createdAt'])
    filename = 'usuarios.csv'
  }

  else if (tipo === 'chamados') {
    const rows = await prisma.$queryRaw`
      SELECT
        sc.protocolo, sc."usuarioNome", sc.email,
        w.nome AS workspace,
        sc.descricao, sc.status,
        CASE WHEN sc."emailEnviado" THEN 'Sim' ELSE 'Não' END AS email_enviado,
        sc."createdAt", sc."respondidoEm"
      FROM "SuporteChamado" sc
      LEFT JOIN "Workspace" w ON w.id = sc."workspaceId"
      ORDER BY sc."createdAt" DESC
    ` as any[]
    csv      = toCSV(rows, ['protocolo', 'usuarioNome', 'email', 'workspace', 'descricao', 'status', 'email_enviado', 'createdAt', 'respondidoEm'])
    filename = 'chamados.csv'
  }

  else if (tipo === 'hotmart') {
    const rows = await prisma.$queryRaw`
      SELECT
        id, evento, email, "workspaceId",
        CASE WHEN processado THEN 'Sim' ELSE 'Não' END AS processado,
        erro, "createdAt"
      FROM "HotmartEvent"
      ORDER BY "createdAt" DESC
    ` as any[]
    csv      = toCSV(rows, ['id', 'evento', 'email', 'workspaceId', 'processado', 'erro', 'createdAt'])
    filename = 'hotmart_eventos.csv'
  }

  else {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
