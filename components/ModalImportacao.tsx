'use client'
// components/ModalImportacao.tsx

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle,
  AlertCircle, ArrowRight, RefreshCw, Eye
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface LinhaRaw    { [key: string]: any }
interface LinhaMapped {
  numero: string; nomeCliente: string; destinatario: string
  idCliente: string; canal: string; produto: string
  quantidade: number; valor: string; prioridade: string
  dataEntrada: string; dataEnvio: string
  endereco: string; observacoes: string
  _extras: Record<string, string> // campos personalizados detectados
}

interface Props {
  onClose: () => void
  onImportado: () => void
}

type Etapa = 'escolha' | 'preview' | 'resultado'
type Formato = 'vps' | 'shopee'

// ── Mapeamento Shopee → VPS ───────────────────────────────────────────────
function mapearLinhaShopee(row: LinhaRaw): LinhaMapped {
  const nomeProduto  = String(row['Nome do Produto'] || '').trim()
  const nomeVariacao = String(row['Nome da variação'] || '').trim()
  const produto      = nomeVariacao ? `${nomeProduto} · ${nomeVariacao}` : nomeProduto

  return {
    numero:       String(row['ID do pedido'] || '').trim(),
    nomeCliente:  String(row['Nome de usuário (comprador)'] || '').trim(),
    destinatario: String(row['Nome do destinatário'] || '').trim(),
    idCliente:    String(row['Nome de usuário (comprador)'] || '').trim(),
    canal:        'Shopee',
    produto,
    quantidade:   parseInt(String(row['Quantidade'] || '1')) || 1,
    valor:        String(row['Preço acordado'] || ''),
    prioridade:   'NORMAL',
    dataEntrada:  formatarDataPreview(row['Data de criação do pedido']),
    dataEnvio:    formatarDataPreview(row['Data prevista de envio']),
    endereco:     String(row['Endereço de entrega'] || '').trim(),
    observacoes:  String(row['Observação do comprador'] || '').trim(),
    _extras:      {},
  }
}

// ── Mapeamento Template VPS → LinhaMapped ────────────────────────────────
function mapearLinhaVPS(row: LinhaRaw): LinhaMapped {
  // Campos universais fixos
  const universais = ['ID Pedido','Nome da Cliente','Destinatário','ID User / CPF','Canal','Produto','Quantidade','Valor (R$)','Prioridade','Data Entrada','Data Envio','Endereço','Observações']

  // Campos extras = tudo que não é universal
  const extras: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    if (!universais.includes(k) && v !== '' && v !== null && v !== undefined) {
      extras[k] = String(v)
    }
  }

  return {
    numero:       String(row['ID Pedido'] || '').trim(),
    nomeCliente:  String(row['Nome da Cliente'] || '').trim(),
    destinatario: String(row['Destinatário'] || '').trim(),
    idCliente:    String(row['ID User / CPF'] || '').trim(),
    canal:        String(row['Canal'] || '').trim(),
    produto:      String(row['Produto'] || '').trim(),
    quantidade:   parseInt(String(row['Quantidade'] || '1')) || 1,
    valor:        String(row['Valor (R$)'] || ''),
    prioridade:   String(row['Prioridade'] || 'NORMAL').trim(),
    dataEntrada:  String(row['Data Entrada'] || '').trim(),
    dataEnvio:    String(row['Data Envio'] || '').trim(),
    endereco:     String(row['Endereço'] || '').trim(),
    observacoes:  String(row['Observações'] || '').trim(),
    _extras:      extras,
  }
}

function formatarDataPreview(val: any): string {
  if (!val) return ''
  try {
    const s = String(val).trim()
    if (s.includes('T') || s.match(/^\d{4}-\d{2}-\d{2}/)) {
      const d = new Date(s)
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    return s
  } catch { return String(val) }
}

function detectarFormato(headers: string[]): Formato {
  return headers.includes('ID do pedido') || headers.includes('Nome do destinatário')
    ? 'shopee' : 'vps'
}

// Colunas do preview mapeado — sempre mostrar no padrão VPS
const COLS_PREVIEW: { key: keyof LinhaMapped | string; label: string; width: string }[] = [
  { key: 'numero',       label: 'ID Pedido',    width: 'min-w-32' },
  { key: 'destinatario', label: 'Destinatário', width: 'min-w-28' },
  { key: 'produto',      label: 'Produto',      width: 'min-w-48' },
  { key: 'quantidade',   label: 'Qtd',          width: 'min-w-10' },
  { key: 'canal',        label: 'Canal',         width: 'min-w-16' },
  { key: 'valor',        label: 'Valor',         width: 'min-w-16' },
  { key: 'dataEnvio',    label: 'Dt. Envio',    width: 'min-w-20' },
  { key: 'prioridade',   label: 'Prioridade',   width: 'min-w-20' },
]

export default function ModalImportacao({ onClose, onImportado }: Props) {
  const [etapa,      setEtapa]      = useState<Etapa>('escolha')
  const [linhasRaw,  setLinhasRaw]  = useState<LinhaRaw[]>([])
  const [linhasMapped, setLinhasMapped] = useState<LinhaMapped[]>([])
  const [extrasDetectados, setExtrasDetectados] = useState<string[]>([])
  const [formato,    setFormato]    = useState<Formato>('vps')
  const [nomeArq,    setNomeArq]    = useState('')
  const [importando, setImportando] = useState(false)
  const [resultado,  setResultado]  = useState<any>(null)
  const [dragOver,        setDragOver]        = useState(false)
  const [gerandoTemplate, setGerandoTemplate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function baixarTemplate() {
    setGerandoTemplate(true)
    try {
      const res = await fetch('/api/importacao/template')
      const { workspaceNome, campos } = await res.json()

      // Gerar xlsx client-side com os campos do workspace
      const wsData: any[][] = []

      // Linha 1: Título
      wsData.push([`🛍️  MODELO DE IMPORTAÇÃO — ${workspaceNome}`])
      // Linha 2: Instrução
      wsData.push(['Preencha a partir da linha 5. Não altere os cabeçalhos. Laranja = obrigatório. Azul = campo personalizado. Linha 5 é exemplo.'])
      // Linha 3: vazia
      wsData.push([])
      // Linha 4: Cabeçalhos
      wsData.push(campos.map((c: any) => c.nome))
      // Linha 5: Exemplo
      wsData.push(campos.map((c: any) => c.exemplo))
      // Linhas 6-105: vazias
      for (let i = 0; i < 100; i++) wsData.push(new Array(campos.length).fill(''))

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = campos.map((c: any) => ({ wch: c.largura }))
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: campos.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: campos.length - 1 } },
      ]

      // Aba de referência
      const refData: any[][] = [
        ['CAMPO', 'OBRIGATÓRIO', 'INSTRUÇÃO / VALORES ACEITOS', 'TIPO'],
        ...campos.map((c: any) => [c.nome, c.obrig ? 'Sim' : 'Não', c.instrucao, c.isCustom ? 'Personalizado' : 'Universal']),
      ]
      const wsRef = XLSX.utils.aoa_to_sheet(refData)
      wsRef['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 55 }, { wch: 16 }]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Importar Pedidos')
      XLSX.utils.book_append_sheet(wb, wsRef, 'Referência de Campos')

      const nomeArq = `modelo_importacao_${workspaceNome.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`
      XLSX.writeFile(wb, nomeArq)
    } catch (err) {
      console.error(err)
      alert('Erro ao gerar o template')
    } finally {
      setGerandoTemplate(false)
    }
  }

  const processarArquivo = useCallback((file: File) => {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      alert('Formato não suportado. Use .xlsx, .xls ou .csv'); return
    }
    setNomeArq(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary', cellDates: true })
        const wsName = wb.SheetNames[0]
        const ws     = wb.Sheets[wsName]

        // Lê todas as linhas como array bruto para detectar onde está o cabeçalho real.
        // Necessário porque o template VPS tem título e instruções antes dos cabeçalhos (linha 4).
        const rawArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as string[][]

        // Procura a linha que contém cabeçalhos conhecidos (VPS ou Shopee)
        const VPS_ANCHOR    = ['ID Pedido', 'Nome da Cliente', 'Destinatário']
        const SHOPEE_ANCHOR = ['ID do pedido', 'Nome do destinatário']

        const headerRowIdx = rawArr.findIndex(row =>
          VPS_ANCHOR.some(h => row.includes(h)) || SHOPEE_ANCHOR.some(h => row.includes(h))
        )

        let json: LinhaRaw[]
        if (headerRowIdx > 0) {
          // Template VPS com linhas de título/instrução antes do cabeçalho
          const hdrs = rawArr[headerRowIdx] as string[]
          json = rawArr
            .slice(headerRowIdx + 1)
            .filter(row => row.some(cell => String(cell).trim() !== ''))
            .map(row => {
              const obj: LinhaRaw = {}
              hdrs.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''})
              return obj
            })
        } else {
          // Shopee ou template com cabeçalho na linha 1 (comportamento padrão)
          json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as LinhaRaw[]
        }

        if (json.length === 0) { alert('Planilha vazia ou sem dados'); return }

        const headers = Object.keys(json[0])
        const fmt     = detectarFormato(headers)

        // Mapear todas as linhas para o formato VPS
        const mapped = json
          .map(row => fmt === 'shopee' ? mapearLinhaShopee(row) : mapearLinhaVPS(row))
          .filter(row => row.numero || row.destinatario || row.produto) // ignora linhas completamente vazias

        // Detectar campos extras presentes nas linhas
        const extrasSet = new Set<string>()
        mapped.forEach(row => Object.keys(row._extras || {}).forEach(k => extrasSet.add(k)))

        setLinhasRaw(json)
        setLinhasMapped(mapped)
        setExtrasDetectados(Array.from(extrasSet))
        setFormato(fmt)
        setEtapa('preview')
      } catch (err) {
        console.error(err)
        alert('Erro ao ler o arquivo. Verifique se é um .xlsx válido.')
      }
    }
    reader.readAsBinaryString(file)
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processarArquivo(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processarArquivo(file)
  }

  async function importar() {
    setImportando(true)
    try {
      const res = await fetch('/api/importacao/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas: linhasRaw, formato }),
      })
      const data = await res.json()
      setResultado(data)
      setEtapa('resultado')
      if (data.criados > 0) onImportado()
    } finally { setImportando(false) }
  }

  const preview = linhasMapped.slice(0, 5)
  const colsExtras = extrasDetectados.slice(0, 3)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-orange-500"/>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">Importar Pedidos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {etapa === 'escolha'   && 'Template VPS ou exportação direta da Shopee'}
                {etapa === 'preview'   && `${linhasMapped.length} pedidos detectados · Formato: ${formato === 'shopee' ? '🛍️ Shopee' : '📋 Template VPS'}`}
                {etapa === 'resultado' && 'Importação concluída'}
              </p>
            </div>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"/></button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── ETAPA 1: ESCOLHA ── */}
          {etapa === 'escolha' && (
            <div className="space-y-5">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-2xl p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">📋 Usar o template VPS Gestão</p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Baixe o modelo, preencha e faça upload. Campos obrigatórios em laranja.</p>
                </div>
                <button onClick={baixarTemplate} disabled={gerandoTemplate}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition whitespace-nowrap flex-shrink-0 disabled:opacity-60">
                  {gerandoTemplate
                    ? <><RefreshCw size={14} className="animate-spin"/> Gerando...</>
                    : <><Download size={14}/> Baixar modelo</>}
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-3">
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <span className="text-base">🛍️</span>
                  <span><strong>Também aceita exportação direta da Shopee!</strong> Acesse Shopee Seller → Meus Pedidos → Exportar → "A Enviar" e faça upload abaixo.</span>
                </p>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
                  dragOver ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10'
                }`}>
                <Upload size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3"/>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Arraste o arquivo aqui ou <span className="text-orange-500">clique para selecionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Suporte a .xlsx, .xls e .csv · Máximo 500 pedidos</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden"/>
              </div>
            </div>
          )}

          {/* ── ETAPA 2: PREVIEW MAPEADO ── */}
          {etapa === 'preview' && (
            <div className="space-y-4">
              {/* Info arquivo */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <FileSpreadsheet size={16} className="text-green-500"/>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{nomeArq}</p>
                  <p className="text-xs text-gray-400">
                    {linhasMapped.length} pedido{linhasMapped.length !== 1 ? 's' : ''} · Formato: <strong className="text-orange-500">{formato === 'shopee' ? '🛍️ Shopee (convertido automaticamente)' : '📋 Template VPS'}</strong>
                  </p>
                </div>
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setLinhasMapped([]) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RefreshCw size={11}/> Trocar arquivo
                </button>
              </div>

              {/* Badge de conversão Shopee */}
              {formato === 'shopee' && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <CheckCircle size={14} className="text-green-500"/>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Campos da Shopee convertidos para o padrão VPS. O preview abaixo mostra como os pedidos ficarão no sistema.
                  </p>
                </div>
              )}

              {/* Campos extras detectados */}
              {extrasDetectados.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <strong>Campos personalizados detectados:</strong> {extrasDetectados.join(', ')} — serão importados como campos extras do pedido.
                  </p>
                </div>
              )}

              {/* Preview tabela — campos VPS */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Eye size={13} className="text-gray-400"/>
                  <p className="text-xs text-gray-500">
                    Prévia das primeiras {Math.min(linhasMapped.length, 5)} linhas
                    {linhasMapped.length > 5 ? ` (${linhasMapped.length - 5} mais não exibidas)` : ''}
                  </p>
                </div>
                <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                        {COLS_PREVIEW.map(c => (
                          <th key={c.key} className={`px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap ${c.width}`}>{c.label}</th>
                        ))}
                        {colsExtras.map(e => (
                          <th key={e} className="px-3 py-2.5 text-left text-blue-400 font-semibold whitespace-nowrap min-w-24">
                            {e} <span className="text-blue-300 font-normal">(extra)</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className={`border-b border-gray-50 dark:border-gray-800 ${!row.numero || !row.destinatario || !row.produto ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                          {COLS_PREVIEW.map(c => {
                            const val = String((row as any)[c.key] || '')
                            const vazio = !val || val === '0'
                            const obrig = ['numero','destinatario','produto'].includes(c.key as string)
                            return (
                              <td key={c.key} className={`px-3 py-2 max-w-48 truncate ${vazio && obrig ? 'text-red-400 italic' : 'text-gray-700 dark:text-gray-300'}`} title={val}>
                                {vazio && obrig ? '⚠️ vazio' : (val.length > 35 ? val.slice(0,35) + '…' : val || '—')}
                              </td>
                            )
                          })}
                          {colsExtras.map(e => (
                            <td key={e} className="px-3 py-2 text-blue-600 dark:text-blue-400">
                              {String(row._extras?.[e] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {linhasMapped.some(r => !r.numero || !r.destinatario || !r.produto) && (
                  <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                    <AlertCircle size={11}/> Linhas em vermelho estão incompletas e serão ignoradas na importação.
                  </p>
                )}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800 rounded-xl px-4 py-3">
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  ⚠️ O sistema importa os pedidos válidos e lista os erros. Linhas com ID Pedido, Destinatário ou Produto vazios serão ignoradas.
                </p>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: RESULTADO ── */}
          {etapa === 'resultado' && resultado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-2xl p-5 text-center">
                  <CheckCircle size={28} className="text-green-500 mx-auto mb-2"/>
                  <p className="text-3xl font-bold text-green-600">{resultado.criados}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">pedido{resultado.criados !== 1 ? 's importados' : ' importado'}</p>
                </div>
                <div className={`border rounded-2xl p-5 text-center ${resultado.erros > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                  <AlertCircle size={28} className={`mx-auto mb-2 ${resultado.erros > 0 ? 'text-red-400' : 'text-gray-300'}`}/>
                  <p className={`text-3xl font-bold ${resultado.erros > 0 ? 'text-red-500' : 'text-gray-400'}`}>{resultado.erros}</p>
                  <p className={`text-sm mt-1 ${resultado.erros > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>erro{resultado.erros !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {resultado.erros > 0 && resultado.detalhes?.erros?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Linhas com erro</p>
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

              {resultado.criados > 0 && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800 rounded-xl px-4 py-3">
                  <p className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle size={14}/>
                    {resultado.criados} pedido{resultado.criados !== 1 ? 's foram adicionados' : ' foi adicionado'} à lista com sucesso!
                  </p>
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
              <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setLinhasMapped([]) }}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Voltar
              </button>
              <button onClick={importar} disabled={importando || linhasMapped.length === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {importando
                  ? <><RefreshCw size={14} className="animate-spin"/> Importando...</>
                  : <><ArrowRight size={14}/> Importar {linhasMapped.length} pedido{linhasMapped.length !== 1 ? 's' : ''}</>}
              </button>
            </>
          )}
          {etapa === 'resultado' && (
            <>
              {resultado?.erros > 0 && (
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setResultado(null) }}
                  className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Importar novamente
                </button>
              )}
              <button onClick={onClose}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {resultado?.criados > 0 ? 'Ver pedidos ✓' : 'Fechar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
