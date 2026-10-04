'use client'
'use no memo'
// Diálogo "Importar moldes" (Sprint 3): lista os arquivos (vários de uma vez; PDF com várias páginas
// vira um molde por página) e pede o que falta ANTES de importar:
//   • PNG/JPG — SEMPRE confirmar a largura real (sugerida pelo DPI do arquivo) ou medir com 2 cliques;
//   • DXF sem $INSUNITS — escolher a unidade;
//   • SVG sem unidade física — conferir o tamanho (pode corrigir a largura).
import { useEffect, useRef, useState } from 'react'
import { X, Ruler, Check, AlertTriangle, Loader2, FileUp } from 'lucide-react'
import { analisarArquivo, redimensionarFonte, type FonteMolde } from '@/lib/mae/importacao/navegador'
import { pxPorMmDaMedida, UNIDADES_DXF_ESCOLHA } from '@/lib/mae/importacao/unidades'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { importarMoldes, useMoldes, type FonteConfirmada } from './moldesEditor'

const num = (s: string) => Number(String(s).replace(',', '.'))
const fmt = (n: number, c = 1) => (Math.round(n * 10 ** c) / 10 ** c).toLocaleString('pt-BR')
const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

interface Item { fonte: FonteMolde; base: { w: number; h: number }; confirmado: boolean; metodo?: 'dpi' | 'width' | 'measure'; escala: number; larguraTxt: string; unidade: number | null }

/** Medir com 2 cliques sobre a imagem: a usuária clica nas pontas de uma linha conhecida e digita a medida. */
function Medidor({ bitmap, onPronto, onCancelar }: { bitmap: ImageBitmap; onPronto: (pxPorMm: number) => void; onCancelar: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [pts, setPts] = useState<[number, number][]>([])
  const [mm, setMm] = useState('')
  const escala = Math.min(1, 560 / bitmap.width, 380 / bitmap.height)
  useEffect(() => {
    const c = ref.current; if (!c) return
    c.width = Math.round(bitmap.width * escala); c.height = Math.round(bitmap.height * escala)
    const g = c.getContext('2d')!
    g.drawImage(bitmap, 0, 0, c.width, c.height)
    g.strokeStyle = '#f97316'; g.fillStyle = '#f97316'; g.lineWidth = 2
    pts.forEach(([x, y]) => { g.beginPath(); g.arc(x * escala, y * escala, 4, 0, Math.PI * 2); g.fill() })
    if (pts.length === 2) { g.beginPath(); g.moveTo(pts[0][0] * escala, pts[0][1] * escala); g.lineTo(pts[1][0] * escala, pts[1][1] * escala); g.stroke() }
  }, [bitmap, escala, pts])
  const clique = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const p: [number, number] = [(e.clientX - r.left) / escala, (e.clientY - r.top) / escala]
    setPts(a => (a.length >= 2 ? [p] : [...a, p]))
  }
  const ok = pts.length === 2 && num(mm) > 0
  return (
    <div className="space-y-2" data-medidor>
      <p className="text-xs text-gray-600 dark:text-gray-300">Clique nas <b>duas pontas</b> de uma linha cuja medida você conhece (ex.: a largura da frente) e digite a medida real.</p>
      <canvas ref={ref} onClick={clique} className="border border-gray-200 rounded cursor-crosshair max-w-full" data-medidor-canvas />
      <div className="flex items-center gap-2 text-xs">
        <span>{pts.length}/2 pontos</span>
        <input inputMode="decimal" value={mm} onChange={e => setMm(e.target.value)} placeholder="medida" className="w-24 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-medida-mm /> mm
        <button className={btn} disabled={!ok} onClick={() => onPronto(pxPorMmDaMedida(pts[0], pts[1], num(mm)))} data-medida-ok><Check className="w-3.5 h-3.5" /> Usar esta medida</button>
        <button className={btn} onClick={onCancelar}>Voltar</button>
      </div>
    </div>
  )
}

export default function ImportarMoldes({ arquivos, onFechar }: { arquivos: File[]; onFechar: () => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const liberada = useBiblioteca(s => s.liberada)
  const ocupado = useMoldes(s => s.ocupado)
  const [itens, setItens] = useState<Item[] | null>(null)
  const [erros, setErros] = useState<string[]>([])
  const [medindo, setMedindo] = useState<number | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const out: Item[] = [], errs: string[] = []
      for (const a of arquivos) {
        try {
          for (const f of await analisarArquivo(a)) {
            const raster = f.tipo === 'png' || f.tipo === 'jpg'
            out.push({
              fonte: f, base: { w: f.larguraMm, h: f.alturaMm }, escala: 1, unidade: f.mmPorUnidade ?? null,
              confirmado: !f.pendente && (f.tipo !== 'svg' || !!f.tamanhoConfiavel),
              metodo: raster && f.dpi ? 'dpi' : undefined,
              larguraTxt: f.larguraMm ? fmt(f.larguraMm, 1) : '',
            })
            void raster
          }
        } catch (e) { errs.push((e as Error)?.message || `${a.name}: não consegui ler`) }
      }
      if (vivo) { setItens(out); setErros(errs) }
    })()
    return () => { vivo = false }
  }, [arquivos])

  const muda = (i: number, p: Partial<Item>) => setItens(a => a!.map((x, k) => (k === i ? { ...x, ...p } : x)))

  /** Aplica a largura (mm) a uma fonte, mantendo a proporção. */
  function confirmarLargura(i: number, larguraMm: number, metodo: 'dpi' | 'width' | 'measure') {
    const it = itens![i], f = it.fonte
    if (!(larguraMm > 1 && larguraMm < 5000)) return
    if (f.tipo === 'png' || f.tipo === 'jpg') {
      redimensionarFonte(f, larguraMm, (larguraMm * f.alturaPx!) / f.larguraPx!)
      muda(i, { confirmado: true, metodo, larguraTxt: fmt(larguraMm, 1) })
    } else {
      const escala = larguraMm / it.base.w
      redimensionarFonte(f, it.base.w * escala, it.base.h * escala)
      muda(i, { confirmado: true, escala, larguraTxt: fmt(larguraMm, 1) })
    }
  }
  function escolherUnidade(i: number, mmPorUnidade: number) {
    const it = itens![i], f = it.fonte
    redimensionarFonte(f, it.base.w * mmPorUnidade, it.base.h * mmPorUnidade, mmPorUnidade)
    muda(i, { unidade: mmPorUnidade, confirmado: true, larguraTxt: fmt(it.base.w * mmPorUnidade, 1) })
  }

  async function importar() {
    if (!raiz || !itens) return
    const conf: FonteConfirmada[] = itens.filter(i => i.confirmado).map(i => ({ fonte: i.fonte, metodo: i.metodo, escala: i.escala }))
    const e = await importarMoldes(conf, raiz)
    if (!e.length) onFechar(); else setErros(e)
  }

  const prontos = itens?.filter(i => i.confirmado).length ?? 0
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-importar-moldes>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileUp className="w-4 h-4" /> Importar moldes</h2>
          <button onClick={onFechar} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {!liberada && <p className="text-xs text-red-600">Conecte a pasta Biblioteca MAE primeiro: o arquivo do molde é guardado em <b>Bases/moldes/</b>.</p>}
        {!itens && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Lendo os arquivos…</p>}
        {erros.map((e, i) => <p key={i} className="text-xs text-red-600 flex gap-1" data-erro-importar><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{e}</p>)}

        {itens && medindo !== null && itens[medindo].fonte.bitmap && (
          <Medidor bitmap={itens[medindo].fonte.bitmap!} onCancelar={() => setMedindo(null)}
            onPronto={k => { const f = itens[medindo].fonte; confirmarLargura(medindo, f.larguraPx! / k, 'measure'); setMedindo(null) }} />
        )}

        {itens && medindo === null && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800" data-lista-importar>
            {itens.map((it, i) => {
              const f = it.fonte, raster = f.tipo === 'png' || f.tipo === 'jpg'
              return (
                <li key={i} className="py-2.5 space-y-1.5" data-item-importar={f.nome}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">{f.tipo}</span>
                    <span className="font-medium text-gray-900 dark:text-white truncate">{f.nome}</span>
                    <span className="ml-auto text-xs tabular-nums text-gray-500" data-tamanho>{f.larguraMm ? `${fmt(f.larguraMm)} × ${fmt(f.alturaMm)} mm` : 'tamanho a confirmar'}</span>
                    {it.confirmado ? <Check className="w-4 h-4 text-emerald-600" data-confirmado /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  </div>
                  {raster && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span>{f.dpi ? `O arquivo diz ${fmt(f.dpi, 0)} dpi.` : 'O arquivo não diz o DPI.'} Confirme a <b>largura real</b>:</span>
                      <input inputMode="decimal" value={it.larguraTxt} onChange={e => muda(i, { larguraTxt: e.target.value, confirmado: false })} className="w-20 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-largura /> mm
                      <button className={btn} onClick={() => confirmarLargura(i, num(it.larguraTxt), it.metodo === 'dpi' && Math.abs(num(it.larguraTxt) - f.larguraMm) < 0.05 ? 'dpi' : 'width')} disabled={!(num(it.larguraTxt) > 0)} data-confirmar-largura><Check className="w-3.5 h-3.5" /> Confirmar</button>
                      <button className={btn} onClick={() => setMedindo(i)} data-medir-2-cliques><Ruler className="w-3.5 h-3.5" /> Medir com 2 cliques</button>
                    </div>
                  )}
                  {f.tipo === 'dxf' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      {f.pendente === 'unidade' ? <span>O DXF não diz a unidade. As medidas do desenho estão em:</span> : <span>Unidade do arquivo: {fmt(f.mmPorUnidade ?? 1, 2)} mm por unidade.</span>}
                      {f.pendente === 'unidade' && (
                        <select value={it.unidade ?? ''} onChange={e => escolherUnidade(i, Number(e.target.value))} className="rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-unidade-dxf>
                          <option value="" disabled>escolha…</option>
                          {UNIDADES_DXF_ESCOLHA.map(u => <option key={u.mm} value={u.mm}>{u.rotulo}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  {f.tipo === 'svg' && !f.tamanhoConfiavel && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <span>O SVG não traz unidade física (mm/cm/pol). Confira a largura:</span>
                      <input inputMode="decimal" value={it.larguraTxt} onChange={e => muda(i, { larguraTxt: e.target.value, confirmado: false })} className="w-20 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1" data-largura /> mm
                      <button className={btn} onClick={() => confirmarLargura(i, num(it.larguraTxt), 'width')} data-confirmar-largura><Check className="w-3.5 h-3.5" /> Confirmar</button>
                    </div>
                  )}
                  {f.tipo === 'pdf' && <p className="text-[11px] text-gray-400">Escala exata do PDF (vetor). As linhas originais ficam guardadas para a exportação.</p>}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {ocupado && <span className="mr-auto text-xs text-gray-500 flex items-center gap-1" data-ocupado><Loader2 className="w-3.5 h-3.5 animate-spin" /> {ocupado}</span>}
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' !border-orange-400 bg-orange-50 text-orange-800'} disabled={!liberada || !prontos || !!ocupado} onClick={importar} data-importar>
            Importar {prontos} {prontos === 1 ? 'molde' : 'moldes'}
          </button>
        </div>
      </div>
    </div>
  )
}
