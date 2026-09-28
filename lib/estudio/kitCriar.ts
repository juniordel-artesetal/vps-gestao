// SOA Design — KIT (cliente): carregar tudo o que o Kit Composer usa, criar um TEMA (cada slot vira uma caixa viva com
// o snapshot das versões + a KitInstancia que as referencia) e gravar as SAÍDAS do projeto (receitas por referência).
import { enviarArquivo } from './cliente'
import { snapCaixa, snapKit, type KitTemplate, type KitInstancia, type Composicao, type ExportPreset, type SnapCaixa } from './kitMotor'
import type { BoxTemplate, BoxInstancia } from './caixaViva'
import type { ConfigAplique } from './aplique'

const J = <T,>(v: unknown, d: T): T => { if (v == null) return d; if (typeof v === 'string') { try { return JSON.parse(v) as T } catch { return d } } return v as T }
const lista = async (r: string): Promise<Record<string, unknown>[]> => ((await fetch(`/api/estudio/${r}`).then(x => x.json()).catch(() => ({}))).itens || []) as Record<string, unknown>[]

export const kitDaLinha = (l: Record<string, unknown>): KitTemplate => ({ id: String(l.id), nome: String(l.nome), slots: J(l.slots, []), versao: Number(l.versao) || 1, config: J(l.config, {}) })
export const compDaLinha = (l: Record<string, unknown>): Composicao => ({ id: String(l.id), kitTemplateId: String(l.kitTemplateId), nome: String(l.nome), posicoes: J(l.posicoes, {}), versao: Number(l.versao) || 1, config: J(l.config, {}) })
export const temaDaLinha = (l: Record<string, unknown>): KitInstancia => ({ id: String(l.id), tema: String(l.tema), kitTemplateId: String(l.kitTemplateId), slots: J(l.slots, {}), composicoes: J(l.composicoes, []), config: J(l.config, {}) })
export const presetDaLinha = (l: Record<string, unknown>): ExportPreset => ({ id: String(l.id), nome: String(l.nome), tamanhos: J(l.tamanhos, []), qualidade: Number(l.qualidade) || 92, formato: l.formato === 'png' ? 'png' : 'jpg', outputsIncluidos: J(l.outputsIncluidos, ['kit']), cenaDefault: (l.cenaDefault as string) || null })
const tplDaLinha = (l: Record<string, unknown>): BoxTemplate => ({ id: String(l.id), nome: String(l.nome), versao: Number(l.versao) || 1, modelo: (l.modelo as string) || null, facaUrl: (l.facaUrl as string) || null, largura: Number(l.largura) || 0, altura: Number(l.altura) || 0, regioes: J(l.regioes, []), config: J(l.config, {}) })
const instDaLinha = (l: Record<string, unknown>): BoxInstancia => ({ id: String(l.id), nome: String(l.nome), boxTemplateId: String(l.boxTemplateId), mockupId: (l.mockupId as string) || null, artworkUrl: (l.artworkUrl as string) || null, faces: J(l.faces, {}), apliques: J(l.apliques, []), saidas: J(l.saidas, []), config: J(l.config, {}) })

export interface DadosKit {
  kits: KitTemplate[]; comps: Composicao[]; temas: KitInstancia[]; tpls: BoxTemplate[]; caixas: BoxInstancia[]
  mockups: Record<string, unknown>[]; apliques: { id: string; pngUrl: string | null; config: ConfigAplique }[]; presets: ExportPreset[]
}
export async function carregarDadosKit(): Promise<DadosKit> {
  const [k, c, t, b, i, m, a, p] = await Promise.all(['kit-templates', 'composicoes', 'kit-instancias', 'box-templates', 'box-instancias', 'mockups', 'apliques', 'export-presets'].map(lista))
  return {
    kits: k.map(kitDaLinha), comps: c.map(compDaLinha), temas: t.map(temaDaLinha), tpls: b.map(tplDaLinha), caixas: i.map(instDaLinha), mockups: m,
    apliques: a.map(x => ({ id: String(x.id), pngUrl: (x.pngUrl as string) || null, config: J<ConfigAplique>(x.config, { larguraMm: 60, camadas: [], preencherVaos: true, sombraNoProduto: true }) })),
    presets: p.map(presetDaLinha),
  }
}

/**
 * Cria o TEMA: cada arquivo de slot sobe ao Blob e vira uma CAIXA VIVA (com o snapshot da faca/mockup nesta versão);
 * a KitInstancia só REFERENCIA as caixas (slot → id) e guarda o snapshot do kit e das composições.
 */
export async function criarTema(p: { tema: string; kit: KitTemplate; comps: Composicao[]; tpls: Map<string, BoxTemplate>; mockups: Map<string, Record<string, unknown>>; arquivos: Record<string, File>; workspaceId: string }): Promise<{ ki: KitInstancia; caixas: BoxInstancia[] }> {
  const slots: Record<string, string> = {}, caixas: BoxInstancia[] = []
  for (const s of p.kit.slots) {
    const f = p.arquivos[s.id]
    if (!f) continue
    const tpl = p.tpls.get(s.boxTemplateId)
    if (!tpl) throw new Error(`o slot “${s.name}” aponta para uma faca que não existe mais`)
    const mockupId = tpl.config.mockupId || null
    const up = await enviarArquivo(f, f.name, 'imagem', p.workspaceId, { pasta: `Kits/${p.tema}` })
    const config = { snap: snapCaixa(tpl, mockupId ? p.mockups.get(mockupId) || null : null) as SnapCaixa }
    const corpo = { nome: `${p.tema} · ${s.name}`, boxTemplateId: tpl.id, mockupId, artworkUrl: up.url, faces: {}, apliques: [], saidas: [], config }
    const r = await fetch('/api/estudio/box-instancias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || `não consegui criar a caixa “${s.name}”`)
    slots[s.id] = j.id
    caixas.push({ id: j.id, ...corpo })
  }
  const kc = p.comps.filter(c => c.kitTemplateId === p.kit.id)
  const corpo = { tema: p.tema, kitTemplateId: p.kit.id, slots, composicoes: kc.map(c => ({ composicaoId: c.id })), config: { snap: snapKit(p.kit, kc) } }
  const r = await fetch('/api/estudio/kit-instancias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'não consegui criar o tema')
  return { ki: { id: j.id, ...corpo }, caixas }
}

/** Troca a arte de UM slot: a caixa viva é a mesma (referência) — tudo que a usa atualiza sozinho. */
export async function trocarArteDoSlot(caixa: BoxInstancia, f: File, workspaceId: string): Promise<BoxInstancia> {
  const up = await enviarArquivo(f, f.name, 'imagem', workspaceId, { pasta: 'Kits' })
  const r = await fetch(`/api/estudio/box-instancias/${caixa.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ artworkUrl: up.url }) })
  if (!r.ok) throw new Error('não consegui trocar a arte')
  return { ...caixa, artworkUrl: up.url }
}

export interface SaidaMarcada { tipo: 'kit' | 'individual' | 'composicao'; slotId?: string; composicaoId?: string; cenaId: string }
/** Grava as saídas do projeto (receitas que REFERENCIAM as caixas/composições — nunca cópia de imagem). */
export async function gravarSaidas(projetoId: string, saidas: SaidaMarcada[], presetIds: string[]) {
  const antigas = await lista(`outputs?projetoId=${encodeURIComponent(projetoId)}`)
  for (const a of antigas) await fetch(`/api/estudio/outputs/${a.id}`, { method: 'DELETE' })
  for (const s of saidas) for (const pid of presetIds.length ? presetIds : ['']) {
    await fetch('/api/estudio/outputs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projetoId, tipo: s.tipo, refs: { slotId: s.slotId || null, composicaoId: s.composicaoId || null, cenaId: s.cenaId }, exportPresetId: pid || null }) })
  }
}
