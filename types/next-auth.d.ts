import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: string
      workspaceId: string
      workspaceNome: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    workspaceId: string
    workspaceNome: string
  }
}