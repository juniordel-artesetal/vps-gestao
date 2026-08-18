// Home do módulo Pessoal (atrás do gate ADMIN + assinatura ATIVA). Portal pras 3 áreas.
import Link from 'next/link'
import { ArrowLeft, Wallet, ListChecks, StickyNote } from 'lucide-react'
import TelegramConectar from './TelegramConectar'
import ResumoGeral from './ResumoGeral'

const areas = [
  { href: '/pessoal/financeiro', label: 'Finanças', desc: 'Contas, lançamentos, fluxo e metas — só seus.', icon: Wallet, cor: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
  { href: '/pessoal/tarefas', label: 'Tarefas', desc: 'Organize seu dia: lista, agenda e prioridades.', icon: ListChecks, cor: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400' },
  { href: '/pessoal/notas', label: 'Notas', desc: 'Cadernos, etiquetas, busca e editor com checklists.', icon: StickyNote, cor: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
]

export default function PessoalHome() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/modulos" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200">
          <ArrowLeft className="w-4 h-4" /> Voltar aos módulos
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Meu Pessoal</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400">Seu espaço privado — finanças, tarefas e notas, separados do ateliê.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {areas.map(a => {
          const Icon = a.icon
          return (
            <Link key={a.href} href={a.href} className="rounded-2xl border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-800 transition group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${a.cor}`}><Icon size={20} /></div>
              <p className="font-semibold text-gray-800 dark:text-neutral-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition">{a.label}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{a.desc}</p>
            </Link>
          )
        })}
      </div>
      <TelegramConectar />
      <ResumoGeral />
    </div>
  )
}
