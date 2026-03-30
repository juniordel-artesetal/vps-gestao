import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

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
    async jwt({ token, user }) {
      if (user) {
        token.role           = (user as any).role
        token.workspaceId    = (user as any).workspaceId
        token.workspaceNome  = (user as any).workspaceNome
        token.workspaceAtivo = (user as any).workspaceAtivo
        token.primeiroLogin  = (user as any).primeiroLogin
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role           = token.role          as string
        session.user.workspaceId    = token.workspaceId   as string
        session.user.workspaceNome  = token.workspaceNome as string
        session.user.workspaceAtivo = token.workspaceAtivo as boolean
        session.user.primeiroLogin  = token.primeiroLogin  as boolean
      }
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}
