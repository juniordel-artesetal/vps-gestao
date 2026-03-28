import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const SETORES_PADRAO: Record<string, string[]> = {
  lacos:            ['Pedido', 'Produção', 'Embalagem', 'Expedição'],
  costura:          ['Modelagem', 'Corte', 'Costura', 'Acabamento', 'Embalagem', 'Expedição'],
  bijuteria:        ['Design', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'],
  sublimacao:       ['Arte', 'Impressão', 'Prensa', 'Acabamento', 'Embalagem', 'Expedição'],
  croche_trico:     ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'],
  mdf_madeira:      ['Design', 'Corte', 'Pintura', 'Acabamento', 'Embalagem', 'Expedição'],
  biscuit:          ['Modelagem', 'Secagem', 'Pintura', 'Verniz', 'Embalagem', 'Expedição'],
  festas:           ['Arte', 'Produção', 'Montagem', 'Embalagem', 'Expedição'],
  papelaria:        ['Arte', 'Impressão', 'Corte', 'Montagem', 'Embalagem', 'Expedição'],
  encadernacao:     ['Arte', 'Impressão', 'Corte e Dobra', 'Furação', 'Costura', 'Capa e Acabamento', 'Embalagem', 'Expedição'],
  velas_cosmeticos: ['Formulação', 'Produção', 'Rotulagem', 'Embalagem', 'Expedição'],
  macrame:          ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'],
  resina:           ['Design', 'Moldagem', 'Cura', 'Acabamento', 'Embalagem', 'Expedição'],
  ceramica:         ['Modelagem', 'Secagem', 'Queima', 'Pintura', 'Embalagem', 'Expedição'],
  bolsas:           ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'],
  personalizado:    [],
}

const CATEGORIAS_PADRAO = [
  { nome: 'Venda Shopee',        tipo: 'RECEITA', cor: '#f97316', icone: '🛍️' },
  { nome: 'Venda Mercado Livre', tipo: 'RECEITA', cor: '#f59e0b', icone: '📦' },
  { nome: 'Venda Elo7',          tipo: 'RECEITA', cor: '#8b5cf6', icone: '🎨' },
  { nome: 'Venda Direta',        tipo: 'RECEITA', cor: '#10b981', icone: '💚' },
  { nome: 'Outras Receitas',     tipo: 'RECEITA', cor: '#06b6d4', icone: '💰' },
  { nome: 'Matéria-Prima',       tipo: 'DESPESA', cor: '#ef4444', icone: '🧵' },
  { nome: 'Embalagem',           tipo: 'DESPESA', cor: '#f97316', icone: '📫' },
  { nome: 'Frete / Envio',       tipo: 'DESPESA', cor: '#f59e0b', icone: '🚚' },
  { nome: 'Marketing',           tipo: 'DESPESA', cor: '#ec4899', icone: '📣' },
  { nome: 'Taxas Plataforma',    tipo: 'DESPESA', cor: '#6366f1', icone: '💳' },
  { nome: 'Pró-labore',          tipo: 'DESPESA', cor: '#14b8a6', icone: '👤' },
  { nome: 'Outras Despesas',     tipo: 'DESPESA', cor: '#64748b', icone: '📋' },
]

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { segmento, setores: setoresCustom } = await req.json()
    const workspaceId = session.user.workspaceId

    if (!segmento) {
      return NextResponse.json({ error: 'Segmento não informado' }, { status: 400 })
    }

    // Usa setores customizados ou padrão do segmento
    const setores = setoresCustom?.length > 0
      ? setoresCustom
      : (SETORES_PADRAO[segmento] || [])

    // Salva segmento no workspace
    await prisma.$executeRaw`
      UPDATE "Workspace"
      SET "segmento" = ${segmento}, "updatedAt" = NOW()
      WHERE "id" = ${workspaceId}
    `

    // Cria setores
    for (let i = 0; i < setores.length; i++) {
      const setorId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "SetorConfig" ("id", "workspaceId", "nome", "ordem", "ativo")
        VALUES (${setorId}, ${workspaceId}, ${setores[i]}, ${i}, true)
      `
    }

    // Cria categorias financeiras padrão
    for (const cat of CATEGORIAS_PADRAO) {
      const catId = gerarId()
      await prisma.$executeRaw`
        INSERT INTO "FinCategoria" ("id", "workspaceId", "nome", "tipo", "cor", "icone")
        VALUES (${catId}, ${workspaceId}, ${cat.nome}, ${cat.tipo}, ${cat.cor}, ${cat.icone})
      `
    }

    // Cria config tributária padrão
    const tribId = gerarId()
    await prisma.$executeRaw`
      INSERT INTO "PrecConfigTributaria"
        ("id", "workspaceId", "regime", "aliquotaPadrao", "observacoes")
      VALUES
        (${tribId}, ${workspaceId}, 'SIMPLES', 6, 'Simples Nacional — alíquota padrão 6%')
      ON CONFLICT ("workspaceId") DO NOTHING
    `

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('Erro onboarding:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}