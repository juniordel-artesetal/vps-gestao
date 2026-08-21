'use client'
// Opção "Pix Automático (sem cartão)" no checkout: pede CPF/CNPJ, cria a autorização e mostra o
// QR Code / copia-e-cola do 1º pagamento. Ao pagar, o webhook ativa a conta (externalReference=workspace).
import { useState } from 'react'
import { QrCode, Copy, Check, Loader2, Repeat } from 'lucide-react'

export default function PixAutomaticoBox() {
  const [cpf, setCpf] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<{ payload: string; encodedImage: string; valor: number } | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function gerar() {
    const doc = cpf.replace(/\D/g, '')
    if (doc.length !== 11 && doc.length !== 14) { setErro('Informe um CPF ou CNPJ válido'); return }
    setErro(''); setCarregando(true)
    try {
      const r = await fetch('/api/assinatura/pix-automatico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpfCnpj: doc }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Não foi possível gerar o Pix Automático')
      setDados({ payload: d.payload, encodedImage: d.encodedImage, valor: d.valor })
    } catch (e: any) { setErro(e?.message || 'Erro ao gerar') }
    finally { setCarregando(false) }
  }

  function copiar() {
    if (!dados) return
    navigator.clipboard?.writeText(dados.payload).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) })
  }

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-neutral-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Repeat className="w-5 h-5 text-orange-500" />
        <h3 className="font-bold text-gray-800 dark:text-neutral-100">Pix Automático <span className="text-xs font-normal text-gray-400">(sem cartão)</span></h3>
      </div>
      {!dados ? (
        <>
          <p className="text-sm text-gray-500 dark:text-neutral-400">Você autoriza uma vez e as próximas mensalidades caem sozinhas no Pix — sem precisar de cartão.</p>
          <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="Seu CPF ou CNPJ"
            className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          {erro && <p className="text-sm text-red-500">{erro}</p>}
          <button onClick={gerar} disabled={carregando}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50">
            {carregando ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</> : <><QrCode className="w-4 h-4" /> Gerar Pix Automático</>}
          </button>
        </>
      ) : (
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600 dark:text-neutral-300">Pague o 1º Pix de <b>R$ {dados.valor.toFixed(2).replace('.', ',')}</b> para ativar. As próximas serão automáticas.</p>
          {dados.encodedImage && <img src={`data:image/png;base64,${dados.encodedImage}`} alt="QR Code Pix" className="w-52 h-52 mx-auto rounded-lg border border-gray-200 dark:border-neutral-700" />}
          <button onClick={copiar} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-orange-300 text-orange-600 rounded-xl text-sm font-medium hover:bg-orange-50 dark:hover:bg-orange-500/10">
            {copiado ? <><Check className="w-4 h-4" /> Copiado!</> : <><Copy className="w-4 h-4" /> Copiar código Pix (copia-e-cola)</>}
          </button>
          <p className="text-xs text-gray-400">Assim que o pagamento cair, sua conta ativa sozinha. Pode fechar esta tela.</p>
        </div>
      )}
    </div>
  )
}
