'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CreditCard, ArrowLeft, Copy, Check } from 'lucide-react'

const inputClass = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function PagamentoConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState('')
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [temCredencial, setTemCredencial] = useState(false)

  const [m, setM] = useState({ pix: false, link: false, mercadopago: false })
  const [form, setForm] = useState({
    pixChave: '', pixNome: '', pixCidade: '', linkPagamento: '',
    credencial: '', provedorAtivo: false,
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos'); else carregar()
    }
  }, [status])

  async function carregar() {
    try {
      const d = await (await fetch('/api/config/loja/pagamento')).json()
      const c = d.config
      if (c) {
        setForm(f => ({ ...f, pixChave: c.pixChave || '', pixNome: c.pixNome || '', pixCidade: c.pixCidade || '', linkPagamento: c.linkPagamento || '', provedorAtivo: !!c.provedorAtivo }))
        setTemCredencial(!!c.temCredencial)
        let ativos: string[] = []
        try { ativos = c.metodos ? JSON.parse(c.metodos) : [] } catch {}
        setM({ pix: ativos.includes('pix'), link: ativos.includes('link'), mercadopago: ativos.includes('mercadopago') })
      }
    } finally { setLoading(false) }
  }

  async function salvar() {
    setSalvando(true); setErro(''); setOk('')
    try {
      const metodos = Object.entries(m).filter(([, v]) => v).map(([k]) => k)
      const payload: any = {
        pixChave: form.pixChave, pixNome: form.pixNome, pixCidade: form.pixCidade,
        linkPagamento: form.linkPagamento, provedor: 'mercadopago', provedorAtivo: form.provedorAtivo, metodos,
      }
      // Só envia a credencial se o usuário digitou uma nova (não sobrescreve com vazio)
      if (form.credencial.trim()) payload.credencial = form.credencial.trim()
      const res = await fetch('/api/config/loja/pagamento', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      setOk('Configuração salva!'); setTimeout(() => setOk(''), 3000)
      if (form.credencial.trim()) { setTemCredencial(true); setForm(f => ({ ...f, credencial: '' })) }
    } finally { setSalvando(false) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const webhookUrl = `${baseUrl}/api/pagamento/webhook/mercadopago`
  const copiar = () => { navigator.clipboard.writeText(webhookUrl).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) }) }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        <a href="/config/loja" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Voltar para a loja</a>
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Pagamento da Loja</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Escolha como a cliente paga. O dinheiro cai direto na sua conta — nada passa pela gente.</p>

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">{erro}</div>}
        {ok && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {ok}</div>}

        <div className="space-y-4">
          {/* PIX por chave */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <label className="flex items-center justify-between cursor-pointer mb-1">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">PIX (sua chave)</span>
              <input type="checkbox" checked={m.pix} onChange={e => setM(s => ({ ...s, pix: e.target.checked }))} className="accent-orange-500" />
            </label>
            <p className="text-xs text-gray-400 mb-3">Gera o "copia e cola" com o valor do pedido. A confirmação é manual (a cliente envia o comprovante e você marca como pago).</p>
            {m.pix && (
              <div className="space-y-2">
                <input value={form.pixChave} onChange={e => setForm(f => ({ ...f, pixChave: e.target.value }))} placeholder="Chave PIX (email, telefone, CPF/CNPJ ou aleatória)" className={inputClass} />
                <div className="flex gap-2">
                  <input value={form.pixNome} onChange={e => setForm(f => ({ ...f, pixNome: e.target.value }))} placeholder="Nome do recebedor" className={inputClass} />
                  <input value={form.pixCidade} onChange={e => setForm(f => ({ ...f, pixCidade: e.target.value }))} placeholder="Cidade" className={inputClass} />
                </div>
              </div>
            )}
          </div>

          {/* Link genérico */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <label className="flex items-center justify-between cursor-pointer mb-1">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Link de pagamento</span>
              <input type="checkbox" checked={m.link} onChange={e => setM(s => ({ ...s, link: e.target.checked }))} className="accent-orange-500" />
            </label>
            <p className="text-xs text-gray-400 mb-3">Um link de qualquer serviço (InfinitePay, PagBank, etc). A cliente é levada ao link; confirmação manual.</p>
            {m.link && <input value={form.linkPagamento} onChange={e => setForm(f => ({ ...f, linkPagamento: e.target.value }))} placeholder="https://..." className={inputClass} />}
          </div>

          {/* Mercado Pago */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <label className="flex items-center justify-between cursor-pointer mb-1">
              <span className="text-sm font-semibold text-gray-800 dark:text-white">Mercado Pago (PIX automático)</span>
              <input type="checkbox" checked={m.mercadopago} onChange={e => setM(s => ({ ...s, mercadopago: e.target.checked, }))} className="accent-orange-500" />
            </label>
            <p className="text-xs text-gray-400 mb-3">Gera o PIX e confirma o pagamento <strong>automaticamente</strong>. Cole seu Access Token do Mercado Pago (Suas integrações → Credenciais de produção).</p>
            {m.mercadopago && (
              <div className="space-y-3">
                <input type="password" value={form.credencial} onChange={e => setForm(f => ({ ...f, credencial: e.target.value }))}
                  placeholder={temCredencial ? '•••••• (token salvo — deixe em branco p/ manter)' : 'Cole seu Access Token'} className={inputClass} />
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={form.provedorAtivo} onChange={e => setForm(f => ({ ...f, provedorAtivo: e.target.checked }))} className="accent-orange-500" />
                  Ativar Mercado Pago
                </label>
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">No painel do Mercado Pago, cadastre esta URL de notificação (webhook):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] text-gray-600 dark:text-gray-300 break-all flex-1">{webhookUrl}</code>
                    <button type="button" onClick={copiar} className="text-xs text-orange-500 flex items-center gap-1 flex-shrink-0">{copiado ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button onClick={salvar} disabled={salvando} className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar pagamento'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">🔒 Seu token fica guardado com segurança e nunca aparece na loja pública. Sem pagamento configurado, o pedido é combinado por fora (como antes).</p>
      </div>
    </div>
  )
}
