'use client'
// "Gerar PNG (teste do motor)" — Sprint 2. NÃO é a exportação final (essa é a Sprint 9, com sangria,
// marcas de registro e PDF): serve para provar que o motor é DETERMINÍSTICO. Renderiza a folha no
// Worker a 300 dpi, grava em Exportações/AAAA-MM-DD/ e compara com as exportações anteriores da MESMA
// receita (mesmo hash) que estão na pasta: mesmos pixels → "idêntico ✓".
import { useState } from 'react'
import { Cpu, Check, X, Loader2, FileJson } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { gravar, ler, listar, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { hashReceita, DPI_EXPORTACAO } from '@/lib/mae/render'
import { DocTrabalho } from '@/lib/mae/schema'
import { garantirArquivos, motorDaPagina, PX_MM_MAXIMO } from './motorEditor'

const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const doisDig = (n: number) => String(n).padStart(2, '0')

interface Resultado {
  arquivo: string; w: number; h: number; ms: number; viaWorker: boolean; shaPng: string; receita: string
  comparacao: { tipo: 'primeira' } | { tipo: 'igual' | 'diferente'; com: string }
}

/** Exportações anteriores desta receita (qualquer dia), exceto a que acabou de ser gravada. */
async function anteriores(raiz: FileSystemDirectoryHandle, receita8: string, exceto: string): Promise<string[]> {
  const out: string[] = []
  const dias = await listar(raiz, 'Exportações').catch(() => [])
  for (const d of dias) {
    if (d.tipo !== 'pasta') continue
    for (const a of await listar(raiz, `Exportações/${d.nome}`).catch(() => [])) {
      const c = `Exportações/${d.nome}/${a.nome}`
      if (a.tipo === 'arquivo' && a.nome.startsWith(`teste-motor_${receita8}_`) && c !== exceto) out.push(c)
    }
  }
  return out.sort()
}

export default function PainelMotor() {
  const raiz = useBiblioteca(s => s.raiz)
  const liberada = useBiblioteca(s => s.liberada)
  const temCamadas = useMaeDoc(s => !!s.hist.atual.artboards[0]?.layers?.length)
  const [rodando, setRodando] = useState(false)
  const [res, setRes] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function gerar() {
    if (!raiz || !liberada) return
    setRodando(true); setErro(null)
    try {
      const prancheta = useMaeDoc.getState().hist.atual.artboards[0]
      const falta = await garantirArquivos(prancheta, raiz)
      if (falta.length) { setErro(`${falta.length} arquivo(s) da arte não estão na Biblioteca — reconecte a pasta ou troque a imagem.`); return }
      const fundo = '#ffffff'
      const receita = await hashReceita({ prancheta, pxPorMm: PX_MM_MAXIMO, fundo })
      const r = await motorDaPagina().render(prancheta, PX_MM_MAXIMO, fundo, 'png')
      if (!r.png) throw new Error('O motor não devolveu o PNG.')
      const shaPng = await sha256(r.png)
      const agora = new Date()
      const dia = `${agora.getFullYear()}-${doisDig(agora.getMonth() + 1)}-${doisDig(agora.getDate())}`
      const hora = `${doisDig(agora.getHours())}${doisDig(agora.getMinutes())}${doisDig(agora.getSeconds())}`
      const arquivo = `Exportações/${dia}/teste-motor_${receita.slice(0, 8)}_${hora}.png`
      await gravar(raiz, arquivo, r.png)
      const antes = await anteriores(raiz, receita.slice(0, 8), arquivo)
      let comparacao: Resultado['comparacao'] = { tipo: 'primeira' }
      if (antes.length) {
        const ultimo = antes[antes.length - 1]
        const shaAnterior = await sha256(await ler(raiz, ultimo))
        comparacao = { tipo: shaAnterior === shaPng ? 'igual' : 'diferente', com: ultimo.split('/').pop()! }
      }
      setRes({ arquivo, w: r.w, h: r.h, ms: Math.round(r.ms), viaWorker: r.viaWorker, shaPng, receita, comparacao })
    } catch (e) {
      setErro((e as Error)?.message || 'Falhou ao gerar o PNG.')
    } finally { setRodando(false) }
  }

  // Abre no editor a arte gravada pelo "Gravar teste" da Biblioteca (Backups/teste-mae.json).
  async function abrirTeste() {
    if (!raiz || !liberada) return
    setErro(null)
    try {
      const json = JSON.parse(await (await ler(raiz, 'Backups/teste-mae.json')).text())
      const doc = DocTrabalho.parse(json.doc ?? json)
      useMaeDoc.getState().carregar(doc)
    } catch (e) {
      setErro((e as { name?: string })?.name === 'NotFoundError' ? 'Ainda não existe Backups/teste-mae.json — use "Gravar teste" na Biblioteca.' : `Não consegui abrir: ${(e as Error)?.message}`)
    }
  }

  return (
    <section className="space-y-2" data-painel-motor>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Teste do motor</h2>
      <p className="text-xs text-gray-500">Gera a folha em PNG a {DPI_EXPORTACAO} dpi (no computador, sem servidor). Gere duas vezes a mesma arte: os arquivos têm de ser idênticos.</p>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={gerar} disabled={!liberada || !temCamadas || rodando} data-gerar-png>
          {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />} Gerar PNG (teste do motor)
        </button>
        <button className={btn} onClick={abrirTeste} disabled={!liberada} title="Abre Backups/teste-mae.json (gravado pelo &quot;Gravar teste&quot;)" data-abrir-teste>
          <FileJson className="w-3.5 h-3.5" /> Abrir teste no editor
        </button>
      </div>
      {!liberada && <p className="text-[11px] text-gray-400">Conecte a pasta Biblioteca MAE para gerar.</p>}
      {liberada && !temCamadas && <p className="text-[11px] text-gray-400">Adicione ao menos uma camada.</p>}
      {erro && <p className="text-xs text-red-600" data-erro-motor>{erro}</p>}
      {res && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-[11px] space-y-1 text-gray-600 dark:text-gray-300" data-resultado-motor>
          <p className="break-all">Gravado <b>{res.arquivo}</b></p>
          <p>{res.w} × {res.h} px · {res.ms} ms · {res.viaWorker ? 'no Worker' : 'na página (sem Worker)'}</p>
          <p>PNG sha256 <code data-sha-png>{res.shaPng.slice(0, 16)}…</code> · receita <code>{res.receita.slice(0, 8)}</code></p>
          {res.comparacao.tipo === 'primeira' && <p className="text-gray-500" data-comparacao="primeira">Primeira exportação desta receita — gere de novo para comparar.</p>}
          {res.comparacao.tipo === 'igual' && <p className="text-emerald-700 font-semibold flex items-center gap-1" data-comparacao="igual"><Check className="w-3.5 h-3.5" /> idêntico ✓ a {res.comparacao.com}</p>}
          {res.comparacao.tipo === 'diferente' && <p className="text-red-600 font-semibold flex items-center gap-1" data-comparacao="diferente"><X className="w-3.5 h-3.5" /> diferente de {res.comparacao.com}</p>}
        </div>
      )}
    </section>
  )
}
