'use client'
// SOA Design — MOCKUP DE PRODUTOS. Abas:
//  · Usar mockup (gerar fotos) — a única porta de gerar (em massa, com fila em segundo plano);
//  · Criar mockup — foto do produto, acervo de bases do SOA ou faca DXF (definir as faces uma vez);
//  · Biblioteca (meus mockups) — os mockups DELA: usar, editar, duplicar, renomear, apelidos, excluir;
//  · Cenas (fundos prontos) — acervo autoral de cenários + as cenas dela;
//  · Caixas vivas — faca (regiões semânticas) + caixa com arte/apliques, saídas por referência (Fase 3);
//  · Kits — kit (slots → faca) + composições + temas + lote de kits + presets de exportação (Fases 4/5);
//  · Apliques — PNG → camadas geradas (papel, laminado, textura) com profundidade, presets e lote.
'use no memo'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { listarMockupsSalvos, prepararSalvo, type MockupPronto } from '@/lib/estudio/mockupCliente'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import { CENA_PADRAO } from '@/lib/estudio/mockupTipos'
import UsarMockup from './UsarMockup'
import NovoMockup from './NovoMockup'
import MockupFoto from './MockupFoto'
import BibliotecaMeus from './BibliotecaMeus'
import CenasProntas from './CenasProntas'
import CaixasVivas from './CaixasVivas'
import EditorAplique from './EditorAplique'
import KitComposer from './KitComposer'
import { useBaseEstudio } from '../caixas/comum'

const ABAS = [
  { id: 'usar', nome: 'Usar mockup (gerar fotos)' },
  { id: 'criar', nome: 'Criar mockup' },
  { id: 'biblioteca', nome: 'Biblioteca (meus mockups)' },
  { id: 'cenas', nome: 'Cenas (fundos prontos)' },
  { id: 'caixas', nome: 'Caixas vivas (faca + arte)' },
  { id: 'apliques', nome: 'Apliques' },
  { id: 'kits', nome: 'Kits (composer + lote)' },
] as const
type Aba = (typeof ABAS)[number]['id']
type Salvo<T> = { id: string; nome: string; valor: T; curada?: boolean; categoria?: string | null; tags?: string[] }
const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)
const CHAVE_CENA = 'soa:mockup:cena'

export default function PainelMockups() {
  const { workspaceId } = useBaseEstudio()
  const [aba, setAba] = useState<Aba>('usar')
  const [usarId, setUsarId] = useState<string | null>(null)
  const [editar, setEditar] = useState<MockupPronto | null>(null)
  const [linhas, setLinhas] = useState<MockupPronto[] | null>(null)
  const [cenas, setCenas] = useState<Salvo<ConfigCena>[]>([])
  const [cenaEscolhida, setCenaEscolhida] = useState<string | null>(null)
  const [novo, setNovo] = useState<{ editar: MockupPronto | null } | null>(null)
  const [erro, setErro] = useState('')

  const carregarMeus = async () => {
    try {
      const ls = await listarMockupsSalvos()
      const prontos = await Promise.all(ls.map(l => prepararSalvo(l).catch(() => null)))
      setLinhas(prontos.filter((m): m is MockupPronto => !!m))
    } catch (e) { setErro((e as Error).message); setLinhas([]) }
  }
  const carregarCenas = () => {
    fetch('/api/estudio/cenas').then(r => r.json()).then(d => setCenas((d.itens || []).map((c: Record<string, unknown>) => ({
      // curada = acervo do Master (autoral/licenciado, publicado para todos) — aparece com ★
      id: String(c.id), nome: c.aprovadaGlobal && c.workspaceId !== workspaceId ? `★ ${c.nome}` : String(c.nome), curada: !!c.aprovadaGlobal && c.workspaceId !== workspaceId, categoria: (c.categoria as string) || null, tags: (j(c.tags) as string[]) || [],
      valor: { ...CENA_PADRAO, fundo: j(c.fundo), sombra: j(c.sombra) || CENA_PADRAO.sombra, reflexo: Number(c.reflexo) || 0, luz: j(c.luz) || CENA_PADRAO.luz, props: j(c.props) || [], produto: (j(c.config) as { produto?: ConfigCena['produto'] })?.produto || CENA_PADRAO.produto },
    })))).catch(() => {})
  }
  useEffect(() => {
    Promise.resolve().then(() => {
      carregarMeus(); carregarCenas()
      try { const c = localStorage.getItem(CHAVE_CENA); if (c) setCenaEscolhida(c) } catch { /* sem localStorage */ }
    })
  }, [])

  // Biblioteca = SÓ os mockups que ela criou (itens aprovados globalmente de outras contas ficam de fora)
  const meus = (linhas || []).filter(m => !workspaceId || !m.linha?.workspaceId || m.linha.workspaceId === workspaceId)
  const carregando = linhas === null
  const usar = (id: string) => { setUsarId(`${id}#${Date.now()}`); setAba('usar') }
  const usarCena = (id: string) => { setCenaEscolhida(id); try { localStorage.setItem(CHAVE_CENA, id) } catch { /* ok */ } setAba('usar') }
  const editarMockup = (m: MockupPronto) => { if (m.smart) { setEditar(m); setAba('criar') } else setNovo({ editar: m }) }
  // a 1ª vez sem mockup nenhum: começa criando
  useEffect(() => { if (linhas && !meus.length && aba === 'usar' && !usarId) Promise.resolve().then(() => setAba('criar')) }, [linhas]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800" role="tablist">
        {ABAS.map(a => <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => { setAba(a.id); if (a.id === 'criar') setEditar(null) }} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}>{a.nome}</button>)}
      </div>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {carregando && aba !== 'criar' && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando seus mockups…</p>}

      {/* o Usar fica montado (só escondido): trocar de aba não perde as artes nem a conferência */}
      {!carregando && <div className={aba === 'usar' ? '' : 'hidden'}><UsarMockup mockups={meus} cenas={cenas} inicial={usarId} cenaInicial={cenaEscolhida} /></div>}
      {aba === 'criar' && <MockupFoto salvos={meus} onSalvo={carregarMeus} abrir={editar} onUsar={usar} />}
      {aba === 'biblioteca' && !carregando && <BibliotecaMeus itens={meus} onUsar={usar} onEditar={editarMockup} onMudou={carregarMeus} />}
      {aba === 'cenas' && <CenasProntas meus={meus} cenas={cenas} cenaAtual={cenaEscolhida} onUsar={usarCena} onMudou={carregarCenas} />}
      {aba === 'caixas' && !carregando && <CaixasVivas mockups={meus} onMockupsMudaram={carregarMeus} />}
      {aba === 'apliques' && <EditorAplique />}
      {aba === 'kits' && <KitComposer cenasDela={cenas} />}
      {novo && <NovoMockup editar={novo.editar} onFechar={() => setNovo(null)} onSalvo={() => { setNovo(null); carregarMeus() }} />}
    </div>
  )
}
