// app/api/clientes/importar/route.ts — Importador de clientes (Fase 2) — VPS-20260630-NQA8
// Recebe as linhas JÁ PARSEADAS do .xlsx (parse do xlsx é client-side, no modal).
// modo verificar: só detecta duplicados/invalidos para o preview (não insere).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function novoId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const limpar = (v: any) => {
  const s = String(v ?? '').trim()
  return s === '' || s === '-' ? '' : s
}
const soDigitos = (v: string) => v.replace(/\D/g, '')

// dd/mm/aaaa (ou ISO) → 'YYYY-MM-DD'. Coluna é `date` (sem hora) → sem risco de
// deslocar o dia por timezone. Retorna null se não reconhecer.
function parseDataBR(v: any): string | null {
  const s = limpar(v); if (!s) return null
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}
function parseIntSafe(v: any): number {
  const n = parseInt(soDigitos(String(v ?? '')))
  return isNaN(n) ? 0 : n
}

// Mapeia/limpa uma linha da planilha de clientes (mesmas regras no preview do modal).
// TODAS as 9 colunas vão para campos DEDICADOS — nada concatenado em observações.
function mapearCliente(row: Record<string, any>) {
  const nome     = limpar(row['Nome do cliente'])
  const email    = limpar(row['Email'])
  const telefone = limpar(row['Telefone'])
  const cidadeRaw = limpar(row['Cidade'])

  // "Indaiatuba-SP" / "Rio de Janeiro- RJ" → cidade + UF
  let cidade = cidadeRaw, uf = ''
  const m = cidadeRaw.match(/^(.*?)[\s-]+([A-Za-z]{2})$/)
  if (m) { cidade = m[1].trim().replace(/[-\s]+$/, ''); uf = m[2].toUpperCase() }

  return {
    nome, email, telefone, cidade, uf,
    ultimoPedidoData:   parseDataBR(row['Último pedido']),
    ultimoPedidoStatus: limpar(row['Status último pedido']) || null,
    totalPedidos:       parseIntSafe(row['Total de pedidos']),
    pedidosFinalizados: parseIntSafe(row['Pedidos finalizados']),
    pedidosEmAberto:    parseIntSafe(row['Pedidos em aberto']),
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const linhas: Record<string, any>[] = Array.isArray(body?.linhas) ? body.linhas : []
    if (linhas.length === 0) return NextResponse.json({ error: 'Nenhuma linha recebida' }, { status: 400 })
    if (linhas.length > 2000) return NextResponse.json({ error: 'Máximo de 2000 clientes por importação' }, { status: 400 })

    // Conjuntos de clientes já existentes no workspace (dedup por email; senão nome+telefone)
    const existentes = await prisma.$queryRaw`
      SELECT "email", "nome", "telefone" FROM "Cliente" WHERE "workspaceId" = ${workspaceId}
    ` as { email: string | null; nome: string | null; telefone: string | null }[]
    const setEmail = new Set<string>()
    const setNomeTel = new Set<string>()
    for (const e of existentes) {
      if (e.email) setEmail.add(e.email.trim().toLowerCase())
      setNomeTel.add(`${(e.nome || '').trim().toLowerCase()}|${soDigitos(e.telefone || '')}`)
    }

    const ehDuplicado = (nome: string, email: string, telefone: string) => {
      if (email && setEmail.has(email.toLowerCase())) return true
      if (setNomeTel.has(`${nome.toLowerCase()}|${soDigitos(telefone)}`)) return true
      return false
    }

    // ── Modo verificar: só reporta índices duplicados/inválidos para o preview ──
    if (body?.verificar) {
      const duplicadosIdx: number[] = []
      const invalidosIdx: number[] = []
      linhas.forEach((row, i) => {
        const c = mapearCliente(row)
        if (!c.nome) { invalidosIdx.push(i); return }
        if (ehDuplicado(c.nome, c.email, c.telefone)) duplicadosIdx.push(i)
      })
      return NextResponse.json({ duplicadosIdx, invalidosIdx })
    }

    // ── Modo inserir ──
    const criados: any[] = []
    const erros: any[] = []
    let duplicados = 0

    for (let i = 0; i < linhas.length; i++) {
      const numLinha = i + 2 // +1 header, +1 base-1
      try {
        const c = mapearCliente(linhas[i])
        if (!c.nome) { erros.push({ linha: numLinha, erro: 'Nome do cliente vazio' }); continue }
        if (ehDuplicado(c.nome, c.email, c.telefone)) { duplicados++; continue }

        const id = novoId()
        await prisma.$executeRaw`
          INSERT INTO "Cliente"
            ("id","workspaceId","nome","documento","email","telefone","observacoes","tags","origem","ativo",
             "ultimoPedidoData","ultimoPedidoStatus","totalPedidos","pedidosFinalizados","pedidosEmAberto",
             "createdAt","updatedAt")
          VALUES
            (${id}, ${workspaceId}, ${c.nome}, ${null}, ${c.email || null}, ${c.telefone || null},
             ${null}, ${null}, 'importacao', true,
             ${c.ultimoPedidoData}::date, ${c.ultimoPedidoStatus}, ${c.totalPedidos}, ${c.pedidosFinalizados}, ${c.pedidosEmAberto},
             NOW(), NOW())
        `
        if (c.email) {
          await prisma.$executeRaw`
            INSERT INTO "ClienteContato" ("id","clienteId","workspaceId","tipo","valor","label","principal")
            VALUES (${novoId()}, ${id}, ${workspaceId}, 'email', ${c.email}, ${null}, true)
          `
        }
        if (c.telefone) {
          await prisma.$executeRaw`
            INSERT INTO "ClienteContato" ("id","clienteId","workspaceId","tipo","valor","label","principal")
            VALUES (${novoId()}, ${id}, ${workspaceId}, 'telefone', ${c.telefone}, ${null}, ${c.email ? false : true})
          `
        }
        if (c.cidade) {
          await prisma.$executeRaw`
            INSERT INTO "ClienteEndereco"
              ("id","clienteId","workspaceId","apelido","cep","logradouro","numero","complemento","bairro","cidade","estado","principal")
            VALUES (${novoId()}, ${id}, ${workspaceId}, ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${c.cidade}, ${c.uf || null}, true)
          `
        }

        // registra nos conjuntos p/ dedup dentro do próprio lote
        if (c.email) setEmail.add(c.email.toLowerCase())
        setNomeTel.add(`${c.nome.toLowerCase()}|${soDigitos(c.telefone)}`)
        criados.push({ linha: numLinha, nome: c.nome })
      } catch (e) {
        erros.push({ linha: numLinha, erro: 'Erro ao processar linha' })
      }
    }

    return NextResponse.json({
      ok: true,
      criados: criados.length,
      duplicados,
      erros: erros.length,
      detalhes: { criados, erros },
    })
  } catch (err) {
    console.error('[POST clientes/importar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
