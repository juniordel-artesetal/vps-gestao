'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, ChevronRight } from 'lucide-react'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📋 REGISTRO DE NOVIDADES — atualizar a cada entrega
// Adicionar SEMPRE no início da lista (mais recente primeiro)
// Incrementar "id" a cada nova novidade
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NOVIDADES: Novidade[] = [
  {
    id: 'nov-015',
    versao: '1.6.2',
    data: '07/05/2026',
    titulo: '🙏 Obrigada, Michelle do Ateliê Miih Artes!',
    descricao: 'As melhorias desta semana — preço promocional nos pedidos/orçamentos e formas de pagamento na Venda Direta — nasceram dos chamados da Michelle Rosa do Ateliê Miih Artes. Sua participação faz o VPS crescer para todos os ateliês. Obrigada de coração! 🧡',
    passos: [],
    tipo: 'alerta',
  },
  {
    id: 'nov-014',
    versao: '1.6.2',
    data: '07/05/2026',
    titulo: 'Pagamento na Venda Direta vai pro financeiro 💰',
    descricao: 'Ao criar um pedido de Venda Direta, o sistema pergunta a forma de pagamento — entrada, cartão (com taxa), parcelado ou na entrega — e já lança direto no financeiro.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-013',
    versao: '1.6.2',
    data: '07/05/2026',
    titulo: 'Preço promocional nos pedidos e orçamentos 🏷️',
    descricao: 'Ao selecionar um produto em promoção, o sistema pergunta se você quer usar o preço padrão ou o promocional — tanto na criação de pedidos quanto em orçamentos.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-012',
    versao: '1.6.2',
    data: '07/05/2026',
    titulo: 'Mover pedido de setor direto na lista 🔀',
    descricao: 'Agora é possível mover um pedido para outro setor de produção mesmo sem ter clicado em Iniciar primeiro. O fluxo ficou mais flexível.',
    passos: [],
    tipo: 'correcao',
  },
  {
    id: 'nov-011',
    versao: '1.6.1',
    data: '05/05/2026',
    titulo: 'Lista de pedidos responsiva no celular 📱',
    descricao: 'A tela de pedidos agora funciona corretamente no celular — sem texto vertical, com scroll horizontal, endereço e observações exibidos com "Ler mais" para textos longos.',
    passos: [],
    tipo: 'correcao',
  },
  {
    id: 'nov-010',
    versao: '1.6.1',
    data: '05/05/2026',
    titulo: 'Observações com "Ler mais" na lista 💬',
    descricao: 'As observações dos pedidos agora aparecem resumidas em 3 linhas na lista. Clique em "Ler mais →" para abrir o texto completo em um pop-up — sem sair da tela.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-009',
    versao: '1.6.1',
    data: '05/05/2026',
    titulo: 'Endereço de entrega visível na lista e nos setores 📍',
    descricao: 'O endereço de entrega agora aparece diretamente na lista de pedidos e nos cards de cada setor. Endereços longos mostram "Ler mais →" para abrir o endereço completo.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-008',
    versao: '1.6.1',
    data: '05/05/2026',
    titulo: 'Oráculo Contábil sem limite de valor 💰',
    descricao: 'O campo "Receita do mês" no Oráculo Contábil agora aceita valores acima de R$100.000 — sem nenhuma trava. Simule o quanto precisar!',
    passos: [],
    tipo: 'correcao',
  },
  {
    id: 'nov-007',
    versao: '1.6.1',
    data: '05/05/2026',
    titulo: 'Políticas nos Orçamentos 📋',
    descricao: 'Agora você cadastra suas informações de pagamento e políticas uma única vez — e elas aparecem automaticamente em todos os orçamentos enviados às clientes.',
    passos: [
      'Acesse Configurações → Configurações Gerais',
      'Role até a seção "Configurações de Orçamentos"',
      'Preencha o campo "Políticas da Empresa e Dados Importantes"',
      'Clique em Salvar — pronto! 🎉',
    ],
    tipo: 'melhoria',
  },
  {
    id: 'nov-006',
    versao: '1.6.0',
    data: '30/04/2026',
    titulo: 'Importação de pedidos Shopee 🛍️',
    descricao: 'Importe pedidos da Shopee em segundos! O sistema agrupa automaticamente os itens do mesmo pedido e permite ajustar quantidades manualmente antes de confirmar.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-005',
    versao: '1.6.0',
    data: '30/04/2026',
    titulo: 'Ordenação avançada de pedidos 🔃',
    descricao: 'Botão Ordenar na lista de pedidos com 10 opções: data de entrada, data de envio, prioridade, valor, cliente e mais.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-004',
    versao: '1.6.0',
    data: '30/04/2026',
    titulo: 'Status em massa nos pedidos ✅',
    descricao: 'Selecione vários pedidos de uma vez e altere o status de todos juntos — economia de tempo na operação do ateliê.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-003',
    versao: '1.5.0',
    data: '21/04/2026',
    titulo: 'Gestão de usuários e permissões 👥',
    descricao: 'Controle o que cada colaboradora pode ver e fazer no sistema com os perfis Admin, Delegador e Operador.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-002',
    versao: '1.5.0',
    data: '21/04/2026',
    titulo: 'Módulo de Fornecedores 🏭',
    descricao: 'Cadastre e gerencie seus fornecedores de materiais diretamente no sistema, com contato e histórico centralizado.',
    passos: [],
    tipo: 'melhoria',
  },
  {
    id: 'nov-001',
    versao: '1.4.0',
    data: '08/04/2026',
    titulo: 'Lançamento financeiro automático 💰',
    descricao: 'Ao expedir um pedido de Venda Direta, o sistema cria automaticamente o lançamento de receita no financeiro — sem precisar lançar manualmente.',
    passos: [],
    tipo: 'melhoria',
  },
]

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type TipoNovidade = 'melhoria' | 'correcao' | 'alerta'

interface Novidade {
  id: string
  versao: string
  data: string
  titulo: string
  descricao: string
  passos: string[]
  tipo: TipoNovidade
}

const STORAGE_KEY = 'vps_novidade_vista'

const BADGE: Record<TipoNovidade, { label: string; classes: string }> = {
  melhoria: { label: '✨ Novidade',  classes: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  correcao: { label: '🔧 Correção',  classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  alerta:   { label: '⚠️ Atenção',   classes: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
}

export default function NovidadesPopup() {
  const [novidade, setNovidade] = useState<Novidade | null>(null)
  const [historico, setHistorico] = useState(false)

  useEffect(() => {
    const vista = localStorage.getItem(STORAGE_KEY)
    const mais_recente = NOVIDADES[0]
    if (!mais_recente) return
    if (vista !== mais_recente.id) {
      setNovidade(mais_recente)
    }
  }, [])

  function fechar() {
    if (novidade) localStorage.setItem(STORAGE_KEY, novidade.id)
    setNovidade(null)
    setHistorico(false)
  }

  if (!novidade && !historico) return null

  const exibindo = historico ? null : novidade

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              {historico ? 'Histórico de atualizações' : 'Novidade no sistema'}
            </span>
          </div>
          <button onClick={fechar}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <X size={15} className="text-gray-400" />
          </button>
        </div>

        {/* Conteúdo — novidade atual */}
        {!historico && exibindo && (
          <div className="px-5 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${BADGE[exibindo.tipo].classes}`}>
                {BADGE[exibindo.tipo].label}
              </span>
              <span className="text-xs text-gray-400">v{exibindo.versao} · {exibindo.data}</span>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{exibindo.titulo}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-3">{exibindo.descricao}</p>

            {exibindo.passos.length > 0 && (
              <ol className="flex flex-col gap-1.5 mb-3">
                {exibindo.passos.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                      style={{ backgroundColor: 'var(--cor-primaria, #f97316)' }}>
                      {i + 1}
                    </span>
                    {p}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Conteúdo — histórico */}
        {historico && (
          <div className="px-5 pb-2 max-h-80 overflow-y-auto flex flex-col gap-3">
            {NOVIDADES.map((n, i) => (
              <div key={n.id}
                className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BADGE[n.tipo].classes}`}>
                    {BADGE[n.tipo].label}
                  </span>
                  <span className="text-xs text-gray-400">v{n.versao} · {n.data}</span>
                  {i === 0 && (
                    <span className="text-xs font-semibold text-orange-500 ml-auto">mais recente</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">{n.titulo}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{n.descricao}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 mt-2">
          <button
            onClick={() => setHistorico(h => !h)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
            {historico ? '← Voltar' : 'Ver histórico'}
            {!historico && <ChevronRight size={12} />}
          </button>
          {!historico && (
            <button onClick={fechar}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cor-primaria, #f97316)' }}>
              Entendi, obrigada! 🧡
            </button>
          )}
          {historico && (
            <button onClick={fechar}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition"
              style={{ backgroundColor: 'var(--cor-primaria, #f97316)' }}>
              Fechar
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
