'use client'
// SOA Design — CENAS = acervo de fundos/cenários PRONTOS (autorais, gerados por código): lisos, degradês, estúdio,
// superfícies, festa e temas. Filtro por categoria + busca; "Usar esta cena" leva para o Usar mockup com ela marcada.
// Embaixo, as cenas próprias dela (com foto de fundo, se quiser).
'use no memo'
import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Loader2 } from 'lucide-react'
import { CENAS_PRONTAS, CATEGORIAS_CENA } from '@/lib/estudio/cenasProntas'
import { renderCena, aparar, comporMockup } from '@/lib/estudio/mockup'
import { arteDeTeste, mockupsDaBiblioteca, type MockupPronto } from '@/lib/estudio/mockupCliente'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import { EditorCenas } from './CenasKits'
import { cartao, inp } from '../caixas/comum'

type Salvo = { id: string; nome: string; valor: ConfigCena }

export default function CenasProntas({ meus, cenas, cenaAtual, onUsar, onMudou }: { meus: MockupPronto[]; cenas: Salvo[]; cenaAtual: string | null; onUsar: (id: string) => void; onMudou: () => void }) {
  const [cat, setCat] = useState(''); const [busca, setBusca] = useState('')
  const [amostraBib, setAmostraBib] = useState<MockupPronto | null>(null)
  // produto de exemplo: um mockup dela já recortado (acervo/faca) ou um produto do acervo SOA
  const dela = meus.find(m => m.smart?.cfg.transparente)
  useEffect(() => {
    const t = setTimeout(() => { try { const b = mockupsDaBiblioteca(600); setAmostraBib(b.find(x => x.categoria === 'caixa') || b[0] || null) } catch { /* sem exemplo */ } }, 30)
    return () => clearTimeout(t)
  }, [])
  const produto = useMemo(() => {
    if (dela?.smart) return aparar(dela.smart.foto)
    if (amostraBib) return aparar(comporMockup(amostraBib.produto, arteDeTeste(), amostraBib.cfg))
    return null
  }, [dela, amostraBib])
  const lista = CENAS_PRONTAS.filter(c => (!cat || c.categoria === cat) && (!busca.trim() || `${c.nome} ${c.categoria}`.toLowerCase().includes(busca.trim().toLowerCase())))
  const miniaturas = useMemo(() => {
    const m = new Map<string, string>()
    if (!produto) return m
    for (const c of CENAS_PRONTAS) m.set(c.id, renderCena(produto, c.cena, 240, 240).toDataURL('image/jpeg', 0.8))
    return m
  }, [produto])

  return (
    <div className="space-y-4">
      <div className={`${cartao} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 flex-1"><b>Cenas prontas</b> — fundos e cenários autorais para a foto do produto. Escolha uma e ela já vai marcada em <b>Usar mockup</b>.</p>
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-gray-400" /><input className={inp + ' !pl-7 !w-48'} placeholder="Buscar cena" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['', ...CATEGORIAS_CENA].map(c => <button key={c || 'todas'} onClick={() => setCat(c)} className={`text-xs rounded-full px-2.5 py-0.5 border ${cat === c ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700'}`}>{c || 'Todas'}</button>)}
        </div>
        {!produto && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparando as prévias…</p>}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" data-cenas-prontas>
          {lista.map(c => (
            <button key={c.id} onClick={() => onUsar(c.id)} data-cena-pronta={c.nome} className={`relative rounded-xl border p-1.5 text-left hover:border-orange-400 ${cenaAtual === c.id ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`} title="Usar esta cena">
              {miniaturas.get(c.id) ? <img src={miniaturas.get(c.id)} alt="" className="w-full aspect-square object-cover rounded-lg" /> : <div className="w-full aspect-square rounded-lg bg-gray-100 dark:bg-gray-800" />}
              <p className="text-[11px] mt-1 truncate">{c.nome}</p>
              <p className="text-[9px] text-gray-400">{c.categoria}</p>
              {cenaAtual === c.id && <Check className="absolute top-2 right-2 w-4 h-4 text-orange-500" />}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Minhas cenas <span className="font-normal text-xs text-gray-500">— monte a sua (cor, degradê, textura ou foto de fundo)</span></p>
        <EditorCenas cenas={cenas} amostra={amostraBib} onMudou={onMudou} />
      </div>
    </div>
  )
}
