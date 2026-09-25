'use client'
// SOA Edition — biblioteca do editor: elementos/adesivos, molduras (a foto entra recortada), grades de
// fotos e templates. 🔒 Tudo autoral (desenhado no código) — nenhum personagem/marca de terceiros.
import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { ELEMENTOS, MOLDURAS, GRADES, MODELOS, miniaturaModelo, type Elemento, type FormaMoldura, type Grade, type Modelo } from '@/lib/estudio/biblioteca'

export type AbaBiblioteca = 'elementos' | 'molduras' | 'grades' | 'templates'
const svgUrl = (s: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`

export default function ModalBiblioteca({ abaInicial = 'elementos', onFechar, onElemento, onMoldura, onGrade, onModelo, onMeuTemplate, onTemplateMassa }: {
  abaInicial?: AbaBiblioteca
  onFechar: () => void
  onElemento?: (e: Elemento) => void
  onMoldura?: (f: FormaMoldura) => void
  onGrade?: (g: Grade) => void
  onModelo: (m: Modelo) => void
  onMeuTemplate: (id: string, nome: string) => void
  onTemplateMassa: (id: string) => void
}) {
  const [aba, setAba] = useState<AbaBiblioteca>(abaInicial)
  const [minis, setMinis] = useState<Record<string, string>>({})
  const [meus, setMeus] = useState<{ id: string; nome: string; previewUrl: string | null }[] | null>(null)
  const [massa, setMassa] = useState<{ id: string; nome: string; preview: string | null }[] | null>(null)

  useEffect(() => {
    if (aba !== 'templates') return
    let vivo = true
    ;(async () => { for (const m of MODELOS) { if (!vivo) return; if (!minis[m.id]) { const u = await miniaturaModelo(m).catch(() => ''); if (vivo) setMinis(x => ({ ...x, [m.id]: u })) } } })()
    if (!meus) fetch('/api/estudio/designs?modelos=1').then(r => r.json()).then(d => setMeus(d.designs || [])).catch(() => setMeus([]))
    if (!massa) fetch('/api/estudio/templates').then(r => r.json()).then(d => setMassa(d.templates || [])).catch(() => setMassa([]))
    return () => { vivo = false }
  }, [aba]) // eslint-disable-line react-hooks/exhaustive-deps

  const abas: [AbaBiblioteca, string, boolean][] = [['elementos', 'Elementos', !!onElemento], ['molduras', 'Molduras', !!onMoldura], ['grades', 'Grades de fotos', !!onGrade], ['templates', 'Templates', true]]
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="w-full max-w-4xl max-h-[86vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {abas.filter(a => a[2]).map(([k, t]) => (
              <button key={k} onClick={() => setAba(k)} className={`text-xs rounded-full px-3 py-1 border ${aba === k ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{t}</button>
            ))}
          </div>
          <button onClick={onFechar}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {aba === 'elementos' && onElemento && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {ELEMENTOS.map(e => (
              <button key={e.id} onClick={() => onElemento(e)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 hover:border-orange-400">
                <img src={svgUrl(e.svg)} alt="" className="w-full aspect-square object-contain" />
                <span className="block text-[10px] text-gray-600 dark:text-gray-300 mt-1 truncate">{e.nome}</span>
              </button>
            ))}
          </div>
        )}

        {aba === 'molduras' && onMoldura && (
          <>
            <p className="text-xs text-gray-500">Coloque a moldura e depois importe/escolha uma foto com ela selecionada — a foto entra recortada no formato. A moldura vazia não sai na exportação.</p>
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
              {MOLDURAS.map(m => (
                <button key={m.id} onClick={() => onMoldura(m.id)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 hover:border-orange-400 text-center">
                  <Silhueta forma={m.id} />
                  <span className="block text-[10px] text-gray-600 dark:text-gray-300 mt-1">{m.nome}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {aba === 'grades' && onGrade && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {GRADES.map(g => (
              <button key={g.id} onClick={() => onGrade(g)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-2 hover:border-orange-400">
                <div className="relative w-full aspect-square bg-gray-50 dark:bg-gray-800 rounded">
                  {g.celulas.map((c, i) => <div key={i} className="absolute bg-orange-200 dark:bg-orange-900/60 rounded-sm" style={{ left: `${c.x * 100 + 2}%`, top: `${c.y * 100 + 2}%`, width: `${c.w * 100 - 4}%`, height: `${c.h * 100 - 4}%` }} />)}
                </div>
                <span className="block text-[10px] text-gray-600 dark:text-gray-300 mt-1">{g.nome}</span>
              </button>
            ))}
          </div>
        )}

        {aba === 'templates' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Templates SOA <span className="font-normal text-gray-400">(autorais — edite à vontade)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MODELOS.map(m => (
                  <button key={m.id} onClick={() => onModelo(m)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1.5 hover:border-orange-400 text-left">
                    <div className="w-full aspect-square bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                      {minis[m.id] ? <img src={minis[m.id]} alt="" className="max-w-full max-h-full" /> : <Loader2 className="w-4 h-4 animate-spin text-gray-300" />}
                    </div>
                    <span className="block text-[11px] font-medium text-gray-700 dark:text-gray-200 mt-1 truncate">{m.nome}</span>
                    <span className="block text-[10px] text-gray-400">{m.categoria} · {m.largura}×{m.altura}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Meus templates</p>
              {meus === null ? <Loader2 className="w-4 h-4 animate-spin text-gray-300" /> : !meus.length
                ? <p className="text-[11px] text-gray-400">No editor, marque “Salvar como template” num design para ele aparecer aqui.</p>
                : <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{meus.map(d => (
                    <button key={d.id} onClick={() => onMeuTemplate(d.id, d.nome)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                      {d.previewUrl ? <img src={d.previewUrl} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 dark:bg-gray-800 rounded-lg" />}
                      <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{d.nome}</span>
                    </button>))}</div>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Da Edição em massa <span className="font-normal text-gray-400">(o molde vira fundo e cada campo vira um texto)</span></p>
              {massa === null ? <Loader2 className="w-4 h-4 animate-spin text-gray-300" /> : !massa.length
                ? <p className="text-[11px] text-gray-400">Nenhum template salvo na Edição em massa.</p>
                : <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{massa.map(t => (
                    <button key={t.id} onClick={() => onTemplateMassa(t.id)} className="rounded-xl border border-gray-200 dark:border-gray-700 p-1 hover:border-orange-400 text-left">
                      {t.preview ? <img src={t.preview} alt="" className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 dark:bg-gray-800 rounded-lg" />}
                      <span className="block text-[10px] truncate mt-1 text-gray-600 dark:text-gray-300">{t.nome}</span>
                    </button>))}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Silhueta({ forma }: { forma: FormaMoldura }) {
  const c = 'fill-orange-200 dark:fill-orange-900/60 stroke-orange-400'
  return (
    <svg viewBox="0 0 100 100" className="w-full aspect-square">
      {forma === 'circulo' && <circle cx="50" cy="50" r="42" className={c} strokeDasharray="5 4" />}
      {forma === 'arredondado' && <rect x="8" y="8" width="84" height="84" rx="12" className={c} strokeDasharray="5 4" />}
      {forma === 'retangulo' && <rect x="8" y="8" width="84" height="84" className={c} strokeDasharray="5 4" />}
      {forma === 'arco' && <path d="M12 92 V50 A38 38 0 0 1 88 50 V92Z" className={c} strokeDasharray="5 4" />}
      {forma === 'coracao' && <path d="M50 88 C10 60 5 30 28 20 C40 15 50 25 50 32 C50 25 60 15 72 20 C95 30 90 60 50 88Z" className={c} strokeDasharray="5 4" />}
      {forma === 'estrela' && <polygon points="50,6 61,38 95,38 67,58 78,92 50,72 22,92 33,58 5,38 39,38" className={c} strokeDasharray="5 4" />}
      {forma === 'hexagono' && <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" className={c} strokeDasharray="5 4" />}
    </svg>
  )
}
