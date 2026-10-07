'use client'
'use no memo'
// EXPORTAR (Sprint 9): arte pra aprovação (JPG 150 dpi com contorno) e arte pra impressão (PDF/PNG 300 dpi
// com sobra, linhas, identidade e marca de registro), marcas por prancheta, alertas e o lembrete de
// imprimir em TAMANHO REAL.
import Deslizador from './Deslizador'
import { useFolhasAplique, verFolhasAplique, fecharFolhasAplique } from './folhasAplique'
import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Printer, ImageIcon, AlertTriangle, Plus, Trash2, Check, X, Layers3, Eye } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useEditor } from './estado'
import { exportar, checarAntes, resumoAvisos, type AvisoExportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'
import { adicionarMarca, carregarMarcas, excluirMarca, useMarcas, marcaDaPrancheta, encaixeDaMarca } from './marcasMae'
import { salvarBase } from './arquivosMae'
import { Secao, useLado } from './Funcoes'
import { usePedidoAberto, apiMae } from './pedidosMae'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const sel = 'rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs'
const OPC = 'opcoes-exportar-mae'
const PADRAO: OpcoesExportar = { tipo: 'impressao', aprovacao: 'folha', formato: 'pdf', agrupar: 'prancheta', sobraMm: 10, linhas: true, linhasOriginais: true, svg: false, dxf: false, valores: {} }
const num = (s: string) => Number(String(s).replace(',', '.'))

function lerOpcoes(): OpcoesExportar {
  try { return { ...PADRAO, ...JSON.parse(localStorage.getItem(OPC) ?? '{}'), valores: {} } } catch { return PADRAO }
}

export default function PainelExportar() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const marcas = useMarcas(s => s.marcas)
  const [o, setO] = useState<OpcoesExportar>(PADRAO)
  const [nome, setNome] = useState('')
  const [rodando, setRodando] = useState<string | null>(null)
  const [res, setRes] = useState<ResultadoExportar | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [lembrete, setLembrete] = useState(false)
  const [prog, setProg] = useState<{ feitos: number; total: number } | null>(null)
  /** Lote 2 (item 18): janela de conclusão (arquivo salvo + lembrete de tamanho real). */
  const [concluido, setConcluido] = useState<ResultadoExportar | null>(null)
  /** Lote 4 (item 49): avisos ANTES de exportar (Revisar · Exportar mesmo assim). */
  const [avisosAntes, setAvisosAntes] = useState<{ tipo: OpcoesExportar['tipo']; avisos: AvisoExportar[] } | null>(null)

  useEffect(() => { setO(lerOpcoes()) }, [])
  useEffect(() => { try { const { valores: _v, ...r } = o; void _v; localStorage.setItem(OPC, JSON.stringify(r)) } catch { /* sem storage */ } }, [o])
  useEffect(() => { if (raiz && liberada) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])

  const muda = (p: Partial<OpcoesExportar>) => setO(x => ({ ...x, ...p }))
  const pronto = !!(raiz && liberada && tema)

  async function gerar(tipo: OpcoesExportar['tipo'], mesmoAssim = false) {
    if (!raiz || !tema) return
    const ped = usePedidoAberto.getState()
    const valores = ped.pedido ? ped.valores : nome.trim() ? { NOME: nome.trim() } : {}
    // Lote 4 (item 49; antes o confirm do item 23): avisos agrupados ANTES de gerar — texto que passou da
    // face e prancheta sem marca (print & cut sem marca não corta). "Ir até" leva à caixa com problema.
    if (!mesmoAssim) {
      const semMarca = tipo === 'impressao' && o.agrupar !== 'molde' && marcas.length
        ? pranchetas.map((ab, i) => ({ ab, i })).filter(({ ab }) => !marcaDaPrancheta(ab, marcas)).map(({ ab, i }) => ({ id: ab.id, nome: nomeDaPrancheta(doc, ab, i) }))
        : []
      let avisos: AvisoExportar[] = []
      try { avisos = checarAntes({ doc, tema, valores, semMarca }) } catch { /* a checagem nunca impede exportar */ }
      if (avisos.length) { setAvisosAntes({ tipo, avisos }); return }
    }
    setAvisosAntes(null)
    setErro(null); setRes(null); setRodando('Preparando…')
    try {
      setProg({ feitos: 0, total: Math.max(1, pranchetas.length) })
      const r = await exportar({ raiz, doc, tema, identidade: useEditor.getState().identidade, marcas, aoProgredir: setRodando, aoProgresso: (feitos, total) => setProg({ feitos, total }) }, { ...o, tipo, valores })
      setRes(r); setConcluido(r)
      // pedido aberto pelo card: a arte pra impressão fica registrada no card (status + arquivo + versão do tema)
      if (ped.pedido && tipo === 'impressao') {
        const principal = r.arquivos.find(a => a.endsWith('.pdf')) ?? r.arquivos[0] ?? null
        await apiMae.registrarArte({ orderId: ped.pedido.id, themeId: tema.id, themeVersion: tema.version, variaveis: valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: principal })
          .then(() => apiMae.pedido(ped.pedido!.id)).then(p => usePedidoAberto.setState({ pedido: p })).catch(e => setErro(`Arte gerada, mas não registrei no pedido: ${(e as Error).message}`))
      }
      if (tipo === 'impressao') setLembrete(!naoLembrar())
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui exportar.')
    } finally { setRodando(null); setProg(null) }
  }

  async function gerarApliques() {
    if (!raiz || !tema) return
    setErro(null); setRes(null); setRodando('Apliques 3D: silhuetas e folhas…')
    try {
      const { gerarFolhasDeApliques, gravarFolhasDeApliques } = await import('./apliquesMae')
      const { nomeExportacao, pastaExportacao } = await import('@/lib/mae/exportar/nomes')
      const agora = new Date(), nomeVar = nome.trim() || tema.sample?.NOME || ''
      const s = await gerarFolhasDeApliques(raiz, doc, tema, marcas, qual => nomeExportacao({ tema: tema.name ?? 'tema', nome: nomeVar, molde: qual, data: agora, extensao: 'png' }))
      const pasta = pastaExportacao(agora)
      const arquivos = await gravarFolhasDeApliques(raiz, pasta, s)
      setRes({ pasta, arquivos, alertas: s.avisos, revisar: false }); setConcluido({ pasta, arquivos, alertas: s.avisos, revisar: false })
      if (arquivos.length) setLembrete(!naoLembrar())
    } catch (e) { setErro((e as Error)?.message || 'Não consegui gerar os apliques.') } finally { setRodando(null) }
  }

  const pranchetas = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id))

  return (
    <section className="space-y-3" data-painel-exportar>
      <Secao ids={['exportar']}>
      {useLado() === 'tudo' && <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Exportar</h2>}
      {!tema && <p className="text-[11px] text-gray-400">Abra ou crie um tema para exportar.</p>}
      <label className="flex items-center gap-1.5 text-xs">Nome <input value={nome} onChange={e => setNome(e.target.value)} placeholder={tema?.sample?.NOME ?? 'Maria Júlia'} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-nome-exportar /></label>
      </Secao>

      <Secao ids={['exportar']}>
      {/* aprovação */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
        <p className="text-xs font-semibold flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> Arte pra aprovação</p>
        <p className="text-[11px] text-gray-500">JPG 150 dpi, recortado na face, com contorno — para mandar à cliente.</p>
        <div className="flex items-center gap-1.5">
          <select value={o.aprovacao} onChange={e => muda({ aprovacao: e.target.value as OpcoesExportar['aprovacao'] })} className={sel} data-aprovacao-agrupar>
            <option value="folha">Numa imagem só</option><option value="molde">Uma por molde</option>
          </select>
          <button className={btn} disabled={!pronto || !!rodando} onClick={() => gerar('aprovacao')} data-gerar-aprovacao><Download className="w-3.5 h-3.5" /> Gerar JPG</button>
        </div>
      </div>

      {/* impressão */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5">
        <p className="text-xs font-semibold flex items-center gap-1"><Printer className="w-3.5 h-3.5" /> Arte pra impressão</p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <select value={o.formato} onChange={e => muda({ formato: e.target.value as OpcoesExportar['formato'] })} className={sel} data-formato>
            <option value="pdf">PDF (300 dpi)</option><option value="png">PNG (300 dpi)</option>
          </select>
          <select value={o.agrupar} onChange={e => muda({ agrupar: e.target.value as OpcoesExportar['agrupar'] })} className={sel} data-dica="agrupar-arquivos" data-agrupar>
            <option value="prancheta">Por prancheta</option><option value="molde">Por molde</option>{o.formato === 'pdf' && <option value="tudo">Tudo junto</option>}
          </select>
          <label className="flex items-center gap-1" title="Quanto a arte passa da linha de corte">Sobra
            <input inputMode="decimal" defaultValue={String(o.sobraMm).replace('.', ',')} key={o.sobraMm} onBlur={e => { const v = num(e.target.value); if (v >= 0 && v <= 30) muda({ sobraMm: v }) }} className="w-10 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1" data-sobra /> mm</label>
          <select value={o.linhas ? 'sim' : 'nao'} onChange={e => muda({ linhas: e.target.value === 'sim' })} className={sel} data-linhas>
            <option value="sim">Imprimir linhas</option><option value="nao">Ocultar linhas</option>
          </select>
        </div>
        {o.linhas && o.formato === 'pdf' && (
          <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300"><input type="checkbox" checked={o.linhasOriginais} onChange={e => muda({ linhasOriginais: e.target.checked })} /> Moldes em PDF: usar as linhas do arquivo original (vetor exato)</label>
        )}
        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-300">
          <span>Só as linhas:</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={o.svg} onChange={e => muda({ svg: e.target.checked })} data-svg /> SVG</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={o.dxf} onChange={e => muda({ dxf: e.target.checked })} data-dxf /> DXF</label>
        </div>


        <button className={`${btn} w-full justify-center !py-1.5 bg-orange-500 text-white !border-orange-500 hover:bg-orange-600`} disabled={!pronto || !!rodando} onClick={() => gerar('impressao')} data-gerar-impressao>
          <Printer className="w-3.5 h-3.5" /> Gerar arquivo pra impressão
        </button>
      </div>
      </Secao>
      <Secao ids={['marcas', 'exportar']}><div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2"><MarcasPranchetas /></div></Secao>

      <Secao ids={['apliques']}>{tema && <SecaoApliques gerar={gerarApliques} rodando={!!rodando} pronto={pronto} />}</Secao>

      {rodando && (
        <div className="sticky bottom-0 rounded-lg border border-orange-200 bg-white dark:bg-gray-900 p-2 space-y-1 shadow" data-exportando>
          <p className="text-xs text-gray-700 dark:text-gray-200 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {rodando}</p>
          {prog && <div className="h-1.5 rounded bg-gray-100 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${Math.round((prog.feitos / prog.total) * 100)}%` }} data-barra-progresso /></div>}
        </div>
      )}
      <Secao ids={['exportar', 'apliques']}>
      {erro && <p className="text-xs text-red-600" data-erro-exportar>{erro}</p>}
      {res && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-[11px] space-y-1 text-gray-600 dark:text-gray-300" data-resultado-exportar>
          <p className="font-semibold text-emerald-700 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {res.arquivos.length} arquivo(s) em {res.pasta}</p>
          {res.arquivos.map(a => <p key={a} className="break-all" data-arquivo-exportado>{a.split('/').pop()}</p>)}
          {res.alertas.map((a, i) => <p key={i} className="text-amber-700 flex gap-1" data-alerta-exportar><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {a}</p>)}
        </div>
      )}
      </Secao>

      {concluido && raiz && <JanelaConcluido res={concluido} raiz={raiz} lembrete={lembrete} onFechar={() => { setConcluido(null); setLembrete(false) }} />}
      {avisosAntes && <JanelaAvisos avisos={avisosAntes.avisos} onRevisar={() => setAvisosAntes(null)} onExportar={() => void gerar(avisosAntes.tipo, true)} />}
    </section>
  )
}

/** Nome da prancheta para a usuária: o nome dado, ou os moldes dela ("MILK"), ou "Folha N". */
export function nomeDaPrancheta(doc: { molds: { artboardId: string; name: string }[] }, ab: { id: string; name?: string }, i: number): string {
  return ab.name || doc.molds.filter(m => m.artboardId === ab.id).map(m => m.name).join(' + ') || `Folha ${i + 1}`
}
const ehA4 = (ab: { widthMm: number; heightMm: number }) => [ab.widthMm, ab.heightMm].sort((a, b) => a - b).every((v, j) => Math.abs(v - [210, 297][j]) < 1)

/**
 * MARCA DE REGISTRO por prancheta (Lote 2, itens 17/23): "MILK → marca ▾" com ✓/⚠️, "Usar em todas as A4",
 * cadastrar/excluir marcas. O vínculo guarda o código e a impressão digital e já grava a base na Biblioteca.
 */
export function MarcasPranchetas() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const doc = useMaeDoc(s => s.hist.atual)
  const marcas = useMarcas(s => s.marcas)
  const [erro, setErro] = useState<string | null>(null)
  const inp = useRef<HTMLInputElement>(null)
  useEffect(() => { if (raiz && liberada) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])
  const pranchetas = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id))
  function vincularMarca(abIds: string[], id: string) {
    const m = marcas.find(x => x.id === id)
    useMaeDoc.getState().aplicar(abIds.length > 1 ? 'Marca em todas as A4' : 'Marca de registro', d => {
      for (const abId of abIds) {
        const a = d.artboards.find(x => x.id === abId)
        if (!a) continue
        if (m) { a.registrationPresetId = m.id; a.registrationPresetSha = m.sha256 } else { delete a.registrationPresetId; delete a.registrationPresetSha }
      }
    })
    if (raiz && liberada) void salvarBase(raiz, useMaeDoc.getState().hist.atual).catch(() => null)
  }
  async function novaMarca(f: File | undefined) {
    if (!f || !raiz) return
    setErro(null)
    try { await adicionarMarca(raiz, f) } catch (e) { setErro((e as Error).message) }
  }
  return (
    <>
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">Marca de registro (print & cut)</p>
          {pranchetas.map((ab, i) => {
            const m = marcaDaPrancheta(ab, marcas)
            const perdida = !m && !!ab.registrationPresetId
            const enc = m ? encaixeDaMarca(ab, m) : null
            return (
              <div key={ab.id} className="space-y-0.5" data-linha-marca={ab.id}>
                <div className="flex items-center gap-1 text-[11px]">
                  <b className="max-w-[7rem] truncate" title={nomeDaPrancheta(doc, ab, i)}>{nomeDaPrancheta(doc, ab, i)}</b>
                  <span className="text-gray-400">{Math.round(ab.widthMm)}×{Math.round(ab.heightMm)} →</span>
                  <select value={m?.id ?? (perdida ? ab.registrationPresetId : '')} className={`${sel} min-w-0 flex-1`} data-marca-prancheta={ab.id} onChange={e => vincularMarca([ab.id], e.target.value)}>
                    <option value="">Sem marca</option>
                    {perdida && <option value={ab.registrationPresetId}>⚠️ marca não encontrada — escolha de novo</option>}
                    {marcas.map(mm => <option key={mm.id} value={mm.id}>{mm.nome} ({Math.round(mm.wMm)} × {Math.round(mm.hMm)} mm)</option>)}
                  </select>
                  {enc === 'ok' && <span className="text-emerald-600" title="Tamanho e orientação da marca batem com a prancheta" data-marca-ok>✓</span>}
                  {enc && enc !== 'ok' && <span className="text-amber-600" title={enc === 'girada' ? 'A marca está na outra orientação (retrato × paisagem): a página sai na orientação da prancheta e a marca é girada para caber.' : 'A marca tem outro tamanho: ela entra centralizada.'} data-marca-aviso>⚠️</span>}
                </div>
                {m && ehA4(ab) && pranchetas.some(x => x.id !== ab.id && ehA4(x) && marcaDaPrancheta(x, marcas)?.id !== m.id) && (
                  <button className="text-[10px] text-orange-700 underline" onClick={() => vincularMarca(pranchetas.filter(ehA4).map(x => x.id), m.id)} data-marca-todas-a4>Usar esta marca em todas as pranchetas A4</button>
                )}
              </div>
            )
          })}
          <div className="flex flex-wrap gap-1">
            <button className={btn} disabled={!raiz || !liberada} onClick={() => inp.current?.click()} data-adicionar-marca><Plus className="w-3 h-3" /> Adicionar marca (PDF)</button>
            {marcas.map(m => (
              <span key={m.id} className="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px]" title={`${m.zonas.length} área(s) com tinta`} data-marca={m.nome}>
                {m.nome}<button onClick={() => raiz && excluirMarca(raiz, m.id)} aria-label={`Excluir a marca ${m.nome}`}><Trash2 className="w-3 h-3 opacity-60 hover:opacity-100" /></button>
              </span>
            ))}
          </div>
          <input ref={inp} type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { novaMarca(e.target.files?.[0]); e.target.value = '' }} data-arquivo-marca />
        </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </>
  )
}

const NAO_LEMBRAR = 'mae:nao-lembrar-tamanho-real'
const naoLembrar = () => { try { return localStorage.getItem(NAO_LEMBRAR) === '1' } catch { return false } }

/** Pasta (handle) a partir do caminho "Exportações/2026-10-05". */
async function pastaDe(raiz: FileSystemDirectoryHandle, caminho: string): Promise<FileSystemDirectoryHandle> {
  let d = raiz
  for (const p of caminho.split('/').filter(Boolean)) d = await d.getDirectoryHandle(p)
  return d
}

/**
 * Lote 2 (item 18): "Arquivo salvo em Exportações/…" assim que termina, com Abrir o arquivo, Mostrar a pasta
 * (o seletor do sistema abre direto nela) e Copiar caminho; o lembrete de TAMANHO REAL vem junto ("Não mostrar mais").
 */
function JanelaConcluido({ res, raiz, lembrete, onFechar }: { res: ResultadoExportar; raiz: FileSystemDirectoryHandle; lembrete: boolean; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const principal = res.arquivos.find(a => a.endsWith('.pdf')) ?? res.arquivos[0]
  async function abrirArquivo(a: string) {
    try {
      const d = await pastaDe(raiz, a.split('/').slice(0, -1).join('/'))
      const f = await (await d.getFileHandle(a.split('/').pop()!)).getFile()
      window.open(URL.createObjectURL(f), '_blank')
    } catch { /* arquivo movido */ }
  }
  async function mostrarPasta() {
    try { await (window as unknown as { showDirectoryPicker: (o: { startIn: FileSystemDirectoryHandle; id?: string }) => Promise<unknown> }).showDirectoryPicker({ startIn: await pastaDe(raiz, res.pasta), id: 'mae-exportacoes' }) } catch { /* fechou o seletor */ }
  }
  useEsc(onFechar)
  // Lote 4 (item 49): avisos iguais aparecem uma vez só, com a contagem
  const contagem = new Map<string, number>()
  for (const a of res.alertas) contagem.set(a, (contagem.get(a) ?? 0) + 1)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onFechar} data-exportacao-concluida>
      <div className="max-w-md w-full max-h-[70vh] flex flex-col rounded-xl bg-white dark:bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2 p-4 pb-2">
          <p className="flex-1 text-sm font-semibold flex items-center gap-1.5 text-emerald-700"><Check className="w-4 h-4 shrink-0" /> {res.arquivos.length === 1 ? 'Arquivo salvo' : `${res.arquivos.length} arquivos salvos`} em {res.pasta}/</p>
          <button onClick={onFechar} aria-label="Fechar" className="text-gray-400 hover:text-gray-600" data-x-concluido><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2">
        <ul className="max-h-28 overflow-y-auto text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">{res.arquivos.map(a => <li key={a} className="break-all" data-arquivo-concluido>{a.split('/').pop()}</li>)}</ul>
        <div className="flex flex-wrap gap-1">
          {principal && <button className={btn} onClick={() => abrirArquivo(principal)} data-abrir-arquivo>Abrir o arquivo</button>}
          <button className={btn} onClick={mostrarPasta} data-abrir-pasta>Mostrar a pasta</button>
          <button className={btn} onClick={() => { void navigator.clipboard?.writeText(`Biblioteca MAE/${res.pasta}`); setCopiado(true) }} data-copiar-caminho>{copiado ? 'Copiado ✓' : 'Copiar caminho'}</button>
        </div>
        {res.alertas.length > 0 && <div className="space-y-0.5">{[...contagem].map(([a, n], i) => <p key={i} className="text-[11px] text-amber-700 flex gap-1" data-alerta-concluido><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {a}{n > 1 ? ` (${n}×)` : ''}</p>)}</div>}
        {lembrete && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-2 space-y-1" data-lembrete-tamanho-real>
            <p className="text-xs font-semibold flex items-center gap-1.5"><Printer className="w-4 h-4 text-orange-500" /> Imprima em TAMANHO REAL</p>
            <p className="text-[11px] text-gray-600">Na impressão escolha <b>&quot;Tamanho real&quot;</b> ou <b>escala 100%</b> — nunca &quot;Ajustar à página&quot;. Na primeira vez, meça: 100 mm no arquivo = 100 mm no papel.</p>
            <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" onChange={e => { try { localStorage.setItem(NAO_LEMBRAR, e.target.checked ? '1' : '0') } catch { /* sem storage */ } }} data-nao-lembrar /> Não mostrar mais</label>
          </div>
        )}
        </div>
        <div className="flex justify-end p-3 border-t border-gray-100 dark:border-gray-800"><button className={btn} onClick={onFechar} data-fechar-lembrete><X className="w-3.5 h-3.5" /> Fechar</button></div>
      </div>
    </div>
  )
}

/** Fecha com Esc (as janelas do Exportar). */
function useEsc(fechar: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fechar() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [fechar])
}

/** Lote 4 (item 49): leva a tela até a prancheta (e seleciona a caixa de texto) do aviso. */
export function irAte(a: AvisoExportar) {
  if (a.artboardId) useEditor.getState().set({ prancheta: a.artboardId, ...(a.slotId ? { slot: a.slotId } : {}) })
  window.dispatchEvent(new CustomEvent('mae:ir-ate', { detail: { artboardId: a.artboardId } }))
}

/**
 * Lote 4 (item 49): janela de avisos ANTES de exportar — resumo no topo, avisos agrupados com "Ir até", até
 * ~70% da tela com rolagem, fecha com X, Esc e clique fora; rodapé fixo com Revisar · Exportar mesmo assim.
 */
function JanelaAvisos({ avisos, onRevisar, onExportar }: { avisos: AvisoExportar[]; onRevisar: () => void; onExportar: () => void }) {
  useEsc(onRevisar)
  const grupos: { titulo: string; itens: AvisoExportar[] }[] = [
    { titulo: 'Textos que passaram da face', itens: avisos.filter(a => a.grupo === 'texto') },
    { titulo: 'Pranchetas sem marca de registro', itens: avisos.filter(a => a.grupo === 'marca') },
  ].filter(g => g.itens.length)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={onRevisar} data-avisos-antes>
      <div className="max-w-md w-full max-h-[70vh] flex flex-col rounded-xl bg-white dark:bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-2 p-4 pb-2">
          <div className="flex-1">
            <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-700"><AlertTriangle className="w-4 h-4" /> Antes de exportar, confira</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-300" data-resumo-avisos>{resumoAvisos(avisos)}</p>
          </div>
          <button onClick={onRevisar} aria-label="Fechar" className="text-gray-400 hover:text-gray-600" data-x-avisos><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
          {grupos.map(g => (
            <div key={g.titulo} className="space-y-1">
              <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">{g.titulo} ({g.itens.length})</p>
              {g.itens.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300" data-aviso-antes>
                  <span className="flex-1">{a.texto}</span>
                  {a.artboardId && <button className={btn + ' shrink-0'} onClick={() => { onRevisar(); irAte(a) }} data-ir-ate>Ir até</button>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-1.5 p-3 border-t border-gray-100 dark:border-gray-800">
          <button className={btn} onClick={onRevisar} data-revisar-avisos>Revisar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500 hover:bg-orange-600'} onClick={onExportar} data-exportar-mesmo-assim>Exportar mesmo assim</button>
        </div>
      </div>
    </div>
  )
}

/** Apliques 3D do tema: liga/desliga, bordinha (0–5 mm, cor), deslocamento da silhueta (0–15 mm), marcas. */
function SecaoApliques({ gerar, rodando, pronto }: { gerar: () => void; rodando: boolean; pronto: boolean }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const marcas = useMarcas(s => s.marcas)
  const raiz = useBiblioteca(s => s.raiz)
  const doc = useMaeDoc(s => s.hist.atual)
  const gerandoFolhas = useFolhasAplique(s => s.gerando)
  const folhasAbertas = useFolhasAplique(s => !!s.folhas)
  if (!tema) return null
  const a = { enabled: false, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3, ...(tema.appliques ?? {}) }
  type A = typeof a
  const mudar = (p: Partial<A>, label: string, j?: string) => useMaeTema.getState().aplicar(label, t => { const tt = t as { appliques?: A }; tt.appliques = { ...a, ...(tt.appliques ?? {}), ...p } }, j)
  const nMarcadas = [...Object.values(tema.partContent).flat(), ...Object.values(tema.faceContent ?? {}).flat()].filter(c => c.type === 'image' && c.applique?.enabled).length
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-secao-apliques>
      <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={a.enabled} onChange={e => mudar({ enabled: e.target.checked }, e.target.checked ? 'Ligar apliques 3D' : 'Desligar apliques 3D')} data-apliques-tema /> Apliques 3D neste tema</label>
      {a.enabled && (<>
        <p className="text-[11px] text-gray-500">{nMarcadas ? `${nMarcadas} elemento(s) marcado(s) como aplique.` : 'Selecione o elemento na arte e marque "É aplique 3D" no painel ao lado (ou no ícone 3D da lista de camadas, ou com o botão direito sobre ele).'}</p>
        <label className="block text-[11px] text-gray-500"><span className="flex justify-between"><span>Bordinha</span></span>
          <Deslizador min={0} max={5} step={0.5} value={a.borderMm} onChange={e => mudar({ borderMm: Number(e.target.value) }, 'Bordinha', 'apl:borda')} unidade="mm" data-bordinha /></label>
        <div className="flex items-center gap-1.5 text-[11px]">Cor da bordinha:
          <button className={`h-5 w-5 rounded border ${a.borderColor === '#ffffff' ? 'ring-2 ring-orange-400' : ''}`} style={{ background: '#ffffff' }} title="Branca" aria-label="Bordinha branca" onClick={() => mudar({ borderColor: '#ffffff' }, 'Bordinha branca')} />
          <input type="color" value={a.borderColor} onChange={e => mudar({ borderColor: e.target.value }, 'Cor da bordinha', 'apl:cor')} className="h-5 w-7" title="Cor do tema ou personalizada" data-cor-bordinha />
        </div>
        <label className="block text-[11px] text-gray-500"><span className="flex justify-between"><span>Deslocamento da silhueta</span></span>
          <Deslizador min={0} max={15} step={0.5} value={a.silhouetteMm} onChange={e => mudar({ silhouetteMm: Number(e.target.value) }, 'Deslocamento da silhueta', 'apl:sil')} unidade="mm" data-deslocamento /></label>
        {(['printMarkId', 'cutMarkId'] as const).map(k => (
          <label key={k} className="flex items-center gap-1.5 text-[11px]"><span className="w-24">{k === 'printMarkId' ? 'Marca impressos' : 'Marca silhuetas'}</span>
            <select value={(k === 'printMarkId' ? tema.appliques?.printMarkId : tema.appliques?.cutMarkId) ?? ''} onChange={e => mudar({ [k]: e.target.value || undefined } as Partial<A>, 'Marca da folha de apliques')} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5" data-marca-apliques={k}>
              <option value="">{k === 'cutMarkId' ? 'A mesma dos impressos' : 'Sem marca'}</option>
              {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select></label>
        ))}
        {/* Lote 4 (item 48): retrato ou paisagem — a distribuição se ajusta e a marca gira junto */}
        <div className="flex items-center gap-1 text-[11px]" data-orientacao-apliques>Folhas:
          {(['retrato', 'paisagem'] as const).map(o => <button key={o} className={btn + ((tema.appliques?.orientacao ?? 'retrato') === o ? ' !border-orange-500 bg-orange-50 text-orange-800' : '')} onClick={() => mudar({ orientacao: o } as Partial<A>, `Folhas de aplique em ${o}`)} data-orientacao={o}>{o === 'retrato' ? 'Retrato' : 'Paisagem'}</button>)}
        </div>
        <MiniaturaApliqueSel />
        {/* Lote 4 (item 46): as folhas aparecem como pranchetas de prévia na área de trabalho, antes de gerar */}
        <button className={btn + ' w-full justify-center'} disabled={!pronto || rodando || !nMarcadas || gerandoFolhas} onClick={() => { if (raiz && tema) void verFolhasAplique(raiz, doc, tema, marcas) }} data-ver-folhas-aplique>
          {gerandoFolhas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} {folhasAbertas ? 'Atualizar as folhas na área de trabalho' : 'Ver folhas de aplique'}
        </button>
        {folhasAbertas && <button className={btn + ' w-full justify-center'} onClick={fecharFolhasAplique} data-fechar-folhas-aplique><X className="w-3.5 h-3.5" /> Tirar as folhas da área de trabalho</button>}
        <button className={btn + ' w-full justify-center'} disabled={!pronto || rodando || !nMarcadas} onClick={gerar} data-gerar-apliques><Layers3 className="w-3.5 h-3.5" /> Organizar na folha e gerar os 2 PNG</button>
        <p className="text-[10px] text-gray-400">Também saem junto com a Arte pra impressão.</p>
      </>)}
    </div>
  )
}

/**
 * Lote 4 (item 46): miniatura AO VIVO do aplique selecionado (silhueta + bordinha + imagem) — muda na hora
 * com a bordinha, a cor e o deslocamento (do tema ou só deste).
 */
export function MiniaturaApliqueSel() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const doc = useMaeDoc(s => s.hist.atual)
  const camada = useEditor(s => s.camada)
  const ref = useRef<HTMLCanvasElement>(null)
  const [ok, setOk] = useState(false)
  const todas = tema ? [...Object.values(tema.partContent).flat(), ...Object.values(tema.faceContent ?? {}).flat()] : []
  const alvo = todas.find(c => c.id === camada && c.type === 'image' && c.applique?.enabled) ?? todas.find(c => c.type === 'image' && c.applique?.enabled)
  const chave = alvo && tema ? JSON.stringify([alvo.id, (alvo as { applique?: unknown }).applique, tema.appliques?.borderMm, tema.appliques?.borderColor, tema.appliques?.silhouetteMm]) : ''
  useEffect(() => {
    if (!raiz || !liberada || !tema || !alvo || !ref.current) return
    let vivo = true
    void import('./apliquesMae').then(m => m.desenharMiniaturaAplique(raiz, doc, tema, alvo.id, ref.current!)).then(r => { if (vivo) setOk(r) }).catch(() => { if (vivo) setOk(false) })
    return () => { vivo = false }
  }, [chave, raiz, liberada]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!alvo) return null
  return (
    <div className="space-y-0.5" data-miniatura-aplique>
      <p className="text-[10px] text-gray-500">Prévia: {(alvo as { name?: string }).name ?? 'aplique'} {camada === alvo.id ? '' : '(selecione um aplique na arte para ver o dele)'}</p>
      <div className="flex justify-center rounded-lg p-2" style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 12px 12px' }}>
        <canvas ref={ref} className={ok ? 'max-w-full' : 'hidden'} />
        {!ok && <span className="text-[10px] text-gray-400">sem prévia (a imagem precisa estar na Biblioteca)</span>}
      </div>
    </div>
  )
}
