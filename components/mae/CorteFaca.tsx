'use client'
// Lote 19 (item 236): COMO ESTA BASE É CORTADA — marca de registro (máquina automática) ou FACA (corte e vinco manual).
// Na faca: ajuste fino X/Y (a arte anda na folha, em mm), folha de teste com réguas e "onde a faca cortou em cada lado?".
import { useState } from 'react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import type { DocTrabalho } from '@/lib/mae/schema'
import { linhasDaPrancheta, caixaDoMolde } from '@/lib/mae/exportar/linhas'
import { reguasDaPeca, ajusteDaFaca } from '@/lib/mae/exportar/reguaFaca'
import { gravar } from '@/lib/mae/biblioteca/arquivos'
import { slugArquivo } from '@/lib/mae/exportar/nomes'
import { mensagemDeErro } from '@/lib/mae/erros'
import Deslizador from './Deslizador'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'
type Corte = { modo: 'marca' | 'faca'; faca?: { xMm: number; yMm: number } }
const num = (s: string) => { const v = Number(s.replace(',', '.').trim()); return s.trim() === '' || !Number.isFinite(v) ? null : v }

async function pngBranco(): Promise<Uint8Array> {
  const c = new OffscreenCanvas(8, 8), g = c.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 8, 8)
  return new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer())
}

export default function CorteFaca() {
  const doc = useMaeDoc(s => s.hist.atual) as DocTrabalho & { corte?: Corte }
  const raiz = useBiblioteca(s => s.raiz)
  const corte: Corte = doc.corte ?? { modo: 'marca' }
  const faca = corte.faca ?? { xMm: 0, yMm: 0 }
  const [lido, setLido] = useState({ esq: '', dir: '', topo: '', base: '' })
  const [msg, setMsg] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const mudar = (label: string, c: Corte, juntar?: string) => useMaeDoc.getState().aplicar(label, d => { (d as DocTrabalho & { corte?: Corte }).corte = c }, juntar)

  async function folhaDeTeste() {
    if (!raiz) return
    setGerando(true); setMsg(null)
    try {
      const { montarPdf } = await import('@/lib/mae/exportar/pdf')
      const branco = await pngBranco()
      const paginas = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id && m.faces.length)).map(ab => ({
        larguraMm: ab.widthMm, alturaMm: ab.heightMm,
        arte: { bytes: branco, tipo: 'png' as const, larguraMm: ab.widthMm, alturaMm: ab.heightMm },
        encaixe: { girar: false, diferente: false, dx: faca.xMm, dy: faca.yMm },
        linhas: linhasDaPrancheta(doc, ab.id),
        reguas: doc.molds.filter(m => m.artboardId === ab.id && m.faces.length).map(m => caixaDoMolde(doc, m.id, 0)).filter((c): c is NonNullable<typeof c> => !!c).map(c => reguasDaPeca(c)),
      }))
      if (!paginas.length) { setMsg('A base não tem moldes com faces.'); return }
      const arquivo = `Marcas de registro/Teste/FACA_${slugArquivo(doc.name, 40) || 'base'}.pdf`
      await gravar(raiz, arquivo, new Blob([await montarPdf(paginas, `Teste da faca · ${doc.name}`) as BlobPart], { type: 'application/pdf' }))
      setMsg(`Folha de teste salva: ${arquivo}. Imprima em tamanho real (100%, sem "ajustar à página"), corte com a faca e leia na reguinha onde o corte caiu em cada lado.`)
    } catch (e) { setMsg(`Não deu para gerar a folha de teste: ${mensagemDeErro(e)}`) } finally { setGerando(false) }
  }
  function aplicarLeitura() {
    const a = ajusteDaFaca({ esq: num(lido.esq), dir: num(lido.dir), topo: num(lido.topo), base: num(lido.base) }, faca)
    if (!a) { setMsg('Digite onde a faca cortou em pelo menos um lado.'); return }
    mudar('Ajuste da faca (folha de teste)', { ...corte, modo: 'faca', faca: a })
    setLido({ esq: '', dir: '', topo: '', base: '' })
    setMsg(`Ajuste da faca: a arte anda ${a.xMm.toLocaleString('pt-BR')} mm na horizontal e ${a.yMm.toLocaleString('pt-BR')} mm na vertical. Salve a base e gere a folha de teste de novo para conferir (o corte deve cair no 0).`)
  }
  const campo = (k: keyof typeof lido, rotulo: string) => (
    <label className="flex items-center gap-1">{rotulo}<input value={lido[k]} onChange={e => setLido({ ...lido, [k]: e.target.value })} inputMode="decimal" placeholder="0" className="w-12 rounded border border-gray-200 bg-transparent px-1 text-right dark:border-gray-700" data-leitura-faca={k} /></label>
  )
  return (
    <div className="space-y-1.5 rounded-lg border border-gray-200 p-2 text-[11px] dark:border-gray-700" data-corte-base>
      <p className="font-medium text-gray-700 dark:text-gray-200">Como esta base é cortada?</p>
      <div className="flex flex-wrap gap-1">
        <button className={btn + (corte.modo !== 'faca' ? ' !border-orange-500 bg-orange-50' : '')} onClick={() => mudar('Corte com marca de registro', { ...corte, modo: 'marca' })} data-corte-modo="marca">Com marca de registro (máquina automática)</button>
        <button className={btn + (corte.modo === 'faca' ? ' !border-orange-500 bg-orange-50' : '')} onClick={() => mudar('Corte com faca', { ...corte, modo: 'faca' })} data-corte-modo="faca">Com faca (corte e vinco manual)</button>
      </div>
      {corte.modo === 'faca' && (
        <div className="space-y-1" data-ajuste-faca>
          <p className="text-gray-500">O papel encosta no esquadro. Se o corte sai deslocado, o ajuste fino move a ARTE na folha (vale para kit, pedido e edição em massa). O PDF já tem o tamanho exato da folha: imprima em 100%, sem centralizar.</p>
          <label className="block text-gray-600">X → direita (negativo = esquerda)<Deslizador min={-10} max={10} step={0.05} value={faca.xMm} unidade="mm" fixa casas={2} onChange={e => mudar('Ajuste da faca X', { ...corte, faca: { ...faca, xMm: Number(e.target.value) } }, 'faca:x')} data-faca-x /></label>
          <label className="block text-gray-600">Y ↓ para baixo (negativo = para cima)<Deslizador min={-10} max={10} step={0.05} value={faca.yMm} unidade="mm" fixa casas={2} onChange={e => mudar('Ajuste da faca Y', { ...corte, faca: { ...faca, yMm: Number(e.target.value) } }, 'faca:y')} data-faca-y /></label>
          <button className={btn} disabled={!raiz || gerando} onClick={() => void folhaDeTeste()} data-folha-teste-faca>{gerando ? 'Gerando…' : 'Imprimir folha de teste da faca'}</button>
          <div className="rounded bg-gray-50 p-1.5 dark:bg-gray-800/60">
            <p className="mb-1 font-medium">Onde a faca cortou em cada lado? <span className="font-normal text-gray-500">(o número da reguinha; + = direita/para baixo)</span></p>
            <div className="flex flex-wrap gap-2">{campo('esq', 'Esquerda')}{campo('dir', 'Direita')}{campo('topo', 'Topo')}{campo('base', 'Base')}</div>
            <button className={btn + ' mt-1'} onClick={aplicarLeitura} data-aplicar-leitura-faca>Calcular o ajuste</button>
          </div>
        </div>
      )}
      {msg && <p className={msg.startsWith('Não deu') ? 'text-red-600' : 'text-emerald-700'} data-msg-faca>{msg}</p>}
    </div>
  )
}
