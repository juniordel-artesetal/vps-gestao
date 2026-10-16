'use client'
// IMPORTAR PEDIDOS (PLANILHA DA SHOPEE) — MAE avulso (Lote 7, item 121). Lê o .xlsx/.csv no navegador, sugere o
// MAPEAMENTO das colunas (o da Shopee já vem certo) e lembra o escolhido na Biblioteca. Nome, idade e tema saem da
// observação quando é seguro; o resto se completa na lista. Pedido já importado (mesmo nº) não se repete.
import { useState } from 'react'
import { Upload, X, Loader2, Check, Download } from 'lucide-react'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { CAMPOS_PLANILHA, ROTULO_CAMPO, OBRIGATORIOS, ARQ_MAPEAMENTO, CANAIS_MAE, COLUNAS_MODELO, EXEMPLO_MODELO, sugerirMapeamento, mapeamentoCompleto, pedidosDaPlanilha, type Mapeamento } from '@/lib/mae/pedidos/planilha'
import { apiMae } from './pedidosMae'
import { mensagemDeErro } from '@/lib/mae/erros'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

export default function ImportarPlanilha({ raiz, onFechar, onImportado }: { raiz: FileSystemDirectoryHandle | null; onFechar: () => void; onImportado: () => void }) {
  const [linhas, setLinhas] = useState<Record<string, unknown>[] | null>(null)
  const [cabecalhos, setCabecalhos] = useState<string[]>([])
  const [mapa, setMapa] = useState<Mapeamento>({})
  const [arquivo, setArquivo] = useState('')
  // Lote 22 (item 264): o canal dos pedidos da planilha (a coluna Canal, se houver, vale mais)
  const [canal, setCanal] = useState<string>('Shopee')
  const [estado, setEstado] = useState<{ indo: boolean; msg: string | null; erro: string | null }>({ indo: false, msg: null, erro: null })

  async function abrir(f: File) {
    setEstado({ indo: true, msg: null, erro: null })
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' })
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })
      const cab = rows.length ? Object.keys(rows[0]) : []
      const salvo = raiz ? await ler(raiz, ARQ_MAPEAMENTO).then(x => x.text()).then(t => JSON.parse(t) as Mapeamento).catch(() => null) : null
      setLinhas(rows); setCabecalhos(cab); setMapa(sugerirMapeamento(cab, salvo)); setArquivo(f.name)
      setEstado({ indo: false, msg: null, erro: rows.length ? null : 'A planilha está vazia.' })
    } catch (e) { setEstado({ indo: false, msg: null, erro: `Não consegui ler a planilha: ${mensagemDeErro(e)}` }) }
  }
  const previa = linhas && mapeamentoCompleto(mapa) ? pedidosDaPlanilha(linhas, mapa, canal) : null
  /** Lote 22 (item 264): modelo genérico (Elo7, WhatsApp, site) com as colunas que o MAE reconhece sozinho. */
  async function baixarModelo() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet([EXEMPLO_MODELO], { header: [...COLUNAS_MODELO] })
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')
    XLSX.writeFile(wb, 'modelo-pedidos-metodo-mae.xlsx')
  }
  async function importar() {
    if (!previa) return
    setEstado({ indo: true, msg: null, erro: null })
    try {
      if (raiz) await gravar(raiz, ARQ_MAPEAMENTO, JSON.stringify(mapa, null, 1)).catch(() => null)
      let novos = 0, existentes = 0
      for (let i = 0; i < previa.pedidos.length; i += 500) {
        const r = await apiMae.criarPedidos(previa.pedidos.slice(i, i + 500))
        novos += r.novos; existentes += r.existentes
      }
      setEstado({ indo: false, erro: null, msg: `${novos} pedido${novos === 1 ? '' : 's'} novo${novos === 1 ? '' : 's'}${existentes ? ` · ${existentes} já existia${existentes === 1 ? '' : 'm'} (não repeti)` : ''}.` })
      onImportado()
    } catch (e) { setEstado({ indo: false, msg: null, erro: mensagemDeErro(e) }) }
  }
  const comPersonalizacao = previa?.pedidos.filter(p => p.campos.NOME).length ?? 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-importar-planilha>
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl text-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2"><Upload className="w-4 h-4 text-orange-500" /><b>Importar pedidos (planilha da Shopee ou modelo)</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></button></div>
        <p className="text-xs text-gray-600">A planilha de pedidos da Shopee entra como está. Para Elo7, WhatsApp ou site, use o modelo: colunas Pedido, Produto, Quantidade, Tema, Nome, Idade, Prazo, Observação e Canal.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} onClick={() => void baixarModelo()} data-baixar-modelo><Download className="w-3.5 h-3.5" /> Baixar modelo de planilha</button>
          <label className="flex items-center gap-1 text-xs">Canal dos pedidos
            <select value={canal} onChange={e => setCanal(e.target.value)} className="rounded border border-gray-200 bg-transparent px-1.5 py-1" data-canal-planilha>
              {CANAIS_MAE.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className={btn + ' cursor-pointer'}><Upload className="w-3.5 h-3.5" /> {arquivo ? `Trocar arquivo (${arquivo})` : 'Escolher a planilha (.xlsx ou .csv)'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void abrir(f); e.target.value = '' }} data-arquivo-planilha />
        </label>
        {linhas && (
          <div className="space-y-1" data-mapeamento-planilha>
            <p className="text-xs font-semibold">Colunas da planilha <span className="font-normal text-gray-500">(fica lembrado para as próximas)</span></p>
            {CAMPOS_PLANILHA.map(c => (
              <label key={c} className="grid grid-cols-[10rem_1fr] items-center gap-2 text-xs">
                <span>{ROTULO_CAMPO[c]}{OBRIGATORIOS.includes(c) ? ' *' : ''}</span>
                <select value={mapa[c] ?? ''} onChange={e => setMapa(m => ({ ...m, [c]: e.target.value || undefined }))} className="rounded border border-gray-200 bg-transparent px-1.5 py-1" data-coluna-planilha={c}>
                  <option value="">— não tem —</option>
                  {cabecalhos.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
        {previa && <p className="text-xs text-gray-600" data-previa-planilha>{previa.pedidos.length} pedido(s) na planilha{previa.ignoradas ? ` · ${previa.ignoradas} linha(s) sem nº ou produto ignoradas` : ''} · nome e idade lidos da observação em {comPersonalizacao} (o resto você completa na lista).</p>}
        {estado.erro && <p className="text-xs text-red-600">{estado.erro}</p>}
        {estado.msg && <p className="text-xs text-emerald-700 flex items-center gap-1" data-resultado-planilha><Check className="w-3.5 h-3.5" /> {estado.msg}</p>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Fechar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!previa?.pedidos.length || estado.indo} onClick={() => void importar()} data-importar-planilha>
            {estado.indo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importar {previa?.pedidos.length ?? ''} pedido(s)
          </button>
        </div>
      </div>
    </div>
  )
}
