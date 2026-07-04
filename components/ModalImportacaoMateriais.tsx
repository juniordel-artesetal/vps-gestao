'use client'
// components/ModalImportacaoMateriais.tsx — importador de materiais + auto-vínculo com produtos.
// Mesmo visual/fluxo dos outros importadores. Parse do .xlsx client-side.

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle,
  ArrowRight, RefreshCw, Eye, Link2, AlertTriangle, Sparkles,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import MapeamentoColunas from '@/components/MapeamentoColunas'
import { CAMPOS_IMPORT, jaNoFormato, aplicarMapeamento } from '@/lib/mapeamentoImport'

interface LinhaRaw { [key: string]: any }
interface MatMapped { nome: string; descricao: string; preco: number | null; unidade: string; fornecedor: string; pecas: number }
interface Props { onClose: () => void; onImportado: () => void }
type Etapa = 'escolha' | 'mapear' | 'preview' | 'resultado'

const CAMPOS = CAMPOS_IMPORT.materiais
const COLUNAS = ['Nome', 'Descrição', 'Valor de repasse', 'Fornecedores', 'Peças que fazem uso']
const limpar = (v: any) => { const s = String(v ?? '').trim(); return s === '' || s === '-' ? '' : s }
const fmtR = (n: number | null) => n == null ? '—' : `R$ ${Number(n).toFixed(2).replace('.', ',')}`

function parsePreco(raw: any): { preco: number | null; unidade: string } {
  const s = String(raw ?? '').trim()
  if (!s || s === '-') return { preco: null, unidade: 'unidade' }
  const barra = s.indexOf('/')
  const valPart = (barra >= 0 ? s.slice(0, barra) : s).replace(/r\$/i, '').replace(/\s/g, '').trim()
  const uni = barra >= 0 ? s.slice(barra + 1).trim() : ''
  const norm = valPart.includes(',') ? valPart.replace(/\./g, '').replace(',', '.') : valPart
  const preco = parseFloat(norm)
  return { preco: isNaN(preco) ? null : preco, unidade: uni || 'unidade' }
}
function mapear(row: LinhaRaw): MatMapped {
  const { preco, unidade } = parsePreco(row['Valor de repasse'])
  const pecasRaw = limpar(row['Peças que fazem uso'])
  return {
    nome: limpar(row['Nome']), descricao: limpar(row['Descrição']),
    preco, unidade, fornecedor: limpar(row['Fornecedores']),
    pecas: pecasRaw ? pecasRaw.split(',').map(x => x.trim()).filter(Boolean).length : 0,
  }
}

export default function ModalImportacaoMateriais({ onClose, onImportado }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [linhasRaw, setLinhasRaw] = useState<LinhaRaw[]>([])
  const [mapped, setMapped] = useState<MatMapped[]>([])
  const [resumo, setResumo] = useState<any>(null) // verify: {materiaisNovos, materiaisPulados, vinculosPrevistos, produtosNaoEncontrados}
  const [nomeArq, setNomeArq] = useState('')
  const [importando, setImportando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [headersPlanilha, setHeadersPlanilha] = useState<string[]>([])
  const [linhasBrutas, setLinhasBrutas] = useState<LinhaRaw[]>([])
  const [mapeamento, setMapeamento] = useState<Record<string, string>>({})
  const [iaUsada, setIaUsada] = useState(false)
  const [mapLoading, setMapLoading] = useState(false)

  function baixarTemplate() {
    const exemplo = ['Alça Chique 3CM', 'Alça de fita para bolsas', 'R$ 11,43 / m²', 'Fornecedor X', 'Bolsa P, Bolsa G']
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS, exemplo])
    ws['!cols'] = COLUNAS.map(() => ({ wch: 26 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Materiais')
    XLSX.writeFile(wb, 'modelo_importacao_materiais.xlsx')
  }

  async function prosseguir(rows: LinhaRaw[]) {
    const raw = rows.filter(r => limpar(r['Nome']))
    setLinhasRaw(raw)
    setMapped(raw.map(mapear))
    setVerificando(true)
    try {
      const res = await fetch('/api/precificacao/materiais/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificar: true, linhas: raw }),
      })
      setResumo(await res.json())
    } catch { setResumo(null) } finally { setVerificando(false) }
    setEtapa('preview')
  }
  async function confirmarMapeamento() {
    await prosseguir(aplicarMapeamento(linhasBrutas, mapeamento, CAMPOS))
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
        const headers = Object.keys(json[0] || {})
        if (jaNoFormato(headers, CAMPOS)) { await prosseguir(json); return }
        setHeadersPlanilha(headers); setLinhasBrutas(json); setEtapa('mapear'); setMapLoading(true)
        try {
          const res = await fetch('/api/importacao/mapear-ia', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entidade: 'materiais', headers, amostra: json.slice(0, 15) }),
          })
          const d = await res.json()
          setMapeamento(d.mapeamento || {}); setIaUsada(Object.keys(d.mapeamento || {}).length > 0)
        } catch { setMapeamento({}); setIaUsada(false) } finally { setMapLoading(false) }
      } catch (err) { console.error(err); alert('Erro ao ler o arquivo. Verifique se é um .xlsx válido.') }
    }
    reader.readAsBinaryString(file)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (f) processarArquivo(f) }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processarArquivo(f) }

  async function importar() {
    setImportando(true)
    try {
      const res = await fetch('/api/precificacao/materiais/importar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ linhas: linhasRaw }),
      })
      const data = await res.json()
      setResultado(data)
      setEtapa('resultado')
      if (data.materiaisInseridos > 0 || data.vinculosCriados > 0) onImportado()
    } finally { setImportando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-orange-500" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Importar Materiais</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {etapa === 'escolha' && 'Materiais + vínculo automático com produtos'}
                {etapa === 'mapear' && 'Mapear colunas da planilha (formato diferente)'}
                {etapa === 'preview' && `${mapped.length} material(is) na planilha`}
                {etapa === 'resultado' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" /></button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── ESCOLHA ── */}
          {etapa === 'escolha' && (
            <div className="space-y-5">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">📋 Modelo de materiais</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Colunas: Nome, Descrição, Valor de repasse, Fornecedores, Peças que fazem uso. A coluna "Peças" vincula o material aos produtos automaticamente.</p>
                </div>
                <button onClick={baixarTemplate} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap flex-shrink-0">
                  <Download size={14} /> Baixar modelo
                </button>
              </div>
              <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${dragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10'}`}>
                <Upload size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Arraste o arquivo aqui ou <span className="text-orange-500">clique para selecionar</span></p>
                <p className="text-xs text-gray-400 mt-1">Suporte a .xlsx, .xls e .csv</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              </div>
            </div>
          )}

          {etapa === 'mapear' && (
            mapLoading
              ? <div className="flex items-center gap-2 text-sm text-gray-500 py-10 justify-center"><RefreshCw size={16} className="animate-spin" /> A IA está analisando as colunas da planilha…</div>
              : <MapeamentoColunas campos={CAMPOS} headers={headersPlanilha} valor={mapeamento} onChange={setMapeamento} iaUsada={iaUsada} />
          )}

          {/* ── PREVIEW ── */}
          {etapa === 'preview' && (
            <div className="space-y-4">
              {verificando && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-gray-400" /><p className="text-xs text-gray-500">Analisando materiais e vínculos com produtos...</p>
                </div>
              )}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <FileSpreadsheet size={16} className="text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{nomeArq}</p>
                  <p className="text-xs text-gray-400">
                    {mapped.length} material(is)
                    {resumo && ` · ${resumo.materiaisNovos} novo(s)${resumo.materiaisPulados ? `, ${resumo.materiaisPulados} já existe(m)` : ''}`}
                  </p>
                </div>
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setMapped([]); setResumo(null) }} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCw size={11} /> Trocar arquivo</button>
              </div>

              {/* Resumo do auto-vínculo */}
              {resumo && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Link2 size={14} className="text-blue-500" />
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{resumo.vinculosPrevistos} vínculo(s) material→produto serão criados (com quantidade "a definir")</p>
                  </div>
                  {resumo.produtosNaoEncontrados?.length > 0 && (
                    <div className="mt-2 flex items-start gap-2">
                      <AlertTriangle size={13} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                        {resumo.produtosNaoEncontrados.length} produto(s) citado(s) em "Peças" não existem no sistema (não serão vinculados): {resumo.produtosNaoEncontrados.slice(0, 8).join(', ')}{resumo.produtosNaoEncontrados.length > 8 ? '…' : ''}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Prévia dos materiais */}
              <div>
                <div className="flex items-center gap-2 mb-2"><Eye size={13} className="text-gray-400" /><p className="text-xs text-gray-500">Prévia dos primeiros {Math.min(mapped.length, 6)} materiais</p></div>
                <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">Nome</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">Descrição</th>
                      <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Preço</th>
                      <th className="px-3 py-2.5 text-center text-gray-500 font-semibold whitespace-nowrap">Un.</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">Fornecedor</th>
                      <th className="px-3 py-2.5 text-center text-gray-500 font-semibold whitespace-nowrap">Peças</th>
                    </tr></thead>
                    <tbody>
                      {mapped.slice(0, 6).map((m, i) => (
                        <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{m.nome}</td>
                          <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">{m.descricao || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtR(m.preco)}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{m.unidade}</td>
                          <td className="px-3 py-2 text-gray-500 truncate max-w-[120px]">{m.fornecedor || '—'}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{m.pecas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RESULTADO ── */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl p-5 text-center">
                  <CheckCircle size={28} className="text-green-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-green-600">{resultado.materiaisInseridos || 0}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">material(is)</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 text-center">
                  <Link2 size={28} className="text-blue-500 mx-auto mb-2" />
                  <p className="text-3xl font-bold text-blue-600">{resultado.vinculosCriados || 0}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">vínculo(s)</p>
                </div>
                <div className={`border rounded-2xl p-5 text-center ${resultado.produtosNaoEncontrados?.length ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                  <AlertTriangle size={28} className={`mx-auto mb-2 ${resultado.produtosNaoEncontrados?.length ? 'text-yellow-500' : 'text-gray-300'}`} />
                  <p className={`text-3xl font-bold ${resultado.produtosNaoEncontrados?.length ? 'text-yellow-600' : 'text-gray-400'}`}>{resultado.produtosNaoEncontrados?.length || 0}</p>
                  <p className="text-sm text-gray-500 mt-1">produto(s) não encontrado(s)</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">Os vínculos entram com quantidade "a definir" (0) — o custo do produto só muda quando você preencher a quantidade de cada material.</p>
              {resultado.produtosNaoEncontrados?.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Produtos citados que não existem (revise ou cadastre-os):</p>
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400">{resultado.produtosNaoEncontrados.join(', ')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
          {etapa === 'escolha' && (
            <button onClick={onClose} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">Fechar</button>
          )}
          {etapa === 'mapear' && (
            <>
              <button onClick={() => { setEtapa('escolha'); setLinhasBrutas([]); setHeadersPlanilha([]); setMapeamento({}) }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">Voltar</button>
              <button onClick={confirmarMapeamento} disabled={mapLoading || CAMPOS.some(c => c.obrig && !mapeamento[c.campo])}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                <ArrowRight size={14} /> Continuar
              </button>
            </>
          )}
          {etapa === 'preview' && (
            <>
              <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setMapped([]); setResumo(null) }} className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">Voltar</button>
              <button onClick={importar} disabled={importando || verificando || mapped.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {importando ? <><RefreshCw size={14} className="animate-spin" /> Importando...</> : <><ArrowRight size={14} /> Importar {resumo?.materiaisNovos ?? mapped.length} material(is)</>}
              </button>
            </>
          )}
          {etapa === 'resultado' && (
            <button onClick={onClose} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition">
              {(resultado?.materiaisInseridos > 0 || resultado?.vinculosCriados > 0) ? 'Ver materiais ✓' : 'Fechar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
