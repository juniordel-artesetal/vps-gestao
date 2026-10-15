'use client'
// MARCAS DE REGISTRO (Sprint 9): o PDF da marca vai para "Marcas de registro/" na Biblioteca; a receita
// (folha em mm, hash, página, zonas com tinta) fica em Marcas de registro/marcas.json e sincroniza com a
// conta (mae_registration_presets). O arquivo nunca sai do computador.
import { create } from 'zustand'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { zonasDaMarca, trocarMarcaNoDoc } from '@/lib/mae/exportar/marca'
import { remover } from '@/lib/mae/biblioteca/arquivos'
import { sync, type MarcaRegistro } from './sincronia'

const ARQ = 'Marcas de registro/marcas.json'
const PX_MM_ANALISE = 4

interface EstadoMarcas { marcas: MarcaRegistro[]; carregado: boolean }
export const useMarcas = create<EstadoMarcas>()(() => ({ marcas: [], carregado: false }))

const novoId = () => 'mr_' + Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Lista local (Biblioteca) + as da conta que não estão aqui (o arquivo pode faltar neste computador). */
export async function carregarMarcas(raiz: FileSystemDirectoryHandle): Promise<MarcaRegistro[]> {
  let locais: MarcaRegistro[] = []
  try { locais = JSON.parse(await (await ler(raiz, ARQ)).text()) as MarcaRegistro[] } catch { /* ainda não tem */ }
  const nuvem = await sync.marcas.listar().catch(() => [] as MarcaRegistro[])
  const todas = [...locais, ...nuvem.filter(n => !locais.some(l => l.id === n.id))]
  useMarcas.setState({ marcas: todas, carregado: true })
  // Lote 14 (item 188): marcas cadastradas antes guardam a CAIXA inteira de cada marca (o "L" do canto bloqueava o
  // canto todo) — recalcula uma vez, pelo PDF que está na Biblioteca, sem travar a tela
  if (todas.some(m => (m.zonasV ?? 1) < ZONAS_V)) void atualizarZonas(raiz).catch(e => console.warn('[MAE] zonas das marcas', e))
  return todas
}

const ZONAS_V = 3   // Lote 18 (item 229): faixas de tinta reais; as marcas antigas recalculam sozinhas
async function zonasDoPdf(bytes: Uint8Array, pagina: number) {
  const { rasterizarPaginaPdf } = await import('@/lib/mae/importacao/navegador')
  const r = await rasterizarPaginaPdf(bytes, pagina, PX_MM_ANALISE)
  return { r, zonas: zonasDaMarca(r.rgba, r.w, r.h, PX_MM_ANALISE).map(z => ({ x: +z.x.toFixed(2), y: +z.y.toFixed(2), w: +z.w.toFixed(2), h: +z.h.toFixed(2) })) }
}
let atualizando = false
async function atualizarZonas(raiz: FileSystemDirectoryHandle) {
  if (atualizando) return
  atualizando = true
  try {
    const lista = [...useMarcas.getState().marcas]
    let mudou = false
    for (const [i, m] of lista.entries()) {
      if ((m.zonasV ?? 1) >= ZONAS_V) continue
      let bytes: Uint8Array
      try { bytes = new Uint8Array(await (await ler(raiz, m.path)).arrayBuffer()) } catch { continue }   // o PDF não está neste computador
      const { zonas } = await zonasDoPdf(bytes, m.pagina || 1)
      lista[i] = { ...m, zonas, zonasV: ZONAS_V }
      mudou = true
      void sync.marcas.salvar(lista[i])
    }
    if (mudou) await gravarLista(raiz, lista)
  } finally { atualizando = false }
}

async function gravarLista(raiz: FileSystemDirectoryHandle, lista: MarcaRegistro[]) {
  await gravar(raiz, ARQ, JSON.stringify(lista, null, 2))
  useMarcas.setState({ marcas: lista })
}

/** Cadastra um PDF de marca de registro: guarda na Biblioteca, mede a folha e acha as zonas com tinta. */
export async function adicionarMarca(raiz: FileSystemDirectoryHandle, arquivo: File, pagina = 1): Promise<MarcaRegistro> {
  if (!/\.pdf$/i.test(arquivo.name)) throw new Error('A marca de registro precisa ser um PDF (o do Silhouette Studio, da Cricut ou da Brother).')
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const path = `Marcas de registro/${arquivo.name.replace(/[\\/:*?"<>|]/g, '-')}`
  await gravar(raiz, path, new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const { r, zonas } = await zonasDoPdf(bytes, pagina)
  const sha = await sha256(bytes)
  const antiga = useMarcas.getState().marcas.find(x => x.path === path || x.sha256 === sha)
  const m: MarcaRegistro = {
    id: antiga?.id ?? novoId(), nome: arquivo.name.replace(/\.pdf$/i, ''), path, sha256: sha,
    wMm: Math.round(r.larguraMm * 100) / 100, hMm: Math.round(r.alturaMm * 100) / 100, pagina,
    zonas, zonasV: ZONAS_V,
  }
  await gravarLista(raiz, [...useMarcas.getState().marcas.filter(x => x.path !== path && x.id !== m.id), m])
  void sync.marcas.salvar(m)
  return m
}

/**
 * Marca da prancheta (Lote 2, item 23): pelo código e, se ele não existir mais (marca cadastrada de novo,
 * outra lista), pela impressão digital do arquivo. null = sem marca (ou não encontrada — ver o código).
 */
export function marcaDaPrancheta(ab: { registrationPresetId?: string; registrationPresetSha?: string }, marcas: MarcaRegistro[]): MarcaRegistro | null {
  if (!ab.registrationPresetId && !ab.registrationPresetSha) return null
  return marcas.find(m => m.id === ab.registrationPresetId) ?? (ab.registrationPresetSha ? marcas.find(m => m.sha256 === ab.registrationPresetSha) : undefined) ?? null
}

/** Orientação/tamanho da marca × prancheta: ok (bate), girada (orientação trocada) ou diferente. */
export function encaixeDaMarca(ab: { widthMm: number; heightMm: number }, m: { wMm: number; hMm: number }): 'ok' | 'girada' | 'diferente' {
  const igual = (a: number, b: number) => Math.abs(a - b) <= 0.6
  if (igual(ab.widthMm, m.wMm) && igual(ab.heightMm, m.hMm)) return 'ok'
  if (igual(ab.widthMm, m.hMm) && igual(ab.heightMm, m.wMm)) return 'girada'
  return 'diferente'
}

/**
 * Lote 18 (item 225): EXCLUIR vai para a LIXEIRA (30 dias): o PDF vai para Lixeira/Marcas e a conta guarda a receita
 * (Restaurar traz de volta). Antes apagava de vez — as bases que usavam ficavam com "marca não encontrada".
 */
export async function excluirMarca(raiz: FileSystemDirectoryHandle, id: string): Promise<void> {
  const m = useMarcas.getState().marcas.find(x => x.id === id)
  if (m) {
    const lixo = `Lixeira/Marcas/${m.path.split('/').pop()}`
    try { await gravar(raiz, lixo, await ler(raiz, m.path)); await remover(raiz, m.path).catch(() => null) } catch { /* o PDF não está neste computador */ }
  }
  await gravarLista(raiz, useMarcas.getState().marcas.filter(x => x.id !== id))
  void sync.marcas.excluir(id).catch(() => null)
}
/** Lote 18 (item 225): RESTAURAR uma marca da lixeira (o PDF volta de Lixeira/Marcas, a receita volta à conta). */
export async function restaurarMarca(raiz: FileSystemDirectoryHandle, m: MarcaRegistro): Promise<void> {
  const lixo = `Lixeira/Marcas/${m.path.split('/').pop()}`
  try { await gravar(raiz, m.path, await ler(raiz, lixo)); await remover(raiz, lixo).catch(() => null) } catch { /* o PDF da lixeira não está aqui */ }
  const limpa: MarcaRegistro = { id: m.id, nome: m.nome, path: m.path, sha256: m.sha256, wMm: m.wMm, hMm: m.hMm, pagina: m.pagina, zonas: m.zonas, ...(m.zonasV ? { zonasV: m.zonasV } : {}), ...(m.ajuste ? { ajuste: m.ajuste } : {}) }
  await gravarLista(raiz, [...useMarcas.getState().marcas.filter(x => x.id !== m.id), limpa])
  void sync.marcas.salvar(limpa)
}

/** Lote 18 (item 225): onde a marca é usada — bases (a aberta conta pela tela) e quantas pranchetas/folhas. */
export async function usoDaMarca(raiz: FileSystemDirectoryHandle, id: string): Promise<{ bases: { id: string; nome: string }[]; pranchetas: number }> {
  const { listarBases } = await import('./arquivosMae')
  const { useMaeDoc } = await import('@/lib/mae/editor/loja')
  const aberta = useMaeDoc.getState().hist.atual
  const docs = (await listarBases(raiz)).map(b => (b.doc.id === aberta.id ? aberta : b.doc))
  if (!docs.some(d => d.id === aberta.id) && aberta.molds.length) docs.push(aberta)
  let pranchetas = 0
  const bases: { id: string; nome: string }[] = []
  for (const d of docs) { const n = trocarMarcaNoDoc(d, id); if (n) { pranchetas += n; bases.push({ id: d.id, nome: d.name }) } }
  return { bases, pranchetas }
}

/** Lote 18 (item 225): TROCAR a marca `de` por `para` em todas as bases (versão nova de cada uma). */
export async function trocarMarcaNasBases(raiz: FileSystemDirectoryHandle, de: string, para: MarcaRegistro): Promise<number> {
  const { listarBases, salvarBase } = await import('./arquivosMae')
  const { useMaeDoc } = await import('@/lib/mae/editor/loja')
  let n = 0
  const aberta = useMaeDoc.getState().hist.atual
  if (trocarMarcaNoDoc(aberta, de)) {
    useMaeDoc.getState().aplicar('Trocar a marca de registro', d => { trocarMarcaNoDoc(d, de, { id: para.id, sha256: para.sha256 }); d.version = (d.version ?? 0) + 1 })
    await salvarBase(raiz, useMaeDoc.getState().hist.atual); n++
  }
  for (const b of await listarBases(raiz)) {
    if (b.doc.id === aberta.id) continue
    const c = JSON.parse(JSON.stringify(b.doc)) as typeof b.doc
    if (!trocarMarcaNoDoc(c, de, { id: para.id, sha256: para.sha256 })) continue
    c.version = (c.version ?? 0) + 1
    await salvarBase(raiz, c); n++
  }
  return n
}

/**
 * Lote 18 (item 225): SUBSTITUIR O ARQUIVO da marca — o PDF novo no lugar, mantendo id, nome, ajuste fino e as
 * ligações (as bases continuam apontando para ela).
 */
export async function substituirArquivoMarca(raiz: FileSystemDirectoryHandle, id: string, arquivo: File, pagina = 1): Promise<MarcaRegistro> {
  if (!/\.pdf$/i.test(arquivo.name)) throw new Error('A marca de registro precisa ser um PDF.')
  const antiga = useMarcas.getState().marcas.find(m => m.id === id)
  if (!antiga) throw new Error('Marca não encontrada.')
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const path = `Marcas de registro/${arquivo.name.replace(/[\\/:*?"<>|]/g, '-')}`
  await gravar(raiz, path, new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const { r, zonas } = await zonasDoPdf(bytes, pagina)
  const m: MarcaRegistro = { ...antiga, path, sha256: await sha256(bytes), wMm: Math.round(r.larguraMm * 100) / 100, hMm: Math.round(r.alturaMm * 100) / 100, pagina, zonas, zonasV: ZONAS_V }
  if (antiga.path !== path) await remover(raiz, antiga.path).catch(() => null)
  await gravarLista(raiz, useMarcas.getState().marcas.map(x => (x.id === id ? m : x)))
  void sync.marcas.salvar(m)
  return m
}

/** Lote 15 (item 202): grava o AJUSTE FINO de uma marca (Biblioteca + nuvem). null = sem ajuste. */
export async function salvarAjusteMarca(raiz: FileSystemDirectoryHandle, id: string, ajuste: MarcaRegistro['ajuste'] | null): Promise<void> {
  const lista = useMarcas.getState().marcas.map(m => {
    if (m.id !== id) return m
    const n = { ...m }
    if (ajuste && (ajuste.xMm || ajuste.yMm)) n.ajuste = { xMm: Math.round(ajuste.xMm * 100) / 100, yMm: Math.round(ajuste.yMm * 100) / 100, paisagem: ajuste.paisagem }
    else delete n.ajuste
    return n
  })
  await gravarLista(raiz, lista)
  const m = lista.find(x => x.id === id)
  if (m) void sync.marcas.salvar(m)
}

/**
 * Lote 15 (item 202): CALIBRAR a marca por um PDF que já corta certo (a página da MESMA caixa): acha os "L" dos cantos
 * no arquivo da marca e na página de referência e devolve quanto a marca tem de andar (na orientação da página).
 */
export async function calibrarMarca(raiz: FileSystemDirectoryHandle, m: MarcaRegistro, referencia: File, pagina: number): Promise<{ ajuste: NonNullable<MarcaRegistro['ajuste']> } | { erro: string }> {
  const { rasterizarPaginaPdf } = await import('@/lib/mae/importacao/navegador')
  const { cantosDasMarcas, cantosNaFolha, deslocamentoDasMarcas, marcaNaFolha } = await import('@/lib/mae/exportar/marca')
  const PX = 10
  const ref = await rasterizarPaginaPdf(new Uint8Array(await referencia.arrayBuffer()), pagina, PX)
  const mar = await rasterizarPaginaPdf(new Uint8Array(await (await ler(raiz, m.path)).arrayBuffer()), m.pagina || 1, PX)
  const certo = cantosDasMarcas(ref.rgba, ref.w, ref.h, PX)
  const e = marcaNaFolha(ref.larguraMm, ref.alturaMm, mar.larguraMm, mar.alturaMm)   // como o MAE põe hoje, sem ajuste
  if (e.diferente) return { erro: `A página de referência tem ${Math.round(ref.larguraMm)} × ${Math.round(ref.alturaMm)} mm e a marca, ${Math.round(mar.larguraMm)} × ${Math.round(mar.alturaMm)} mm — use uma página do mesmo tamanho.` }
  const nosso = cantosNaFolha(cantosDasMarcas(mar.rgba, mar.w, mar.h, PX), e, mar.alturaMm, ref.larguraMm, ref.alturaMm)
  const d = deslocamentoDasMarcas(nosso, certo)
  if ('erro' in d) return d
  return { ajuste: { xMm: d.xMm, yMm: d.yMm, paisagem: ref.larguraMm > ref.alturaMm } }
}

