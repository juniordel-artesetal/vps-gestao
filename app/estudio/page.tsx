// SOA Edition — hub do módulo. Fase 1: edição em massa de artes. Fase 2: editor de imagem em
// camadas + ações em lote. Fase 3: mockup com produto + kit de caixas (Método Mãe).
import Link from 'next/link'
import { Layers, ImagePlus, Shirt, Images, ArrowRight, SlidersHorizontal, CreditCard, Box } from 'lucide-react'

const BLOCOS = [
  {
    href: '/estudio/artes',
    titulo: 'Edição em massa de artes',
    desc: 'Suba o molde, marque onde vai o nome, a idade, a turma… e gere todas as artes de uma vez — colando a lista, importando planilha ou puxando direto de um pedido.',
    icone: Layers,
    ativo: true,
  },
  {
    href: '/estudio/editor',
    titulo: 'Editor de imagem',
    desc: 'Camadas, objeto inteligente, perspectiva e malha, máscaras, ajustes — e exporta no tamanho de cada marketplace.',
    icone: ImagePlus,
    ativo: true,
  },
  {
    href: '/estudio/caixas',
    titulo: 'Kit de caixas',
    desc: 'Monte o tema uma vez por face — frente, laterais, trás e cima — e ele vai para todas as caixas do kit. Apliques à parte, nome/idade em massa e a caixa montada em 3D.',
    icone: Box,
    ativo: true,
  },
  {
    href: '/estudio/mockups',
    titulo: 'Mockup com produto',
    desc: 'Aplique sua arte na foto do produto real (ou da biblioteca), monte a cena de estúdio e gere o kit de fotos do anúncio.',
    icone: Shirt,
    ativo: true,
  },
]

export default function EstudioHub() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SOA Edition</h1>
        <p className="text-sm text-gray-500 mt-1">Suas artes personalizadas em lote — sem refazer uma por uma.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {BLOCOS.map(b => {
          const Icone = b.icone
          const card = (
            <div className={`h-full rounded-2xl border p-5 flex flex-col gap-3 transition ${b.ativo
              ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-orange-400 hover:shadow-sm'
              : 'bg-gray-50 dark:bg-gray-900/40 border-dashed border-gray-200 dark:border-gray-800 opacity-70'}`}>
              <div className="flex items-center justify-between">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${b.ativo ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20' : 'bg-gray-200 text-gray-500 dark:bg-gray-800'}`}>
                  <Icone className="w-5 h-5" />
                </span>
                {!b.ativo && <span className="text-[11px] font-medium text-gray-500 bg-gray-200 dark:bg-gray-800 rounded-full px-2 py-0.5">em breve</span>}
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{b.titulo}</h2>
              <p className="text-sm text-gray-500 flex-1">{b.desc}</p>
              {b.ativo && <span className="text-sm font-semibold text-orange-600 inline-flex items-center gap-1">Abrir <ArrowRight className="w-4 h-4" /></span>}
            </div>
          )
          return b.ativo ? <Link key={b.titulo} href={b.href}>{card}</Link> : <div key={b.titulo}>{card}</div>
        })}
      </div>

      <Link href="/soa-edition" className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-orange-400 transition">
        <CreditCard className="w-5 h-5 text-orange-500" />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white text-sm">Assinatura e créditos</p>
          <p className="text-xs text-gray-500">Status do módulo, imagens usadas hoje e pacotes extras.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </Link>

      <Link href="/estudio/lote" className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-orange-400 transition">
        <SlidersHorizontal className="w-5 h-5 text-orange-500" />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white text-sm">Ações em lote</p>
          <p className="text-xs text-gray-500">O mesmo recorte, tamanho de canal, ajuste e marca d’água em até 50 fotos de uma vez — com presets salvos.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </Link>

      <Link href="/estudio/arquivos" className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-orange-400 transition">
        <Images className="w-5 h-5 text-orange-500" />
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-white text-sm">Meus arquivos</p>
          <p className="text-xs text-gray-500">Moldes, fontes e artes geradas — organizados em pastas.</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-400" />
      </Link>

      <p className="text-xs text-gray-400 leading-relaxed">
        Os moldes, fontes e imagens que você envia são de sua responsabilidade: suba apenas arte sua ou que você tem direito de usar.
        Não use personagens, marcas ou mascotes de terceiros sem licença.
      </p>
    </div>
  )
}
