// mae-exportar — NOMES E PASTAS das exportações: `{tema}_{nome}_{molde}_{data}` dentro de
// `Exportações/AAAA-MM-DD/`. Nomes seguros no Windows (sem acento quebrado, sem / \ : * ? " < > |). Puro.

export function slugArquivo(s: string, max = 40): string {
  const t = s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '')
  return t || 'sem-nome'
}

const dois = (n: number) => String(n).padStart(2, '0')
export const dataIso = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

/** `{tema}_{nome}_{molde}_{data}` (+ extensão). Partes vazias saem. */
export function nomeExportacao(p: { tema?: string; nome?: string; molde?: string; data: Date; extensao: string }): string {
  const partes = [p.tema, p.nome, p.molde].filter((x): x is string => !!x && !!x.trim()).map(x => slugArquivo(x))
  return `${[...partes, dataIso(p.data)].join('_')}.${p.extensao.replace(/^\./, '')}`
}

/**
 * Lote 2 (item 26): nome dos TEMAS PRONTOS — `{Nome}_{Idade}anos_{Tema}_{data}`; por caixa
 * `{Nome}_{Idade}anos_{Tema}_{CAIXA}_{data}`. Se já existir, entra o número do pedido (`…_ped123`).
 */
export function nomeTemaPronto(p: { nome?: string; idade?: string; tema?: string; caixa?: string; data: Date; extensao: string; pedido?: string; existentes?: Set<string> }): string {
  const idade = (p.idade ?? '').trim()
  const partes = [p.nome ?? '', idade ? `${slugArquivo(idade, 10)}anos` : '', p.tema ?? '', p.caixa ?? ''].filter(x => x.trim()).map(x => slugArquivo(x))
  const ext = p.extensao.replace(/^\./, '')
  const n = `${[...partes, dataIso(p.data)].join('_')}.${ext}`
  if (!p.existentes?.has(n) || !p.pedido) return n
  return `${[...partes, dataIso(p.data), `ped${slugArquivo(p.pedido, 20)}`].join('_')}.${ext}`
}

export const pastaExportacao = (d: Date) => `Exportações/${dataIso(d)}`

/** Evita sobrescrever: `nome.pdf`, `nome (2).pdf`, `nome (3).pdf`… */
export function nomeLivre(nome: string, existentes: Set<string>): string {
  if (!existentes.has(nome)) return nome
  const i = nome.lastIndexOf('.'), base = i > 0 ? nome.slice(0, i) : nome, ext = i > 0 ? nome.slice(i) : ''
  for (let k = 2; ; k++) { const n = `${base} (${k})${ext}`; if (!existentes.has(n)) return n }
}
