// Allowlist de VISIBILIDADE do add-on Pessoal em BETA. Controla SÓ a exibição do
// card (hub) e do item (sidebar). A rota /pessoal e o gate de assinatura NÃO dependem
// disto — seguem por role/assinatura. Quando abrir pra geral, é só esvaziar a checagem
// (ou trocar por uma flag). Ampliar aqui pra incluir mais testadores.
const BETA_EMAILS = new Set([
  'falecomnatycosta@gmail.com',
  'juniordel@gmail.com',
])

/** true = este e-mail pode VER o Pessoal no hub/sidebar (beta). */
export function pessoalBetaVisivel(email: string | null | undefined): boolean {
  return !!email && BETA_EMAILS.has(email.trim().toLowerCase())
}
