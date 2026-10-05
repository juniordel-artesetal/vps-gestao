'use client'
// Fontes do TEXTO no navegador (Sprint 7): locais (Local Font Access — inclusive as compradas na
// Creative Fabrica), Google Fonts (baixadas do repositório oficial e guardadas em "Fontes Google/" na
// Biblioteca) e a SUBSTITUTA temporária embutida (Sniglet, OFL). O tema guarda só o nome técnico.
import { create } from 'zustand'
import { abrirFonte, type FonteHB } from '@/lib/mae/texto/fonte'
import type { RegistroFontes } from '@/lib/mae/texto/noTexto'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import type { DocTema } from '@/lib/mae/schema'

type FonteDoTema = DocTema['textStyles'][string]['font']
interface FontData { family: string; fullName: string; postscriptName: string; style: string; blob: () => Promise<Blob> }

/** Google Fonts de festa (estáticas, OFL/Apache) — URL do repositório oficial (CORS liberado). */
export const GOOGLE_FONTS: { family: string; ps: string; url: string }[] = [
  ['Pacifico', 'Pacifico-Regular', 'ofl/pacifico/Pacifico-Regular.ttf'], ['Lobster', 'Lobster-Regular', 'ofl/lobster/Lobster-Regular.ttf'],
  ['Great Vibes', 'GreatVibes-Regular', 'ofl/greatvibes/GreatVibes-Regular.ttf'], ['Chewy', 'Chewy-Regular', 'apache/chewy/Chewy-Regular.ttf'],
  ['Bubblegum Sans', 'BubblegumSans-Regular', 'ofl/bubblegumsans/BubblegumSans-Regular.ttf'], ['Cookie', 'Cookie-Regular', 'ofl/cookie/Cookie-Regular.ttf'],
  ['Sacramento', 'Sacramento-Regular', 'ofl/sacramento/Sacramento-Regular.ttf'], ['Luckiest Guy', 'LuckiestGuy-Regular', 'apache/luckiestguy/LuckiestGuy-Regular.ttf'],
  ['Kaushan Script', 'KaushanScript-Regular', 'ofl/kaushanscript/KaushanScript-Regular.ttf'], ['Sniglet', 'Sniglet', 'ofl/sniglet/Sniglet-Regular.ttf'],
].map(([family, ps, p]) => ({ family, ps, url: `https://raw.githubusercontent.com/google/fonts/main/${p}` }))

const carregadas = new Map<string, FonteHB>()
let substituta: FonteHB | undefined
let locais: FontData[] | null = null

export interface EstadoFontes {
  versao: number
  carregando: string[]
  /** nomes técnicos pedidos pelo tema que não estão neste computador */
  faltando: string[]
  permissao: 'desconhecida' | 'ok' | 'pedir' | 'negada' | 'sem-suporte'
  locais: { family: string; ps: string; style: string }[]
}
export const useFontes = create<EstadoFontes>()(() => ({ versao: 0, carregando: [], faltando: [], permissao: 'desconhecida', locais: [] }))
const muda = (p: Partial<EstadoFontes>) => useFontes.setState(s => ({ ...p, versao: s.versao + 1 }))

/** Registro síncrono usado pela resolução do vínculo (só o que já está carregado). */
export const registroFontes: RegistroFontes = {
  obter: ps => carregadas.get(ps),
  get substituta() { return substituta },
}
export const fonteCarregada = (ps: string) => carregadas.get(ps)

export async function carregarSubstituta(): Promise<FonteHB> {
  if (!substituta) {
    const r = await fetch('/mae/fontes/Sniglet-Regular.ttf')
    substituta = await abrirFonte(await r.arrayBuffer(), 'Sniglet')
    carregadas.set(substituta.ps, substituta)
    muda({})
  }
  return substituta
}

/** Lista as fontes instaladas (pede a permissão na 1ª vez — precisa de um clique da usuária). */
export async function listarLocais(pedir = false): Promise<void> {
  const q = (globalThis as unknown as { queryLocalFonts?: () => Promise<FontData[]> }).queryLocalFonts
  if (!q) { muda({ permissao: 'sem-suporte' }); return }
  try {
    const p = await (navigator as unknown as { permissions?: { query: (o: { name: string }) => Promise<{ state: string }> } }).permissions?.query({ name: 'local-fonts' }).catch(() => null)
    if (p && p.state === 'prompt' && !pedir) { muda({ permissao: 'pedir' }); return }
    if (p && p.state === 'denied') { muda({ permissao: 'negada' }); return }
    locais = await q()
    muda({ permissao: 'ok', locais: locais.map(f => ({ family: f.family, ps: f.postscriptName, style: f.style })) })
  } catch (e) {
    const n = (e as { name?: string })?.name
    muda({ permissao: n === 'NotAllowedError' || n === 'SecurityError' ? 'pedir' : 'negada' })
  }
}

/** Carrega a fonte do estilo (local, Google ou já carregada). Falhou = fica a substituta + aviso. */
export async function carregarFonte(f: FonteDoTema, raiz: FileSystemDirectoryHandle | null): Promise<FonteHB | undefined> {
  const ja = carregadas.get(f.postscriptName)
  if (ja) return ja
  const st = useFontes.getState()
  if (st.carregando.includes(f.postscriptName)) return undefined
  muda({ carregando: [...st.carregando, f.postscriptName] })
  let fonte: FonteHB | undefined
  try {
    if (f.source === 'google' && f.url) {
      const nomeArq = `Fontes Google/${f.url.split('/').pop()}`
      let bytes: ArrayBuffer | null = null
      if (raiz) bytes = await ler(raiz, nomeArq).then(x => x.arrayBuffer()).catch(() => null)
      if (!bytes) {
        const r = await fetch(f.url)
        if (!r.ok) throw new Error(`Google Fonts respondeu ${r.status}`)
        bytes = await r.arrayBuffer()
        if (raiz) await gravar(raiz, nomeArq, new Blob([bytes])).catch(() => {})
      }
      fonte = await abrirFonte(bytes, f.family)
    } else {
      if (!locais && useFontes.getState().permissao !== 'pedir') await listarLocais(false)
      const fd = locais?.find(x => x.postscriptName === f.postscriptName)
      if (fd) fonte = await abrirFonte(await (await fd.blob()).arrayBuffer(), fd.family)
    }
    if (fonte) { carregadas.set(f.postscriptName, fonte); if (fonte.ps !== f.postscriptName) carregadas.set(fonte.ps, fonte) }
  } catch (e) { console.warn('[MAE] fonte', f.postscriptName, e) }
  const s2 = useFontes.getState()
  muda({ carregando: s2.carregando.filter(x => x !== f.postscriptName), faltando: fonte ? s2.faltando.filter(x => x !== f.postscriptName) : [...new Set([...s2.faltando, f.postscriptName])] })
  return fonte
}

/** Editor de imagem (Sprint 13): garante as fontes dos textos livres (locais, Google ou a substituta). */
export async function garantirFontes(ps: Iterable<string>, raiz: FileSystemDirectoryHandle | null): Promise<void> {
  await carregarSubstituta()
  for (const p of ps) {
    if (carregadas.has(p)) continue
    const g = GOOGLE_FONTS.find(x => x.ps === p)
    await carregarFonte({ postscriptName: p, family: g?.family ?? p, source: g ? 'google' : 'local', ...(g ? { url: g.url } : {}) } as FonteDoTema, raiz).catch(() => undefined)
  }
}

/** Garante a substituta e as fontes de todos os estilos do tema. */
export async function garantirFontesDoTema(t: DocTema | null, raiz: FileSystemDirectoryHandle | null): Promise<void> {
  await carregarSubstituta()
  for (const e of Object.values(t?.textStyles ?? {})) await carregarFonte(e.font, raiz)
}
