// LANÇAMENTO: o add-on Pessoal saiu do beta e está VISÍVEL para todas as ADMINs.
// Esta função controla SÓ a exibição do card (hub) e do item (sidebar); os callers já
// exigem role==='ADMIN', e a rota /pessoal + o gate de assinatura seguem independentes.
// Para re-restringir a testadores no futuro, basta voltar a checar uma allowlist aqui.

/** true = este usuário pode VER o Pessoal no hub/sidebar. Aberto a todas as ADMINs (pós-beta). */
export function pessoalBetaVisivel(_email?: string | null, _userId?: string | null): boolean {
  return true
}
