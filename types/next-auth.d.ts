import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id:              string
      name:            string
      email:           string
      role:            string
      workspaceId:     string
      workspaceNome:   string
      workspaceAtivo:  boolean
      primeiroLogin:   boolean
    }
  }

  interface User {
    id:              string
    name:            string
    email:           string
    role:            string
    workspaceId:     string
    workspaceNome:   string
    workspaceAtivo:  boolean
    primeiroLogin:   boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:              string
    role:            string
    workspaceId:     string
    workspaceNome:   string
    workspaceAtivo:  boolean
    primeiroLogin:   boolean
  }
}
