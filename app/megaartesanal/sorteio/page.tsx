'use client'
// app/megaartesanal/sorteio/page.tsx
// Landing pública do SORTEIO (Mega Artesanal 2026 — Stand da Fofurices de Aplique).
// Pop-up de captura (nome/WhatsApp/e-mail/código do stand + consentimento) → /api/leads.
import { useState, useEffect } from 'react'
import { trackLead } from '@/components/MetaPixel'
import { Gift, MapPin, Calendar, Clock, Sparkles, CheckCircle2, PartyPopper } from 'lucide-react'

const LS_KEY = 'soa_sorteio_ma2026'
const ORIGEM = 'sorteio_megaartesanal2026'

// ── Textos parametrizáveis (edite aqui; nada de regra inventada no corpo) ──
const INFO = {
  local: 'Stand da Fofurices de Aplique — Mega Artesanal 2026, São Paulo Expo',
  dias: 'Sábado (11/07) e Domingo (12/07)',
  cadastroLimite: 'domingo, 12/07/2026, às 16:00',
  sorteioQuando: '12/07/2026, às 16:30, no próprio stand',
  premioValor: 'R$ 300,00',
}

// Regulamento — dados fornecidos pela promotora. [ ] = pendências legais a preencher.
const REGULAMENTO = {
  promotora: 'Artes e Tal Soluções de Marketing',
  cnpj: '37.377.236/0001-51',
  autorizacao: '[Certificado de Autorização SPA/MF nº — a preencher]',
  foro: '[Comarca — a preencher]',
}

export default function SorteioPage() {
  const [cadastrado, setCadastrado] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ codigo: string | null; jaCadastrado: boolean } | null>(null)

  useEffect(() => {
    try {
      const j = localStorage.getItem(LS_KEY)
      if (j) { setCadastrado(true) } else { setMostrarForm(true) }
    } catch { setMostrarForm(true) }
  }, [])

  function abrirForm() {
    if (cadastrado) { setSucesso({ codigo: (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}').codigo || null } catch { return null } })(), jaCadastrado: true }); return }
    setErro(''); setMostrarForm(true)
  }

  function onTel(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11)
    let f = d
    if (d.length > 2) f = `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length > 7) f = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    setTel(f)
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const digits = tel.replace(/\D/g, '')
    if (nome.trim().length < 2) return setErro('Escreva seu nome completo.')
    if (digits.length < 10 || digits.length > 11) return setErro('Escreva um WhatsApp válido com DDD.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErro('Escreva um e-mail válido.')
    if (!consent) return setErro('Marque a caixinha para aceitar o regulamento.')
    setEnviando(true)
    try {
      const r = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: digits, email: email.trim(), consentimento: true, origem: ORIGEM }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d?.error || 'Não consegui registrar. Tente de novo.'); return }
      try { trackLead() } catch {}
      try { localStorage.setItem(LS_KEY, JSON.stringify({ codigo: d.codigo || null })) } catch {}
      setCadastrado(true); setMostrarForm(false)
      setSucesso({ codigo: d.codigo || null, jaCadastrado: !!d.jaCadastrado })
    } catch {
      setErro('Sem conexão. Tente de novo.')
    } finally { setEnviando(false) }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ colorScheme: 'light' }}>
      {/* ─── POP-UP DE CAPTURA ─── */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={enviar} className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[94vh] overflow-y-auto">
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full mb-2">🍀 Sorteio Mega Artesanal 2026</div>
              <h2 className="text-xl font-extrabold leading-tight">Falta pouco pra você concorrer!</h2>
              <p className="text-sm text-gray-500 mt-1">Preencha seus dados e garanta sua participação no sorteio de <strong>1 ano grátis de SOA</strong>.</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome completo</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">WhatsApp</label>
                <input value={tel} onChange={e => onTel(e.target.value)} inputMode="numeric" placeholder="(11) 98888-7777"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">E-mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} inputMode="email" type="email" placeholder="voce@email.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 accent-orange-500 w-4 h-4 flex-shrink-0" />
                <span className="text-xs text-gray-500 leading-snug">
                  Li e aceito o <a href="#regulamento" onClick={() => setMostrarForm(false)} className="text-orange-600 underline">regulamento</a> e autorizo o contato da equipe SOA sobre o sorteio e novidades.
                </span>
              </label>
              {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
              <button type="submit" disabled={enviando}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-3 text-base transition disabled:opacity-60 active:scale-95">
                {enviando ? 'Enviando...' : 'Confirmar participação'}
              </button>
              <p className="text-[10px] text-gray-400 text-center">Um cadastro por pessoa. Seus dados são usados apenas para o sorteio e contato da equipe SOA.</p>
            </div>
          </form>
        </div>
      )}

      {/* ─── SUCESSO ─── */}
      {sucesso && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSucesso(null)}>
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <PartyPopper className="w-12 h-12 text-orange-500 mx-auto mb-2" />
            <h2 className="text-xl font-extrabold">{sucesso.jaCadastrado ? 'Você já está participando! 🍀' : 'Participação confirmada! 🎉'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {sucesso.jaCadastrado ? 'Reenviamos seu código de participação por e-mail.' : 'Enviamos a confirmação para o seu e-mail (guarde — é o seu comprovante).'}
            </p>
            {sucesso.codigo && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mt-3">
                <p className="text-xs text-orange-700">Seu código de participação</p>
                <p className="text-2xl font-extrabold tracking-widest text-orange-600">{sucesso.codigo}</p>
              </div>
            )}
            <button onClick={() => setSucesso(null)} className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-3">Fechar</button>
          </div>
        </div>
      )}

      {/* ─── HERO ─── */}
      <header className="px-5 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(160deg,#fff7ed,#ffffff)' }}>
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 bg-orange-100 px-3 py-1 rounded-full mb-3">🍀 Sorteio Mega Artesanal 2026</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight max-w-2xl mx-auto">
          Comprou no stand? Concorra a <span className="text-orange-600">1 ano grátis</span> de SOA. 🎉
        </h1>
        <p className="text-gray-600 mt-3 max-w-xl mx-auto">
          Na Mega Artesanal 2026, quem comprar qualquer valor no <strong>Stand da Fofurices de Aplique</strong> concorre a 1 ano de assinatura do SOA — o Sistema de Organização de Ateliês.
        </p>
        <div className="mt-6 max-w-sm mx-auto">
          <button onClick={abrirForm} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-4 text-base transition active:scale-95">Quero participar</button>
        </div>
      </header>

      {/* ─── COMO PARTICIPAR ─── */}
      <section className="px-5 py-8 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-center mb-5">Como participar — em 3 passos</h2>
        <div className="space-y-3">
          {[
            'Compre qualquer valor no Stand da Fofurices de Aplique, na Mega Artesanal.',
            'Cadastre-se aqui com seu nome, WhatsApp e e-mail.',
            'Pronto: você está concorrendo! 🍀 Seu código de participação chega por e-mail.',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-3 bg-orange-50 rounded-2xl p-4 border border-orange-100">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-sm">{i + 1}</span>
              <p className="text-sm text-gray-700">{t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRÊMIO ─── */}
      <section className="px-5 py-8 bg-orange-50">
        <div className="max-w-2xl mx-auto text-center">
          <Gift className="w-9 h-9 text-orange-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold">O prêmio: 1 ano de assinatura do SOA, grátis.</h2>
          <p className="text-gray-600 mt-2 text-sm">
            Um ano inteiro pra organizar sua produção, precificar com segurança, controlar o financeiro, montar sua loja virtual e ter seus clientes na palma da mão. Sem mensalidade, sem pegadinha.
          </p>
        </div>
      </section>

      {/* ─── ONDE E QUANDO ─── */}
      <section className="px-5 py-8 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-center mb-4">Onde e quando</h2>
        <div className="space-y-2 text-sm text-gray-700">
          <p className="flex items-center gap-2"><MapPin size={16} className="text-orange-500 flex-shrink-0" /> {INFO.local}</p>
          <p className="flex items-center gap-2"><Calendar size={16} className="text-orange-500 flex-shrink-0" /> {INFO.dias}</p>
          <p className="flex items-center gap-2"><Clock size={16} className="text-orange-500 flex-shrink-0" /> Cadastro até {INFO.cadastroLimite}. Sorteio em {INFO.sorteioQuando}.</p>
        </div>
      </section>

      {/* ─── O QUE É O SOA ─── */}
      <section className="px-5 py-8 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <Sparkles className="w-8 h-8 text-orange-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold">O que é o SOA</h2>
          <p className="text-gray-600 mt-2 text-sm">
            Um sistema feito por artesãs, para artesãs. Produção por setores, precificação que mostra sua margem de verdade, financeiro, estoque, clientes, tarefas e até sua loja virtual — tudo em um lugar só. Mais de 300 ateliês já usam.
          </p>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="px-5 py-10 text-center">
        <h2 className="text-xl font-extrabold">Já comprou? Então corre pegar seu 1 ano grátis. 🧡</h2>
        <div className="mt-5 max-w-sm mx-auto">
          <button onClick={abrirForm} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl py-4 text-base transition active:scale-95">Quero participar</button>
        </div>
        <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto">
          <a href="#regulamento" className="underline">Leia o regulamento.</a> Promoção válida somente para compras realizadas no Stand da Fofurices de Aplique durante a Mega Artesanal 2026.
        </p>
      </section>

      {/* ─── REGULAMENTO ─── */}
      <section id="regulamento" className="px-5 py-10 bg-gray-50 border-t border-gray-100">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-base font-bold mb-3">Regulamento — "1 ano grátis de SOA — Mega Artesanal 2026"</h2>
          <ol className="text-xs text-gray-500 leading-relaxed space-y-2 list-decimal pl-4">
            <li>Promotora: {REGULAMENTO.promotora}, CNPJ {REGULAMENTO.cnpj}.</li>
            <li>Autorização: {REGULAMENTO.autorizacao}.</li>
            <li>Período de participação: de 11/07/2026 até {INFO.cadastroLimite}.</li>
            <li>Quem pode participar: pessoas físicas maiores de 18 anos, residentes no Brasil, que realizarem compra de qualquer valor no Stand da Fofurices de Aplique, durante a Mega Artesanal 2026 (São Paulo Expo), nos dias 11 e 12 de julho de 2026.</li>
            <li>Como participar: após a compra, o participante deverá acessar usesoa.com.br/megaartesanal/sorteio e cadastrar nome, WhatsApp e e-mail, aceitando este regulamento. Limite de um cadastro por pessoa (validado por e-mail e telefone).</li>
            <li>Prêmio: 1 (uma) assinatura anual do sistema SOA, no valor aproximado de {INFO.premioValor}, não convertível em dinheiro e intransferível.</li>
            <li>Sorteio: realizado em {INFO.sorteioQuando}.</li>
            <li>Resultado e entrega: divulgado no próprio stand e comunicado à ganhadora por WhatsApp e e-mail. O prêmio é ativado na conta da ganhadora após a confirmação.</li>
            <li>Dados pessoais (LGPD): os dados são coletados exclusivamente para operacionalizar o sorteio e para contato da equipe SOA, com consentimento do participante, e não são compartilhados com terceiros. A qualquer momento o participante pode solicitar exclusão pelo e-mail suporte@vpsgestao.com.br.</li>
            <li>Disposições gerais: a participação implica aceitação integral deste regulamento. Casos omissos serão resolvidos pela promotora. Foro de {REGULAMENTO.foro}.</li>
          </ol>
        </div>
      </section>

      <footer className="px-5 py-6 text-center text-xs text-gray-400">
        Equipe SOA · suporte@vpsgestao.com.br · <a href="https://usesoa.com.br" className="underline">usesoa.com.br</a>
      </footer>
    </div>
  )
}
