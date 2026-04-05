// app/api/importacao/pedidos/route.ts
// Processa upload de .xlsx (template VPS ou exportação Shopee) e cria pedidos
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  const s = String(val).trim()
  // DD/MM/AAAA
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return new Date(`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}T12:00:00Z`)
  // AAAA-MM-DD ou ISO
  if (s.includes('T')) return new Date(s)
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(s + 'T12:00:00Z')
  // timestamp numérico Excel (dias desde 1900-01-01)
  const num = parseFloat(s)
  if (!isNaN(num) && num > 40000) {
    const d = new Date((num - 25569) * 86400 * 1000)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function parseValor(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).replace(',', '.').replace(/[^\d.]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function parseQtd(val: any): number {
  const n = parseInt(String(val || '1'))
  return isNaN(n) || n < 1 ? 1 : n
}

function normalizarCanal(val: string | null): string | null {
  if (!val) return null
  const v = val.trim().toLowerCase()
  if (v.includes('shopee'))         return 'Shopee'
  if (v.includes('mercado'))        return 'Mercado Livre'
  if (v.includes('elo'))            return 'Elo7'
  if (v.includes('instagram'))      return 'Instagram'
  if (v.includes('whatsapp'))       return 'WhatsApp'
  if (v.includes('direta'))         return 'Direta'
  return 'Outros'
}

function normalizarPrioridade(val: string | null): string {
  if (!val) return 'NORMAL'
  const v = val.trim().toUpperCase()
  if (['URGENTE','ALTA','NORMAL','BAIXA'].includes(v)) return v
  return 'NORMAL'
}

// Detecta se é exportação da Shopee pelo cabeçalho
function isShopeeFormat(headers: string[]): boolean {
  return headers.some(h => h === 'ID do pedido' || h === 'Nome do destinatário')
}

// Mapeia linha da Shopee para campos VPS
function mapearShopee(row: Record<string, any>): Record<string, any> {
  const nomeProduto   = String(row['Nome do Produto'] || '').trim()
  const nomeVariacao  = String(row['Nome da variação'] || '').trim()
  const produto       = nomeVariacao ? `${nomeProduto} (${nomeVariacao})` : nomeProduto

  return {
    numero:       String(row['ID do pedido'] || '').trim(),
    destinatario: String(row['Nome do destinatário'] || '').trim(),
    idCliente:    String(row['Nome de usuário (comprador)'] || '').trim() || null,
    canal:        'Shopee',
    produto:      produto || null,
    quantidade:   parseQtd(row['Quantidade']),
    valor:        parseValor(row['Preço acordado']),
    dataEnvio:    parseDate(String(row['Data prevista de envio'] || '')),
    dataEntrada:  parseDate(String(row['Data de criação do pedido'] || '')),
    endereco:     String(row['Endereço de entrega'] || '').trim() || null,
    observacoes:  String(row['Observação do comprador'] || '').trim() || null,
    prioridade:   'NORMAL',
  }
}

// Mapeia linha do template VPS
function mapearVPS(row: Record<string, any>): Record<string, any> {
  return {
    numero:       String(row['ID Pedido'] || '').trim(),
    destinatario: String(row['Destinatário'] || row['Nome da Cliente'] || '').trim(),
    idCliente:    String(row['ID User / CPF'] || row['Nome da Cliente'] || '').trim() || null,
    canal:        normalizarCanal(String(row['Canal'] || '')),
    produto:      String(row['Produto'] || '').trim() || null,
    quantidade:   parseQtd(row['Quantidade']),
    valor:        parseValor(row['Valor (R$)']),
    prioridade:   normalizarPrioridade(String(row['Prioridade'] || '')),
    dataEntrada:  parseDate(String(row['Data Entrada'] || '')),
    dataEnvio:    parseDate(String(row['Data Envio'] || '')),
    endereco:     String(row['Endereço'] || '').trim() || null,
    observacoes:  String(row['Observações'] || '').trim() || null,
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  try {
    // Recebe JSON com array de linhas já parseadas pelo frontend
    const { linhas, formato } = await req.json()

    if (!Array.isArray(linhas) || linhas.length === 0)
      return NextResponse.json({ error: 'Nenhuma linha recebida' }, { status: 400 })

    if (linhas.length > 500)
      return NextResponse.json({ error: 'Máximo de 500 pedidos por importação' }, { status: 400 })

    const criados:  any[] = []
    const erros:    any[] = []

    for (let i = 0; i < linhas.length; i++) {
      const row = linhas[i]
      const numLinha = i + 2 // +2 porque linha 1 = cabeçalho

      try {
        const dados = formato === 'shopee' ? mapearShopee(row) : mapearVPS(row)

        // Validações obrigatórias
        if (!dados.numero)       { erros.push({ linha: numLinha, erro: 'ID Pedido vazio' }); continue }
        if (!dados.destinatario) { erros.push({ linha: numLinha, erro: 'Destinatário vazio' }); continue }
        if (!dados.produto)      { erros.push({ linha: numLinha, erro: 'Produto vazio' }); continue }

        const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        const dataEntrada = dados.dataEntrada || new Date()
        const dataEnvio   = dados.dataEnvio   || null
        const valor       = dados.valor       || null
        const prioridade  = dados.prioridade  || 'NORMAL'

        await prisma.$executeRaw`
          INSERT INTO "Order"
            ("id","workspaceId","numero","destinatario","idCliente","canal","produto",
             "quantidade","valor","prioridade","status","dataEntrada","dataEnvio",
             "endereco","observacoes","createdAt","updatedAt")
          VALUES
            (${id}, ${workspaceId}, ${dados.numero}, ${dados.destinatario},
             ${dados.idCliente || null}, ${dados.canal || null}, ${dados.produto},
             ${dados.quantidade}, ${valor}, ${prioridade}, 'ABERTO',
             ${dataEntrada}, ${dataEnvio},
             ${dados.endereco || null}, ${dados.observacoes || null},
             NOW(), NOW())
        `

        criados.push({ linha: numLinha, numero: dados.numero, destinatario: dados.destinatario })
      } catch (err: any) {
        erros.push({ linha: numLinha, erro: err?.message?.includes('unique') ? 'ID de pedido duplicado' : 'Erro ao criar pedido' })
      }
    }

    return NextResponse.json({
      ok:      true,
      criados: criados.length,
      erros:   erros.length,
      detalhes: { criados, erros },
    })
  } catch (err) {
    console.error('[POST /api/importacao/pedidos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
