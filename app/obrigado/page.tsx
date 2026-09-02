'use client'
// app/obrigado/page.tsx
// Página de obrigado pós-checkout — dispara Lead/Purchase + gatilhos de conversão

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, MessageCircle, Mail, Clock, ArrowRight, Sparkles, BookOpen, Users } from 'lucide-react'

const WHATSAPP_GRUPO    = 'https://chat.whatsapp.com/J5Bt6vBj02R77mc5AL0Yk9?mode=gi_t'
const WHATSAPP_SUPORTE  = 'https://wa.me/message/SF4TYNEPHHLHN1'

function gerarEventId() {
  return 'obrigado_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36)
}

export default function ObrigadoPage() {
  const params = useSearchParams()
  const email   = params.get('email') || ''
  const phone   = params.get('phone') || ''
  const nome    = params.get('nome')  || ''
  const valor   = params.get('valor') ? Number(params.get('valor')) : 0
  const plano   = params.get('plano') || 'mensal'
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    if (enviado) return
    const eventId = gerarEventId()

    if (typeof window !== 'undefined' && (window as any).fbq) {
      ;(window as any).fbq('track', 'Lead', {
        value: valor,
        currency: 'BRL',
        content_name: `SOA — ${plano === 'anual' ? 'Anual' : 'Mensal'}`,
      }, { eventID: eventId })
    }

    fetch('/api/meta/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'Lead',
        eventId,
        email,
        phone,
        firstName: nome.split(' ')[0],
        lastName: nome.split(' ').slice(1).join(' '),
        value: valor,
        currency: 'BRL',
        eventSourceUrl: window.location.href,
      }),
    }).catch(() => {})

    setEnviado(true)
  }, [enviado, email, phone, nome, valor, plano])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Glow de fundo */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-5">
          <img
            src="/logo_vps_horizontal.png"
            alt="SOA"
            className="h-9 w-auto object-contain"
            style={{ mixBlendMode: 'lighten' }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">

        {/* Hero confirmação */}
        <div className="mb-3 inline-flex rounded-full border border-green-400/20 bg-green-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-green-300">
          ✓ Compra confirmada
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-3">
          {nome ? `Parabéns, ${nome.split(' ')[0]}!` : 'Parabéns!'} 🎉
        </h1>
        <p className="text-base md:text-lg text-slate-300 leading-7 mb-10">
          Seu pedido foi confirmado e seu acesso ao <strong className="text-orange-300">SOA</strong> está sendo preparado.
        </p>

        {/* Card próximos passos */}
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/40 mb-6">
          <div className="border-b border-white/10 px-6 py-4 flex items-center gap-2">
            <Sparkles className="text-orange-400" size={18} />
            <h2 className="font-semibold text-white">Próximos passos</h2>
          </div>

          <div className="p-6 space-y-3">
            {/* Passo 1 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center font-bold text-sm">1</div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1 flex items-center gap-2">
                  <Mail size={14} className="text-orange-400" /> Verifique seu e-mail
                </p>
                <p className="text-sm text-slate-400 leading-6">
                  Em até <strong className="text-white">5 minutos</strong> você recebe o e-mail com login e senha de acesso.
                  Confira a caixa de entrada {email && <>e a pasta de spam — enviamos para <strong className="text-orange-300">{email}</strong></>}.
                </p>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-pink-500/20 bg-pink-500/5">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center font-bold text-sm">2</div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1">🚀 Acesse o sistema</p>
                <p className="text-sm text-slate-400 leading-6 mb-2">
                  Faça login em <strong className="text-pink-300">app.vps-gestao.com.br</strong> e siga o tour de boas-vindas.
                  Em menos de 10 minutos seu ateliê está organizado!
                </p>
                <a href="https://app.vps-gestao.com.br" target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1 text-pink-300 text-sm font-semibold hover:text-pink-200">
                  Acessar agora <ArrowRight size={14} />
                </a>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="flex items-start gap-4 p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">3</div>
              <div className="flex-1">
                <p className="font-semibold text-white mb-1">💬 Entre no grupo VIP de WhatsApp</p>
                <p className="text-sm text-slate-400 leading-6 mb-2">
                  Fique sempre atenta às novidades do <strong className="text-white">SOA</strong>, dicas exclusivas da Naty e troque experiências com outras artesãs.
                </p>
                <a href={WHATSAPP_GRUPO} target="_blank" rel="noopener"
                  className="inline-flex items-center gap-1.5 text-purple-300 text-sm font-semibold hover:text-purple-200">
                  Entrar no grupo <MessageCircle size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Cards de gatilhos */}
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 hover:border-orange-500/30 transition">
            <Clock className="text-orange-400 mb-2" size={20} />
            <p className="font-semibold text-white mb-1 text-sm">Ativação imediata</p>
            <p className="text-xs text-slate-400 leading-5">Seu acesso é liberado automaticamente. Sem espera, sem fila.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 hover:border-pink-500/30 transition">
            <BookOpen className="text-pink-400 mb-2" size={20} />
            <p className="font-semibold text-white mb-1 text-sm">Treinamento incluso</p>
            <p className="text-xs text-slate-400 leading-5">Vídeos passo a passo dentro do sistema te ensinam tudo do zero.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 hover:border-purple-500/30 transition">
            <Users className="text-purple-400 mb-2" size={20} />
            <p className="font-semibold text-white mb-1 text-sm">Comunidade ativa</p>
            <p className="text-xs text-slate-400 leading-5">Mais de 300 artesãs usando o SOA todos os dias. Você não está sozinha.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 hover:border-amber-500/30 transition">
            <Sparkles className="text-amber-400 mb-2" size={20} />
            <p className="font-semibold text-white mb-1 text-sm">Atualizações constantes</p>
            <p className="text-xs text-slate-400 leading-5">Novas funcionalidades baseadas no que as artesãs realmente precisam.</p>
          </div>
        </div>

        {/* Card suporte */}
        <div className="overflow-hidden rounded-[28px] border border-orange-500/20 bg-gradient-to-br from-orange-500/10 via-pink-500/10 to-purple-500/10 p-6 md:p-8 text-center">
          <Mail className="mx-auto mb-3 text-orange-400" size={28} />
          <h2 className="text-2xl font-semibold text-white mb-2">Não recebeu o e-mail?</h2>
          <p className="text-slate-300 mb-5 text-sm leading-6">Nossa equipe de suporte está pronta para te ajudar a entrar no sistema agora mesmo.</p>
          <a href={WHATSAPP_SUPORTE} target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold px-6 py-3 rounded-full transition hover:scale-105">
            <MessageCircle size={18} />
            Falar com o suporte
          </a>
        </div>

        <p className="text-center text-xs text-slate-500 mt-10">
          SOA · suporte@vps-gestao.com.br · app.vps-gestao.com.br
        </p>
      </main>
    </div>
  )
}
