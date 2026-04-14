import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Endpoint de diagnóstico — apenas master
// GET /api/master/debug-usuario?email=xxx&senha=yyy
export async function GET(req: NextRequest) {
  const masterToken = req.headers.get('x-master-token')
  if (masterToken !== process.env.MASTER_SECRET_TOKEN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.toLowerCase().trim()
  const senhaTestada = searchParams.get('senha') ?? ''

  if (!email) return NextResponse.json({ error: 'Informe o email' }, { status: 400 })

  // Buscar usuário
  const usuarios = await prisma.$queryRaw`
    SELECT
      u."id",
      u."nome",
      u."email",
      u."senha",
      u."role",
      u."ativo",
      u."primeiroLogin",
      u."workspaceId",
      w."nome"      AS "workspaceNome",
      w."ativo"     AS "workspaceAtivo",
      w."plano"
    FROM "User" u
    LEFT JOIN "Workspace" w ON w."id" = u."workspaceId"
    WHERE LOWER(u."email") = ${email}
    LIMIT 1
  ` as any[]

  if (usuarios.length === 0) {
    return NextResponse.json({ encontrado: false, email })
  }

  const u = usuarios[0]
  const senhaHash = u.senha

  // Testar senha informada contra o hash
  let senhaCorreta = false
  let erroHash = null
  try {
    if (senhaTestada) {
      senhaCorreta = await bcrypt.compare(senhaTestada, senhaHash)
    }
  } catch (e: any) {
    erroHash = e.message
  }

  // Diagnóstico completo
  const diagnostico = {
    encontrado: true,
    usuario: {
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      ativo: u.ativo,
      primeiroLogin: u.primeiroLogin,
    },
    workspace: {
      id: u.workspaceId,
      nome: u.workspaceNome,
      ativo: u.workspaceAtivo,
      plano: u.plano,
    },
    senha: {
      hashSalvo: senhaHash ? `${senhaHash.substring(0, 7)}...` : 'VAZIO',
      hashValido: senhaHash?.startsWith('$2') ?? false,  // bcrypt começa com $2a$ ou $2b$
      senhaTestada: senhaTestada ? `${senhaTestada.substring(0,2)}***` : '(não informada)',
      senhaCorreta,
      erroHash,
    },
    problemasPotenciais: [
      !u.ativo && '❌ Usuário está inativo (ativo=false)',
      !u.workspaceAtivo && '❌ Workspace está inativo (ativo=false)',
      u.primeiroLogin && '⚠️ primeiroLogin ainda é true (vai redirecionar para trocar-senha)',
      !senhaHash?.startsWith('$2') && '❌ Hash inválido — não é bcrypt',
      senhaTestada && !senhaCorreta && '❌ Senha informada NÃO confere com o hash salvo',
      senhaTestada && senhaCorreta && '✅ Senha confere com o hash',
    ].filter(Boolean),
  }

  return NextResponse.json(diagnostico)
}
