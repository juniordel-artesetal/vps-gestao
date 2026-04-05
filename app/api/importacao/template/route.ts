// app/api/importacao/template/route.ts
// Gera template .xlsx dinamicamente com campos do workspace

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Campos universais fixos — sempre presentes em todos os workspaces
const CAMPOS_UNIVERSAIS = [
  { nome: 'ID Pedido',       obrig: true,  largura: 22, exemplo: 'SHP-2604051QXTEP95',                  instrucao: 'Número do pedido na plataforma' },
  { nome: 'Nome da Cliente', obrig: true,  largura: 24, exemplo: 'Maria Silva',                          instrucao: 'Nome de usuário ou nome completo' },
  { nome: 'Destinatário',    obrig: true,  largura: 24, exemplo: 'Maria Silva',                          instrucao: 'Nome para entrega' },
  { nome: 'ID User / CPF',   obrig: false, largura: 18, exemplo: '12345678900',                          instrucao: 'CPF ou ID de usuário da plataforma' },
  { nome: 'Canal',           obrig: true,  largura: 16, exemplo: 'Shopee',                               instrucao: 'Shopee / Mercado Livre / Elo7 / Instagram / WhatsApp / Direta / Outros' },
  { nome: 'Produto',         obrig: true,  largura: 40, exemplo: 'Cofrinho com laço shopee KIT clássico', instrucao: 'Descrição do produto' },
  { nome: 'Quantidade',      obrig: true,  largura: 12, exemplo: '1',                                    instrucao: 'Número inteiro de itens' },
  { nome: 'Valor (R$)',      obrig: false, largura: 14, exemplo: '35,90',                                instrucao: 'Use vírgula como decimal. Ex: 35,90' },
  { nome: 'Prioridade',      obrig: false, largura: 13, exemplo: 'NORMAL',                               instrucao: 'URGENTE / ALTA / NORMAL / BAIXA' },
  { nome: 'Data Entrada',    obrig: false, largura: 16, exemplo: '05/04/2026',                           instrucao: 'Formato DD/MM/AAAA' },
  { nome: 'Data Envio',      obrig: false, largura: 16, exemplo: '15/04/2026',                           instrucao: 'Formato DD/MM/AAAA' },
  { nome: 'Endereço',        obrig: false, largura: 35, exemplo: 'Rua das Flores, 123, São Paulo, SP',   instrucao: 'Endereço de entrega completo' },
  { nome: 'Observações',     obrig: false, largura: 35, exemplo: 'Embalar com papel rosa',               instrucao: 'Observações internas do pedido' },
]

function hexToArgb(hex: string) {
  return 'FF' + hex.replace('#', '').toUpperCase()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId   = session.user.workspaceId
  const workspaceNome = session.user.workspaceNome || 'VPS Gestão'

  // Buscar campos personalizados ativos do workspace
  const camposCustom = await prisma.$queryRaw`
    SELECT nome, tipo, opcoes, placeholder
    FROM "SetorCampo"
    WHERE "workspaceId" = ${workspaceId} AND ativo = true
    ORDER BY ordem ASC
  ` as { nome: string; tipo: string; opcoes: string | null; placeholder: string | null }[]

  // Montar lista completa de colunas
  const todasColunas = [
    ...CAMPOS_UNIVERSAIS,
    ...camposCustom.map(c => ({
      nome:     c.nome,
      obrig:    false,
      largura:  20,
      exemplo:  c.tipo === 'lista' && c.opcoes
        ? JSON.parse(c.opcoes)[0] || ''
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
      isCustom: true,
    })),
  ]

  // ── Criar workbook ─────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  // ── Aba 1: Importar Pedidos ────────────────────────────────────────────
  const wsData: any[][] = []

  // Linha 1: Título
  wsData.push([`🛍️  MODELO DE IMPORTAÇÃO DE PEDIDOS — ${workspaceNome}`])
  // Linha 2: Instrução
  wsData.push(['Preencha a partir da linha 5. Não altere os cabeçalhos. Campos em laranja são obrigatórios. Linha 5 é exemplo.'])
  // Linha 3: vazia
  wsData.push([])
  // Linha 4: Cabeçalhos
  wsData.push(todasColunas.map(c => c.nome))
  // Linha 5: Exemplo
  wsData.push(todasColunas.map(c => c.exemplo))
  // Linhas 6–105: vazias
  for (let i = 0; i < 100; i++) wsData.push(new Array(todasColunas.length).fill(''))

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Larguras das colunas
  ws['!cols'] = todasColunas.map(c => ({ wch: c.largura }))

  // Merge do título (linha 1) e instrução (linha 2)
  const lastCol = todasColunas.length - 1
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ]

  // Freeze no cabeçalho
  ws['!freeze'] = { xSplit: 0, ySplit: 4 }

  XLSX.utils.book_append_sheet(wb, ws, 'Importar Pedidos')

  // ── Aba 2: Referência de campos ────────────────────────────────────────
  const refData: any[][] = [
    ['CAMPO', 'OBRIGATÓRIO', 'INSTRUÇÃO / VALORES ACEITOS', 'TIPO'],
    ...todasColunas.map((c: any) => [
      c.nome,
      c.obrig ? 'Sim' : 'Não',
      c.instrucao,
      c.isCustom ? 'Campo personalizado' : 'Universal',
    ]),
    [],
    ['DICAS', '', '', ''],
    ['Não altere os cabeçalhos (linha 4)', '', '', ''],
    ['A linha 5 é exemplo — pode apagar', '', '', ''],
    ['Máximo de 500 pedidos por importação', '', '', ''],
    ['O sistema importa os válidos e lista os erros', '', '', ''],
    ['Este template foi gerado para: ' + workspaceNome, '', '', ''],
  ]

  const wsRef = XLSX.utils.aoa_to_sheet(refData)
  wsRef['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 55 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsRef, 'Referência de Campos')

  // ── Gerar buffer ───────────────────────────────────────────────────────
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const nomeArq = `modelo_importacao_${workspaceNome.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeArq}"`,
    },
  })
}
