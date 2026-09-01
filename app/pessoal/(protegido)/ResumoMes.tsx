'use client'
// Dash "Resumo do mês" do Módulo Pessoal — números vêm do FINANCEIRO PESSOAL do usuário
// (/api/pessoal/resumo-financeiro; nunca o ateliê). Dois donuts animados (Recharts): Receita e
// Despesa, cada um Efetuado × Falta, com o % efetuado no centro. Mobile-first + dark mode.
import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Wallet, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Bloco = { prevista: number; efetuada: number; falta: number }
type Resumo = { ano: number; mes: number; total: number; receita: Bloco; despesa: Bloco }

const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function Donut({ titulo, bloco, corEfetuado }: { titulo: string; bloco: Bloco; corEfetuado: string }) {
  const pct = bloco.prevista > 0 ? Math.round((bloco.efetuada / bloco.prevista) * 100) : 0
  const data = [
    { name: 'Efetuado', value: Math.max(0, bloco.efetuada) },
    { name: 'Falta', value: Math.max(0, bloco.falta) },
  ]
  const vazio = bloco.prevista <= 0
  return (
    <div className="flex-1 min-w-0 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">{titulo}</p>
      <div className="flex items-center gap-4">
        <div className="relative w-[110px] h-[110px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={vazio ? [{ name: '—', value: 1 }] : data} dataKey="value" cx="50%" cy="50%"
                innerRadius={38} outerRadius={52} paddingAngle={vazio ? 0 : 2} startAngle={90} endAngle={-270}
                stroke="none" animationDuration={900} animationBegin={120}>
                {vazio
                  ? <Cell fill="#e5e7eb" />
                  : data.map((_, i) => <Cell key={i} fill={i === 0 ? corEfetuado : '#e5e7eb'} className="dark:opacity-90" />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-gray-800 dark:text-neutral-100 leading-none">{pct}%</span>
            <span className="text-[10px] text-gray-400">efetuado</span>
          </div>
        </div>
        <div className="min-w-0 text-sm space-y-1">
          <div className="flex justify-between gap-3"><span className="text-gray-400">Prevista</span><span className="font-semibold text-gray-800 dark:text-neutral-100 tabular-nums">{brl(bloco.prevista)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-gray-400">Efetuada</span><span className="font-semibold tabular-nums" style={{ color: corEfetuado }}>{brl(bloco.efetuada)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-gray-400">Falta</span><span className="font-semibold text-gray-500 dark:text-neutral-300 tabular-nums">{brl(bloco.falta)}</span></div>
        </div>
      </div>
    </div>
  )
}

export default function ResumoMes() {
  const [dados, setDados] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetch('/api/pessoal/resumo-financeiro')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setDados).catch(() => setErro(true)).finally(() => setCarregando(false))
  }, [])

  if (carregando) return <div className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 text-sm text-gray-400">Carregando o resumo do mês…</div>
  if (erro || !dados) return null

  const mesRef = `${MESES[(dados.mes - 1) % 12]}/${dados.ano}`
  const semDados = dados.total === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-orange-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-neutral-200">Resumo do mês <span className="text-gray-400 font-normal">· {mesRef}</span></h2>
        </div>
        <Link href="/pessoal/financeiro/lancamentos" className="text-xs text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1">Financeiro <ArrowRight size={12} /></Link>
      </div>

      {semDados ? (
        <div className="rounded-2xl border border-dashed border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-neutral-400">Nada lançado ainda este mês.</p>
          <Link href="/pessoal/financeiro/lancamentos" className="inline-flex items-center gap-1 mt-2 text-sm text-orange-600 dark:text-orange-400 hover:underline">Ir para o Financeiro <ArrowRight size={13} /></Link>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3">
          <Donut titulo="📈 Receita" bloco={dados.receita} corEfetuado="#16a34a" />
          <Donut titulo="📉 Despesa" bloco={dados.despesa} corEfetuado="#f97316" />
        </div>
      )}
    </div>
  )
}
