'use client'
// Lote 21 (item 254): seletor de cor + PALETA DO TEMA. Ao lado do seletor nativo, o botão abre os tons que já existem
// nos papéis e elementos do tema (5 a 8 cores, cada uma com um tom mais claro e um mais escuro). A paleta é calculada na
// hora em que abre (só com a lista de arquivos do tema) e se atualiza sozinha quando entra papel ou elemento novo.
import { useEffect, useMemo, useState } from 'react'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { infoImagem } from './arquivosMae'
import { imagensDoTema, paletaDePixels, type CorDaPaleta } from '@/lib/mae/vinculo/paletaDoTema'

const LADO = 40
/** Pixels (RGB, sem os transparentes) de cada arquivo, por caminho — lidos uma vez só. */
const pixelsPorArquivo = new Map<string, Promise<Uint8Array>>()
const paletaPorLista = new Map<string, CorDaPaleta[]>()

function pixelsDe(raiz: FileSystemDirectoryHandle, path: string): Promise<Uint8Array> {
  let p = pixelsPorArquivo.get(path)
  if (!p) {
    p = (async () => {
      const i = await infoImagem(raiz, path)
      const img = new Image(); img.src = i.url; await img.decode()
      const c = document.createElement('canvas'); c.width = LADO; c.height = LADO
      const x = c.getContext('2d', { willReadFrequently: true })!
      x.drawImage(img, 0, 0, LADO, LADO)
      const d = x.getImageData(0, 0, LADO, LADO).data
      const out: number[] = []
      for (let k = 0; k < d.length; k += 4) if (d[k + 3] >= 128) out.push(d[k], d[k + 1], d[k + 2])
      return Uint8Array.from(out)
    })().catch(() => new Uint8Array())
    pixelsPorArquivo.set(path, p)
  }
  return p
}

/** A paleta do tema aberto (null enquanto calcula; [] sem papéis/elementos). Só calcula com `ativo`. */
export function usePaletaDoTema(ativo: boolean): CorDaPaleta[] | null {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const raiz = useBiblioteca(s => s.raiz)
  const arquivos = useMemo(() => (tema ? imagensDoTema(tema) : []), [tema])
  const chave = arquivos.slice().sort().join('|')
  const [calc, setCalc] = useState<{ chave: string; cores: CorDaPaleta[] } | null>(null)
  useEffect(() => {
    if (!ativo || !raiz || paletaPorLista.has(chave)) return
    let vivo = true
    void Promise.all(arquivos.slice(0, 40).map(p => pixelsDe(raiz, p))).then(lista => {
      // cada arquivo pesa igual (um papel grande não apaga os elementos)
      const total = lista.reduce((s, l) => s + l.length, 0)
      const junto = new Uint8Array(total); let o = 0
      for (const l of lista) { junto.set(l, o); o += l.length }
      const cores = paletaDePixels(junto)
      paletaPorLista.set(chave, cores)
      if (vivo) setCalc({ chave, cores })
    })
    return () => { vivo = false }
  }, [ativo, raiz, chave]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!arquivos.length) return []
  return paletaPorLista.get(chave) ?? (calc?.chave === chave ? calc.cores : null)
}

/** Seletor de cor com a paleta do tema (o `className` vai no seletor nativo, como antes). */
export default function CorComPaleta({ value, onChange, className, title, ...dados }: { value: string; onChange: (cor: string) => void; className?: string; title?: string } & Record<`data-${string}`, string | boolean | undefined>) {
  const [aberta, setAberta] = useState(false)
  const temTema = useMaeTema(s => !!s.hist)
  const paleta = usePaletaDoTema(aberta)
  useEffect(() => {
    if (!aberta) return
    const fechar = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.('[data-cor-com-paleta]')) setAberta(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberta(false) }
    window.addEventListener('pointerdown', fechar); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', fechar); window.removeEventListener('keydown', esc) }
  }, [aberta])
  const amostra = (c: string, rotulo: string) => (
    <button key={c + rotulo} className={`h-5 w-5 rounded border ${c.toLowerCase() === value.toLowerCase() ? 'border-orange-500 ring-1 ring-orange-400' : 'border-gray-300'}`} style={{ background: c }}
      onClick={() => { onChange(c); setAberta(false) }} title={`${rotulo} ${c.toUpperCase()}`} aria-label={`${rotulo} ${c}`} data-cor-paleta={c} />
  )
  return (
    <span className="relative inline-flex items-center gap-0.5" data-cor-com-paleta>
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className={className} title={title} {...dados} />
      {temTema && <button type="button" className="rounded border border-gray-200 px-0.5 text-[9px] leading-4 text-gray-500 hover:border-orange-400 hover:text-orange-700" onClick={() => setAberta(!aberta)} title="Paleta do tema (os tons dos papéis e elementos)" aria-label="Paleta do tema" data-abrir-paleta>🎨</button>}
      {aberta && (
        <div className="absolute left-0 top-full z-40 mt-1 w-max rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900" data-paleta-cores>
          <p className="mb-1 text-[10px] text-gray-500">Cores do tema <span className="text-gray-400">(escura · cor · clara)</span></p>
          {paleta === null && <p className="text-[10px] text-gray-400">Lendo os papéis…</p>}
          {paleta?.length === 0 && <p className="max-w-[11rem] text-[10px] text-gray-400">Ponha papéis ou elementos no tema e a paleta aparece aqui.</p>}
          {!!paleta?.length && <div className="grid gap-0.5" data-paleta-linhas={paleta.length}>
            {paleta.map(c => <div key={c.cor} className="flex gap-0.5">{amostra(c.escura, 'Mais escura')}{amostra(c.cor, 'Cor')}{amostra(c.clara, 'Mais clara')}</div>)}
          </div>}
        </div>
      )}
    </span>
  )
}
