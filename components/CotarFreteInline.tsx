'use client'
// Botão "Cotar frete" reutilizável (orçamento). Self-gated por moduloPostagem:
// se o módulo estiver OFF (ou sem conexão), não renderiza nada. Ao escolher uma
// opção, chama onEscolher(preco) — o campo de frete continua editável manualmente.
import { useEffect, useState, useCallback } from 'react'
import { Truck, Loader2, X } from 'lucide-react'

interface Opcao { servicoId: string; transportadora: string; servico: string; preco: number; prazoDias: number | null }

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

export default function CotarFreteInline({ valor, onEscolher }: {
  valor?: number | null
  onEscolher: (preco: number) => void
}) {
  const [disponivel, setDisponivel] = useState<boolean | null>(null)
  const [aberto, setAberto] = useState(false)
  const [cep, setCep] = useState('')
  const [peso, setPeso] = useState('0.3')
  const [cotando, setCotando] = useState(false)
  const [opcoes, setOpcoes] = useState<Opcao[]>([])
  const [erro, setErro] = useState('')

  const checar = useCallback(async () => {
    try {
      const res = await fetch('/api/config/logistica')
      if (res.ok) {
        const d = await res.json()
        setDisponivel(!!d.moduloPostagem && !!d.config?.conectado)
      } else setDisponivel(false)
    } catch { setDisponivel(false) }
  }, [])
  useEffect(() => { checar() }, [checar])

  async function cotar() {
    if (cep.replace(/\D/g, '').length !== 8) { setErro('Informe o CEP.'); return }
    setCotando(true); setErro(''); setOpcoes([])
    try {
      const res = await fetch('/api/logistica/cotar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cepDestino: cep, peso: Number(peso) || 0.3, valor: Number(valor) || 0 }),
      })
      const d = await res.json()
      if (res.ok) setOpcoes(d.opcoes || [])
      else setErro(d.error || 'Falha na cotação.')
    } finally { setCotando(false) }
  }

  if (!disponivel) return null

  return (
    <div className="relative inline-block">
      <button type="button" onClick={() => setAberto(a => !a)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:brightness-95">
        <Truck className="w-3.5 h-3.5" /> Cotar frete
      </button>

      {aberto && (
        <div className="absolute right-0 z-30 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Cotar frete</span>
            <button type="button" onClick={() => setAberto(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-gray-500">CEP destino</label>
              <input value={cep} onChange={e => setCep(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000000"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">Peso (kg)</label>
              <input type="number" step="0.1" min="0.05" value={peso} onChange={e => setPeso(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <button type="button" onClick={cotar} disabled={cotando}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50">
            {cotando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Cotar
          </button>
          {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
          {opcoes.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {opcoes.map(o => (
                <button type="button" key={o.servicoId}
                  onClick={() => { onEscolher(o.preco); setAberto(false) }}
                  className="w-full flex items-center justify-between text-left text-sm px-2 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20">
                  <span className="text-gray-700 dark:text-gray-200">{o.transportadora} · {o.servico}</span>
                  <span className="text-gray-500">{fmtBRL(o.preco)}{o.prazoDias != null ? ` · ${o.prazoDias}d` : ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
