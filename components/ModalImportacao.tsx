'use client'
// components/ModalImportacao.tsx

import { useState, useRef, useCallback } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle,
  AlertCircle, ArrowRight, RefreshCw, Eye, Package, AlertTriangle
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface LinhaRaw    { [key: string]: any }
interface LinhaMapped {
  numero: string; nomeCliente: string; destinatario: string
  idCliente: string; canal: string; produto: string
  quantidade: number; valor: string; prioridade: string
  dataEntrada: string; dataEnvio: string
  endereco: string; observacoes: string
  _extras: Record<string, string>
}

// Grupo de linhas com mesmo ID (cenário 1)
interface Grupo {
  numero: string
  destinatario: string
  canal: string
  produtos: Array<{ nome: string; quantidade: number; valor: string; linhaOriginal: number; qtdEncontrada: boolean; qtdManual?: number }>
  dataEnvio: string
  prioridade: string
  jaExiste: boolean // cenário 2
  acao: 'pular' | 'adicionar' | 'substituir' // cenário 2
  acaoGrupo: 'agrupar' | 'separar' // cenário 1 — múltiplos produtos
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
  const nomeVariacao = String(
    row['Nome da variação'] ?? row['Nome da Variação'] ?? row['Variação'] ?? row['Variacao'] ?? ''
  ).trim()

  // Extrair quantidade embutida na variação: "Amarelo_completo,10" → qtd=10, variação="Amarelo_completo"
  let qtdDaVariacao: number | null = null
  let variacaoLimpa = nomeVariacao
  if (nomeVariacao) {
    const matchVar = nomeVariacao.match(/,(\d+)$/)
    if (matchVar) {
      const n = parseInt(matchVar[1])
      if (n > 0) { qtdDaVariacao = n; variacaoLimpa = nomeVariacao.slice(0, -matchVar[0].length).trim() }
    }
  }
  const produto = variacaoLimpa ? `${nomeProduto} · ${variacaoLimpa}` : nomeProduto

  return {
    numero:       String(row['ID do pedido'] || '').trim(),
    nomeCliente:  String(row['Nome de usuário (comprador)'] || '').trim(),
    destinatario: String(row['Nome do destinatário'] || '').trim(),
    idCliente:    String(row['Nome de usuário (comprador)'] || '').trim(),
    canal:        'Shopee',
    produto,
    // Variação embutida tem prioridade (qtd real de peças); coluna "Quantidade" costuma ser 1
    quantidade: qtdDaVariacao !== null
      ? qtdDaVariacao
      : parseInt(String(
          row['Quantidade'] ?? row['Quantidade do Produto'] ??
          row['Quantidade do produto'] ?? row['Qtd'] ?? row['Qtde'] ??
          row['quantity'] ?? '1'
        )) || 1,
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
  const universais = ['ID Pedido','Nome da Cliente','Destinatário','ID User / CPF','Canal','Produto','Quantidade','Valor (R$)','Prioridade','Data Entrada','Data Envio','Endereço','Observações']

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

// Agrupa linhas com o mesmo numero (cenário 1)
// Extrai quantidade do final do nome — Shopee usa "NomeProduto,10"
// Retorna encontrada=true quando a qtd veio do sufixo do nome
function extrairQtdDoNome(nome: string, qtdCampo: number): { nome: string; quantidade: number; encontrada: boolean } {
  // Caso 1: "NomeProduto,10" — vírgula+número direto no final
  const match1 = nome.match(/,(\d+)$/)
  if (match1) {
    const qtdNome = parseInt(match1[1])
    if (qtdNome > 0) return { nome: nome.slice(0, -match1[0].length).trim(), quantidade: qtdNome, encontrada: true }
  }
  // Caso 2: "NomeProduto (Variação,10)" — número dentro dos parênteses finais
  const match2 = nome.match(/\(([^()]*),(\d+)\)$/)
  if (match2) {
    const qtdNome = parseInt(match2[2])
    if (qtdNome > 0) {
      const variacaoLimpa = match2[1].trim()
      const nomeBase = nome.slice(0, nome.lastIndexOf('(')).trim()
      const nomeLimpo = variacaoLimpa ? `${nomeBase} (${variacaoLimpa})` : nomeBase
      return { nome: nomeLimpo, quantidade: qtdNome, encontrada: true }
    }
  }
  // Se qtdCampo > 1 veio do campo Quantidade da planilha — também é encontrada
  if (qtdCampo > 1) return { nome, quantidade: qtdCampo, encontrada: true }
  return { nome, quantidade: 1, encontrada: false }
}

function agruparLinhas(linhas: LinhaMapped[]): Grupo[] {
  const map = new Map<string, Grupo>()
  linhas.forEach((l, idx) => {
    if (!l.numero) return
    const linhaOriginal = idx + 2
    const { nome, quantidade, encontrada } = extrairQtdDoNome(l.produto, l.quantidade)
    if (map.has(l.numero)) {
      const g = map.get(l.numero)!
      g.produtos.push({ nome, quantidade, valor: l.valor, linhaOriginal, qtdEncontrada: encontrada })
    } else {
      map.set(l.numero, {
        numero: l.numero,
        destinatario: l.destinatario,
        canal: l.canal,
        produtos: [{ nome, quantidade, valor: l.valor, linhaOriginal, qtdEncontrada: encontrada }],
        dataEnvio: l.dataEnvio,
        prioridade: l.prioridade,
        jaExiste: false,
        acao: 'pular',
        acaoGrupo: 'agrupar',
      })
    }
  })
  return Array.from(map.values())
}

export default function ModalImportacao({ onClose, onImportado }: Props) {
  const [etapa,      setEtapa]      = useState<Etapa>('escolha')
  const [linhasRaw,  setLinhasRaw]  = useState<LinhaRaw[]>([])
  const [linhasMapped, setLinhasMapped] = useState<LinhaMapped[]>([])
  const [extrasDetectados, setExtrasDetectados] = useState<string[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [formato,    setFormato]    = useState<Formato>('vps')
  const [nomeArq,    setNomeArq]    = useState('')
  const [importando, setImportando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [resultado,  setResultado]  = useState<any>(null)
  const [dragOver,        setDragOver]        = useState(false)
  const [gerandoTemplate, setGerandoTemplate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function baixarTemplate() {
    setGerandoTemplate(true)
    try {
      const res = await fetch('/api/importacao/template')
      const { workspaceNome, campos } = await res.json()

      const wsData: any[][] = []
      wsData.push(campos.map((c: any) => c.nome))
      wsData.push(campos.map((c: any) => c.exemplo))
      for (let i = 0; i < 100; i++) wsData.push(new Array(campos.length).fill(''))

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws['!cols'] = campos.map((c: any) => ({ wch: c.largura }))

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
    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary', cellDates: true })
        const wsName = wb.SheetNames[0]
        const ws     = wb.Sheets[wsName]

        const json: LinhaRaw[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

        if (json.length === 0) { alert('Planilha vazia ou sem dados'); return }

        const headers = Object.keys(json[0])
        const fmt     = detectarFormato(headers)

        const mapped = json
          .map(row => fmt === 'shopee' ? mapearLinhaShopee(row) : mapearLinhaVPS(row))
          .filter(row => row.numero || row.destinatario || row.produto)

        const extrasSet = new Set<string>()
        mapped.forEach(row => Object.keys(row._extras || {}).forEach(k => extrasSet.add(k)))

        // Agrupa por numero (cenário 1)
        const gruposCalc = agruparLinhas(mapped)

        // Verifica no banco quais já existem (cenário 2)
        setVerificando(true)
        try {
          const numeros = gruposCalc.map(g => g.numero).filter(Boolean)
          const resVer = await fetch('/api/importacao/pedidos/verificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numeros }),
          })
          const { jaExistentes } = await resVer.json()
          const setExistentes = new Set<string>(jaExistentes || [])
          gruposCalc.forEach(g => {
            if (setExistentes.has(g.numero)) {
              g.jaExiste = true
              g.acao = 'pular' // default seguro
            }
          })
        } catch (err) {
          console.warn('Erro ao verificar duplicatas:', err)
        } finally {
          setVerificando(false)
        }

        setLinhasRaw(json)
        setLinhasMapped(mapped)
        setExtrasDetectados(Array.from(extrasSet))
        setFormato(fmt)
        setGrupos(gruposCalc)
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

  function alterarAcao(numero: string, acao: 'pular' | 'adicionar' | 'substituir') {
    setGrupos(prev => prev.map(g => g.numero === numero ? { ...g, acao } : g))
  }

  function alterarAcaoGrupo(numero: string, acaoGrupo: 'agrupar' | 'separar') {
    setGrupos(prev => prev.map(g => g.numero === numero ? { ...g, acaoGrupo } : g))
  }

  function setQtdManual(numero: string, linhaOriginal: number, qtd: number) {
    setGrupos(prev => prev.map(g => g.numero !== numero ? g : {
      ...g,
      produtos: g.produtos.map(p =>
        p.linhaOriginal === linhaOriginal ? { ...p, qtdManual: qtd, quantidade: qtd } : p
      )
    }))
  }

  function aplicarAcaoGrupoEmMassa(acaoGrupo: 'agrupar' | 'separar') {
    setGrupos(prev => prev.map(g => g.produtos.length > 1 && !g.jaExiste ? { ...g, acaoGrupo } : g))
  }

  function aplicarAcaoEmMassa(acao: 'pular' | 'adicionar' | 'substituir') {
    setGrupos(prev => prev.map(g => g.jaExiste ? { ...g, acao } : g))
  }

  async function importar() {
    setImportando(true)
    try {
      // Monta mapa de ações apenas dos duplicados
      const acoes: Record<string, string> = {}
      grupos.forEach(g => {
        if (g.jaExiste) acoes[g.numero] = g.acao
      })

      // Monta mapa de ações para grupos (múltiplos produtos mesmo ID)
      const agruparAcoes: Record<string, string> = {}
      // Mapa de quantidades manuais por número de pedido e índice do produto
      const qtdsManual: Record<string, number[]> = {}
      grupos.forEach(g => {
        if (!g.jaExiste && g.produtos.length > 1) {
          agruparAcoes[g.numero] = g.acaoGrupo
          const qtds = g.produtos.map(p => p.quantidade)
          if (g.produtos.some(p => p.qtdManual !== undefined)) {
            qtdsManual[g.numero] = qtds
          }
        }
      })

      const res = await fetch('/api/importacao/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linhas: linhasRaw, formato, acoes, agruparAcoes, qtdsManual }),
      })
      const data = await res.json()
      setResultado(data)
      setEtapa('resultado')
      if (data.criados > 0 || data.atualizados > 0) onImportado()
    } finally { setImportando(false) }
  }

  // Divisão dos grupos
  const gruposAgrupados  = grupos.filter(g => !g.jaExiste && g.produtos.length > 1)
  const gruposDuplicados = grupos.filter(g => g.jaExiste)
  const gruposNovos      = grupos.filter(g => !g.jaExiste && g.produtos.length === 1)

  const totalAImportar = grupos.filter(g => !g.jaExiste || g.acao !== 'pular').length
  const invalidos = linhasMapped.filter(r => !r.numero || !r.destinatario || !r.produto).length

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
                {etapa === 'preview'   && `${grupos.length} pedido${grupos.length !== 1 ? 's' : ''} · Formato: ${formato === 'shopee' ? '🛍️ Shopee' : '📋 Template VPS'}`}
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
              {verificando && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin text-gray-400"/>
                  <p className="text-xs text-gray-500">Verificando duplicatas no sistema...</p>
                </div>
              )}

              {/* Info arquivo */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                <FileSpreadsheet size={16} className="text-green-500"/>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{nomeArq}</p>
                  <p className="text-xs text-gray-400">
                    {linhasMapped.length} linha{linhasMapped.length !== 1 ? 's' : ''} → <strong>{grupos.length} pedido{grupos.length !== 1 ? 's único' : ' único'}{grupos.length !== 1 ? 's' : ''}</strong>
                    {' · '}Formato: <strong className="text-orange-500">{formato === 'shopee' ? '🛍️ Shopee' : '📋 Template VPS'}</strong>
                  </p>
                </div>
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setLinhasMapped([]); setGrupos([]) }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <RefreshCw size={11}/> Trocar arquivo
                </button>
              </div>

              {/* ── SEÇÃO 1: Pedidos com múltiplos produtos ── */}
              {gruposAgrupados.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Package size={14} className="text-blue-500"/>
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      {gruposAgrupados.length} pedido{gruposAgrupados.length !== 1 ? 's têm' : ' tem'} múltiplos produtos — escolha como importar
                    </p>
                  </div>
                  {/* Ações em massa */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-blue-600 dark:text-blue-400">Aplicar a todos:</span>
                    <button onClick={() => aplicarAcaoGrupoEmMassa('agrupar')}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 font-medium">
                      Agrupar todos
                    </button>
                    <button onClick={() => aplicarAcaoGrupoEmMassa('separar')}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 text-gray-700 dark:text-gray-300 font-medium">
                      Separar todos
                    </button>
                  </div>
                  <div className="space-y-3">
                    {gruposAgrupados.map(g => (
                      <div key={g.numero} className="bg-white dark:bg-gray-900 rounded-xl px-3 py-3 text-xs border border-blue-100 dark:border-blue-900">
                        {/* Cabeçalho */}
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-mono text-gray-600 dark:text-gray-400">#{g.numero}</span>
                            <span className="ml-2 text-gray-500 dark:text-gray-400">{g.destinatario}</span>
                          </div>
                          <span className="text-blue-500 font-semibold">{g.produtos.length} produtos</span>
                        </div>
                        {/* Lista de produtos com quantidade */}
                        <div className="mb-3 space-y-2 pl-1 border-l-2 border-blue-100 dark:border-blue-900">
                          {g.produtos.map((p, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-gray-600 dark:text-gray-300 truncate text-[11px]" title={p.nome}>{p.nome}</span>
                                {p.qtdEncontrada ? (
                                  <span className={`flex-shrink-0 font-bold text-[11px] px-2 py-0.5 rounded-full ${
                                    p.quantidade > 1
                                      ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400'
                                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                  }`}>
                                    {p.quantidade}x
                                  </span>
                                ) : (
                                  <span className="flex-shrink-0 text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">⚠ não localizada</span>
                                )}
                              </div>
                              {/* Input manual quando quantidade não encontrada */}
                              {!p.qtdEncontrada && (
                                <div className="mt-1 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg px-2 py-1.5">
                                  <span className="text-[10px] text-yellow-700 dark:text-yellow-400 flex-1">
                                    Quantidade não localizada. Inserir manualmente:
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="Qtd"
                                    defaultValue={p.qtdManual || ''}
                                    onChange={e => {
                                      const v = parseInt(e.target.value)
                                      if (v > 0) setQtdManual(g.numero, p.linhaOriginal, v)
                                    }}
                                    className="w-16 text-center text-xs border border-yellow-300 dark:border-yellow-700 rounded-md px-1 py-0.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
                                  />
                                  <span className="text-[10px] text-yellow-600 dark:text-yellow-400">peças</span>
                                </div>
                              )}
                            </div>
                          ))}
                          {/* Totalizador */}
                          <div className="flex justify-between pt-1 border-t border-blue-100 dark:border-blue-900 text-[10px] text-gray-400">
                            <span>Total de peças</span>
                            <span className="font-semibold text-gray-600 dark:text-gray-300">
                              {g.produtos.reduce((s, p) => s + (p.quantidade || 0), 0)} peças
                            </span>
                          </div>
                        </div>
                        {/* Preview do resultado */}
                        <div className="mb-2 text-[10px] text-gray-400 dark:text-gray-500 italic">
                          {g.acaoGrupo === 'agrupar'
                            ? `→ 1 pedido: ${g.produtos.map(p => `${p.nome}${p.quantidade > 1 ? ` (${p.quantidade}x)` : ''}`).join(' + ')}`
                            : `→ ${g.produtos.length} pedidos separados: #${g.numero}-p1, #${g.numero}-p2${g.produtos.length > 2 ? `...` : ''}`
                          }
                        </div>
                        {/* Seletor de ação */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => alterarAcaoGrupo(g.numero, 'agrupar')}
                            className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                              g.acaoGrupo === 'agrupar'
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-300'
                            }`}>
                            📦 Agrupar em 1 pedido
                          </button>
                          <button
                            onClick={() => alterarAcaoGrupo(g.numero, 'separar')}
                            className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                              g.acaoGrupo === 'separar'
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300'
                            }`}>
                            ✂️ Criar pedidos separados
                          </button>
                        </div>
                      </div>
                    ))}
                    {gruposAgrupados.length > 5 && (
                      <p className="text-xs text-blue-500 text-center">+ {gruposAgrupados.length - 5} pedidos com múltiplos produtos</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── SEÇÃO 2: Duplicados no sistema ── */}
              {gruposDuplicados.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-yellow-600"/>
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
                      {gruposDuplicados.length} pedido{gruposDuplicados.length !== 1 ? 's já existem' : ' já existe'} no sistema
                    </p>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                    Escolha o que fazer com cada um. Por padrão, serão ignorados.
                  </p>

                  {/* Ações em massa */}
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-yellow-700 dark:text-yellow-400">Aplicar a todos:</span>
                    <button onClick={() => aplicarAcaoEmMassa('pular')}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-gray-700 dark:text-gray-300">
                      Pular todos
                    </button>
                    <button onClick={() => aplicarAcaoEmMassa('adicionar')}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-gray-700 dark:text-gray-300">
                      Adicionar produtos
                    </button>
                    <button onClick={() => aplicarAcaoEmMassa('substituir')}
                      className="px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-gray-700 dark:text-gray-300">
                      Substituir todos
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {gruposDuplicados.map(g => (
                      <div key={g.numero} className="bg-white dark:bg-gray-900 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-gray-600 dark:text-gray-400">#{g.numero}</p>
                          <p className="text-gray-500 truncate">{g.destinatario} — {g.produtos.map(p => p.nome).join(' + ')}</p>
                        </div>
                        <select value={g.acao} onChange={e => alterarAcao(g.numero, e.target.value as any)}
                          className="text-xs rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          <option value="pular">Pular</option>
                          <option value="adicionar">Adicionar produto(s)</option>
                          <option value="substituir">Substituir</option>
                        </select>
                      </div>
                    ))}
                  </div>
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

              {/* ── SEÇÃO 3: Novos pedidos (preview) ── */}
              {gruposNovos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={13} className="text-gray-400"/>
                    <p className="text-xs text-gray-500">
                      Prévia dos primeiros {Math.min(gruposNovos.length, 5)} pedidos novos
                      {gruposNovos.length > 5 ? ` (${gruposNovos.length - 5} mais não exibidos)` : ''}
                    </p>
                  </div>
                  <div className="overflow-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">ID Pedido</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Destinatário</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Produto(s)</th>
                          <th className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Canal</th>
                          <th className="px-3 py-2.5 text-left text-gray-500 dark:text-gray-400 font-semibold whitespace-nowrap">Dt. Envio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gruposNovos.slice(0, 5).map(g => (
                          <tr key={g.numero} className="border-b border-gray-50 dark:border-gray-800">
                            <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{g.numero}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{g.destinatario}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-sm truncate" title={g.produtos.map(p => p.nome).join(' + ')}>
                              {g.produtos.map(p => p.nome).join(' + ')}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{g.canal || '—'}</td>
                            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{g.dataEnvio || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {invalidos > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-xl px-4 py-2.5">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle size={11}/> {invalidos} linha{invalidos !== 1 ? 's serão ignoradas' : ' será ignorada'} (ID, destinatário ou produto vazios).
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
                  <CheckCircle size={28} className="text-green-500 mx-auto mb-2"/>
                  <p className="text-3xl font-bold text-green-600">{resultado.criados || 0}</p>
                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">criado{(resultado.criados || 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 text-center">
                  <Package size={28} className="text-blue-500 mx-auto mb-2"/>
                  <p className="text-3xl font-bold text-blue-600">{resultado.atualizados || 0}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">atualizado{(resultado.atualizados || 0) !== 1 ? 's' : ''}</p>
                </div>
                <div className={`border rounded-2xl p-5 text-center ${resultado.erros > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                  <AlertCircle size={28} className={`mx-auto mb-2 ${resultado.erros > 0 ? 'text-red-400' : 'text-gray-300'}`}/>
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
              <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setLinhasMapped([]); setGrupos([]) }}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Voltar
              </button>
              <button onClick={importar} disabled={importando || verificando || totalAImportar === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {importando
                  ? <><RefreshCw size={14} className="animate-spin"/> Importando...</>
                  : <><ArrowRight size={14}/> Importar {totalAImportar} pedido{totalAImportar !== 1 ? 's' : ''}</>}
              </button>
            </>
          )}
          {etapa === 'resultado' && (
            <>
              {resultado?.erros > 0 && (
                <button onClick={() => { setEtapa('escolha'); setLinhasRaw([]); setResultado(null); setGrupos([]) }}
                  className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  Importar novamente
                </button>
              )}
              <button onClick={onClose}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {(resultado?.criados > 0 || resultado?.atualizados > 0) ? 'Ver pedidos ✓' : 'Fechar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
