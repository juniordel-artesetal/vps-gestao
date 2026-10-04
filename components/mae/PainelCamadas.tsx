'use client'
'use no memo'
// Painel "Camadas" (Sprint 2) no padrão Photoshop: lista de cima para baixo, olho, cadeado, renomear
// (duplo clique), opacidade, preenchimento, modo de mesclagem, máscara de recorte, grupos.
// Imagens entram na Biblioteca (pasta Elementos/) e a receita guarda só caminho + sha256.
import { useRef, useState } from 'react'
import {
  Eye, EyeOff, Lock, Unlock, ImagePlus, Square, Folder, FolderOpen, Copy, Trash2, ArrowUp, ArrowDown, CornerLeftDown, AlertTriangle, Ungroup, Group,
} from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { listaDoPainel, novaImagem, novaSolida, acharCamada } from '@/lib/mae/editor/camadas'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { MODOS_MESCLAGEM, NOMES_MESCLAGEM, type ModoMesclagem, type NoCamada } from '@/lib/mae/schema'
import { acoes, adicionarCamada, editarCamada } from './acoesCamadas'
import { motorDaPagina } from './motorEditor'
import EditorEfeitos from './EditorEfeitos'
import { EdicaoDoNo } from './PainelEdicao'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40 disabled:hover:border-gray-200'
const ico = 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30'

const num = (s: string) => Number(String(s).replace(',', '.'))
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Campo em mm (texto + teclado decimal — nunca type=number, que muda o valor com a rodinha). */
function CampoMm({ rotulo, valor, onSalvar, desativado }: { rotulo: string; valor: number; onSalvar: (v: number) => void; desativado?: boolean }) {
  const [txt, setTxt] = useState<string | null>(null)
  const salvar = () => { if (txt == null) return; const v = num(txt); if (Number.isFinite(v)) onSalvar(v); setTxt(null) }
  return (
    <label className="flex items-center gap-1 text-[11px] text-gray-500">
      <span className="w-3">{rotulo}</span>
      <input inputMode="decimal" disabled={desativado} value={txt ?? fmt(valor)} onChange={e => setTxt(e.target.value)} onBlur={salvar}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setTxt(null) }}
        className="w-full min-w-0 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs text-gray-900 dark:text-gray-100 disabled:opacity-50" data-campo={rotulo} />
    </label>
  )
}

let seqArrasto = 0
/** Controle deslizante em % que vira UM passo de desfazer por arrasto. */
function Percentual({ rotulo, valor, onMudar, desativado, dado }: { rotulo: string; valor: number; onMudar: (v: number, juntar: string) => void; desativado?: boolean; dado: string }) {
  const arrasto = useRef(0)
  return (
    <label className="block text-[11px] text-gray-500">
      <span className="flex justify-between"><span>{rotulo}</span><span className="tabular-nums">{Math.round(valor * 100)}%</span></span>
      <input type="range" min={0} max={100} step={1} value={Math.round(valor * 100)} disabled={desativado}
        onPointerDown={() => { arrasto.current = ++seqArrasto }}
        onChange={e => onMudar(Number(e.target.value) / 100, `${dado}:${arrasto.current}`)} className="w-full accent-orange-500" data-percentual={dado} />
    </label>
  )
}

export default function PainelCamadas() {
  const camadas = useMaeDoc(s => s.hist.atual.artboards[0]?.layers) ?? []
  const prancheta = useMaeDoc(s => s.hist.atual.artboards[0])
  const selecao = useMaeDoc(s => s.selecao)
  const raiz = useBiblioteca(s => s.raiz)
  const liberada = useBiblioteca(s => s.liberada)
  const [editandoNome, setEditandoNome] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const listaFaltando = useBiblioteca(s => s.faltando)
  const faltando = new Set(listaFaltando)

  const linhas = listaDoPainel(camadas)
  const sel = selecao ? acharCamada(camadas, selecao)?.no ?? null : null
  const setSel = (id: string | null) => useMaeDoc.getState().setSelecao(id)

  async function adicionarImagem() {
    setMsg(null)
    if (!raiz || !liberada) { setMsg('Escolha (ou reconecte) a pasta Biblioteca MAE primeiro — a imagem é guardada lá.'); return }
    try {
      const [h] = await window.showOpenFilePicker({ id: 'mae-imagem', types: [{ description: 'Imagens', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } }] })
      const f = await h.getFile()
      const sha = await sha256(f)
      // guarda em Elementos/ (se já existe outro arquivo com o mesmo nome, acrescenta o começo do hash)
      const ponto = f.name.lastIndexOf('.')
      const base = (ponto > 0 ? f.name.slice(0, ponto) : f.name).replace(/[<>:"|?*\\/]/g, '_').replace(/[. ]+$/, '') || 'imagem'
      const ext = ponto > 0 ? f.name.slice(ponto) : '.png'
      let caminho = `Elementos/${base}${ext}`
      const existente = await ler(raiz, caminho).catch(() => null)
      if (existente && (await sha256(existente)) !== sha) caminho = `Elementos/${base}-${sha.slice(0, 8)}${ext}`
      if (!existente || caminho !== `Elementos/${base}${ext}`) await gravar(raiz, caminho, f)
      const bmp = await createImageBitmap(f)
      const prop = bmp.height / bmp.width; bmp.close()
      await motorDaPagina().enviarBitmap(sha, f)
      // entra centralizada, ocupando 80% da largura da folha (sem passar da altura)
      let wMm = prancheta.widthMm * 0.8, hMm = wMm * prop
      if (hMm > prancheta.heightMm * 0.8) { hMm = prancheta.heightMm * 0.8; wMm = hMm / prop }
      const r = (n: number) => Math.round(n * 100) / 100
      adicionarCamada(novaImagem({ path: caminho, sha256: sha, name: base, xMm: r((prancheta.widthMm - wMm) / 2), yMm: r((prancheta.heightMm - hMm) / 2), wMm: r(wMm), hMm: r(hMm) }), 'Adicionar imagem')
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setMsg((e as Error)?.message || 'Não consegui abrir a imagem.')
    }
  }

  function adicionarSolida() {
    adicionarCamada(novaSolida({ color: '#f4a3c4', xMm: 0, yMm: 0, wMm: prancheta.widthMm, hMm: prancheta.heightMm }), 'Adicionar cor sólida')
  }

  const travada = !!sel?.locked
  const linhaClasse = (no: NoCamada) =>
    `group flex items-center gap-1 rounded-md px-1 py-1 text-xs cursor-pointer select-none ${no.id === selecao ? 'bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'}`

  return (
    <section className="space-y-2" data-painel-camadas>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Camadas</h2>
        <span className="text-[11px] text-gray-400">{linhas.length ? `${linhas.length} na folha` : ''}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={adicionarImagem} title="Imagem do computador (é copiada para Elementos/ na Biblioteca)" data-add-imagem><ImagePlus className="w-3.5 h-3.5" /> Imagem…</button>
        <button className={btn} onClick={adicionarSolida} data-add-solida><Square className="w-3.5 h-3.5" /> Cor sólida</button>
      </div>
      {msg && <p className="text-xs text-red-600 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{msg}</p>}

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-1 max-h-72 overflow-y-auto" data-lista-camadas onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
        {!linhas.length && <p className="text-xs text-gray-400 p-2">Nenhuma camada ainda. Adicione uma imagem ou uma cor sólida.</p>}
        {linhas.map(({ no, profundidade }) => (
          <div key={no.id} className={linhaClasse(no)} style={{ paddingLeft: 4 + profundidade * 14 }} onClick={() => setSel(no.id)} data-camada={no.name} data-camada-id={no.id}>
            <button className={ico} onClick={e => { e.stopPropagation(); acoes.alternarVisivel(no.id) }} title={no.visible ? 'Ocultar' : 'Mostrar'} data-olho>
              {no.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
            </button>
            {no.clip && <CornerLeftDown className="w-3.5 h-3.5 text-orange-500 shrink-0" aria-label="recortada na camada de baixo" />}
            {no.type === 'group' ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                : no.type === 'shape' ? <span className="w-3.5 h-3.5 rounded-sm shrink-0" style={{ background: no.color }} />
              : no.type === 'solid' ? <span className="w-3.5 h-3.5 rounded-sm border border-gray-300 shrink-0" style={{ background: no.color }} />
              : no.type === 'path' ? <span className="text-[10px] font-bold text-gray-500 shrink-0">T</span> : faltando.has(no.src.sha256) ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <ImagePlus className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
            {editandoNome === no.id ? (
              <input autoFocus defaultValue={no.name} className="flex-1 min-w-0 rounded border border-orange-300 bg-transparent px-1 text-xs"
                onBlur={e => { acoes.renomear(no.id, e.target.value); setEditandoNome(null) }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditandoNome(null) }} data-renomear />
            ) : (
              <span className={`flex-1 min-w-0 truncate ${no.visible ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400'}`} onDoubleClick={() => setEditandoNome(no.id)} title="Duplo clique para renomear">
                {no.name}{no.blendMode !== 'normal' && <span className="ml-1 text-[10px] text-gray-400">· {NOMES_MESCLAGEM[no.blendMode]}</span>}
              </span>
            )}
            <button className={ico} onClick={e => { e.stopPropagation(); acoes.alternarTrava(no.id) }} title={no.locked ? 'Destravar' : 'Travar'} data-cadeado>
              {no.locked ? <Lock className="w-3.5 h-3.5 text-gray-600" /> : <Unlock className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100" />}
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        <button className={ico} onClick={() => acoes.subir()} disabled={!sel} title="Subir (Ctrl+])" data-subir><ArrowUp className="w-4 h-4" /></button>
        <button className={ico} onClick={() => acoes.descer()} disabled={!sel} title="Descer (Ctrl+[)" data-descer><ArrowDown className="w-4 h-4" /></button>
        <button className={ico} onClick={() => acoes.agrupar()} disabled={!sel} title="Agrupar (Ctrl+G)" data-agrupar><Group className="w-4 h-4" /></button>
        <button className={ico} onClick={() => acoes.desagrupar()} disabled={sel?.type !== 'group'} title="Desagrupar (Shift+Ctrl+G)" data-desagrupar><Ungroup className="w-4 h-4" /></button>
        <button className={ico} onClick={() => acoes.duplicar()} disabled={!sel} title="Duplicar (Ctrl+J)" data-duplicar><Copy className="w-4 h-4" /></button>
        <button className={ico} onClick={() => acoes.excluir()} disabled={!sel || travada} title="Excluir (Delete)" data-excluir><Trash2 className="w-4 h-4" /></button>
      </div>

      {sel && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-2" data-props>
          {travada && <p className="text-[11px] text-gray-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Camada travada — destrave para editar.</p>}
          <label className="block text-[11px] text-gray-500">Modo de mesclagem
            <select value={sel.blendMode} disabled={travada} onChange={e => editarCamada(sel.id, 'Modo de mesclagem', n => { n.blendMode = e.target.value as ModoMesclagem })}
              className="mt-0.5 w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 py-1 text-xs text-gray-900 dark:text-gray-100" data-mesclagem>
              {MODOS_MESCLAGEM.map(m => <option key={m} value={m}>{NOMES_MESCLAGEM[m]}</option>)}
            </select>
          </label>
          <Percentual rotulo="Opacidade" valor={sel.opacity} desativado={travada} dado="opacidade"
            onMudar={(v, j) => editarCamada(sel.id, 'Opacidade', n => { n.opacity = v }, `${sel.id}:${j}`)} />
          {sel.type !== 'group' && (
            <Percentual rotulo="Preenchimento" valor={sel.fill} desativado={travada} dado="preenchimento"
              onMudar={(v, j) => editarCamada(sel.id, 'Preenchimento', n => { n.fill = v }, `${sel.id}:${j}`)} />
          )}
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={sel.clip} disabled={travada} onChange={() => acoes.alternarRecorte(sel.id)} className="accent-orange-500" data-recorte />
            Máscara de recorte <span className="text-[10px] text-gray-400">(Alt+Ctrl+G)</span>
          </label>
          {sel.type === 'group' && (
            <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-200">
              <input type="checkbox" checked={sel.passThrough} disabled={travada} onChange={() => editarCamada(sel.id, 'Grupo: atravessar', n => { if (n.type === 'group') n.passThrough = !n.passThrough })} className="accent-orange-500" />
              Atravessar <span className="text-[10px] text-gray-400">(mescla com o que está abaixo do grupo)</span>
            </label>
          )}
          {(sel.type === 'image' || sel.type === 'solid') && (
            <div className="grid grid-cols-2 gap-1.5" data-caixa>
              <CampoMm rotulo="X" valor={sel.xMm} desativado={travada} onSalvar={v => editarCamada(sel.id, 'Mover camada', n => { if (n.type === 'image' || n.type === 'solid') n.xMm = v })} />
              <CampoMm rotulo="Y" valor={sel.yMm} desativado={travada} onSalvar={v => editarCamada(sel.id, 'Mover camada', n => { if (n.type === 'image' || n.type === 'solid') n.yMm = v })} />
              <CampoMm rotulo="L" valor={sel.wMm} desativado={travada} onSalvar={v => v > 0 && editarCamada(sel.id, 'Largura da camada', n => { if (n.type === 'image' || n.type === 'solid') n.wMm = v })} />
              <CampoMm rotulo="A" valor={sel.hMm} desativado={travada} onSalvar={v => v > 0 && editarCamada(sel.id, 'Altura da camada', n => { if (n.type === 'image' || n.type === 'solid') n.hMm = v })} />
              <span className="col-span-2 text-[10px] text-gray-400">X, Y, largura e altura em mm (a partir do canto superior esquerdo da folha).</span>
            </div>
          )}
          {sel.type === 'solid' && (
            <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200">Cor
              <input type="color" value={sel.color} disabled={travada} onChange={e => editarCamada(sel.id, 'Cor da camada', n => { if (n.type === 'solid') n.color = e.target.value }, `cor:${sel.id}`)} data-cor />
              <code className="text-[11px] text-gray-500">{sel.color}</code>
            </label>
          )}
          <EditorEfeitos efeitos={sel.effects ?? []} onMudar={(efs, label, j) => editarCamada(sel.id, label, n => { n.effects = efs as never }, j ? `${sel.id}:ef:${j}` : undefined)} />
          <EdicaoDoNo no={sel} onMudar={(label, f, j) => editarCamada(sel.id, label, n => f(n as never), j)} />
          {sel.type === 'image' && <p className="text-[10px] text-gray-400 break-all">Arquivo: {sel.src.path}</p>}
          {sel.type === 'image' && faltando.has(sel.src.sha256) && (
            <p className="text-[11px] text-red-600 flex gap-1" data-nao-encontrado><AlertTriangle className="w-3.5 h-3.5 shrink-0" />Arquivo não encontrado na Biblioteca (foi movido, renomeado ou a pasta não está conectada).</p>
          )}
        </div>
      )}
      {!sel && linhas.length > 0 && <p className="text-[11px] text-gray-400 flex items-center gap-1"><Folder className="w-3 h-3" /> Clique numa camada para editar. Arraste a camada selecionada na folha para mover.</p>}
    </section>
  )
}
