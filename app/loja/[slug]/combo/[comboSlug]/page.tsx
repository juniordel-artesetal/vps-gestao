// Rota SSR do COMBO (deep link) — espelha a do produto. Emite Open Graph (prévia com
// foto/nome/preço no WhatsApp) e renderiza a MESMA loja (client), que abre aquele combo
// pelo comboSlug (useParams). O resolver (resolverProdutoLoja) já trata tipo='combo'.
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import LojaCliente from '../../LojaCliente'
import { resolverProdutoLoja } from '@/lib/lojaProdutoSlug'

export const dynamic = 'force-dynamic'

const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Hosts da própria plataforma — pra montar o og:url no caminho certo (custom → /combo/x).
const PLATAFORMA = ['usesoa.com.br', 'vps-gestao.com.br', 'vercel.app', 'localhost']
const ehPlataforma = (h: string) => PLATAFORMA.some(p => h === p || h.endsWith('.' + p))

export async function generateMetadata({ params }: { params: Promise<{ slug: string; comboSlug: string }> }): Promise<Metadata> {
  const { slug, comboSlug } = await params
  const h = await headers()
  const host = (h.get('x-forwarded-host') || h.get('host') || '').split(':')[0].toLowerCase()
  const proto = h.get('x-forwarded-proto') || 'https'
  const base = host ? `${proto}://${host}` : ''

  const p = await resolverProdutoLoja(slug, comboSlug).catch(() => null)
  if (!p) return { title: 'Combo indisponível' }

  // og:url no caminho que a pessoa realmente compartilha (domínio próprio → /combo/x).
  const path = ehPlataforma(host) ? `/loja/${slug}/combo/${comboSlug}` : `/combo/${comboSlug}`
  const url = base ? `${base}${path}` : path
  const img = p.imgPath && base ? `${base}${p.imgPath}` : undefined

  const tituloOg = `${p.nome} — ${brl(p.preco)}`
  const desc = [brl(p.preco), p.descricao].filter(Boolean).join(' · ').slice(0, 200)

  return {
    title: p.nome,
    description: desc,
    openGraph: {
      title: tituloOg,
      description: desc,
      url,
      type: 'website',
      images: img ? [{ url: img }] : [],
    },
    twitter: {
      card: img ? 'summary_large_image' : 'summary',
      title: tituloOg,
      description: desc,
      images: img ? [img] : [],
    },
  }
}

export default function ComboPage() {
  return <LojaCliente />
}
