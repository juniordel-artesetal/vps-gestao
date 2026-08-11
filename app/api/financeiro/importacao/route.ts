// app/api/financeiro/importacao/route.ts
// Importação em massa de lançamentos financeiros via planilha
// Suporta criação automática de categorias inexistentes
//
// Colunas aceitas (case-insensitive, sem acento sensíveis):
//   Tipo            → RECEITA | DESPESA (obrigatório)
//   Categoria       → Nome da categoria (opcional, criada se não existir)
//   Descrição       → Texto (obrigatório)
//   Valor           → Número (obrigatório). Aceita "1.234,56" ou "1234.56"
//   Data            → Data prevista (obrigatório). DD/MM/YYYY ou YYYY-MM-DD ou serial Excel
//   Status          → PAGO | PENDENTE (opcional, default PENDENTE)
//   Data Realizada  → Data que o pagamento caiu (opcional, só se Status=PAGO)
//   Valor Realizado → Valor que realmente caiu (opcional, default = Valor)
//   Canal           → Texto livre (opcional)
//   Referência      → Texto livre, ex: número do pedido (opcional)
//   Observações     → Texto livre (opcional)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function parseDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()

  // DD/MM/YYYY (com ou sem hora)
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) {
    const [_, d, m, y] = br
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // YYYY-MM-DD (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

  // Serial Excel (número de dias desde 1900-01-01)
  const num = parseFloat(s)
  if (!isNaN(num) && num > 40000) {
    const utcMs = (num - 25569) * 86400 * 1000
    const tmp = new Date(utcMs)
    if (isNaN(tmp.getTime())) return null
    const y  = tmp.getUTCFullYear()
    const m  = String(tmp.getUTCMonth() + 1).padStart(2, '0')
    const d  = String(tmp.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  return null
}

function parseValor(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  let s = String(val).trim()
  if (!s) return null
  // Remove R$ e espaços
  s = s.replace(/R\$\s*/gi, '').replace(/\s/g, '')
  // Caso "1.234,56" → "1234.56"
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  // Limpa qualquer outro caractere
  s = s.replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function normalizaTipo(val: any): 'RECEITA' | 'DESPESA' | null {
  if (!val) return null
  const s = String(val).trim().toUpperCase()
  if (s.startsWith('R') || s.includes('ENTRADA')) return 'RECEITA'
  if (s.startsWith('D') || s.includes('SAIDA') || s.includes('SAÍDA')) return 'DESPESA'
  return null
}

function normalizaStatus(val: any): 'PAGO' | 'PENDENTE' {
  if (!val) return 'PENDENTE'
  const s = String(val).trim().toUpperCase()
  if (s.startsWith('P') && (s.includes('AGO') || s === 'P')) return 'PAGO'
  return 'PENDENTE'
}

// Normaliza chaves de header (case insensitive, sem acento, sem espaços extras)
function normKey(k: string): string {
  return String(k || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

// Mapeia o objeto da planilha para um objeto padronizado
function mapLinha(row: any) {
  const map: Record<string, any> = {}
  for (const k of Object.keys(row)) map[normKey(k)] = row[k]
  return {
    tipo:           map['tipo'] ?? map['tipo lancamento'] ?? map['movimento'],
    // Formato "fluxo de caixa": colunas separadas Entrada / Saída (sem coluna Tipo).
    entrada:        map['entrada'] ?? map['entradas'] ?? map['receita'] ?? map['credito'] ?? map['crédito'],
    saida:          map['saida'] ?? map['saída'] ?? map['saidas'] ?? map['saídas'] ?? map['despesa'] ?? map['debito'] ?? map['débito'],
    categoria:      map['categoria'] ?? map['categoria nome'],
    descricao:      map['descricao'] ?? map['descrição'] ?? map['descricão'] ?? map['descriçao'],
    valor:          map['valor'] ?? map['valor previsto'],
    data:           map['data'] ?? map['data prevista'] ?? map['dataprevista'] ?? map['data lancamento'],
    status:         map['status'],
    dataRealizada:  map['data realizada'] ?? map['dataregalizada'] ?? map['data pagamento'] ?? map['datapagamento'],
    valorRealizado: map['valor realizado'] ?? map['valor pago'] ?? map['valorpago'],
    canal:          map['canal'],
    referencia:     map['referencia'] ?? map['referência'],
    observacoes:    map['observacoes'] ?? map['observações'] ?? map['observacões'],
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const linhas = Array.isArray(body?.linhas) ? body.linhas : null
  if (!linhas || linhas.length === 0)
    return NextResponse.json({ error: 'Nenhuma linha enviada' }, { status: 400 })

  // ── Carrega categorias existentes (para mapear nome → id) ───────────────
  const categoriasExistentes = await prisma.$queryRaw`
    SELECT id, nome, tipo FROM "FinCategoria"
    WHERE "workspaceId" = ${workspaceId}
  ` as Array<{ id: string; nome: string; tipo: string }>

  const catPorNomeTipo = new Map<string, string>()
  for (const c of categoriasExistentes) {
    catPorNomeTipo.set(`${c.tipo}::${c.nome.toLowerCase().trim()}`, c.id)
  }

  // ── Cores/ícones padrão para categorias criadas auto ────────────────────
  const CORES = ['#7c3aed', '#ec4899', '#f97316', '#10b981', '#3b82f6', '#eab308', '#06b6d4', '#84cc16']
  const ICONE_RECEITA = '💰'
  const ICONE_DESPESA = '💸'
  let corIdx = categoriasExistentes.length

  const criados: any[] = []
  const erros: Array<{ linha: number; motivo: string }> = []
  const duplicados: Array<{ linha: number; motivo: string }> = []

  for (let i = 0; i < linhas.length; i++) {
    const raw = linhas[i]
    const linhaNum = (raw.__linha__ as number) || (i + 2) // +2 = +1 (zero-based) +1 (header)
    const m = mapLinha(raw)

    try {
      // Tipo + valor: da coluna "Tipo"+"Valor" OU do formato fluxo de caixa (Entrada/Saída).
      let tipo = normalizaTipo(m.tipo)
      let valorBruto: any = m.valor
      if (!tipo) {
        const vEntrada = parseValor(m.entrada)
        const vSaida   = parseValor(m.saida)
        if (vEntrada !== null && vEntrada > 0)      { tipo = 'RECEITA'; valorBruto = m.entrada }
        else if (vSaida !== null && vSaida > 0)     { tipo = 'DESPESA'; valorBruto = m.saida }
      }
      if (!tipo) {
        erros.push({ linha: linhaNum, motivo: 'Tipo não identificado (use a coluna Tipo = RECEITA/DESPESA, ou as colunas Entrada/Saída)' })
        continue
      }
      const descricao = String(m.descricao ?? '').trim()
      if (!descricao) {
        erros.push({ linha: linhaNum, motivo: 'Descrição vazia' })
        continue
      }
      const valor = parseValor(valorBruto)
      if (valor === null || valor <= 0) {
        erros.push({ linha: linhaNum, motivo: 'Valor inválido ou zero' })
        continue
      }
      const data = parseDate(m.data)
      if (!data) {
        erros.push({ linha: linhaNum, motivo: 'Data inválida (use DD/MM/YYYY)' })
        continue
      }
      const status = normalizaStatus(m.status)
      const dataRealizada  = status === 'PAGO' ? (parseDate(m.dataRealizada) || data) : null
      const valorRealizado = status === 'PAGO' ? (parseValor(m.valorRealizado) ?? valor) : null

      // ── Resolve categoria (cria automaticamente se não existe) ─────────
      let categoriaId: string | null = null
      const catNome = String(m.categoria ?? '').trim()
      if (catNome) {
        const chave = `${tipo}::${catNome.toLowerCase()}`
        if (catPorNomeTipo.has(chave)) {
          categoriaId = catPorNomeTipo.get(chave)!
        } else {
          // Cria nova categoria
          const idCat = newId()
          const cor = CORES[corIdx % CORES.length]
          corIdx++
          // FinCategoria NÃO tem createdAt/updatedAt — não referenciar (era o bug que derrubava
          // toda linha com categoria nova). parentId/padrao/ordem/grupoDRE têm default.
          await prisma.$executeRaw`
            INSERT INTO "FinCategoria" ("id","workspaceId","nome","tipo","cor","icone")
            VALUES (${idCat}, ${workspaceId}, ${catNome}, ${tipo}, ${cor},
                    ${tipo === 'RECEITA' ? ICONE_RECEITA : ICONE_DESPESA})
          `
          catPorNomeTipo.set(chave, idCat)
          categoriaId = idCat
        }
      }

      // Idempotência: não recria um lançamento idêntico (mesmo tipo/data/valor/descrição) no re-import.
      const jaExiste = await prisma.$queryRaw`
        SELECT 1 FROM "FinLancamento"
        WHERE "workspaceId" = ${workspaceId} AND "tipo" = ${tipo}
          AND "data" = ${data}::date AND "descricao" = ${descricao} AND "valor" = ${valor}
        LIMIT 1
      ` as any[]
      if (jaExiste.length) {
        duplicados.push({ linha: linhaNum, motivo: 'Já existe (re-importação) — ignorado' })
        continue
      }

      const idLanc = newId()
      const canal = m.canal ? String(m.canal).trim() : null
      const referencia = m.referencia ? String(m.referencia).trim() : null
      const observacoes = m.observacoes ? String(m.observacoes).trim() : null

      await prisma.$executeRawUnsafe(
        `INSERT INTO "FinLancamento"
          ("id","workspaceId","tipo","categoriaId","descricao","valor","data","status",
           "dataRealizada","valorRealizado","canal","referencia","observacoes")
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9::date,$10,$11,$12,$13)`,
        idLanc, workspaceId, tipo, categoriaId, descricao, valor, data, status,
        dataRealizada, valorRealizado, canal, referencia, observacoes
      )

      criados.push({ linha: linhaNum, tipo, descricao, valor, status, data })
    } catch (err: any) {
      console.error('[importacao financeiro] linha', linhaNum, err)
      erros.push({ linha: linhaNum, motivo: err?.message || String(err) })
    }
  }

  // Meses que receberam dados (para a tela navegar até lá — evita "sumiu" quando a
  // importação cai em meses diferentes do que está sendo visto).
  const datas = criados.map(c => c.data).filter(Boolean).sort()
  const primeiraData = datas[0] || null
  const primeiroMes = primeiraData ? { ano: Number(primeiraData.slice(0, 4)), mes: Number(primeiraData.slice(5, 7)) } : null
  const mesesSet = new Set(criados.map(c => c.data ? c.data.slice(0, 7) : null).filter(Boolean))

  return NextResponse.json({
    ok: true,
    total: linhas.length,
    criados: criados.length,
    duplicados: duplicados.length,
    erros: erros.length,
    primeiroMes,
    meses: Array.from(mesesSet).sort(),
    detalhes: { criados, duplicados, erros },
  })
}
