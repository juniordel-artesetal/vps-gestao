'use client'
// app/master/receitas/page.tsx
// Gestão de Receitas do SOA — o dinheiro do negócio de ponta a ponta (Asaas + Hotmart). SOMENTE LEITURA:
// tudo vem do espelho local; "Sincronizar Hotmart" e "Atualizar do gateway" (1 assinante) são opt-in.

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Search, X, ExternalLink, Copy, AlertTriangle, Info } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts'

type Soma = { bruto: number; liquido: number; n: number }
interface Painel {
  periodo: { de: string; ate: string; rotulo: string }
  comercial: { faturamento: { bruto: number; liquido: number; pagamentos: number }; mrr: number; arr: number; anual: { ativas: number; faturamentoPeriodo: { bruto: number; liquido: number }; mrrAnual: number; pctMrr: number } }
  resumo: {
    ativas: { total: number; asaas: number; hotmart: number; sobreposicao: number }
    inadimplentesAgora: { contas: number; valor: number }
    novosInadimplentes: Record<'periodo' | 'semana' | 'mes' | 'ano', { contas: number; valor: number }>
    novas: { asaas: number; hotmart: number }
    churn: { asaasCanceladas: number; asaasCortadas: number; hotmart: number; hotmartMigraram: number }
    estornos: { asaas: number; hotmart: number }
  }
  asaas: { ativas: { total: number; mensais: number; anuais: number; mrrMensais: number; mrrAnuais: number; mrr: number }; ativasSemCobranca: number; receitaPeriodo: Soma; receitaMes: Soma; receitaAno: Soma; emAberto: { cobravel: number; contasCobraveis: number; deCortadas: number }; canceladasPeriodo: number; cortadasPeriodo: number; contasNoBanco: { ativa: number; inadimplente: number } }
  hotmart: { ativas: { total: number; mensais: number; anuais: number; mrrMensais: number; mrrAnuais: number; mrr: number }; receitaPeriodo: Soma; receitaMes: Soma; receitaAno: Soma; comissaoHotmartPeriodo: number; inadimplentes: number; emAberto: number; inadimplentesComAcesso: number; nuncaPagaram: number; perdidas: number; migraram: number; canceladasPeriodo: number; migraramPeriodo: number; contasNoBanco: { ativa: number } }
  porPlano: { mensais: { asaas: number; hotmart: number; mrr: number }; anuais: { asaas: number; hotmart: number; mrr: number } }
  addons: { pessoalAtivas: number; pessoalMrr: number; marketplacesAtivas: number; marketplacesMrr: number }
  inadimplencia: { gateway: 'asaas' | 'hotmart'; workspaceId: string | null; nome: string | null; email: string | null; valor: number; vencimento: string | null; cobrancas: number; situacaoConta: string | null; cobravel: boolean }[]
  tendencia: { mes: string; asaasBruto: number; asaasLiquido: number; hotmartBruto: number; hotmartLiquido: number; novas: number; churn: number; inadimplencia: number; inadimplentes: number }[]
  sync: { asaasUltimoEvento: string | null; hotmartUltimoEvento: string | null; hotmartUltimoSync: string | null; hotmartEspelho: number; hotmartCredencial: boolean }
}
interface Hist { gateway: 'asaas' | 'hotmart'; id: string; vencimento: string | null; pagamento: string | null; bruto: number; liquido: number | null; forma: string | null; status: string; invoiceUrl: string | null }
interface Perfil {
  dados: { id: string; nome: string; email: string | null; pessoa: string | null; telefone: string | null; plano: string | null; valorAtual: number | null; status: string | null; origem: string | null; adesao: string | null; contaCriadaEm: string; proximoVencimento: string | null; cortesia: boolean; acessoAte: string | null
    assinaturasAsaas: { id: string; status: string; ciclo: string | null; valor: number; proximo: string | null; canceladaEm: string | null }[]
    assinaturasHotmart: { codigo: string; situacao: string; anual: boolean; valor: number; proxima: string | null; ultimoEvento: string }[] }
  historico: Hist[]
  proximas: { gateway: string; vencimento: string | null; valor: number; invoiceUrl: string | null }[]
  totais: { pagoLiquido: number; pagoBruto: number; mesesPagos: number; primeira: string | null; ultima: string | null }
}
interface Vivo { atualizadoEm: string; clientesAsaas: number; atualizadas: number; inseridas: number; aoVivo: { id: string; status: string; valor: number; vencimento: string | null; invoiceUrl: string | null }[]; assinaturasAoVivo: { id: string; status: string; ciclo: string | null; valor: number; proximo: string | null }[]; telefone: string | null; hotmart: string; avisos: string[] }

const brl = (v: number | null | undefined) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCurto = (v: number) => (Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : brl(v))
const data = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')
const quando = (s: string | null | undefined) => (s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca')
const mesCurto = (m: string) => { const [a, mm] = m.split('-'); return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(mm) - 1]}/${a.slice(2)}` }
const FORMA: Record<string, string> = { PIX: 'Pix', CREDIT_CARD: 'Cartão', DEBIT_CARD: 'Débito', BOLETO: 'Boleto', UNDEFINED: 'A escolher', PIX_AUTOMATIC: 'Pix automático', BILLET: 'Boleto' }
const COR_STATUS: Record<string, string> = { RECEBIDO: 'bg-emerald-500/15 text-emerald-300', VENCIDO: 'bg-red-500/15 text-red-300', PENDENTE: 'bg-amber-500/15 text-amber-300', ESTORNADO: 'bg-gray-500/20 text-gray-300', REMOVIDA: 'bg-gray-700/40 text-gray-500', CHARGEBACK: 'bg-red-500/15 text-red-300' }
const card = 'rounded-2xl border border-gray-800 bg-gray-900 p-4'
const rotulo = 'text-[11px] uppercase tracking-wider text-gray-500'
const btn = 'inline-flex items-center gap-1.5 rounded-xl border border-gray-700 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-40'
const inp = 'bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'
const C_ASAAS = '#38bdf8', C_HOT = '#f97316'

function Numero({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub?: React.ReactNode; destaque?: string }) {
  return (
    <div className={card}>
      <p className={rotulo}>{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${destaque ?? 'text-white'}`}>{valor}</p>
      {sub && <div className="mt-1 text-xs text-gray-400 space-y-0.5">{sub}</div>}
    </div>
  )
}
const Linha = ({ k, v, cor }: { k: string; v: React.ReactNode; cor?: string }) => (
  <div className="flex justify-between gap-3 py-1 text-sm border-b border-gray-800/60 last:border-0"><span className="text-gray-400">{k}</span><span className={`tabular-nums font-medium ${cor ?? 'text-gray-100'}`}>{v}</span></div>
)

export default function ReceitasMaster() {
  const router = useRouter()
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'ano' | 'custom'>('mes')
  const [de, setDe] = useState(''), [ate, setAte] = useState('')
  const [p, setP] = useState<Painel | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const [msgSync, setMsgSync] = useState('')
  const [soCobraveis, setSoCobraveis] = useState(true)
  // busca / perfil
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nome: string; status: string | null; origem: string | null; email: string | null; pessoa: string | null }[]>([])
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [vivo, setVivo] = useState<Vivo | null>(null)
  const [carregandoPerfil, setCarregandoPerfil] = useState(false)
  const [atualizando, setAtualizando] = useState(false)
  const [copiado, setCopiado] = useState('')

  const carregar = useCallback(async () => {
    if (periodo === 'custom' && (!de || !ate)) return
    setCarregando(true); setErro('')
    try {
      const qs = new URLSearchParams({ periodo, ...(periodo === 'custom' ? { de, ate } : {}) })
      const r = await fetch(`/api/master/receitas?${qs}`)
      if (r.status === 401) { router.push('/master/login'); return }
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar')
      setP(j)
    } catch (e) { setErro((e as Error).message) } finally { setCarregando(false) }
  }, [periodo, de, ate, router])
  useEffect(() => { carregar() }, [carregar])

  // busca com atraso (enquanto digita)
  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/master/receitas/assinante?q=${encodeURIComponent(q.trim())}`)
      if (r.ok) setResultados((await r.json()).resultados ?? [])
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  async function abrirPerfil(id: string) {
    setCarregandoPerfil(true); setVivo(null); setResultados([])
    try {
      const r = await fetch(`/api/master/receitas/assinante?id=${encodeURIComponent(id)}`)
      if (r.ok) setPerfil(await r.json())
    } finally { setCarregandoPerfil(false) }
    setTimeout(() => document.getElementById('perfil-assinante')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  async function atualizarDoGateway() {
    if (!perfil) return
    setAtualizando(true)
    try {
      const r = await fetch('/api/master/receitas/assinante', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: perfil.dados.id }) })
      const j = await r.json()
      if (r.ok) { setVivo(j.vivo); if (j.perfil) setPerfil(j.perfil) } else alert(j.error || 'Erro ao atualizar')
    } finally { setAtualizando(false) }
  }
  async function sincronizarHotmart() {
    setSincronizando(true); setMsgSync('')
    try {
      const r = await fetch('/api/master/hotmart/sync', { method: 'POST' })
      const j = await r.json()
      setMsgSync(r.ok ? `Hotmart sincronizada: ${j.gravadas ?? j.total} assinaturas.` : (j.error || 'Falhou'))
      if (r.ok) carregar()
    } finally { setSincronizando(false) }
  }
  const copiar = (t: string) => { navigator.clipboard?.writeText(t); setCopiado(t); setTimeout(() => setCopiado(''), 1500) }

  const inad = (p?.inadimplencia ?? []).filter(x => !soCobraveis || x.cobravel)
  const tend = (p?.tendencia ?? []).map(t => ({ ...t, rotulo: mesCurto(t.mes) }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      {/* topo */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => router.push('/master')} className="rounded-xl p-2 hover:bg-gray-800" aria-label="Voltar ao Master"><ArrowLeft size={18} /></button>
        <div className="mr-auto">
          <h1 className="text-xl font-bold">Gestão de Receitas</h1>
          <p className="text-xs text-gray-500">Asaas + Hotmart · leitura do espelho local · {p?.periodo.rotulo ?? '…'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
          {(['semana', 'mes', 'ano', 'custom'] as const).map(x => (
            <button key={x} onClick={() => setPeriodo(x)} className={`rounded-lg px-3 py-1 text-sm ${periodo === x ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              {x === 'semana' ? 'Semana' : x === 'mes' ? 'Mês' : x === 'ano' ? 'Ano' : 'Personalizado'}
            </button>
          ))}
        </div>
        {periodo === 'custom' && <div className="flex items-center gap-1"><input type="date" value={de} onChange={e => setDe(e.target.value)} className={inp} aria-label="De" /><span className="text-gray-500">a</span><input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inp} aria-label="Até" /></div>}
        <button onClick={carregar} className={btn} disabled={carregando}><RefreshCw size={14} className={carregando ? 'animate-spin' : ''} /> Recarregar</button>
      </div>

      {/* sincronização */}
      {p && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-800 bg-gray-900/60 px-4 py-2 text-xs text-gray-400">
          <span><b className="text-sky-300">Asaas</b> · atualizado pelo webhook · último evento {quando(p.sync.asaasUltimoEvento)}</span>
          <span><b className="text-orange-300">Hotmart</b> · último evento {quando(p.sync.hotmartUltimoEvento)} · espelho da API: {p.sync.hotmartCredencial ? `sincronizado ${quando(p.sync.hotmartUltimoSync)} (${p.sync.hotmartEspelho})` : <span className="text-amber-300">aguardando credenciais</span>}</span>
          <button onClick={sincronizarHotmart} disabled={!p.sync.hotmartCredencial || sincronizando} className={btn + ' ml-auto !py-1 !text-xs'} title={p.sync.hotmartCredencial ? 'Puxa todas as assinaturas da Hotmart (devagar)' : 'Configure HOTMART_CLIENT_ID/SECRET no servidor'}>
            <RefreshCw size={12} className={sincronizando ? 'animate-spin' : ''} /> Sincronizar Hotmart agora
          </button>
          {msgSync && <span className="w-full text-emerald-300">{msgSync}</span>}
        </div>
      )}

      {erro && <div className="rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">{erro}</div>}
      {!p && carregando && <div className="py-20 text-center text-gray-500">Carregando…</div>}

      {p && <>
        {/* 0) GESTÃO COMERCIAL — o headline */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300">Quanto estou faturando de verdade</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <div className={card + ' border-emerald-800/60'}>
              <p className={rotulo}>Faturamento (caixa) · {p.periodo.rotulo}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-300">{brl(p.comercial.faturamento.liquido)}</p>
              <p className="text-xs text-gray-400">líquido (já sem a taxa do Asaas e a comissão da Hotmart)</p>
              <p className="mt-2 text-sm tabular-nums text-gray-300">Bruto {brl(p.comercial.faturamento.bruto)} · {p.comercial.faturamento.pagamentos} pagamentos</p>
            </div>
            <div className={card + ' border-sky-800/60'}>
              <p className={rotulo}>Receita ativa (MRR)</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-sky-300">{brl(p.comercial.mrr)}<span className="text-base text-gray-500"> /mês</span></p>
              <p className="text-xs text-gray-400">mensais × valor + anuais × valor ÷ 12 (valor real de cada assinatura)</p>
              <p className="mt-2 text-sm tabular-nums text-gray-300">ARR {brl(p.comercial.arr)} /ano</p>
            </div>
            <div className={card + ' border-violet-800/60'}>
              <p className={rotulo}>Receita do plano anual</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-violet-300">{p.comercial.anual.ativas} <span className="text-base text-gray-500">anuais ativas</span></p>
              <p className="text-xs text-gray-400">{p.comercial.anual.pctMrr}% do MRR ({brl(p.comercial.anual.mrrAnual)}/mês) · mensal {Math.round((100 - p.comercial.anual.pctMrr) * 10) / 10}%</p>
              <p className="mt-2 text-sm tabular-nums text-gray-300">À vista no período: {brl(p.comercial.anual.faturamentoPeriodo.liquido)} líquido</p>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-gray-900/60 px-3 py-2 text-xs text-gray-400"><Info size={14} className="mt-0.5 shrink-0 text-sky-400" />
            <span><b className="text-gray-200">Faturamento</b> é o dinheiro que entrou no período: sobe num mês com muitos anuais pagos à vista. <b className="text-gray-200">Receita ativa (MRR)</b> é o que o negócio gera por mês de forma recorrente, com o anual dividido por 12: fica estável. Olhe os dois juntos.</span></p>
        </section>

        {/* 1) RESUMO */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Numero titulo="Assinantes ativas (pagantes)" valor={String(p.resumo.ativas.total)} sub={<><p>Asaas {p.resumo.ativas.asaas} · Hotmart {p.resumo.ativas.hotmart}</p>{p.resumo.ativas.sobreposicao > 0 && <p className="text-gray-500">{p.resumo.ativas.sobreposicao} nos dois (contadas 1×)</p>}</>} />
          <Numero titulo="Inadimplentes agora" valor={String(p.resumo.inadimplentesAgora.contas)} destaque="text-red-300" sub={<p>{brl(p.resumo.inadimplentesAgora.valor)} em aberto</p>} />
          <Numero titulo={`Novos inadimplentes · ${p.periodo.rotulo}`} valor={String(p.resumo.novosInadimplentes.periodo.contas)} destaque="text-amber-300" sub={<p>{brl(p.resumo.novosInadimplentes.periodo.valor)}</p>} />
          <Numero titulo={`Novas assinantes · ${p.periodo.rotulo}`} valor={String(p.resumo.novas.asaas + p.resumo.novas.hotmart)} destaque="text-emerald-300" sub={<p>Asaas {p.resumo.novas.asaas} · Hotmart {p.resumo.novas.hotmart}</p>} />
          <Numero titulo={`Churn · ${p.periodo.rotulo}`} valor={String(p.resumo.churn.asaasCanceladas + p.resumo.churn.asaasCortadas + p.resumo.churn.hotmart)} destaque="text-rose-300"
            sub={<><p>Asaas: {p.resumo.churn.asaasCanceladas} canceladas + {p.resumo.churn.asaasCortadas} cortadas</p><p>Hotmart: {p.resumo.churn.hotmart}{p.resumo.churn.hotmartMigraram ? ` (+${p.resumo.churn.hotmartMigraram} migraram p/ Asaas)` : ''}</p>{(p.resumo.estornos.asaas + p.resumo.estornos.hotmart) > 0 && <p>Estornos: {p.resumo.estornos.asaas + p.resumo.estornos.hotmart}</p>}</>} />
        </section>

        {/* 2) ASAAS · 3) HOTMART */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className={card}>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C_ASAAS }} /> Asaas</h3>
            <Linha k="Ativas pagantes" v={`${p.asaas.ativas.total} (${p.asaas.ativas.mensais} mensais · ${p.asaas.ativas.anuais} anuais)`} />
            <Linha k="MRR" v={`${brl(p.asaas.ativas.mrr)} (mensal ${brl(p.asaas.ativas.mrrMensais)} · anual ${brl(p.asaas.ativas.mrrAnuais)})`} cor="text-sky-300" />
            <Linha k={`Recebido · ${p.periodo.rotulo}`} v={<>{brl(p.asaas.receitaPeriodo.liquido)} <span className="text-gray-500">líq. · {brl(p.asaas.receitaPeriodo.bruto)} bruto</span></>} />
            <Linha k="Recebido no mês" v={<>{brl(p.asaas.receitaMes.liquido)} <span className="text-gray-500">· {brl(p.asaas.receitaMes.bruto)}</span></>} />
            <Linha k="Recebido no ano" v={<>{brl(p.asaas.receitaAno.liquido)} <span className="text-gray-500">· {brl(p.asaas.receitaAno.bruto)}</span></>} />
            <Linha k="Em aberto (cobrável)" v={`${brl(p.asaas.emAberto.cobravel)} · ${p.asaas.emAberto.contasCobraveis} contas`} cor="text-red-300" />
            <Linha k="Em aberto de contas cortadas/canceladas" v={brl(p.asaas.emAberto.deCortadas)} cor="text-gray-400" />
            <Linha k={`Canceladas / cortadas · ${p.periodo.rotulo}`} v={`${p.asaas.canceladasPeriodo} / ${p.asaas.cortadasPeriodo}`} />
            <p className="mt-2 text-[11px] text-gray-500">Líquido = o que entra de fato (o Asaas desconta a taxa de cada pagamento). {p.asaas.ativasSemCobranca > 0 && <>Fora da conta: {p.asaas.ativasSemCobranca} conta(s) ATIVA no Asaas sem nenhuma cobrança (cortesia/liberação manual).</>}</p>
          </div>
          <div className={card}>
            <h3 className="mb-2 flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: C_HOT }} /> Hotmart</h3>
            <Linha k="Ativas (pelo gateway)" v={`${p.hotmart.ativas.total} (${p.hotmart.ativas.mensais} mensais · ${p.hotmart.ativas.anuais} anuais)`} />
            <Linha k="MRR" v={`${brl(p.hotmart.ativas.mrr)} (mensal ${brl(p.hotmart.ativas.mrrMensais)} · anual ${brl(p.hotmart.ativas.mrrAnuais)})`} cor="text-orange-300" />
            <Linha k={`Recebido · ${p.periodo.rotulo}`} v={<>{brl(p.hotmart.receitaPeriodo.liquido)} <span className="text-gray-500">líq. · {brl(p.hotmart.receitaPeriodo.bruto)} bruto</span></>} />
            <Linha k="Comissão da Hotmart no período" v={brl(p.hotmart.comissaoHotmartPeriodo)} cor="text-gray-400" />
            <Linha k="Recebido no mês" v={<>{brl(p.hotmart.receitaMes.liquido)} <span className="text-gray-500">· {brl(p.hotmart.receitaMes.bruto)}</span></>} />
            <Linha k="Recebido no ano" v={<>{brl(p.hotmart.receitaAno.liquido)} <span className="text-gray-500">· {brl(p.hotmart.receitaAno.bruto)}</span></>} />
            <Linha k="Inadimplentes (já pagaram, atraso ≤ 45 dias)" v={`${p.hotmart.inadimplentes} · ${brl(p.hotmart.emAberto)}`} cor="text-red-300" />
            <Linha k="…delas ainda com acesso ao SOA" v={p.hotmart.inadimplentesComAcesso} cor="text-amber-300" />
            <Linha k="Perdidas (atraso antigo) · migraram p/ Asaas" v={`${p.hotmart.perdidas} · ${p.hotmart.migraram}`} cor="text-gray-400" />
            <Linha k={`Canceladas · ${p.periodo.rotulo}`} v={p.hotmart.canceladasPeriodo} />
            <p className="mt-2 text-[11px] text-gray-500">Líquido = a parte do produtor que a Hotmart informa em cada venda (já sem a comissão dela). Status pelos eventos do webhook{p.sync.hotmartCredencial ? ' + espelho da API' : ''}. No banco há {p.hotmart.contasNoBanco.ativa} contas ATIVA de origem Hotmart; pelo gateway, {p.hotmart.ativas.total} pagam hoje.</p>
            {!p.sync.hotmartCredencial && <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300"><AlertTriangle size={12} /> Hotmart aguardando credenciais: os números vêm dos webhooks (completos para receita). Com HOTMART_CLIENT_ID/SECRET no servidor, o espelho da API entra sozinho.</p>}
          </div>
        </section>

        {/* 4) POR PLANO */}
        <section className={card}>
          <h3 className="mb-2 font-semibold">Por plano (Asaas + Hotmart)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 tabular-nums">
              <thead><tr className="text-left text-gray-500"><th className="py-1 font-normal">Plano</th><th className="font-normal">Asaas</th><th className="font-normal">Hotmart</th><th className="font-normal">Total</th><th className="font-normal">MRR</th></tr></thead>
              <tbody>
                {(['mensais', 'anuais'] as const).map(k => (
                  <tr key={k} className="border-t border-gray-800"><td className="py-1.5 capitalize">{k}</td><td>{p.porPlano[k].asaas}</td><td>{p.porPlano[k].hotmart}</td><td className="font-semibold">{p.porPlano[k].asaas + p.porPlano[k].hotmart}</td><td>{brl(p.porPlano[k].mrr)}</td></tr>
                ))}
                <tr className="border-t border-gray-700 text-gray-400"><td className="py-1.5">Add-on Pessoal</td><td colSpan={2}>{p.addons.pessoalAtivas} ativas</td><td /><td>{brl(p.addons.pessoalMrr)} <span className="text-[11px]">(fora do MRR do plano)</span></td></tr>
                {p.addons.marketplacesAtivas > 0 && <tr className="text-gray-400"><td className="py-1.5">Módulo Marketplaces</td><td colSpan={2}>{p.addons.marketplacesAtivas} ativas</td><td /><td>{brl(p.addons.marketplacesMrr)}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6) TENDÊNCIA */}
        <section className="grid gap-3 lg:grid-cols-2">
          <div className={card}>
            <h3 className="mb-2 font-semibold">Receita recebida por mês <span className="text-xs font-normal text-gray-500">(líquida)</span></h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={tend}><CartesianGrid stroke="#1f2937" vertical={false} /><XAxis dataKey="rotulo" tick={{ fill: '#9ca3af', fontSize: 11 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => brlCurto(Number(v))} width={70} />
                <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12 }} labelStyle={{ color: '#e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="asaasLiquido" name="Asaas" stackId="r" fill={C_ASAAS} /><Bar dataKey="hotmartLiquido" name="Hotmart" stackId="r" fill={C_HOT} radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          </div>
          <div className={card}>
            <h3 className="mb-2 font-semibold">Novas × churn por mês</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={tend}><CartesianGrid stroke="#1f2937" vertical={false} /><XAxis dataKey="rotulo" tick={{ fill: '#9ca3af', fontSize: 11 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12 }} labelStyle={{ color: '#e5e7eb' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="novas" name="Novas" fill="#34d399" radius={[4, 4, 0, 0]} /><Bar dataKey="churn" name="Churn" fill="#fb7185" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer></div>
          </div>
          <div className={card + ' lg:col-span-2'}>
            <h3 className="mb-2 font-semibold">Inadimplência por mês de vencimento <span className="text-xs font-normal text-gray-500">(Asaas, valor ainda em aberto)</span></h3>
            <div className="h-52"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={tend}><CartesianGrid stroke="#1f2937" vertical={false} /><XAxis dataKey="rotulo" tick={{ fill: '#9ca3af', fontSize: 11 }} /><YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => brlCurto(Number(v))} width={70} />
                <Tooltip formatter={(v, n) => (n === 'Cobranças' ? v : brl(Number(v)))} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 12 }} labelStyle={{ color: '#e5e7eb' }} />
                <Line type="monotone" dataKey="inadimplencia" name="Em aberto" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} /></LineChart>
            </ResponsiveContainer></div>
          </div>
        </section>

        {/* 5) INADIMPLÊNCIA */}
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="mr-auto font-semibold">Inadimplência</h3>
            {(['semana', 'mes', 'ano'] as const).map(k => (
              <span key={k} className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs text-gray-300">Novos {k === 'semana' ? '7 dias' : k === 'mes' ? 'no mês' : 'no ano'}: <b className="text-amber-300">{p.resumo.novosInadimplentes[k].contas}</b> · {brl(p.resumo.novosInadimplentes[k].valor)}</span>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-gray-400"><input type="checkbox" checked={soCobraveis} onChange={e => setSoCobraveis(e.target.checked)} /> só cobráveis (conta ativa/inadimplente)</label>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0">
              <thead className="sticky top-0 bg-gray-900"><tr className="text-left text-gray-500"><th className="py-1 font-normal">Conta</th><th className="font-normal">Gateway</th><th className="font-normal">Situação</th><th className="font-normal text-right">Em aberto</th><th className="font-normal">Desde</th></tr></thead>
              <tbody>
                {inad.map((x, i) => (
                  <tr key={`${x.gateway}:${x.workspaceId ?? x.email}:${i}`} className="border-t border-gray-800 hover:bg-gray-800/50 cursor-pointer" onClick={() => x.workspaceId && abrirPerfil(x.workspaceId)}>
                    <td className="py-1.5"><p className="text-gray-100">{x.nome || '—'}</p><p className="text-[11px] text-gray-500">{x.email}</p></td>
                    <td><span className="rounded px-1.5 py-0.5 text-[11px]" style={{ background: x.gateway === 'asaas' ? '#0c4a6e' : '#7c2d12' }}>{x.gateway === 'asaas' ? 'Asaas' : 'Hotmart'}</span></td>
                    <td className="text-xs text-gray-400">{x.situacaoConta ?? '—'}{x.cobrancas > 1 ? ` · ${x.cobrancas} cobranças` : ''}</td>
                    <td className="text-right tabular-nums text-red-300">{brl(x.valor)}</td>
                    <td className="text-xs text-gray-400">{data(x.vencimento)}</td>
                  </tr>
                ))}
                {!inad.length && <tr><td colSpan={5} className="py-6 text-center text-gray-500">Ninguém em atraso.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </>}

      {/* 7) HISTÓRICO POR ASSINANTE */}
      <section className={card} id="perfil-assinante">
        <h3 className="mb-2 font-semibold">Histórico de pagamentos por assinante</h3>
        <div className="relative max-w-xl">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome da pessoa, e-mail, ateliê ou ID da conta" className={inp + ' w-full pl-8'} />
          {resultados.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-gray-700 bg-gray-900 shadow-xl">
              {resultados.map(r => (
                <li key={r.id}><button onClick={() => abrirPerfil(r.id)} className="w-full px-3 py-2 text-left hover:bg-gray-800">
                  <p className="text-sm text-gray-100">{r.nome?.trim()} <span className="text-[11px] text-gray-500">· {r.status ?? '—'} · {r.origem ?? '—'}</span></p>
                  <p className="text-[11px] text-gray-500">{r.pessoa} · {r.email}</p>
                </button></li>
              ))}
            </ul>
          )}
        </div>

        {carregandoPerfil && <p className="mt-4 text-sm text-gray-500">Carregando…</p>}
        {perfil && !carregandoPerfil && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="mr-auto">
                <p className="text-lg font-semibold">{perfil.dados.nome}</p>
                <p className="text-xs text-gray-400">{perfil.dados.pessoa} · {perfil.dados.email}{(vivo?.telefone || perfil.dados.telefone) && <> · {vivo?.telefone || perfil.dados.telefone}</>}</p>
              </div>
              <button onClick={atualizarDoGateway} disabled={atualizando} className={btn} title="Puxa ao vivo só os dados desta pessoa no Asaas/Hotmart (poucas chamadas)"><RefreshCw size={14} className={atualizando ? 'animate-spin' : ''} /> Atualizar do gateway</button>
              <button onClick={() => { setPerfil(null); setVivo(null) }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800" aria-label="Fechar"><X size={16} /></button>
            </div>
            {vivo && (
              <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200 space-y-1">
                <p>Atualizado agora ({quando(vivo.atualizadoEm)}): {vivo.atualizadas} cobrança(s) conferida(s), {vivo.inseridas} paga(s) que faltavam no espelho. Hotmart: {vivo.hotmart === 'ok' ? 'conferida' : vivo.hotmart === 'sem_credencial' ? 'aguardando credenciais' : 'erro'}.</p>
                {vivo.aoVivo.length > 0 && <p className="text-amber-200">No Asaas há {vivo.aoVivo.length} cobrança(s) em aberto que o espelho não tinha: {vivo.aoVivo.map(x => `${data(x.vencimento)} ${brl(x.valor)} (${x.status})`).join(' · ')}. Só leitura: não foram gravadas, para a régua não agir daqui.</p>}
                {vivo.assinaturasAoVivo.length > 0 && <p>Assinaturas no Asaas agora: {vivo.assinaturasAoVivo.map(s => `${s.status} ${brl(s.valor)}${s.ciclo === 'YEARLY' ? '/ano' : '/mês'}${s.proximo ? ` · próx. ${data(s.proximo)}` : ''}`).join(' · ')}</p>}
                {vivo.avisos.map(a => <p key={a} className="text-amber-300">{a}</p>)}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Numero titulo="Plano · valor atual" valor={perfil.dados.valorAtual != null ? brl(perfil.dados.valorAtual) : '—'} sub={<p>{perfil.dados.plano ?? 'sem assinatura ativa'}{perfil.dados.cortesia ? ' · cortesia/liberação' : ''}</p>} />
              <Numero titulo="Status · origem" valor={perfil.dados.status ?? '—'} sub={<p>{perfil.dados.origem ?? '—'} · adesão {data(perfil.dados.adesao)}</p>} />
              <Numero titulo="Próximo vencimento" valor={data(perfil.dados.proximoVencimento)} sub={perfil.dados.acessoAte ? <p>acesso até {data(perfil.dados.acessoAte)}</p> : undefined} />
              <Numero titulo="Total pago (líquido)" valor={brl(perfil.totais.pagoLiquido)} destaque="text-emerald-300" sub={<p>{perfil.totais.mesesPagos} {perfil.totais.mesesPagos === 1 ? 'mês pago' : 'meses pagos'} · {data(perfil.totais.primeira)} → {data(perfil.totais.ultima)}</p>} />
            </div>
            {perfil.proximas.length > 0 && (
              <div className="text-sm"><p className={rotulo + ' mb-1'}>Próximas cobranças</p>
                <div className="flex flex-wrap gap-2">{perfil.proximas.map((x, i) => <span key={i} className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs">{data(x.vencimento)} · {brl(x.valor)} · {x.gateway === 'asaas' ? 'Asaas' : 'Hotmart'}</span>)}</div></div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2 [&_td:first-child]:pl-0 [&_th:first-child]:pl-0 tabular-nums">
                <thead><tr className="text-left text-gray-500"><th className="py-1 font-normal">Vencimento</th><th className="font-normal">Pagamento</th><th className="font-normal text-right">Bruto</th><th className="font-normal text-right">Líquido</th><th className="font-normal">Forma</th><th className="font-normal">Status</th><th className="font-normal">Gateway</th><th className="font-normal">Fatura</th></tr></thead>
                <tbody>
                  {perfil.historico.map(h => (
                    <tr key={h.gateway + h.id} className="border-t border-gray-800">
                      <td className="py-1.5">{data(h.vencimento)}</td><td>{data(h.pagamento)}</td>
                      <td className="text-right">{brl(h.bruto)}</td><td className="text-right">{h.liquido == null ? '—' : brl(h.liquido)}</td>
                      <td className="text-xs text-gray-400">{h.forma ? FORMA[h.forma] ?? h.forma : '—'}</td>
                      <td><span className={`rounded px-1.5 py-0.5 text-[11px] ${COR_STATUS[h.status] ?? 'bg-gray-800 text-gray-300'}`}>{h.status}</span></td>
                      <td className="text-xs text-gray-400">{h.gateway === 'asaas' ? 'Asaas' : 'Hotmart'}</td>
                      <td>{h.invoiceUrl ? <span className="flex items-center gap-1.5">
                        <a href={h.invoiceUrl} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline" title="Abrir a fatura"><ExternalLink size={13} /></a>
                        <button onClick={() => copiar(h.invoiceUrl!)} className="text-gray-400 hover:text-white" title="Copiar o link da fatura">{copiado === h.invoiceUrl ? <span className="text-[10px] text-emerald-300">copiado</span> : <Copy size={13} />}</button>
                      </span> : <span className="text-gray-600">—</span>}</td>
                    </tr>
                  ))}
                  {!perfil.historico.length && <tr><td colSpan={8} className="py-6 text-center text-gray-500">Nenhum pagamento no espelho. Use “Atualizar do gateway”.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
