import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function gerarId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function parseData(val: string): string | null {
  if (!val) return null
  // Tenta formatos: dd/mm/yyyy ou yyyy-mm-dd
  const partes = val.includes('/') ? val.split('/').reverse() : val.split('-')
  if (partes.length === 3) return partes.join('-')
  return null
}

function parseValor(val: string): number | null {
  if (!val) return null
  const num = parseFloat(val.replace(',', '.').replace(/[^0-9.]/g, ''))
  return isNaN(num) ? null : num
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { pedidos } = await req.json()

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return NextResponse.json({ error: 'Nenhum pedido para importar' }, { status: 400 })
    }

    const workspaceId = session.user.workspaceId
    const criados: string[] = []
    const erros: string[] = []

    for (const p of pedidos) {
      try {
        const numero = p.numero || p['numero'] || p['Número'] || p['ID Shopee'] || p['id_shopee']
        const destinatario = p.destinatario || p['Destinatário'] || p['destinatario'] || p['cliente']
        const produto = p.produto || p['Produto'] || p['produto'] || p['item']

        if (!numero || !destinatario || !produto) {
          erros.push(`Linha ignorada — campos obrigatórios ausentes: ${JSON.stringify(p)}`)
          continue
        }

        // Verifica se número já existe
        const existente = await prisma.$queryRaw`
          SELECT id FROM "Order"
          WHERE "numero" = ${String(numero)} AND "workspaceId" = ${workspaceId}
          LIMIT 1
        ` as any[]

        if (existente.length > 0) {
          erros.push(`Pedido ${numero} já existe — ignorado`)
          continue
        }

        const id = gerarId()
        const canal = p.canal || p['Canal'] || p['loja'] || null
        const idCliente = p.idCliente || p['ID User'] || p['id_user'] || p['id_cliente'] || null
        const quantidade = parseInt(p.quantidade || p['Quantidade'] || '1') || 1
        const valor = parseValor(p.valor || p['Valor'] || '')
        const dataEntrada = parseData(p.dataEntrada || p['Data Entrada'] || '')
        const dataEnvio = parseData(p.dataEnvio || p['Data Envio'] || p['data_envio'] || '')
        const prioridade = p.prioridade || p['Prioridade'] || 'NORMAL'
        const observacoes = p.observacoes || p['Observações'] || p['obs'] || null

        const prioridadeValida = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE'].includes(prioridade?.toUpperCase())
          ? prioridade.toUpperCase() : 'NORMAL'

        await prisma.$executeRaw`
          INSERT INTO "Order" (
            "id", "workspaceId", "numero", "destinatario", "idCliente",
            "canal", "produto", "quantidade", "valor",
            "dataEntrada", "dataEnvio", "observacoes", "prioridade", "status"
          ) VALUES (
            ${id}, ${workspaceId}, ${String(numero)}, ${String(destinatario)}, ${idCliente},
            ${canal}, ${String(produto)}, ${quantidade}, ${valor},
            ${dataEntrada}, ${dataEnvio}, ${observacoes},
            ${prioridadeValida}, 'ABERTO'
          )
        `
        criados.push(id)
      } catch (err) {
        console.error('Erro ao importar linha:', err)
        erros.push(`Erro ao importar: ${JSON.stringify(p)}`)
      }
    }

    return NextResponse.json({
      ok: true,
      criados: criados.length,
      erros: erros.length,
      detalhes_erros: erros,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
