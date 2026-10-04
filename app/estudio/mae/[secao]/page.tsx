// Método MAE — cada item do menu (Montar a base, Criar tema, Editor de imagem, Pedidos e edição em massa,
// Loja da Naty, Como usar) abre o MESMO editor já na função certa.
import { notFound } from 'next/navigation'
import { TelaMae } from '../page'

export const metadata = { title: 'Método MAE · SOA' }
const SECOES = ['base', 'tema', 'imagem', 'pedidos', 'loja', 'ajuda']

export default async function SecaoMae({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params
  if (!SECOES.includes(secao)) notFound()
  return <TelaMae secao={secao} />
}
