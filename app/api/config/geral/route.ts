import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const rows = await prisma.$queryRaw`
    SELECT
      nome, "corPrimaria", logo,
      "nomeProprietaria", instagram, whatsapp, "emailContato",
      telegram, "linkLoja", cidade, estado, cnpj,
      "comoConheceu", "qtdColaboradoras", "aceitaMarketing",
      "profileCompleto", segmento,
      "moduloEstoque", "moduloDemandas", "moduloClientes", "moduloLoja", "moduloTarefas",
      "moduloAssistenteCompras",
      -- Flag opcional (pode não existir como coluna): leitura tolerante via to_jsonb (NULL se ausente).
      (to_jsonb(w) ->> 'moduloCreditos')::boolean AS "moduloCreditos",
      "politicasOrcamento"
    FROM "Workspace" w
    WHERE id = ${session.user.workspaceId}
    LIMIT 1
  ` as any[]

  return NextResponse.json(rows[0] ?? {})
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const {
    nome, corPrimaria, logo,
    nomeProprietaria, instagram, whatsapp, emailContato,
    telegram, linkLoja, cidade, estado, cnpj,
    comoConheceu, qtdColaboradoras, aceitaMarketing,
    segmento, moduloEstoque, moduloDemandas, moduloClientes, moduloLoja, moduloTarefas,
    moduloAssistenteCompras,
    politicasOrcamento,
  } = await req.json()

  const workspaceId = session.user.workspaceId

  const profileCompleto = !!(nome && nomeProprietaria && instagram && whatsapp && emailContato)

  await prisma.$executeRaw`
    UPDATE "Workspace" SET
      "nome"               = COALESCE(${nome ?? null}, "nome"),
      "corPrimaria"        = COALESCE(${corPrimaria ?? null}, "corPrimaria"),
      "logo"               = COALESCE(${logo ?? null}, "logo"),
      "nomeProprietaria"   = ${nomeProprietaria ?? null},
      "instagram"          = ${instagram ?? null},
      "whatsapp"           = ${whatsapp ?? null},
      "emailContato"       = ${emailContato ?? null},
      "telegram"           = ${telegram ?? null},
      "linkLoja"           = ${linkLoja ?? null},
      "cidade"             = ${cidade ?? null},
      "estado"             = ${estado ?? null},
      "cnpj"               = ${cnpj ?? null},
      "comoConheceu"       = ${comoConheceu ?? null},
      "qtdColaboradoras"   = ${qtdColaboradoras ?? 1},
      "aceitaMarketing"    = ${aceitaMarketing ?? true},
      "profileCompleto"    = ${profileCompleto},
      "segmento"           = ${segmento ?? null},
      "moduloEstoque"      = ${moduloEstoque ?? false},
      "moduloDemandas"     = ${moduloDemandas ?? false},
      "moduloClientes"     = ${moduloClientes ?? false},
      "moduloLoja"         = ${moduloLoja ?? false},
      "moduloTarefas"      = ${moduloTarefas ?? false},
      "moduloAssistenteCompras" = ${moduloAssistenteCompras ?? false},
      "politicasOrcamento" = ${politicasOrcamento ?? null}
    WHERE "id" = ${workspaceId}
  `

  return NextResponse.json({ ok: true, profileCompleto })
}
