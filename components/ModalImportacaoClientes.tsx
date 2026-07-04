'use client'
// components/ModalImportacaoClientes.tsx
// Clone do ModalImportacao (pedidos) adaptado para clientes: mesmo visual, mesmos
// passos (escolha → preview mapeado → resultado), mesmos estilos e relatório de erros.

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle,
  AlertCircle, ArrowRight, RefreshCw, Eye, Users, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface LinhaRaw { [key: string]: any }
interface ClienteMapped {
  nome: string; email: string; telefone: string; cidade: string; uf: string
  ultimoPedido: string; statusUltimo: string
  totalPedidos: string; finalizados: string; emAberto: string
}

interface Props {
  onClose: () => void
  onImportado: () => void
}

type Etapa = 'escolha' | 'preview' | 'resultado'

const COLUNAS = ['Nome do cliente', 'Email', 'Telefone', 'Cidade', 'Último pedido', 'Status último pedido', 'Total de pedidos', 'Pedidos finalizados', 'Pedidos em aberto']

const limpar = (v: any) => { const s = String(v ?? '').trim(); return s === '' || s === '-' ? '' : s }

function mapearCliente(row: LinhaRaw): ClienteMapped {
  const cidadeRaw = limpar(row['Cidade'])
  let cidade = cidadeRaw, uf = ''
  const m = cidadeRaw.match(/^(.*?)[\s-]+([A-Za-z]{2})$/)
  if (m) { cidade = m[1].trim().replace(/[-\s]+$/, ''); uf = m[2].toUpperCase() }
  return {
    nome: limpar(row['Nome do cliente']),
    email: limpar(row['Email']),
    telefone: limpar(row['Telefone']),
    cidade, uf,
    ultimoPedido: limpar(row['Último pedido']),
    statusUltimo: limpar(row['Status último pedido']),
    totalPedidos: limpar(row['Total de pedidos']),
    finalizados: limpar(row['Pedidos finalizados']),
    emAberto: limpar(row['Pedidos em aberto']),
  }
}

export default function ModalImportacaoClientes({ onClose, onImportado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [linhasRaw, setLinhasRaw] = useState<LinhaRaw[]>([])
  const [mapped, setMapped] = useState<ClienteMapped[]>([])
  const [dupIdx, setDupIdx] = useState<Set<number>>(new Set())
  const [invIdx, setInvIdx] = useState<Set<number>>(new Set())
  const [nomeArq, setNomeArq] = useState('')
  const [importando, setImportando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function baixarTemplate() {
    const exemplo = ['Luana Thomazetto', 'luanathomazetto82@gmail.com', '(19) 996131569', 'Indaiatuba-SP', '12/01/2024', 'Finalizado', '1', '1', '0']
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS, exemplo])
    ws['!cols'] = COLUNAS.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx')
  }

  const processarArquivo = useCallback((file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) { alert('Formato não suportado. Use .xlsx, .xls ou .csv'); return }
    setNomeArq(file.name)
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json: LinhaRaw[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
        if (json.length === 0) { alert('Planilha vazia ou sem dados'); return }

        const map = json.map(mapearCliente).filter(c => c.nome || c.email || c.telefone)
        // Re-lê o raw alinhado ao filtro (para enviar à API na mesma ordem do preview)
        const rawFiltrado = json.filter(row => { const c = mapearCliente(row); return c.nome || c.email || c.telefone })

        setVerificando(true)
        let dup = new Set<number>(), inv = new Set<number>()
        try {
          const res = await fetch('/api/clientes/importar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verificar: true, linhas: rawFiltrado }),
          })
          const d = await res.json()
          dup = new Set<number>(d.duplicadosIdx || [])
          inv = new Set<number>(d.invalidosIdx || [])
        } catch (err) { console.warn('Erro ao verificar duplicatas:', err) }
        finally { setVerificando(false) }

        setLinhasRaw(rawFiltrado)
        setMapped(map)
        setDupIdx(dup)
        setInvIdx(inv)
        setEtapa('preview')
      } catch (err) {
        console.error(err)
        alert('Erro ao ler o arquivo. Verifique se é um .xlsx válido.')
      }
    }
    reader.readAsBinaryString(file)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (file) processarArquivo(file)
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]; if (file) processarArquivo(file)
  }

  async function importar() {
    setImportando(true)
    try {
      const res = await fetch('/api/clientes/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas: linhasRaw }),
      })
      const data = await res.json()
      setResultado(data)
      setEtapa('resultado')
      if (data.criados > 0) onImportado()
    } finally { setImportando(false) }
  }

  const totalDuplicados = dupIdx.size
  const totalInvalidos = invIdx.size
  const novosIdx = mapped.map((_, i) => i).filter(i => !dupIdx.has(i) && !invIdx.has(i))
  const totalAImportar = novosIdx.length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-orange-500" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Importar Clientes</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {etapa === 'escolha' && 'Baixe o modelo, preencha e faça upload'}
                {etapa === 'preview' && `${mapped.length} cliente${mapped.length !== 1 ? 's' : ''} na planilha`}
                {etapa === 'resultado' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" /></button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ETAPA 1: ESCOLHA ── */}
          {etapa === 'escolha' && (
            <div className="space-y-5">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">📋 Usar o modelo de clientes</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Baixe o modelo, preencha e faça upload. O nome do cliente é obrigatório.</p>
                </div>
                <button onClick={baixarTemplate}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap flex-shrink-0">
                  <Download size={14} /> Baixar modelo
                </button>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
                  dragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                }`}>
                <Upload size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Arraste o arquivo aqui ou <span className="text-orange-500">clique para selecionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Suporte a .xlsx, .xls e .csv · Máximo 2000 clientes</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </div>
            </div>
          )}

          {/* ── ETAPA 2: PREVIEW MAPEADO ── */}
          {etapa === 'preview' && (
            <div className="space-y-4">
              {verificando && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-gray-400" />
                  <p className="text-xs text-gray-500">Verificando duplicatas no sistema...</p>
                </div>
              )}

              {/* Info arquivo */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <FileSpreadsheet size={16} className="text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{nomeArq}</p>
                  <p className="text-xs text-gray-400">
                    {mapped.length} linha{mapped.length !== 1 ? 's' : ''} → <strong>{totalAImportar} novo{totalAImportar !== 1 ? 's' : ''}</strong> para importar
                  </p>
                </div>
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setMapped([]); setDupIdx(new Set()); setInvIdx(new Set()) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RefreshCw size={11} /> Trocar arquivo
                </button>
              </div>

              {/* Duplicados */}
              {totalDuplicados > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-yellow-600" />
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
                      {totalDuplicados} cliente{totalDuplicados !== 1 ? 's já existem' : ' já existe'} no sistema e {totalDuplicados !== 1 ? 'serão ignorados' : 'será ignorado'}
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Detectados por e-mail ou por nome + telefone iguais.</p>
                </div>
              )}

              {/* Prévia novos */}
              {totalAImportar > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={13} className="text-gray-400" />
                    <p className="text-xs text-gray-500">
                      Prévia dos primeiros {Math.min(totalAImportar, 5)} clientes novos
                      {totalAImportar > 5 ? ` (${totalAImportar - 5} mais não exibidos)` : ''}
                    </p>
                  </div>
                  <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Nome</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">E-mail</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Telefone</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Cidade/UF</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Últ. pedido</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Status</th>
                          <th className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Total</th>
                          <th className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Final.</th>
                          <th className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Aberto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {novosIdx.slice(0, 5).map(i => {
                          const c = mapped[i]
                          return (
                            <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.nome}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.email || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.telefone || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.cidade ? `${c.cidade}${c.uf ? ' / ' + c.uf : ''}` : '—'}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.ultimoPedido || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{c.statusUltimo || '—'}</td>
                              <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.totalPedidos || '0'}</td>
                              <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.finalizados || '0'}</td>
                              <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{c.emAberto || '0'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {totalInvalidos > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {totalInvalidos} linha{totalInvalidos !== 1 ? 's serão ignoradas' : ' será ignorada'} (sem nome do cliente).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── ETAPA 3: RESULTADO ── */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl p-5 text-center">
                  <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-green-600">{resultado.criados || 0}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">criado{(resultado.criados || 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 text-center">
                  <Users size={28} className="text-blue-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-blue-600">{resultado.duplicados || 0}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">já existia{(resultado.duplicados || 0) !== 1 ? 'm' : ''}</p>
                </div>
                <div className={`border rounded-2xl p-5 text-center ${resultado.erros > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                  <AlertCircle size={28} className={`mx-auto mb-2 ${resultado.erros > 0 ? 'text-red-400' : 'text-gray-300'}`} />
                  <p className={`text-3xl font-bold ${resultado.erros > 0 ? 'text-red-500' : 'text-gray-400'}`}>{resultado.erros || 0}</p>
                  <p className={`text-sm mt-1 ${resultado.erros > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>ignorado{(resultado.erros || 0) !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {resultado.erros > 0 && resultado.detalhes?.erros?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Linhas ignoradas</p>
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-red-100 dark:border-red-800">
                        <th className="px-3 py-2 text-left text-red-500 font-semibold">Linha</th>
                        <th className="px-3 py-2 text-left text-red-500 font-semibold">Motivo</th>
                      </tr></thead>
                      <tbody>
                        {resultado.detalhes.erros.map((e: any, i: number) => (
                          <tr key={i} className="border-b border-red-50 dark:border-red-900/20">
                            <td className="px-3 py-2 text-red-600 font-mono">#{e.linha}</td>
                            <td className="px-3 py-2 text-red-600">{e.erro}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          {etapa === 'escolha' && (
            <button onClick={onClose} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
              Fechar
            </button>
          )}
          {etapa === 'preview' && (
            <>
              <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setMapped([]); setDupIdx(new Set()); setInvIdx(new Set()) }}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Voltar
              </button>
              <button onClick={importar} disabled={importando || verificando || totalAImportar === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {importando
                  ? <><RefreshCw size={14} className="animate-spin" /> Importando...</>
                  : <><ArrowRight size={14} /> Importar {totalAImportar} cliente{totalAImportar !== 1 ? 's' : ''}</>}
              </button>
            </>
          )}
          {etapa === 'resultado' && (
            <>
              {resultado?.erros > 0 && (
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setResultado(null); setMapped([]); setDupIdx(new Set()); setInvIdx(new Set()) }}
                  className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Importar novamente
                </button>
              )}
              <button onClick={onClose}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {(resultado?.criados > 0) ? 'Ver clientes ✓' : 'Fechar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
