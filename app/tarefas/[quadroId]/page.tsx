import { redirect } from 'next/navigation'

// Redirect das rotas antigas da Fase 1: /tarefas/[quadroId] -> /tarefas/quadros/[quadroId]
export default async function RedirQuadro({ params }: { params: Promise<{ quadroId: string }> }) {
  const { quadroId } = await params
  redirect(`/tarefas/quadros/${quadroId}`)
}
