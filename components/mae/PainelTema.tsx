'use client'
'use no memo'
// CRIAR TEMA (Sprint 6 — Vínculo MAE): novo/abrir/salvar, biblioteca de papéis e elementos (arrastar
// para uma PARTE ou para uma face do palco), painel de Partes com miniatura, camadas da parte e o
// "Só nesta caixa" (ajuste local por propriedade, Voltar ao padrão, Desvincular).
import { EditorConjunto, MolduraNaForma } from './PainelConjunto'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { EXEMPLO_CAMPO } from '@/lib/mae/texto/variaveis'
import { ehPecaPorMedida, adaptarParaMedidas } from '@/lib/mae/medidas/pecas'
import { quadroDaFace } from '@/lib/mae/vinculo/enquadramento'
import { usePedidoAberto, salvarAjustePedido } from './pedidosMae'
import Deslizador from './Deslizador'
import { useEffect, useMemo, useRef, useState, Fragment } from 'react'
import { Plus, Save, FolderOpen, X, Eye, EyeOff, ArrowUp, ArrowDown, Trash2, Link2Off, Undo2, ImagePlus, Pin, Layers, Frame, Blend, Copy, Pencil, CopyPlus, FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { novoTema, desvincular, voltarAoPadrao, removerCamadaTema, moverCamadaTema, propriedadesAjustadas, acharCamadaTema, removerCor, ajustarSoNaFace, type ArquivoImagem } from '@/lib/mae/vinculo/tema'
import { miniaturaDaParte, efetiva, ajustesDaFace, type CamadaImagemTema } from '@/lib/mae/vinculo/resolver'
import { acharFace, parteDaFace } from '@/lib/mae/vinculo/partes'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { editarCamadaTema, soltarNaParte, alternarMascaraDeCorte } from './acoesVinculo'
import { guardarImagem, infoImagem, listarBases, listarTemas, listarImagens, salvarBase, salvarTema, infoEmCache, renomearTemaNoDisco } from './arquivosMae'
import { motorDaPagina, garantirArquivos } from './motorEditor'
import { COR_PARTE } from './PainelBase'
import PainelTexto from './PainelTexto'
import EditorEfeitos from './EditorEfeitos'
import { limparEfeitos } from '@/lib/mae/schema/efeitos'
import PainelEdicao, { ModoDoPapel } from './PainelEdicao'
import EditorCaneta from './EditorCaneta'
import PainelTransicao, { EditarTransicao } from './PainelTransicao'
import { EditarMoldura, PainelMolduras } from './PainelMoldura'
import PainelCor from './PainelCor'
import { Secao, useLado } from './Funcoes'
import { confirmarTroca, alterado } from './historicoGlobal'
import { mensagemDeErro } from '@/lib/mae/erros'
import { GruposDoTema } from './PainelGrupos'
import { vizinhasNoMolde, nomeDaFaceNoMolde } from '@/lib/mae/vinculo/cenario'
import { SeletorImagem, MiniaturaArquivo } from './SeletorImagem'
import { opacidadeNasPartes, copiarEstilosParaPartes } from './acoesVinculo'
import { facesSemPapel } from '@/lib/mae/vinculo/partes'
import { TextoSoNestaCaixa as TextoSoNestaCaixaProps } from './PainelTexto'
import { pilhaDaFace, nomeDaCamada } from '@/lib/mae/vinculo/pilha'
import { Lock, Unlock, Type } from 'lucide-react'
import { sync } from './sincronia'
import { NAO_SALVO } from './rascunhos'
import { duplicarCamada, espelharCamada, alternarNaSelecao, alternarGrupo, agruparSelecao, soltarNaOrdem, alternarOlho } from './acoesVinculo'
import { gruposDo, grupoDe, desagruparTema, converterLogoEmElemento, type GrupoTema } from '@/lib/mae/vinculo/gruposTema'
import { compor, inversa } from '@/lib/mae/vinculo/matriz'
import { matrizDoMolde } from '@/lib/mae/editor/giroMolde'
import BuscaTemas, { type TemaBusca } from './BuscaTemas'
import TodosTemas from './TodosTemas'
import { lembrarTemaRecente } from '@/lib/mae/editor/buscaTemas'
import PainelSelecao from './PainelSelecao'

const FORMAS: { kind: 'rect' | 'ellipse' | 'polygon' | 'star' | 'heart' | 'line'; rotulo: string; aspect: number }[] = [
  { kind: 'rect', rotulo: 'Retângulo', aspect: 1.5 }, { kind: 'ellipse', rotulo: 'Elipse', aspect: 1 }, { kind: 'polygon', rotulo: 'Polígono', aspect: 1 },
  { kind: 'star', rotulo: 'Estrela', aspect: 1 }, { kind: 'heart', rotulo: 'Coração', aspect: 1 }, { kind: 'line', rotulo: 'Linha', aspect: 6 },
]

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativoCls = ' !border-orange-500 bg-orange-50 text-orange-800'
const fmt = (n: number, c = 2) => (Math.round(n * 10 ** c) / 10 ** c).toLocaleString('pt-BR')
const aplicarTema = (label: string, f: (t: DocTema) => void) => useMaeTema.getState().aplicar(label, t => f(t as DocTema))
export const TIPO_ARRASTE = 'text/mae-arquivo'
const TIPO_CAMADA = 'text/mae-camada'

// temas abertos por último (a lista "Abrir tema" mostra eles primeiro)
const lembrarRecente = lembrarTemaRecente

/** Miniatura de uma parte, desenhada pelo motor (mesma resolução do vínculo). */
function Miniatura({ tema, partId, A, versao }: { tema: DocTema; partId: string; A: number; versao: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const raiz = useBiblioteca(s => s.raiz)
  const conteudo = tema.partContent[partId]
  // Lote 9 (item 135): a miniatura só depende do conteúdo DESTA parte (antes, qualquer mudança no tema redesenhava
  // todas) e espera a prévia principal (que tem prioridade nos Workers)
  const temaDaParte = useMemo(() => ({ partContent: { [partId]: conteudo ?? [] } }) as unknown as DocTema, [conteudo, partId])
  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => void (async () => {
      const p = miniaturaDaParte(temaDaParte, partId, A, 30)
      await garantirArquivos(p as never, raiz)
      const r = await motorDaPagina().render(p as never, 2.5, '#ffffff', 'bitmap')
      const c = ref.current
      if (!vivo || !c || !r.bitmap) { r.bitmap?.close(); return }
      c.width = r.bitmap.width; c.height = r.bitmap.height
      c.getContext('2d')!.drawImage(r.bitmap, 0, 0); r.bitmap.close()
    })().catch(() => {}), 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [temaDaParte, partId, A, raiz, versao])
  return <canvas ref={ref} className="h-14 w-auto max-w-full rounded border border-gray-200 bg-white" />
}

/** Lote 5 (item 64): nome da pasta do tema (como o Windows aceita). */
const pastaDoTema = (nome: string) => nome.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '') || 'Sem tema'

function Biblioteca({ onUsar, parte }: { onUsar: (a: ArquivoImagem, empilhar: boolean) => void; parte?: { id: string; name: string } }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [pasta, setPasta] = useState<'Papéis' | 'Elementos' | 'Cor'>(() => ({ elementos: 'Elementos', cor: 'Cor' } as const)[useEditor.getState().funcao as 'cor'] ?? 'Papéis')
  const funcao = useEditor(s => s.funcao), lado = useLado()
  // a aba da Biblioteca segue o ícone aberto (Papéis/Elementos/Cor) — ajuste no render, sem efeito
  const [funcaoVista, setFuncaoVista] = useState(funcao)
  if (funcao !== funcaoVista) {
    setFuncaoVista(funcao)
    const p = lado !== 'tudo' && funcao ? ({ papeis: 'Papéis', elementos: 'Elementos', cor: 'Cor' } as const)[funcao as 'papeis'] : undefined
    if (p) setPasta(p)
  }
  // Lote 5 (item 64): cada tema com os SEUS papéis e elementos (Papéis/<Tema>/) + a pasta "Uso geral" (poá,
  // xadrez, glitter…); o resto (outros temas e os soltos) fica em "Buscar em outros temas"
  const nomeTema = useMaeTema(s => s.hist?.atual.name ?? '')
  const pastaTema = `${pasta}/${pastaDoTema(nomeTema)}`, pastaGeral = `${pasta}/Uso geral`
  const [listas, setListas] = useState<{ chave: string; tema: string[]; geral: string[]; outros: string[] } | null>(null)
  const chave = `${pasta}|${pastaTema}`
  const itensTema = listas?.chave === chave ? listas.tema : [], itensGeral = listas?.chave === chave ? listas.geral : [], itensOutros = listas?.chave === chave ? listas.outros : []
  const [outros, setOutros] = useState(false)
  const [, setV] = useState(0)
  useEffect(() => {
    if (!raiz || !liberada || pasta === 'Cor') return
    let vivo = true
    ;(async () => {
      const [t, g, todos] = await Promise.all([listarImagens(raiz, pastaTema), listarImagens(raiz, pastaGeral), listarImagens(raiz, pasta)])
      if (!vivo) return
      const meus = new Set([...t, ...g])
      setListas({ chave, tema: t, geral: g, outros: todos.filter(p => !meus.has(p)) })
      for (const p of [...t, ...g]) { if (!vivo) return; if (!infoEmCache(p)) { await infoImagem(raiz, p).catch(() => null); setV(v => v + 1) } }
    })()
    return () => { vivo = false }
  }, [raiz, liberada, pasta, pastaTema]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!outros || !raiz) return
    let vivo = true
    ;(async () => { for (const p of itensOutros) { if (!vivo) return; if (!infoEmCache(p)) { await infoImagem(raiz, p).catch(() => null); setV(v => v + 1) } } })()
    return () => { vivo = false }
  }, [outros, itensOutros.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const itens = itensTema
  async function adicionar(destino = pastaTema) {
    if (!raiz || pasta === 'Cor') return
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = 'image/png,image/jpeg,image/webp'
    inp.onchange = async () => {
      for (const f of Array.from(inp.files ?? [])) {
        const i = await guardarImagem(raiz, f, destino)
        setListas(l => l && l.chave === chave ? (destino === pastaGeral ? { ...l, geral: [...new Set([...l.geral, i.path])] } : { ...l, tema: [...new Set([...l.tema, i.path])] }) : l)
      }
    }
    inp.click()
  }
  const grade = (lista: string[], vazio: string) => (
    <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto" data-miniaturas>
      {lista.map(p => {
        const i = infoEmCache(p)
        return (
          <button key={p} draggable title={p.split('/').pop()} className="aspect-square rounded border border-gray-200 bg-gray-100 overflow-hidden hover:border-orange-400"
            onDragStart={e => { e.dataTransfer.setData(TIPO_ARRASTE, p); e.dataTransfer.effectAllowed = 'copy' }}
            onDoubleClick={e => i && onUsar(i, e.shiftKey)} data-arquivo={p}>
            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
            {i ? <img src={i.url} alt="" className="w-full h-full object-cover" /> : null}
          </button>
        )
      })}
      {!lista.length && <p className="col-span-4 text-[11px] text-gray-400">{vazio}</p>}
    </div>
  )
  return (
    <div className="space-y-1.5" data-biblioteca-tema>
      <div className="flex items-center gap-1">
        {(['Papéis', 'Elementos', 'Cor'] as const).map(p => <button key={p} className={btn + (pasta === p ? ativoCls : '')} onClick={() => setPasta(p)} data-pasta={p}>{p}</button>)}
        {pasta !== 'Cor' && <button className={btn + ' ml-auto'} disabled={!liberada} onClick={() => void adicionar()} title={`Guarda em ${pastaTema}/`} data-adicionar-arquivo><ImagePlus className="w-3.5 h-3.5" /> Adicionar…</button>}
      </div>
      {pasta === 'Cor' ? (parte ? <PainelCor partId={parte.id} nomeParte={parte.name} /> : <p className="text-[11px] text-gray-400">Escolha uma parte abaixo.</p>) : (<>
      <p className="text-[10px] text-gray-400">Arraste para uma parte (abaixo) ou para uma face na folha. Com <b>Alt</b> na face = só naquela caixa.</p>
      <p className="text-[10px] font-semibold text-gray-600">Deste tema</p>
      {grade(itens, `Nada ainda — "Adicionar…" guarda em ${pastaTema}/.`)}
      <div className="flex items-center gap-1"><p className="text-[10px] font-semibold text-gray-600">Uso geral</p><button className="ml-auto text-[10px] underline text-gray-500" disabled={!liberada} onClick={() => void adicionar(pastaGeral)}>adicionar aqui</button></div>
      {grade(itensGeral, 'Poá, xadrez, glitter, laços… (aparecem em todos os temas).')}
      <button className="text-[10px] underline text-orange-700" onClick={() => setOutros(!outros)} data-buscar-outros>{outros ? 'Esconder os de outros temas' : `Buscar em outros temas (${itensOutros.length})`}</button>
      {outros && grade(itensOutros, 'Nenhum outro arquivo.')}
      </>)}
    </div>
  )
}

/** Proteção contra perda (12/10/2026): as versões salvas na nuvem — abrir uma anterior (vira alteração não salva;
 *  Salvar grava como a versão seguinte, sem apagar nenhuma). */
function VersoesNaNuvem({ tema }: { tema: DocTema }) {
  const [versoes, setVersoes] = useState<{ versao: number; em: string }[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  if (!versoes) return <button className="text-[11px] text-gray-500 underline" onClick={() => { setErro(null); void sync.versoesTema(tema.id).then(setVersoes).catch(() => setErro('Sem conexão com a nuvem agora.')) }} data-versoes-nuvem>Versões salvas na nuvem{erro ? ` — ${erro}` : ''}</button>
  const maior = Math.max(tema.version, ...versoes.map(v => v.versao))
  async function abrir(v: number) {
    if (!(await confirmarTroca('tema'))) return
    const doc = await sync.abrirTema(tema.id, v).catch(() => null)
    if (!doc) { setErro('Não deu para abrir essa versão.'); return }
    useMaeTema.getState().carregar({ ...doc, version: maior + 1 })
    useMaeTema.setState({ marca: NAO_SALVO as never })
    setVersoes(null)
  }
  return (
    <div className="rounded-lg border border-gray-200 p-2 text-[11px] space-y-1" data-lista-versoes>
      <div className="flex items-center"><b className="flex-1">Versões na nuvem</b><button className="text-gray-400" onClick={() => setVersoes(null)} aria-label="Fechar">✕</button></div>
      {!versoes.length && <p className="text-gray-400">Nenhuma versão na nuvem ainda.</p>}
      <ul className="max-h-40 overflow-y-auto space-y-0.5">{versoes.map(v => (
        <li key={v.versao} className="flex items-center gap-1"><span className="flex-1">v{v.versao} · {new Date(v.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <button className="underline text-orange-700" onClick={() => void abrir(v.versao)} data-abrir-versao={v.versao}>abrir</button></li>
      ))}</ul>
      {erro && <p className="text-red-600">{erro}</p>}
    </div>
  )
}

export default function PainelTema() {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const { parteAtiva, face, camada, slot: slotSel } = useEditor()
  // Lote 6 (item 99): no Ajustar da edição em massa o tema fica travado — o Salvar é o do ajuste do pedido
  const emAjuste = usePedidoAberto(s => !!s.ajustar && !!s.pedido)
  // Lote 6 (item 107): aviso "a base mudou" com o atalho para corrigir na Base (girar prancheta continua só na Base)
  const [baseMudou, setBaseMudou] = useState<{ de: number; para: number } | null>(null)
  const ladoTema = useLado(), funcaoTema = useEditor(s => s.funcao)
  const partesSel = useEditor(s => s.partesSel)
  const grupoSel = useEditor(s => s.grupoSel), multiSel = useEditor(s => s.multiSel)
  const juntarOp = useRef('')
  const [opPartes, setOpPartes] = useState(1)
  const set = useEditor.getState().set
  const [nome, setNome] = useState('')
  const [lista, setLista] = useState<{ bases?: { path: string; doc: typeof doc }[]; temas?: { path: string; doc: DocTema }[] } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [versaoMini, setVersaoMini] = useState(0)
  const [caneta, setCaneta] = useState(false)
  // Lote 13 (item 181): a BUSCA RÁPIDA no lugar da lista ("Abrir tema", botão do topo e Ctrl+O) + "Ver todos os temas"
  const [busca, setBusca] = useState<TemaBusca[] | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  async function criar() {
    if (!raiz) return
    if (!doc.molds.length || !doc.parts.some(p => p.instances.length)) { setMsg('Monte a base primeiro (moldes e partes) ou abra uma base salva.'); return }
    // o tema aponta para uma versão SALVA da base. Lote 14 (item 191): criar tema NUNCA cria nem muda a base — só
    // quando ela tem mudança não salva, PERGUNTA antes (antes subia a versão e gravava a base a cada tema novo)
    if (alterado('base')) {
      if (!confirm(`A base "${doc.name}" tem mudanças não salvas. Salvar a base (nova versão) antes de criar o tema?`)) { setMsg('O tema precisa de uma base salva — salve a base (ou desfaça as mudanças) e crie o tema de novo.'); return }
      useMaeDoc.getState().aplicar('Salvar base', d => { d.version = (d.version ?? 0) + 1 })
      await salvarBase(raiz, useMaeDoc.getState().hist.atual)
    }
    const b = useMaeDoc.getState().hist.atual
    useMaeTema.getState().carregar(novoTema({ nome: nome.trim() || 'Novo tema', baseId: b.id, baseVersion: b.version }))
    set({ parteAtiva: doc.parts.find(p => p.instances.length)?.id ?? null, camada: null, face: null })
    setMsg(null)
  }
  async function abrirTema(t: DocTema) {
    if (!raiz) return
    const bases = await listarBases(raiz)
    // Lote 6 (item 107): a versão MAIS NOVA da base (antes pegava o 1º arquivo com o mesmo id — podia ser um antigo)
    const b = bases.filter(x => x.doc.id === t.baseId).sort((x, y) => (y.doc.version ?? 0) - (x.doc.version ?? 0))[0]
    if (!b) { setMsg('A base deste tema não está em Bases/ nesta Biblioteca.'); return }
    const trocaBase = b.doc.id !== doc.id || b.doc.version > doc.version
    if (!(await confirmarTroca('tema', ...(trocaBase ? ['base' as const] : [])))) return
    // mesma base já aberta (mesma versão ou mais nova): fica a aberta — não perde marcas/ajustes não salvos
    if (b.doc.id !== doc.id || b.doc.version > doc.version) useMaeDoc.getState().carregar(b.doc)
    useMaeTema.getState().carregar(t)
    lembrarRecente(t.id)
    setMsg(null)
    setBaseMudou(b.doc.version !== t.baseVersion ? { de: t.baseVersion, para: b.doc.version } : null)
    setLista(null); set({ parteAtiva: b.doc.parts.find(p => p.instances.length)?.id ?? null, camada: null, face: null })
  }
  async function abrirLista() {
    if (!raiz) return
    const ts = await listarTemas(raiz)
    // Lote 13 (item 181): abre a BUSCA RÁPIDA (a lista antiga saiu; gerenciar fica em "Ver todos os temas")
    setBusca(ts.map(t => ({ id: t.doc.id, name: t.doc.name ?? t.doc.id, baseId: t.doc.baseId, arquivado: !!t.doc.arquivado, doc: t.doc })))
  }
  // botões da barra do topo (Lote 3, item 36): "Abrir tema" abre a lista aqui
  const pedidoTopo = useEditor(s => s.pedidoTopo)
  useEffect(() => {
    if (pedidoTopo !== 'abrir-tema' || ladoTema === 'funcoes') return
    useEditor.getState().set({ pedidoTopo: null })
    void abrirLista()
  }, [pedidoTopo]) // eslint-disable-line react-hooks/exhaustive-deps
  // Lote 6 (item 115): renomear (o arquivo salvo muda de nome junto) e "Salvar como…"
  async function renomear(v0: string) {
    const v = v0.trim().slice(0, 120)
    const t = useMaeTema.getState().hist?.atual as DocTema | undefined
    if (!t || !v || v === t.name) return
    const path = raiz ? await renomearTemaNoDisco(raiz, t, v) : null
    aplicarTema('Nome do tema', tt => { tt.name = v })
    // o arquivo já está com o nome novo: a tela continua "salva" se não havia outra mudança
    setMsg(path ? `Tema renomeado: ${v} (${path})` : `Nome do tema: ${v} — vale no próximo Salvar`)
  }
  async function salvarComo() {
    const t = useMaeTema.getState().hist?.atual as DocTema | undefined
    if (!raiz || !t) return
    const v = prompt('Salvar como — nome do novo tema:', `${t.name ?? 'Tema'} (cópia)`)?.trim().slice(0, 120)
    if (!v) return
    const copia: DocTema = { ...JSON.parse(JSON.stringify(t)), id: `th_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, version: 1, name: v }
    let path: string
    try { path = await salvarTema(raiz, copia) } catch (e) { setMsg(`Não deu para salvar: ${mensagemDeErro(e)}`); return }
    useMaeTema.getState().carregar(copia); set({ camada: null, face: null })
    setMsg(`Salvo como "${v}" (${path}) — você está editando a cópia`)
  }
  async function salvar() {
    if (!raiz || !tema) return
    // Lote 16 (item 203): o tema passa a apontar para a versão da base em que foi editado (antes ficava na v1 para
    // sempre — o painel dizia "v1" com a base na v3 e a edição em massa podia abrir a base antiga)
    const baseAberta = useMaeDoc.getState().hist.atual
    useMaeTema.getState().aplicar('Salvar tema', t => {
      t.version += 1
      if (baseAberta.id === t.baseId && baseAberta.version > 0) t.baseVersion = baseAberta.version
      // Lote 6 (item 93): campos da base sem exemplo no tema (SOBRENOME, SÉRIE, TURNO…) → ganham um (e viram coluna)
      const fixos = new Set(['NOME', 'IDADE', 'HASHTAG', 'SUFIXO', 'NOME_IDADE', 'ARROBA'])
      for (const v of new Set(useMaeDoc.getState().hist.atual.textSlots.map(s => s.variable))) if (!fixos.has(v) && (t as DocTema).sample?.[v] === undefined) (t as DocTema).sample = { ...(t as DocTema).sample, [v]: EXEMPLO_CAMPO[v] ?? v }
    })
    let path: string
    try { path = await salvarTema(raiz, useMaeTema.getState().hist!.atual) } catch (e) {
      // Lote 16 (item 203): não salvou → a versão volta (antes cada clique que falhava subia +1) e o motivo aparece
      useMaeTema.getState().desfazer()
      setMsg(`Não deu para salvar o tema: ${mensagemDeErro(e)}`)
      return
    }
    setBaseMudou(null)
    // Lote 5 (item 58): as posições dos textos (Colocar em todas, Duplicar, + NOME…) ficam na BASE — salvar o
    // tema sem a base deixava a edição em massa com o nome numa caixa só
    const baseAlterada = alterado('base')
    if (baseAlterada) await salvarBase(raiz, useMaeDoc.getState().hist.atual)
    setMsg(`Tema salvo em ${path} (versão ${useMaeTema.getState().hist!.atual.version})${baseAlterada ? ' · base atualizada' : ''}`)
  }

  // Lote 13 (item 181): a busca rápida no lugar da lista + a grade "Ver todos os temas"
  const blocoBusca = busca ? (
    <div className="space-y-1" data-bloco-busca-temas>
      <BuscaTemas temas={busca} autoFocus aberto baseAtual={doc.molds.length ? { id: doc.id, nome: doc.name } : null} valor={tema?.id ?? null}
        onEscolher={id => { const t = busca.find(x => x.id === id)?.doc; if (t) { setBusca(null); void abrirTema(t) } }}
        onVerTodos={() => setVerTodos(true)} />
    </div>
  ) : null
  const modalTodos = verTodos ? <TodosTemas baseAtual={doc.molds.length ? { id: doc.id, nome: doc.name } : null} onFechar={() => { setVerTodos(false); setBusca(null) }} onAbrir={t => { setVerTodos(false); setBusca(null); void abrirTema(t) }} /> : null
  if (!tema && ladoTema === 'funcoes' && ['pronto', 'loja'].includes(funcaoTema ?? '')) return null
  if (!tema && ladoTema === 'funcoes') return <p className="text-xs text-gray-500" data-sem-tema-funcao>Abra ou crie um tema no painel da direita para usar esta função.</p>
  if (!tema) {
    return (
      <section className="space-y-2" data-painel-tema>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tema</h2>
        <p className="text-[11px] text-gray-500">Um tema veste a base: papéis e elementos por PARTE, que se replicam em todas as faces dela.</p>
        <label className="block text-xs">Nome do novo tema
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="ex.: Stitch Angel" className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1" data-nome-tema />
        </label>
        <p className="text-[11px] text-gray-500">Base: <b>{doc.name}</b> ({doc.molds.length} moldes, {doc.parts.filter(p => p.instances.length).length} partes)</p>
        <div className="flex flex-wrap gap-1.5">
          <button className={btn + ' !border-orange-400 bg-orange-50 text-orange-800'} disabled={!liberada} onClick={criar} data-novo-tema><Plus className="w-3.5 h-3.5" /> Novo tema nesta base</button>
          <button className={btn} disabled={!liberada} onClick={async () => setLista({ bases: raiz ? await listarBases(raiz) : [] })}><FolderOpen className="w-3.5 h-3.5" /> Outra base…</button>
          <button className={btn} disabled={!liberada} onClick={() => void abrirLista()} data-abrir-tema><FolderOpen className="w-3.5 h-3.5" /> Abrir tema…</button>
        </div>
        {lista?.bases && <ul className="text-xs space-y-0.5">{lista.bases.map(b => <li key={b.path}><button className="underline" onClick={async () => { if (!(await confirmarTroca('base'))) return; useMaeDoc.getState().carregar(b.doc); setLista(null) }}>{b.doc.name} (v{b.doc.version})</button></li>)}{!lista.bases.length && <li className="text-gray-400">Nenhuma base em Bases/.</li>}</ul>}
        {blocoBusca}{modalTodos}
        {msg && <p className="text-[11px] text-red-600">{msg}</p>}
      </section>
    )
  }

  const partes = doc.parts.filter(p => p.instances.length)
  const parte = partes.find(p => p.id === parteAtiva) ?? partes[0]
  const faceDaParte = face && parte && parteDaFace(doc, face)?.id === parte.id ? face : null
  const camadas = (parte ? tema.partContent[parte.id] ?? [] : []) as CamadaImagemTema[]
  const achada = camada ? acharCamadaTema(tema, camada) : null
  const sel = achada?.c ?? null
  const aj = faceDaParte && sel && !achada?.faceId ? ajustesDaFace(tema, faceDaParte)[sel.id] : undefined
  const ef = sel ? efetiva(sel, aj) : null
  // Lote 14 (item 195): conjunto de aplique selecionado → o painel mostra só o que é dele
  const ehConjunto = (sel as { type?: string } | null)?.type === 'conjunto', conjuntoSelecionado = ehConjunto
  const ajustadas = faceDaParte && sel && !achada?.faceId ? propriedadesAjustadas(tema, faceDaParte, sel.id) : []
  const t = ef?.transform ?? { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 }
  const rotuloFace = (f: string) => { const a = acharFace(doc, f); return a ? `${a.molde.name} · ${f.split('_').pop()}` : f }
  const semPapel = facesSemPapel(doc, tema).map(rotuloFace)
  /** Lote 6 (item 81): um texto (NOME, IDADE…) na lista de camadas — clicar seleciona (move/ajusta na arte). */
  // Lote 8 (item 123): olho (ocultar) e cadeado (travar) também no texto — só nesta caixa (textSlotAdjust)
  const ajusteTexto = (id: string, label: string, f: (a: NonNullable<DocTema['textSlotAdjust']>[string]) => void) =>
    aplicarTema(label, tt => { const x = tt as DocTema; x.textSlotAdjust ??= {}; f((x.textSlotAdjust[id] ??= {})) })
  const gruposDaParte = parte ? gruposDo(tema).filter(g => g.parte === parte.id) : []
  /** Lote 9 (item 142): cada texto com "logo" vira elemento (no lugar em que a logo é desenhada hoje) + texto, agrupados. */
  function converterLogos() {
    const logos = useEditor.getState().logosTexto
    const feitas: string[] = []
    aplicarTema('Converter a logo do nome em elemento + texto agrupados', tt => {
      for (const [variavel, st] of Object.entries(tt.textStyles ?? {})) {
        const f = (st as { fundo?: { tipo?: string; imagem?: { path: string; sha256?: string; aspect: number } } }).fundo
        if (f?.tipo !== 'imagem' || !f.imagem) continue
        const slots = doc.textSlots.filter(x => x.variable === variavel || (variavel === 'NOME' && x.variable === 'NOME_IDADE'))
        const achada = logos.find(l => slots.some(x => x.id === l.slotId))
        const slot = achada ? doc.textSlots.find(x => x.id === achada.slotId) : null
        const af = slot ? acharFace(doc, slot.faceId) : null
        if (!achada || !slot || !af) continue
        const naFolha = achada.matrix
        const noMolde = compor(inversa(matrizDoMolde(af.molde)), naFolha)
        const img = f.imagem
        if (converterLogoEmElemento(doc, tt, { variavel: slot.variable, m: af.molde, faceId: slot.faceId, logo: noMolde, imagem: img })) feitas.push(slot.variable === 'NOME_IDADE' ? 'Nome + idade' : slot.variable)
      }
    })
    setMsg(feitas.length ? `Convertido: ${feitas.join(', ')} — a logo virou elemento (no mesmo lugar) e ficou agrupada com o texto. Confira na arte.` : 'Não achei a logo desenhada — abra a caixa onde ela aparece e tente de novo.')
  }
  const linhaTexto = (id: string, variavel: string, faceId: string) => {
    const aj = tema.textSlotAdjust?.[id] ?? {}
    return (
      <li key={`t:${id}`} className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs cursor-pointer ${slotSel === id ? 'bg-orange-50 ring-1 ring-orange-300' : multiSel.some(x => x.tipo === 'texto' && x.id === id) ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`}
        onClick={e => { if (e.ctrlKey || e.metaKey) { alternarNaSelecao({ tipo: 'texto', id }); return } set({ slot: id, face: faceId, camada: null, grupoSel: null, multiSel: [] }) }} data-camada-texto={variavel}
        // Lote 10 (itens 151/152): texto também arrasta na ordem e tem o menu do botão direito
        draggable onDragStart={e => { e.dataTransfer.setData(TIPO_CAMADA, `t:${id}`); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => { if (e.dataTransfer.types.includes(TIPO_CAMADA)) e.preventDefault() }}
        onDrop={e => { const de = e.dataTransfer.getData(TIPO_CAMADA); if (!de || de === `t:${id}`) return; e.preventDefault(); soltarNaOrdem(de, `t:${id}`, faceId) }}
        onContextMenu={e => { e.preventDefault(); set({ slot: id, face: faceId, camada: null, menuCamada: { x: e.clientX, y: e.clientY, camada: '', texto: id } }) }}>
        {grupoDe(tema, { variavel, parte: doc.parts.find(p => p.instances.some(i => i.faceId === faceId))?.id }) && <span className="h-3 w-1 rounded bg-violet-400" title="Está num grupo" />}
        <button className="p-0.5" data-olho-texto title={aj.hidden ? 'Mostrar' : 'Ocultar'} onClick={e => { e.stopPropagation(); ajusteTexto(id, aj.hidden ? `Mostrar ${variavel}` : `Ocultar ${variavel}`, a => { if (a.hidden) delete a.hidden; else a.hidden = true }) }}>{aj.hidden ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}</button>
        <Type className="w-3.5 h-3.5 text-violet-600" /><span className={`flex-1 truncate font-medium ${aj.hidden ? 'text-gray-400 line-through' : ''}`}>{variavel === 'NOME_IDADE' ? 'Nome + idade' : variavel}</span>
        <button className="p-0.5" data-cadeado-texto title={aj.locked ? 'Destravar' : 'Travar (não se seleciona, não se move e não se exclui na arte)'} onClick={e => { e.stopPropagation(); ajusteTexto(id, aj.locked ? `Destravar ${variavel}` : `Travar ${variavel}`, a => { if (a.locked) delete a.locked; else a.locked = true }) }}>
          {aj.locked ? <Lock className="w-3 h-3 text-gray-600" /> : <Unlock className="w-3 h-3 text-gray-300" />}
        </button>
        <span className="text-[9px] uppercase text-gray-400">texto</span>
      </li>
    )
  }
  /** Lote 8 (item 124): a logo/faixa atrás do texto aparece em Camadas, junto dele — clicar seleciona o texto (a edição da
   *  logo fica no painel Texto, com a área do nome). */
  const linhaFundo = (id: string, variavel: string, faceId: string) => {
    const f = estiloDaVariavel(tema.textStyles, variavel).fundo
    if (!f) return null
    return (
      <li key={`tf:${id}`} className="ml-4 flex items-center gap-1 rounded px-1 py-0.5 text-[11px] text-gray-600 cursor-pointer hover:bg-gray-50" onClick={() => set({ slot: id, face: faceId, camada: null })} data-camada-fundo-texto={variavel}>
        <span className="text-orange-500 -ml-3 w-3">↳</span>{f.tipo === 'imagem' ? 'Logo' : 'Faixa'} atrás do {variavel === 'NOME_IDADE' ? 'Nome + idade' : variavel}
      </li>
    )
  }
  /** Lote 9 (item 142): o GRUPO como pasta — clicar seleciona (move/gira/redimensiona na arte); olho, cadeado, desagrupar. */
  const linhaGrupo = (g: GrupoTema) => {
    const nomes = [...g.textos.map(v => (v === 'NOME_IDADE' ? 'Nome + idade' : v)), ...g.camadas.map(id => { const a = acharCamadaTema(tema, id); return a ? nomeDaCamada(a.c as never) : null }).filter(Boolean)]
    const faceDoGrupo = faceDaParte ?? doc.parts.find(p => p.id === g.parte)?.instances[0]?.faceId ?? null
    return (
      <li key={`g:${g.id}`} className={`rounded px-1 py-0.5 text-xs cursor-pointer ${grupoSel === g.id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`}
        onClick={() => set({ grupoSel: g.id, face: faceDoGrupo, camada: null, slot: null, multiSel: [] })} data-camada-grupo={g.nome}>
        <div className="flex items-center gap-1">
          <button className="p-0.5" data-olho-grupo title={g.visible === false ? 'Mostrar o grupo' : 'Ocultar o grupo'} onClick={e => { e.stopPropagation(); alternarGrupo(g.id, 'visible') }}>{g.visible === false ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}</button>
          <FolderOpen className="w-3.5 h-3.5 text-violet-600" />
          <span className={`flex-1 truncate font-medium ${g.visible === false ? 'text-gray-400 line-through' : ''}`} onDoubleClick={e => { e.stopPropagation(); const v = prompt('Nome do grupo:', g.nome); if (v?.trim()) aplicarTema('Nome do grupo', tt => { const x = gruposDo(tt).find(y => y.id === g.id); if (x) x.nome = v.trim().slice(0, 80) }) }} title="Duplo clique: renomear">{g.nome}</span>
          <button className="p-0.5" data-cadeado-grupo title={g.locked ? 'Destravar o grupo' : 'Travar o grupo'} onClick={e => { e.stopPropagation(); alternarGrupo(g.id, 'locked') }}>{g.locked ? <Lock className="w-3 h-3 text-gray-600" /> : <Unlock className="w-3 h-3 text-gray-300" />}</button>
          <button className="rounded px-1 text-[10px] text-gray-500 hover:text-violet-700" title="Desagrupar (Ctrl+Shift+G)" onClick={e => { e.stopPropagation(); aplicarTema('Desagrupar', tt => desagruparTema(tt, g.id)); set({ grupoSel: null }) }} data-desagrupar>desagrupar</button>
        </div>
        <p className="ml-6 truncate text-[10px] text-gray-500">{nomes.join(' · ')}</p>
      </li>
    )
  }
  const linhaCamada = (c: CamadaImagemTema, exclusiva: boolean) => {
    const local = faceDaParte && !exclusiva && propriedadesAjustadas(tema, faceDaParte, c.id).length > 0
    return (
      <li key={c.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs cursor-pointer ${camada === c.id ? 'bg-orange-50 ring-1 ring-orange-300' : multiSel.some(x => x.tipo === 'camada' && x.id === c.id) ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'} ${(c as { recortada?: boolean }).recortada ? 'ml-4' : ''}`}
        onClick={e => { if (e.altKey) { alternarMascaraDeCorte(c.id); return } if (e.ctrlKey || e.metaKey) { alternarNaSelecao({ tipo: 'camada', id: c.id }); return } set({ camada: c.id, slot: null, grupoSel: null, multiSel: [] }) }}
        // Lote 6 (item 81): arrastar na lista muda a ordem; clique direito abre o menu (frente/trás/topo/fundo)
        draggable onDragStart={e => { e.dataTransfer.setData(TIPO_CAMADA, c.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => { if (e.dataTransfer.types.includes(TIPO_CAMADA)) e.preventDefault() }}
        onDrop={e => { const de = e.dataTransfer.getData(TIPO_CAMADA); if (!de || de === c.id) return; e.preventDefault(); soltarNaOrdem(de, c.id, faceDaParte ?? null) }}
        onContextMenu={e => { e.preventDefault(); set({ camada: c.id, slot: null, menuCamada: { x: e.clientX, y: e.clientY, camada: c.id } }) }}
        title="Clique: selecionar · Arrastar: mudar a ordem · Botão direito: frente/trás · Alt + clique: máscara de corte" data-camada-tema={c.name ?? nomeDaCamada(c as never)} data-recortada={(c as { recortada?: boolean }).recortada ? 1 : undefined}>
        {(c as { recortada?: boolean }).recortada && <span className="text-orange-500 -ml-3 w-3" title="Máscara de corte: aparece só dentro da camada de baixo">↳</span>}
        {grupoDe(tema, { camada: c.id }) && <span className="h-3 w-1 rounded bg-violet-400" title="Está num grupo" />}
        <button className="p-0.5" data-olho-tema onClick={e => { e.stopPropagation(); alternarOlho({ camada: c.id }) }}>{c.visible === false ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5" />}</button>
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
        {infoEmCache(c.path) && <img src={infoEmCache(c.path)!.url} alt="" className="w-5 h-5 rounded object-cover border border-gray-200" />}
        {(c as { type: string }).type === 'solid' && <span className="w-5 h-5 rounded border border-gray-200" style={{ background: (c as unknown as { color: string }).color }} />}
        {(c as { type: string }).type === 'frame' && <span className="w-5 h-5 rounded border-2 border-dashed border-gray-400" />}
        {(c as { type: string }).type === 'shape' && <span className="w-5 h-5 rounded-full border border-gray-200" style={{ background: (c as unknown as { fill?: string | null }).fill ?? 'transparent' }} />}
        {/* Lote 10 (item 159): oculta SÓ nesta caixa — nome riscado + rótulo (antes não dava para saber) */}
        {(() => { const oc = !!faceDaParte && !exclusiva && ajustesDaFace(tema, faceDaParte)[c.id]?.visible === false
          return <><span className={`flex-1 truncate ${oc ? 'line-through text-gray-400' : ''}`}>{nomeDaCamada(c as never)}</span>{oc && <span className="rounded bg-gray-100 px-1 text-[9px] text-gray-500" data-oculta-nesta-caixa>oculta nesta caixa</span>}</> })()}
        <button className="p-0.5" title={(c as { locked?: boolean }).locked ? 'Destravar' : 'Travar (não se seleciona nem se move na arte)'} data-cadeado-tema onClick={e => { e.stopPropagation(); aplicarTema((c as { locked?: boolean }).locked ? 'Destravar camada' : 'Travar camada', tt => { const a = acharCamadaTema(tt, c.id); if (!a) return; const x = a.c as { locked?: boolean }; if (x.locked) delete x.locked; else x.locked = true }) }}>
          {(c as { locked?: boolean }).locked ? <Lock className="w-3 h-3 text-gray-600" /> : <Unlock className="w-3 h-3 text-gray-300" />}
        </button>
        {(c.type === 'image' || c.type === 'shape') && c.anchor !== 'paper' && (
          <button className={`rounded px-0.5 text-[9px] font-bold ${c.applique?.enabled ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-orange-500'}`} title={c.applique?.enabled ? 'É aplique 3D — clique para tirar' : 'Marcar como aplique 3D'}
            onClick={e => { e.stopPropagation(); aplicarTema(c.applique?.enabled ? 'Tirar aplique 3D' : 'Marcar como aplique 3D', tt => { const a = acharCamadaTema(tt, c.id); if (!a || (a.c.type !== 'image' && a.c.type !== 'shape')) return; if (a.c.applique?.enabled) delete a.c.applique; else a.c.applique = { ...(a.c.applique ?? {}), enabled: true } }) }}
            data-aplique-lista={c.name}>3D</button>
        )}
        <span className="text-[9px] uppercase text-gray-400">{c.anchor === 'paper' ? 'papel' : 'face'}</span>
        {local && <span title="Tem ajuste só nesta caixa" data-icone-local><Pin className="w-3 h-3 text-orange-500" /></span>}
        {exclusiva && <span title="Só desta caixa"><Link2Off className="w-3 h-3 text-gray-500" /></span>}
      </li>
    )
  }

  return (
    <section className="space-y-2" data-painel-tema data-tema-aberto>
      {ladoTema !== 'funcoes' && <>
      <div className="flex items-center gap-1">
        <input defaultValue={tema.name} key={`${tema.id}:${tema.name}`} onBlur={e => void renomear(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} title="Nome do tema — clique para renomear" className="flex-1 min-w-0 rounded border border-transparent hover:border-gray-200 bg-transparent px-1 text-sm font-semibold" data-nome-tema-aberto />
        {/* Lote 6 (item 115): renomear à vista e "Salvar como…" (cópia com outro nome) */}
        <button className={btn} title="Renomear o tema" onClick={() => { const v = prompt('Novo nome do tema:', tema.name ?? ''); if (v !== null) void renomear(v) }} data-renomear-tema><Pencil className="w-3.5 h-3.5" /></button>
        <button className={btn} disabled={!liberada} title="Salvar como… — guarda uma cópia com outro nome e continua nela (o tema original fica como estava salvo)" onClick={() => void salvarComo()} data-salvar-como-tema>Salvar como…</button>
        {emAjuste
          ? <button className={btn + ' !border-orange-500 text-orange-800'} onClick={() => void salvarAjustePedido()} data-salvar-ajuste-tema><Save className="w-3.5 h-3.5" /> Salvar ajuste do pedido</button>
          : <button className={btn} onClick={salvar} disabled={!liberada} data-salvar-tema><Save className="w-3.5 h-3.5" /> Salvar</button>}
        <button className={btn} disabled={!liberada} title="Cria uma cópia deste tema com tudo (papéis, elementos, textos e estilos)" onClick={async () => {
          if (!raiz || !(await confirmarTroca('tema'))) return
          const copia: DocTema = { ...JSON.parse(JSON.stringify(tema)), id: `th_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`, version: 1, name: `${tema.name ?? 'Tema'} (cópia)`.slice(0, 120) }
          await salvarTema(raiz, copia)
          useMaeTema.getState().carregar(copia); set({ camada: null, face: null }); setMsg(`Tema duplicado: ${copia.name}`)
        }} data-duplicar-tema><Copy className="w-3.5 h-3.5" /></button>
        <button className={btn} onClick={async () => { if (!(await confirmarTroca('tema'))) return; useMaeTema.getState().carregar(null); set({ camada: null, face: null }) }} title="Fechar o tema" data-fechar-tema><X className="w-3.5 h-3.5" /></button>
      </div>
      <VersoesNaNuvem tema={tema} />
      {/* Lote 9 (item 142): temas que ainda usam a "logo atrás do nome" (opção que saiu) — converter em elemento + texto */}
      {Object.entries(tema.textStyles ?? {}).some(([, st]) => (st as { fundo?: { tipo?: string } }).fundo?.tipo === 'imagem') && (
        <div className="rounded-lg border border-violet-300 bg-violet-50 px-2 py-1.5 text-[11px] flex flex-wrap items-center gap-1.5" data-aviso-logo-fundo>
          <span className="flex-1">Este tema usa <b>logo no fundo do texto</b>. Agora a logo é um <b>elemento</b> com o nome por cima, <b>agrupados</b> (aparece em Camadas, aceita várias áreas e o “Sem fundo” funciona).</span>
          <button className={btn + ' !border-violet-500'} onClick={() => converterLogos()} data-converter-logo>Converter</button>
        </div>
      )}
      {baseMudou && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-[11px] flex flex-wrap items-center gap-1.5" data-aviso-base-mudou>
          <span className="flex-1">A base mudou (v{baseMudou.de} → v{baseMudou.para}): confira as faces e as pranchetas.</span>
          <button className={btn + ' !border-amber-500'} onClick={() => { set({ modo: 'base', passo: 2, funcao: 'passo-2' }); setBaseMudou(null) }} data-corrigir-na-base>Corrigir na Base</button>
          <button className="text-gray-400" onClick={() => setBaseMudou(null)} aria-label="Fechar o aviso">×</button>
        </div>
      )}
      {/* Lote 8 (item 133): "Abrir tema" com um tema aberto — a lista aparece aqui (antes só com o tema fechado) */}
      {blocoBusca}{modalTodos}
      {/* Lote 5 (item 72): base de portfólio — quais grupos este tema gera ("Sereia · Kit Festa"…) */}
      {!conjuntoSelecionado && <GruposDoTema />}
      {/* Lote 13 (item 183): a versão sem nome deste tema (o botão "Pedido sem nome" na edição em massa usa) */}
      {!conjuntoSelecionado && <VersaoSemNome />}
      <p className="text-[10px] text-gray-400">Base: {doc.name} v{tema.baseVersion}</p>
      {msg && <p className={`text-[11px] ${msg.startsWith('Não deu') ? 'text-red-600' : 'text-emerald-700'}`} data-msg-tema>{msg}</p>}
      {semPapel.length > 0 && <p className="text-[11px] text-amber-700" title={semPapel.join(', ')} data-faces-sem-papel={semPapel.length}>⚠️ {semPapel.length === 1 ? '1 face nova sem papel' : `${semPapel.length} faces sem papel`}: {semPapel.slice(0, 4).join(', ')}{semPapel.length > 4 ? '…' : ''}</p>}
      </>}

      <Secao ids={['papeis', 'elementos', 'cor']}><Biblioteca onUsar={(a, empilhar) => parte && soltarNaParte(parte.id, a, empilhar)} parte={parte ? { id: parte.id, name: parte.name } : undefined} /></Secao>
      {/* Lote 5 (item 63): o papel das abas é do TEMA (antes ficava na Base e todos os temas herdavam) */}
      <Secao ids={['papeis']}><AbasDoTema /></Secao>

      <Secao ids={['partes', 'papeis', 'elementos', 'cor', 'moldurinha', 'transicao', 'formas']}>
      {partesSel.length > 1 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50/70 dark:bg-orange-950/30 p-2 space-y-1.5 text-xs" data-partes-selecionadas={partesSel.length}>
          <p className="font-semibold">{partesSel.length} partes selecionadas <span className="font-normal text-gray-500">({partesSel.map(id => doc.parts.find(x => x.id === id)?.name).join(', ')})</span></p>
          <p className="text-[10px] text-gray-500">Papel, elemento, cor, moldurinha (e preset) e transição escolhidos agora vão para todas. Depois, cada parte continua editável sozinha.</p>
          <label className="block text-[11px] text-gray-500">Opacidade de todas as camadas
            <Deslizador min={0} max={1} step={0.01} value={opPartes} unidade="%" fator={100} onPointerDown={() => { juntarOp.current = `opn:${Date.now()}` }} onChange={e => { const v = Number(e.target.value); setOpPartes(v); opacidadeNasPartes(partesSel, v, juntarOp.current) }} data-opacidade-partes />
          </label>
          <div className="flex flex-wrap gap-1">
            {sel && <button className={btn} onClick={() => { const n = copiarEstilosParaPartes(sel.id, partesSel); setMsg(n ? `Estilos copiados para ${n} camada(s).` : 'Nenhuma camada do mesmo tipo nas outras partes.') }} title="Os estilos (traçado, sombra, brilho…) da camada selecionada vão para as camadas do mesmo tipo das outras partes" data-copiar-estilos>Copiar estilos da camada</button>}
            <button className={btn} onClick={() => set({ partesSel: [] })} data-limpar-partes>Só uma parte</button>
          </div>
        </div>
      )}
      <div>
        <h3 className="text-xs font-semibold flex items-center gap-1 mb-1"><Layers className="w-3.5 h-3.5" /> Partes</h3>
        <div className="grid grid-cols-2 gap-1.5" data-partes-tema>
          {partes.map((p, ip) => {
            // Lote 17 (item 209): base de peças sob medida — as partes agrupadas por PEÇA (Corpo · …, Tampa · …)
            const pecaDe = (x: typeof p) => doc.tipo === 'medida' ? doc.molds.find(m => m.faces.some(f => f.id === x.instances[0]?.faceId)) : undefined
            const peca = pecaDe(p), titulo = peca && (ip === 0 || pecaDe(partes[ip - 1])?.id !== peca.id) && !(doc as { partesCompartilhadas?: boolean }).partesCompartilhadas
            return (
            <Fragment key={p.id}>
            {titulo && <p className="col-span-2 mt-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800" data-grupo-partes-peca={peca.name}>{peca.name}</p>}
            <div className={`rounded-lg border p-1 cursor-pointer ${parte?.id === p.id || partesSel.includes(p.id) ? 'border-orange-400 bg-orange-50/60' : 'border-gray-200 hover:border-orange-300'} ${partesSel.includes(p.id) ? 'ring-2 ring-orange-300' : ''}`}
              title="Clique para escolher; Ctrl + clique para selecionar várias partes"
              onClick={e => {
                // Lote 3 (item 34): Ctrl/⌘ + clique soma ou tira a parte da seleção
                if (e.ctrlKey || e.metaKey) {
                  const atual = partesSel.length ? partesSel : parte ? [parte.id] : []
                  const nova = atual.includes(p.id) ? atual.filter(x => x !== p.id) : [...atual, p.id]
                  set({ partesSel: nova.length > 1 ? nova : [], parteAtiva: nova.includes(p.id) ? p.id : nova[0] ?? p.id, camada: null })
                } else set({ parteAtiva: p.id, camada: null, partesSel: [], escopo: 'parte', face: null })   // Lote 5 (item 69): parte no painel = todas as caixas
              }}
              onDragOver={e => { if (e.dataTransfer.types.includes(TIPO_ARRASTE)) e.preventDefault() }}
              onDrop={async e => { const path = e.dataTransfer.getData(TIPO_ARRASTE); if (!path || !raiz) return; e.preventDefault(); const i = await infoImagem(raiz, path).catch(() => null); if (!i) { setMsg('Não deu para ler esse arquivo da Biblioteca.'); return } set({ escopo: 'parte', face: null }); soltarNaParte(p.id, i, e.shiftKey); set({ parteAtiva: p.id }); setVersaoMini(v => v + 1) }}
              data-parte-tema={p.name}>
              <Miniatura tema={tema} partId={p.id} A={p.referenceAspect ?? 1} versao={versaoMini} />
              <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: COR_PARTE[doc.parts.indexOf(p) % COR_PARTE.length] }} />
                <b className="truncate">{p.name}</b><span className="ml-auto text-gray-400">{p.instances.length} faces · {(tema.partContent[p.id] ?? []).length} cam.</span>
                {/* Lote 6 (item 83): tirar a cor sólida da parte (volta o papel que estava antes dela) */}
                {(tema.partContent[p.id] ?? []).some(c => c.type === 'solid' && (c.anchor ?? 'face') === 'paper') && (
                  <button className="p-0.5 text-gray-400 hover:text-red-600" title="Remover cor (volta o papel que estava antes)" onClick={e => { e.stopPropagation(); aplicarTema(`Remover cor de ${p.name}`, tt => { removerCor(tt, { partId: p.id }) }); setVersaoMini(v => v + 1) }} data-remover-cor={p.name}><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            </div>
            </Fragment>
            )
          })}
        </div>
      </div>
      </Secao>

      {parte && (
        <>
        {/* Lote 4 (item 45): cada ícone abre o painel da SUA função (antes Moldurinha e Transição abriam o de Camadas) */}
        <Secao ids={['moldurinha']}>
          <div className="space-y-1" data-secao-moldurinha>
            <h3 className="text-xs font-semibold flex items-center gap-1"><Frame className="w-3.5 h-3.5" /> Moldurinha em {parte.name}</h3>
            <PainelMolduras partId={parte.id} camadaSel={camada} onSelecionar={id => set({ camada: id })} />
            <p className="text-[10px] text-gray-500">Só numa caixa: clique na caixa na folha e escolha “Só nesta caixa” no painel da direita.</p>
          </div>
        </Secao>
        <Secao ids={['transicao']}>
          <div className="space-y-1" data-secao-transicao>
            <h3 className="text-xs font-semibold flex items-center gap-1"><Blend className="w-3.5 h-3.5" /> Transição em {parte.name}</h3>
            {camadas.length > 0
              ? <PainelTransicao key={parte.id} partId={parte.id} sempreAberto onCriada={() => setVersaoMini(v => v + 1)} />
              : <p className="text-[11px] text-gray-400">A transição precisa de um papel na parte — arraste um papel para a miniatura de {parte.name} primeiro.</p>}
            {camadas.filter(c => (c as { transition?: unknown }).transition).map(c => <button key={c.id} className={btn} onClick={() => set({ camada: c.id })} data-transicao-da-parte>{(c as { name?: string }).name ?? 'Transição'} — editar</button>)}
          </div>
        </Secao>
        <Secao ids={['partes']}>
        <div className="space-y-1" data-camadas-parte>
          {/* Lote 6 (item 81): TODAS as camadas — textos, apliques, elementos, formas, moldurinha e papéis — de cima para baixo */}
          {faceDaParte ? (<>
            <h3 className="text-xs font-semibold">Camadas desta caixa <span className="font-normal text-gray-400">({rotuloFace(faceDaParte)})</span></h3>
            {gruposDaParte.length > 0 && <ul className="space-y-0.5" data-grupos-caixa>{gruposDaParte.map(linhaGrupo)}</ul>}
            <ul className="space-y-0.5" data-pilha-caixa>{pilhaDaFace(doc, tema, faceDaParte).map(it => it.tipo === 'texto'
              ? <Fragment key={`tt:${it.id}`}>{linhaTexto(it.id, it.variavel, faceDaParte)}{linhaFundo(it.id, it.variavel, faceDaParte)}</Fragment>
              : linhaCamada(it.camada as CamadaImagemTema, it.caixa))}</ul>
          </>) : (<>
            <h3 className="text-xs font-semibold">Camadas de {parte.name} <span className="font-normal text-gray-400">(todas as {parte.instances.length} faces)</span></h3>
            {gruposDaParte.length > 0 && <ul className="space-y-0.5" data-grupos-parte>{gruposDaParte.map(linhaGrupo)}</ul>}
            <ul className="space-y-0.5" data-pilha-parte>
              {[...new Map(doc.textSlots.filter(s => parte.instances.some(i => i.faceId === s.faceId)).map(s => [s.variable, s])).values()].map(s => <Fragment key={`tt:${s.id}`}>{linhaTexto(s.id, s.variable, s.faceId)}{linhaFundo(s.id, s.variable, s.faceId)}</Fragment>)}
              {[...camadas].reverse().map(c => linhaCamada(c, false))}
            </ul>
          </>)}
          {!camadas.length && <p className="text-[11px] text-gray-400">Arraste um papel para a miniatura de {parte.name}.</p>}
          {/* Lote 9 (item 142): Ctrl + clique (aqui) ou Shift + clique (na arte) soma itens; Ctrl+G agrupa */}
          {multiSel.length >= 2
            ? <button className={btn + ' w-full justify-center !border-violet-400 text-violet-800'} onClick={() => agruparSelecao()} data-agrupar>Agrupar {multiSel.length} itens (Ctrl+G)</button>
            : <p className="text-[10px] text-gray-400">Para agrupar (logo + nome, por exemplo): Ctrl + clique nos itens desta lista, ou Shift + clique na arte, e Ctrl+G.</p>}
          {/* Lote 6 (item 92): monte a arte na MAIOR medida e recomponha nas outras (sem esticar) */}
          {doc.molds.some(ehPecaPorMedida) && (
            <button className={btn + ' w-full justify-center !border-orange-400 text-orange-800'} onClick={() => {
              let n = 0
              aplicarTema('Adaptar para as outras medidas', tt => { n = adaptarParaMedidas(doc as never, tt, fid => { const af = acharFace(doc, fid); const pt = parteDaFace(doc, fid); const inst = pt?.instances.find(i => i.faceId === fid); return af ? quadroDaFace(af.face.polygonMm as never, inst?.fit, pt?.referenceAspect ?? 1) : null }) })
              setMsg(n ? `${n} camada(s) adaptadas: nas outras medidas a arte fica presa no mesmo lado, no tamanho proporcional à altura. Retoque "só nesta medida" clicando na peça.` : 'Nada a adaptar (as camadas já estão presas ou não há elementos).')
            }} data-adaptar-medidas>Adaptar para as outras medidas</button>
          )}
          {camadas.length > 0 && <p className="text-[10px] text-gray-400">Clique para selecionar · arraste para mudar a ordem · botão direito: trazer para frente / enviar para trás. Na arte, Alt + clique pega a camada de baixo.</p>}
        </div>
        </Secao>
        <Secao ids={['formas']}>
        <div className="space-y-1">
          <h3 className="text-xs font-semibold">Formas em {parte.name}</h3>
          <div className="flex flex-wrap items-center gap-1 pt-0.5" data-formas>
            <span className="text-[10px] text-gray-400">+ Forma:</span>
            {FORMAS.map(f => (
              <button key={f.kind} className={btn + ' !px-1.5 !py-0.5 !text-[10px]'} onClick={() => aplicarTema(`Forma: ${f.rotulo}`, tt => {
                const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
                ;(tt.partContent[parte.id] ??= []).push({ id, type: 'shape', name: f.rotulo, kind: f.kind, params: { radius: f.kind === 'rect' ? 0.15 : 0, sides: f.kind === 'star' ? 5 : 6, inner: 0.45 }, fill: f.kind === 'line' ? null : '#f472b6', stroke: f.kind === 'line' ? { color: '#1f2937', widthMm: 0.8 } : null, aspect: f.aspect, anchor: 'face', transform: { x: 0.5, y: 0.5, scale: 0.4, rotationDeg: 0 } } as never)
                set({ camada: id })
              })} data-nova-forma={f.kind}>{f.rotulo}</button>
            ))}
            <button className={btn + ' !px-1.5 !py-0.5 !text-[10px]'} onClick={() => setCaneta(true)} data-abrir-caneta>Caneta</button>
          </div>
          {caneta && <EditorCaneta partId={parte.id} A={parte.referenceAspect ?? 1} onFechar={() => setCaneta(false)} />}
        </div>
        </Secao>
        </>
      )}

      {/* Lote 14 (item 196): vários objetos selecionados — o painel do que é comum a todos */}
      <Secao props><PainelSelecao /></Secao>
      {sel && ef && (
        <Secao props>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-camada-sel>
          {/* Lote 4 (item 29): papel → "Preencher · Repetir (padrão)" logo no topo */}
          <ModoDoPapel camadaId={sel.id} />
          {/* Lote 8 (item 126): DIREITA = o selecionado, SÓ NESTA CAIXA (a caixa clicada na arte); o conjunto da parte é
              editado sem caixa selecionada (painel da esquerda / "Editar todas as caixas") — sem o seletor duplicado */}
          {faceDaParte && !achada?.faceId && (
            <p className="flex flex-wrap items-center gap-1 text-[11px]" data-escopo>
              <span className="rounded bg-amber-100 text-amber-900 px-1.5">Só nesta caixa: {rotuloFace(faceDaParte)}</span>
              <button className="text-gray-500 underline" onClick={() => set({ face: null, escopo: 'parte' })} data-editar-todas>Editar todas as caixas ({parte?.name})</button>
            </p>
          )}
          {faceDaParte && !ehConjunto && <CenarioSoNestaCaixa faceId={faceDaParte} />}
          <p className="text-[10px] text-gray-400">Mover: arraste na arte · setas = ajuste fino (Shift = maior).</p>
          {/* Lote 14 (item 195): com o CONJUNTO selecionado, só as configurações dele (o tamanho fica no editor do conjunto, em mm) */}
          {!ehConjunto && <label className="block text-[11px] text-gray-500">
            <span className="flex justify-between"><span>Escala {ajustadas.includes('transform.scale') && <Pin className="inline w-3 h-3 text-orange-500" />}</span></span>
            <Deslizador min={0.05} max={3} step={0.01} value={t.scale} onChange={e => editarCamadaTema(sel.id, { transform: { scale: Number(e.target.value) } }, 'Escala', `esc:${sel.id}`, faceDaParte ? 'face' : 'parte')} unidade="%" fator={100} data-transf="scale" />
          </label>}
          <label className="block text-[11px] text-gray-500">
            <span className="flex justify-between"><span>Rotação {ajustadas.includes('transform.rotationDeg') && <Pin className="inline w-3 h-3 text-orange-500" />}</span></span>
            <Deslizador min={-180} max={180} step={1} value={t.rotationDeg} onChange={e => editarCamadaTema(sel.id, { transform: { rotationDeg: Number(e.target.value) } }, 'Girar', `rot:${sel.id}`, faceDaParte ? 'face' : 'parte')} unidade="°" data-transf="rot" />
          </label>
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => editarCamadaTema(sel.id, { visible: ef.visible === false }, ef.visible === false ? 'Mostrar' : 'Ocultar', undefined, faceDaParte ? 'face' : 'parte')} data-visivel>{ef.visible === false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} {ef.visible === false ? 'Mostrar' : 'Ocultar'}</button>
            <button className={btn} data-subir-camada-tema onClick={() => aplicarTema('Subir camada', tt => moverCamadaTema(tt, sel.id, 1))}><ArrowUp className="w-3.5 h-3.5" /></button>
            <button className={btn} data-descer-camada-tema onClick={() => aplicarTema('Descer camada', tt => moverCamadaTema(tt, sel.id, -1))}><ArrowDown className="w-3.5 h-3.5" /></button>
            {/* Lote 9 (itens 137/138): duplicar e espelhar (os mesmos do botão direito e dos atalhos) */}
            <button className={btn} onClick={() => duplicarCamada(sel.id)} title="Duplicar (Ctrl+J)" data-duplicar-camada-tema><CopyPlus className="w-3.5 h-3.5" /></button>
            {(ef as { anchor?: string }).anchor !== 'paper' && <>
              <button className={btn + ((ef.transform as { flipX?: boolean } | undefined)?.flipX ? ' !border-orange-500' : '')} onClick={() => espelharCamada(sel.id, 'x')} title="Espelhar na horizontal (Shift+H)" data-espelhar="x"><FlipHorizontal2 className="w-3.5 h-3.5" /></button>
              <button className={btn + ((ef.transform as { flipY?: boolean } | undefined)?.flipY ? ' !border-orange-500' : '')} onClick={() => espelharCamada(sel.id, 'y')} title="Espelhar na vertical (Shift+V)" data-espelhar="y"><FlipVertical2 className="w-3.5 h-3.5" /></button>
            </>}
            <button className={btn} onClick={() => { aplicarTema('Excluir camada', tt => removerCamadaTema(tt, sel.id)); set({ camada: null }) }} data-excluir-camada-tema><Trash2 className="w-3.5 h-3.5" /></button>
            {faceDaParte && !achada?.faceId && <button className={btn} onClick={() => aplicarTema('Desvincular (só nesta caixa)', tt => { const id = desvincular(tt, faceDaParte, sel.id, ef); set({ camada: id }) })} title="A camada vira exclusiva desta caixa" data-desvincular><Link2Off className="w-3.5 h-3.5" /> Desvincular</button>}
          </div>
          {ajustadas.length > 0 && faceDaParte && (
            <div className="rounded border border-orange-200 p-1.5 space-y-1" data-ajustes-locais>
              <p className="text-[11px] text-orange-800 flex items-center gap-1"><Pin className="w-3 h-3" /> Ajustado só nesta caixa:</p>
              <ul className="flex flex-wrap gap-1">
                {ajustadas.map(p => <li key={p}><button className="rounded border border-orange-200 bg-white px-1.5 py-0.5 text-[11px]" onClick={() => aplicarTema(`Voltar ao padrão: ${p}`, tt => voltarAoPadrao(tt, faceDaParte, sel.id, p))} data-voltar={p}><Undo2 className="inline w-3 h-3" /> {ROTULO_PROP[p] ?? p}</button></li>)}
                <li><button className="rounded border border-orange-300 bg-orange-100 px-1.5 py-0.5 text-[11px]" onClick={() => aplicarTema('Voltar ao padrão (tudo)', tt => voltarAoPadrao(tt, faceDaParte, sel.id))} data-voltar-tudo>Voltar tudo ao padrão</button></li>
              </ul>
            </div>
          )}
          <p className="text-[10px] text-gray-400">Âncora: {sel.anchor === 'paper' ? 'papel (acompanha o papel)' : 'face (posição em % da face)'} · {fmt(ef.aspect ?? 1)} de proporção</p>
          {(sel.anchor ?? 'face') !== 'paper' && (doc.molds.some(ehPecaPorMedida) || !!(sel as { presa?: unknown }).presa) && (() => {
            const pr = (sel as { presa?: { h: 'esq' | 'centro' | 'dir'; v: 'topo' | 'meio' | 'base'; refW: number; refH: number } }).presa
            const mudarPresa = (p: Partial<NonNullable<typeof pr>> | null) => aplicarTema('Presa em', tt => { const a = acharCamadaTema(tt, sel.id); if (!a) return; const x = a.c as { presa?: unknown }; if (p === null) delete x.presa; else x.presa = { ...(pr ?? { h: 'centro', v: 'meio', refW: 90, refH: 50 }), ...p } })
            return (
              <div className="rounded border border-gray-200 dark:border-gray-700 p-1.5 space-y-1 text-[11px]" data-presa-em>
                <p className="font-semibold">Presa em <span className="font-normal text-gray-400">(nas outras medidas)</span></p>
                <div className="flex flex-wrap gap-1">{(['esq', 'centro', 'dir'] as const).map(h => <button key={h} className={btn + ' !py-0.5' + (pr?.h === h ? ativoCls : '')} onClick={() => mudarPresa({ h })} data-presa-h={h}>{h === 'esq' ? 'Esquerda' : h === 'dir' ? 'Direita' : 'Centro'}</button>)}
                  {pr && <button className={btn + ' !py-0.5'} onClick={() => mudarPresa(null)} title="Volta a acompanhar a peça (estica junto)">soltar</button>}</div>
              </div>
            )
          })()}
          {sel.transition && <EditarTransicao layerId={sel.id} tr={sel.transition} />}
          {(sel as { type: string }).type === 'frame' && <EditarMoldura layerId={sel.id} />}
          {/* Lote 10 (itens 157/158): conjunto de aplique (as peças) e moldurinha numa forma */}
          {(sel as { type: string }).type === 'conjunto' && <EditorConjunto camadaId={sel.id} />}
          {(sel as { type: string }).type === 'shape' && <MolduraNaForma camadaId={sel.id} />}
          {/* Lote 6 (item 105): aplique 3D → aqui só posição, tamanho, giro e ordem */}
          {(sel.type === 'image' || sel.type === 'shape') && sel.applique?.enabled ? <PainelEdicao camadaId={sel.id} soAplique /> : ehConjunto ? null : <>
          {/* Lote 9 (item 141): os estilos seguem o modo do topo — caixa clicada = SÓ NESTA CAIXA (ajuste local); sem caixa =
              todas as caixas da parte. O título diz onde vai valer (antes dizia "todas as caixas" mesmo editando só a MILK). */}
          {(() => {
            const soNaCaixa = !!faceDaParte && !achada?.faceId
            const efs = limparEfeitos(soNaCaixa ? (ef as { effects?: unknown }).effects : sel.effects)
            const ondeVale = soNaCaixa ? `só na ${rotuloFace(faceDaParte!)}` : achada?.faceId ? 'só nesta caixa' : `em todas as ${parte?.name ?? 'caixas'}`
            return (
              <EditorEfeitos key={`efs:${sel.id}:${soNaCaixa ? faceDaParte : 'parte'}`} efeitos={efs} titulo={`Estilos da camada — ${ondeVale}`}
                onMudar={(novos, label, j) => soNaCaixa
                  ? useMaeTema.getState().aplicar(`${label} (só nesta caixa)`, tt => { ajustarSoNaFace(tt as DocTema, faceDaParte!, sel.id, { effects: novos } as never) }, j ? `efc:${sel.id}:${faceDaParte}:${j}` : undefined)
                  : useMaeTema.getState().aplicar(label, tt => { const a = acharCamadaTema(tt as DocTema, sel.id); if (!a) return; a.c.effects = novos as never; const x = a.c as { efeitosRef?: number; transform?: { scale?: number } }; if (x.efeitosRef !== undefined) x.efeitosRef = x.transform?.scale ?? 1 }, j ? `efc:${sel.id}:${j}` : undefined)} />
            )
          })()}
          {/* Lote 14 (item 197): redimensionar o objeto escala os estilos (contorno, sombra, brilho, traço) — ou espessura fixa */}
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600" title="Ligado: ao aumentar/diminuir o objeto, contorno, sombra, brilho e traço acompanham (como o Dimensionar estilos do Photoshop)."><input type="checkbox" className="accent-orange-500" checked={(sel as { escalarEstilos?: boolean }).escalarEstilos !== false} onChange={e => aplicarTema(e.target.checked ? 'Escalar estilos junto' : 'Estilos com espessura fixa', tt => { const a = acharCamadaTema(tt as DocTema, sel.id); if (!a) return; const x = a.c as { escalarEstilos?: boolean; efeitosRef?: number }; if (e.target.checked) delete x.escalarEstilos; else { x.escalarEstilos = false; delete x.efeitosRef } })} data-escalar-estilos /> Escalar estilos junto</label>
          <PainelEdicao camadaId={sel.id} faceAlvo={faceDaParte} />
          </>}
        </div>
        </Secao>
      )}
      <Secao ids={['texto']}><PainelTexto /></Secao>
      <Secao props><TextoSoNestaCaixaProps /></Secao>
      <Secao ids={['partes']}><p className="text-[10px] text-gray-400">Dica: clique numa caixa na folha para editar “só nesta caixa”; clique fora para editar todas.</p></Secao>
      {!sel && <Secao props><p className="text-[11px] text-gray-400" data-sem-selecao>Clique numa camada (na lista ou na folha) para ver as propriedades dela aqui.</p></Secao>}
    </section>
  )
}

const ROTULO_PROP: Record<string, string> = { 'transform.x': 'posição ↔', 'transform.y': 'posição ↕', 'transform.scale': 'escala', 'transform.rotationDeg': 'rotação', visible: 'visível', path: 'imagem', opacity: 'opacidade', repeat: 'padrão do papel', effects: 'estilos', 'transform.flipX': 'espelho ↔', 'transform.flipY': 'espelho ↕', 'transform.scaleY': 'altura', 'transform.skewXDeg': 'inclinação' }

/** Lote 5 (item 63): o papel das ABAS (faces sem parte) — do tema: papel da face vizinha (padrão), um papel ou uma cor. */
export function AbasDoTema() {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const doc = useMaeDoc(s => s.hist.atual)
  const [escolher, setEscolher] = useState(false)
  if (!tema) return null
  const modo = tema.overflowFill ? 'papel' : tema.abasCor ? 'cor' : doc.smartArt?.flapFill ? 'base' : 'vizinha'
  const set = (label: string, f: (t: DocTema) => void) => useMaeTema.getState().aplicar(label, t => f(t as DocTema))
  const b = (on: boolean) => `${btn}${on ? ativoCls : ''}`
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1" data-abas-tema>
      <p className="text-[11px] font-semibold">Abas (faces sem parte)</p>
      <div className="flex flex-wrap gap-1">
        <button className={b(modo === 'vizinha')} onClick={() => set('Abas com o papel da face vizinha', t => { delete t.overflowFill; delete t.abasCor })} data-abas="vizinha">Papel da face vizinha</button>
        <button className={b(modo === 'papel')} onClick={() => setEscolher(!escolher)} data-abas="papel">{tema.overflowFill ? <MiniaturaArquivo path={tema.overflowFill.path} className="h-4 w-4" /> : null} Um papel…</button>
        <label className={b(modo === 'cor') + ' cursor-pointer'} data-abas="cor">Cor <input type="color" value={tema.abasCor ?? '#ffffff'} onChange={e => set('Cor das abas', t => { delete t.overflowFill; t.abasCor = e.target.value })} className="h-4 w-6" /></label>
      </div>
      {modo === 'base' && <p className="text-[10px] text-amber-700">Esta base ainda tem um papel das abas antigo (vale para todos os temas dela) — escolha aqui o deste tema.</p>}
      {escolher && <SeletorImagem pastas={['Papéis']} atual={tema.overflowFill?.path} onEscolher={a => { set('Papel das abas', t => { delete t.abasCor; t.overflowFill = { path: a.path, sha256: a.sha256, aspect: a.aspect } }); setEscolher(false) }} />}
    </div>
  )
}

/** Lote 5 (item 66): juntar esta face com vizinhas num cenário contínuo SÓ NESTA CAIXA (tema). */
function CenarioSoNestaCaixa({ faceId }: { faceId: string }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const m = doc.molds.find(mm => mm.faces.some(f => f.id === faceId))
  if (!tema || !m) return null
  const viz = vizinhasNoMolde(m, faceId)
  if (!viz.length) return null
  const grupo = tema.cenarios?.find(g => g.includes(faceId)) ?? null
  const nome = (id: string) => nomeDaFaceNoMolde(doc, id)
  const mudar = (outra: string, juntar: boolean) => useMaeTema.getState().aplicar(juntar ? 'Juntar como cenário contínuo (só nesta caixa)' : 'Separar faces', t => {
    const tt = t as DocTema
    const resto = (tt.cenarios ?? []).filter(g => !g.includes(faceId) && !g.includes(outra))
    const atual = new Set([...(tt.cenarios ?? []).filter(g => g.includes(faceId) || g.includes(outra)).flat(), faceId])
    if (juntar) atual.add(outra); else atual.delete(outra)
    tt.cenarios = atual.size > 1 ? [...resto, [...atual]] : resto
    if (!tt.cenarios.length) delete tt.cenarios
  })
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 text-[11px] space-y-0.5" data-cenario-caixa>
      <p className="font-semibold">Cenário contínuo (só nesta caixa)</p>
      {viz.map(v => <label key={v} className="flex items-center gap-1.5" onMouseEnter={() => useEditor.getState().set({ realce: v })} onMouseLeave={() => useEditor.getState().set({ realce: null })}><input type="checkbox" className="accent-orange-500" checked={!!grupo?.includes(v)} onChange={e => mudar(v, e.target.checked)} data-juntar-face={v} /> juntar com {nome(v)}</label>)}
      <p className="text-[10px] text-gray-400">A arte atravessa a dobra; a moldurinha contorna o cenário inteiro (ou cada face: opção da moldurinha).</p>
    </div>
  )
}

/** Lote 13 (item 183): "Versão sem nome" — o tema que entra quando o pedido vem sem nome (logo no lugar do nome). */
function VersaoSemNome() {
  const tema = useMaeTema(s => s.hist?.atual ?? null) as DocTema | null
  const raiz = useBiblioteca(s => s.raiz)
  const [temas, setTemas] = useState<TemaBusca[] | null>(null)
  if (!tema) return null
  const carregar = () => { if (!temas && raiz) void listarTemas(raiz).then(l => setTemas(l.filter(t => t.doc.id !== tema.id).map(t => ({ id: t.doc.id, name: t.doc.name ?? t.doc.id, baseId: t.doc.baseId, doc: t.doc })))) }
  const atual = tema.semNome
  return (
    <div className="space-y-1 rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700" onFocusCapture={carregar} onMouseEnter={carregar} data-versao-sem-nome>
      <p className="font-semibold">Versão sem nome <span className="font-normal text-gray-400">(para pedido que vem sem nome)</span></p>
      <BuscaTemas temas={temas ?? []} valor={atual ?? null} compacto placeholder={atual ? (temas?.find(t => t.id === atual)?.name ?? 'vinculada') : 'escolher o tema sem nome…'}
        onEscolher={id => useMaeTema.getState().aplicar('Versão sem nome', t => { (t as DocTema).semNome = id })} dataAttr="versao-sem-nome" />
      {atual && <button className="text-[10px] text-gray-500 underline" onClick={() => useMaeTema.getState().aplicar('Tirar a versão sem nome', t => { delete (t as DocTema).semNome })}>tirar o vínculo</button>}
    </div>
  )
}
