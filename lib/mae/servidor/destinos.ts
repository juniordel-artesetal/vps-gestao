// Método MAE — DESTINO DO STATUS (Lote 7, item 120). "Gerar não é imprimir":
//  • pedido do SOA → etapa de Impressão da produção (lib/producao/etapaImpressao.ts, item 119);
//  • pedido do MAE avulso (mae_orders, id "mo_…") → status interno do MAE: gerado / impresso.
// Os ids podem vir misturados; cada um vai para o seu destino.
import { iniciarImpressao as iniciarSoa, marcarImpresso as marcarSoa, type Resumo } from '@/lib/producao/etapaImpressao'
import { statusMaeEmMassa } from './fontes'
import { ehPedidoMae } from './plano'

export type AcaoStatus = 'gerado' | 'iniciar_impressao' | 'impresso'

const somar = (a: Resumo, b: Resumo): Resumo => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k as keyof Resumo] = (o[k as keyof Resumo] ?? 0) + (v ?? 0); return o }

export async function aplicarStatus(ws: string, ids: string[], acao: AcaoStatus, usuario: string): Promise<Resumo> {
  const mae = ids.filter(ehPedidoMae), soa = ids.filter(id => !ehPedidoMae(id))
  let out: Resumo = {}
  if (mae.length) {
    // "iniciar impressão" no avulso = só "gerado" (a impressão é marcada depois, no botão)
    const n = await statusMaeEmMassa(ws, mae, acao === 'impresso' ? 'impresso' : 'gerado')
    out = somar(out, { [acao === 'impresso' ? 'impresso' : 'movido']: n })
  }
  if (soa.length && acao !== 'gerado') out = somar(out, acao === 'impresso' ? await marcarSoa(ws, soa, usuario) : await iniciarSoa(ws, soa, usuario))
  return out
}
