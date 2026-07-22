// Renderizador dos e-mails da régua. Módulo PURO (zero imports).
//
// Sintaxe mínima, de propósito — quem escreve a copy não é quem programa:
//   {{variavel}}              troca pelo valor
//   {{#condicao}}…{{/condicao}}   mostra SE verdadeiro
//   {{^condicao}}…{{/condicao}}   mostra SE falso
//
// Escapa HTML por padrão: a copy vem de fora do código e não pode injetar markup
// por acidente (um "&" num nome de ateliê já quebraria o e-mail).

export type Variaveis = Record<string, string | number | boolean | null | undefined>

function escapar(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Aplica as variáveis ao texto. Condicionais primeiro: uma seção descartada não
 * deve nem tentar resolver as variáveis de dentro dela.
 *
 * Variável ausente vira string vazia, nunca "undefined" na cara da artesã.
 */
export function renderizar(texto: string, vars: Variaveis): string {
  let s = texto

  // {{#cond}}…{{/cond}} — mantém o miolo se verdadeiro
  s = s.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, chave, miolo) =>
    vars[chave] ? miolo : '')

  // {{^cond}}…{{/cond}} — mantém o miolo se FALSO
  s = s.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_m, chave, miolo) =>
    vars[chave] ? '' : miolo)

  // {{variavel}}
  s = s.replace(/\{\{(\w+)\}\}/g, (_m, chave) => escapar(vars[chave]))

  return s
}

/** Sobrou alguma marcação? Serve de guarda nas provas: copy com variável que o
 *  código não alimenta vira buraco no e-mail da artesã. */
export function marcacoesPendentes(texto: string): string[] {
  return [...texto.matchAll(/\{\{[#^/]?(\w+)\}\}/g)].map(m => m[0])
}

/** Texto simples → HTML de e-mail. Parágrafos por linha em branco. */
export function paraHtml(texto: string): string {
  const corpo = texto.trim().split(/\n\s*\n/).map(p => {
    const linha = p.trim().replace(/\n/g, '<br>')
    return `<p style="margin:0 0 16px;line-height:1.6">${linha}</p>`
  }).join('')
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2937;max-width:520px;margin:0 auto;padding:24px">${corpo}</div>`
}
