'use client'
// Página de migração (Passo 2): a artesã ativa a mensalidade no SOA (cartão), com o
// 1º mês a R$ 9,90 (cupom da whitelist). SEM login: identifica pelo TOKEN do link
// (?e=&t=), pela sessão, ou pedindo o E-MAIL. O cartão é digitado na página do Asaas
// (tokenização) — nunca no nosso lado. Vincula ao workspace EXISTENTE (nunca cria conta).
import { useEffect, useState, Suspense } from 'react'

const mascaraCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

interface Preco {
  precisaEmail?: boolean
  email?: string
  contaEncontrada?: boolean
  nome?: string | null
  temCupom: boolean
  primeiroMes: number
  mensal: number
}

function Migrar() {
  const [token, setToken] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [cpf, setCpf] = useState('')
  const [preco, setPreco] = useState<Preco | null>(null)
  const [resolvendo, setResolvendo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Identifica pela URL (?e=&t=) / sessão logo ao abrir.
  useEffect(() => {
    const q = typeof window !== 'undefined' ? window.location.search : ''
    setToken(new URLSearchParams(q).get('t') || '')
    fetch(`/api/campanha/migrar${q}`).then(r => r.ok ? r.json() : null).then(setPreco).catch(() => {})
  }, [])

  // Fallback: a artesã informa o e-mail → resolve identidade + preço.
  async function resolverEmail(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setResolvendo(true)
    try {
      const r = await fetch(`/api/campanha/migrar?email=${encodeURIComponent(emailInput.trim())}`)
      const d: Preco = await r.json()
      setPreco(d)
    } catch { setErro('Não consegui verificar seu e-mail. Tente de novo.') }
    finally { setResolvendo(false) }
  }

  async function ativar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const r = await fetch('/api/campanha/migrar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: preco?.email || emailInput.trim(), t: token, cpf }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui ativar. Tente de novo.'); setLoading(false); return }
      if (d.invoiceUrl) { window.location.href = d.invoiceUrl; return } // página do Asaas p/ cadastrar o cartão
      setErro('Assinatura criada, mas o link de pagamento não veio. Recarregue em instantes.'); setLoading(false)
    } catch { setErro('Erro de conexão. Tente de novo.'); setLoading(false) }
  }

  const identificada = !!preco && !preco.precisaEmail && !!preco.email
  const contaOk = identificada && preco?.contaEncontrada !== false

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Migrar meu plano 💛</h1>
          {identificada ? (
            preco?.temCupom ? (
              <p className="text-gray-400 text-sm mt-1">1º mês por só <b className="text-emerald-400">{brl(preco.primeiroMes)}</b> (crédito da diferença); depois {brl(preco.mensal)}/mês.</p>
            ) : (
              <p className="text-gray-400 text-sm mt-1">Sua mensalidade: <b className="text-white">{brl(preco?.mensal ?? 29.9)}</b>/mês.</p>
            )
          ) : (
            <p className="text-gray-400 text-sm mt-1">Confirme seu e-mail para continuar — sem precisar entrar na conta.</p>
          )}
        </div>

        {/* PASSO 0 — pedir o e-mail (quando não veio token nem sessão) */}
        {!identificada && (
          <form onSubmit={resolverEmail} className="space-y-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div>
              <label className="text-sm text-gray-300 block mb-1">Seu e-mail</label>
              <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="voce@email.com" inputMode="email" autoComplete="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
              <p className="text-xs text-gray-500 mt-1">Use o mesmo e-mail da sua conta no SOA.</p>
            </div>
            {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
            <button type="submit" disabled={resolvendo} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition">
              {resolvendo ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        )}

        {/* Aviso quando o e-mail não corresponde a nenhuma conta */}
        {identificada && !contaOk && (
          <div className="space-y-3 bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center">
            <p className="text-amber-300 text-sm">Não encontramos uma conta do SOA com o e-mail <b>{preco?.email}</b>.</p>
            <p className="text-gray-400 text-xs">Confira se digitou certo (use o mesmo e-mail do seu acesso) ou fale com o suporte que a gente resolve rapidinho. 💛</p>
            <button onClick={() => { setPreco({ precisaEmail: true, temCupom: false, primeiroMes: 29.9, mensal: 29.9 }); setEmailInput('') }}
              className="text-sm text-orange-400 hover:text-orange-300 underline">Tentar outro e-mail</button>
          </div>
        )}

        {/* PASSO 1 — CPF + ir para o pagamento */}
        {contaOk && (
          <>
            {preco?.temCupom && (
              <div className="mb-4 rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-4 py-2.5 text-center text-sm text-emerald-300">
                🎉 Você tem o crédito da diferença: <b>1º mês {brl(preco.primeiroMes)}</b> (economia de {brl(preco.mensal - preco.primeiroMes)}).
              </div>
            )}
            <form onSubmit={ativar} className="space-y-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
              {preco?.email && (
                <p className="text-xs text-gray-500">Conta: <b className="text-gray-300">{preco.email}</b>{preco?.nome ? ` · ${preco.nome}` : ''}</p>
              )}
              <div>
                <label className="text-sm text-gray-300 block mb-1">Seu CPF</label>
                <input value={cpf} onChange={e => setCpf(mascaraCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                <p className="text-xs text-gray-500 mt-1">Exigido pelo Asaas para emitir sua assinatura. Não guardamos seu CPF.</p>
              </div>
              <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-xs text-gray-300">
                Na próxima tela (segura, do Asaas) você cadastra o cartão — ele cobra sozinho todo mês. Nenhum dado de cartão passa pelo SOA. 💛
              </div>
              {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
              <button type="submit" disabled={loading} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                {loading ? 'Criando sua assinatura…' : 'Continuar para o pagamento'}
              </button>
              <p className="text-xs text-gray-600 text-center">Depois de assinar, não esqueça de cancelar a cobrança antiga na Hotmart.</p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><Migrar /></Suspense>
}
