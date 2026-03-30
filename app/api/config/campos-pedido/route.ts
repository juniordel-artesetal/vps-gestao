import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Campos sugeridos para diferentes segmentos
const CAMPOS_SUGERIDOS = [
  { nome: 'Tema',              tipo: 'texto',    placeholder: 'Ex: Safari, Dinossauro...', segmento: 'festas'    },
  { nome: 'Nome da Criança',   tipo: 'texto',    placeholder: 'Ex: Ana 1 aninho',          segmento: 'festas'    },
  { nome: 'Cor do Laço',       tipo: 'lista',    opcoes: ['Rosa','Azul','Branco','Preto','Vermelho','Lilás','Verde','Dourado','Prata','A DEFINIR'], segmento: 'lacos' },
  { nome: 'Tipo de Laço',      tipo: 'lista',    opcoes: ['Laço Simples','Laço Luxo','Aplique 3D','Kit','A DEFINIR'], segmento: 'lacos' },
  { nome: 'Status Arte',       tipo: 'lista',    opcoes: ['Não definido','Arte cliente','Arte padrão','Aguardando aprovação','Aprovado'], segmento: 'geral' },
  { nome: 'Arte do Cliente',   tipo: 'checkbox', placeholder: '',                          segmento: 'geral'     },
  { nome: 'Tipo de Produção',  tipo: 'lista',    opcoes: ['Produção Interna','Produção Externa','Fora de Papel'], segmento: 'geral' },
  { nome: 'Previsão de Entrega Tarefa', tipo: 'data', placeholder: '',                     segmento: 'geral'     },
  { nome: 'Tamanho',           tipo: 'lista',    opcoes: ['PP','P','M','G','GG','Único'],  segmento: 'moda'      },
  { nome: 'Cor',               tipo: 'texto',    placeholder: 'Ex: Azul marinho',          segmento: 'geral'     },
  { nome: 'Material',          tipo: 'texto',    placeholder: 'Ex: Tecido 100% algodão',   segmento: 'geral'     },
  { nome: 'Personagem',        tipo: 'texto',    placeholder: 'Ex: Turma da Mônica',       segmento: 'festas'    },
]

// GET — lista campos do workspace + sugestões
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId

    const campos = await prisma.$queryRaw`
      SELECT * FROM "PedidoCampoConfig"
      WHERE "workspaceId" = ${workspaceId}
      ORDER BY "ordem" ASC, "createdAt" ASC
    ` as any[]

    return NextResponse.json({ campos, sugeridos: CAMPOS_SUGERIDOS })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — cria novo campo
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { nome, tipo, opcoes, placeholder, usarComoFiltro, usarNaMassa } = await req.json()

    if (!nome || !tipo) return NextResponse.json({ error: 'Nome e tipo são obrigatórios' }, { status: 400 })

    const workspaceId = session.user.workspaceId

    const [maxOrdem] = await prisma.$queryRaw`
      SELECT COALESCE(MAX("ordem"), -1) as max FROM "PedidoCampoConfig"
      WHERE "workspaceId" = ${workspaceId}
    ` as any[]

    const id = gerarId()
    const opcoesJson = opcoes ? JSON.stringify(opcoes) : null
    const ordem = Number(maxOrdem.max) + 1

    await prisma.$executeRaw`
      INSERT INTO "PedidoCampoConfig"
        ("id", "workspaceId", "nome", "tipo", "opcoes", "placeholder", "usarComoFiltro", "usarNaMassa", "ordem")
      VALUES
        (${id}, ${workspaceId}, ${nome}, ${tipo}, ${opcoesJson}, ${placeholder ?? null}, ${usarComoFiltro ?? true}, ${usarNaMassa ?? true}, ${ordem})
    `

    const novos = await prisma.$queryRaw`
      SELECT * FROM "PedidoCampoConfig" WHERE "id" = ${id}
    ` as any[]

    return NextResponse.json({ campo: novos[0] })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
