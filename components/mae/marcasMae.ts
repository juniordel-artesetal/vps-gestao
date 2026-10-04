'use client'
// MARCAS DE REGISTRO (Sprint 9): o PDF da marca vai para "Marcas de registro/" na Biblioteca; a receita
// (folha em mm, hash, página, zonas com tinta) fica em Marcas de registro/marcas.json e sincroniza com a
// conta (mae_registration_presets). O arquivo nunca sai do computador.
import { create } from 'zustand'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { zonasDaMarca } from '@/lib/mae/exportar/marca'
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
  return todas
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
  const { rasterizarPaginaPdf } = await import('@/lib/mae/importacao/navegador')
  const r = await rasterizarPaginaPdf(bytes, pagina, PX_MM_ANALISE)
  const m: MarcaRegistro = {
    id: novoId(), nome: arquivo.name.replace(/\.pdf$/i, ''), path, sha256: await sha256(bytes),
    wMm: Math.round(r.larguraMm * 100) / 100, hMm: Math.round(r.alturaMm * 100) / 100, pagina,
    zonas: zonasDaMarca(r.rgba, r.w, r.h, PX_MM_ANALISE).map(z => ({ x: +z.x.toFixed(2), y: +z.y.toFixed(2), w: +z.w.toFixed(2), h: +z.h.toFixed(2) })),
  }
  await gravarLista(raiz, [...useMarcas.getState().marcas.filter(x => x.path !== path), m])
  void sync.marcas.salvar(m)
  return m
}

export async function excluirMarca(raiz: FileSystemDirectoryHandle, id: string): Promise<void> {
  await gravarLista(raiz, useMarcas.getState().marcas.filter(m => m.id !== id))
  void sync.marcas.excluir(id).catch(() => null)
}
