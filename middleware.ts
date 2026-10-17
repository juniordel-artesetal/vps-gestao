import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { lancamentoMaeChegou } from '@/lib/mae/assinatura/lancamento'

// Áreas das ARTESÃS (assumem sessão com workspaceId). Uma sessão de parceira
// (workspaceId nulo) que caia aqui é redirecionada — nunca acessa, nunca quebra.
const AREAS_ARTESA = [
  '/dashboard', '/clientes', '/config', '/demandas', '/financeiro', '/gestao',
  '/minha-loja', '/pesquisa-preco', '/precificacao', '/suporte', '/tarefas',
  '/modulos', '/setup',
]
const ehArtesa = (p: string) => AREAS_ARTESA.some(a => p === a || p.startsWith(a + '/'))
// MÉTODO MÃE STANDALONE (conta só-MAE): fora do MAE, nada do ERP nem do SOA Design. Estas são as áreas que ela
// não vê (o MAE mora em /estudio/mae e a assinatura dele em /mae/assinatura).
const AREAS_FORA_DO_MAE = [...AREAS_ARTESA, '/producao', '/compras', '/marketplace', '/integracoes', '/templates-especiais',
  '/pessoal', '/soa-edition', '/assinatura', '/estudio']
const foraDoMae = (p: string) => !p.startsWith('/estudio/mae') && AREAS_FORA_DO_MAE.some(a => p === a || p.startsWith(a + '/'))
// a venda (e o desligamento do SOA Design) só vale a partir do HORÁRIO do lançamento (16/10/2026 20h)
const vendaMaeAberta = () => String(process.env.MAE_VENDA_ATIVO || '').toLowerCase() === 'on' && lancamentoMaeChegou()

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // ── DOMÍNIO PRÓPRIO DA LOJA (roteamento por Host) ───────────────────────────
  // Request chegando por um domínio custom (não é da plataforma) na raiz "/" →
  // resolve host→slug (API interna cacheável) e reescreve para a loja daquele
  // workspace. Hosts da plataforma seguem o fluxo normal, sem custo (sem fetch).
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0]
  const ehPlataforma = !host || host === 'localhost' || host.endsWith('.vercel.app')
    || host.endsWith('usesoa.com.br') || host.endsWith('vps-gestao.com.br')
  if (!ehPlataforma && (pathname === '/' || pathname.startsWith('/produto/') || pathname.startsWith('/combo/'))) {
    try {
      const r = await fetch(new URL(`/api/loja/dominio/resolver?host=${encodeURIComponent(host)}`, req.url))
      if (r.ok) {
        const { slug } = await r.json()
        // raiz → vitrine da loja; /produto/x e /combo/x → deep link (SSR com Open Graph).
        if (slug) return NextResponse.rewrite(new URL(pathname === '/' ? `/loja/${slug}` : `/loja/${slug}${pathname}`, req.url))
      }
    } catch { /* resolver indisponível → segue fluxo normal */ }
  }

  // Master (inalterado): master_token cookie, não NextAuth.
  if (pathname.startsWith('/master') && !pathname.startsWith('/master/login')) {
    const token = req.cookies.get('master_token')?.value
    if (!token || token !== process.env.MASTER_SECRET_TOKEN) {
      return NextResponse.redirect(new URL('/master/login', req.url))
    }
    return NextResponse.next()
  }

  // ── MÉTODO MÃE (monetização, 12/10/2026) ───────────────────────────────────
  // No LANÇAMENTO do MAE (MAE_VENDA_ATIVO=on) o SOA Design é DESLIGADO: as telas dele levam ao MAE (quem assinava
  // virou cortesia do MAE). A conta STANDALONE (token.soMae) só enxerga o MAE. Com a flag OFF e sem conta
  // standalone, nada disto muda o comportamento de hoje.
  // ARQUIVO ESTÁTICO (public/: o worker do leitor de PDF em /estudio/pdf.worker.min.mjs, imagens…) nunca é redirecionado
  // — o desvio do lançamento (/estudio/* → /estudio/mae) mandava o worker para uma página e o PDF parava de abrir
  // para todo mundo (17/10/2026, caso Lorena/Naty)
  if (foraDoMae(pathname) && !/\.[a-z0-9]{2,5}$/i.test(pathname)) {
    if (vendaMaeAberta() && (pathname === '/soa-edition' || pathname.startsWith('/soa-edition/') || pathname === '/estudio' || pathname.startsWith('/estudio/'))) {
      return NextResponse.redirect(new URL(pathname.startsWith('/soa-edition') ? '/mae/assinatura' : '/estudio/mae', req.url))
    }
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if ((token as { soMae?: boolean } | null)?.soMae) {
      return NextResponse.redirect(new URL(pathname === '/assinatura' || pathname.startsWith('/assinatura/') ? '/mae/assinatura' : '/estudio/mae', req.url))
    }
  }

  // ── ONBOARDING OBRIGATÓRIO ──────────────────────────────────────────────────
  // Enquanto o perfil não estiver completo (novo assinante, sem setores), TODA rota
  // da artesã redireciona para /setup — o assistente reabre no reload (estado no JWT,
  // não só no cliente). Só depois de trocar a senha (primeiroLogin=false). O backfill
  // já marcou profileCompleto=true em quem já tinha setores, então antigas não caem aqui.
  if (ehArtesa(pathname) && pathname !== '/setup' && !pathname.startsWith('/setup/')) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (token && (token as any).role !== 'parceira' && (token as any).workspaceId
        && !(token as any).primeiroLogin && !(token as any).profileCompleto) {
      return NextResponse.redirect(new URL('/setup', req.url))
    }
  }

  // Roteamento por PAPEL — só quando a frente de parceiras está ligada. Com a flag
  // OFF, nada disto roda: getToken nem é chamado, e o funil das artesãs é idêntico.
  if (String(process.env.PARCEIRAS_ATIVO || '').toLowerCase() === 'on') {
    const ehParceiraRoute = pathname === '/parceira' || pathname.startsWith('/parceira/')
    // /parceira/candidatar é PÚBLICO (auto-cadastro sem sessão).
    const ehCandidatar = pathname === '/parceira/candidatar' || pathname.startsWith('/parceira/candidatar/')
    const guardarParceira = ehParceiraRoute && !ehCandidatar

    if (guardarParceira || ehArtesa(pathname)) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
      const role = (token as any)?.role

      // /parceira/*: acessível por PARCEIRA PURA (role='parceira') OU por ARTESÃ
      // logada (dual-identidade — pode ter Parceiro vinculado pelo userId). Só
      // exige estar autenticada; a própria página resolve o vínculo e, se a artesã
      // não for parceira, manda para /seja-parceira. Sem sessão → login.
      if (guardarParceira && !token) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      // Parceira PURA numa rota de artesã → volta para o painel dela (nunca crash).
      // Artesã (com workspaceId) NUNCA é expulsa de /modulos: ela é artesã.
      if (ehArtesa(pathname) && role === 'parceira') {
        return NextResponse.redirect(new URL('/parceira', req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/', // domínio próprio da loja: rewrite por Host na raiz
    '/produto/:path*', // domínio próprio: deep link de produto
    '/combo/:path*', // domínio próprio: deep link de combo
    '/master/:path*',
    '/parceira/:path*',
    '/dashboard/:path*', '/clientes/:path*', '/config/:path*', '/demandas/:path*',
    '/financeiro/:path*', '/gestao/:path*', '/minha-loja/:path*', '/pesquisa-preco/:path*',
    '/precificacao/:path*', '/suporte/:path*', '/tarefas/:path*', '/modulos/:path*', '/setup/:path*',
    // Método Mãe: SOA Design desligado no lançamento + conta standalone (só o MAE)
    '/producao/:path*', '/compras/:path*', '/marketplace/:path*', '/integracoes/:path*', '/templates-especiais/:path*',
    '/pessoal/:path*', '/soa-edition/:path*', '/assinatura/:path*', '/estudio/:path*',
  ],
}
