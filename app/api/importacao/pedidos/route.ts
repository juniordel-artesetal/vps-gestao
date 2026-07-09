// app/api/importacao/pedidos/route.ts
// Processa upload de .xlsx (template VPS ou exportação Shopee) e cria pedidos
// Cenário 1: agrupa linhas com mesmo ID na planilha (múltiplos produtos)
// Cenário 2: aceita ações para IDs já existentes no banco (pular | adicionar | substituir)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'
import { indexarVariacoes, derivarPecas, type VariacaoParaMatch } from '@/lib/matchVariacao'
import { ensurePedidoMarketplaceTables } from './_lib/schema'
import { construirFiscalShopee } from './_lib/shopeeFiscal'
import { encryptCpf } from './_lib/crypto'
import { ensureMarketplaceTables } from '@/lib/marketplaceSchema'

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
    // Número serial do Excel (dias desde 1900-01-01)
    // Calcula o dia em UTC e força meio-dia para evitar deslocamento em fusos negativos (BR = UTC-3)
    const utcMs = (num - 25569) * 86400 * 1000
    const tmp = new Date(utcMs)
    if (isNaN(tmp.getTime())) return null
    // Reconstrói com horário 12:00 UTC para garantir o mesmo dia em qualquer timezone
    const year  = tmp.getUTCFullYear()
    const month = String(tmp.getUTCMonth() + 1).padStart(2, '0')
    const day   = String(tmp.getUTCDate()).padStart(2, '0')
    return new Date(`${year}-${month}-${day}T12:00:00Z`)
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

// Extrai quantidade do final do nome — Shopee usa "NomeProduto,10" ou "NomeProduto (Variação,10)"
function extrairQtdDoNome(nome: string, qtdCampo: number): { nome: string; quantidade: number } {
  // Caso 1: "NomeProduto,10" — vírgula+número direto no final
  const match1 = nome.match(/,(\d+)$/)
  if (match1) {
    const qtdNome = parseInt(match1[1])
    if (qtdNome > 0) return { nome: nome.slice(0, -match1[0].length).trim(), quantidade: qtdNome }
  }
  // Caso 2: "NomeProduto (Variação,10)" — número dentro dos parênteses finais
  // ex: "Cofrinho Personalizado (Amarelo_completo,10)" → nome="Cofrinho Personalizado (Amarelo_completo)", qtd=10
  const match2 = nome.match(/\(([^()]*),(\d+)\)$/)
  if (match2) {
    const qtdNome = parseInt(match2[2])
    if (qtdNome > 0) {
      const variacaoLimpa = match2[1].trim()
      const nomeBase = nome.slice(0, nome.lastIndexOf('(')).trim()
      const nomeLimpo = variacaoLimpa ? `${nomeBase} (${variacaoLimpa})` : nomeBase
      return { nome: nomeLimpo, quantidade: qtdNome }
    }
  }
  return { nome, quantidade: qtdCampo }
}

function mapearShopee(row: Record<string, any>): Record<string, any> {
  const nomeProduto  = String(row['Nome do Produto'] || '').trim()
  const nomeVariacao = String(
    row['Nome da variação'] ?? row['Nome da Variação'] ??
    row['Variação'] ?? row['Variacao'] ?? ''
  ).trim()

  // Extrair quantidade embutida na variação Shopee: "Amarelo_completo,10" → qtd=10, variação="Amarelo_completo"
  let qtdDaVariacao: number | null = null
  let variacaoLimpa = nomeVariacao
  if (nomeVariacao) {
    const matchVar = nomeVariacao.match(/,(\d+)$/)
    if (matchVar) {
      const n = parseInt(matchVar[1])
      if (n > 0) {
        qtdDaVariacao = n
        variacaoLimpa = nomeVariacao.slice(0, -matchVar[0].length).trim()
      }
    }
  }

  const produto = variacaoLimpa ? `${nomeProduto} (${variacaoLimpa})` : nomeProduto

  // Quantidade: variação embutida tem prioridade (é a qtd de PEÇAS configurada pelo artesão)
  // A coluna "Quantidade" da Shopee costuma ser 1 (qtd de variações compradas) — não é a qtd de peças
  const qtdColuna = row['Quantidade'] ?? row['Quantidade do Produto'] ??
    row['Quantidade do produto'] ?? row['Qtd'] ?? row['Qtde'] ?? row['Qtde.'] ?? row['quantity'] ?? null
  const quantidade = qtdDaVariacao !== null
    ? qtdDaVariacao
    : (qtdColuna !== null && qtdColuna !== undefined && String(qtdColuna).trim() !== ''
        ? parseQtd(qtdColuna)
        : 1)

  return {
    numero:       String(row['ID do pedido'] || '').trim(),
    destinatario: String(row['Nome do destinatário'] || '').trim(),
    idCliente:    String(row['Nome de usuário (comprador)'] || '').trim() || null,
    canal:        'Shopee',
    produto:      produto || null,
    quantidade,
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
    produtos: Array<{ nome: string; quantidade: number; valorUnitario: number | null; camposExtras: any; variacaoId?: string | null; pecas?: number }>
    linhas: number[]
  }>()

  for (const item of dadosLinhas) {
    const { linha, dados } = item
    const numero = dados.numero
    if (!numero) continue

    const nomeBruto = String(dados.produto || '').trim()
    const { nome: nomeLimpo, quantidade: qtdExtraida } = extrairQtdDoNome(nomeBruto, Number(dados.quantidade) || 1)
    const produtoItem = {
      nome: nomeLimpo,
      quantidade: qtdExtraida,
      valorUnitario: dados.valor !== null && dados.valor !== undefined ? Number(dados.valor) : null,
      // Preserva os campos personalizados ESPECÍFICOS desta linha (variação, tema, cor, etc.)
      camposExtras: dados.camposExtras && typeof dados.camposExtras === 'object' ? { ...dados.camposExtras } : null,
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
    // Pedido com 1 produto — grava camposExtras.produtos mesmo assim
    // (evita split ambíguo por " + " na página de detalhe quando nome tem " + " no meio)
    const prod = produtos[0]
    if (!prod) return dados
    const extrasBase = dados.camposExtras && typeof dados.camposExtras === 'object'
      ? { ...dados.camposExtras } : {}
    // Peças (kit) → é o que vira Order.quantidade. Valor NÃO usa peças (fica intacto).
    const pecas = Number(prod.pecas ?? prod.quantidade) || 1
    extrasBase.produtos = [{
      nome: prod.nome,
      quantidade: pecas,
      valorUnitario: prod.valorUnitario !== null && prod.valorUnitario !== undefined ? Number(prod.valorUnitario) : null,
      variacaoId: prod.variacaoId ?? null,
    }]
    return { ...dados, quantidade: pecas, camposExtras: extrasBase }
  }

  const produtoTexto = produtos
    .map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`)
    .join(' + ')
  // Order.quantidade = soma das PEÇAS (kit derivado). Valor NÃO usa peças.
  const qtdTotal = produtos.reduce((s, p) => s + (Number(p.pecas ?? p.quantidade) || 1), 0)
  // Preço acordado da Shopee (e Valor R$ do VPS) já é o total por linha/SKU, não por peça
  // Correto: somar os preços de cada linha sem multiplicar pela quantidade de peças
  const valorTotal = produtos.reduce((s, p) => {
    return s + (p.valorUnitario ? Number(p.valorUnitario) : 0)
  }, 0)

  // Mesclar camposExtras existentes com produtos[]
  const extrasExistentes = dados.camposExtras && typeof dados.camposExtras === 'object'
    ? { ...dados.camposExtras } : {}
  extrasExistentes.produtos = produtos.map(p => ({
    nome: p.nome,
    quantidade: Number(p.pecas ?? p.quantidade) || 1,
    valorUnitario: p.valorUnitario !== null && p.valorUnitario !== undefined ? Number(p.valorUnitario) : null,
    variacaoId: p.variacaoId ?? null,
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
    const { linhas, linhasAOA, formato, acoes, agruparAcoes, qtdsManual, decisoesCliente } = await req.json()
    // linhasAOA (ADITIVO): planilha como array-de-arrays (linha 0 = cabeçalho) para a
    // camada fiscal Shopee ler por POSIÇÃO (colunas duplicadas "Desconto do vendedor"/"Cidade").
    // decisoesCliente (ADITIVO — só quando moduloClientes ativo): mapa keyed por
    // nome normalizado do comprador → { acao:'vincular'|'criar', clienteId?, nome, telefone }
    // agruparAcoes: { [numero]: 'agrupar' | 'separar' }
    // 'agrupar' = comportamento atual (1 pedido com todos os produtos)
    // 'separar' = cria pedidos individuais com sufixo -p1, -p2...
    const agruparAcoesMap: Record<string, string> = agruparAcoes && typeof agruparAcoes === 'object' ? agruparAcoes : {}

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

    // Mapa numero (idExterno) → Order.id para ligar a camada fiscal ao pedido criado/existente
    const orderIdPorNumero: Record<string, string> = {}
    for (const e of existentesRows) if (e.id) orderIdPorNumero[e.numero] = e.id

    // 3b. Aplicar quantidades manuais nos grupos (se fornecidas no preview)
    const qtdsManualMap: Record<string, number[]> = qtdsManual && typeof qtdsManual === 'object' ? qtdsManual : {}
    for (const [numero, grupo] of grupos) {
      const qtdArr = qtdsManualMap[numero]
      if (qtdArr && Array.isArray(qtdArr)) {
        grupo.produtos = grupo.produtos.map((p: any, i: number) =>
          qtdArr[i] ? { ...p, quantidade: qtdArr[i] } : p
        )
      }
    }

    // 3b-bis. Casamento com a Precificação (SÓ template VPS — nunca toca Shopee).
    // Para cada item: casa o nome → variação e deriva PEÇAS (qtdKit × qtd), igual ao
    // caminho manual. Grava em campos SEPARADOS (.pecas, .variacaoId) — NUNCA altera
    // .quantidade (que é o que a conta de VALOR usa), evitando inflar o faturamento.
    const matchReport = { reconhecidos: 0, naoReconhecidos: [] as string[], ambiguos: [] as string[] }
    if (formato !== 'shopee') {
      const variacoesRaw = await prisma.$queryRaw`
        SELECT v."id", v."nome", p."nome" AS "produtoNome", v."isKit", v."qtdKit"
        FROM "PrecVariacao" v
        INNER JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
      ` as VariacaoParaMatch[]
      const indice = indexarVariacoes(variacoesRaw)
      // Coluna explícita de peças na planilha prevalece sobre a derivação (respeita o digitado)
      const chavePecas = (extras: any): number | null => {
        if (!extras || typeof extras !== 'object') return null
        for (const [k, val] of Object.entries(extras)) {
          if (/^pe(ç|c)as$/i.test(k.trim())) { const n = Number(val); if (Number.isFinite(n) && n > 0) return n }
        }
        return null
      }
      for (const [numero, grupo] of grupos) {
        const temManual = Array.isArray(qtdsManualMap[numero])
        for (let i = 0; i < grupo.produtos.length; i++) {
          const item = grupo.produtos[i]
          const res = indice.resolver(item.nome)
          const pecasCol = chavePecas(item.camposExtras)
          if (res.status === 'match') {
            item.variacaoId = res.variacaoId
            matchReport.reconhecidos++
            // Prioridade: coluna de peças > edição manual no preview > derivação do kit
            item.pecas = pecasCol ?? (temManual ? (Number(item.quantidade) || 1) : derivarPecas(item.quantidade, res.isKit, res.qtdKit))
          } else {
            item.pecas = pecasCol ?? (Number(item.quantidade) || 1)
            if (res.status === 'ambiguo') matchReport.ambiguos.push(item.nome)
            else matchReport.naoReconhecidos.push(item.nome)
          }
        }
      }
    }

    // 3c. Resolve clienteId por comprador (ADITIVO). Cria clientes 'criar' com
    //     dedup no lote (nome normalizado → 1 cliente). Sem decisões → tudo null.
    const clientePorNome: Record<string, string> = {}
    const gerarIdCli = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
    if (decisoesCliente && typeof decisoesCliente === 'object') {
      for (const [chave, dec] of Object.entries(decisoesCliente as Record<string, any>)) {
        if (!dec || clientePorNome[chave]) continue
        if (dec.acao === 'vincular' && dec.clienteId) {
          clientePorNome[chave] = String(dec.clienteId)
        } else if (dec.acao === 'criar' && dec.nome) {
          try {
            const cid = gerarIdCli()
            await prisma.$executeRaw`
              INSERT INTO "Cliente" ("id","workspaceId","nome","telefone","origem","ativo","createdAt","updatedAt")
              VALUES (${cid}, ${workspaceId}, ${String(dec.nome)}, ${dec.telefone || null}, 'shopee', true, NOW(), NOW())
            `
            if (dec.telefone) {
              await prisma.$executeRaw`
                INSERT INTO "ClienteContato" ("id","clienteId","workspaceId","tipo","valor","label","principal")
                VALUES (${gerarIdCli()}, ${cid}, ${workspaceId}, 'telefone', ${String(dec.telefone)}, ${null}, true)
              `
            }
            clientePorNome[chave] = cid
          } catch (e) { console.warn('[import pedidos] criar cliente:', e) }
        }
      }
    }
    const clienteIdDe = (dest: any) => clientePorNome[normNome(dest)] || null

    // 4. Processar cada grupo
    for (const [numero, grupo] of grupos) {
      const primeiraLinha = grupo.linhas[0]
      const numLinhas = grupo.linhas.join(', ')

      try {
        // ── Cenário SEPARAR: cria pedidos individuais com sufixo -p1, -p2 ──
        const acaoGrupo = agruparAcoesMap[numero] || 'agrupar'
        if (grupo.produtos.length > 1 && acaoGrupo === 'separar') {
          for (let pi = 0; pi < grupo.produtos.length; pi++) {
            const prod    = grupo.produtos[pi]
            const sufixo  = `-p${pi + 1}`
            const numSep  = `${numero}${sufixo}`
            const idSep   = Math.random().toString(36).slice(2) + Date.now().toString(36)
            const dadosBase = { ...grupo.dados }
            const dataEntrada = dadosBase.dataEntrada || new Date()
            const dataEnvio   = dadosBase.dataEnvio   || null
            const prioridade  = dadosBase.prioridade  || 'NORMAL'
            // Mescla campos comuns do grupo (endereço, cliente, etc) com os
            // campos personalizados ESPECÍFICOS deste produto (variação, tema, cor...)
            const extrasComuns = dadosBase.camposExtras && typeof dadosBase.camposExtras === 'object'
              ? { ...dadosBase.camposExtras } : {}
            const extrasDoProduto = prod.camposExtras && typeof prod.camposExtras === 'object'
              ? { ...prod.camposExtras } : {}
            // Os campos do produto têm prioridade (sobrescrevem os comuns)
            const extrasMesclados = { ...extrasComuns, ...extrasDoProduto }
            // Peças (kit) para a quantidade; VALOR mantém a qtd original (não infla).
            const pecasSep = Number(prod.pecas ?? prod.quantidade) || 1
            const extrasStr = JSON.stringify({
              ...extrasMesclados,
              produtos: [{ nome: prod.nome, quantidade: pecasSep, valorUnitario: prod.valorUnitario, variacaoId: prod.variacaoId ?? null }],
            })
            await prisma.$executeRaw`
              INSERT INTO "Order"
                ("id","workspaceId","numero","destinatario","idCliente","canal","produto",
                 "quantidade","valor","prioridade","status","dataEntrada","dataEnvio",
                 "endereco","observacoes","camposExtras","clienteId","createdAt","updatedAt")
              VALUES
                (${idSep}, ${workspaceId}, ${numSep}, ${dadosBase.destinatario},
                 ${dadosBase.idCliente || null}, ${dadosBase.canal || null}, ${prod.nome},
                 ${pecasSep}, ${prod.valorUnitario ? prod.valorUnitario * prod.quantidade : null},
                 ${prioridade}, 'ABERTO', ${dataEntrada}, ${dataEnvio},
                 ${dadosBase.endereco || null}, ${dadosBase.observacoes || null},
                 ${extrasStr}, ${clienteIdDe(dadosBase.destinatario)}, NOW(), NOW())
            `
            if (pi === 0) orderIdPorNumero[numero] = idSep
            criados.push({ linha: grupo.linhas[pi] || primeiraLinha, numero: numSep, destinatario: dadosBase.destinatario, separado: true })
          }
          continue
        }

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
              quantidade: Number(p.pecas ?? p.quantidade) || 1,   // peças (kit derivado)
              valorUnitario: p.valorUnitario !== null && p.valorUnitario !== undefined
                ? Number(p.valorUnitario) : null,
              variacaoId: p.variacaoId ?? null,
              _valorQtd: Number(p.quantidade) || 1,               // qtd original — só p/ o cálculo de valor
            }))
            const todosProdutos = [...produtosExistentes, ...produtosNovos]

            const produtoTexto = todosProdutos
              .map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`)
              .join(' + ')
            const qtdTotal = todosProdutos.reduce((s, p) => s + (Number(p.quantidade) || 1), 0)
            // Valor usa a qtd ORIGINAL (peças nunca entram no valor — não infla o faturamento)
            const valorTotal = todosProdutos.reduce((s, p) => {
              const vq = (p as any)._valorQtd ?? (Number(p.quantidade) || 1)
              const v = p.valorUnitario ? Number(p.valorUnitario) * vq : 0
              return s + v
            }, 0)

            extrasExistentes.produtos = todosProdutos.map((p: any) => ({
              nome: p.nome, quantidade: Number(p.quantidade) || 1,
              valorUnitario: p.valorUnitario ?? null, variacaoId: p.variacaoId ?? null,
            }))
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
             "endereco","observacoes","camposExtras","clienteId","createdAt","updatedAt")
          VALUES
            (${id}, ${workspaceId}, ${dadosConsolidados.numero}, ${dadosConsolidados.destinatario},
             ${dadosConsolidados.idCliente || null}, ${dadosConsolidados.canal || null}, ${dadosConsolidados.produto},
             ${dadosConsolidados.quantidade}, ${valor}, ${prioridade}, 'ABERTO',
             ${dataEntrada}, ${dataEnvio},
             ${dadosConsolidados.endereco || null}, ${dadosConsolidados.observacoes || null},
             ${camposExtrasStr}, ${clienteIdDe(dadosConsolidados.destinatario)},
             NOW(), NOW())
        `

        orderIdPorNumero[numero] = id
        criados.push({
          linha: primeiraLinha,
          numero: dadosConsolidados.numero,
          destinatario: dadosConsolidados.destinatario,
          agrupado: grupo.produtos.length > 1 ? grupo.produtos.length : undefined,
          produtos: grupo.produtos.length > 1 ? grupo.produtos.map(p => ({
            nome: p.nome,
            quantidade: p.quantidade,
          })) : undefined,
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

    // [Stars removido — feature desativada até 01/06/2026]

    // ── Camada fiscal/financeira (ADITIVA) — só Shopee, a partir do AOA posicional ──
    // Upsert idempotente por (workspaceId, canal, idExterno): reimportar ATUALIZA, nunca duplica.
    let marketplace = 0
    try {
      if (formato === 'shopee' && Array.isArray(linhasAOA) && linhasAOA.length > 1) {
        await ensurePedidoMarketplaceTables()
        await ensureMarketplaceTables()
        // Config do canal (OPT-IN): só cria Recebivel quando o módulo está ligado
        const cfgRows = await prisma.$queryRaw`
          SELECT "ativo", "diasRepasse"::int AS "diasRepasse"
          FROM "MarketplaceConfig" WHERE "workspaceId" = ${workspaceId} AND "canal" = 'shopee' LIMIT 1
        ` as any[]
        const marketplaceAtivo = !!cfgRows[0]?.ativo
        const fiscais = construirFiscalShopee(linhasAOA)
        const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
        for (const p of fiscais.values()) {
          const orderId = orderIdPorNumero[p.idExterno] || null
          const cpfEnc  = encryptCpf(p.cpfPlain)
          const pmId    = gid()
          const rows = await prisma.$queryRaw`
            INSERT INTO "PedidoMarketplace" (
              "id","workspaceId","orderId","canal","idExterno",
              "statusExterno","statusDevolucao","rastreio","opcaoEnvio",
              "dataCriacaoExterna","dataPagamento","dataPrevistaEnvioExterna",
              "subtotalProdutos","freteComprador","descontoVendedor","descontoShopee",
              "cupomVendedor","cupomShopee","ajusteAcaoComercial","valorTotal","totalGlobal",
              "taxaTransacao","comissaoBruta","comissaoLiquida","servicoBruta","servicoLiquida",
              "freteReverso","freteEstimado","liquidoEstimado",
              "destinatarioNome","cpfCriptografado","telefoneMascarado",
              "endereco","bairro","cidade","uf","cep","pais","observacaoComprador",
              "createdAt","updatedAt"
            ) VALUES (
              ${pmId}, ${workspaceId}, ${orderId}, 'shopee', ${p.idExterno},
              ${p.statusExterno}, ${p.statusDevolucao}, ${p.rastreio}, ${p.opcaoEnvio},
              ${parseDate(p.dataCriacaoExterna)}, ${parseDate(p.dataPagamento)}, ${parseDate(p.dataPrevistaEnvioExterna)},
              ${p.subtotalProdutos}, ${p.freteComprador}, ${p.descontoVendedor}, ${p.descontoShopee},
              ${p.cupomVendedor}, ${p.cupomShopee}, ${p.ajusteAcaoComercial}, ${p.valorTotal}, ${p.totalGlobal},
              ${p.taxaTransacao}, ${p.comissaoBruta}, ${p.comissaoLiquida}, ${p.servicoBruta}, ${p.servicoLiquida},
              ${p.freteReverso}, ${p.freteEstimado}, ${p.liquidoEstimado},
              ${p.destinatarioNome}, ${cpfEnc}, ${p.telefoneMascarado},
              ${p.endereco}, ${p.bairro}, ${p.cidade}, ${p.uf}, ${p.cep}, ${p.pais}, ${p.observacaoComprador},
              NOW(), NOW()
            )
            ON CONFLICT ("workspaceId","canal","idExterno") DO UPDATE SET
              "orderId"                  = COALESCE(EXCLUDED."orderId", "PedidoMarketplace"."orderId"),
              "statusExterno"            = EXCLUDED."statusExterno",
              "statusDevolucao"          = EXCLUDED."statusDevolucao",
              "rastreio"                 = EXCLUDED."rastreio",
              "opcaoEnvio"               = EXCLUDED."opcaoEnvio",
              "dataCriacaoExterna"       = EXCLUDED."dataCriacaoExterna",
              "dataPagamento"            = EXCLUDED."dataPagamento",
              "dataPrevistaEnvioExterna" = EXCLUDED."dataPrevistaEnvioExterna",
              "subtotalProdutos"         = EXCLUDED."subtotalProdutos",
              "freteComprador"           = EXCLUDED."freteComprador",
              "descontoVendedor"         = EXCLUDED."descontoVendedor",
              "descontoShopee"           = EXCLUDED."descontoShopee",
              "cupomVendedor"            = EXCLUDED."cupomVendedor",
              "cupomShopee"              = EXCLUDED."cupomShopee",
              "ajusteAcaoComercial"      = EXCLUDED."ajusteAcaoComercial",
              "valorTotal"               = EXCLUDED."valorTotal",
              "totalGlobal"              = EXCLUDED."totalGlobal",
              "taxaTransacao"            = EXCLUDED."taxaTransacao",
              "comissaoBruta"            = EXCLUDED."comissaoBruta",
              "comissaoLiquida"          = EXCLUDED."comissaoLiquida",
              "servicoBruta"             = EXCLUDED."servicoBruta",
              "servicoLiquida"           = EXCLUDED."servicoLiquida",
              "freteReverso"             = EXCLUDED."freteReverso",
              "freteEstimado"            = EXCLUDED."freteEstimado",
              "liquidoEstimado"          = EXCLUDED."liquidoEstimado",
              "destinatarioNome"         = EXCLUDED."destinatarioNome",
              "cpfCriptografado"         = COALESCE(EXCLUDED."cpfCriptografado", "PedidoMarketplace"."cpfCriptografado"),
              "telefoneMascarado"        = EXCLUDED."telefoneMascarado",
              "endereco"                 = EXCLUDED."endereco",
              "bairro"                   = EXCLUDED."bairro",
              "cidade"                   = EXCLUDED."cidade",
              "uf"                       = EXCLUDED."uf",
              "cep"                      = EXCLUDED."cep",
              "pais"                     = EXCLUDED."pais",
              "observacaoComprador"      = EXCLUDED."observacaoComprador",
              "updatedAt"                = NOW()
            RETURNING "id"
          ` as any[]
          const realId = rows[0]?.id || pmId
          // Itens: substitui a lista (idempotente)
          await prisma.$executeRaw`DELETE FROM "PedidoMarketplaceItem" WHERE "pedidoMarketplaceId" = ${realId} AND "workspaceId" = ${workspaceId}`
          for (const it of p.itens) {
            await prisma.$executeRaw`
              INSERT INTO "PedidoMarketplaceItem" (
                "id","pedidoMarketplaceId","workspaceId","produto","sku","skuRef","variacao",
                "qtd","qtdDevolvida","precoOriginal","precoAcordado","subtotal","pesoSku"
              ) VALUES (
                ${gid()}, ${realId}, ${workspaceId}, ${it.produto}, ${it.sku}, ${it.skuRef}, ${it.variacao},
                ${it.qtd}, ${it.qtdDevolvida}, ${it.precoOriginal}, ${it.precoAcordado}, ${it.subtotal}, ${it.pesoSku}
              )
            `
          }

          // Order.valor = Valor Total (1x) — corrige a duplicação em multi-item AGRUPADO.
          // 'separar' cria 1 Order por produto (valor individual) → não aplica.
          const foiSeparado = agruparAcoesMap[p.idExterno] === 'separar'
          if (orderId && p.itens.length > 1 && !foiSeparado && p.valorTotal > 0) {
            await prisma.$executeRaw`
              UPDATE "Order" SET "valor" = ${p.valorTotal}, "updatedAt" = NOW()
              WHERE "id" = ${orderId} AND "workspaceId" = ${workspaceId}
            `
          }

          // Recebível (previsão pura — OPT-IN). Nunca vira FinLancamento.
          // Upsert idempotente por (workspaceId, orderId): reimportar atualiza o valor,
          // preservando o status/dataPrevista do ciclo de vida.
          if (marketplaceAtivo && orderId) {
            await prisma.$executeRaw`
              INSERT INTO "Recebivel" ("id","workspaceId","orderId","canal","valorLiquidoEstimado","status","createdAt","updatedAt")
              VALUES (${gid()}, ${workspaceId}, ${orderId}, 'shopee', ${p.liquidoEstimado}, 'aguardando_envio', NOW(), NOW())
              ON CONFLICT ("workspaceId","orderId") DO UPDATE SET
                "valorLiquidoEstimado" = ${p.liquidoEstimado}, "updatedAt" = NOW()
            `
          }
          marketplace++
        }
      }
    } catch (eFiscal) {
      // Nunca bloqueia a importação de pedidos — a camada fiscal é aditiva
      console.error('[import pedidos] camada fiscal:', eFiscal)
    }

    return NextResponse.json({
      ok:      true,
      criados: criados.length,
      atualizados: atualizados.length,
      erros:   erros.length,
      marketplace,
      precificacao: {
        reconhecidos: matchReport.reconhecidos,
        naoReconhecidos: Array.from(new Set(matchReport.naoReconhecidos)),
        ambiguos: Array.from(new Set(matchReport.ambiguos)),
      },
      detalhes: { criados, atualizados, erros },
    })
  } catch (err) {
    console.error('[POST /api/importacao/pedidos]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
