// Fonte ÚNICA de verdade sobre "esta workspace tem acesso?".
//
// Todo mundo que precisa decidir acesso — revalidação da sessão, layout, job
// diário, telas — pergunta aqui. Duas implementações da mesma regra divergem
// com o tempo, e divergência aqui significa cortar quem pagou ou liberar quem não.
//
// A regra é CALCULADA a partir dos campos guardados, não lida de um campo pronto:
// se o job diário atrasar, o acesso ainda fica correto. O job só cuida dos EFEITOS
// (e-mails, gravar o status novo), nunca é a autoridade sobre o acesso.
import { prisma } from '@/lib/prisma'

export const DIAS_TRIAL = 14
/** Carência após o vencimento (ou após o fim do trial) antes do corte. */
export const DIAS_CARENCIA = 7
export const VALOR_MENSAL = 29.90

export type StatusAssinatura =
  | 'TRIAL'          // nunca pagou, dentro dos 14 dias
  | 'ATIVA'          // em dia
  | 'INADIMPLENTE'   // venceu, dentro da carência
  | 'CORTADA'        // carência esgotada
  | 'CANCELADA'      // cancelamento explícito

export type OrigemAssinatura = 'hotmart' | 'asaas' | null

export interface EstadoAssinatura {
  workspaceId: string
  status: StatusAssinatura
  origem: OrigemAssinatura
  temAcesso: boolean
  /** Por que tem (ou não tem) acesso — para log, tela e depuração. */
  motivo: string
  /** Dias até o corte. Negativo = já passou. null quando não se aplica. */
  diasRestantes: number | null
  liberacaoManual: boolean
}

interface LinhaWorkspace {
  id: string
  ativo: boolean
  assinaturaStatus: string | null
  assinaturaOrigem: string | null
  assinaturaExpira: Date | null
  trialAte: Date | null
  liberacaoManual: boolean
}

const COLS = `"id","ativo","assinaturaStatus","assinaturaOrigem","assinaturaExpira","trialAte","liberacaoManual"`

/** Dias inteiros de hoje até `data` (positivo = futuro). */
function diasAte(data: Date | null): number | null {
  if (!data) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(data)
  alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

/** Decide o acesso a partir da linha do Workspace. Pura — testável sem banco. */
export function avaliar(w: LinhaWorkspace): EstadoAssinatura {
  const origem = (w.assinaturaOrigem as OrigemAssinatura) ?? null
  const status = (w.assinaturaStatus as StatusAssinatura) || 'TRIAL'
  const base = { workspaceId: w.id, status, origem, liberacaoManual: !!w.liberacaoManual }

  // 1) Trava anti-corte do Master vence TUDO. Mesma regra do webhook Hotmart.
  if (w.liberacaoManual) {
    return { ...base, temAcesso: true, motivo: 'Liberação manual do Master', diasRestantes: null }
  }

  // 2) Workspace desligada no banco (corte da Hotmart, suspensão do Master).
  if (!w.ativo) {
    return { ...base, temAcesso: false, motivo: 'Workspace inativa', diasRestantes: null }
  }

  // 3) SÓ 'asaas' entra na máquina de estados nova. Hotmart, contas antigas e
  //    qualquer coisa com origem NULL seguem exatamente o que sempre seguiram:
  //    o campo "ativo", governado pelo webhook da Hotmart e pelo Master.
  //
  //    A inversão é deliberada. As colunas hotmart* do Workspace estão MORTAS
  //    (nenhum código as preenche — o webhook nunca as escreveu), então não existe
  //    como identificar uma conta Hotmart olhando a tabela. Fazer o padrão ser
  //    "segue o comportamento atual" e exigir marcação explícita para o caminho
  //    novo é a única forma de garantir que ninguém mude de regime sem querer.
  if (origem !== 'asaas') {
    return { ...base, temAcesso: true, motivo: 'Acesso pelo caminho atual (Hotmart/Master)', diasRestantes: null }
  }

  // 4) Caminho ASAAS.
  switch (status) {
    case 'CANCELADA':
      return { ...base, temAcesso: false, motivo: 'Assinatura cancelada', diasRestantes: null }

    case 'CORTADA':
      return { ...base, temAcesso: false, motivo: 'Assinatura suspensa por falta de pagamento', diasRestantes: null }

    case 'ATIVA':
      return { ...base, temAcesso: true, motivo: 'Assinatura em dia', diasRestantes: diasAte(w.assinaturaExpira) }

    case 'INADIMPLENTE': {
      // Carência contada a partir do vencimento. Sem vencimento gravado, não
      // inventamos data: mantém o acesso e deixa o job resolver.
      const dias = w.assinaturaExpira ? (diasAte(w.assinaturaExpira) ?? 0) + DIAS_CARENCIA : null
      if (dias === null) {
        return { ...base, temAcesso: true, motivo: 'Pagamento pendente (sem vencimento registrado)', diasRestantes: null }
      }
      return dias >= 0
        ? { ...base, temAcesso: true, motivo: `Pagamento em atraso — ${dias} dia(s) até a suspensão`, diasRestantes: dias }
        : { ...base, temAcesso: false, motivo: 'Carência esgotada', diasRestantes: dias }
    }

    case 'TRIAL':
    default: {
      // Sem trialAte é conta antiga, anterior a esta máquina de estados: não
      // cortamos ninguém retroativamente por causa de um campo que não existia.
      if (!w.trialAte) {
        return { ...base, status: 'TRIAL', temAcesso: true, motivo: 'Conta sem trial registrado (legado)', diasRestantes: null }
      }
      const dias = (diasAte(w.trialAte) ?? 0) + DIAS_CARENCIA
      return dias >= 0
        ? { ...base, status: 'TRIAL', temAcesso: true, motivo: `Trial — ${dias} dia(s) até a suspensão`, diasRestantes: dias }
        : { ...base, status: 'TRIAL', temAcesso: false, motivo: 'Trial encerrado', diasRestantes: dias }
    }
  }
}

/** Estado de uma workspace. Retorna null se ela não existe. */
export async function estadoDaAssinatura(workspaceId: string): Promise<EstadoAssinatura | null> {
  const [row] = await prisma.$queryRawUnsafe(
    `SELECT ${COLS} FROM "Workspace" WHERE "id" = $1 LIMIT 1`, workspaceId,
  ) as LinhaWorkspace[]
  return row ? avaliar(row) : null
}

/**
 * Só o acesso, para o caminho quente (revalidação da sessão a cada 15 min).
 *
 * FAIL OPEN: qualquer erro (banco fora, coluna ausente, workspace sumida) devolve
 * `true`. Um bug aqui NÃO pode trancar 186 workspaces para fora do próprio sistema
 * — o custo de deixar passar quem devia ser cortado é ordens de grandeza menor.
 */
export async function temAcesso(workspaceId: string): Promise<boolean> {
  try {
    const e = await estadoDaAssinatura(workspaceId)
    return e ? e.temAcesso : true
  } catch (err) {
    console.error('[ASSINATURA] falha ao avaliar acesso (liberando por segurança):', (err as Error)?.message)
    return true
  }
}

/** Revalidação da sessão ligada? Default OFF — ligar é decisão de rollout. */
export function revalidacaoLigada(): boolean {
  return String(process.env.ASSINATURA_REVALIDACAO || '').toLowerCase() === 'on'
}
