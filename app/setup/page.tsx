'use client'
// Assistente de configuração OBRIGATÓRIO do primeiro acesso. Bloqueante: o middleware
// redireciona toda rota para cá enquanto profileCompleto=false. Escolher ≥1 segmento →
// popular fluxo + materiais + produtos (comSetores:true) → marcar concluído → dashboard.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { SEGMENTOS } from '@/lib/segmentos'
import { Check, Loader2, Sparkles, PartyPopper, ArrowRight } from 'lucide-react'

type Etapa = 'boas-vindas' | 'segmento' | 'montando' | 'pronto'

export default function SetupPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const nomeAtelie = session?.user?.workspaceNome || 'seu ateliê'
  const [etapa, setEtapa] = useState<Etapa>('boas-vindas')
  const [sel, setSel] = useState<string[]>([])
  const [resumo, setResumo] = useState<{ setoresCriados: number; produtosCriados: number; materiaisCriados: number } | null>(null)
  const [erro, setErro] = useState('')

  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  async function finalizar() {
    if (sel.length === 0) return
    setErro(''); setEtapa('montando')
    try {
      const r = await fetch('/api/onboarding/finalizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentos: sel }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d?.error || 'Falha ao montar o ateliê')
      setResumo(d?.catalogo || { setoresCriados: 0, produtosCriados: 0, materiaisCriados: 0 })
      // Atualiza o JWT (profileCompleto=true) para o middleware liberar as rotas.
      await update({ profileCompleto: true })
      setEtapa('pronto')
    } catch (e: any) {
      setErro(e?.message || 'Algo deu errado. Tente de novo.')
      setEtapa('segmento')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-neutral-950 dark:to-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-gray-100 dark:border-neutral-800 p-6 md:p-8">

        {etapa === 'boas-vindas' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center"><Sparkles className="w-7 h-7 text-orange-500" /></div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Bem-vinda ao SOA! 🧡</h1>
            <p className="text-gray-600 dark:text-neutral-300">Vamos deixar o <b>{nomeAtelie}</b> pronto em 1 minuto — com os setores, materiais e produtos do seu segmento já criados. Você só ajusta os preços depois.</p>
            <button onClick={() => setEtapa('segmento')} className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600">Começar <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {etapa === 'segmento' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Qual é o seu segmento?</h1>
              <p className="text-sm text-gray-500 dark:text-neutral-400">Escolha <b>um ou mais</b>. A gente monta o ateliê com base neles.</p>
            </div>
            {erro && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{erro}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[52vh] overflow-y-auto pr-1">
              {SEGMENTOS.map(seg => {
                const on = sel.includes(seg.id)
                return (
                  <button key={seg.id} onClick={() => toggle(seg.id)}
                    className={`relative text-left p-3 rounded-xl border transition ${on ? 'border-orange-400 bg-orange-50 dark:bg-orange-500/10 ring-2 ring-orange-300' : 'border-gray-200 dark:border-neutral-700 hover:border-orange-300'}`}>
                    {on && <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                    <div className="text-2xl">{seg.emoji}</div>
                    <div className="text-sm font-medium text-gray-800 dark:text-neutral-100 mt-1">{seg.nome}</div>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-400">{sel.length} selecionado{sel.length !== 1 ? 's' : ''}</span>
              <button onClick={finalizar} disabled={sel.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {etapa === 'montando' && (
          <div className="text-center space-y-4 py-8">
            <Loader2 className="w-10 h-10 mx-auto text-orange-500 animate-spin" />
            <h1 className="text-xl font-bold text-gray-800 dark:text-neutral-100">Montando o seu ateliê…</h1>
            <p className="text-sm text-gray-500 dark:text-neutral-400">Criando seus setores, materiais e produtos. Só um instante 🧡</p>
          </div>
        )}

        {etapa === 'pronto' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center"><PartyPopper className="w-7 h-7 text-emerald-500" /></div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-neutral-100">Pronto! Seu ateliê está montado 🎉</h1>
            {resumo && (
              <p className="text-gray-600 dark:text-neutral-300">
                Criamos <b>{resumo.setoresCriados}</b> setores, <b>{resumo.produtosCriados}</b> produtos e <b>{resumo.materiaisCriados}</b> materiais.
                Agora é só conferir os setores e preencher os preços — a Sofia te guia no painel.
              </p>
            )}
            <button onClick={() => router.push('/dashboard')} className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600">Ir para o painel <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
