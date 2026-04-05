// app/api/importacao/template/route.ts
// Retorna os campos do workspace como JSON — geração do xlsx é feita no cliente
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CAMPOS_UNIVERSAIS = [
  { nome: 'ID Pedido',       obrig: true,  largura: 22, exemplo: 'SHP-2604051QXTEP95',                   instrucao: 'Número do pedido na plataforma', isCustom: false },
  { nome: 'Nome da Cliente', obrig: true,  largura: 24, exemplo: 'Maria Silva',                           instrucao: 'Nome de usuário ou nome completo', isCustom: false },
  { nome: 'Destinatário',    obrig: true,  largura: 24, exemplo: 'Maria Silva',                           instrucao: 'Nome para entrega', isCustom: false },
  { nome: 'ID User / CPF',   obrig: false, largura: 18, exemplo: '12345678900',                           instrucao: 'CPF ou ID de usuário da plataforma', isCustom: false },
  { nome: 'Canal',           obrig: true,  largura: 16, exemplo: 'Shopee',                                instrucao: 'Shopee / Mercado Livre / Elo7 / Instagram / WhatsApp / Direta / Outros', isCustom: false },
  { nome: 'Produto',         obrig: true,  largura: 40, exemplo: 'Cofrinho com laço shopee KIT clássico', instrucao: 'Descrição do produto', isCustom: false },
  { nome: 'Quantidade',      obrig: true,  largura: 12, exemplo: '1',                                     instrucao: 'Número inteiro de itens', isCustom: false },
  { nome: 'Valor (R$)',      obrig: false, largura: 14, exemplo: '35,90',                                 instrucao: 'Use vírgula como decimal. Ex: 35,90', isCustom: false },
  { nome: 'Prioridade',      obrig: false, largura: 13, exemplo: 'NORMAL',                                instrucao: 'URGENTE / ALTA / NORMAL / BAIXA', isCustom: false },
  { nome: 'Data Entrada',    obrig: false, largura: 16, exemplo: '05/04/2026',                            instrucao: 'Formato DD/MM/AAAA', isCustom: false },
  { nome: 'Data Envio',      obrig: false, largura: 16, exemplo: '15/04/2026',                            instrucao: 'Formato DD/MM/AAAA', isCustom: false },
  { nome: 'Endereço',        obrig: false, largura: 35, exemplo: 'Rua das Flores, 123, São Paulo, SP',    instrucao: 'Endereço de entrega completo', isCustom: false },
  { nome: 'Observações',     obrig: false, largura: 35, exemplo: 'Embalar com papel rosa',                instrucao: 'Observações internas do pedido', isCustom: false },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId   = session.user.workspaceId
  const workspaceNome = session.user.workspaceNome || 'VPS Gestão'

  // Campos personalizados ativos do workspace
  const camposCustom = await prisma.$queryRaw`
    SELECT nome, tipo, opcoes, placeholder
    FROM "SetorCampo"
    WHERE "workspaceId" = ${workspaceId} AND ativo = true
    ORDER BY ordem ASC
  ` as { nome: string; tipo: string; opcoes: string | null; placeholder: string | null }[]

  const camposPersonalizados = camposCustom.map(c => ({
    nome:      c.nome,
    obrig:     false,
    largura:   20,
    exemplo:   c.tipo === 'lista' && c.opcoes
      ? (JSON.parse(c.opcoes)[0] || '')
      : c.tipo === 'data' ? '01/04/2026'
      : c.tipo === 'numero' ? '1'
      : c.tipo === 'checkbox' ? 'Sim'
      : (c.placeholder || ''),
    instrucao: c.tipo === 'lista' && c.opcoes
      ? 'Valores: ' + JSON.parse(c.opcoes).join(' / ')
      : c.tipo === 'data' ? 'Formato DD/MM/AAAA'
      : c.tipo === 'numero' ? 'Número inteiro ou decimal'
      : c.tipo === 'checkbox' ? 'Sim ou Não'
      : 'Campo personalizado do seu ateliê',
    isCustom:  true,
  }))

  return NextResponse.json({
    workspaceNome,
    campos: [...CAMPOS_UNIVERSAIS, ...camposPersonalizados],
  })
}
