'use client'

// Relatório em folha limpa para IMPRIMIR / salvar em PDF (Fase 2). Mesmo caminho que os pedidos
// já usam para imprimir: nada de motor de PDF no servidor. Os filtros vêm na própria URL, então
// o que sai no papel é exatamente o recorte que estava na tela.
import { useEffect, useState } from 'react'

const brl = (n: any) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function RelatorioPrintPage() {
  const [d, setD] = useState<any>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    const qs = typeof window !== 'undefined' ? window.location.search : ''
    fetch(`/api/financeiro/relatorio/dados${qs}`)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || 'Erro'); return r.json() })
      .then(j => { setD(j); setTimeout(() => window.print(), 400) })
      .catch(e => setErro(e.message))
  }, [])

  if (erro) return <div style={{ padding: 40 }}>{erro}</div>
  if (!d) return <div style={{ padding: 40 }}>Preparando relatório...</div>

  return (
    <div className="p-8 text-[12px] text-gray-900 bg-white">
      <style>{`@media print {
        @page { size: A4 landscape; margin: 12mm }
        .nao-imprime { display: none }
        thead { display: table-header-group }   /* repete o cabeçalho em toda página */
        tr { break-inside: avoid }
      }`}</style>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">{d.titulo}</h1>
          <p className="text-gray-500">{d.workspaceNome} · gerado em {new Date().toLocaleString('pt-BR')}</p>
        </div>
        <button onClick={() => window.print()} className="nao-imprime border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
          Imprimir / salvar PDF
        </button>
      </div>

      <div className="flex gap-6 mb-4 border-y border-gray-200 py-2">
        <div><span className="text-gray-500">Total: </span><b>R$ {brl(d.totais.valor)}</b></div>
        <div><span className="text-gray-500">Já movimentado: </span><b>R$ {brl(d.totais.realizado)}</b></div>
        <div><span className="text-gray-500">Em aberto: </span><b>R$ {brl(d.totais.emAberto)}</b></div>
        <div className="text-gray-500 ml-auto">{d.linhas.length} lançamento(s)</div>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-800 text-left">
            <th className="py-1.5 pr-2">Data</th>
            <th className="py-1.5 pr-2">Tipo</th>
            <th className="py-1.5 pr-2">Descrição</th>
            <th className="py-1.5 pr-2">Categoria</th>
            <th className="py-1.5 pr-2">Conta</th>
            <th className="py-1.5 pr-2">Situação</th>
            <th className="py-1.5 pr-2 text-right">Valor</th>
            <th className="py-1.5 pr-2 text-right">Já movim.</th>
            <th className="py-1.5 text-right">Em aberto</th>
          </tr>
        </thead>
        <tbody>
          {d.linhas.map((l: any, i: number) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1 pr-2 whitespace-nowrap">{l.Data}</td>
              <td className="py-1 pr-2">{l.Tipo}</td>
              <td className="py-1 pr-2">{l.Descricao}</td>
              <td className="py-1 pr-2">{l.Categoria}</td>
              <td className="py-1 pr-2">{l.Conta}</td>
              <td className="py-1 pr-2">{l.Situacao}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{brl(l.Valor)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{brl(l.Realizado)}</td>
              <td className="py-1 text-right tabular-nums">{brl(l.EmAberto)}</td>
            </tr>
          ))}
          {d.linhas.length === 0 && <tr><td colSpan={9} className="py-6 text-center text-gray-400">Nada neste recorte.</td></tr>}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-800 font-bold">
            <td colSpan={6} className="py-1.5">TOTAL</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{brl(d.totais.valor)}</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{brl(d.totais.realizado)}</td>
            <td className="py-1.5 text-right tabular-nums">{brl(d.totais.emAberto)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
