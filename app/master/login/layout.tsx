// Este layout sobrescreve o master/layout.tsx para a rota /master/login
// Sem verificação de token — evita o loop infinito de redirecionamentos
export default function MasterLoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
