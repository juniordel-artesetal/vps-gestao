'use client'
'use no memo'
// ABRIR BASE (Lote 3, item 35): a lista das bases salvas — miniatura, nome, nº de moldes, data da última
// edição e quantos temas usam — com Abrir, Duplicar e Excluir (com confirmação). Abrir pergunta antes se a
// base aberta tem alterações (item 30). Excluir só quando nenhum tema usa a base (os temas e os pedidos
// dependem dela); apaga da Biblioteca e da nuvem.
// Lote 18: busca enquanto digita + filtros + ordem (227); mover temas para outra base, excluir com o NOME dos temas e
// lixeira de 30 dias (226).
import { useEffect, useRef, useState } from 'react'
import { paraFolha } from '@/lib/mae/editor/giroMolde'
import { X, FolderOpen, Copy, Trash2, Loader2, Search, ArrowRightLeft, RotateCcw } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { ler } from '@/lib/mae/biblioteca/arquivos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import { listarBases, listarTemas, salvarBase, salvarTema, moverBaseParaLixeira, restaurarBaseLocal } from './arquivosMae'
import { moverTemaParaBase } from '@/lib/mae/vinculo/temaDaBase'
import { mensagemDeErro } from '@/lib/mae/erros'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { sync } from './sincronia'
import { confirmarTroca } from './historicoGlobal'
import { useEditor } from './estado'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
interface Item { path: string; doc: DocTrabalho; quando: number | null; temas: number; listaTemas: DocTema[]; pronta: boolean }
type Filtro = 'todas' | 'caixas' | 'medida' | 'pronta'
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** Miniatura: as linhas das faces de cada prancheta (sem motor; rápido). */
function Miniatura({ doc }: { doc: DocTrabalho }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const abs = doc.artboards.filter(a => doc.molds.some(m => m.artboardId === a.id))
    const lista = abs.length ? abs : doc.artboards.slice(0, 1)
    const gap = 6, W = lista.reduce((s, a) => s + a.widthMm, 0) + gap * (lista.length - 1), H = Math.max(...lista.map(a => a.heightMm))
    const k = Math.min(120 / W, 80 / H)
    c.width = Math.max(1, Math.round(W * k)); c.height = Math.max(1, Math.round(H * k))
    const g = c.getContext('2d')!
    let x0 = 0
    for (const a of lista) {
      g.fillStyle = '#ffffff'; g.fillRect(x0 * k, 0, a.widthMm * k, a.heightMm * k)
      g.strokeStyle = '#cbd5e1'; g.strokeRect(x0 * k + 0.5, 0.5, a.widthMm * k - 1, a.heightMm * k - 1)
      g.strokeStyle = '#ef4444'; g.lineWidth = 1
      for (const m of doc.molds.filter(mm => mm.artboardId === a.id)) for (const f of m.faces) {
        if (f.hole) continue
        g.beginPath()
        ;(f.polygonMm as Pt[]).forEach((p, i) => { const [fx, fy] = paraFolha(m, p); const px = (x0 + fx) * k, py = fy * k; if (i) g.lineTo(px, py); else g.moveTo(px, py) })
        g.closePath(); g.stroke()
      }
      x0 += a.widthMm + gap
    }
  }, [doc])
  return <canvas ref={ref} className="h-20 w-[120px] rounded border border-gray-200 bg-slate-50 object-contain" />
}

export default function AbrirBase() {
  const aberto = useEditor(s => s.pedidoTopo === 'abrir-base')
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const atual = useMaeDoc(s => s.hist.atual.id)
  const [itens, setItens] = useState<Item[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  // Lote 18 (item 227): busca, filtros e ordem
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [ordem, setOrdem] = useState<'recentes' | 'usadas'>('usadas')   // padrão: mais usadas primeiro
  // Lote 18 (item 226): mover temas / excluir com temas / lixeira
  const [mover, setMover] = useState<{ de: Item; marcados: string[]; para: string; excluirDepois: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [lixeira, setLixeira] = useState<{ id: string; nome: string; em: string }[] | null>(null)
  const fechar = () => { useEditor.getState().set({ pedidoTopo: null }); setItens(null); setMsg(null); setMover(null); setLixeira(null) }

  async function carregar() { if (raiz) setItens(await lerItens(raiz)) }
  async function lerItens(raiz: FileSystemDirectoryHandle): Promise<Item[]> {
    const [bs, ts] = await Promise.all([listarBases(raiz), listarTemas(raiz).catch(() => [])])
    const out: Item[] = []
    for (const b of bs) {
      const quando = b.path === '(nuvem)' ? null : await ler(raiz, b.path).then(f => f.lastModified).catch(() => null)
      const listaTemas = ts.filter(t => t.doc.baseId === b.doc.id).map(t => t.doc)
      const pronta = !!(b.doc as { pronto?: unknown }).pronto || listaTemas.some(t => Object.keys(t.pecasProntas ?? {}).length > 0 || Object.keys(t.paginasProntas ?? {}).length > 0)
      out.push({ ...b, quando, temas: new Set(listaTemas.map(t => t.id)).size, listaTemas, pronta })
    }
    return out
  }
  useEffect(() => { if (aberto && raiz && liberada) void lerItens(raiz).then(setItens) }, [aberto, raiz, liberada])
  if (!aberto) return null

  const ehMedida = (d: DocTrabalho) => (d as { tipo?: string }).tipo === 'medida'
  const termo = semAcento(q.trim())
  const visiveis = (itens ?? []).filter(it => {
    if (filtro === 'caixas' && ehMedida(it.doc)) return false
    if (filtro === 'medida' && !ehMedida(it.doc)) return false
    if (filtro === 'pronta' && !it.pronta) return false
    if (!termo) return true
    return semAcento([it.doc.name, ...it.doc.molds.map(m => m.name), ...it.doc.artboards.map(a => a.name ?? '')].join(' ')).includes(termo)
  }).sort((a, b) => ordem === 'usadas' ? b.temas - a.temas || (b.quando ?? 0) - (a.quando ?? 0) : (b.quando ?? 0) - (a.quando ?? 0) || a.doc.name.localeCompare(b.doc.name))

  async function abrir(it: Item) {
    if (!(await confirmarTroca('base'))) return
    useMaeDoc.getState().carregar(it.doc)
    useEditor.getState().set({ modo: 'base', face: null, camada: null, slot: null, prancheta: null })
    fechar()
  }
  async function duplicar(it: Item) {
    if (!raiz) return
    const d: DocTrabalho = { ...JSON.parse(JSON.stringify(it.doc)), id: `base_${Math.random().toString(36).slice(2, 10)}`, version: 1, name: `${it.doc.name} (cópia)`.slice(0, 120) }
    await salvarBase(raiz, d)
    setMsg(`Cópia criada: ${d.name}`); await carregar()
  }
  async function excluir(it: Item) {
    if (!raiz) return
    // Lote 18 (item 226): com temas → mostra QUAIS e as saídas (mover para outra base / excluir os temas e a base)
    if (it.temas > 0) { setMover({ de: it, marcados: it.listaTemas.map(t => t.id), para: '', excluirDepois: true }); return }
    if (!confirm(`Excluir a base "${it.doc.name}"? Ela fica 30 dias na lixeira (dá para restaurar).`)) return
    const r = await sync.excluirBase(it.doc.id)
    if (!r.ok) { setMsg(`Não consegui excluir da nuvem: ${r.erro}. Nada foi apagado.`); return }
    await moverBaseParaLixeira(raiz, it.doc.id).catch(() => 0)
    setMsg(`Base "${it.doc.name}" na lixeira (30 dias).`); await carregar()
  }
  async function moverTemas() {
    if (!raiz || !mover || !itens) return
    const destino = itens.find(x => x.doc.id === mover.para)
    if (!destino) return
    setOcupado(true)
    try {
      const avisos: string[] = []
      let dest = JSON.parse(JSON.stringify(destino.doc)) as DocTrabalho
      const novosTextos: DocTrabalho['textSlots'] = []
      const temas = mover.de.listaTemas.filter(t => mover.marcados.includes(t.id))
      const movidos: DocTema[] = []
      for (const t of temas) {
        const r = moverTemaParaBase(t, mover.de.doc, dest)
        novosTextos.push(...r.textosDoTema)
        if (r.conflitos.length) avisos.push(`${t.name ?? t.id}: ${r.conflitos.join(', ')}`)
        movidos.push({ ...r.tema, version: t.version + 1 })
      }
      // textos que eram só destes temas entram na base destino (versão nova) e os temas apontam para ela
      if (novosTextos.length) {
        dest = { ...dest, version: dest.version + 1, textSlots: [...dest.textSlots, ...novosTextos.filter(n => !dest.textSlots.some(s => s.id === n.id))] }
        await salvarBase(raiz, dest)
      }
      const aberto = useMaeTema.getState().hist?.atual
      for (const t of movidos) {
        if (aberto?.id === t.id) useMaeTema.getState().carregar(null)
        await salvarTema(raiz, { ...t, baseVersion: dest.version })
      }
      let fim = `${temas.length} tema(s) agora na base "${destino.doc.name}".`
      if (mover.excluirDepois && temas.length === mover.de.temas) {
        const r = await sync.excluirBase(mover.de.doc.id)
        if (r.ok) { await moverBaseParaLixeira(raiz, mover.de.doc.id).catch(() => 0); fim += ` A base "${mover.de.doc.name}" foi para a lixeira (30 dias).` }
        else fim += ` A base "${mover.de.doc.name}" não foi excluída: ${r.erro}.`
      }
      setMsg(fim + (avisos.length ? ` Não encaixou: ${avisos.join(' · ')} — confira esses temas.` : ''))
      setMover(null); await carregar()
    } catch (e) { setMsg(`Não deu para mover: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  async function excluirTemasEBase() {
    if (!raiz || !mover) return
    if (!confirm(`Excluir ${mover.de.temas} tema(s) e a base "${mover.de.doc.name}"? Tudo fica 30 dias na lixeira.`)) return
    setOcupado(true)
    try {
      for (const t of mover.de.listaTemas) {
        try { await sync.excluirTema(t.id) } catch (e) { throw new Error(`o tema "${t.name ?? t.id}" está em uso em pedidos/produtos — troque o tema deles em "Ver todos os temas" (${mensagemDeErro(e)})`) }
      }
      const r = await sync.excluirBase(mover.de.doc.id)
      if (!r.ok) throw new Error(r.erro)
      await moverBaseParaLixeira(raiz, mover.de.doc.id).catch(() => 0)
      setMsg(`Temas e base "${mover.de.doc.name}" na lixeira (30 dias).`); setMover(null); await carregar()
    } catch (e) { setMsg(`Não deu: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  async function verLixeira() { setLixeira(await sync.lixeiraBases()) }
  async function restaurar(id: string) {
    if (!raiz) return
    await sync.restaurarBase(id); await restaurarBaseLocal(raiz, id).catch(() => 0)
    setLixeira(l => l?.filter(x => x.id !== id) ?? null); await carregar()
  }

  const chip = (k: Filtro, t: string) => <button key={k} className={`rounded-full border px-2 py-0.5 text-[11px] ${filtro === k ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-600'}`} onClick={() => setFiltro(k)} data-filtro-base={k}>{t}</button>
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" onClick={fechar} data-abrir-base-janela>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold flex items-center gap-1.5"><FolderOpen className="w-4 h-4 text-orange-500" /> Abrir base</p>
          <button className="ml-auto p-1 text-gray-500 hover:text-gray-900" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {!liberada && <p className="text-xs text-gray-500">Conecte a pasta Biblioteca MAE para ver as bases.</p>}
        {liberada && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 focus-within:border-orange-400 dark:border-gray-700">
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, molde ou caixa…" className="min-w-0 flex-1 bg-transparent text-xs outline-none" data-busca-base />
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {chip('todas', 'Todas')}{chip('caixas', 'Caixas')}{chip('medida', 'Peças sob medida')}{chip('pronta', 'Arte pronta')}
              <select value={ordem} onChange={e => setOrdem(e.target.value as 'recentes' | 'usadas')} className="ml-auto rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px] dark:border-gray-700" data-ordem-bases>
                <option value="usadas">Mais usadas</option>
                <option value="recentes">Mais recentes</option>
              </select>
            </div>
          </div>
        )}
        {msg && <p className="text-xs text-amber-700" data-msg-abrir-base>{msg}</p>}
        {mover && (
          <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] dark:bg-amber-950/30" data-mover-temas>
            <p>{mover.excluirDepois ? <>A base <b>{mover.de.doc.name}</b> é usada em <b>{mover.de.temas} tema(s)</b>:</> : <>Mover temas da base <b>{mover.de.doc.name}</b>:</>}</p>
            <div className="max-h-32 space-y-0.5 overflow-y-auto">
              {mover.de.listaTemas.map(t => (
                <label key={t.id} className="flex items-center gap-1.5" data-tema-da-base={t.name ?? t.id}>
                  <input type="checkbox" checked={mover.marcados.includes(t.id)} onChange={e => setMover(m => m && ({ ...m, marcados: e.target.checked ? [...m.marcados, t.id] : m.marcados.filter(x => x !== t.id) }))} />
                  {t.name ?? t.id}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <select value={mover.para} onChange={e => setMover(m => m && ({ ...m, para: e.target.value }))} className="rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] dark:bg-gray-900" data-mover-para>
                <option value="">Mover para a base…</option>
                {(itens ?? []).filter(x => x.doc.id !== mover.de.doc.id).map(x => <option key={x.doc.id} value={x.doc.id}>{x.doc.name}</option>)}
              </select>
              <button className={btn} disabled={!mover.para || !mover.marcados.length || ocupado} onClick={() => void moverTemas()} data-confirmar-mover-temas><ArrowRightLeft className="h-3.5 w-3.5" /> {ocupado ? 'Movendo…' : mover.excluirDepois ? 'Mover e excluir a base' : 'Mover'}</button>
              {mover.excluirDepois && <button className={`${btn} text-red-700`} disabled={ocupado} onClick={() => void excluirTemasEBase()} data-excluir-temas-e-base><Trash2 className="h-3.5 w-3.5" /> Excluir os temas e a base</button>}
              <button className={btn} disabled={ocupado} onClick={() => setMover(null)}>Cancelar</button>
            </div>
            <p className="text-gray-500">As peças, partes, textos e a arte pronta encaixam pelo nome; o que não encaixar aparece no fim.</p>
          </div>
        )}
        {liberada && !itens && <p className="text-xs text-gray-500 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo as bases…</p>}
        {itens && !itens.length && <p className="text-xs text-gray-400">Nenhuma base salva ainda. Monte uma na aba 1. Base e salve (passo Salvar).</p>}
        {itens && itens.length > 0 && !visiveis.length && <p className="text-xs text-gray-400">Nenhuma base com “{q}”{filtro !== 'todas' ? ' neste filtro' : ''}.</p>}
        {visiveis.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800" data-lista-bases-salvas>
            {visiveis.map(it => (
              <li key={`${it.doc.id}:${it.path}`} className="flex items-center gap-3 py-2" data-base-salva={it.doc.name}>
                <Miniatura doc={it.doc} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.doc.name} <span className="text-[11px] font-normal text-gray-400">v{it.doc.version}</span>{it.doc.id === atual && <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-700">aberta</span>}{it.pronta && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] text-violet-700">arte pronta</span>}</p>
                  <p className="text-[11px] text-gray-500">{it.doc.molds.length} molde(s) · {it.quando ? `editada em ${new Date(it.quando).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : 'na nuvem'}{it.temas ? ` · usada em ${it.temas} tema(s)` : ''}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className={`${btn} !border-orange-400 bg-orange-50 text-orange-800`} onClick={() => void abrir(it)} title="Abrir para editar (moldes, faces, partes, textos, identidade, marca)" data-abrir-esta-base><FolderOpen className="w-3.5 h-3.5" /> Abrir</button>
                  <button className={btn} onClick={() => void duplicar(it)} title="Fazer uma cópia com outro nome" data-duplicar-base><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                  {it.temas > 0 && <button className={btn} onClick={() => setMover({ de: it, marcados: it.listaTemas.map(t => t.id), para: '', excluirDepois: false })} title="Mover temas desta base para outra" data-mover-temas-base><ArrowRightLeft className="w-3.5 h-3.5" /></button>}
                  <button className={`${btn} text-red-600 hover:!bg-red-50`} onClick={() => void excluir(it)} title={it.temas ? `Usada em ${it.temas} tema(s) — mostra quais e como resolver` : 'Excluir a base (lixeira 30 dias)'} data-excluir-base><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {liberada && (
          <div className="text-[11px]" data-lixeira-bases>
            {!lixeira ? <button className="text-gray-500 underline" onClick={() => void verLixeira()}>Lixeira das bases</button> : (
              <ul className="space-y-0.5">
                {!lixeira.length && <li className="text-gray-400">Lixeira vazia.</li>}
                {lixeira.map(b => <li key={b.id} className="flex items-center gap-1"><span className="flex-1 truncate">{b.nome} <span className="text-gray-400">· excluída em {new Date(b.em).toLocaleDateString('pt-BR')}</span></span><button className={btn} onClick={() => void restaurar(b.id)} data-restaurar-base={b.nome}><RotateCcw className="h-3 w-3" /> Restaurar</button></li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
