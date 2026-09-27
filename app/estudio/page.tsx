// SOA Design — Início do módulo: atalhos para cada área (na ordem do menu) + status das imagens do dia.
import Link from 'next/link'
import { Layers, ImagePlus, Shirt, Images, ArrowRight, CreditCard, BookOpen, Sparkles } from 'lucide-react'
import CotaBarra from '@/components/estudio/CotaBarra'

const AREAS = [
  {
    href: '/estudio/artes', titulo: 'Edição em massa', icone: Layers,
    desc: 'Escolha um template pronto, suba/selecione as artes e cole a lista de nomes e idades — sai tudo de uma vez (PNG, JPG, PDF ou ZIP).',
  },
  {
    href: '/estudio/editor', titulo: 'Editor de imagem', icone: ImagePlus,
    desc: 'Editor livre: camadas, máscaras, estilos de camada, seleção, objeto inteligente. Para criar e ajustar a arte.',
  },
  {
    href: '/estudio/templates', titulo: 'Criador de templates', icone: BookOpen,
    desc: 'Prepare a arte uma vez: leio as camadas, você marca nome/idade/hashtag e salva. Também monta o kit de várias faces (caixas).',
  },
  {
    href: '/estudio/mockups', titulo: 'Mockup de produtos', icone: Shirt,
    desc: 'Um produto ou um combo: suba a foto do seu produto (ou use a biblioteca), aplique a arte com perspectiva, luz e sombra e gere as fotos.',
  },
  {
    href: '/templates-especiais', titulo: 'Artes prontas', icone: Sparkles,
    desc: 'Acervo pronto, atualizado toda semana — abra, coloque o nome e gere. Editável dentro do SOA.',
  },
  {
    href: '/estudio/arquivos', titulo: 'Meus arquivos', icone: Images,
    desc: 'O seu “Drive”: pastas e subpastas, busca, e ações em lote (baixar ZIP, tamanhos de marketplace, marca d’água).',
  },
  {
    href: '/soa-edition', titulo: 'Assinatura e créditos', icone: CreditCard,
    desc: 'Status do SOA Design, imagens usadas hoje, pacotes extras e a assinatura das Artes prontas.',
  },
]

export default function EstudioHub() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SOA Design</h1>
        <p className="text-sm text-gray-500 mt-1">Suas artes personalizadas em lote, mockups e fotos de produto — sem refazer uma por uma.</p>
      </div>

      <CotaBarra />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AREAS.map(a => {
          const Icone = a.icone
          return (
            <Link key={a.href} href={a.href} className="h-full rounded-2xl border p-5 flex flex-col gap-3 transition bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-orange-400 hover:shadow-sm">
              <span className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 text-orange-600 dark:bg-orange-500/20"><Icone className="w-5 h-5" /></span>
              <h2 className="font-semibold text-gray-900 dark:text-white">{a.titulo}</h2>
              <p className="text-sm text-gray-500 flex-1">{a.desc}</p>
              <span className="text-sm font-semibold text-orange-600 inline-flex items-center gap-1">Abrir <ArrowRight className="w-4 h-4" /></span>
            </Link>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Os moldes, fontes e imagens que você envia são de sua responsabilidade: suba apenas arte sua ou que você tem direito de usar.
        Não use personagens, marcas ou mascotes de terceiros sem licença.
      </p>
    </div>
  )
}
