// Allowlist de VISIBILIDADE do add-on Pessoal em BETA. Controla SÓ a exibição do
// card (hub) e do item (sidebar). A rota /pessoal e o gate de assinatura NÃO dependem
// disto — seguem por role/assinatura. Quando abrir pra geral, é só esvaziar a checagem
// (ou trocar por uma flag). Ampliar aqui pra incluir mais testadores.
//
// Casamos por e-mail OU userId: o `session.user.id` é setado explicitamente no callback
// de sessão (garantido), enquanto o `email` depende do default do NextAuth — o userId é a
// rede de segurança pra allowlist nunca falhar fechada pra quem deve ver.
const BETA_EMAILS = new Set([
  'falecomnatycosta@gmail.com',
  'juniordel@gmail.com',
])
const BETA_USER_IDS = new Set([
  'gyatty0d62imnp5cavq',   // falecomnatycosta@gmail.com
  'b05czgcwu9mnoi6zs4',    // juniordel@gmail.com
])

/** true = este usuário pode VER o Pessoal no hub/sidebar (beta). Casa por e-mail OU userId. */
export function pessoalBetaVisivel(email: string | null | undefined, userId?: string | null): boolean {
  const e = (email || '').trim().toLowerCase()
  return (!!e && BETA_EMAILS.has(e)) || (!!userId && BETA_USER_IDS.has(userId))
}
