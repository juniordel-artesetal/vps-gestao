// SOA Design — LOTE DE KITS: importar os temas (subpasta = tema, ou pasta única "sereia_milk.png") → FILE MATCHER
// (arquivo → slot do kit, determinístico: nome + apelidos + faca + estrutura + histórico + proporção, com confiança) →
// KIT GROUPER (tema → KitInstancia). Só o que não casou com segurança vira EXCEÇÃO (arquivo sem slot/empate; tema
// faltando slot obrigatório ou com slot repetido) — 292 de 300 ok = conferir só os 8.
import { casarProduto, palavrasDoProduto, type ProdutoMatch } from './matcher'
import { normalizar, temaDoArquivo } from './vinculo'
import type { KitTemplate } from './kitMotor'
import type { BoxTemplate } from './caixaViva'

export interface ArquivoKit { id: string; nome: string; caminho: string; pasta: string; w: number; h: number }
export interface TemaKit { chave: string; tema: string; slots: Record<string, string>; faltando: string[]; repetidos: { slotId: string; arquivos: string[] }[] }
export interface ExcecaoArquivo { arquivoId: string; motivo: string; empate?: string[]; confianca: number }
export interface ResultadoKits { temas: TemaKit[]; excecoes: ExcecaoArquivo[]; casados: number }

export function produtosDoKit(kit: KitTemplate, tpls: Map<string, BoxTemplate>): ProdutoMatch[] {
  return kit.slots.map(s => { const t = tpls.get(s.boxTemplateId); return { id: s.id, nome: s.name, apelidos: [...s.aliases, ...(t ? [t.nome, t.modelo || ''] : [])].filter(Boolean) } })
}

/**
 * Agrupa os arquivos em temas. `escolhas` = correção manual (arquivo → slot | 'ignorar'); `temaManual` = tema forçado.
 * Estruturas aceitas: KITS/Sereia/milk.png (subpasta = tema) · sereia_milk.png (pasta única) · milk/sereia.png.
 */
export function agruparKits(arqs: ArquivoKit[], kit: KitTemplate, tpls: Map<string, BoxTemplate>, opc: { escolhas?: Record<string, string>; temaManual?: Record<string, string>; historico?: Record<string, string> } = {}): ResultadoKits {
  const produtos = produtosDoKit(kit, tpls)
  const palavras = produtos.map(palavrasDoProduto).join(' ')
  const ehSlot = (texto: string) => { const r = casarProduto(texto, produtos, {}); return r.mockupId && r.confianca >= 0.8 && !r.empate ? r.mockupId : null }
  const porTema = new Map<string, TemaKit>()
  const excecoes: ExcecaoArquivo[] = []
  let casados = 0
  // pasta RAIZ comum (a pasta "KITS" que ela arrastou) não é tema — só quando há subpastas dentro dela
  const primeira = (p: string) => p.split('/').filter(Boolean)[0] || ''
  const raiz = arqs.length && arqs.every(a => primeira(a.pasta) && primeira(a.pasta) === primeira(arqs[0].pasta)) && arqs.some(a => a.pasta.split('/').filter(Boolean).length >= 2) ? primeira(arqs[0].pasta) : ''
  for (const a0 of arqs) {
    const a = raiz ? { ...a0, pasta: a0.pasta.split('/').filter(Boolean).slice(1).join('/') } : a0
    const esc = opc.escolhas?.[a.id]
    if (esc === 'ignorar') continue
    const pastaFinal = a.pasta.split('/').filter(Boolean).pop() || ''
    const slotDaPasta = pastaFinal ? ehSlot(pastaFinal) : null
    // slot: escolha manual > nome do arquivo > pasta (estrutura milk/sereia.png)
    let slotId: string | null = esc || null, conf = esc ? 1 : 0, motivo = '', empate: string[] | undefined
    if (!slotId) {
      const r = casarProduto(a.nome, produtos, { historico: opc.historico, proporcaoArte: a.w / Math.max(1, a.h) })
      if (r.mockupId && r.confianca >= 0.7 && !r.empate) { slotId = r.mockupId; conf = r.confianca }
      else if (slotDaPasta && !r.mockupId) { slotId = slotDaPasta; conf = 0.85 }
      else { motivo = r.empate ? 'nome serve para mais de um slot' : 'nenhum slot do kit no nome do arquivo'; empate = r.empate; conf = r.confianca }
    }
    if (!slotId) { excecoes.push({ arquivoId: a.id, motivo, empate, confianca: conf }); continue }
    casados++
    // tema: manual > subpasta (se a pasta não for um slot) > o que sobra do nome
    let tema = opc.temaManual?.[a.id] || ''
    if (!tema && pastaFinal && !slotDaPasta) tema = pastaFinal
    if (!tema) tema = temaDoArquivo(a.nome, new Set(), palavras) || (slotDaPasta ? a.nome : '')
    if (!tema) { excecoes.push({ arquivoId: a.id, motivo: 'não achei o tema no nome/pasta', confianca: conf }); casados--; continue }
    const chave = normalizar(tema)
    const t = porTema.get(chave) || { chave, tema: tema.replace(/[_-]+/g, ' ').trim(), slots: {}, faltando: [], repetidos: [] }
    if (t.slots[slotId]) {
      const r = t.repetidos.find(x => x.slotId === slotId)
      if (r) r.arquivos.push(a.id); else t.repetidos.push({ slotId, arquivos: [t.slots[slotId], a.id] })
    } else t.slots[slotId] = a.id
    porTema.set(chave, t)
  }
  for (const t of porTema.values()) t.faltando = kit.slots.filter(s => s.required && !t.slots[s.id]).map(s => s.id)
  const temas = [...porTema.values()].sort((a, b) => (b.faltando.length + b.repetidos.length ? 1 : 0) - (a.faltando.length + a.repetidos.length ? 1 : 0) || a.tema.localeCompare(b.tema))
  return { temas, excecoes, casados }
}
