import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { temAcesso, revalidacaoLigada } from '@/lib/assinatura'
import { parceirasAtivo } from '@/lib/parceiras/atribuicao'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.senha) return null

        const ip = (req as any)?.headers?.['x-forwarded-for'] ?? 'unknown'

        const users = await prisma.$queryRaw`
          SELECT u.*, w."nome" as "workspaceNome", w."ativo" as "workspaceAtivo"
          FROM "User" u
          JOIN "Workspace" w ON w."id" = u."workspaceId"
          WHERE u."email" = ${credentials.email}
          AND u."ativo" = true
          AND w."ativo" = true
          LIMIT 1
        ` as any[]

        if (!users.length) {
          // ── TRILHA DA PARCEIRA (não é artesã/User). Só quando a frente está ligada.
          // Papel próprio 'parceira', SEM workspaceId — ela não tem ateliê. O caminho
          // acima (User JOIN Workspace) fica 100% intocado.
          if (parceirasAtivo()) {
            const parc = await prisma.$queryRaw`
              SELECT "id","nome","email","senhaCripto","status" FROM "Parceiro"
              WHERE lower("email") = lower(${credentials.email}) LIMIT 1
            ` as { id: string; nome: string; email: string | null; senhaCripto: string | null; status: string }[]
            const p = parc[0]
            if (p) {
              // Existe candidata: mensagem CLARA se ainda não aprovada (não vira
              // "credenciais inválidas" genérico). Throw → o texto chega ao /login.
              if (p.status !== 'aprovada') throw new Error('Sua candidatura de parceira ainda não foi aprovada.')
              if (p.senhaCripto && (await bcrypt.compare(credentials.senha, p.senhaCripto))) {
                return { id: p.id, name: p.nome, email: p.email ?? credentials.email, role: 'parceira', parceiroId: p.id, workspaceId: null } as any
              }
            }
          }
          // Registrar tentativa falha se usuário existe (mas workspace inativo, etc)
          return null
        }

        const user    = users[0]
        const senhaOk = await bcrypt.compare(credentials.senha, user.senha)

        // Registrar histórico de login
        try {
          const logId = Math.random().toString(36).slice(2) + Date.now().toString(36)
          await prisma.$executeRaw`
            INSERT INTO "LoginHistory" ("id","userId","workspaceId","email","ip","sucesso","createdAt")
            VALUES (${logId}, ${user.id}, ${user.workspaceId}, ${user.email}, ${String(ip)}, ${senhaOk}, NOW())
          `
        } catch { /* silencioso — não bloquear login por falha no log */ }

        if (!senhaOk) return null

        // Último acesso (base do "online agora" no painel de parcerias) — aditivo
        try {
          await prisma.$executeRaw`UPDATE "User" SET "ultimoAcesso" = NOW() WHERE "id" = ${user.id}`
        } catch { /* silencioso */ }

        // [Stars removido — feature desativada até 01/06/2026]

        return {
          id:              user.id,
          name:            user.nome,
          email:           user.email,
          role:            user.role,
          workspaceId:     user.workspaceId,
          workspaceNome:   user.workspaceNome,
          workspaceAtivo:  user.workspaceAtivo,
          primeiroLogin:   user.primeiroLogin ?? false,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id             = (user as any).id
        token.role           = (user as any).role
        token.workspaceId    = (user as any).workspaceId
        token.workspaceNome  = (user as any).workspaceNome
        token.workspaceAtivo = (user as any).workspaceAtivo
        token.primeiroLogin  = (user as any).primeiroLogin
        ;(token as any).parceiroId = (user as any).parceiroId ?? null
      }
      // Parceira não é User nem tem assinatura: pula o "último acesso" (id não é
      // User) e a revalidação de corte (não pode ser cortada pela régua). Os dois
      // blocos abaixo já são naturalmente pulados (workspaceId nulo), mas o guard
      // explícito evita qualquer UPDATE/consulta à toa.
      const ehParceira = (token as any).role === 'parceira'
      // Permite atualizar primeiroLogin via session.update()
      if (trigger === 'update' && session?.primeiroLogin !== undefined) {
        token.primeiroLogin = session.primeiroLogin
      }
      // "Último acesso" throttled (base do "online agora"): no máx. 1 escrita a cada
      // 3 min por usuário. Nunca para sessões forjadas (impersonation) — aditivo.
      if (!(token as any).impersonatedBy && token.id && !ehParceira) {
        const agora = Date.now()
        const ult = Number((token as any).lastPing || 0)
        if (agora - ult > 3 * 60 * 1000) {
          ;(token as any).lastPing = agora
          try { await prisma.$executeRaw`UPDATE "User" SET "ultimoAcesso" = NOW() WHERE "id" = ${token.id as string}` } catch { /* silencioso */ }
        }
      }

      // ── Revalidação da assinatura (feature flag ASSINATURA_REVALIDACAO=on) ──
      //
      // Por que aqui: "ativo" só era conferido no authorize(), ou seja, no LOGIN.
      // Como a sessão é JWT de 30 dias (padrão do NextAuth), cortar alguém não a
      // desconectava — ela seguia usando o sistema por até um mês. Revalidar no
      // token é o que faz o corte valer de verdade, para Hotmart e Asaas.
      //
      // Custo: 1 consulta a cada 15 min por usuária ativa (mesmo padrão do lastPing).
      // Com a flag desligada, nada disto executa — nem a leitura do relógio.
      //
      // NÃO desloga: apenas marca. Quem redireciona para a tela de regularização é
      // o layout (Etapa 2), preservando sessão e dados — deslogar seria hostil e
      // mataria a conversão de volta.
      if (revalidacaoLigada() && token.workspaceId && !(token as any).impersonatedBy && !ehParceira) {
        const agora = Date.now()
        const ultima = Number((token as any).ultimaRevalidacao || 0)
        if (agora - ultima > 15 * 60 * 1000) {
          ;(token as any).ultimaRevalidacao = agora
          // temAcesso() é FAIL OPEN: erro nunca bloqueia (ver lib/assinatura).
          const ok = await temAcesso(token.workspaceId as string)
          ;(token as any).acessoBloqueado = !ok
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id             = token.id             as string
        session.user.role           = token.role           as string
        session.user.workspaceId    = token.workspaceId    as string
        session.user.workspaceNome  = token.workspaceNome  as string
        session.user.workspaceAtivo = token.workspaceAtivo as boolean
        session.user.primeiroLogin  = token.primeiroLogin  as boolean
        ;(session.user as any).parceiroId = (token as any).parceiroId ?? null
        // Impersonation (aditivo): quando o Master "acessa como", a sessão é forjada
        // pelo endpoint /api/master/impersonar com este marcador. O login normal
        // NUNCA define isto, então fica undefined para assinantes reais.
        ;(session.user as any).impersonatedBy = (token as any).impersonatedBy ?? undefined
        // Marcado pela revalidação (só com a flag ligada). O layout usa isto para
        // levar à tela de regularização; undefined = sem bloqueio, como sempre foi.
        session.user.acessoBloqueado = (token as any).acessoBloqueado ?? false
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}
