'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ArrowRight, ExternalLink } from 'lucide-react'
import { useState } from 'react'

const PASSOS = [
  {
    id: 1,
    titulo: 'Configurar setores de produção',
    desc: 'Defina as etapas do seu processo produtivo — do pedido à expedição.',
    acao: 'Configurar agora',
    href: '/config/producao',
    dica: 'Você pode renomear, reordenar e adicionar quantos setores quiser.',
  },
  {
    id: 2,
    titulo: 'Cadastrar materiais e custos',
    desc: 'Adicione suas matérias-primas com preço e quantidade por pacote.',
    acao: 'Cadastrar materiais',
    href: '/precificacao/materiais',
    dica: 'O sistema calcula o custo unitário automaticamente com base no pacote.',
  },
  {
    id: 3,
    titulo: 'Criar seus produtos',
    desc: 'Cadastre seus produtos e variações por canal de venda.',
    acao: 'Criar produtos',
    href: '/precificacao/produtos',
    dica: 'Para cada canal (Shopee, ML, etc.) você pode ter um preço diferente calculado automaticamente.',
  },
  {
    id: 4,
    titulo: 'Configurar regime tributário',
    desc: 'Informe seu regime (MEI, Simples...) para cálculos de preço corretos.',
    acao: 'Configurar tributos',
    href: '/precificacao/config-tributos',
    dica: 'Sem isso os impostos não são incluídos no cálculo de preço.',
  },
  {
    id: 5,
    titulo: 'Criar categorias financeiras',
    desc: 'Organize suas receitas e despesas por categoria.',
    acao: 'Criar categorias',
    href: '/financeiro/categorias',
    dica: 'Ex: Receitas — Shopee, ML, Diretas. Despesas — Materiais, Embalagens, Frete.',
  },
  {
    id: 6,
    titulo: 'Definir metas do mês',
    desc: 'Configure quanto quer faturar e gastar neste mês.',
    acao: 'Definir metas',
    href: '/financeiro/metas',
    dica: 'O dashboard mostra seu progresso em tempo real.',
  },
  {
    id: 7,
    titulo: 'Criar o primeiro pedido',
    desc: 'Registre seu primeiro pedido e acompanhe ele pela produção.',
    acao: 'Criar pedido',
    href: '/dashboard/pedidos',
    dica: 'O pedido entra automaticamente no primeiro setor da sua linha de produção.',
  },
  {
    id: 8,
    titulo: 'Convidar sua equipe',
    desc: 'Adicione colaboradoras com os perfis certos de acesso.',
    acao: 'Gerenciar usuários',
    href: '/config/usuarios',
    dica: 'Operadoras só veem a produção. Supervisoras gerenciam tarefas. Admins têm acesso total.',
  },
]

export default function PrimeirosPassosPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [concluidos, setConcluidos] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('primeiros-passos') || '[]')
    } catch { return [] }
  })

  function togglePasso(id: number) {
    setConcluidos(prev => {
      const novo = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
      try { localStorage.setItem('primeiros-passos', JSON.stringify(novo)) } catch {}
      return novo
    })
  }

  const progresso = Math.round((concluidos.length / PASSOS.length) * 100)

  return (
    <div className="max-w-3xl mx-auto p-6">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Primeiros passos 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Olá, {session?.user?.name?.split(' ')[0]}! Siga o guia abaixo para configurar tudo certinho.
        </p>
      </div>

      {/* Barra de progresso */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Seu progresso</span>
          <span className="text-sm font-bold text-orange-500">{concluidos.length}/{PASSOS.length} concluídos</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
        {progresso === 100 && (
          <p className="text-xs text-green-600 font-medium mt-2">🎉 Parabéns! Seu ateliê está configurado!</p>
        )}
      </div>

      {/* Passos */}
      <div className="flex flex-col gap-3">
        {PASSOS.map(passo => {
          const feito = concluidos.includes(passo.id)
          return (
            <div
              key={passo.id}
              className={`bg-white rounded-xl border transition ${
                feito ? 'border-green-200 opacity-70' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start gap-4 p-4">
                {/* Checkbox */}
                <button
                  onClick={() => togglePasso(passo.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                    feito
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 hover:border-orange-400'
                  }`}
                >
                  {feito && <CheckCircle size={14} className="text-white" />}
                </button>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-medium ${feito ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {passo.titulo}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{passo.desc}</p>
                    </div>
                    <button
                      onClick={() => router.push(passo.href)}
                      className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-medium flex-shrink-0 whitespace-nowrap transition"
                    >
                      {passo.acao}
                      <ArrowRight size={12} />
                    </button>
                  </div>

                  {/* Dica */}
                  {!feito && (
                    <div className="mt-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5">
                      <p className="text-xs text-orange-700">💡 {passo.dica}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Links úteis */}
      <div className="mt-8 bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Links úteis</h2>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Central de Suporte com IA', href: '/suporte' },
            { label: 'Calculadora de preços', href: '/precificacao/calcular' },
            { label: 'Dashboard geral', href: '/dashboard' },
            { label: 'Análise de gestão com IA', href: '/gestao' },
          ].map(link => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 text-sm text-orange-500 hover:text-orange-600 transition"
            >
              <ExternalLink size={12} />
              {link.label}
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
