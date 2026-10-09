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
 * Lote 4 (item 44): pedaço de nome de arquivo que MANTÉM o acento ("Ana Júlia" → "AnaJúlia"): tira espaço e o
 * que o Windows não aceita. A pasta já é a do dia e a do produto, então a data saiu do nome.
 */
export function parteArquivo(s: string, max = 40): string {
  return String(s ?? '').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '').replace(/\s+/g, '').replace(/[._]+/g, '-').slice(0, max).replace(/[-. ]+$/, '')
}

/**
 * Nome dos TEMAS PRONTOS (Lote 2, item 26; Lote 4, item 44) — `{Nome}_{Idade}anos_{Tema}`; por caixa
 * `{Nome}_{Idade}anos_{Tema}_{CAIXA}`. Ex.: `AnaJúlia_5anos_Sereia.pdf`. Se já existir, entra o pedido (`…_ped123`).
 */
export function nomeTemaPronto(p: { nome?: string; idade?: string; tema?: string; caixa?: string; data: Date; extensao: string; pedido?: string; existentes?: Set<string>; sufixo?: string }): string {
  const idade = (p.idade ?? '').trim()
  // Lote 5 (itens 60/72): `sufixo` = produto + quantidade (`Kit12`, `SacolaP40`) — a equipe sabe quantas imprimir
  const partes = [p.nome ?? '', idade ? `${parteArquivo(idade, 10)}anos` : '', p.tema ?? '', p.caixa ?? '', p.sufixo ?? ''].map(x => parteArquivo(x)).filter(Boolean)
  const ext = p.extensao.replace(/^\./, '')
  const n = `${(partes.length ? partes : ['arte']).join('_')}.${ext}`
  if (!p.existentes?.has(n) || !p.pedido) return n
  return `${[...partes, `ped${slugArquivo(p.pedido, 20)}`].join('_')}.${ext}`
}

export const pastaExportacao = (d: Date) => `Exportações/${dataIso(d)}`

/**
 * Lote 5 (item 79): quantas de cada CAIXA, vindo da quantidade do kit: kit 12 com 6 caixas = 2 de cada; kit 10
 * com 6 = 2,2,2,2,1,1 (o mais igual possível; `exato` = false marca ⚠️ para conferir).
 */
export function quantidadesPadrao(total: number, caixas: string[]): { porCaixa: Record<string, number>; exato: boolean } {
  const n = caixas.length
  const t = Math.max(0, Math.round(total || 0))
  if (!n) return { porCaixa: {}, exato: true }
  if (t <= 0) return { porCaixa: Object.fromEntries(caixas.map(c => [c, 1])), exato: true }
  const base = Math.floor(t / n), resto = t % n
  return { porCaixa: Object.fromEntries(caixas.map((c, i) => [c, base + (i < resto ? 1 : 0)])), exato: resto === 0 }
}

/** Sufixo do arquivo com o produto e a quantidade: "Kit Festa" + 12 → `KitFesta12`; "Sacola P" + 40 → `SacolaP40`. */
export const sufixoQuantidade = (produto: string, qtd: number) => `${parteArquivo(produto, 24)}${qtd > 0 ? qtd : ''}`

/** Evita sobrescrever: `nome.pdf`, `nome (2).pdf`, `nome (3).pdf`… */
export function nomeLivre(nome: string, existentes: Set<string>): string {
  if (!existentes.has(nome)) return nome
  const i = nome.lastIndexOf('.'), base = i > 0 ? nome.slice(0, i) : nome, ext = i > 0 ? nome.slice(i) : ''
  for (let k = 2; ; k++) { const n = `${base} (${k})${ext}`; if (!existentes.has(n)) return n }
}
