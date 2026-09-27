'use client'
// SOA Design — MOCKUP DE PRODUTOS: USAR mockup (a única porta de gerar: artes → face certa → lote) · CRIAR / meus
// mockups (definir as faces uma vez) · biblioteca autoral por segmento · cenas · kits de listagem.
'use no memo'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Trash2, Pencil, ArrowRight } from 'lucide-react'
import { listarMockupsSalvos, mockupsDaBiblioteca, prepararSalvo, type MockupPronto } from '@/lib/estudio/mockupCliente'
import type { ConfigCena, ConfigKitListagem } from '@/lib/estudio/mockupTipos'
import { CENA_PADRAO } from '@/lib/estudio/mockupTipos'
import UsarMockup from './UsarMockup'
import NovoMockup from './NovoMockup'
import MockupFoto from './MockupFoto'
import FiltroSegmento, { filtrarPorSegmento } from './FiltroSegmento'
import { EditorCenas, EditorKits } from './CenasKits'
import { btn, cartao } from '../caixas/comum'

const ABAS = [
  { id: 'usar', nome: 'Usar mockup (gerar fotos)' },
  { id: 'criar', nome: 'Criar / meus mockups' },
  { id: 'biblioteca', nome: 'Biblioteca' },
  { id: 'cenas', nome: 'Cenas' },
  { id: 'kits', nome: 'Kits de listagem' },
] as const
type Salvo<T> = { id: string; nome: string; valor: T }
const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)

export default function PainelMockups() {
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('usar')
  const [usarId, setUsarId] = useState<string | null>(null)
  const [editar, setEditar] = useState<MockupPronto | null>(null)
  const [meus, setMeus] = useState<MockupPronto[] | null>(null)
  const [bib, setBib] = useState<MockupPronto[] | null>(null)
  const [cenas, setCenas] = useState<Salvo<ConfigCena>[]>([])
  const [kits, setKits] = useState<Salvo<ConfigKitListagem>[]>([])
  const [novo, setNovo] = useState<{ editar: MockupPronto | null } | null>(null)
  const [erro, setErro] = useState('')
  const [segmento, setSegmento] = useState('')
  const [buscaBib, setBuscaBib] = useState('')

  const carregarMeus = async () => {
    try {
      const linhas = await listarMockupsSalvos()
      const prontos = await Promise.all(linhas.map(l => prepararSalvo(l).catch(() => null)))
      setMeus(prontos.filter((m): m is MockupPronto => !!m))
    } catch (e) { setErro((e as Error).message); setMeus([]) }
  }
  const carregarReceitas = () => {
    fetch('/api/estudio/cenas').then(r => r.json()).then(d => setCenas((d.itens || []).map((c: Record<string, unknown>) => ({
      id: String(c.id), nome: String(c.nome),
      valor: { ...CENA_PADRAO, fundo: j(c.fundo), sombra: j(c.sombra) || CENA_PADRAO.sombra, reflexo: Number(c.reflexo) || 0, luz: j(c.luz) || CENA_PADRAO.luz, props: j(c.props) || [], produto: (j(c.config) as { produto?: ConfigCena['produto'] })?.produto || CENA_PADRAO.produto },
    })))).catch(() => {})
    fetch('/api/estudio/kits-listagem').then(r => r.json()).then(d => setKits((d.itens || []).map((k: Record<string, unknown>) => {
      const cfg = (j(k.config) || {}) as Partial<ConfigKitListagem>
      return { id: String(k.id), nome: String(k.nome), valor: { tomadas: j(k.tomadas), tamanhos: j(k.tamanhos), medidas: cfg.medidas || { largura: 10, altura: 10, profundidade: null }, badge: cfg.badge || null, cenaId: cfg.cenaId || null } }
    }))).catch(() => {})
  }
  useEffect(() => {
    Promise.resolve().then(() => { carregarMeus(); carregarReceitas() })
    // a biblioteca é gerada por código: espera a tela pintar antes (leva ~2 s)
    const t = setTimeout(() => { try { setBib(mockupsDaBiblioteca(1400)) } catch (e) { setErro((e as Error).message); setBib([]) } }, 60)
    return () => clearTimeout(t)
  }, [])

  const todos = [...(meus || []), ...(bib || [])]
  const carregando = meus === null || bib === null
  const usar = (id: string) => { setUsarId(id); setAba('usar') }
  // a 1ª vez sem mockup nenhum: começa criando
  useEffect(() => { if (meus && !meus.length && aba === 'usar' && !usarId) Promise.resolve().then(() => setAba('criar')) }, [meus]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800">
        {ABAS.map(a => <button key={a.id} onClick={() => setAba(a.id)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>{a.nome}</button>)}
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {carregando && aba !== 'kits' && aba !== 'criar' && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Preparando os produtos…</p>}

      {aba === 'usar' && !carregando && <UsarMockup mockups={todos} cenas={cenas} kits={kits} inicial={usarId} />}
      {aba === 'criar' && (
        <div className="space-y-4">
          {!!meus?.length && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Meus mockups <span className="font-normal text-xs text-gray-500">— criados uma vez, reutilizados sempre</span></p>
              <Grade itens={meus} vazio="" acoes={m => (
                <div className="flex gap-1.5">
                  <button onClick={() => usar(m.id)} title="Usar (gerar fotos)" data-usar={m.nome}><ArrowRight className="w-3.5 h-3.5 text-orange-500 hover:text-orange-700" /></button>
                  <button onClick={() => (m.smart ? setEditar(m) : setNovo({ editar: m }))} title="Editar as faces"><Pencil className="w-3.5 h-3.5 text-gray-400 hover:text-orange-600" /></button>
                  <button onClick={async () => { if (confirm(`Excluir "${m.nome}"?`)) { await fetch(`/api/estudio/mockups/${m.id}`, { method: 'DELETE' }); carregarMeus() } }} title="Excluir"><Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" /></button>
                </div>
              )} />
            </div>
          )}
          <MockupFoto salvos={meus || []} onSalvo={carregarMeus} abrir={editar} onUsar={usar} />
        </div>
      )}
      {aba === 'biblioteca' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Produtos da biblioteca SOA — desenhados por nós (100% autorais), já com a área definida. Clique em → para usar, ou em “Criar / meus mockups → Escolher do acervo” para definir outras faces.</p>
          <FiltroSegmento itens={bib || []} segmento={segmento} onSegmento={setSegmento} busca={buscaBib} onBusca={setBuscaBib} />
          <Grade itens={filtrarPorSegmento(bib || [], segmento, buscaBib)} vazio="Nenhum produto nesse segmento." acoes={m => <button onClick={() => usar(m.id)} title="Usar (gerar fotos)"><ArrowRight className="w-3.5 h-3.5 text-orange-500" /></button>} />
        </div>
      )}
      {aba === 'cenas' && <EditorCenas cenas={cenas} amostra={(bib || [])[0] || null} onMudou={carregarReceitas} />}
      {aba === 'kits' && <EditorKits kits={kits} cenas={cenas} onMudou={carregarReceitas} />}
      {novo && <NovoMockup editar={novo.editar} onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); carregarMeus() }} />}
    </div>
  )
}

function Grade({ itens, vazio, acoes }: { itens: MockupPronto[]; vazio: string; acoes?: (m: MockupPronto) => React.ReactNode }) {
  if (!itens.length) return vazio ? <p className="text-xs text-gray-400">{vazio}</p> : null
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
      {itens.map(m => (
        <div key={m.id} className={`${cartao} !p-2 space-y-1`}>
          <Mini m={m} />
          <div className="flex items-center gap-1"><p className="text-xs truncate flex-1">{m.nome}</p>{acoes?.(m)}</div>
          <p className="text-[10px] text-gray-400">{m.medidas.largura}×{m.medidas.altura}{m.medidas.profundidade ? `×${m.medidas.profundidade}` : ''} cm · {m.smart ? `${m.smart.cfg.areas.length} face(s)` : m.cfg.area.tipo === 'malha' ? 'malha' : '4 pontos'}</p>
        </div>
      ))}
    </div>
  )
}
function Mini({ m }: { m: MockupPronto }) {
  const url = useMemo(() => {
    const src = m.smart?.foto || m.produto
    const k = 200 / Math.max(src.width, src.height), c = document.createElement('canvas')
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k)
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [m])
  return url ? <img src={url} alt={m.nome} className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 rounded-lg" />
}
