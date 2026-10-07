'use client'
// Arquivos da Biblioteca usados pela base e pelo tema: imagens (papéis/elementos) com proporção e
// miniatura, salvar/abrir base e tema (JSON versionado) e a Identidade do Ateliê (logo, QR, @).
// Tudo local: nada vai ao servidor.
import { gravar, ler, listar, remover, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { DocBase, DocTema, type DocTema as Tema, type DocTrabalho } from '@/lib/mae/schema'
import type { ArquivoImagem } from '@/lib/mae/vinculo/tema'
import { motorDaPagina } from './motorEditor'
import { sync } from './sincronia'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { slugArquivo } from '@/lib/mae/exportar/nomes'

const EXT_IMG = /\.(png|jpe?g|webp)$/i
const info = new Map<string, ArquivoImagem & { url: string; bitmap?: ImageBitmap }>()

/** Proporção, hash e miniatura de uma imagem da Biblioteca (com cache por caminho). */
export async function infoImagem(raiz: FileSystemDirectoryHandle, path: string): Promise<ArquivoImagem & { url: string; bitmap?: ImageBitmap }> {
  const ja = info.get(path)
  if (ja) return ja
  const f = await ler(raiz, path)
  const bmp = await createImageBitmap(f)
  const sha = await sha256(f)
  const i = { path, sha256: sha, aspect: Math.round((bmp.width / bmp.height) * 10000) / 10000, nome: path.split('/').pop()!.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(f), bitmap: bmp }
  info.set(path, i)
  await motorDaPagina().enviarBitmap(sha, f)
  return i
}
export const infoEmCache = (path: string) => info.get(path)

/** Imagens de uma pasta da Biblioteca (só o 1º nível + subpastas de 1 nível, ex.: Papéis/stitch/). */
export async function listarImagens(raiz: FileSystemDirectoryHandle, pasta: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await listar(raiz, pasta).catch(() => [])) {
    if (e.tipo === 'arquivo' && EXT_IMG.test(e.nome)) out.push(`${pasta}/${e.nome}`)
    else if (e.tipo === 'pasta') for (const s of await listar(raiz, `${pasta}/${e.nome}`).catch(() => [])) if (s.tipo === 'arquivo' && EXT_IMG.test(s.nome)) out.push(`${pasta}/${e.nome}/${s.nome}`)
  }
  return out
}

/** Copia um arquivo do computador para a Biblioteca (mesmo nome com conteúdo diferente ganha o hash). */
export async function guardarImagem(raiz: FileSystemDirectoryHandle, f: File, pasta: string): Promise<ArquivoImagem & { url: string }> {
  const sha = await sha256(f)
  const ponto = f.name.lastIndexOf('.')
  const base = (ponto > 0 ? f.name.slice(0, ponto) : f.name).replace(/[<>:"|?*\\/]/g, '_').replace(/[. ]+$/, '') || 'imagem'
  const ext = ponto > 0 ? f.name.slice(ponto).toLowerCase() : '.png'
  let path = `${pasta}/${base}${ext}`
  const existente = await ler(raiz, path).catch(() => null)
  if (existente && (await sha256(existente)) !== sha) path = `${pasta}/${base}-${sha.slice(0, 8)}${ext}`
  if (!existente || path !== `${pasta}/${base}${ext}`) await gravar(raiz, path, f)
  return infoImagem(raiz, path)
}

// ── base e tema (JSON versionado na Biblioteca) ─────────────────────────────────────────────────
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'sem nome'
export const caminhoBase = (d: { name: string; id: string }) => `Bases/${slug(d.name)}.mae-base.json`
/** Lote 4 (item 44): tema com produto fica em Temas/<Produto>/ (Kit Festa/Ursinha × Sacola P/Ursinha não se sobrescrevem). */
export const caminhoTema = (t: { name?: string; id: string; produto?: string }) => `Temas/${t.produto?.trim() ? `${slug(t.produto)}/` : ''}${slug(t.name ?? t.id)}.mae-tema.json`

export async function salvarBase(raiz: FileSystemDirectoryHandle, d: DocTrabalho): Promise<string> {
  const ok = DocBase.parse(d)
  const path = caminhoBase(ok)
  await gravar(raiz, path, JSON.stringify(ok, null, 1))
  void sync.salvarBase(ok)   // receita na nuvem (Neon), sem esperar: a Biblioteca já tem tudo
  // Lote 3 (item 30): é a base aberta? fica marcada como "salva"
  const m = useMaeDoc.getState()
  if (m.contexto === 'base' && m.hist.atual === d) m.marcarSalvo()
  else if (m.guardados.base?.hist.atual === d) useMaeDoc.setState({ guardados: { ...m.guardados, base: { ...m.guardados.base, marca: m.guardados.base.hist.desfazer.at(-1) ?? null } } })
  return path
}
export async function salvarTema(raiz: FileSystemDirectoryHandle, t: Tema): Promise<string> {
  const ok = DocTema.parse(t)
  const path = caminhoTema(ok)
  await gravar(raiz, path, JSON.stringify(ok, null, 1))
  // Lote 4 (item 44): ganhou produto → saiu de Temas/ para Temas/<Produto>/; a cópia antiga (mesmo tema) sai
  const antigo = caminhoTema({ ...ok, produto: undefined })
  if (antigo !== path) {
    const velho = await ler(raiz, antigo).then(f => f.text()).then(JSON.parse).catch(() => null) as { id?: string } | null
    if (velho?.id === ok.id) await remover(raiz, antigo).catch(() => null)
  }
  void sync.salvarTema(ok)
  if (useMaeTema.getState().hist?.atual === t) useMaeTema.getState().marcarSalvo()
  return path
}

// ── design do editor livre (Designs/*.mae-design.json) ──
export const PASTA_DESIGNS = 'Designs'
export const caminhoDesign = (nome: string) => `${PASTA_DESIGNS}/${slugArquivo(nome, 60)}.mae-design.json`
export async function salvarDesign(raiz: FileSystemDirectoryHandle, d: DocTrabalho): Promise<string> {
  const path = caminhoDesign(d.name)
  await gravar(raiz, path, JSON.stringify({ tipo: 'mae-design', salvoEm: new Date().toISOString(), doc: d }, null, 2))
  const m = useMaeDoc.getState()
  if (m.contexto === 'imagem' && m.hist.atual === d) m.marcarSalvo()
  return path
}

export interface ItemSalvo<T> { path: string; doc: T }
async function lerTodos<T>(raiz: FileSystemDirectoryHandle, pasta: string, sufixo: string, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, subpastas = false): Promise<ItemSalvo<T>[]> {
  const out: ItemSalvo<T>[] = []
  for (const e of await listar(raiz, pasta).catch(() => [])) {
    // Lote 4 (item 44): Temas/<Produto>/*.mae-tema.json (1 nível; paginas/ é das imagens dos temas prontos)
    if (subpastas && e.tipo === 'pasta' && e.nome !== 'paginas') { out.push(...await lerTodos(raiz, `${pasta}/${e.nome}`, sufixo, schema)); continue }
    if (e.tipo !== 'arquivo' || !e.nome.endsWith(sufixo)) continue
    try {
      const r = schema.safeParse(JSON.parse(await (await ler(raiz, `${pasta}/${e.nome}`)).text()))
      if (r.success && r.data) out.push({ path: `${pasta}/${e.nome}`, doc: r.data })
    } catch { /* arquivo corrompido: ignora */ }
  }
  return out
}
/** Bases da Biblioteca + as que só estão na nuvem (salvas em outro computador da conta). */
export async function listarBases(raiz: FileSystemDirectoryHandle): Promise<ItemSalvo<DocTrabalho>[]> {
  const locais = await lerTodos<DocTrabalho>(raiz, 'Bases', '.mae-base.json', DocBase as never)
  for (const b of await sync.listarBases()) {
    if (locais.some(l => l.doc.id === b.id && l.doc.version >= b.version)) continue
    const doc = await sync.abrirBase(b.id).catch(() => null)
    const ok = doc ? DocBase.safeParse(doc) : null
    if (ok?.success) { const i = locais.findIndex(l => l.doc.id === b.id); const item = { path: '(nuvem)', doc: ok.data }; if (i >= 0) locais[i] = item; else locais.push(item) }
  }
  return locais
}
export async function listarTemas(raiz: FileSystemDirectoryHandle): Promise<ItemSalvo<Tema>[]> {
  const todos = await lerTodos<Tema>(raiz, 'Temas', '.mae-tema.json', DocTema as never, true)
  // o mesmo tema salvo em dois lugares (antes e depois de ganhar produto): fica a versão mais nova
  const locais: ItemSalvo<Tema>[] = []
  for (const t of todos) { const i = locais.findIndex(l => l.doc.id === t.doc.id); if (i < 0) locais.push(t); else if (locais[i].doc.version < t.doc.version) locais[i] = t }
  for (const t of await sync.listarTemas()) {
    if (locais.some(l => l.doc.id === t.id && l.doc.version >= t.version)) continue
    const doc = await sync.abrirTema(t.id).catch(() => null)
    const ok = doc ? DocTema.safeParse(doc) : null
    if (ok?.success) { const i = locais.findIndex(l => l.doc.id === t.id); const item = { path: '(nuvem)', doc: ok.data }; if (i >= 0) locais[i] = item; else locais.push(item) }
  }
  return locais
}

// ── Identidade do Ateliê ─────────────────────────────────────────────────────────────────────────
export interface Identidade { logo?: ArquivoImagem; qr?: ArquivoImagem & { link?: string }; arroba?: string }
const ARQ_IDENT = 'Identidade/identidade.json'

/** Identidade da Biblioteca; se não houver (outro computador), a da nuvem (os arquivos podem faltar). */
export async function lerIdentidade(raiz: FileSystemDirectoryHandle): Promise<Identidade> {
  try { return JSON.parse(await (await ler(raiz, ARQ_IDENT)).text()) as Identidade } catch { /* sem arquivo local */ }
  const nuvem = await sync.lerIdentidade()
  if (!nuvem) return {}
  const { logo, qr, arroba } = nuvem
  return { ...(logo ? { logo } : {}), ...(qr ? { qr } : {}), ...(arroba ? { arroba } : {}) }
}
export async function gravarIdentidade(raiz: FileSystemDirectoryHandle, i: Identidade): Promise<void> {
  await gravar(raiz, ARQ_IDENT, JSON.stringify(i, null, 1))
  void sync.salvarIdentidade(i)
}
/** QR Code gerado no navegador a partir do link (WhatsApp, Instagram…), gravado em Identidade/qr.png. */
export async function gerarQr(raiz: FileSystemDirectoryHandle, link: string): Promise<ArquivoImagem & { link: string }> {
  const QR = (await import('qrcode')).default
  const url = await QR.toDataURL(link, { margin: 1, width: 600, errorCorrectionLevel: 'M' })
  const blob = await (await fetch(url)).blob()
  await gravar(raiz, 'Identidade/qr.png', blob)
  info.delete('Identidade/qr.png')
  const i = await infoImagem(raiz, 'Identidade/qr.png')
  return { path: i.path, sha256: i.sha256, aspect: i.aspect, link }
}
