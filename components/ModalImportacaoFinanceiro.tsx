'use client'
// components/ModalImportacaoFinanceiro.tsx
// Modal para importar lançamentos financeiros via planilha XLSX/CSV
// Mesmo padrão do ModalImportacao de pedidos

import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

type Etapa = 'upload' | 'preview' | 'importando' | 'concluido'

interface Props {
  onClose: () => void
  onImportado?: () => void
}

const COLUNAS_MODELO = [
  'Tipo',
  'Categoria',
  'Descricao',
  'Valor',
  'Data',
  'Status',
  'Data Realizada',
  'Valor Realizado',
  'Canal',
  'Referencia',
  'Observacoes',
]

const EXEMPLOS = [
  ['RECEITA', 'Vendas Shopee', 'Repasse Shopee semana 1', '1250.50', '15/01/2026', 'PAGO',  '15/01/2026', '1250.50', 'Shopee',     'Repasse 001', ''],
  ['RECEITA', 'Vendas Direta', 'Pedido #2603141',         '85.00',   '20/01/2026', 'PENDENTE', '',       '',        'Direta',     '2603141',     'Cliente: Maria'],
  ['DESPESA', 'Materiais',     'Compra de fitas + lacos', '230.00',  '08/01/2026', 'PAGO',  '08/01/2026', '230.00',  '',           '',            ''],
  ['DESPESA', 'Internet',      'Vivo Fibra',              '99.90',   '10/01/2026', 'PAGO',  '10/01/2026', '99.90',   '',           '',            ''],
  ['DESPESA', 'Aluguel',       'Espaco do atelie',        '800.00',  '05/01/2026', 'PAGO',  '05/01/2026', '800.00',  '',           '',            ''],
  ['DESPESA', 'Taxas Marketplace', 'Taxas Shopee semana 1', '187.50','15/01/2026', 'PAGO',  '15/01/2026', '187.50',  'Shopee',     'Repasse 001', ''],
]

export default function ModalImportacaoFinanceiro({ onClose, onImportado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('upload')
  const [linhas, setLinhas] = useState<any[]>([])
  const [erro, setErro] = useState('')
  const [progresso, setProgresso] = useState({ criados: 0, duplicados: 0, erros: 0, total: 0 })
  const [resultadoDetalhes, setResultadoDetalhes] = useState<any>(null)
  const inputFileRef = useRef<HTMLInputElement>(null)

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS_MODELO, ...EXEMPLOS])
    // Ajusta largura das colunas
    ws['!cols'] = [
      { wch: 10 }, { wch: 22 }, { wch: 32 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 24 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lançamentos')
    XLSX.writeFile(wb, 'modelo-lancamentos-financeiros.xlsx')
  }

  async function processarArquivo(file: File) {
    setErro('')
    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array', cellDates: false })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
      if (!json.length) {
        setErro('Planilha vazia')
        return
      }
      // Adiciona número da linha original (header é linha 1, dados começam na linha 2)
      const comLinha = json.map((row, i) => ({ ...row, __linha__: i + 2 }))
      setLinhas(comLinha)
      setEtapa('preview')
    } catch (e: any) {
      setErro('Erro ao ler planilha: ' + (e?.message || String(e)))
    }
  }

  async function confirmarImportacao() {
    setEtapa('importando')
    try {
      const res = await fetch('/api/financeiro/importacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro na importação')
        setEtapa('preview')
        return
      }
      setProgresso({ criados: data.criados, duplicados: data.duplicados || 0, erros: data.erros, total: data.total })
      setResultadoDetalhes(data.detalhes)
      setEtapa('concluido')
      if (onImportado) onImportado()
    } catch (e: any) {
      setErro('Erro de rede: ' + (e?.message || String(e)))
      setEtapa('preview')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-orange-500" size={20} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Importar Entradas e Saídas
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {erro && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          {/* ── ETAPA UPLOAD ── */}
          {etapa === 'upload' && (
            <div className="space-y-5">
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                <p className="text-sm text-orange-900 dark:text-orange-200 font-medium mb-2">
                  💡 Como funciona
                </p>
                <ol className="text-xs text-orange-800 dark:text-orange-300 space-y-1 list-decimal list-inside">
                  <li>Baixe a planilha modelo abaixo</li>
                  <li>Preencha com seus registros (use a coluna Status como "PENDENTE" para registros futuros)</li>
                  <li>Categorias que não existirem ainda serão criadas automaticamente</li>
                  <li>Faça o upload — você poderá conferir antes de confirmar</li>
                </ol>
              </div>

              <button
                onClick={baixarModelo}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-orange-300 dark:border-orange-700 hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-medium px-4 py-3 rounded-xl transition"
              >
                <Download size={16} />
                Baixar planilha modelo (XLSX)
              </button>

              <div>
                <input
                  ref={inputFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) processarArquivo(f)
                  }}
                />
                <button
                  onClick={() => inputFileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-3 rounded-xl transition"
                >
                  <Upload size={16} />
                  Selecionar planilha preenchida
                </button>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
                  Formatos aceitos: XLSX, XLS, CSV
                </p>
              </div>

              {/* Tabela explicativa das colunas */}
              <details className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4">
                <summary className="text-sm font-medium text-gray-700 dark:text-slate-300 cursor-pointer">
                  📋 Detalhes das colunas
                </summary>
                <div className="mt-3 text-xs space-y-2 text-gray-600 dark:text-slate-400">
                  <p><b>Tipo</b> (obrigatório): RECEITA ou DESPESA</p>
                  <p><b>Categoria</b> (opcional): Nome da categoria. Se não existir, será criada automaticamente.</p>
                  <p><b>Descricao</b> (obrigatório): O que é o registro</p>
                  <p><b>Valor</b> (obrigatório): Valor previsto. Aceita "1.234,56" ou "1234.56"</p>
                  <p><b>Data</b> (obrigatório): Data prevista. Formato DD/MM/YYYY</p>
                  <p><b>Status</b> (opcional): PAGO ou PENDENTE (padrão: PENDENTE)</p>
                  <p><b>Data Realizada</b> (opcional): Data real do pagamento (só preencher se Status=PAGO)</p>
                  <p><b>Valor Realizado</b> (opcional): Valor que realmente caiu (só preencher se diferente do previsto)</p>
                  <p><b>Canal</b> (opcional): Shopee, Mercado Livre, Direta, etc.</p>
                  <p><b>Referencia</b> (opcional): Nº do pedido, ID do repasse, etc.</p>
                  <p><b>Observacoes</b> (opcional): Notas adicionais</p>
                </div>
              </details>
            </div>
          )}

          {/* ── ETAPA PREVIEW ── */}
          {etapa === 'preview' && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  <b>{linhas.length}</b> linhas detectadas. Confira os primeiros itens antes de importar.
                </p>
                <button
                  onClick={() => { setLinhas([]); setEtapa('upload') }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white"
                >
                  ← Trocar arquivo
                </button>
              </div>
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-slate-800">
                      <tr>
                        {COLUNAS_MODELO.map(c => (
                          <th key={c} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-slate-300">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                      {linhas.slice(0, 30).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          {COLUNAS_MODELO.map(c => (
                            <td key={c} className="px-3 py-2 text-gray-700 dark:text-slate-300 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                              {String(row[c] ?? row[c.toLowerCase()] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {linhas.length > 30 && (
                  <p className="text-center text-xs text-gray-500 dark:text-slate-400 py-2 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                    ... + {linhas.length - 30} linhas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── ETAPA IMPORTANDO ── */}
          {etapa === 'importando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="text-orange-500 animate-spin" size={48} />
              <p className="text-gray-700 dark:text-slate-300 font-medium">Importando {linhas.length} registros...</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Isso pode levar alguns segundos</p>
            </div>
          )}

          {/* ── ETAPA CONCLUÍDO ── */}
          {etapa === 'concluido' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <CheckCircle className="text-green-500" size={56} />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Importação concluída!
              </h3>
              <div className="grid grid-cols-4 gap-3 w-full max-w-md">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{progresso.criados}</p>
                  <p className="text-xs text-green-700 dark:text-green-300">Importados</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{progresso.duplicados}</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Já existiam</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{progresso.erros}</p>
                  <p className="text-xs text-red-700 dark:text-red-300">Erros</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-700 dark:text-slate-300">{progresso.total}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Total</p>
                </div>
              </div>

              {resultadoDetalhes?.erros?.length > 0 && (
                <details className="w-full max-w-md mt-2">
                  <summary className="text-sm text-red-600 dark:text-red-400 cursor-pointer">
                    Ver erros ({resultadoDetalhes.erros.length})
                  </summary>
                  <ul className="mt-2 text-xs text-red-700 dark:text-red-300 space-y-1 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 max-h-32 overflow-auto">
                    {resultadoDetalhes.erros.map((e: any, i: number) => (
                      <li key={i}>Linha {e.linha}: {e.motivo}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-slate-800">
          {etapa === 'preview' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
                Cancelar
              </button>
              <button
                onClick={confirmarImportacao}
                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                <CheckCircle size={14} />
                Importar {linhas.length} registros
              </button>
            </>
          )}
          {etapa === 'concluido' && (
            <button
              onClick={onClose}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
