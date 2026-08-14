'use client'
// Ativação do add-on Pessoal (R$ 5,90/mês). Fora do grupo (protegido) — acessível sem assinatura.
// Estados: NENHUMA/CANCELADA (upsell+CPF), PENDENTE (aguardando pagamento+link), ATIVA, INADIMPLENTE.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles, ExternalLink } from 'lucide-react'
import { cpfValido, limparCpf } from '@/lib/assinatura/cpf'

function mascararCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export default function AtivarPessoalPage() {
  const router = useRouter()
  const [status, setStatus] = useState<string>('...')
  const [valor, setValor] = useState(5.9)
  const [venc, setVenc] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch('/api/pessoal/assinatura')
      if (r.status === 403) { setStatus('SEM_PERMISSAO'); return }
      const d = await r.json()
      setStatus(d.status); setValor(d.valor ?? 5.9); setVenc(d.proximoVencimento ?? null)
      if (d.invoiceUrl) setInvoiceUrl(d.invoiceUrl)
      if (d.status === 'ATIVA') setTimeout(() => router.push('/pessoal'), 900)
    } catch { setStatus('NENHUMA') } finally { setCarregando(false) }
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  async function ativar() {
    setErro('')
    if (!cpfOk) { setErro('Informe um CPF válido antes de continuar.'); return }   // trava dura (o botão já fica desabilitado)
    setEnviando(true)
    try {
      const r = await fetch('/api/pessoal/assinatura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf }),
      })
      const d = await r.json().catch(() => ({}))
      // NUNCA silencioso: qualquer não-2xx mostra a mensagem real (ex.: Asaas recusou o CPF).
      if (!r.ok) { setErro(d?.error || `Não consegui ativar (erro ${r.status}). Tente de novo.`); return }
      if (d.jaAtiva) { router.push('/pessoal'); return }
      setStatus('PENDENTE'); setInvoiceUrl(d.invoiceUrl || null)
      // Pagar já: abre a fatura hospedada (cartão ou pix) numa nova aba.
      if (d.invoiceUrl) { try { window.open(d.invoiceUrl, '_blank', 'noopener') } catch { /* popup bloqueado: o botão "Abrir fatura" cobre */ } }
      else setErro('Assinatura criada, mas o link de pagamento ainda está sendo gerado — clique em "Já paguei — atualizar" em instantes.')
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setEnviando(false) }
  }

  const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  // Validação de CPF com feedback (dígito verificador real, não só 11 dígitos).
  const cpfLimpo = limparCpf(cpf)
  const cpfOk = cpfValido(cpfLimpo)
  const cpfMsg = cpfLimpo.length === 0 ? ''
    : cpfLimpo.length < 11 ? `CPF incompleto — ${cpfLimpo.length}/11 dígitos`
    : cpfOk ? '' : 'CPF inválido — confira os números'
  const card = 'w-full max-w-md rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm p-6'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      {carregando ? (
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      ) : status === 'SEM_PERMISSAO' ? (
        <div className={card + ' text-center'}>
          <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Módulo restrito</h1>
          <p className="text-sm text-gray-500 mt-1">O Pessoal está disponível apenas para administradoras da conta.</p>
          <button onClick={() => router.push('/modulos')} className="mt-4 text-sm text-orange-500 hover:underline">Voltar ao início</button>
        </div>
      ) : status === 'ATIVA' ? (
        <div className={card + ' text-center'}>
          <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Assinatura ativa!</h1>
          <p className="text-sm text-gray-500 mt-1">Levando você pro seu Pessoal…</p>
        </div>
      ) : status === 'PENDENTE' ? (
        <div className={card + ' text-center'}>
          <Loader2 className="w-8 h-8 text-orange-500 mx-auto mb-3 animate-spin" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Aguardando pagamento</h1>
          <p className="text-sm text-gray-500 mt-1">Assim que o pagamento cair, seu acesso libera sozinho.</p>
          {invoiceUrl && (
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold">
              Abrir fatura (pix/boleto) <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={carregar} className="block mx-auto mt-3 text-xs text-orange-500 hover:underline">Já paguei — atualizar</button>
        </div>
      ) : (
        <div className={card}>
          <div className="flex items-center gap-2 text-orange-600 mb-1"><Sparkles className="w-5 h-5" /><span className="text-xs font-semibold uppercase tracking-wide">Add-on Pessoal</span></div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Seu módulo pessoal</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
            Finanças pessoais, tarefas e notas — só suas, separadas do ateliê.
          </p>
          {status === 'INADIMPLENTE' && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2">
              Sua mensalidade está em aberto. Regularize pra manter o acesso.
            </div>
          )}
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-800 dark:text-neutral-100">{brl(valor)}</span>
            <span className="text-sm text-gray-400">/mês</span>
          </div>
          <label className="block text-xs font-medium text-gray-500 mt-4 mb-1">CPF (para a cobrança)</label>
          <input value={cpf} onChange={e => setCpf(mascararCpf(e.target.value))} inputMode="numeric"
            aria-invalid={!!cpfMsg}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 dark:bg-neutral-800 ${
              cpfMsg ? 'border-amber-300 focus:ring-amber-400' : cpfOk ? 'border-emerald-300 focus:ring-emerald-400' : 'border-gray-200 dark:border-neutral-700 focus:ring-orange-400'
            }`}
            placeholder="000.000.000-00" />
          <div className="flex items-center justify-between mt-1 min-h-[16px]">
            <span className={`text-[11px] ${cpfMsg ? 'text-amber-600' : 'text-gray-400'}`}>{cpfMsg || `${cpfLimpo.length}/11 dígitos`}</span>
            {cpfOk && <span className="text-[11px] text-emerald-600 font-medium">CPF válido ✓</span>}
          </div>
          {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
          <button onClick={ativar} disabled={enviando || !cpfOk}
            title={!cpfOk ? 'Informe um CPF válido para continuar' : ''}
            className="w-full mt-3 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando fatura…</> : `Ativar por ${brl(valor)}/mês`}
          </button>
          <p className="text-[11px] text-gray-400 mt-3 text-center">Pagamento seguro via Asaas (pix ou boleto). Cancele quando quiser.</p>
        </div>
      )}
    </div>
  )
}
