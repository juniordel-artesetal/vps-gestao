'use client'
// Página de migração (Passo 2): a artesã ativa a mensalidade no SOA (cartão), com
// o 1º mês a R$ 9,90 (cupom da whitelist). O cartão é digitado na página do Asaas
// (tokenização) — nunca no nosso lado.
import { useEffect, useState } from 'react'

const mascaraCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

export default function Migrar() {
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [preco, setPreco] = useState<{ primeiroMes: number; mensal: number; temCupom: boolean } | null>(null)

  useEffect(() => {
    fetch('/api/campanha/migrar').then(r => r.ok ? r.json() : null).then(setPreco).catch(() => {})
  }, [])

  async function ativar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setLoading(true)
    try {
      const r = await fetch('/api/campanha/migrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cpf }) })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui ativar. Tente de novo.'); setLoading(false); return }
      if (d.invoiceUrl) { window.location.href = d.invoiceUrl; return } // página do Asaas p/ cadastrar o cartão
      setErro('Assinatura criada, mas o link de pagamento não veio. Recarregue em instantes.'); setLoading(false)
    } catch { setErro('Erro de conexão. Tente de novo.'); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Migrar meu plano 💛</h1>
          {preco?.temCupom ? (
            <p className="text-gray-400 text-sm mt-1">1º mês por só <b className="text-emerald-400">{brl(preco.primeiroMes)}</b> (crédito da diferença); depois {brl(preco.mensal)}/mês.</p>
          ) : (
            <p className="text-gray-400 text-sm mt-1">Sua mensalidade: <b className="text-white">{brl(preco?.mensal ?? 29.9)}</b>/mês.</p>
          )}
        </div>
        {preco?.temCupom && (
          <div className="mb-4 rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-4 py-2.5 text-center text-sm text-emerald-300">
            🎉 Você tem o crédito da diferença: <b>1º mês {brl(preco.primeiroMes)}</b> (economia de {brl(preco.mensal - preco.primeiroMes)}).
          </div>
        )}
        <form onSubmit={ativar} className="space-y-4 bg-gray-900 border border-gray-800 rounded-2xl p-5">
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
      </div>
    </div>
  )
}
