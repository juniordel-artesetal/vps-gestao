'use client'
// Detalhe de UM lançamento, aberto pelo clique na linha — em Contas a Pagar/Receber e no
// Caixa Diário. Antes clicar não fazia nada: a artesã tinha que ir procurar o lançamento
// na mão em outra tela (chamado Taciane). Mostra o que é, e deixa dar baixa / editar /
// excluir sem sair da tela.
//
// Reaproveita ModalBaixaLancamento (que já tem o histórico e a baixa parcial/total).
import { useEffect, useState } from 'react'
import { X, Pencil, Trash2, Check, Loader2, CalendarDays, Tag, Repeat } from 'lucide-react'
import ModalBaixaLancamento, { type LancamentoBaixa } from '@/components/ModalBaixaLancamento'

interface Det {
  id: string; tipo: 'RECEITA' | 'DESPESA'; descricao: string
  valor: number; valorRealizado: number | null; status: string
  data: string; dataRealizada: string | null
  categoriaNome: string | null; canal: string | null; referencia: string | null; observacoes: string | null
  parcela: number | null; totalParcelas: number | null; recorrencia: string | null
}

const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d?: string | null) => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'

export default function ModalDetalheLancamento({ id, onFechar, onMudou }: {
  id: string
  onFechar: () => void
  /** Chamado quando algo mudou (baixa/exclusão) para a tela recarregar. */
  onMudou: () => void
}) {
  const [d, setD] = useState<Det | null>(null)
  const [erro, setErro] = useState('')
  const [baixa, setBaixa] = useState<LancamentoBaixa | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/financeiro/lancamentos/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (vivo) setD(j) })
      .catch(() => { if (vivo) setErro('Não consegui abrir este lançamento.') })
    return () => { vivo = false }
  }, [id])

  const realizado = Number(d?.valorRealizado || 0)
  const saldo = Math.max(0, Number(d?.valor || 0) - realizado)
  const aberto = d ? d.status !== 'PAGO' : false

  async function excluir() {
    setExcluindo(true)
    try {
      const r = await fetch(`/api/financeiro/lancamentos/${id}`, { method: 'DELETE' })
      if (!r.ok) { setErro('Não consegui excluir.'); return }
      onMudou(); onFechar()
    } finally { setExcluindo(false) }
  }

  // Edição continua na tela de Fluxo de Caixa (é lá que vive o formulário completo),
  // mas já abrimos direto no lançamento e no mês certo — sem procurar.
  const linkEditar = d ? `/financeiro/lancamentos?lancamento=${d.id}&ano=${String(d.data).slice(0, 4)}&mes=${Number(String(d.data).slice(5, 7))}` : '#'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onFechar}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="min-w-0">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${d?.tipo === 'RECEITA' ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                {d?.tipo === 'RECEITA' ? 'a receber' : 'a pagar'}
              </span>
              <h2 className="font-semibold text-gray-900 dark:text-white mt-1 break-words">{d?.descricao || 'Carregando…'}</h2>
            </div>
            <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={18} /></button>
          </div>

          <div className="px-5 py-4 space-y-3 text-sm">
            {erro && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
            {!d && !erro && <p className="text-gray-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</p>}

            {d && (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-gray-500 text-xs">Valor</span>
                  <span className={`text-xl font-bold ${d.tipo === 'RECEITA' ? 'text-green-600' : 'text-red-600'}`}>{brl(d.valor)}</span>
                </div>
                {realizado > 0 && (
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-gray-500">Já {d.tipo === 'RECEITA' ? 'recebido' : 'pago'}</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">{brl(realizado)} {aberto && <span className="text-amber-600">· faltam {brl(saldo)}</span>}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <p className="text-gray-500 flex items-center gap-1.5"><CalendarDays size={12} /> Vence <b className="text-gray-700 dark:text-gray-200">{dia(d.data)}</b></p>
                  <p className="text-gray-500">{d.dataRealizada ? <>Pago em <b className="text-gray-700 dark:text-gray-200">{dia(d.dataRealizada)}</b></> : <span className="text-gray-400">Ainda não pago</span>}</p>
                  {d.categoriaNome && <p className="text-gray-500 flex items-center gap-1.5"><Tag size={12} /> {d.categoriaNome}</p>}
                  {d.totalParcelas && d.totalParcelas > 1 && (
                    <p className="text-gray-500 flex items-center gap-1.5"><Repeat size={12} /> Parcela <b className="text-gray-700 dark:text-gray-200">{d.parcela}/{d.totalParcelas}</b></p>
                  )}
                  {d.canal && <p className="text-gray-500">Canal: {d.canal}</p>}
                  <p className="text-gray-500">Status: <b className="text-gray-700 dark:text-gray-200">{d.status}</b></p>
                </div>
                {d.observacoes && <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 whitespace-pre-wrap">{d.observacoes}</p>}
              </>
            )}
          </div>

          {d && (
            <div className="px-5 pb-4 flex flex-wrap gap-2">
              {aberto && (
                <button
                  onClick={() => setBaixa({ id: d.id, tipo: d.tipo, descricao: d.descricao, valor: Number(d.valor), valorRealizado: realizado, saldo, status: d.status })}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 text-sm font-semibold">
                  <Check size={15} /> {d.tipo === 'RECEITA' ? 'Recebi' : 'Paguei'}
                </button>
              )}
              <a href={linkEditar}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Pencil size={14} /> Editar
              </a>
              <button onClick={() => setConfirmar(true)} disabled={excluindo}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                <Trash2 size={14} /> Excluir
              </button>
            </div>
          )}

          {confirmar && (
            <div className="px-5 pb-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                <p className="font-medium mb-2">Excluir este lançamento? Não dá pra desfazer.</p>
                <div className="flex gap-2">
                  <button onClick={excluir} disabled={excluindo} className="rounded-lg bg-red-600 text-white px-3 py-1.5 font-semibold disabled:opacity-50">
                    {excluindo ? 'Excluindo…' : 'Sim, excluir'}
                  </button>
                  <button onClick={() => setConfirmar(false)} className="rounded-lg border border-red-200 px-3 py-1.5">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {baixa && (
        <ModalBaixaLancamento
          item={baixa}
          onFechar={() => setBaixa(null)}
          onMudou={() => { setBaixa(null); onMudou(); onFechar() }}
        />
      )}
    </>
  )
}
