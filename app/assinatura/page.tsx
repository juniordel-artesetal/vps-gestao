'use client'
// Tela de assinatura — é também a tela de REGULARIZAÇÃO de quem foi suspensa.
//
// Tom: acolhedor. Quem chega aqui bloqueada não fez nada errado — atrasou um
// pagamento. A tela diz explicitamente que nada foi apagado, mostra o nome dela e
// põe o caminho de volta na frente. Nada de "acesso negado".
//
// O cartão NUNCA passa por aqui: o botão leva à página hospedada do Asaas.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertTriangle, Clock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react'

interface Plano {
  id: 'mensal' | 'anual'
  nome: string
  valor: number
  equivalenteMensal: number
  descontoPerc: number
  destaque?: string
}
interface Dados {
  estado: {
    status: string
    temAcesso: boolean
    motivo: string
    diasRestantes: number | null
  }
  assinatura: { ciclo: string; valor: number; status: string; proximoVencimento: string | null } | null
  cobrancaAberta: { paymentId: string; valor: number; vencimento: string | null; invoiceUrl?: string | null } | null
  planos: Plano[]
  nome: string | null
  workspaceNome: string | null
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AssinaturaPage() {
  const router = useRouter()
  const [d, setD] = useState<Dados | null>(null)
  const [plano, setPlano] = useState<'mensal' | 'anual'>('mensal')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    ;(async () => {
      const r = await fetch('/api/assinatura')
      if (r.status === 401) { router.push('/login'); return }
      if (r.ok) setD(await r.json())
      setCarregando(false)
    })()
  }, [router])

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    )
  }
  if (!d) return <div className="p-8 text-center text-gray-500">Não consegui carregar sua assinatura. Recarregue a página.</div>

  const { estado } = d
  const bloqueada = !estado.temAcesso
  const primeiroNome = (d.nome || '').split(' ')[0]

  // Cabeçalho muda conforme a situação — o mesmo componente serve para quem está
  // tranquila no trial e para quem precisa regularizar.
  const cabecalho = bloqueada
    ? {
        icone: <AlertTriangle className="w-7 h-7 text-amber-500" />,
        titulo: primeiroNome ? `${primeiroNome}, vamos reativar seu acesso?` : 'Vamos reativar seu acesso?',
        texto: 'Seu período de pagamento venceu e o acesso ficou pausado. **Está tudo salvo** — seus pedidos, clientes e cálculos continuam aqui, exatamente como você deixou. É só escolher um plano abaixo para voltar agora.',
        cor: 'border-amber-200 bg-amber-50',
      }
    : estado.status === 'TRIAL'
    ? {
        icone: <Clock className="w-7 h-7 text-orange-500" />,
        titulo: primeiroNome ? `${primeiroNome}, você está no período de teste` : 'Você está no período de teste',
        texto: estado.diasRestantes !== null
          ? `Faltam **${estado.diasRestantes} dia(s)** para o teste acabar. Escolhendo um plano agora, você não perde o acesso quando ele terminar.`
          : 'Aproveite para testar tudo. Quando quiser continuar, escolha um plano aqui.',
        cor: 'border-orange-200 bg-orange-50',
      }
    : estado.status === 'INADIMPLENTE'
    ? {
        icone: <AlertTriangle className="w-7 h-7 text-amber-500" />,
        titulo: 'Encontramos um pagamento em aberto',
        texto: estado.diasRestantes !== null
          ? `Você ainda tem **${estado.diasRestantes} dia(s)** de acesso. Regularizando agora, nada é interrompido.`
          : 'Regularize para manter tudo funcionando normalmente.',
        cor: 'border-amber-200 bg-amber-50',
      }
    : {
        icone: <CheckCircle2 className="w-7 h-7 text-emerald-500" />,
        titulo: 'Sua assinatura está em dia',
        texto: d.assinatura?.proximoVencimento
          ? `Próxima cobrança em **${d.assinatura.proximoVencimento}**. Não precisa fazer nada.`
          : 'Obrigado por fazer parte do SOA!',
        cor: 'border-emerald-200 bg-emerald-50',
      }

  // **negrito** simples, para o texto acima ficar legível no código
  const fmt = (t: string) =>
    t.split(/(\*\*[^*]+\*\*)/).map((p, i) =>
      p.startsWith('**') ? <strong key={i} className="font-semibold text-gray-900">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)

  const emDia = estado.status === 'ATIVA'

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

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

        {/* Cobrança já emitida: o caminho mais curto é pagar esta, não assinar de novo */}
        {d.cobrancaAberta && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-6">
            <p className="text-sm text-gray-600 mb-3">
              Você tem uma cobrança de <strong className="text-gray-900">{brl(d.cobrancaAberta.valor)}</strong>
              {d.cobrancaAberta.vencimento ? ` com vencimento em ${d.cobrancaAberta.vencimento}` : ''}.
            </p>
            {d.cobrancaAberta.invoiceUrl ? (
              <a href={d.cobrancaAberta.invoiceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                Pagar agora <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <p className="text-xs text-gray-500">Estamos preparando seu link de pagamento.</p>
            )}
          </div>
        )}

        {!emDia && (
          <>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Escolha seu plano</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              {d.planos.map(p => {
                const sel = plano === p.id
                return (
                  <button key={p.id} onClick={() => setPlano(p.id)}
                    className={`text-left rounded-2xl border-2 p-5 transition ${
                      sel ? 'border-orange-500 bg-orange-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900">{p.nome}</span>
                      {p.destaque && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{p.destaque}</span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{brl(p.equivalenteMensal)}<span className="text-sm font-normal text-gray-500">/mês</span></div>
                    {p.id === 'anual' && (
                      <p className="text-xs text-gray-600 mt-1">{brl(p.valor)} por ano, à vista</p>
                    )}
                    {p.id === 'mensal' && (
                      <p className="text-xs text-gray-600 mt-1">cobrado todo mês</p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* O fluxo de assinar (CPF + criação no Asaas) entra na Etapa 3 */}
            <button
              disabled
              title="Disponível em instantes"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">
              Assinar plano {d.planos.find(p => p.id === plano)?.nome.toLowerCase()} <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="mt-8 flex items-start gap-2.5 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-px text-gray-400" />
          <p>
            O pagamento acontece numa página segura do Asaas, nosso parceiro financeiro.
            Os dados do seu cartão não passam nem ficam guardados no SOA.
          </p>
        </div>

        {!bloqueada && (
          <button onClick={() => router.push('/dashboard')}
            className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline">
            Voltar para o sistema
          </button>
        )}
      </div>
    </div>
  )
}
