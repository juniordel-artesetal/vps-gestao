'use client'
'use no memo'
// EXPORTAR (Sprint 9): arte pra aprovação (JPG 150 dpi com contorno) e arte pra impressão (PDF/PNG 300 dpi
// com sobra, linhas, identidade e marca de registro), marcas por prancheta, alertas e o lembrete de
// imprimir em TAMANHO REAL.
import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Printer, ImageIcon, AlertTriangle, Plus, Trash2, Check, X, Layers3 } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useEditor } from './estado'
import { exportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'
import { adicionarMarca, carregarMarcas, excluirMarca, useMarcas } from './marcasMae'
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
  const inp = useRef<HTMLInputElement>(null)

  useEffect(() => { setO(lerOpcoes()) }, [])
  useEffect(() => { try { const { valores: _v, ...r } = o; void _v; localStorage.setItem(OPC, JSON.stringify(r)) } catch { /* sem storage */ } }, [o])
  useEffect(() => { if (raiz && liberada) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])

  const muda = (p: Partial<OpcoesExportar>) => setO(x => ({ ...x, ...p }))
  const pronto = !!(raiz && liberada && tema)

  async function gerar(tipo: OpcoesExportar['tipo']) {
    if (!raiz || !tema) return
    setErro(null); setRes(null); setRodando('Preparando…')
    try {
      const ped = usePedidoAberto.getState()
      const valores = ped.pedido ? ped.valores : nome.trim() ? { NOME: nome.trim() } : {}
      const r = await exportar({ raiz, doc, tema, identidade: useEditor.getState().identidade, marcas, aoProgredir: setRodando }, { ...o, tipo, valores })
      setRes(r)
      // pedido aberto pelo card: a arte pra impressão fica registrada no card (status + arquivo + versão do tema)
      if (ped.pedido && tipo === 'impressao') {
        const principal = r.arquivos.find(a => a.endsWith('.pdf')) ?? r.arquivos[0] ?? null
        await apiMae.registrarArte({ orderId: ped.pedido.id, themeId: tema.id, themeVersion: tema.version, variaveis: valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: principal })
          .then(() => apiMae.pedido(ped.pedido!.id)).then(p => usePedidoAberto.setState({ pedido: p })).catch(e => setErro(`Arte gerada, mas não registrei no pedido: ${(e as Error).message}`))
      }
      if (tipo === 'impressao') setLembrete(true)
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui exportar.')
    } finally { setRodando(null) }
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
      setRes({ pasta, arquivos, alertas: s.avisos, revisar: false })
      if (arquivos.length) setLembrete(true)
    } catch (e) { setErro((e as Error)?.message || 'Não consegui gerar os apliques.') } finally { setRodando(null) }
  }

  async function novaMarca(f: File | undefined) {
    if (!f || !raiz) return
    setErro(null)
    try { await adicionarMarca(raiz, f) } catch (e) { setErro((e as Error).message) }
  }

  const pranchetas = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id))

  return (
    <section className="space-y-3" data-painel-exportar>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Exportar</h2>
      {!tema && <p className="text-[11px] text-gray-400">Abra ou crie um tema para exportar.</p>}
      <label className="flex items-center gap-1.5 text-xs">Nome <input value={nome} onChange={e => setNome(e.target.value)} placeholder={tema?.sample?.NOME ?? 'Maria Júlia'} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-nome-exportar /></label>

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
          <select value={o.agrupar} onChange={e => muda({ agrupar: e.target.value as OpcoesExportar['agrupar'] })} className={sel} data-agrupar>
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

        {/* marca de registro por prancheta */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">Marca de registro (print & cut)</p>
          {pranchetas.map((ab, i) => (
            <label key={ab.id} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-16 truncate">{ab.name || `Folha ${i + 1}`}</span>
              <select value={ab.registrationPresetId ?? ''} className={`${sel} flex-1`} data-marca-prancheta={ab.id}
                onChange={e => useMaeDoc.getState().aplicar('Marca de registro', d => { const a = d.artboards.find(x => x.id === ab.id); if (a) { if (e.target.value) a.registrationPresetId = e.target.value; else delete a.registrationPresetId } })}>
                <option value="">Sem marca</option>
                {marcas.map(m => <option key={m.id} value={m.id}>{m.nome} ({Math.round(m.wMm)} × {Math.round(m.hMm)} mm)</option>)}
              </select>
            </label>
          ))}
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

        <button className={`${btn} w-full justify-center !py-1.5 bg-orange-500 text-white !border-orange-500 hover:bg-orange-600`} disabled={!pronto || !!rodando} onClick={() => gerar('impressao')} data-gerar-impressao>
          <Printer className="w-3.5 h-3.5" /> Gerar arquivo pra impressão
        </button>
      </div>

      {tema && <SecaoApliques gerar={gerarApliques} rodando={!!rodando} pronto={pronto} />}

      {rodando && <p className="text-xs text-gray-500 flex items-center gap-1" data-exportando><Loader2 className="w-3.5 h-3.5 animate-spin" /> {rodando}</p>}
      {erro && <p className="text-xs text-red-600" data-erro-exportar>{erro}</p>}
      {res && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-[11px] space-y-1 text-gray-600 dark:text-gray-300" data-resultado-exportar>
          <p className="font-semibold text-emerald-700 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {res.arquivos.length} arquivo(s) em {res.pasta}</p>
          {res.arquivos.map(a => <p key={a} className="break-all" data-arquivo-exportado>{a.split('/').pop()}</p>)}
          {res.alertas.map((a, i) => <p key={i} className="text-amber-700 flex gap-1" data-alerta-exportar><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {a}</p>)}
        </div>
      )}

      {lembrete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-lembrete-tamanho-real>
          <div className="max-w-sm rounded-xl bg-white dark:bg-gray-900 p-4 space-y-2 shadow-xl">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Printer className="w-4 h-4 text-orange-500" /> Imprima em TAMANHO REAL</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Na janela de impressão escolha <b>&quot;Tamanho real&quot;</b> ou <b>escala 100%</b> — nunca &quot;Ajustar à página&quot;. O arquivo já pede isso, mas alguns programas ignoram.</p>
            <p className="text-xs text-gray-600 dark:text-gray-300">Na primeira vez, meça a linha de corte com uma régua: 100 mm no arquivo têm de dar 100 mm no papel.</p>
            <div className="flex justify-end"><button className={btn} onClick={() => setLembrete(false)} data-fechar-lembrete><X className="w-3.5 h-3.5" /> Entendi</button></div>
          </div>
        </div>
      )}
    </section>
  )
}

/** Apliques 3D do tema: liga/desliga, bordinha (0–5 mm, cor), deslocamento da silhueta (0–15 mm), marcas. */
function SecaoApliques({ gerar, rodando, pronto }: { gerar: () => void; rodando: boolean; pronto: boolean }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const marcas = useMarcas(s => s.marcas)
  if (!tema) return null
  const a = { enabled: false, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3, ...(tema.appliques ?? {}) }
  type A = typeof a
  const mudar = (p: Partial<A>, label: string, j?: string) => useMaeTema.getState().aplicar(label, t => { const tt = t as { appliques?: A }; tt.appliques = { ...a, ...(tt.appliques ?? {}), ...p } }, j)
  const nMarcadas = [...Object.values(tema.partContent).flat(), ...Object.values(tema.faceContent ?? {}).flat()].filter(c => c.type === 'image' && c.applique?.enabled).length
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-secao-apliques>
      <label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" checked={a.enabled} onChange={e => mudar({ enabled: e.target.checked }, e.target.checked ? 'Ligar apliques 3D' : 'Desligar apliques 3D')} data-apliques-tema /> Apliques 3D neste tema</label>
      {a.enabled && (<>
        <p className="text-[11px] text-gray-500">{nMarcadas ? `${nMarcadas} elemento(s) marcado(s) como aplique.` : 'Marque um elemento como aplique: selecione a camada e marque "É aplique 3D".'}</p>
        <label className="block text-[11px] text-gray-500"><span className="flex justify-between"><span>Bordinha</span><span className="tabular-nums">{a.borderMm} mm</span></span>
          <input type="range" min={0} max={5} step={0.5} value={a.borderMm} onChange={e => mudar({ borderMm: Number(e.target.value) }, 'Bordinha', 'apl:borda')} className="w-full accent-orange-500" data-bordinha /></label>
        <div className="flex items-center gap-1.5 text-[11px]">Cor da bordinha:
          <button className={`h-5 w-5 rounded border ${a.borderColor === '#ffffff' ? 'ring-2 ring-orange-400' : ''}`} style={{ background: '#ffffff' }} title="Branca" aria-label="Bordinha branca" onClick={() => mudar({ borderColor: '#ffffff' }, 'Bordinha branca')} />
          <input type="color" value={a.borderColor} onChange={e => mudar({ borderColor: e.target.value }, 'Cor da bordinha', 'apl:cor')} className="h-5 w-7" title="Cor do tema ou personalizada" data-cor-bordinha />
        </div>
        <label className="block text-[11px] text-gray-500"><span className="flex justify-between"><span>Deslocamento da silhueta</span><span className="tabular-nums">{a.silhouetteMm} mm</span></span>
          <input type="range" min={0} max={15} step={0.5} value={a.silhouetteMm} onChange={e => mudar({ silhouetteMm: Number(e.target.value) }, 'Deslocamento da silhueta', 'apl:sil')} className="w-full accent-orange-500" data-deslocamento /></label>
        {(['printMarkId', 'cutMarkId'] as const).map(k => (
          <label key={k} className="flex items-center gap-1.5 text-[11px]"><span className="w-24">{k === 'printMarkId' ? 'Marca impressos' : 'Marca silhuetas'}</span>
            <select value={(k === 'printMarkId' ? tema.appliques?.printMarkId : tema.appliques?.cutMarkId) ?? ''} onChange={e => mudar({ [k]: e.target.value || undefined } as Partial<A>, 'Marca da folha de apliques')} className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5" data-marca-apliques={k}>
              <option value="">{k === 'cutMarkId' ? 'A mesma dos impressos' : 'Sem marca'}</option>
              {marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select></label>
        ))}
        <button className={btn + ' w-full justify-center'} disabled={!pronto || rodando || !nMarcadas} onClick={gerar} data-gerar-apliques><Layers3 className="w-3.5 h-3.5" /> Organizar na folha e gerar os 2 PNG</button>
        <p className="text-[10px] text-gray-400">Também saem junto com a Arte pra impressão.</p>
      </>)}
    </div>
  )
}
