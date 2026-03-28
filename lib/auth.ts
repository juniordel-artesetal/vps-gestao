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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null

        const users = await prisma.$queryRaw`
          SELECT u.*, w."nome" as "workspaceNome"
          FROM "User" u
          JOIN "Workspace" w ON w."id" = u."workspaceId"
          WHERE u."email" = ${credentials.email}
          AND u."ativo" = true
          LIMIT 1
        ` as any[]

        if (!users.length) return null

        const user = users[0]
        const senhaOk = await bcrypt.compare(credentials.senha, user.senha)
        if (!senhaOk) return null

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId,
          workspaceNome: user.workspaceNome,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.workspaceId = (user as any).workspaceId
        token.workspaceNome = (user as any).workspaceNome
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as string
        session.user.workspaceId = token.workspaceId as string
        session.user.workspaceNome = token.workspaceNome as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}