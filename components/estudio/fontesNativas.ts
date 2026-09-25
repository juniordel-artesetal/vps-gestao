// SOA Edition — biblioteca de fontes NATIVAS. Todas são Google Fonts sob licença OFL
// (uso comercial livre), baixadas no build e servidas pelo próprio SOA via next/font —
// nenhuma requisição a terceiros em tempo de execução. Regra de IP do módulo: só conteúdo
// próprio ou licenciado na biblioteca nativa.
import { Fredoka, Baloo_2, Pacifico, Lobster, Dancing_Script, Great_Vibes, Amatic_SC, Poppins } from 'next/font/google'

const fredoka = Fredoka({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' })
const baloo = Baloo_2({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' })
const pacifico = Pacifico({ subsets: ['latin'], weight: '400', display: 'swap' })
const lobster = Lobster({ subsets: ['latin'], weight: '400', display: 'swap' })
const dancing = Dancing_Script({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' })
const greatVibes = Great_Vibes({ subsets: ['latin'], weight: '400', display: 'swap' })
const amatic = Amatic_SC({ subsets: ['latin'], weight: ['400', '700'], display: 'swap' })
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '700'], style: ['normal', 'italic'], display: 'swap' })

/** Primeira família do stack gerado pelo next/font (nome real registrado no documento). */
const familia = (f: { style: { fontFamily: string } }) => f.style.fontFamily.split(',')[0].trim()

export interface FonteNativa { id: string; rotulo: string; familia: string; className: string }

export const FONTES_NATIVAS: FonteNativa[] = [
  { id: 'fredoka', rotulo: 'Fredoka', familia: familia(fredoka), className: fredoka.className },
  { id: 'baloo', rotulo: 'Baloo 2', familia: familia(baloo), className: baloo.className },
  { id: 'pacifico', rotulo: 'Pacifico', familia: familia(pacifico), className: pacifico.className },
  { id: 'lobster', rotulo: 'Lobster', familia: familia(lobster), className: lobster.className },
  { id: 'dancing', rotulo: 'Dancing Script', familia: familia(dancing), className: dancing.className },
  { id: 'greatvibes', rotulo: 'Great Vibes', familia: familia(greatVibes), className: greatVibes.className },
  { id: 'amatic', rotulo: 'Amatic SC', familia: familia(amatic), className: amatic.className },
  { id: 'poppins', rotulo: 'Poppins', familia: familia(poppins), className: poppins.className },
]

/** Classes que, aplicadas num elemento escondido, fazem o navegador carregar todas as fontes. */
export const CLASSES_PRECARGA = FONTES_NATIVAS.map(f => f.className)
