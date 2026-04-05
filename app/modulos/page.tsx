'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import {
  LayoutDashboard, DollarSign, TrendingUp, Brain,
  Settings, LogOut, ChevronLeft, ChevronRight, Zap, ExternalLink, Gift
} from 'lucide-react'
import { CHANGELOG } from '@/lib/versao'

interface Banner       { id:string; titulo:string|null; imagem:string; link:string|null; linkexterno:boolean; tempoExibicao:number }
interface Noticia      { id:string; emoji:string; titulo:string; descricao:string|null; link:string|null; linkTexto:string }
interface Oportunidade { id:string; titulo:string; descricao:string|null; link:string|null; linkTexto:string; cor:string }

const COR_MAP: Record<string, string> = {
  orange: 'from-orange-500 to-amber-500',
  purple: 'from-purple-500 to-indigo-600',
  green:  'from-green-500 to-teal-600',
  blue:   'from-blue-500 to-cyan-600',
}

const modulos = [
  { href:'/dashboard',    label:'Produção',         descricao:'Pedidos, demandas e controle de produção', icon:LayoutDashboard, cor:'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400', roles:['ADMIN','DELEGADOR','OPERADOR'] },
  { href:'/precificacao', label:'Precificação',      descricao:'Materiais, produtos, combos e canais',    icon:DollarSign,      cor:'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',         roles:['ADMIN'] },
  { href:'/financeiro',   label:'Financeiro',        descricao:'Lançamentos, fluxo de caixa e metas',     icon:TrendingUp,      cor:'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',     roles:['ADMIN'] },
  { href:'/gestao',       label:'Análise de Gestão', descricao:'Chat com IA para análise do negócio',     icon:Brain,           cor:'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',     roles:['ADMIN'] },
  { href:'/config/geral', label:'Configurações',     descricao:'Tema, produção e dados do negócio',       icon:Settings,        cor:'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',            roles:['ADMIN'] },
]

export default function ModulosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [banners,  setBanners]  = useState<Banner[]>([])
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [ops,      setOps]      = useState<Oportunidade[]>([])
  const [bannerIdx, setBannerIdx] = useState(0)
  const [autoPlay,  setAutoPlay]  = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing/banners').then(r => r.json()).catch(() => []),
      fetch('/api/marketing/noticias').then(r => r.json()).catch(() => []),
      fetch('/api/marketing/oportunidades').then(r => r.json()).catch(() => []),
    ]).then(([b, n, o]) => {
      setBanners(Array.isArray(b) ? b.filter((x: Banner) => x.imagem) : [])
      setNoticias(Array.isArray(n) ? n : [])
      setOps(Array.isArray(o) ? o : [])
    })
  }, [])

  useEffect(() => {
    if (!autoPlay || banners.length <= 1) return
    const tempo = (banners[bannerIdx]?.tempoExibicao ?? 5) * 1000
    timerRef.current = setTimeout(() => setBannerIdx(i => (i + 1) % banners.length), tempo)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [autoPlay, bannerIdx, banners])

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  )

  const role = session?.user?.role
  const modulosVisiveis = modulos.filter(m => m.roles.includes(role || ''))
  const ultimaVersao = CHANGELOG[0]
  const banner = banners[bannerIdx]

  function prev() { setAutoPlay(false); setBannerIdx(i => (i - 1 + banners.length) % banners.length) }
  function next() { setAutoPlay(false); setBannerIdx(i => (i + 1) % banners.length) }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">VPS Gestão</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{session?.user?.workspaceNome} · {session?.user?.name}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition">
            <LogOut size={16} /> Sair
          </button>
        </div>

        {/* ── Layout 3 colunas: [Oportunidades | Módulos | Novidades] ── */}
        <div className="flex gap-4 items-start">

          {/* COLUNA ESQUERDA — Oportunidades e Descontos */}
          <div className="w-52 flex-shrink-0">
            {ops.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Gift size={11} className="text-orange-500" />
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Oportunidades e Descontos</span>
                </div>
                {ops.map(o => {
                  const gradiente = COR_MAP[o.cor] || COR_MAP.orange
                  return (
                    <div key={o.id} className={`rounded-2xl p-4 bg-gradient-to-br ${gradiente}`}>
                      <p className="text-sm font-bold text-white mb-1.5 leading-snug">{o.titulo}</p>
                      {o.descricao && <p className="text-xs text-white/85 mb-3 leading-relaxed">{o.descricao}</p>}
                      {o.link && (
                        <a href={o.link} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition">
                          {o.linkTexto}
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Coluna vazia quando não há oportunidades */
              <div />
            )}
          </div>

          {/* COLUNA CENTRO — Módulos */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Módulos</h3>
            <div className="grid grid-cols-2 gap-3">
              {modulosVisiveis.map(modulo => {
                const Icon = modulo.icon
                return (
                  <a key={modulo.href} href={modulo.href}
                    className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-md hover:border-orange-200 dark:hover:border-orange-800 transition group">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${modulo.cor}`}>
                      <Icon size={18} />
                    </div>
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-0.5 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition text-sm">
                      {modulo.label}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{modulo.descricao}</p>
                  </a>
                )
              })}
            </div>
          </div>

          {/* COLUNA DIREITA — Novidades do Artesanato */}
          <div className="w-56 flex-shrink-0">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Zap size={13} className="text-orange-500" />
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Novidades do Artesanato</span>
              </div>

              {noticias.length > 0 ? (
                <div className="space-y-3 divide-y divide-gray-50 dark:divide-gray-800">
                  {noticias.map(n => (
                    <div key={n.id} className="pt-3 first:pt-0">
                      <div className="flex items-start gap-2">
                        <span className="text-base leading-none mt-0.5 flex-shrink-0">{n.emoji}</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-800 dark:text-white leading-snug">{n.titulo}</p>
                          {n.descricao && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.descricao}</p>}
                          {n.link && (
                            <a href={n.link} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-0.5 mt-1 font-medium">
                              {n.linkTexto} <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback: novidades do sistema */
                <div className="space-y-2">
                  {ultimaVersao.novidades.slice(0, 4).map((n, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-sm leading-none mt-0.5 flex-shrink-0">{n.emoji}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{n.titulo}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Banner carrossel — largura total, abaixo dos módulos ── */}
        {banners.length > 0 && banner && (
          <div className="relative rounded-2xl overflow-hidden shadow-lg">
            {banner.link ? (
              <a href={banner.link} target={banner.linkexterno ? '_blank' : '_self'} rel="noopener noreferrer" className="block">
                <img src={banner.imagem} alt={banner.titulo || 'Banner'} className="w-full h-44 md:h-56 object-cover" />
              </a>
            ) : (
              <img src={banner.imagem} alt={banner.titulo || 'Banner'} className="w-full h-44 md:h-56 object-cover" />
            )}
            {banner.titulo && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                <p className="text-white text-sm font-semibold">{banner.titulo}</p>
              </div>
            )}
            {banners.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-3 right-4 flex gap-1.5">
                  {banners.map((_, i) => (
                    <button key={i} onClick={() => { setAutoPlay(false); setBannerIdx(i) }}
                      className={`h-1.5 rounded-full transition-all ${i === bannerIdx ? 'bg-white w-5' : 'bg-white/50 w-1.5'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-2">
          VPS Gestão v{ultimaVersao.versao} · Feito com ❤️ para artesãs brasileiras
        </p>

      </div>
    </div>
  )
}
