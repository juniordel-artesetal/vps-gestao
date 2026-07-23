// Guarda de acesso das áreas autenticadas.
//
// Server component: lê a sessão e, se a revalidação tiver reprovado, REDIRECIONA
// para a tela de regularização. NÃO desloga — a artesã continua autenticada, vê o
// próprio nome, os dados estão todos lá e o botão de pagar fica na frente. Deslogar
// seria hostil justamente com quem a gente quer de volta.
//
// `acessoBloqueado` só é preenchido quando ASSINATURA_REVALIDACAO=on. Com a flag
// desligada é sempre false, e este componente não faz absolutamente nada.
//
// ⚠️ NÃO colocar em app/assinatura/* — a tela de regularização precisa ser
//    alcançável por quem está bloqueada, senão vira laço de redirecionamento.
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'

export default async function GuardaAssinatura() {
  const session = await getServerSession(authOptions)
  if (session?.user?.acessoBloqueado) redirect('/assinatura')
  return null
}
