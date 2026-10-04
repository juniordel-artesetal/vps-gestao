// SOA Edition — Método MAE (local-first). Sprint 1: fundações (prancheta em mm, pasta local, fontes locais).
// O layout de /estudio já exige sessão, ADMIN e o módulo SOA Design. Enquanto as sprints andam, só os
// workspaces da lista MAE_BETA_WORKSPACES (env, separados por vírgula; "*" = todos) veem a tela.
// Sprint 12: liberado = beta OU add-on "Criação de artes MAE" (lib/mae/servidor/addons).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MaeCliente from '@/components/mae/MaeCliente'
import { addonsDaConta } from '@/lib/mae/servidor/addons'

export const metadata = { title: 'Método MAE · SOA' }

/** Guarda + editor. `secao` = a função do menu (base, tema, imagem, pedidos, loja, ajuda). */
export async function TelaMae({ secao }: { secao?: string }) {
  const session = await getServerSession(authOptions)
  const ad = session?.user.workspaceId ? await addonsDaConta(session.user.workspaceId) : null
  if (!ad?.criacao.ativo) {
    const preco = ad?.criacao.preco ?? null
    return (
      <div className="max-w-xl mx-auto p-8 text-center" data-mae-bloqueado>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Método MAE</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Monte a base do seu kit uma vez e cada tema novo se encaixa em todos os moldes — com nome, apliques e arquivo pronto para imprimir.</p>
        <p className="text-sm text-gray-500 mt-3">Add-on <b>Criação de artes MAE</b>{preco ? <> · R$ {preco.toFixed(2).replace('.', ',')}/mês</> : <> · <span className="font-medium text-orange-600">em breve</span></>}</p>
      </div>
    )
  }
  return <MaeCliente secao={secao} />
}

export default async function MetodoMae() {
  return <TelaMae />
}
