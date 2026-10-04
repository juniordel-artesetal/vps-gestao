'use client'
'use no memo'
// EXPORTAR (Sprint 9): arte pra aprovação (JPG 150 dpi com contorno) e arte pra impressão (PDF/PNG 300 dpi
// com sobra, linhas, identidade e marca de registro), marcas por prancheta, alertas e o lembrete de
// imprimir em TAMANHO REAL.
import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Printer, ImageIcon, AlertTriangle, Plus, Trash2, Check, X } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useEditor } from './estado'
import { exportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'
import { adicionarMarca, carregarMarcas, excluirMarca, useMarcas } from './marcasMae'

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
      const r = await exportar({ raiz, doc, tema, identidade: useEditor.getState().identidade, marcas, aoProgredir: setRodando },
        { ...o, tipo, valores: nome.trim() ? { NOME: nome.trim() } : {} })
      setRes(r)
      if (tipo === 'impressao') setLembrete(true)
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui exportar.')
    } finally { setRodando(null) }
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
