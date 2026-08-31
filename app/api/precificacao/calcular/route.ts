// app/api/precificacao/calcular/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { resolverTaxa } from '@/lib/canaisVenda'

// Canais NATIVOS tratados pelo switch abaixo. GUARDRAIL de regressão-zero: só estes
// passam por getTaxas — qualquer outro slug é canal PRÓPRIO (custom) e vai pro resolver.
// Assim os nativos rodam exatamente o MESMO código de hoje (preço byte-idêntico).
const CANAIS_NATIVOS = new Set(['shopee', 'mercadolivre', 'amazon', 'tiktokshop', 'elo7', 'magalu', 'direta'])

function getTaxas(canal: string, preco: number, opcoes: any): { comissaoPerc: number; taxaFixa: number; taxaFrete: number; total: number } {
  let comissaoPerc = 0
  let taxaFixa     = 0
  let taxaFrete    = 0

  if (canal === 'shopee') {
    // Taxas 2026 CNPJ por faixa de preço
    if (preco < 8)        { comissaoPerc = 0.50; taxaFixa = 0 }
    else if (preco < 80)  { comissaoPerc = 0.20; taxaFixa = 4.00 }
    else if (preco < 100) { comissaoPerc = 0.14; taxaFixa = 16.00 }
    else if (preco < 200) { comissaoPerc = 0.14; taxaFixa = 20.00 }
    else                  { comissaoPerc = 0.14; taxaFixa = 26.00 }
    if (opcoes?.freteGratis) taxaFrete = preco * 0.06
  } else if (canal === 'mercadolivre') {
    comissaoPerc = opcoes?.tipo === 'premium' ? 0.16 : 0.12
    taxaFixa = 0
  } else if (canal === 'amazon') {
    comissaoPerc = 0.12; taxaFixa = 2.00
  } else if (canal === 'tiktokshop') {
    comissaoPerc = 0.06; taxaFixa = 2.00
    if (opcoes?.freteGratis) taxaFrete = preco * 0.06
  } else if (canal === 'elo7') {
    comissaoPerc = opcoes?.exposicao === 'maxima' ? 0.20 : 0.18; taxaFixa = 3.99
  } else if (canal === 'magalu') {
    comissaoPerc = 0.10; taxaFixa = 0
  } else if (canal === 'direta') {
    comissaoPerc = opcoes?.taxaTransacao ?? 0.03; taxaFixa = 0
  }

  const total = preco * comissaoPerc + taxaFixa + taxaFrete
  return { comissaoPerc, taxaFixa, taxaFrete, total }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId

    const { custoTotal, precoVenda, canal, opcoes } = await req.json()
    if (!custoTotal || !precoVenda || !canal) return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

    const custo  = Number(custoTotal)
    const preco  = Number(precoVenda)

    // Nativo → switch de hoje (inalterado). Custom (plataforma própria) → resolverTaxa,
    // que casa por slug a taxa real do CanalVenda (origem='custom', ex.: EJC 30%).
    let taxa: { comissaoPerc: number; taxaFixa: number; taxaFrete: number; total: number }
    if (CANAIS_NATIVOS.has(String(canal))) {
      taxa = getTaxas(canal, preco, opcoes)
    } else {
      const t = await resolverTaxa(workspaceId, String(canal), { preco })
      const comissaoPerc = (Number(t.taxaPercent) || 0) / 100
      const taxaFixa = Number(t.taxaFixa) || 0
      taxa = { comissaoPerc, taxaFixa, taxaFrete: 0, total: preco * comissaoPerc + taxaFixa }
    }

    const lucroLiquido = preco - custo - taxa.total
    const margemLucro  = lucroLiquido / preco
    const markupCusto  = lucroLiquido / custo

    return NextResponse.json({
      preco, custo, canal,
      taxa,
      lucroLiquido,
      margemLucro,
      markupCusto,
    })
  } catch (error) {
    console.error('[POST calcular]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
