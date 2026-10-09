// Lote 5 (item 72): GRUPOS DE PRODUTO da base de portfólio. A aluna monta uma base com tudo (kit festa, sacolas,
// tags, rótulos…) e cria cada tema uma vez só; cada grupo de moldes é ligado a um produto do SOA, e o tema se
// "separa" por grupo na hora de gerar ("Sereia · Kit Festa", "Sereia · Sacola P") — sem duplicar arquivos, então
// mudar um molde de grupo atualiza todos os temas. Puro: muda o documento recebido (draft do histórico).
import type { DocTema, DocTrabalho, GrupoProduto } from '../schema'

type Doc = DocTrabalho
export type Grupo = GrupoProduto

const gid = () => 'g_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3)
const chave = (s: string | null | undefined) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '')

export const gruposDa = (d: Pick<Doc, 'grupos'>): Grupo[] => d.grupos ?? []

export function criarGrupo(d: Doc, nome: string, moldes: string[] = []): string {
  const id = gid()
  ;(d.grupos ??= []).push({ id, nome: nome.trim().slice(0, 80) || 'Grupo', moldes: [...new Set(moldes)] })
  return id
}

export function renomearGrupo(d: Doc, id: string, nome: string): void {
  const g = gruposDa(d).find(x => x.id === id)
  if (g && nome.trim()) g.nome = nome.trim().slice(0, 80)
}

/** Excluir grupo NÃO apaga moldes: eles ficam "Sem grupo" (ou nos outros grupos em que também estão). */
export function excluirGrupo(d: Doc, id: string): void {
  d.grupos = gruposDa(d).filter(g => g.id !== id)
  if (!d.grupos.length) delete d.grupos
}

export function reordenarGrupo(d: Doc, id: string, dir: -1 | 1): void {
  const l = gruposDa(d)
  const i = l.findIndex(g => g.id === id), j = i + dir
  if (i < 0 || j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j], l[i]]
}

/** Arrastar molde para outro grupo (sai do de origem). `para` null = "Sem grupo". */
export function moverMoldeDeGrupo(d: Doc, moldeId: string, de: string | null, para: string | null): void {
  if (de === para) return
  for (const g of gruposDa(d)) {
    if (g.id === de) g.moldes = g.moldes.filter(m => m !== moldeId)
    if (g.id === para && !g.moldes.includes(moldeId)) g.moldes.push(moldeId)
  }
}

/** "Usar também em…" / Alt + arrastar: o molde entra em mais um grupo (mesmo molde, mesma arte). */
export function usarTambemEm(d: Doc, moldeId: string, grupoId: string): void {
  const g = gruposDa(d).find(x => x.id === grupoId)
  if (g && !g.moldes.includes(moldeId)) g.moldes.push(moldeId)
}

export function tirarDoGrupo(d: Doc, moldeId: string, grupoId: string): void {
  const g = gruposDa(d).find(x => x.id === grupoId)
  if (g) g.moldes = g.moldes.filter(m => m !== moldeId)
}

/** Liga o grupo a um produto (e, opcional, a uma variação) da Precificação. */
export function ligarProduto(d: Doc, grupoId: string, p: { produtoId: string | null; variacaoId?: string | null; produtoNome?: string | null }): void {
  const g = gruposDa(d).find(x => x.id === grupoId)
  if (!g) return
  g.produtoId = p.produtoId; g.variacaoId = p.variacaoId ?? null; g.produtoNome = p.produtoNome ?? null
}

/** Moldes que não estão em grupo nenhum. */
export function moldesSemGrupo(d: Doc): string[] {
  const usados = new Set(gruposDa(d).flatMap(g => g.moldes))
  return d.molds.map(m => m.id).filter(id => !usados.has(id))
}

/** Grupos que o tema usa (todos, menos os desmarcados no tema). */
export function gruposDoTema(d: Pick<Doc, 'grupos'>, tema: Pick<DocTema, 'gruposDesligados'> | null | undefined): Grupo[] {
  const fora = new Set(tema?.gruposDesligados ?? [])
  return gruposDa(d).filter(g => !fora.has(g.id) && g.moldes.length)
}

/** Nome do "tema por produto": "Sereia · Kit Festa". */
export const nomeTemaDoGrupo = (tema: { name?: string }, g: Grupo) => `${tema.name ?? 'Tema'} · ${g.nome}`

export interface ItemDoPedido { variacaoId?: string | null; produtoId?: string | null; nome?: string | null; produto?: string | null }

/**
 * Grupo do item do pedido: 1º a VARIAÇÃO ligada, 2º o PRODUTO ligado (grupo sem variação), 3º o nome do produto
 * (o da Precificação ou o do item) igual ao nome do grupo ou do produto ligado. Sem grupos → null (base inteira).
 */
export function grupoDoItem(d: Pick<Doc, 'grupos'>, it: ItemDoPedido, tema?: Pick<DocTema, 'gruposDesligados'> | null): Grupo | null {
  const gs = gruposDoTema(d, tema)
  if (!gs.length) return null
  if (it.variacaoId) { const g = gs.find(x => x.variacaoId && x.variacaoId === it.variacaoId); if (g) return g }
  if (it.produtoId) { const g = gs.find(x => x.produtoId === it.produtoId && !x.variacaoId) ?? gs.find(x => x.produtoId === it.produtoId); if (g) return g }
  const nomes = [it.produto, it.nome].map(chave).filter(Boolean)
  for (const n of nomes) {
    const g = gs.find(x => chave(x.nome) === n || (x.produtoNome && chave(x.produtoNome) === n))
    if (g) return g
  }
  for (const n of nomes) {
    const g = gs.find(x => n.includes(chave(x.nome)) || (x.produtoNome && n.includes(chave(x.produtoNome))))
    if (g) return g
  }
  return null
}

/**
 * A base "recortada" no grupo: só os moldes dele, as pranchetas onde eles estão e as posições de texto dessas
 * faces. Partes ficam (valem entre grupos). É o que a exportação recebe para gerar "Tema · Grupo".
 */
export function docDoGrupo(d: Doc, grupoId: string): Doc {
  const g = gruposDa(d).find(x => x.id === grupoId)
  if (!g) return d
  const moldes = d.molds.filter(m => g.moldes.includes(m.id))
  const abs = new Set(moldes.map(m => m.artboardId))
  const faces = new Set(moldes.flatMap(m => m.faces.map(f => f.id)))
  return {
    ...d,
    artboards: d.artboards.filter(a => abs.has(a.id)),
    molds: moldes,
    textSlots: d.textSlots.filter(t => faces.has(t.faceId)),
  }
}
