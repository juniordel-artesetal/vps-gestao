'use client'
// SOA Design — CENAS = acervo de fundos/cenários PRONTOS (autorais, gerados por código): lisos, degradês, estúdio,
// superfícies, festa e temas. Filtro por categoria + busca; "Usar esta cena" leva para o Usar mockup com ela marcada.
// Embaixo, as cenas próprias dela (com foto de fundo, se quiser).
'use no memo'
import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Loader2, Eye } from 'lucide-react'
import { CENAS_PRONTAS } from '@/lib/estudio/cenasProntas'
import { renderCena, aparar, comporMockup } from '@/lib/estudio/mockup'
import { arteDeTeste, mockupsDaBiblioteca, type MockupPronto } from '@/lib/estudio/mockupCliente'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import { EditorCenas } from './CenasKits'
import { cartao, inp, btn } from '../caixas/comum'
import { chamarIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { enviarArquivo } from '@/lib/estudio/cliente'
import { blobDe, novoCanvas, carregarImagem } from '@/lib/estudio/mockup'
import { CENA_PADRAO } from '@/lib/estudio/mockupTipos'
import { useBaseEstudio } from '../caixas/comum'

type Salvo = { id: string; nome: string; valor: ConfigCena; curada?: boolean; categoria?: string | null; tags?: string[] }

export default function CenasProntas({ meus, cenas, cenaAtual, onUsar, onMudou }: { meus: MockupPronto[]; cenas: Salvo[]; cenaAtual: string | null; onUsar: (id: string) => void; onMudou: () => void }) {
  const [cat, setCat] = useState(''); const [busca, setBusca] = useState('')
  const { workspaceId, storage } = useBaseEstudio()
  const [iaMsg, setIaMsg] = useState(''); const [iaOcupada, setIaOcupada] = useState(false)
  /** IA de conteúdo (opcional): um fundo novo combinando com o tema — vira uma cena DELA (foto no Blob), reutilizável sem IA. */
  async function cenaPorTemaIA() {
    const tema = prompt('Tema da cena (ex.: fundo do mar, safari, jardim encantado):', '')?.trim()
    if (!tema || !confirm(CUSTO_IA)) return
    if (!storage || !workspaceId) { setIaMsg('Armazenamento indisponível.'); return }
    setIaOcupada(true); setIaMsg('')
    try {
      const r = await chamarIA('fundo-tema', { tema, proporcao: '1:1' })
      if (!r.ok || !r.imagem) { setIaMsg(r.ok ? 'A IA não devolveu imagem.' : r.mensagem); return }
      const c = novoCanvas(r.imagem.naturalWidth, r.imagem.naturalHeight); c.getContext('2d')!.drawImage(r.imagem, 0, 0)
      const up = await enviarArquivo(await blobDe(c, 'image/jpeg', 0.92), `cena-${tema}.jpg`, 'imagem', workspaceId, { pasta: 'Cenas' })
      const corpo = { nome: `${tema} (IA)`, fundo: { tipo: 'foto', url: up.url, assetId: up.id }, sombra: CENA_PADRAO.sombra, reflexo: 0, luz: CENA_PADRAO.luz, props: [], config: { produto: { cx: 0.5, cy: 0.6, altura: 0.6 } }, categoria: 'Geradas por IA' }
      const rr = await fetch('/api/estudio/cenas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      if (!rr.ok) { setIaMsg('Não consegui salvar a cena.'); return }
      setIaMsg(`Cena “${corpo.nome}” criada em Minhas cenas — já dá para usar em qualquer mockup ou kit.`); onMudou()
    } finally { setIaOcupada(false) }
  }
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
  // catálogo único: cenas do SOA (desenhadas) + acervo curado pelo Master (fotos autorais/licenciadas)
  const curadas = cenas.filter(c => c.curada)
  const catalogo = [...CENAS_PRONTAS.map(c => ({ id: c.id, nome: c.nome, categoria: c.categoria, tags: c.tags, cena: c.cena, curada: false })), ...curadas.map(c => ({ id: c.id, nome: c.nome, categoria: c.categoria || 'Curadas', tags: c.tags || [], cena: c.valor, curada: true }))]
  const categorias = [...new Set(catalogo.map(c => c.categoria))]
  const termo = busca.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const lista = catalogo.filter(c => (!cat || c.categoria === cat || (cat === '★' && c.curada)) && (!termo || `${c.nome} ${c.categoria} ${c.tags.join(' ')}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(termo)))
  const [imgs, setImgs] = useState<Map<string, HTMLImageElement>>(new Map())
  useEffect(() => {   // fotos das cenas curadas (para a prévia)
    let vivo = true
    ;(async () => { const m = new Map<string, HTMLImageElement>(); for (const c of curadas) { const f = c.valor.fundo; if (f.tipo === 'foto') { const im = await carregarImagem(f.url).catch(() => null); if (im) m.set(f.url, im) } } if (vivo) setImgs(m) })()
    return () => { vivo = false }
  }, [curadas.map(c => c.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const miniaturas = useMemo(() => {
    const m = new Map<string, string>()
    if (!produto) return m
    for (const c of catalogo) m.set(c.id, renderCena(produto, c.cena, 260, 260, u => imgs.get(u)).toDataURL('image/jpeg', 0.82))
    return m
  }, [produto, imgs, catalogo.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const [grande, setGrande] = useState<string | null>(null)
  const cenaGrande = catalogo.find(c => c.id === grande)
  const urlGrande = useMemo(() => (cenaGrande && produto ? renderCena(produto, cenaGrande.cena, 900, 900, u => imgs.get(u)).toDataURL('image/jpeg', 0.9) : null), [cenaGrande, produto, imgs])

  return (
    <div className="space-y-4">
      <div className={`${cartao} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-300 flex-1"><b>Cenas prontas</b> — fundos e cenários autorais para a foto do produto. Escolha uma e ela já vai marcada em <b>Usar mockup</b>.</p>
          <button onClick={cenaPorTemaIA} disabled={iaOcupada} className={btn + ' !text-xs'} data-cena-ia>{iaOcupada ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Gerar cena por tema (IA)</button>
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-gray-400" /><input className={inp + ' !pl-7 !w-48'} placeholder="Buscar cena" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['', ...categorias, ...(curadas.length ? ['★'] : [])].map(c => <button key={c || 'todas'} onClick={() => setCat(c)} className={`text-xs rounded-full px-2.5 py-0.5 border ${cat === c ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700'}`} data-cat-cena={c || 'Todas'}>{c === '★' ? '★ Curadas' : c || 'Todas'} <span className="text-gray-400">{c ? catalogo.filter(x => x.categoria === c || (c === '★' && x.curada)).length : catalogo.length}</span></button>)}
        </div>
        {iaMsg && <p className="text-xs text-emerald-700" data-ia-cena-msg>{iaMsg}</p>}
        {!produto && <p className="text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Preparando as prévias…</p>}
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6" data-cenas-prontas>
          {lista.map(c => (
            <div key={c.id} className="relative group"><button onClick={() => setGrande(c.id)} title="Ver grande" className="absolute top-2 left-2 z-10 rounded-full bg-white/90 text-gray-700 p-1 opacity-0 group-hover:opacity-100 shadow" data-ver-cena={c.nome}><Eye className="w-3.5 h-3.5" /></button>
            <button onClick={() => onUsar(c.id)} data-cena-pronta={c.nome} className={`relative rounded-xl border p-1.5 text-left hover:border-orange-400 ${cenaAtual === c.id ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`} title="Usar esta cena">
              {miniaturas.get(c.id) ? <img src={miniaturas.get(c.id)} alt="" className="w-full aspect-square object-cover rounded-lg" /> : <div className="w-full aspect-square rounded-lg bg-gray-100 dark:bg-gray-800" />}
              <p className="text-[11px] mt-1 truncate">{c.nome}</p>
              <p className="text-[9px] text-gray-400">{c.curada ? '★ curada · ' : ''}{c.categoria}</p>
              {cenaAtual === c.id && <Check className="absolute top-2 right-2 w-4 h-4 text-orange-500" />}
            </button></div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Minhas cenas <span className="font-normal text-xs text-gray-500">— monte a sua (cor, degradê, textura ou foto de fundo)</span></p>
        <EditorCenas cenas={cenas.filter(c => !c.curada)} amostra={amostraBib} onMudou={onMudou} />
      </div>
      {cenaGrande && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setGrande(null)} data-previa-cena>
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-gray-900 p-3 space-y-2" onClick={e => e.stopPropagation()}>
            {urlGrande ? <img src={urlGrande} alt={cenaGrande.nome} className="w-full rounded-xl" /> : <div className="aspect-square flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}
            <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1">{cenaGrande.nome} <span className="font-normal text-xs text-gray-500">{cenaGrande.categoria}{cenaGrande.tags.length ? ` · ${cenaGrande.tags.join(', ')}` : ''}</span></p>
              <button onClick={() => setGrande(null)} className={btn + ' !text-xs'}>Fechar</button>
              <button onClick={() => { const id = cenaGrande.id; setGrande(null); onUsar(id) }} className="rounded-xl bg-orange-500 text-white text-xs font-semibold px-3 py-1.5" data-usar-cena-grande>Usar esta cena</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
