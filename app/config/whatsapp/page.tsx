'use client'
import { useEffect, useState, useCallback } from 'react'
import { MessageCircle, CheckCircle2, XCircle, Save, Mic, Bell } from 'lucide-react'

const EVENTOS = [
  { key: 'novo_pedido', label: 'Novo pedido' },
  { key: 'orcamento_aprovado', label: 'Aprovação de orçamento' },
  { key: 'conta_pagar', label: 'Conta a pagar' },
  { key: 'conta_receber', label: 'Conta a receber' },
]

export default function ConfigWhatsappPage() {
  const [numero, setNumero] = useState('')
  const [credencial, setCredencial] = useState('')
  const [temCredencial, setTemCredencial] = useState(false)
  const [eventos, setEventos] = useState<string[]>([])
  const [vozAtiva, setVozAtiva] = useState(false)
  const [conectado, setConectado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')
  const [previewVoz] = useState('Recebi 150 reais da venda dos chaveiros')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/whatsapp/config')
      if (res.ok) {
        const d = await res.json()
        setNumero(d.numero || ''); setConectado(!!d.conectado); setVozAtiva(!!d.vozAtiva)
        setTemCredencial(!!d.temCredencial)
        try { setEventos(d.eventos ? JSON.parse(d.eventos) : []) } catch { setEventos([]) }
      }
    } finally { setCarregando(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function toggleEvento(k: string) {
    setEventos(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  }
  async function salvar() {
    setSalvando(true)
    try {
      await fetch('/api/whatsapp/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, eventos, vozAtiva, credencial: credencial || undefined }),
      })
      setCredencial(''); setMsg('Configurações salvas.'); setTimeout(() => setMsg(''), 3000); carregar()
    } finally { setSalvando(false) }
  }

  if (carregando) return <div className="p-6 text-gray-400 text-sm">Carregando…</div>

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center"><MessageCircle className="w-5 h-5 text-green-600" /></div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">WhatsApp</h1>
          <p className="text-sm text-gray-500">Notificações e lançamentos por WhatsApp (em preparação).</p>
        </div>
      </div>

      <div className="mb-4 text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        🚧 Integração em preparação. Você já pode configurar aqui; o envio real entra quando a WhatsApp Cloud API for conectada.
      </div>
      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">{msg}</div>}

      {/* Conexão */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-gray-800 dark:text-gray-100">Conectar WhatsApp</span>
          {conectado
            ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Conectado</span>
            : <span className="flex items-center gap-1 text-sm text-gray-400"><XCircle className="w-4 h-4" /> Desconectado</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Número (com DDI/DDD)</label>
            <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="55 11 99999-9999"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Token/credencial {temCredencial && <span className="text-emerald-600">(salvo)</span>}</label>
            <input type="password" value={credencial} onChange={e => setCredencial(e.target.value)} placeholder={temCredencial ? '•••• (mantém se vazio)' : 'cole a credencial'}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">A credencial é guardada criptografada e nunca é exibida.</p>
      </div>

      {/* Eventos */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <div className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2"><Bell className="w-4 h-4 text-green-600" /> Avisar por WhatsApp quando…</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {EVENTOS.map(ev => (
            <label key={ev.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={eventos.includes(ev.key)} onChange={() => toggleEvento(ev.key)} className="accent-green-600" />
              {ev.label}
            </label>
          ))}
        </div>
      </div>

      {/* Lançamento por voz */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-green-600" />
            <div>
              <div className="font-semibold text-gray-800 dark:text-gray-100">Lançamento financeiro por voz</div>
              <p className="text-xs text-gray-500">Mande um áudio no WhatsApp e vira lançamento no Financeiro.</p>
            </div>
          </div>
          <input type="checkbox" checked={vozAtiva} onChange={e => setVozAtiva(e.target.checked)} className="w-5 h-5 accent-green-600" />
        </label>
        {vozAtiva && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm">
            <div className="text-xs text-gray-400 mb-1">Prévia (exemplo de como ficaria):</div>
            <div className="italic text-gray-600 dark:text-gray-300">🎤 "{previewVoz}"</div>
            <div className="mt-2 text-gray-700 dark:text-gray-200">→ <strong className="text-emerald-600">Receita</strong> · "Venda dos chaveiros" · <strong>R$ 150,00</strong> <span className="text-[11px] text-gray-400">(confirmação antes de salvar)</span></div>
          </div>
        )}
      </div>

      <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}
