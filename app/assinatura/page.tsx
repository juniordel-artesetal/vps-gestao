'use client'
// Tela de assinatura — portão de entrada E tela de regularização.
//
// Tom: acolhedor. Quem chega aqui bloqueada não fez nada errado. A tela diz que
// nada foi apagado, mostra o nome dela e põe o caminho de volta na frente.
//
// O pagamento acontece SEM sair do sistema sempre que possível:
//   PIX    → QR renderizado aqui mesmo, com copiar e confirmação automática
//   CARTÃO → popup do Asaas por cima (campos de cartão exigem PCI; não podem
//            ser nossos). Se o navegador bloquear, cai para a mesma aba.
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2, AlertTriangle, Clock, ArrowRight, ShieldCheck, Loader2,
  Copy, Check, QrCode, CreditCard, ExternalLink, Repeat,
} from 'lucide-react'
import PixAutomaticoBox from '@/components/PixAutomaticoBox'

interface Parcelamento { parcelas: number; valorParcela: number; total: number }
interface Plano {
  id: 'mensal' | 'anual'
  nome: string; valor: number; equivalenteMensal: number
  descontoPerc: number; destaque?: string
  parcelado?: Parcelamento
  /** Tabela 1..12 do anual (vem do servidor, fonte única de preço). */
  parcelamentos?: Parcelamento[]
}
interface Dados {
  estado: { status: string; temAcesso: boolean; motivo: string; diasRestantes: number | null; origem?: string | null; liberacaoManual?: boolean }
  assinatura: { ciclo: string; valor: number; status: string; proximoVencimento: string | null } | null
  cobrancaAberta: { paymentId: string; valor: number; vencimento: string | null; invoiceUrl?: string | null } | null
  planos: Plano[]
  nome: string | null
  workspaceNome: string | null
}
interface Pix { paymentId: string; qrImagem: string; qrTexto: string; valor: number; vencimento: string }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const CICLO_LABEL: Record<string, string> = { MONTHLY: 'Mensal', YEARLY: 'Anual', QUARTERLY: 'Trimestral', SEMIANNUALLY: 'Semestral' }
const CICLO_SUFIXO: Record<string, string> = { MONTHLY: '/mês', YEARLY: '/ano', QUARTERLY: '/trimestre', SEMIANNUALLY: '/semestre' }

export default function AssinaturaPage() {
  const router = useRouter()
  const [d, setD] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)

  // Escolhas
  const [plano, setPlano] = useState<'mensal' | 'anual'>('mensal')
  const [metodo, setMetodo] = useState<'cartao' | 'pix' | 'pixauto'>('cartao')
  const [parcelas, setParcelas] = useState(1) // anual no cartão: 1 a 12
  const [cpf, setCpf] = useState('')

  // Fluxo
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [pix, setPix] = useState<Pix | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [pago, setPago] = useState(false)
  const [aguardandoPopup, setAguardandoPopup] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const popupRef = useRef<Window | null>(null)

  // Reativação por link pré-vinculado: a página pode abrir sem login, identificada
  // pelo token assinado (?e=&t=). Guardamos num ref e o repassamos a toda chamada.
  const authRef = useRef<{ e: string; t: string } | null>(null)
  const authQuery = () => authRef.current ? `?e=${encodeURIComponent(authRef.current.e)}&t=${encodeURIComponent(authRef.current.t)}` : ''
  const authBody = () => authRef.current ? { e: authRef.current.e, t: authRef.current.t } : {}

  const carregar = useCallback(async () => {
    const r = await fetch('/api/assinatura' + authQuery())
    // Sem token e sem sessão → login. Com token válido isso não acontece.
    if (r.status === 401) { if (!authRef.current) router.push('/login'); setCarregando(false); return }
    if (r.ok) setD(await r.json())
    setCarregando(false)
  }, [router])

  useEffect(() => {
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const e = sp.get('e'), t = sp.get('t')
    if (e && t) authRef.current = { e, t }
    carregar()
  }, [carregar])

  // ── Confirmação automática ────────────────────────────────────────────────
  // Enquanto o QR está na tela ou a popup está aberta, consultamos o status.
  // É o webhook que muda a verdade; aqui só perguntamos "já mudou?".
  useEffect(() => {
    if (pago || (!pix && !aguardandoPopup)) return
    const t = setInterval(async () => {
      try {
        const s = await (await fetch('/api/assinatura/status' + authQuery())).json()
        if (s.pago || s.temAcesso) { setPago(true); clearInterval(t) }
      } catch { /* rede instável não deve quebrar a tela */ }
    }, 4000)
    return () => clearInterval(t)
  }, [pix, aguardandoPopup, pago])

  // Caminho rápido do cartão: a página de retorno avisa por postMessage.
  useEffect(() => {
    function ouvir(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (e.data?.tipo === 'SOA_CHECKOUT_CONCLUIDO') { setPago(true); setAguardandoPopup(false) }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [])

  // Pago: dá um instante para ela ver a confirmação e entra no sistema.
  useEffect(() => {
    if (!pago) return
    const t = setTimeout(() => { window.location.href = '/dashboard' }, 2600)
    return () => clearTimeout(t)
  }, [pago])

  const mascararCpf = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 11)
    return n.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  const cpfOk = cpf.replace(/\D/g, '').length === 11
  const planoSel = d?.planos.find(p => p.id === plano)
  const podeParcelar = plano === 'anual' && metodo === 'cartao'

  async function gerarPix() {
    setEnviando(true); setErro('')
    const r = await fetch('/api/assinatura/pix', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano, cpf: cpf.replace(/\D/g, ''), ...authBody() }),
    })
    const j = await r.json().catch(() => ({}))
    setEnviando(false)
    if (!r.ok) { setErro(j.error || 'Não consegui gerar seu Pix. Tente de novo.'); return }
    setPix(j)
  }

  async function abrirCartao() {
    setEnviando(true); setErro('')
    const r = await fetch('/api/assinatura/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano, metodo: 'cartao', parcelas, cpf: cpf.replace(/\D/g, ''), ...authBody() }),
    })
    const j = await r.json().catch(() => ({}))
    setEnviando(false)
    if (!r.ok || !j.link) { setErro(j.error || 'Não consegui abrir o pagamento.'); return }

    // Popup dimensionada por cima do sistema. Se o navegador bloquear, `p` vem
    // null (ou fechada na hora) — aí vamos na mesma aba, sem deixá-la travada.
    const l = Math.max(0, window.screenX + (window.outerWidth - 480) / 2)
    const t = Math.max(0, window.screenY + 60)
    const p = window.open(j.link, 'soa_pagamento', `width=480,height=720,left=${l},top=${t},resizable=yes,scrollbars=yes`)
    if (!p || p.closed || typeof p.closed === 'undefined') { window.location.href = j.link; return }
    popupRef.current = p
    setAguardandoPopup(true)
  }

  async function copiar() {
    if (!pix) return
    try { await navigator.clipboard.writeText(pix.qrTexto); setCopiado(true); setTimeout(() => setCopiado(false), 2500) }
    catch { setErro('Não consegui copiar. Selecione o código e copie manualmente.') }
  }

  async function cancelar() {
    setEnviando(true); setErro('')
    const r = await fetch('/api/assinatura/cancelar', { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    setEnviando(false)
    if (!r.ok) { setErro(j.error || 'Não consegui cancelar agora.'); return }
    window.location.reload()
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
    </div>
  }
  if (!d) return <div className="p-8 text-center text-gray-500">Não consegui carregar sua assinatura. Recarregue a página.</div>

  // ── PAGAMENTO RECEBIDO ────────────────────────────────────────────────────
  if (pago) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Pagamento recebido!</h1>
          <p className="text-sm text-gray-600 mb-1">
            Seus 14 dias grátis começaram agora. Bem-vinda ao SOA, {(d.nome || '').split(' ')[0]}!
          </p>
          <p className="text-xs text-gray-400 mt-4">Levando você para o seu ateliê…</p>
        </div>
      </div>
    )
  }

  const { estado } = d
  const bloqueada = !estado.temAcesso
  const primeiroNome = (d.nome || '').split(' ')[0]
  const emDia = estado.status === 'ATIVA'
  const aguardando = estado.status === 'AGUARDANDO_PAGAMENTO'
  // Inteligência de estado: quem NÃO deve ver o checkout de assinatura Asaas.
  //  • liberado = acesso de cortesia (Master liberou manualmente) — sem cobrança.
  //  • acessoLegado = tem acesso pelo caminho ANTIGO (Hotmart/legado, origem ≠ asaas) —
  //    a assinatura dele não é gerida aqui, então não faz sentido oferecer o checkout Asaas.
  const liberado = !!estado.liberacaoManual
  const acessoLegado = estado.temAcesso && estado.origem !== 'asaas' && !liberado
  const semCheckout = liberado || acessoLegado || emDia

  const cabecalho = liberado
    ? { icone: <CheckCircle2 className="w-7 h-7 text-emerald-500" />, cor: 'border-emerald-200 bg-emerald-50',
        titulo: primeiroNome ? `${primeiroNome}, seu acesso está liberado` : 'Seu acesso está liberado',
        texto: 'Acesso de **cortesia**, liberado pela nossa equipe — **sem cobrança**. Aproveite tudo. 💛' }
    : acessoLegado
    ? { icone: <CheckCircle2 className="w-7 h-7 text-emerald-500" />, cor: 'border-emerald-200 bg-emerald-50',
        titulo: primeiroNome ? `${primeiroNome}, sua assinatura está ativa` : 'Sua assinatura está ativa',
        texto: estado.origem === 'hotmart'
          ? 'Sua conta está **ativa e liberada**. Sua assinatura é gerida pela **Hotmart** — a cobrança e o cancelamento são feitos por lá.'
          : 'Sua conta está **ativa e liberada**. Tudo funcionando normalmente. 💛' }
    : aguardando
    ? { icone: <Clock className="w-7 h-7 text-orange-500" />, cor: 'border-orange-200 bg-orange-50',
        titulo: primeiroNome ? `${primeiroNome}, falta só o pagamento` : 'Falta só o pagamento',
        texto: 'Escolha seu plano e como prefere pagar. **Seus 14 dias grátis começam assim que terminar** — e a primeira cobrança só acontece depois deles.' }
    : bloqueada
    ? { icone: <AlertTriangle className="w-7 h-7 text-amber-500" />, cor: 'border-amber-200 bg-amber-50',
        titulo: primeiroNome ? `${primeiroNome}, vamos reativar seu acesso?` : 'Vamos reativar seu acesso?',
        texto: 'Seu período de pagamento venceu e o acesso ficou pausado. **Está tudo salvo** — seus pedidos, clientes e cálculos continuam aqui, exatamente como você deixou.' }
    : estado.status === 'TRIAL'
    ? { icone: <Clock className="w-7 h-7 text-orange-500" />, cor: 'border-orange-200 bg-orange-50',
        titulo: primeiroNome ? `${primeiroNome}, você está no período de teste` : 'Você está no período de teste',
        texto: estado.diasRestantes !== null ? `Faltam **${estado.diasRestantes} dia(s)**. Não precisa fazer nada agora.` : 'Aproveite para testar tudo.' }
    : estado.status === 'INADIMPLENTE'
    ? { icone: <AlertTriangle className="w-7 h-7 text-amber-500" />, cor: 'border-amber-200 bg-amber-50',
        titulo: 'Encontramos um pagamento em aberto',
        texto: estado.diasRestantes !== null ? `Você ainda tem **${estado.diasRestantes} dia(s)** de acesso. Regularizando agora, nada é interrompido.` : 'Regularize para manter tudo funcionando.' }
    : { icone: <CheckCircle2 className="w-7 h-7 text-emerald-500" />, cor: 'border-emerald-200 bg-emerald-50',
        titulo: 'Sua assinatura está em dia',
        texto: d.assinatura?.proximoVencimento ? `Próxima cobrança em **${d.assinatura.proximoVencimento}**.` : 'Obrigado por fazer parte do SOA!' }

  const fmt = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith('**') ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className={`rounded-2xl border p-6 mb-6 ${cabecalho.cor}`}>
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-0.5">{cabecalho.icone}</div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1.5">{cabecalho.titulo}</h1>
              <p className="text-sm text-gray-700 leading-relaxed">{fmt(cabecalho.texto)}</p>
              {d.workspaceNome && <p className="text-xs text-gray-500 mt-3">Ateliê: {d.workspaceNome}</p>}
            </div>
          </div>
        </div>

        {/* ── QR DO PIX, na nossa tela ─────────────────────────────────── */}
        {pix && (
          <div className="rounded-2xl border-2 border-orange-200 bg-white p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-orange-500" />
              <h2 className="font-semibold text-gray-900">Pague com Pix para começar</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              {pix.qrImagem && (
                <img src={`data:image/png;base64,${pix.qrImagem}`} alt="QR Code do Pix"
                  className="w-44 h-44 rounded-xl border border-gray-200 shrink-0" />
              )}
              <div className="flex-1 w-full">
                <p className="text-sm text-gray-600 mb-1">
                  Abra o app do seu banco, escolha <strong className="text-gray-900">Pix</strong> e
                  aponte para o código — ou copie e cole:
                </p>
                <div className="flex gap-2 mt-3">
                  <input readOnly value={pix.qrTexto}
                    className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3 py-2.5 text-xs text-gray-600 bg-gray-50" />
                  <button onClick={copiar}
                    className="shrink-0 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 flex items-center gap-1.5">
                    {copiado ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar</>}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-gray-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Assim que o pagamento cair, esta tela avisa sozinha — pode deixar aberta.
                </div>
              </div>
            </div>
            {erro && <p className="text-sm text-red-600 mt-4">{erro}</p>}
          </div>
        )}

        {/* ── POPUP DO CARTÃO aberta ───────────────────────────────────── */}
        {aguardandoPopup && !pix && (
          <div className="rounded-2xl border-2 border-orange-200 bg-white p-6 mb-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
            <h2 className="font-semibold text-gray-900 mb-1">Terminando o pagamento…</h2>
            <p className="text-sm text-gray-600">
              Complete os dados na janela que abriu. Quando terminar, esta tela avisa sozinha.
            </p>
            <button onClick={() => { popupRef.current?.focus() }}
              className="mt-4 text-sm text-orange-600 hover:text-orange-700 underline">
              Não está vendo a janela? Clique aqui
            </button>
          </div>
        )}

        {/* ── ESCOLHA DE PLANO E MÉTODO (só p/ regime Asaas não-ativo; nunca p/ liberado/Hotmart/ativo) ── */}
        {!semCheckout && !pix && !aguardandoPopup && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-3">1. Escolha seu plano</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {d.planos.map(p => {
                const sel = plano === p.id
                return (
                  <button key={p.id} onClick={() => { setPlano(p.id); if (p.id === 'mensal') setParcelas(1) }}
                    className={`text-left rounded-2xl border-2 p-4 transition ${
                      sel ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-900">{p.nome}</span>
                      {p.destaque && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{p.destaque}</span>}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {brl(p.equivalenteMensal)}<span className="text-sm font-normal text-gray-500">/mês</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {p.id === 'anual' ? `${brl(p.valor)} por ano, à vista` : 'cobrado todo mês'}
                    </p>
                  </button>
                )
              })}
            </div>

            <h2 className="text-base font-semibold text-gray-900 mb-3">2. Como prefere pagar?</h2>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <button onClick={() => setMetodo('cartao')}
                className={`text-left rounded-2xl border-2 p-4 transition ${
                  metodo === 'cartao' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-gray-700" />
                  <span className="font-semibold text-gray-900">Cartão de crédito</span>
                </div>
                <p className="text-xs text-gray-600">Cobrança automática todo ciclo — você não precisa lembrar.</p>
              </button>
              <button onClick={() => { setMetodo('pix'); setParcelas(1) }}
                className={`text-left rounded-2xl border-2 p-4 transition ${
                  metodo === 'pix' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="w-4 h-4 text-gray-700" />
                  <span className="font-semibold text-gray-900">Pix, mês a mês</span>
                </div>
                <p className="text-xs text-gray-600">Você recebe a cobrança e paga com um toque.</p>
              </button>
              <button onClick={() => { setMetodo('pixauto'); setParcelas(1) }}
                className={`text-left rounded-2xl border-2 p-4 transition ${
                  metodo === 'pixauto' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Repeat className="w-4 h-4 text-gray-700" />
                  <span className="font-semibold text-gray-900">Pix Automático</span>
                </div>
                <p className="text-xs text-gray-600">Autoriza uma vez, as próximas caem sozinhas — sem cartão.</p>
              </button>
            </div>

            {/* Em quantas vezes pagar o anual (1 a 12) — total visível ANTES do redirect */}
            {podeParcelar && (planoSel?.parcelamentos?.length ?? 0) > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900">Em quantas vezes quer pagar o anual?</p>
                  <span className="text-xs text-gray-500">1 a 12x no cartão</span>
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  À vista (1x) é o melhor preço. A partir de 2x há juros — o total de cada opção aparece abaixo.
                </p>
                <div className="flex flex-wrap gap-2">
                  {planoSel!.parcelamentos!.map(op => {
                    const sel = parcelas === op.parcelas
                    return (
                      <button key={op.parcelas} onClick={() => setParcelas(op.parcelas)}
                        className={`min-w-[84px] flex-1 text-left rounded-xl border-2 px-3 py-2 transition ${
                          sel ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="font-semibold text-gray-900 text-sm">
                          {op.parcelas}x de {brl(op.valorParcela)}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {op.parcelas === 1 ? 'à vista' : `total ${brl(op.total)}`}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {metodo === 'pixauto' ? <PixAutomaticoBox /> : (<>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-1.5">3. Seu CPF</label>
              <input inputMode="numeric" value={cpf} onChange={e => { setCpf(mascararCpf(e.target.value)); setErro('') }}
                placeholder="000.000.000-00" maxLength={14}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <p className="text-xs text-gray-500 mt-1.5">Necessário para emitir sua cobrança. Não fica salvo no SOA.</p>
              {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
            </div>

            <button
              onClick={metodo === 'pix' ? gerarPix : abrirCartao}
              disabled={enviando || !cpfOk}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
              {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparando…</>
                : metodo === 'pix' ? <><QrCode className="w-4 h-4" /> Gerar meu Pix</>
                : <><CreditCard className="w-4 h-4" /> Cadastrar meu cartão <ArrowRight className="w-4 h-4" /></>}
            </button>

            {metodo === 'cartao' && (
              <p className="flex items-start gap-1.5 text-xs text-gray-500 mt-3">
                <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-px" />
                Abre uma janela segura do Asaas, nosso parceiro de pagamento. O SOA continua aberto atrás.
              </p>
            )}
            </>)}
          </>
        )}

        {/* Cobrança já emitida (regularização) */}
        {d.cobrancaAberta?.invoiceUrl && !pix && !aguardandoPopup && emDia === false && estado.status !== 'AGUARDANDO_PAGAMENTO' && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mt-6">
            <p className="text-sm text-gray-600 mb-3">
              Você tem uma cobrança de <strong className="text-gray-900">{brl(d.cobrancaAberta.valor)}</strong>
              {d.cobrancaAberta.vencimento ? ` com vencimento em ${d.cobrancaAberta.vencimento}` : ''}.
            </p>
            <a href={d.cobrancaAberta.invoiceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
              Pagar agora <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        <div className="mt-8 flex items-start gap-2.5 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-gray-400" />
          <p>Os dados do seu cartão não passam nem ficam guardados no SOA — quem cuida disso é o Asaas.</p>
        </div>

        {!bloqueada && !pix && !aguardandoPopup && (
          <button onClick={() => router.push('/dashboard')}
            className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline">Voltar para o sistema</button>
        )}

        {!pix && !aguardandoPopup && estado.status !== 'CANCELADA' && (semCheckout || estado.status === 'TRIAL' || d.assinatura) && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            {/* Seção clara "Minha Assinatura": conteúdo por estado + cancelar só onde faz sentido. */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Minha Assinatura</h3>
              </div>

              {liberado ? (
                <p className="text-sm text-gray-600">Seu acesso está <strong className="text-emerald-700">liberado pela nossa equipe (cortesia)</strong> — sem cobrança. Aproveite tudo. 💛</p>
              ) : emDia && d.assinatura ? (
                <dl className="text-sm space-y-2">
                  <div className="flex items-center justify-between gap-4"><dt className="text-gray-500">Plano</dt><dd className="font-medium text-gray-900">SOA {CICLO_LABEL[d.assinatura.ciclo] || 'Mensal'}</dd></div>
                  <div className="flex items-center justify-between gap-4"><dt className="text-gray-500">Valor</dt><dd className="font-medium text-gray-900">{brl(d.assinatura.valor)}{CICLO_SUFIXO[d.assinatura.ciclo] || ''}</dd></div>
                  {d.assinatura.proximoVencimento && <div className="flex items-center justify-between gap-4"><dt className="text-gray-500">Próximo vencimento</dt><dd className="font-medium text-gray-900">{d.assinatura.proximoVencimento}</dd></div>}
                  <div className="flex items-center justify-between gap-4"><dt className="text-gray-500">Status</dt><dd className="font-medium text-emerald-600">Ativa</dd></div>
                </dl>
              ) : acessoLegado ? (
                <p className="text-sm text-gray-600">Sua assinatura está <strong className="text-emerald-700">ativa</strong>.{estado.origem === 'hotmart' ? <> Ela é gerida pela <strong className="text-gray-900">Hotmart</strong> — cobrança e cancelamento são feitos por lá.</> : ''}</p>
              ) : (
                <p className="text-sm text-gray-600">Você está no <strong className="text-gray-900">teste grátis</strong>. Nada foi cobrado ainda.</p>
              )}

              {/* Cancelar — não aparece p/ cortesia nem p/ assinatura gerida por fora (Hotmart/legado). */}
              {!liberado && !acessoLegado && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {!cancelando ? (
                  <button onClick={() => setCancelando(true)}
                    className="text-sm font-medium text-gray-600 hover:text-red-600 hover:underline transition">
                    {d.assinatura ? 'Cancelar assinatura' : 'Cancelar meu teste'}
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Quer mesmo cancelar?</h4>
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">
                      {d.assinatura ? (
                        <>
                          Sem problema — a porta fica aberta.
                          {d.assinatura.proximoVencimento && <> Você <strong className="text-gray-900">continua com acesso até {d.assinatura.proximoVencimento}</strong>, porque esse período já está pago.</>}
                          {' '}E <strong className="text-gray-900">nada será apagado</strong>.
                        </>
                      ) : (
                        <>
                          Você está no <strong className="text-gray-900">teste grátis</strong> — nada foi cobrado e nada será cobrado.
                          {' '}Ao cancelar, <strong className="text-gray-900">seu acesso é encerrado agora</strong>. Seus dados ficam salvos, e você pode voltar quando quiser.
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={cancelar} disabled={enviando}
                        className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {enviando ? 'Cancelando…' : 'Sim, cancelar'}
                      </button>
                      <button onClick={() => { setCancelando(false); setErro('') }}
                        className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                        Continuar assinante
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
