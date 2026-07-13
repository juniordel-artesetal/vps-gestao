// ─────────────────────────────────────────────────────────────
// Casamento "texto do produto → variação da Precificação" + derivação de peças.
// Regra ÚNICA usada pela importação (servidor) e pelo preview (cliente).
//
// O seletor manual rotula a opção como "Produto — Variação" (ex.:
// "Rótulo Mini Pringles — 10 Unidades"). É contra isso que casamos o texto
// da planilha. Só vincula em correspondência ÚNICA — 0 ou 2+ = não adivinha.
//
// Peças (igual ao caminho manual): isKit && qtdKit>1 → qtdKit × quantidade.
// ─────────────────────────────────────────────────────────────
import { normNome } from '@/lib/normNome'

export interface VariacaoParaMatch {
  id: string
  produtoNome: string
  nome?: string | null
  isKit?: boolean
  qtdKit?: number | null
}

export type MatchResultado =
  | { status: 'match'; variacaoId: string; isKit: boolean; qtdKit: number; label: string }
  | { status: 'nenhum' }
  | { status: 'ambiguo' }

// Canoniza para comparação: minúsculas/sem acento (normNome) + colapsa
// separadores "—", "–", "-", "·", "|" em espaço. Assim o estilo do traço não importa.
export function chaveMatch(s: unknown): string {
  // Colapsa parênteses e separadores (—, –, -, ·, |) em espaço, para casar tanto
  // "Produto — Variação" (rótulo do seletor) quanto "Produto (Variação)" (Shopee).
  return normNome(s).replace(/[()]/g, ' ').replace(/\s*[—–\-·|]\s*/g, ' ').replace(/\s+/g, ' ').trim()
}

export interface IndiceVariacoes {
  resolver: (texto: string | null | undefined) => MatchResultado
}

export function indexarVariacoes(variacoes: VariacaoParaMatch[]): IndiceVariacoes {
  const porChave = new Map<string, Set<string>>()          // chave → variacaoIds
  const info = new Map<string, { isKit: boolean; qtdKit: number; label: string }>()

  const registrar = (chave: string, id: string) => {
    if (!chave) return
    if (!porChave.has(chave)) porChave.set(chave, new Set())
    porChave.get(chave)!.add(id)
  }

  for (const v of variacoes) {
    const label = v.nome ? `${v.produtoNome} — ${v.nome}` : v.produtoNome
    info.set(v.id, { isKit: !!v.isKit, qtdKit: Math.max(Number(v.qtdKit) || 1, 1), label })
    registrar(chaveMatch(label), v.id)                      // "produto — variação"
    registrar(chaveMatch(v.produtoNome), v.id)              // só o produto (ambíguo se >1 variação)
  }

  return {
    resolver(texto) {
      const k = chaveMatch(texto)
      const ids = k ? porChave.get(k) : undefined
      if (!ids || ids.size === 0) return { status: 'nenhum' }
      if (ids.size > 1) return { status: 'ambiguo' }
      const id = ids.values().next().value as string
      const meta = info.get(id)!
      return { status: 'match', variacaoId: id, isKit: meta.isKit, qtdKit: meta.qtdKit, label: meta.label }
    },
  }
}

// Peças a partir de kit — mesma regra do caminho manual.
export function derivarPecas(quantidade: number, isKit: boolean, qtdKit: number): number {
  const q = Number(quantidade) || 1
  return isKit && qtdKit > 1 ? qtdKit * q : q
}

// Extrai a quantidade do PACOTE embutida no nome/variação da planilha da Shopee:
//   "…,42 - 7 cxs" → 42 ; "36 unidades" → 36 ; "20 un" → 20.
// Evita falsos positivos de MEDIDA (",4cm", ",7cm"): o ",N" só conta se NÃO for seguido
// de letra (unidade). Retorna null quando não há quantidade clara.
export function extrairQtdPacote(texto: string | null | undefined): number | null {
  const s = String(texto || '')
  const un = s.match(/(\d{1,5})\s*(unidades?|un\.?|p[çc]s?|pe[çc]as?)/i)
  if (un) { const n = parseInt(un[1]); if (n > 0) return n }
  const virg = s.match(/,\s*(\d{1,5})(?!\s*[a-zç])/i)   // ",42 - …" sim; ",4cm" não
  if (virg) { const n = parseInt(virg[1]); if (n > 0) return n }
  return null
}
