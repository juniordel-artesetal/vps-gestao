// app/api/importacao/pedidos/route.ts
// Processa upload de .xlsx (template VPS ou exportação Shopee) e cria pedidos
// Cenário 1: agrupa linhas com mesmo ID na planilha (múltiplos produtos)
// Cenário 2: aceita ações para IDs já existentes no banco (pular | adicionar | substituir)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null
  const s = String(val).trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return new Date(`${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}T12:00:00Z`)
  const shopee = s.match(/^(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}/)
  if (shopee) return new Date(shopee[1] + 'T12:00:00Z')
  if (s.includes('T')) return new Date(s)
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return new Date(s + 'T12:00:00Z')
  const brHora = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{2}:\d{2}/)
  if (brHora) return new Date(`${brHora[3]}-${brHora[2].padStart(2,'0')}-${brHora[1].padStart(2,'0')}T12:00:00Z`)
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
    camposExtras: null,
  }
}

function mapearVPS(row: Record<string, any>): Record<string, any> {
  const UNIVERSAIS = new Set([
    'ID Pedido', 'Nome da Cliente', 'Destinatário', 'ID User / CPF',
    'Canal', 'Produto', 'Quantidade', 'Valor (R$)', 'Prioridade',
    'Data Entrada', 'Data Envio', 'Endereço', 'Observações',
  ])

  const extras: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!UNIVERSAIS.has(k) && v !== '' && v !== null && v !== undefined) {
      extras[k] = String(v)
    }
  }

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
    camposExtras: Object.keys(extras).length > 0 ? extras : null,
  }
}

// Agrupa linhas da planilha com o mesmo numero (cenário 1)
function agruparPorNumero(dadosLinhas: Array<{ linha: number; dados: any }>) {
  const grupos = new Map<string, {
    dados: any
    produtos: Array<{ nome: string; quantidade: number; valorUnitario: number | null }>
    linhas: number[]
  }>()

  for (const item of dadosLinhas) {
    const { linha, dados } = item
    const numero = dados.numero
    if (!numero) continue

    const produtoItem = {
      nome: String(dados.produto || '').trim(),
      quantidade: Number(dados.quantidade) || 1,
      valorUnitario: dados.valor !== null && dados.valor !== undefined ? Number(dados.valor) : null,
    }

    if (grupos.has(numero)) {
      const g = grupos.get(numero)!
      g.produtos.push(produtoItem)
      g.linhas.push(linha)
    } else {
      grupos.set(numero, {
        dados: { ...dados },
        produtos: [produtoItem],
        linhas: [linha],
      })
    }
  }

  return grupos
}

// Monta os campos finais de um grupo agrupado
function consolidarGrupo(grupo: { dados: any; produtos: any[]; linhas: number[] }) {
  const { dados, produtos } = grupo
  if (produtos.length <= 1) {
    // Pedido com 1 produto só — mantém os campos originais
    return dados
  }

  const produtoTexto = produtos
    .map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`)
    .join(' + ')
  const qtdTotal = produtos.reduce((s, p) => s + (Number(p.quantidade) || 1), 0)
  const valorTotal = produtos.reduce((s, p) => {
    const v = p.valorUnitario ? Number(p.valorUnitario) * (Number(p.quantidade) || 1) : 0
    return s + v
  }, 0)

  // Mesclar camposExtras existentes com produtos[]
  const extrasExistentes = dados.camposExtras && typeof dados.camposExtras === 'object'
    ? { ...dados.camposExtras } : {}
  extrasExistentes.produtos = produtos.map(p => ({
    nome: p.nome,
    quantidade: Number(p.quantidade) || 1,
    valorUnitario: p.valorUnitario !== null && p.valorUnitario !== undefined ? Number(p.valorUnitario) : null,
  }))

  return {
    ...dados,
    produto: produtoTexto,
    quantidade: qtdTotal,
    valor: valorTotal > 0 ? valorTotal : dados.valor,
    camposExtras: extrasExistentes,
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  try {
    const { linhas, formato, acoes } = await req.json()

    if (!Array.isArray(linhas) || linhas.length === 0)
      return NextResponse.json({ error: 'Nenhuma linha recebida' }, { status: 400 })

    if (linhas.length > 500)
      return NextResponse.json({ error: 'Máximo de 500 pedidos por importação' }, { status: 400 })

    // acoes: { [numero]: 'pular' | 'adicionar' | 'substituir' }
    const acoesMap: Record<string, string> = acoes && typeof acoes === 'object' ? acoes : {}

    const criados:  any[] = []
    const atualizados: any[] = []
    const erros:    any[] = []

    // 1. Mapear todas as linhas com validação
    const dadosLinhas: Array<{ linha: number; dados: any }> = []
    for (let i = 0; i < linhas.length; i++) {
      const row = linhas[i]
      const numLinha = i + 2 // +2 porque linha 1 = cabeçalho
      try {
        const dados = formato === 'shopee' ? mapearShopee(row) : mapearVPS(row)

        if (!dados.numero)       { erros.push({ linha: numLinha, erro: 'ID Pedido vazio' }); continue }
        if (!dados.destinatario) { erros.push({ linha: numLinha, erro: 'Destinatário vazio' }); continue }
        if (!dados.produto)      { erros.push({ linha: numLinha, erro: 'Produto vazio' }); continue }

        dadosLinhas.push({ linha: numLinha, dados })
      } catch (err: any) {
        erros.push({ linha: numLinha, erro: 'Erro ao processar linha' })
      }
    }

    // 2. Agrupar por numero (cenário 1)
    const grupos = agruparPorNumero(dadosLinhas)

    // 3. Pré-carrega números já existentes para cenário 2
    const numerosGrupos = Array.from(grupos.keys())
    const existentesRows = numerosGrupos.length > 0 ? (await prisma.$queryRaw`
      SELECT "id","numero","produto","quantidade","valor","camposExtras"
      FROM "Order"
      WHERE "workspaceId" = ${workspaceId}
        AND "numero" = ANY(${numerosGrupos}::text[])
    ` as any[]) : []
    const existentesMap = new Map<string, any>()
    for (const e of existentesRows) existentesMap.set(e.numero, e)

    // 4. Processar cada grupo
    for (const [numero, grupo] of grupos) {
      const primeiraLinha = grupo.linhas[0]
      const numLinhas = grupo.linhas.join(', ')

      try {
        const dadosConsolidados = consolidarGrupo(grupo)
        const existente = existentesMap.get(numero)

        // ── Cenário 2: ID já existe no banco ────────────────────────────
        if (existente) {
          const acao = acoesMap[numero] || 'pular'

          if (acao === 'pular') {
            erros.push({
              linha: primeiraLinha,
              erro: `Pedido #${numero} já existe no sistema — ignorado (linha${grupo.linhas.length > 1 ? 's' : ''} ${numLinhas})`,
            })
            continue
          }

          if (acao === 'adicionar') {
            // Mesclar produtos do pedido existente + produtos da planilha
            let produtosExistentes: any[] = []
            let extrasExistentes: any = {}
            try {
              if (existente.camposExtras) {
                extrasExistentes = JSON.parse(String(existente.camposExtras))
                if (Array.isArray(extrasExistentes.produtos)) {
                  produtosExistentes = extrasExistentes.produtos
                }
              }
            } catch {}

            // Se o pedido existente não tinha produtos[] no camposExtras, usa o produto atual como item inicial
            if (produtosExistentes.length === 0) {
              produtosExistentes = [{
                nome: String(existente.produto || ''),
                quantidade: Number(existente.quantidade) || 1,
                valorUnitario: existente.valor
                  ? Number(existente.valor) / (Number(existente.quantidade) || 1)
                  : null,
              }]
            }

            const produtosNovos = grupo.produtos.map(p => ({
              nome: p.nome,
              quantidade: Number(p.quantidade) || 1,
              valorUnitario: p.valorUnitario !== null && p.valorUnitario !== undefined
                ? Number(p.valorUnitario) : null,
            }))
            const todosProdutos = [...produtosExistentes, ...produtosNovos]

            const produtoTexto = todosProdutos
              .map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`)
              .join(' + ')
            const qtdTotal = todosProdutos.reduce((s, p) => s + (Number(p.quantidade) || 1), 0)
            const valorTotal = todosProdutos.reduce((s, p) => {
              const v = p.valorUnitario ? Number(p.valorUnitario) * (Number(p.quantidade) || 1) : 0
              return s + v
            }, 0)

            extrasExistentes.produtos = todosProdutos
            const extrasStr = JSON.stringify(extrasExistentes)

            await prisma.$executeRaw`
              UPDATE "Order"
              SET "produto" = ${produtoTexto},
                  "quantidade" = ${qtdTotal},
                  "valor" = ${valorTotal > 0 ? valorTotal : null},
                  "camposExtras" = ${extrasStr},
                  "updatedAt" = NOW()
              WHERE "id" = ${existente.id} AND "workspaceId" = ${workspaceId}
            `
            atualizados.push({
              linha: primeiraLinha,
              numero,
              destinatario: dadosConsolidados.destinatario,
              acao: 'adicionado',
            })
            continue
          }

          if (acao === 'substituir') {
            // DELETE antigo + INSERT novo
            await prisma.$executeRaw`
              DELETE FROM "Order"
              WHERE "id" = ${existente.id} AND "workspaceId" = ${workspaceId}
            `
            // Cai para o fluxo de INSERT abaixo
          }
        }

        // ── INSERT do pedido novo (ou substituição) ─────────────────────
        const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        const dataEntrada = dadosConsolidados.dataEntrada || new Date()
        const dataEnvio   = dadosConsolidados.dataEnvio   || null
        const valor       = dadosConsolidados.valor       || null
        const prioridade  = dadosConsolidados.prioridade  || 'NORMAL'
        const camposExtrasStr = dadosConsolidados.camposExtras
          ? (typeof dadosConsolidados.camposExtras === 'string'
              ? dadosConsolidados.camposExtras
              : JSON.stringify(dadosConsolidados.camposExtras))
          : null

        await prisma.$executeRaw`
          INSERT INTO "Order"
            ("id","workspaceId","numero","destinatario","idCliente","canal","produto",
             "quantidade","valor","prioridade","status","dataEntrada","dataEnvio",
             "endereco","observacoes","camposExtras","createdAt","updatedAt")
          VALUES
            (${id}, ${workspaceId}, ${dadosConsolidados.numero}, ${dadosConsolidados.destinatario},
             ${dadosConsolidados.idCliente || null}, ${dadosConsolidados.canal || null}, ${dadosConsolidados.produto},
             ${dadosConsolidados.quantidade}, ${valor}, ${prioridade}, 'ABERTO',
             ${dataEntrada}, ${dataEnvio},
             ${dadosConsolidados.endereco || null}, ${dadosConsolidados.observacoes || null},
             ${camposExtrasStr},
             NOW(), NOW())
        `

        criados.push({
          linha: primeiraLinha,
          numero: dadosConsolidados.numero,
          destinatario: dadosConsolidados.destinatario,
          agrupado: grupo.produtos.length > 1 ? grupo.produtos.length : undefined,
        })
      } catch (err: any) {
        const isDuplicate = err?.message?.includes('unique') || err?.message?.includes('duplicate') || err?.message?.includes('23505')
        erros.push({
          linha: primeiraLinha,
          erro: isDuplicate
            ? `Pedido #${numero} já existe no sistema — ignorado`
            : 'Erro ao criar pedido',
        })
      }
    }

    return NextResponse.json({
      ok:      true,
      criados: criados.length,
      atualizados: atualizados.length,
      erros:   erros.length,
      detalhes: { criados, atualizados, erros },
    })
  } catch (err) {
    console.error('[POST /api/importacao/pedidos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
