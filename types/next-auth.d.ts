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
      /** Revalidação da assinatura reprovou (flag ASSINATURA_REVALIDACAO=on).
       *  O layout redireciona para a tela de regularização; NÃO desloga. */
      acessoBloqueado?: boolean
      /** Conta STANDALONE do Método Mãe (só o MAE, sem o ERP) — Workspace.moduloMaePlano = 'standalone'. */
      soMae?: boolean
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
    /** Conta standalone do Método Mãe (só o MAE). */
    soMae?:          boolean
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
    /** Resultado da última revalidação e quando ela ocorreu (throttle de 15 min). */
    acessoBloqueado?:    boolean
    ultimaRevalidacao?:  number
    /** Conta standalone do Método Mãe (só o MAE) — middleware e menu. */
    soMae?:              boolean
  }
}
