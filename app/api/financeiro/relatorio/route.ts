// Exportação dos relatórios financeiros (Fase 2). Respeita os MESMOS filtros da tela.
// Excel: .xlsx de verdade via SheetJS (já era dependência do projeto — nada novo instalado).
// CSV: separador ';' + BOM, que é como o Excel pt-BR abre sem diálogo de importação.
// PDF: não é gerado aqui — a tela usa a página de impressão (/financeiro/relatorio/print),
// mesmo caminho já usado pelos pedidos, evitando trazer um motor de PDF pro servidor.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { linhasRelatorio, filtrosDaUrl, tituloRelatorio } from '@/lib/finRelatorio'

const COLUNAS = ['Data', 'Tipo', 'Descricao', 'Categoria', 'Conta', 'Situacao', 'Valor', 'Realizado', 'EmAberto'] as const
const CABECALHO = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Situação', 'Valor', 'Já movimentado', 'Em aberto']

function toCSV(linhas: any[]): string {
  const esc = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""')
    return /[;"\n]/.test(s) ? `"${s}"` : s
  }
  // Números em pt-BR (vírgula) para o Excel brasileiro não ler 12.50 como data/texto.
  const numBr = (n: any) => (Number(n) || 0).toFixed(2).replace('.', ',')
  const corpo = linhas.map(l =>
    [l.Data, l.Tipo, l.Descricao, l.Categoria, l.Conta, l.Situacao, numBr(l.Valor), numBr(l.Realizado), numBr(l.EmAberto)]
      .map(esc).join(';'))
  return '﻿' + [CABECALHO.join(';'), ...corpo].join('\n')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  const url = new URL(req.url)
  const filtros = filtrosDaUrl(url)
  const formato = url.searchParams.get('formato') === 'csv' ? 'csv' : 'xlsx'

  const { linhas, totais } = await linhasRelatorio(workspaceId, filtros)
  const titulo = tituloRelatorio(filtros)
  const base = (filtros.fonte === 'previstos' ? 'a-pagar-e-receber' : 'entradas-e-saidas')
    + '-' + new Date().toISOString().slice(0, 10)

  if (formato === 'csv') {
    return new NextResponse(toCSV(linhas), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"`,
      },
    })
  }

  // .xlsx — cabeçalho em português, linha de totais no fim e larguras razoáveis.
  const dados = linhas.map(l => ({
    Data: l.Data, Tipo: l.Tipo, 'Descrição': l.Descricao, Categoria: l.Categoria,
    Conta: l.Conta, 'Situação': l.Situacao,
    Valor: l.Valor, 'Já movimentado': l.Realizado, 'Em aberto': l.EmAberto,
  }))
  dados.push({
    Data: '', Tipo: '', 'Descrição': 'TOTAL', Categoria: '', Conta: '', 'Situação': '',
    Valor: totais.valor, 'Já movimentado': totais.realizado, 'Em aberto': totais.emAberto,
  })

  const ws = XLSX.utils.json_to_sheet(dados, { header: [...CABECALHO] })
  ws['!cols'] = [{ wch: 11 }, { wch: 9 }, { wch: 46 }, { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 13 }, { wch: 15 }, { wch: 13 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 28) || 'Relatório')   // nome de aba: máx. 31 chars
  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${base}.xlsx"`,
    },
  })
}
