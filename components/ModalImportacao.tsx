'use client'
// components/ModalImportacao.tsx

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle,
  AlertCircle, ArrowRight, RefreshCw, Eye, Package, AlertTriangle, Users
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { normNome } from '@/lib/normNome'
import { indexarVariacoes } from '@/lib/matchVariacao'
import { construirFiscalShopee } from '@/app/api/importacao/pedidos/_lib/shopeeFiscal'

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

type Etapa = 'escolha' | 'preview' | 'clientes' | 'auditoria' | 'resultado'
type Formato = 'vps' | 'shopee'
type DecisaoCliente = { nome: string; acao: 'vincular' | 'criar' | 'naovincular'; clienteId: string | null; candidatos: { id: string; nome: string }[] }

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

// ── Estatísticas AGREGADAS da importação (Shopee), deduplicadas POR PEDIDO ──────
// Reutiliza o MESMO parser fiscal (valores por pedido pegos 1x; itens somam) para
// os totais baterem com a camada fiscal. Só devolve AGREGADOS — nenhum dado pessoal.
function calcularEstatisticas(aoa: any[][], grupos: Grupo[]) {
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const fiscais = construirFiscalShopee(aoa)
  const ps = Array.from(fiscais.values())
  const pedidos = ps.length
  const itens = ps.reduce((s, p) => s + p.itens.length, 0)
  const multiItem = ps.filter(p => p.itens.length > 1).length
  const produtos = new Set<string>()
  ps.forEach(p => p.itens.forEach(it => { if (it.produto) produtos.add(it.produto.trim().toLowerCase()) }))

  const bruto = r2(ps.reduce((s, p) => s + (p.valorTotal || 0), 0))
  const frete = r2(ps.reduce((s, p) => s + (p.freteComprador || 0), 0))
  const descontos = r2(ps.reduce((s, p) => s + (p.descontoVendedor || 0) + (p.descontoShopee || 0) + (p.cupomVendedor || 0) + (p.cupomShopee || 0), 0))
  const taxas = r2(ps.reduce((s, p) => s + (p.comissaoLiquida || 0) + (p.servicoLiquida || 0) + (p.taxaTransacao || 0) + (p.freteReverso || 0), 0))
  const liquido = r2(ps.reduce((s, p) => s + (p.liquidoEstimado || 0), 0))
  const pctTaxas = bruto > 0 ? Math.round((taxas / bruto) * 1000) / 10 : 0
  const ticketMedio = pedidos > 0 ? r2(bruto / pedidos) : 0

  const datas = ps.map(p => p.dataCriacaoExterna).filter(Boolean).map(d => String(d).slice(0, 10)).sort()
  const periodoInicio = datas[0] || null
  const periodoFim = datas[datas.length - 1] || null

  const isCancel = (p: any) => /cancel|devolu|reembols/i.test(String(p.statusExterno || '') + ' ' + String(p.statusDevolucao || ''))
  const cancelamentos = ps.filter(isCancel).length
  const itensDevolvidos = ps.reduce((s, p) => s + p.itens.filter((it: any) => (it.qtdDevolvida || 0) > 0).length, 0)
  const semCpf = ps.filter(p => !p.cpfPlain).length
  const liquidoNegativo = ps.filter(p => (p.liquidoEstimado || 0) <= 0).length
  const taxaAlta = ps.filter(p => (p.valorTotal || 0) > 0 && ((p.comissaoLiquida || 0) + (p.servicoLiquida || 0) + (p.taxaTransacao || 0) + (p.freteReverso || 0)) / p.valorTotal > 0.25).length

  const existentes = grupos.filter(g => g.jaExiste).length
  const novos = grupos.filter(g => !g.jaExiste).length
  const linhas = Array.isArray(aoa) ? Math.max(0, aoa.length - 1) : itens

  const alertas: string[] = []
  if (linhas !== pedidos) alertas.push(`A planilha tem ${linhas} linhas, mas ${pedidos} pedidos — os valores foram somados POR PEDIDO (não por linha), senão o faturamento dobraria.`)
  if (liquidoNegativo > 0) alertas.push(`${liquidoNegativo} pedido(s) com líquido estimado ≤ 0 (as taxas passaram do valor da venda).`)
  if (pctTaxas > 25) alertas.push(`As taxas somam ${pctTaxas}% do bruto — acima de 25%.`)
  else if (taxaAlta > 0) alertas.push(`${taxaAlta} pedido(s) com taxa acima de 25% do próprio valor.`)
  if (cancelamentos > 0) alertas.push(`${cancelamentos} pedido(s) com status de cancelamento/devolução.`)
  if (semCpf > 0) alertas.push(`${semCpf} pedido(s) sem CPF (pode faltar para a futura Nota Fiscal).`)
  if (existentes > 0) alertas.push(`${existentes} pedido(s) já existem no sistema e serão ATUALIZADOS (reimportação).`)

  return {
    linhas, pedidos, multiItem, itens, produtosDistintos: produtos.size,
    bruto, freteComprador: frete, descontos, taxas, pctTaxas, liquidoEstimado: liquido, ticketMedio,
    periodoInicio, periodoFim, cancelamentos, itensDevolvidos, semCpf, novos, existentes, liquidoNegativo, alertas,
  }
}

export default function ModalImportacao({ onClose, onImportado }: Props) {
  const [etapa,      setEtapa]      = useState<Etapa>('escolha')
  const [linhasRaw,  setLinhasRaw]  = useState<LinhaRaw[]>([])
  // AOA (array-de-arrays: linha 0 = cabeçalho) — enviado p/ a camada fiscal Shopee ler por posição
  const [linhasAOA,  setLinhasAOA]  = useState<any[][]>([])
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
  // Auditoria por IA (ADITIVO) — relatório executivo antes de confirmar
  const [auditStats, setAuditStats] = useState<any>(null)
  const [auditIa, setAuditIa] = useState<{ resumo: string | null; loading: boolean }>({ resumo: null, loading: false })

  // ── Vínculo de cliente (ADITIVO — só se moduloClientes ativo) ──────────
  const [moduloClientes, setModuloClientes] = useState(false)
  const [clienteDecisoes, setClienteDecisoes] = useState<Record<string, DecisaoCliente>>({})
  const [matchLoading, setMatchLoading] = useState(false)
  useEffect(() => {
    fetch('/api/config/geral').then(r => r.ok ? r.json() : {}).then((d: any) => setModuloClientes(!!d.moduloClientes)).catch(() => {})
  }, [])

  // ── Casamento com a Precificação (AMBOS os ramos: VPS e Shopee editado) —
  //    reconhece o produto e mostra no preview que as PEÇAS (kit) serão calculadas ──
  const [variacoesPrec, setVariacoesPrec] = useState<any[]>([])
  useEffect(() => {
    fetch('/api/precificacao/variacoes')
      .then(r => r.ok ? r.json() : [])
      .then(d => setVariacoesPrec(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])
  // De-para persistente (nome normalizado → variação) já salvo, e vínculos manuais desta sessão
  const [deParaSet, setDeParaSet] = useState<Set<string>>(new Set())
  const [vinculoManual, setVinculoManual] = useState<Record<string, string>>({})
  useEffect(() => {
    fetch('/api/importacao/depara')
      .then(r => r.ok ? r.json() : { itens: [] })
      .then(d => setDeParaSet(new Set((d.itens || []).map((x: any) => x.nomeNormalizado))))
      .catch(() => {})
  }, [])

  const idxPrec = useMemo(() => indexarVariacoes(variacoesPrec.map((v: any) => ({ id: v.id, produtoNome: v.produtoNome, nome: v.nome, isKit: v.isKit, qtdKit: v.qtdKit }))), [variacoesPrec])

  const matchResumo = useMemo(() => {
    if (variacoesPrec.length === 0 || grupos.length === 0) return null
    let reconhecidos = 0, kits = 0, nao = 0, ambiguo = 0
    for (const g of grupos) {
      if (g.jaExiste && g.acao === 'pular') continue
      for (const p of g.produtos) {
        const nn = normNome(p.nome)
        if (deParaSet.has(nn) || vinculoManual[p.nome]) { reconhecidos++; continue }
        const r = idxPrec.resolver(p.nome)
        if (r.status === 'match') { reconhecidos++; if (r.isKit && r.qtdKit > 1) kits++ }
        else if (r.status === 'ambiguo') ambiguo++
        else nao++
      }
    }
    return { reconhecidos, kits, nao, ambiguo }
  }, [variacoesPrec, grupos, idxPrec, deParaSet, vinculoManual])

  // Nomes distintos NÃO reconhecidos (nem por nome, nem no de-para) → vínculo assistido
  const naoVinculados = useMemo(() => {
    if (variacoesPrec.length === 0 || grupos.length === 0) return [] as { key: string; nome: string }[]
    const vistos = new Map<string, string>()
    for (const g of grupos) {
      if (g.jaExiste && g.acao === 'pular') continue
      for (const p of g.produtos) {
        const nn = normNome(p.nome)
        if (vistos.has(nn) || deParaSet.has(nn)) continue
        if (idxPrec.resolver(p.nome).status === 'match') continue
        vistos.set(nn, p.nome)
      }
    }
    return Array.from(vistos.entries()).map(([key, nome]) => ({ key, nome }))
  }, [variacoesPrec, grupos, idxPrec, deParaSet])

  async function vincularProduto(nome: string, variacaoId: string) {
    setVinculoManual(m => { const n = { ...m }; if (variacaoId) n[nome] = variacaoId; else delete n[nome]; return n })
    if (variacaoId) {
      const canal = formato === 'shopee' ? 'shopee' : 'vps'
      try { await fetch('/api/importacao/depara', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal, nome, variacaoId }) }) } catch {}
    }
  }

  // ── Criar produto copiando um "irmão" (troca só o tema) ──
  const [criarAberto, setCriarAberto] = useState<Record<string, boolean>>({})
  const [sugestoesBase, setSugestoesBase] = useState<Record<string, { id: string; nome: string; score: number }[]>>({})
  const [baseEscolhida, setBaseEscolhida] = useState<Record<string, string>>({})
  const [criando, setCriando] = useState<Record<string, boolean>>({})
  const [criadoInfo, setCriadoInfo] = useState<Record<string, string>>({})

  async function abrirCriar(nome: string) {
    setCriarAberto(s => ({ ...s, [nome]: !s[nome] }))
    if (sugestoesBase[nome]) return
    try {
      const d = await (await fetch(`/api/precificacao/produtos/sugerir-base?nome=${encodeURIComponent(nome)}`)).json()
      const sug = Array.isArray(d.sugestoes) ? d.sugestoes : []
      setSugestoesBase(s => ({ ...s, [nome]: sug }))
      if (sug[0]) setBaseEscolhida(b => ({ ...b, [nome]: sug[0].id }))
    } catch {}
  }

  async function criarPorCopia(nome: string) {
    const baseId = baseEscolhida[nome]
    if (!baseId) { alert('Escolha um produto base para copiar.'); return }
    setCriando(c => ({ ...c, [nome]: true }))
    try {
      const canal = formato === 'shopee' ? 'shopee' : 'vps'
      const r = await fetch('/api/importacao/criar-por-copia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseId, nome, canal }) })
      const d = await r.json()
      if (!r.ok || !d.variacaoId) { alert(d?.error || 'Não consegui criar o produto.'); return }
      setVinculoManual(m => ({ ...m, [nome]: d.variacaoId }))
      setDeParaSet(s => new Set(s).add(normNome(nome)))
      setCriadoInfo(c => ({ ...c, [nome]: d.jaExistia ? 'Já existia — vinculado.' : 'Criado e vinculado ✓' }))
      setCriarAberto(s => ({ ...s, [nome]: false }))
    } finally { setCriando(c => ({ ...c, [nome]: false })) }
  }

  // Monta o passo de vínculo: coleta compradores únicos e busca candidatos
  async function irParaVinculo() {
    setMatchLoading(true)
    try {
      const uniq = new Map<string, string>() // normNome → nome original
      for (const g of grupos) {
        const nome = (g.destinatario || '').trim()
        if (!nome) continue
        const k = normNome(nome)
        if (!uniq.has(k)) uniq.set(k, nome)
      }
      const compradores = Array.from(uniq.values()).map(nome => ({ nome }))
      const res = await fetch('/api/clientes/match', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compradores }),
      })
      const { resultado } = await res.json()
      const dec: Record<string, DecisaoCliente> = {}
      for (const r of (resultado || [])) {
        dec[normNome(r.nome)] = { nome: r.nome, acao: r.sugestao, clienteId: r.clienteId, candidatos: r.candidatos || [] }
      }
      setClienteDecisoes(dec)
      setEtapa('clientes')
    } catch (err) {
      console.warn('Erro no match de clientes:', err)
      // Se o match falhar, segue para a auditoria (não bloqueia)
      irParaAuditoria()
    } finally { setMatchLoading(false) }
  }

  // ── Passo de AUDITORIA (ADITIVO) — relatório executivo antes do commit ──────
  // Só para Shopee (usa o AOA fiscal). VPS segue direto para a importação.
  async function irParaAuditoria() {
    if (formato !== 'shopee' || !Array.isArray(linhasAOA) || linhasAOA.length < 2) { importar(); return }
    let est: any
    try { est = calcularEstatisticas(linhasAOA, grupos) } catch { importar(); return }
    setAuditStats(est)
    setAuditIa({ resumo: null, loading: true })
    setEtapa('auditoria')
    try {
      const r = await fetch('/api/importacao/auditoria-ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estatisticas: est }),
      })
      const d = await r.json().catch(() => ({}))
      setAuditIa({ resumo: d?.resumo || null, loading: false })
    } catch {
      setAuditIa({ resumo: null, loading: false }) // fallback: mostra só os números
    }
  }

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
        // AOA preserva colunas duplicadas por posição (ex.: "Desconto do vendedor" ×2) — usado só na camada fiscal
        const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })

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
        setLinhasAOA(aoa)
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
        body: JSON.stringify({ linhas: linhasRaw, linhasAOA, formato, acoes, agruparAcoes, qtdsManual,
          decisoesCliente: moduloClientes ? clienteDecisoes : undefined,
          mapeamentoProduto: Object.keys(vinculoManual).length ? vinculoManual : undefined }),
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
                {etapa === 'clientes'  && 'Vincular compradores a clientes'}
                {etapa === 'auditoria' && 'Relatório da importação — revise antes de confirmar'}
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
                  <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">📋 Usar o template SOA</p>
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

              {/* Casamento com a Precificação (só VPS) — peças de kit calculadas automaticamente */}
              {matchResumo && matchResumo.reconhecidos > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3 text-xs">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                    <Package size={13} /> Vínculo com a Precificação
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                    <strong>{matchResumo.reconhecidos}</strong> produto{matchResumo.reconhecidos !== 1 ? 's' : ''} reconhecido{matchResumo.reconhecidos !== 1 ? 's' : ''} na Precificação
                    {matchResumo.kits > 0 && <> — em <strong>{matchResumo.kits}</strong> deles as <strong>peças do kit</strong> serão calculadas automaticamente (qtd × peças por kit)</>}.
                    {matchResumo.nao > 0 && <span className="text-amber-600 dark:text-amber-400"> {' '}{matchResumo.nao} não reconhecido{matchResumo.nao !== 1 ? 's' : ''} — ficam com a quantidade da planilha (nada é inventado).</span>}
                    {matchResumo.ambiguo > 0 && <span className="text-amber-600 dark:text-amber-400"> {' '}{matchResumo.ambiguo} com nome ambíguo — não vinculado{matchResumo.ambiguo !== 1 ? 's' : ''}.</span>}
                  </p>
              </div>
              )}

              {/* ── Vínculo assistido de produto (nomes não reconhecidos) ── */}
              {variacoesPrec.length > 0 && naoVinculados.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Package size={13} /> Vincular produtos à Precificação ({naoVinculados.length})
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 mb-2">
                    Estes nomes não foram reconhecidos. Ligue cada um ao seu produto cadastrado — fica <strong>salvo</strong>, e as próximas importações desse nome vinculam sozinhas (e já calculam as peças do kit).
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {naoVinculados.map(n => (
                      <div key={n.key} className="border-b border-amber-100/60 dark:border-amber-800/40 pb-1.5 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-600 dark:text-gray-300 flex-1 truncate" title={n.nome}>{n.nome}</span>
                          <select value={vinculoManual[n.nome] || ''} onChange={e => vincularProduto(n.nome, e.target.value)}
                            className="text-[11px] border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 max-w-[55%] focus:outline-none focus:ring-2 focus:ring-orange-400">
                            <option value="">— não vincular —</option>
                            {variacoesPrec.map((v: any) => (
                              <option key={v.id} value={v.id}>{v.nome ? `${v.produtoNome} — ${v.nome}` : v.produtoNome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="pl-1 mt-0.5">
                          {criadoInfo[n.nome] ? (
                            <span className="text-[10px] text-emerald-600">{criadoInfo[n.nome]}</span>
                          ) : (
                            <button type="button" onClick={() => abrirCriar(n.nome)} className="text-[10px] text-orange-600 hover:underline">
                              {criarAberto[n.nome] ? '− fechar' : '✚ criar copiando um produto igual (troca só o tema)'}
                            </button>
                          )}
                        </div>
                        {criarAberto[n.nome] && !criadoInfo[n.nome] && (
                          <div className="mt-1 pl-1 flex items-center gap-1.5 flex-wrap">
                            {(sugestoesBase[n.nome] || []).length === 0 ? (
                              <span className="text-[10px] text-gray-400">Nenhum produto parecido encontrado para copiar.</span>
                            ) : (
                              <>
                                <span className="text-[10px] text-gray-500">Copiar de:</span>
                                <select value={baseEscolhida[n.nome] || ''} onChange={e => setBaseEscolhida(b => ({ ...b, [n.nome]: e.target.value }))}
                                  className="text-[10px] border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 bg-white dark:bg-gray-800 max-w-[55%]">
                                  {(sugestoesBase[n.nome] || []).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.score}%)</option>)}
                                </select>
                                <button type="button" onClick={() => criarPorCopia(n.nome)} disabled={criando[n.nome]}
                                  className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white rounded px-2 py-0.5 font-semibold disabled:opacity-50">
                                  {criando[n.nome] ? 'Criando...' : 'Criar e vincular'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {Object.keys(vinculoManual).length > 0 && (
                    <p className="text-[11px] text-emerald-600 mt-2">✓ {Object.keys(vinculoManual).length} vinculado(s) — serão gravados nesta importação.</p>
                  )}
                </div>
              )}

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

          {/* ── ETAPA 2b: VÍNCULO DE CLIENTE (ADITIVO — só se moduloClientes) ── */}
          {etapa === 'clientes' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3">
                <p className="text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <Users size={14} className="flex-shrink-0 mt-0.5"/>
                  <span>Revise o vínculo de cada comprador. Nada é vinculado ou criado sem sua confirmação — nomes iguais/ambíguos vêm como "Não vincular".</span>
                </p>
              </div>
              <div className="space-y-2 max-h-[52vh] overflow-y-auto">
                {Object.entries(clienteDecisoes).map(([k, d]) => (
                  <div key={k} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{d.nome}</p>
                      <p className="text-[11px] text-gray-400">
                        {d.candidatos.length === 0 ? 'Nenhum cliente com esse nome' : `${d.candidatos.length} cliente(s) com nome parecido`}
                      </p>
                    </div>
                    <select
                      value={d.acao === 'vincular' ? `vincular:${d.clienteId}` : d.acao}
                      onChange={e => {
                        const v = e.target.value
                        setClienteDecisoes(prev => {
                          const nd = { ...prev[k] }
                          if (v.startsWith('vincular:')) { nd.acao = 'vincular'; nd.clienteId = v.slice('vincular:'.length) }
                          else if (v === 'criar')        { nd.acao = 'criar'; nd.clienteId = null }
                          else                           { nd.acao = 'naovincular'; nd.clienteId = null }
                          return { ...prev, [k]: nd }
                        })
                      }}
                      className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 max-w-[240px] flex-shrink-0">
                      {d.candidatos.map(c => <option key={c.id} value={`vincular:${c.id}`}>Vincular a {c.nome}</option>)}
                      <option value="criar">➕ Criar novo cliente</option>
                      <option value="naovincular">Não vincular</option>
                    </select>
                  </div>
                ))}
              </div>
              {(() => {
                const vals = Object.values(clienteDecisoes)
                const v = vals.filter(x => x.acao === 'vincular').length
                const c = vals.filter(x => x.acao === 'criar').length
                const n = vals.filter(x => x.acao === 'naovincular').length
                return <p className="text-xs text-gray-400">{v} a vincular · {c} a criar · {n} sem vínculo</p>
              })()}
            </div>
          )}

          {/* ── ETAPA 2c: AUDITORIA (relatório executivo antes do commit) ── */}
          {etapa === 'auditoria' && auditStats && (
            <div className="space-y-4">
              {/* Resumo da IA (ou fallback) */}
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1.5 flex items-center gap-1.5">
                  <FileSpreadsheet size={13} /> Resumo executivo <span className="font-normal text-orange-500/70">(valores estimados)</span>
                </p>
                {auditIa.loading ? (
                  <p className="text-sm text-gray-500 flex items-center gap-2"><RefreshCw size={13} className="animate-spin" /> Gerando resumo com IA...</p>
                ) : auditIa.resumo ? (
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">{auditIa.resumo}</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Resumo automático indisponível agora — confira os números abaixo. A importação segue normalmente.</p>
                )}
              </div>

              {/* Números principais */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { l: 'Linhas → Pedidos', v: `${auditStats.linhas} → ${auditStats.pedidos}` },
                  { l: 'Multi-item', v: auditStats.multiItem },
                  { l: 'Itens', v: auditStats.itens },
                  { l: 'Produtos distintos', v: auditStats.produtosDistintos },
                  { l: 'Bruto (venda)', v: `R$ ${auditStats.bruto.toFixed(2)}` },
                  { l: 'Taxas', v: `R$ ${auditStats.taxas.toFixed(2)} (${auditStats.pctTaxas}%)`, cls: 'text-red-500' },
                  { l: 'Líquido estimado', v: `R$ ${auditStats.liquidoEstimado.toFixed(2)}`, cls: 'text-green-600 dark:text-green-400' },
                  { l: 'Ticket médio', v: `R$ ${auditStats.ticketMedio.toFixed(2)}` },
                ].map((c, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">{c.l}</p>
                    <p className={`text-sm font-bold ${c.cls || 'text-gray-800 dark:text-white'}`}>{c.v}</p>
                  </div>
                ))}
              </div>

              {/* Novos x existentes + período */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                <span><strong className="text-green-600 dark:text-green-400">{auditStats.novos}</strong> novos</span>
                <span><strong className="text-blue-600 dark:text-blue-400">{auditStats.existentes}</strong> serão atualizados</span>
                {auditStats.periodoInicio && <span>Período: <strong>{auditStats.periodoInicio}</strong> a <strong>{auditStats.periodoFim}</strong></span>}
                {auditStats.cancelamentos > 0 && <span className="text-amber-600">{auditStats.cancelamentos} cancelamento(s)/devolução</span>}
              </div>

              {/* Alertas */}
              {auditStats.alertas.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-2 flex items-center gap-1.5"><AlertTriangle size={13} /> Alertas ({auditStats.alertas.length})</p>
                  <ul className="space-y-1">
                    {auditStats.alertas.map((a: string, i: number) => (
                      <li key={i} className="text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-1.5"><span className="text-yellow-500 mt-0.5">•</span> {a}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-gray-400 text-center">Os totais são somados <strong>por pedido</strong> (deduplicados). Nenhum dado pessoal foi enviado à IA — só números agregados.</p>
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

              {/* Vínculo com a Precificação — reconhecidos e pendências */}
              {resultado.precificacao && resultado.precificacao.reconhecidos > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl px-4 py-3 text-xs">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-1">
                    <Package size={13} /> Vínculo com a Precificação
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    <strong>{resultado.precificacao.reconhecidos}</strong> item{resultado.precificacao.reconhecidos !== 1 ? 's' : ''} vinculado{resultado.precificacao.reconhecidos !== 1 ? 's' : ''} — peças de kit calculadas e passam a contar no painel de <strong>Resultado das vendas</strong>.
                  </p>
                  {resultado.precificacao.naoReconhecidos?.length > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 mt-1">
                      Não reconhecidos ({resultado.precificacao.naoReconhecidos.length}): {resultado.precificacao.naoReconhecidos.slice(0, 5).join(', ')}{resultado.precificacao.naoReconhecidos.length > 5 ? '…' : ''}
                    </p>
                  )}
                  {resultado.precificacao.ambiguos?.length > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 mt-1">
                      Nome ambíguo ({resultado.precificacao.ambiguos.length}): {resultado.precificacao.ambiguos.slice(0, 5).join(', ')}{resultado.precificacao.ambiguos.length > 5 ? '…' : ''}
                    </p>
                  )}
                </div>
              )}

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
              <button onClick={moduloClientes ? irParaVinculo : irParaAuditoria} disabled={importando || verificando || matchLoading || totalAImportar === 0}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {(importando || matchLoading)
                  ? <><RefreshCw size={14} className="animate-spin"/> {matchLoading ? 'Buscando clientes...' : 'Importando...'}</>
                  : moduloClientes
                    ? <><Users size={14}/> Vincular clientes ({totalAImportar})</>
                    : <><ArrowRight size={14}/> Importar {totalAImportar} pedido{totalAImportar !== 1 ? 's' : ''}</>}
              </button>
            </>
          )}
          {etapa === 'clientes' && (
            <>
              <button onClick={() => setEtapa('preview')}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Voltar
              </button>
              <button onClick={irParaAuditoria} disabled={importando || matchLoading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                <ArrowRight size={14}/> Revisar e importar ({totalAImportar})
              </button>
            </>
          )}
          {etapa === 'auditoria' && (
            <>
              <button onClick={() => setEtapa('preview')} disabled={importando}
                className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={importar} disabled={importando}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition flex items-center justify-center gap-2">
                {importando
                  ? <><RefreshCw size={14} className="animate-spin"/> Importando...</>
                  : <><CheckCircle size={14}/> Confirmar importação ({totalAImportar})</>}
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
