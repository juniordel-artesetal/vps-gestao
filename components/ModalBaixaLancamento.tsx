'use client'

// Baixa de um lançamento (Fase 3): registrar pagamento TOTAL ou PARCIAL, DESFAZER sem excluir,
// e ver o HISTÓRICO de alterações. Dinheiro sempre em type=text + inputMode=decimal + parseNum
// (type=number decrementa o valor com scroll/seta — bug recorrente no projeto).
import { useState, useEffect, useCallback } from 'react'
import { X, RotateCcw, Check, History } from 'lucide-react'
import { parseNum } from '@/lib/pessoal/api'

const brl = (n: any) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDataHora = (s: string) => new Date(s).toLocaleString('pt-BR')

export interface LancamentoBaixa {
  id: string
  tipo: 'RECEITA' | 'DESPESA'
  descricao: string
  valor: number
  valorRealizado: number
  saldo: number
  status: string
}

export default function ModalBaixaLancamento({ item, onFechar, onMudou }: {
  item: LancamentoBaixa
  onFechar: () => void
  onMudou: () => void
}) {
  const receita = item.tipo === 'RECEITA'
  const [valorStr, setValorStr] = useState(String(item.saldo.toFixed(2)).replace('.', ','))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [hist, setHist] = useState<any[]>([])
  const [verHist, setVerHist] = useState(false)

  const carregarHist = useCallback(async () => {
    try {
      const d = await fetch(`/api/financeiro/lancamentos/${item.id}/historico`).then(r => r.json())
      setHist(d.itens || [])
    } catch { setHist([]) }
  }, [item.id])

  useEffect(() => { if (verHist) carregarHist() }, [verHist, carregarHist])

  async function chamar(url: string, body: any, acaoTxt: string) {
    setSalvando(true); setErro('')
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(d.error || `Não foi possível ${acaoTxt}`); return }
      onMudou(); onFechar()
    } catch { setErro('Erro de conexão') }
    finally { setSalvando(false) }
  }

  const valorNum = parseNum(valorStr)
  const excedeu = valorNum > item.saldo + 0.001

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {receita ? 'Registrar recebimento' : 'Registrar pagamento'}
            </h2>
            <p className="text-xs text-gray-500 truncate">{item.descricao}</p>
          </div>
          <button onClick={onFechar}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
            <p className="text-[10px] text-gray-500">Valor total</p>
            <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-gray-100">{brl(item.valor)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
            <p className="text-[10px] text-gray-500">Já {receita ? 'recebido' : 'pago'}</p>
            <p className="text-sm font-semibold tabular-nums text-green-600">{brl(item.valorRealizado)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg py-2">
            <p className="text-[10px] text-gray-500">Falta</p>
            <p className="text-sm font-semibold tabular-nums text-orange-600">{brl(item.saldo)}</p>
          </div>
        </div>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
          Quanto está {receita ? 'entrando' : 'saindo'} agora?
        </label>
        <input type="text" inputMode="decimal" value={valorStr} onChange={e => setValorStr(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="0,00" />
        <p className="text-[11px] text-gray-400 mt-1">
          Deixe o valor cheio para quitar. Um valor menor registra <strong>{receita ? 'recebimento' : 'pagamento'} parcial</strong> e o resto continua em aberto.
        </p>
        {excedeu && <p className="text-[11px] text-amber-600 mt-1">Maior que o saldo — vai quitar o lançamento (sem excedente).</p>}
        {erro && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{erro}</p>}

        <button
          onClick={() => chamar(`/api/financeiro/lancamentos/${item.id}/pagar`, { valor: valorNum }, 'registrar')}
          disabled={salvando || valorNum <= 0}
          className="w-full mt-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
          <Check size={15} /> {salvando ? 'Salvando...' : `Registrar ${brl(valorNum)}`}
        </button>

        {item.valorRealizado > 0 && (
          <button
            onClick={() => { if (confirm(`Desfazer todo o ${receita ? 'recebimento' : 'pagamento'} de ${brl(item.valorRealizado)}? O lançamento volta a ficar em aberto — nada é excluído.`)) chamar(`/api/financeiro/lancamentos/${item.id}/desfazer`, {}, 'desfazer') }}
            disabled={salvando}
            className="w-full mt-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
            <RotateCcw size={14} /> Desfazer {brl(item.valorRealizado)} já {receita ? 'recebido' : 'pago'}
          </button>
        )}

        <button onClick={() => setVerHist(v => !v)}
          className="w-full mt-3 text-xs text-gray-500 hover:text-orange-500 flex items-center justify-center gap-1.5">
          <History size={13} /> {verHist ? 'Ocultar histórico' : 'Ver histórico de alterações'}
        </button>
        {verHist && (
          <div className="mt-2 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1.5">
            {hist.length === 0 && <p className="text-xs text-gray-400 text-center py-2">Sem alterações registradas.</p>}
            {hist.map(h => (
              <div key={h.id} className="text-xs border border-gray-100 dark:border-gray-800 rounded-lg px-2.5 py-1.5">
                <p className="text-gray-700 dark:text-gray-200">{h.descricao}</p>
                <p className="text-[10px] text-gray-400">
                  {fmtDataHora(h.createdAt)}{h.usuarioNome ? ` · ${h.usuarioNome}` : ''}
                  {h.statusAntes && h.statusDepois ? ` · ${h.statusAntes} → ${h.statusDepois}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
