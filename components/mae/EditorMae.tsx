'use client'
'use no memo'
// Editor MAE — Sprint 1 (Fundações): prancheta em mm com zoom "tamanho real", desfazer/refazer,
// pasta Biblioteca MAE e fontes locais. Sprint 2 (Motor de render): camadas, grupos, mesclagem e
// máscara de recorte — a arte da folha é a PRÉVIA renderizada pelo motor no Web Worker (a mesma
// função da exportação); o Konva só mostra a imagem e o contorno da camada selecionada. 'use no memo': o Konva guarda estado mutável (mesmo padrão do
// EditorCamadas) e o React Compiler não pode memoizar por cima dele.
// A arte é desenhada SÓ pelo mae-render (desenharPrancheta) dentro de um Konva.Shape; o Konva cuida
// apenas da interação. As réguas são moldura da interface.
import { editarCamadaTema } from './acoesVinculo'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFolhasAplique, fecharFolhasAplique } from './folhasAplique'
import { alternarMascaraDeCorte } from './acoesVinculo'
import { paraFolha } from '@/lib/mae/editor/giroMolde'
import { Stage, Layer, Shape, Group, Rect, Transformer, Line, Circle, Text as KText, Image as KImage } from 'react-konva'
import type Konva from 'konva'
import { Undo2, Redo2, Maximize, Ruler, ZoomIn, ZoomOut, FilePlus2, AlertTriangle, FolderOpen, Settings, Keyboard } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { acharCamada } from '@/lib/mae/editor/camadas'
import { ajustar, tamanhoReal, zoomNoPonto, zoomPercentual, CALIBRACAO_PADRAO, desenharPrancheta, passoDaGrade, type Retangulo } from '@/lib/mae/render'
import { novoDocumento, type Folha, type Orientacao } from '@/lib/mae/schema'
import { suportaMae, MENSAGEM_NAVEGADOR } from '@/lib/mae/fontes/suporte'
import { useUnidade, carregarUnidade, mudarUnidade } from './unidadeMae'
import type { Unidade } from '@/lib/mae/editor/unidades'
import { desenharRegua, ESPESSURA_REGUA } from './reguas'
import Calibracao, { lerCalibracao } from './Calibracao'
import PainelBiblioteca from './PainelBiblioteca'
import PainelCamadas from './PainelCamadas'
import PainelMotor from './PainelMotor'
import CamadaMoldes, { fecharLaco } from './CamadaMoldes'
import { useMoldes, editarFaces, moverMoldes, criarFaceAqui } from './moldesEditor'
import { excluirFace } from '@/lib/mae/faces/ferramentas'
import { acoes, editarCamada } from './acoesCamadas'
import { usePrevias, resolucaoDaPrevia, garantirGrade, type PrancheteComCamadas } from './motorEditor'
import PainelBase from './PainelBase'
import PainelTema, { TIPO_ARRASTE } from './PainelTema'
import PainelExportar from './PainelExportar'
import Link from 'next/link'
import PainelLoja, { useLojaAberta } from './PainelLoja'
import PainelTemaPronto from './PainelTemaPronto'
import AbrirBase from './AbrirBase'
import { RascunhoAutomatico, IndicadorSalvamento, RecuperarRascunhos, ProtecaoErro } from './Salvamento'
import { AvisoVersaoNova } from './VersaoApp'
import { PerguntaSalvar, confirmarTroca, desfazerGlobal, refazerGlobal, useRotulosHistorico } from './historicoGlobal'
import TextosDoPedido from './TextosDoPedido'
import { BarraFuncoes, BarraOpcoes, LadoPainel, TituloFuncao, painelClassico } from './Funcoes'
import { PainelDesign, ExportarImagem } from './EditorImagemMae'
import { materializar, fontesDosTextos } from '@/lib/mae/editor/materializar'
import { garantirFontes, garantirFontesDosValores } from './fontesTexto'
import { paginaDe } from './acoesCamadas'
import BarraPedido, { useAbrirPedidoDaUrl } from './BarraPedido'
import { copiarPosicao, colarPosicao, duplicarPosicaoSel } from './TextosPaginas'
import TutorialMae, { useTutorial } from './TutorialMae'
import { usePedidoAberto, apiMae, ajustarTextoDoPedido, type Addons } from './pedidosMae'
import { excluirSelecionado, excluirDeTodas, soNestaCaixa } from './excluir'
import { useEditor, responderEscopo, teclasMae, avisar, type ModoEditor } from './estado'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { localizarNoMundo, faceSemFuroNoPonto } from './CamadaMoldes'
import { soltarNaFace, duplicarCamada, espelharCamada, copiarCamada, recortarCamada, colarCamada, alternarCadeado, alternarOlho, agruparSelecao, desagruparSelecionado, alternarGrupo, excluirGrupo, copiarEstilo, colarEstilo, categoriasParaColar, reordenar, duplicarTexto, tipoSelecionado, tipoDaCamada, mascaraDaFace } from './acoesVinculo'
import { vale, avisoNaoVale } from '@/lib/mae/editor/atalhos'
import { ROTULO_CATEGORIA, type CategoriaEstilo } from '@/lib/mae/editor/estiloCopiado'
import { atalhoDoEvento } from '@/lib/mae/editor/atalhos'
import ListaAtalhos from './Atalhos'
import { salvar as salvarTrabalho } from './historicoGlobal'
import { guardarImagem, infoImagem, lerIdentidade } from './arquivosMae'
import { arrobaDe } from './exportarMae'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { registroFontes, garantirFontesDoTema, useFontes } from './fontesTexto'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'
import { posicoesPranchetas, limitesPranchetas, organizarPranchetas, type ModoOrganizar } from '@/lib/mae/editor/pranchetas'
import { TitulosPranchetas, MenuPrancheta, excluirSelecionada } from './PranchetasPalco'
import DicasMae from './Dicas'
import { nomeDaCamada } from '@/lib/mae/vinculo/pilha'
import { acharCamadaTema } from '@/lib/mae/vinculo/tema'


/** Lote 1: cada prancheta na posição salva na base (sem ela: lado a lado, 20 mm de espaço). */
const posicoes = posicoesPranchetas
function limites(artboards: Parameters<typeof limitesPranchetas>[0]): Retangulo {
  // a barra de título das pranchetas (20 px) cabe na margem de 32 px do "Ajustar"
  return limitesPranchetas(artboards)
}

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'

const ULTIMA_ABA = 'mae:ultima-aba'

/** Lista vazia estável (a 2ª prévia "por cima da linha" de uma prancheta sem nada vazando não muda de identidade). */
const SEM_CAMADAS: never[] = []
/**
 * Urgente pós-Lote 9 (causa 3): o que a prancheta USA do tema — tudo do topo do tema, menos o conteúdo por parte/face/
 * texto, que entra só o das partes (e faces dessas partes, inclusive a líder do cenário) e textos desta prancheta.
 * O Immer mantém a identidade do que não mudou: mesma lista = nada desta prancheta mudou.
 */
function dependenciasDaPrancheta(doc: DocTrabalho, tema: DocTema | null, abId: string): unknown[] {
  if (!tema) return [null]
  const faces = new Set(doc.molds.filter(m => m.artboardId === abId).flatMap(m => m.faces.map(f => f.id)))
  const partes = doc.parts.filter(p => p.instances.some(i => faces.has(i.faceId)))
  const out: unknown[] = []
  const t = tema as unknown as Record<string, unknown>
  for (const k of Object.keys(t).sort()) if (k !== 'partContent' && k !== 'faceContent' && k !== 'localOverrides' && k !== 'textSlotAdjust') out.push(k, t[k])
  for (const p of partes) {
    out.push(tema.partContent?.[p.id])
    for (const i of p.instances) out.push(tema.faceContent?.[i.faceId], tema.localOverrides?.[i.faceId])
  }
  for (const f of faces) out.push(tema.faceContent?.[f], tema.localOverrides?.[f])   // faces sem parte (conteúdo exclusivo)
  const slots = new Set(doc.textSlots.filter(s => faces.has(s.faceId)).map(s => s.id))
  for (const [k, v] of Object.entries(tema.textSlotAdjust ?? {})) if (slots.has(k.split(':')[0])) out.push(k, v)
  return out
}

export default function EditorMae({ secao }: { secao?: string } = {}) {
  const [suporte] = useState(() => suportaMae(window))
  const hist = useMaeDoc(s => s.hist)
  const viewport = useMaeDoc(s => s.viewport)
  const { setViewport, desfazer, refazer, novaPrancheta } = useMaeDoc.getState()
  const doc = hist.atual
  const selecao = useMaeDoc(s => s.selecao)
  const raiz = useBiblioteca(s => s.raiz)
  const versaoPasta = useBiblioteca(s => s.versao)
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  // ── Sprints 5/6: o que cada folha mostra (base = papel de teste; tema = vínculo; imagem = camadas) ──
  const modoEd = useEditor(s => s.modo)
  // Sprint 12: pedido aberto pelo card ("Gerar arte"), edição em massa, add-ons e tutorial
  useAbrirPedidoDaUrl()
  const valoresDoPedido = usePedidoAberto(s => s.valores)
  const pedidoEmAjuste = usePedidoAberto(s => !!s.ajustar && !!s.pedido)
  const [escolherTipoBase, setEscolherTipoBase] = useState(false)
  // Lote 6 (item 113): unidade da régua e dos campos (engrenagem)
  const unidade = useUnidade(s => s.u)
  useEffect(() => { carregarUnidade() }, [])
  const [revise, setRevise] = useState<{ slotId: string; motivo: string; x: number; y: number } | null>(null)
  // o @ do ateliê (Identidade) entra como a variável ARROBA das posições de texto
  const arroba = useEditor(s => arrobaDe(s.identidade))
  // Lote 12 (item 171): fontes das letras trocadas neste pedido (ao abrir e a cada troca)
  const raizFontes = useBiblioteca(s => s.raiz)
  useEffect(() => { void garantirFontesDosValores(valoresDoPedido, raizFontes) }, [valoresDoPedido, raizFontes])
  const nomeTeste = useEditor(s => s.nomeTeste)
  const previaTroca = useEditor(s => s.previaTroca)
  const valoresPedido = useMemo(() => {
    let v: Record<string, string> = arroba ? { ARROBA: arroba, ...valoresDoPedido } : valoresDoPedido
    if (nomeTeste) v = { ...v, NOME: nomeTeste }
    // Lote 13 (item 179): passar o mouse numa fonte do Trocar letra mostra a letra nela, na arte (sem gravar)
    if (previaTroca) {
      const k = `_TROCAS_${previaTroca.variavel}`
      let l: { letra?: string }[] = []
      try { l = JSON.parse(v[k] || '[]') } catch { /* sem troca */ }
      v = { ...v, [k]: JSON.stringify([{ letra: previaTroca.letra, so: 'todas', fonte: previaTroca.font }, ...l.filter(t => t.letra !== previaTroca.letra)]) }
    }
    return v
  }, [arroba, valoresDoPedido, nomeTeste, previaTroca])
  const textosForaDaFace = useEditor(s => s.textos).filter(t => t.foraDaFace && t.cantosMm)
  const [addons, setAddons] = useState<Addons | null>(null)
  useEffect(() => { apiMae.addons().then(setAddons).catch(() => null) }, [])
  const tutorial = useTutorial()
  const transf = useRef<Konva.Transformer>(null)
  const caixaRef = useRef<Konva.Rect>(null)
  // apertou numa alça do transformador: o palco não começa a arrastar a folha (o Konva recebe antes do React)
  const alcaAtiva = useRef(false)
  // liga o transformador à caixa selecionada só quando ela muda (religar no meio de um arrasto cancela)
  useEffect(() => {
    const t = transf.current, n = caixaRef.current
    if (!t) return
    if ((t.nodes()[0] ?? null) !== n) { t.nodes(n ? [n] : []); t.getLayer()?.batchDraw() }
  })
  // editor de imagem: carrega as fontes dos textos livres (a prévia redesenha quando chegam)
  const docAtual = useMaeDoc(s => s.hist.atual)
  useEffect(() => {
    if (modoEd !== 'imagem') return
    const ps = new Set<string>(); for (const ab of docAtual.artboards) fontesDosTextos(ab.layers ?? [], ps)
    if (ps.size) void garantirFontes(ps, useBiblioteca.getState().raiz)
  }, [docAtual, modoEd])
  // item do menu "Método MAE": abre o editor direto na função
  useEffect(() => {
    if (!secao) {
      // sem atalho: volta para a última aba usada (Lote 2, item 25)
      let ult: string | null = null
      try { ult = localStorage.getItem(ULTIMA_ABA) } catch { /* sem storage */ }
      if (ult === 'base' || ult === 'tema' || ult === 'imagem') useEditor.getState().set({ modo: ult, face: null, camada: null, posicionar: null })
      return
    }
    if (secao === 'base' || secao === 'tema' || secao === 'imagem') useEditor.getState().set({ modo: secao, face: null, camada: null, posicionar: null })
    else if (secao === 'loja') {
      try { localStorage.setItem('mae:funcao:tema', 'loja') } catch { /* sem storage */ }
      useEditor.getState().set({ modo: 'tema', face: null, camada: null, funcao: 'loja' }); useLojaAberta.setState({ aberta: true })
    }
    else if (secao === 'ajuda') tutorial.abrir()
  }, [secao]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(ULTIMA_ABA, modoEd) } catch { /* sem storage */ } }, [modoEd])
  useLayoutEffect(() => { useMaeDoc.getState().trocarContexto(modoEd === 'imagem' ? 'imagem' : 'base') }, [modoEd])
  // barra de ícones (Lote 2, item 24): o "Próximo/Voltar" da base acompanha o ícone do passo
  const [classico] = useState(painelClassico)
  const funcao = useEditor(s => s.funcao), passoBase = useEditor(s => s.passo)
  useEffect(() => {
    if (classico || modoEd !== 'base') return
    const f = useEditor.getState().funcao
    if (f?.startsWith('passo-') && f !== `passo-${passoBase}`) {
      useEditor.getState().set({ funcao: `passo-${passoBase}` })
      try { localStorage.setItem('mae:funcao:base', `passo-${passoBase}`) } catch { /* sem storage */ }
    }
  }, [passoBase, modoEd, classico])
  const comFuncoes = !classico && modoEd !== 'imagem'
  const gradeOn = useEditor(s => s.grade)
  const pergunta = useEditor(s => s.pergunta)
  const temaDoc = useMaeTema(s => s.hist?.atual ?? null)
  // Lote 8 (item 122): a prévia de fonte (passar o mouse na lista) é só de TELA — antes gravava direto no tema, fora
  // do histórico, e um Ctrl+Z durante a prévia desfazia a coisa errada
  const previaFonte = useEditor(s => s.previaFonte)
  const tema = useMemo(() => (temaDoc && previaFonte ? { ...temaDoc, textStyles: { ...(temaDoc.textStyles ?? {}), [previaFonte.variavel]: { ...estiloDaVariavel(temaDoc.textStyles, previaFonte.variavel), font: previaFonte.font } } } as DocTema : temaDoc), [temaDoc, previaFonte])
  const liberadaPasta = useBiblioteca(s => s.liberada)
  const [grades, setGrades] = useState<Map<string, { path: string; sha256: string; aspect: number }>>(() => new Map())
  useEffect(() => {
    if (modoEd !== 'base' || !gradeOn) return
    let vivo = true
    ;(async () => {
      const m = new Map<string, { path: string; sha256: string; aspect: number }>()
      for (const p of doc.parts) if (p.instances.length) m.set(`${p.id}:${(p.referenceAspect ?? 1).toFixed(3)}`, await garantirGrade(p.name, p.referenceAspect ?? 1))
      if (vivo) setGrades(m)
    })()
    return () => { vivo = false }
  }, [doc.parts, modoEd, gradeOn])
  useEffect(() => { if (raiz && liberadaPasta) lerIdentidade(raiz).then(async i => { for (const k of ['logo', 'qr'] as const) if (i[k]) await infoImagem(raiz, i[k]!.path).catch(() => null); useEditor.getState().set({ identidade: i }) }) }, [raiz, liberadaPasta])
  // Sprint 7: fontes dos estilos de texto do tema (locais/Google/substituta) — prontas antes de diagramar
  const versaoFontes = useFontes(s => s.versao)
  useEffect(() => { if (modoEd === 'tema') garantirFontesDoTema(tema, raiz).catch(e => console.warn('[MAE] fontes', e)) }, [modoEd, tema, raiz])
  const resolverMsRef = useRef(0)
  // Lote 9 (item 135): durante o arraste a camada sai das pranchetas (a foto dela segue o mouse)
  const arrastandoId = useEditor(s => (s.arrastando && !s.arrastando.soltou ? s.arrastando.camada : null))
  const ocultar = useMemo(() => (arrastandoId ? new Set([arrastandoId]) : undefined), [arrastandoId])
  // Urgente pós-Lote 9 (causa 3): a prancheta cujo pedaço do tema não mudou reaproveita a resolução anterior (a MESMA
  // lista de camadas → a prévia nem compara JSON). Antes, cada mudança resolvia e comparava as 9.
  const resolvidas = useRef(new Map<string, { deps: unknown[]; f: PrancheteComCamadas; infos: InfoTexto[] }>())
  const { folhas, infosTexto, sobreLinhas } = useMemo(() => {
    void versaoFontes
    const t0 = performance.now()
    const infos: InfoTexto[] = []
    const fs = doc.artboards.map((ab): PrancheteComCamadas => {
      // editor de imagem: texto e forma livres viram caminho (com as fontes já carregadas)
      if (modoEd === 'imagem') return { id: ab.id, widthMm: ab.widthMm, heightMm: ab.heightMm, layers: materializar(ab.layers ?? [], registroFontes) }
      const deps = [modoEd, doc, ocultar, valoresPedido, versaoFontes, grades, gradeOn, ...(modoEd === 'tema' ? dependenciasDaPrancheta(doc, tema, ab.id) : [])]
      const antes = resolvidas.current.get(ab.id)
      if (antes && antes.deps.length === deps.length && antes.deps.every((d, i) => d === deps[i])) { infos.push(...antes.infos); return antes.f }
      const meus: InfoTexto[] = []
      const layers = resolverPrancheta(doc, ab.id, modoEd === 'tema'
        ? { tema, ocultarCamadas: ocultar, texto: { fontes: registroFontes, valores: valoresPedido, aoDiagramar: i => meus.push(i) } }
        : { gradeDaParte: gradeOn ? (id, A) => grades.get(`${id}:${A.toFixed(3)}`) ?? null : undefined })
      const f = { id: ab.id, widthMm: ab.widthMm, heightMm: ab.heightMm, layers }
      resolvidas.current.set(ab.id, { deps, f, infos: meus })
      infos.push(...meus)
      return f
    })
    // Lote 4 (item 21, tela): o que "pode vazar da face" (e os textos, que vêm depois) numa 2ª prévia
    // transparente desenhada POR CIMA das linhas do molde — inteiro por cima da linha, como no arquivo
    const sobre = fs.map(f => {
      const i = f.layers.findIndex(n => n.id.endsWith(':vaza'))
      return { ...f, layers: i < 0 ? SEM_CAMADAS : f.layers.slice(i) }
    })
    resolverMsRef.current = performance.now() - t0
    return { folhas: fs, infosTexto: infos, sobreLinhas: sobre }
  }, [doc, modoEd, tema, grades, gradeOn, versaoFontes, valoresPedido, ocultar])
  useEffect(() => { useEditor.getState().set({ textos: infosTexto }) }, [infosTexto])
  // Lote 9 (item 142): onde as logos do fundo do texto (opção que saiu) estão desenhadas — o "Converter" usa isso
  useEffect(() => {
    if (modoEd !== 'tema') return
    const achadas: { slotId: string; artboardId: string; matrix: [number, number, number, number, number, number] }[] = []
    const andar = (ns: readonly unknown[], ab: string) => { for (const n of ns as { id: string; type: string; matrix?: [number, number, number, number, number, number]; children?: unknown[] }[]) { if (n.type === 'image' && n.id.endsWith(':fundo') && n.matrix) achadas.push({ slotId: n.id.slice(0, -6), artboardId: ab, matrix: n.matrix }); if (n.children) andar(n.children, ab) } }
    for (const f of folhas) andar(f.layers, f.id)
    const atual = useEditor.getState().logosTexto
    if (achadas.length || atual.length) useEditor.getState().set({ logosTexto: achadas })
  }, [folhas, modoEd])
  const resPrevia = Math.min(resolucaoDaPrevia(viewport.escala, dpr), folhas.filter(f => f.layers.length).length > 1 ? 6 : 99)
  const aoTerminar = useCallback((r: { ms: number; folhas: number; faltando: string[]; desenhoMs?: number; redesenhadas?: number; inicio?: number }) => {
    // Lote 9 (item 135): "atualizado em" = recalcular a arte + desenhar (antes só o desenho)
    const resolverMs = Math.round(resolverMsRef.current)
    const ed = useEditor.getState()
    ed.set({ previa: { ms: Math.round(r.ms) + resolverMs, em: performance.now(), folhas: r.folhas, resolverMs, desenhoMs: Math.round(r.desenhoMs ?? r.ms), redesenhadas: r.redesenhadas ?? r.folhas } })
    // Lote 9 (item 135): soltou o arraste e a arte nova chegou → a foto sai
    if (ed.arrastando?.soltou && (r.inicio ?? 0) >= (ed.arrastando.soltouEm ?? 0)) ed.set({ arrastando: null })
    useBiblioteca.getState().setFaltando(r.faltando)
  }, [])
  const [tam, setTam] = useState({ w: 0, h: 0 })
  // Urgente pós-Lote 9 (causa 3): só as pranchetas na tela (+ folga) são redesenhadas; as outras quando aparecerem
  const visiveis = useMemo(() => {
    if (!tam.w || !tam.h) return null
    const pos = posicoes(doc.artboards), folga = 120
    return doc.artboards.filter((a, i) => {
      const x = viewport.x + pos[i].xMm * viewport.escala, y = viewport.y + pos[i].yMm * viewport.escala
      return x + a.widthMm * viewport.escala > -folga && y + a.heightMm * viewport.escala > -folga && x < tam.w + folga && y < tam.h + folga
    }).map(a => a.id).join(',')
  }, [doc.artboards, viewport, tam.w, tam.h])
  const previas = usePrevias(folhas, resPrevia, raiz, versaoPasta, aoTerminar, undefined, visiveis)
  const previasSobre = usePrevias(sobreLinhas, resPrevia, raiz, versaoPasta, undefined, null, visiveis)

  const areaRef = useRef<HTMLDivElement>(null)
  const reguaH = useRef<HTMLCanvasElement>(null)
  const reguaV = useRef<HTMLCanvasElement>(null)
  const [calib, setCalib] = useState(() => lerCalibracao())
  const [calibrando, setCalibrando] = useState(false)
  const [folha, setFolha] = useState<Folha | 'personalizada'>('A4')
  const [orient, setOrient] = useState<Orientacao>('retrato')
  const [pers, setPers] = useState({ w: '210', h: '297' })
  const ajustado = useRef(false)
  const [config, setConfig] = useState(false)
  // Lote 4 (item 39): Tab esconde/mostra todos os painéis (só a arte); o painel da direita recolhe
  const [semPaineis, setSemPaineis] = useState(false)
  const [direitaFechada, setDireitaFechada] = useState(false)
  useEffect(() => { try { setDireitaFechada(localStorage.getItem('mae:direita-fechada') === '1') } catch { /* sem storage */ } }, [])
  const fecharDireita = (v: boolean) => { setDireitaFechada(v); try { localStorage.setItem('mae:direita-fechada', v ? '1' : '0') } catch { /* sem storage */ } }
  useEffect(() => {
    const tab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || e.ctrlKey || e.altKey || e.metaKey) return
      if ((e.target as HTMLElement)?.closest('input, textarea, select, button, a, [contenteditable]')) return
      if (document.querySelector('[role="dialog"]')) return
      e.preventDefault(); setSemPaineis(v => !v)
    }
    window.addEventListener('keydown', tab)
    return () => window.removeEventListener('keydown', tab)
  }, [])

  // tamanho da área do palco
  useLayoutEffect(() => {
    const el = areaRef.current; if (!el) return
    const ro = new ResizeObserver(() => setTam({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setTam({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fazerAjustar = useCallback(() => {
    if (tam.w && tam.h) setViewport(ajustar(limites(useMaeDoc.getState().hist.atual.artboards), tam.w, tam.h))
  }, [tam.w, tam.h, setViewport])
  const fazerTamanhoReal = useCallback(() => {
    if (tam.w && tam.h) setViewport(tamanhoReal(limites(useMaeDoc.getState().hist.atual.artboards), tam.w, tam.h, calib))
  }, [tam.w, tam.h, calib, setViewport])
  const zoomCentro = useCallback((f: number) => setViewport(zoomNoPonto(useMaeDoc.getState().viewport, f, tam.w / 2, tam.h / 2)), [tam.w, tam.h, setViewport])

  // Lote 4 (item 46): folhas de aplique como pranchetas de prévia, à direita das pranchetas (só vista)
  // Lote 6 (item 106): a prévia das folhas de aplique é só do TEMA — fecha ao sair do tema (e nunca aparece na Base)
  const folhasAplique0 = useFolhasAplique(s => s.folhas)
  const folhasAplique = modoEd === 'tema' ? folhasAplique0 : null
  useEffect(() => { if (modoEd !== 'tema' && useFolhasAplique.getState().folhas) fecharFolhasAplique() }, [modoEd])
  const posFolhasAplique = useMemo(() => {
    const d = doc, p = posicoes(d.artboards)
    let x = Math.max(0, ...d.artboards.map((a, i) => p[i].xMm + a.widthMm)) + 40
    const y = Math.min(0, ...d.artboards.map((_, i) => p[i].yMm))
    return (folhasAplique ?? []).map(f => { const r = { x, y }; x += f.wMm + 30; return r })
  }, [folhasAplique, doc])
  useEffect(() => {
    const ver = () => {
      const fs = useFolhasAplique.getState().folhas
      if (!fs?.length || !tam.w || !tam.h) return
      useEditor.getState().set({ prancheta: null })   // o menu da prancheta não fica por cima das folhas
      const d = useMaeDoc.getState().hist.atual, p = posicoes(d.artboards)
      const x0 = Math.min(...d.artboards.map((_, i) => p[i].xMm)), y0 = Math.min(0, ...d.artboards.map((_, i) => p[i].yMm))
      let x1 = Math.max(...d.artboards.map((a, i) => p[i].xMm + a.widthMm)) + 40
      for (const f of fs) x1 += f.wMm + 30
      const y1 = Math.max(...d.artboards.map((a, i) => p[i].yMm + a.heightMm), ...fs.map(f => y0 + f.hMm))
      setViewport(ajustar({ xMm: x0, yMm: y0, wMm: x1 - x0, hMm: y1 - y0 }, tam.w, tam.h))
    }
    window.addEventListener('mae:ver-folhas-aplique', ver)
    return () => window.removeEventListener('mae:ver-folhas-aplique', ver)
  }, [tam.w, tam.h, setViewport])

  // Lote 4 (item 49): "Ir até" da janela de avisos — a prancheta do aviso inteira na tela
  useEffect(() => {
    const ir = (e: Event) => {
      const id = (e as CustomEvent<{ artboardId?: string }>).detail?.artboardId
      const d = useMaeDoc.getState().hist.atual
      const i = d.artboards.findIndex(a => a.id === id)
      if (i < 0 || !tam.w || !tam.h) return
      const p = posicoes(d.artboards)[i]
      setViewport(ajustar({ xMm: p.xMm, yMm: p.yMm, wMm: d.artboards[i].widthMm, hMm: d.artboards[i].heightMm }, tam.w, tam.h))
    }
    window.addEventListener('mae:ir-ate', ir)
    return () => window.removeEventListener('mae:ir-ate', ir)
  }, [tam.w, tam.h, setViewport])

  // Lote 4 (item 42): Ctrl+Z/Ctrl+Y podem tirar a prancheta selecionada (criada/excluída/duplicada) — a seleção
  // não fica apontando para uma prancheta que não existe (o menu sumia sem motivo aparente)
  const idsPranchetas = useMaeDoc(s => s.hist.atual.artboards.map(a => a.id).join(','))
  useEffect(() => {
    const sel = useEditor.getState().prancheta
    if (sel && !idsPranchetas.split(',').includes(sel)) useEditor.getState().set({ prancheta: null })
  }, [idsPranchetas])

  // primeira abertura: a prancheta inteira na tela
  useEffect(() => { if (!ajustado.current && tam.w && tam.h) { ajustado.current = true; fazerAjustar() } }, [tam.w, tam.h, fazerAjustar])

  // réguas acompanham o viewport
  useEffect(() => {
    if (reguaH.current && tam.w) desenharRegua(reguaH.current, 'h', viewport, tam.w, 0, unidade)
    if (reguaV.current && tam.h) desenharRegua(reguaV.current, 'v', viewport, tam.h, 0, unidade)
  }, [viewport, tam.w, tam.h, unidade])

  const emAjuste = pedidoEmAjuste && modoEd === 'tema'
  // atalhos no padrão Photoshop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-editor-pixels]')) return   // a janela de máscara/pintura tem os próprios atalhos
      const ctrl = e.ctrlKey || e.metaKey
      // Lote 8 (item 122): Ctrl+Z/Ctrl+Y depois de mexer num controle deslizante, select, caixinha ou cor (o foco fica
      // nele) era engolido — o atalho só fica com o navegador num campo de DIGITAÇÃO (texto/número); nos outros
      // controles o foco sai e o Ctrl+Z vale para o editor
      const alvo = e.target as HTMLElement | null
      if (alvo?.closest('input, textarea, select, [contenteditable="true"]')) {
        const tipo = alvo instanceof HTMLInputElement ? alvo.type : ''
        const digitacao = !!alvo.closest('textarea, [contenteditable="true"]') || (alvo instanceof HTMLInputElement && ['text', 'number', 'search', 'email', 'tel', 'url', 'password', ''].includes(tipo))
        if (!(ctrl && ['z', 'y'].includes(e.key.toLowerCase())) || digitacao) return
        alvo.blur()
      }
      // Lote 9 (item 148): a AÇÃO vem da tabela única de atalhos (lib/mae/editor/atalhos.ts — a mesma da lista "?" e
      // dos menus); aqui só se decide se ela vale agora (aba, seleção)
      const acao = atalhoDoEvento(e)
      const ed = useEditor.getState()
      const noTema = ed.modo === 'tema' && !!useMaeTema.getState().hist
      const selCamada = noTema ? ed.camada : null
      const feito = () => e.preventDefault()
      // Lote 10 (item 153): a ação não serve para o objeto selecionado → avisa (nunca "não faz nada" nem cai em outra aba)
      if (noTema && acao && !vale(acao, tipoSelecionado())) { feito(); avisar(avisoNaoVale(acao, tipoSelecionado()!)); return }
      switch (acao) {
        // Lote 3 (item 31): um atalho só, ligado à mesma linha do tempo das setinhas (base, tema ou design)
        case 'desfazer': feito(); desfazerGlobal(); return
        case 'refazer': feito(); refazerGlobal(); return
        case 'salvar': case 'salvarComo': {
          feito()
          // o mesmo botão "Salvar" da aba (mesma lógica e marca de salvo); com o painel fechado, o salvar geral
          const como = acao === 'salvarComo' && ed.modo === 'tema'
          const sel = como ? '[data-salvar-como-tema]' : ed.modo === 'tema' ? '[data-salvar-tema]' : ed.modo === 'imagem' ? '[data-salvar-design]' : '[data-salvar-base]'
          const b = document.querySelector<HTMLButtonElement>(sel)
          if (b && !b.disabled) b.click()
          else void salvarTrabalho(ed.modo === 'tema' ? 'tema' : ed.modo === 'imagem' ? 'design' : 'base')
          return
        }
        case 'ajuda': feito(); ed.set({ atalhos: true }); return
        // Lote 3 (item 34): Ctrl+A no Tema seleciona todas as partes
        case 'selecionarTudo':
          if (noTema) {
            feito()
            const ids = useMaeDoc.getState().hist.atual.parts.filter(p => p.instances.length).map(p => p.id)
            ed.set({ partesSel: ids.length > 1 ? ids : [], parteAtiva: ids[0] ?? null, camada: null })
          }
          return
        // Ctrl+D (como no Photoshop): desseleciona — antes abria o "favoritar página" do navegador
        case 'desselecionar':
          feito()
          ed.set({ camada: null, slot: null, face: null, partesSel: [], identSel: null, menuCamada: null, grupoSel: null, multiSel: [] })
          useMaeDoc.getState().setSelecao(null); useMoldes.getState().set({ face: null })
          return
        case 'ajustar': feito(); fazerAjustar(); return
        case 'tamanhoReal': feito(); fazerTamanhoReal(); return
        case 'zoomMais': feito(); zoomCentro(1.25); return
        case 'zoomMenos': feito(); zoomCentro(0.8); return
        // camadas (Photoshop): Ctrl+G agrupar · Shift+Ctrl+G desagrupar · Alt+Ctrl+G recorte
        case 'agrupar': case 'desagrupar': case 'mascaraCorte':
          feito()
          // Lote 4 (item 51): no Tema, Ctrl+Alt+G = máscara de corte da camada selecionada
          if (acao === 'mascaraCorte' && selCamada) alternarMascaraDeCorte(selCamada)
          // Lote 9 (item 142): no Tema, Ctrl+G agrupa a seleção e Ctrl+Shift+G desagrupa
          else if (noTema && acao === 'agrupar') agruparSelecao()
          else if (noTema && acao === 'desagrupar') desagruparSelecionado()
          else if (noTema) { /* Lote 10 (item 153): no Tema, nunca as ações do editor livre */ }
          else if (acao === 'mascaraCorte') acoes.alternarRecorte(); else if (acao === 'desagrupar') acoes.desagrupar(); else acoes.agrupar()
          return
        // Lote 9 (itens 137/148): copiar, recortar, colar e duplicar a camada do tema; nas outras abas, o que já existia
        case 'copiar':
          if (selCamada) { feito(); copiarCamada(selCamada); return }
          // Lote 4 (item 52): Ctrl+C na posição de texto selecionada (NOME, IDADE, HASHTAG…)
          // Lote 10 (item 152): também no Tema — o último copiado (texto ou camada) é o que cola
          if (ed.slot && copiarPosicao()) { feito(); ed.set({ areaCamada: null }) }
          return
        case 'recortar':
          if (selCamada) { feito(); recortarCamada(selCamada) }
          else if (noTema && ed.slot && copiarPosicao()) { feito(); ed.set({ areaCamada: null }); excluirSelecionado() }
          return
        case 'colar':
          if (noTema && ed.areaCamada) { feito(); colarCamada(); return }
          if ((ed.modo === 'base' || noTema) && colarPosicao()) feito()
          return
        case 'duplicar':
          feito()
          if (selCamada) { duplicarCamada(selCamada); return }
          // Lote 10 (item 152): Ctrl+J num TEXTO do tema (antes caía no editor livre e não fazia nada)
          if (noTema) { if (ed.slot) duplicarTexto(ed.slot); return }
          if (!(ed.modo === 'base' && ed.slot && duplicarPosicaoSel())) acoes.duplicar()
          return
        // Lote 9 (item 138)
        case 'espelharH': case 'espelharV':
          if (selCamada) { feito(); espelharCamada(selCamada, acao === 'espelharH' ? 'x' : 'y') }
          return
        // Lote 9 (item 148): cadeado e olho do objeto selecionado (camada ou texto)
        case 'cadeado': case 'olho':
          if (noTema && ed.grupoSel) { feito(); alternarGrupo(ed.grupoSel, acao === 'cadeado' ? 'locked' : 'visible'); return }
          if (noTema && (ed.camada || ed.slot)) { feito(); if (acao === 'cadeado') alternarCadeado({ camada: ed.camada, slot: ed.slot }); else alternarOlho({ camada: ed.camada, slot: ed.slot }) }
          return
        // Lote 6 (item 81): no Tema, Ctrl+] / Ctrl+[ mudam a ordem da camada selecionada (Shift = topo / fundo)
        // Lote 10 (item 151): a ordem vale entre as listas da caixa e com os textos; no Tema nunca cai no editor livre
        case 'frente': case 'tras': case 'topo': case 'fundo':
          feito()
          if (noTema) {
            const alvo = selCamada ?? (ed.slot ? `t:${ed.slot}` : null)
            if (alvo) reordenar(alvo, acao, acao === 'frente' || acao === 'topo' ? 'Trazer para frente' : 'Enviar para trás')
            return
          }
          if (acao === 'frente' || acao === 'topo') acoes.subir(); else acoes.descer()
          return
        // Lote 9 (item 145): copiar e colar estilo (Ctrl+Alt+C / Ctrl+Alt+V; Ctrl+Alt+Shift+V = "Colar estilo…")
        case 'copiarEstilo':
          if (noTema) { feito(); copiarEstilo() }
          return
        case 'colarEstilo':
          if (noTema && ed.estiloCopiado) { feito(); if (e.shiftKey) ed.set({ colarEstiloAberto: true }); else colarEstilo() }
          return
      }
      // Lote 13 (item 181): Ctrl+O abre a BUSCA DE TEMA de qualquer tela do editor
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') { e.preventDefault(); if (useEditor.getState().modo !== 'tema') useEditor.getState().set({ modo: 'tema' }); useEditor.getState().set({ pedidoTopo: 'abrir-tema' }); return }
      if (e.key === 'Enter' && useMoldes.getState().modo === 'laco') { const m = useMoldes.getState(); if (m.moldeDosPontos) { e.preventDefault(); fecharLaco(m.moldeDosPontos, m.pontos) } }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && noTema && ed.grupoSel) { e.preventDefault(); excluirGrupo(ed.grupoSel) }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const fsel = useMoldes.getState().face
        // Lote 5 (item 53): texto, camada do tema e logo/QR também (antes o Delete não fazia nada neles)
        const r = fsel ? 'nada' : excluirSelecionado()
        if (r !== 'nada') { e.preventDefault(); if (r === 'travado') alert(useEditor.getState().identSel ? 'Item travado — logo e QR ficam na Base (passo Identidade).' : 'Item travado — destrave para editar.') }
        else if (fsel) { e.preventDefault(); editarFaces(fsel.moldeId, 'Excluir face', fs => { const i = fs.findIndex(f => f.id === fsel.faceId); return i < 0 ? null : excluirFace(fs, i) }); useMoldes.getState().set({ face: null }) }
        else if (useMaeDoc.getState().selecao) { e.preventDefault(); acoes.excluir() }
        else if (e.key === 'Delete' && useEditor.getState().modo !== 'tema' && useEditor.getState().prancheta) {
          // Lote 3 (item 12): Delete exclui a prancheta selecionada — a seleção de cada passo só conta no passo dela
          const es = useEditor.getState(), ms = useMoldes.getState()
          const outra = (es.modo === 'base' && ((es.passo <= 3 && (ms.face || ms.sel.length)) || (es.passo === 6 && es.slot) || (es.passo === 7 && es.identSel)))
          if (!outra) { e.preventDefault(); excluirSelecionada() }
        }
      }
      else if (!ctrl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && moverComSetas(e.key, e.shiftKey)) e.preventDefault()
      else if (e.key === 'Escape') {
        if (ed.grupoSel || ed.multiSel.length) ed.set({ grupoSel: null, multiSel: [] })
        const m = useMoldes.getState()
        if (m.pontos.length || m.modo !== 'selecionar') m.set({ pontos: [], moldeDosPontos: null, modo: 'selecionar' })
        else { m.set({ face: null, medida: null }); useMaeDoc.getState().setSelecao(null) }
      }
    }
    // Lote 8 (item 132): Alt sozinho no Windows ativa o menu do navegador e o próximo Alt + clique se perde — no editor,
    // o Alt é nosso (descer na pilha)
    const soltouAlt = (e: KeyboardEvent) => { if (e.key === 'Alt') e.preventDefault(); if (e.key === ' ') teclasMae.espaco = false }
    // Lote 9 (item 148): Espaço segurado = mão (arrastar move a vista mesmo em cima de um objeto; sem rolar a página)
    const espaco = (e: KeyboardEvent) => {
      if (e.key !== ' ' || (e.target as HTMLElement | null)?.closest?.('input, textarea, select, button, [contenteditable="true"]')) return
      e.preventDefault(); teclasMae.espaco = true
    }
    window.addEventListener('keydown', espaco)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', soltouAlt)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keydown', espaco); window.removeEventListener('keyup', soltouAlt) }
  }, [desfazer, refazer, fazerAjustar, fazerTamanhoReal, zoomCentro])

  // roda: Ctrl = zoom no cursor; sem Ctrl = rolar (Shift = horizontal)
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const v = useMaeDoc.getState().viewport
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const p = e.target.getStage()?.getPointerPosition(); if (!p) return
      setViewport(zoomNoPonto(v, e.evt.deltaY < 0 ? 1.1 : 1 / 1.1, p.x, p.y))
    } else {
      const dx = e.evt.shiftKey ? e.evt.deltaY : e.evt.deltaX, dy = e.evt.shiftKey ? 0 : e.evt.deltaY
      setViewport({ ...v, x: v.x - dx, y: v.y - dy })
    }
  }
  // arrastar o fundo = mover a vista (mão)
  const arrasto = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  // Lote 3 (item 34): no Tema, Ctrl + arrastar desenha um retângulo que seleciona as partes das faces tocadas
  const [retangulo, setRetangulo] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const relativo = (e: React.PointerEvent) => { const r = areaRef.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  function selecionarNoRetangulo(q: { x0: number; y0: number; x1: number; y1: number }) {
    const v = useMaeDoc.getState().viewport, d = useMaeDoc.getState().hist.atual, pos = posicoes(d.artboards)
    const mm = (x: number, y: number) => [(x - v.x) / v.escala, (y - v.y) / v.escala]
    const [ax, ay] = mm(Math.min(q.x0, q.x1), Math.min(q.y0, q.y1)), [bx, by] = mm(Math.max(q.x0, q.x1), Math.max(q.y0, q.y1))
    const achadas: string[] = []
    for (const m of d.molds) {
      const i = d.artboards.findIndex(a => a.id === m.artboardId); if (i < 0) continue
      for (const f of m.faces) {
        if (f.hole) continue
        const pf = (f.polygonMm as [number, number][]).map(p => paraFolha(m, p))
        const xs = pf.map(p => pos[i].xMm + p[0]), ys = pf.map(p => pos[i].yMm + p[1])
        if (Math.max(...xs) < ax || Math.min(...xs) > bx || Math.max(...ys) < ay || Math.min(...ys) > by) continue
        const parte = d.parts.find(p => p.instances.some(x => x.faceId === f.id))
        if (parte && !achadas.includes(parte.id)) achadas.push(parte.id)
      }
    }
    if (achadas.length) useEditor.getState().set({ partesSel: achadas.length > 1 ? achadas : [], parteAtiva: achadas[0], camada: null })
  }
  const onDown = (e: React.PointerEvent) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey) && useEditor.getState().modo === 'tema') {
      const p = relativo(e); setRetangulo({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); return
    }
    if (e.button === 2) return; if (alcaAtiva.current) { alcaAtiva.current = false; return } if (useMoldes.getState().modo !== 'selecionar' && e.button === 0) return; const v = useMaeDoc.getState().viewport; arrasto.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId) }
  const onMove = (e: React.PointerEvent) => { if (retangulo) { const p = relativo(e); setRetangulo(r => r && { ...r, x1: p.x, y1: p.y }); return } const a = arrasto.current; if (a) setViewport({ ...useMaeDoc.getState().viewport, x: a.vx + e.clientX - a.x, y: a.vy + e.clientY - a.y }) }
  const onUp = () => {
    arrasto.current = null
    if (retangulo) { if (Math.abs(retangulo.x1 - retangulo.x0) + Math.abs(retangulo.y1 - retangulo.y0) > 6) selecionarNoRetangulo(retangulo); setRetangulo(null) }
  }

  function criarPrancheta(adicionar = false) {
    const acao = adicionar ? useMaeDoc.getState().adicionarPrancheta : novaPrancheta
    if (folha === 'personalizada') {
      const w = Number(pers.w.replace(',', '.')), h = Number(pers.h.replace(',', '.'))
      if (!(w > 0 && h > 0 && w <= 2000 && h <= 2000)) { alert('Informe largura e altura em mm (até 2000 mm).'); return }
      acao({ widthMm: w, heightMm: h })
    } else acao(folha, orient)
    ajustado.current = false
    requestAnimationFrame(() => { ajustado.current = true; fazerAjustar() })
  }


  const ps = posicoes(doc.artboards)
  // Lote 3 (item 36): o que está aberto, sempre visível
  const temaAberto = useMaeTema(s => s.hist?.atual ?? null)
  const aberto = modoEd === 'imagem' ? `Design: ${doc.name}` : modoEd === 'tema'
    ? (temaAberto ? `Tema: ${temaAberto.name ?? 'sem nome'} · Base: ${doc.name} v${doc.version}` : `Nenhum tema aberto · Base: ${doc.name} v${doc.version}`)
    : `Base: ${doc.name} v${doc.version}`
  /** Lote 6 (item 90): "Nova base" pergunta o tipo — Caixas e moldes (como sempre) ou Peças por medida. */
  async function novaBase() {
    if (!(await confirmarTroca('base'))) return
    setEscolherTipoBase(true)
  }
  function criarBase(tipo: 'caixas' | 'medida') {
    setEscolherTipoBase(false)
    fecharFolhasAplique()   // Lote 6 (item 106): a prévia era do tema/base anterior
    const d = novoDocumento(folha === 'personalizada' ? 'A4' : folha, orient, tipo === 'medida' ? 'Etiquetas' : 'Nova base')
    if (tipo === 'medida') { (d as { tipo?: string }).tipo = 'medida'; d.smartArt = { ...(d.smartArt ?? {}), overflowMm: 2 } }
    useMaeDoc.getState().carregar(d)
    useEditor.getState().set({ face: null, camada: null, slot: null, prancheta: null, passo: 1, ...(tipo === 'medida' ? { funcao: 'medidas' } : {}) })
    requestAnimationFrame(fazerAjustar)
  }
  async function novoTema() {
    if (!(await confirmarTroca('tema'))) return
    useMaeTema.getState().carregar(null)
    useEditor.getState().set({ camada: null, face: null })
  }
  // Lote 8 (item 133): não fecha o tema aberto — a lista aparece no painel do Tema e trocar pergunta antes (no abrir)
  async function abrirTemaTopo() {
    useEditor.getState().set({ pedidoTopo: 'abrir-tema' })
  }
  const rotulos = useRotulosHistorico()
  const ultimoDesfazer = rotulos.desfazer, ultimoRefazer = rotulos.refazer
  if (!suporte.ok) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center space-y-2" data-sem-suporte>
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h1 className="text-lg font-semibold text-gray-900">{MENSAGEM_NAVEGADOR}</h1>
        <p className="text-sm text-gray-600">O Método MAE trabalha com a pasta e as fontes do seu computador, e só o Chrome e o Edge (no computador) permitem isso.</p>
        <p className="text-xs text-gray-400">Falta neste navegador: {suporte.faltando.join(' · ')}</p>
      </div>
    )
  }
  // contorno da camada selecionada (arrastar = mover; aplicado ao soltar, 1 passo de desfazer)
  const pagAtiva = paginaDe(doc.artboards)
  const iPag = Math.max(0, doc.artboards.indexOf(pagAtiva))
  const sel = selecao && pagAtiva?.layers ? acharCamada(pagAtiva.layers, selecao)?.no ?? null : null
  const caixaSel = sel && ((sel.type === 'image' && !sel.matrix) || sel.type === 'solid' || sel.type === 'text' || sel.type === 'vshape') ? sel : null
  const rotSel = caixaSel && caixaSel.type !== 'solid' ? caixaSel.rotationDeg : 0

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[560px]" data-editor-mae data-mae-raiz data-sem-paineis={semPaineis ? 1 : undefined}>
      <DicasMae />
      <ListaAtalhos />
      {semPaineis && <button onClick={() => setSemPaineis(false)} className="fixed top-3 left-1/2 -translate-x-1/2 z-[65] rounded-full bg-gray-900/80 px-3 py-1 text-[11px] font-medium text-white shadow" data-mostrar-paineis>Painéis escondidos — Tab (ou clique) para mostrar</button>}
      {/* barra */}
      <div className={`flex flex-wrap items-center gap-1.5 border-b border-gray-200 dark:border-gray-800 px-3 py-2 bg-white dark:bg-gray-900 ${semPaineis ? 'hidden' : ''}`}>
        <span className="text-sm font-semibold text-gray-900 dark:text-white mr-1">Método MAE</span>
        <span className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mr-2" data-modos>
          {([['base', '1. Base', 'Monte os moldes uma vez: faces, partes e onde vão os textos'], ['tema', '2. Tema', 'Vista a base com papéis, elementos e textos'], ['imagem', '3. Editor livre', 'Uma arte solta, sem molde (convite, tag, topo de bolo…)']] as [ModoEditor, string, string][]).map(([m, r, dica]) => (
            <button key={m} title={dica} className={`px-2.5 py-1.5 text-xs font-medium ${modoEd === m ? 'bg-orange-500 text-white' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`} onClick={() => useEditor.getState().set({ modo: m, face: null, camada: null, posicionar: null, prancheta: null })} data-modo-editor={m}>{r}</button>
          ))}
        </span>
        <span className="mr-1 max-w-[22rem] truncate rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-200" title="O que está aberto agora" data-aberto>{aberto}</span>
        <IndicadorSalvamento />
        {/* Lote 3 (item 36): cada aba com os SEUS botões — pranchetas e moldes só na Base; no Tema elas vêm da base */}
        {modoEd === 'base' && <>
          <button className={btn} onClick={() => void novaBase()} title="Começar uma base nova (pergunta antes se a aberta tem alterações)" data-nova-base><FilePlus2 className="w-3.5 h-3.5" /> Nova base</button>
          <button className={btn} onClick={() => useEditor.getState().set({ pedidoTopo: 'abrir-base' })} title="Abrir uma base salva para editar" data-abrir-base-topo><FolderOpen className="w-3.5 h-3.5" /> Abrir base</button>
        </>}
        {modoEd === 'tema' && <>
          <button className={btn} onClick={() => void novoTema()} title="Começar um tema novo (escolhe a base)" data-novo-tema-topo><FilePlus2 className="w-3.5 h-3.5" /> Novo tema</button>
          <button className={btn} onClick={() => void abrirTemaTopo()} title="Buscar e abrir um tema (Ctrl+O)" data-abrir-tema-topo><FolderOpen className="w-3.5 h-3.5" /> Abrir tema</button>
        </>}
        {modoEd === 'imagem' && <>
          <button className={btn} onClick={() => useEditor.getState().set({ pedidoTopo: 'novo-design' })} title="Começar um design novo (pergunta antes se o aberto tem alterações)" data-novo-design-topo><FilePlus2 className="w-3.5 h-3.5" /> Novo design</button>
          <button className={btn} onClick={() => useEditor.getState().set({ pedidoTopo: 'abrir-design' })} title="Abrir um design salvo" data-abrir-design-topo><FolderOpen className="w-3.5 h-3.5" /> Abrir design</button>
        </>}
        {modoEd !== 'tema' && <>
          <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <span className="text-[11px] text-gray-500" title="Tamanho e orientação da próxima prancheta/página">{modoEd === 'imagem' ? 'Nova página:' : 'Nova prancheta:'}</span>
        <select value={folha} onChange={e => setFolha(e.target.value as Folha | 'personalizada')} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" data-folha>
          <option value="A4">A4 (210 × 297 mm)</option><option value="A5">A5 (148 × 210 mm)</option><option value="A6">A6 (105 × 148 mm)</option><option value="personalizada">Personalizada</option>
        </select>
        {folha === 'personalizada' ? (
          <span className="inline-flex items-center gap-1 text-xs">
            <input inputMode="decimal" value={pers.w} onChange={e => setPers(p => ({ ...p, w: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Largura em mm" /> ×
            <input inputMode="decimal" value={pers.h} onChange={e => setPers(p => ({ ...p, h: e.target.value }))} className="w-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1.5" aria-label="Altura em mm" /> mm
          </span>
        ) : (
          <select value={orient} onChange={e => setOrient(e.target.value as Orientacao)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" data-orientacao>
            <option value="retrato">Retrato</option><option value="paisagem">Paisagem</option>
          </select>
        )}
        <button className={btn} onClick={() => criarPrancheta(true)} title="Acrescenta mais uma prancheta nesta área de trabalho, no tamanho e orientação escolhidos ao lado" data-adicionar-prancheta>{modoEd === 'imagem' ? '+ Nova página' : '+ Nova prancheta'}</button>
        {doc.artboards.length > 1 && (
          <select value="" onChange={e => { const m = e.target.value as ModoOrganizar; if (!m) return; useMaeDoc.getState().aplicar(`Organizar pranchetas (${m})`, d => organizarPranchetas(d, m)); requestAnimationFrame(fazerAjustar) }} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1.5 text-xs" title="Organizar as pranchetas na área de trabalho" data-organizar>
            <option value="">Organizar…</option><option value="linha">Em linha</option><option value="coluna">Em coluna</option><option value="grade">Em grade</option>
          </select>
        )}
        </>}
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={() => desfazerGlobal()} disabled={!ultimoDesfazer} title={ultimoDesfazer ? `Desfazer: ${ultimoDesfazer} (Ctrl+Z)` : 'Nada para desfazer'} data-desfazer><Undo2 className="w-3.5 h-3.5" /></button>
        <button className={btn} onClick={() => refazerGlobal()} disabled={!ultimoRefazer} title={ultimoRefazer ? `Refazer: ${ultimoRefazer} (Ctrl+Shift+Z ou Ctrl+Y)` : 'Nada para refazer'} data-refazer><Redo2 className="w-3.5 h-3.5" /></button>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button className={btn} onClick={fazerAjustar} title="Ajustar à tela (Ctrl+0)"><Maximize className="w-3.5 h-3.5" /> Ajustar</button>
        <button className={btn} onClick={fazerTamanhoReal} title="Tamanho real — 100 mm na tela = 100 mm (Ctrl+1)" data-tamanho-real><Ruler className="w-3.5 h-3.5" /> Tamanho real</button>
        <label className="inline-flex items-center gap-0.5 text-xs text-gray-600 dark:text-gray-300" title="Unidade da régua e dos campos (fica lembrada). Em qualquer campo dá para digitar com a unidade: 9cm, 90mm, 1063px." data-unidade>
          <Settings className="w-3.5 h-3.5" />
          <select value={unidade} onChange={e => mudarUnidade(e.target.value as Unidade)} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-1 text-xs" aria-label="Unidade">
            <option value="mm">mm</option><option value="cm">cm</option><option value="px">px a 300 dpi</option>
          </select>
        </label>
        <button className={btn} onClick={() => zoomCentro(0.8)} title="Diminuir (Ctrl −)" data-zoom-menos><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs tabular-nums w-12 text-center text-gray-600 dark:text-gray-300" data-zoom>{zoomPercentual(viewport, calib)}%</span>
        <button className={btn} onClick={() => zoomCentro(1.25)} title="Aumentar (Ctrl +)" data-zoom-mais><ZoomIn className="w-3.5 h-3.5" /></button>
        <button className={btn + (calib === CALIBRACAO_PADRAO ? ' !border-orange-300' : '')} onClick={() => setCalibrando(true)} title="Medir a tela com um cartão para o tamanho real ficar exato">Calibrar tela</button>
        {/* Lote 4 (item 40): Configurações — a pasta da Biblioteca MAE (trocar/reconectar) */}
        <span className="relative">
          <button className={btn} onClick={() => setConfig(c => !c)} title="Configurações do Método MAE (pasta da Biblioteca)" aria-label="Configurações" data-config-mae><Settings className="w-3.5 h-3.5" /></button>
          {config && (
            <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-xl space-y-2" data-painel-config>
              <PainelBiblioteca />
              <p className="text-[10px] text-gray-500">As fontes do computador aparecem no seletor de fonte do painel de texto.</p>
              <div className="flex justify-end"><button className={btn} onClick={() => setConfig(false)}>Fechar</button></div>
            </div>
          )}
        </span>
        <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
        {addons?.addons.massa.ativo
          ? <Link className={btn} href="/estudio/mae/pedidos" title="Pedidos e edição em massa" data-abrir-massa>Pedidos (massa)</Link>
          : <button className={btn} disabled title={`Add-on "Edição em massa" ${addons?.addons.massa.preco ? `· R$ ${addons.addons.massa.preco.toFixed(2).replace('.', ',')}/mês` : '· em breve'}`} data-abrir-massa>Pedidos (massa)</button>}
        <button className={btn} onClick={tutorial.abrir} title="Como usar o Método MAE" aria-label="Tutorial" data-abrir-tutorial>?</button>
        <button className={btn} onClick={() => useEditor.getState().set({ atalhos: true })} title="Atalhos de teclado (?)" aria-label="Atalhos de teclado" data-abrir-atalhos><Keyboard className="w-3.5 h-3.5" /></button>
        <PreviaInfo />
        <span className="ml-auto text-[11px] text-gray-400" data-medidas>{doc.artboards.map(a => `${a.widthMm} × ${a.heightMm} mm`).join(' · ')}</span>
      </div>
      {!semPaineis && <BarraPedido />}
      {!semPaineis && comFuncoes && <ProtecaoErro nome="Barra de opções"><BarraOpcoes modo={modoEd} /></ProtecaoErro>}

      <div className="flex flex-1 min-h-0">
        {/* Lote 6 (item 99): no Ajustar do pedido, só os textos deste pedido (o tema está travado) */}
        {comFuncoes && !semPaineis && !emAjuste && <ProtecaoErro nome="Barra de ferramentas"><BarraFuncoes modo={modoEd} /></ProtecaoErro>}
        {emAjuste && !semPaineis && <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 overflow-y-auto" data-painel-textos-pedido><TextosDoPedido /></aside>}
        {/* painel da função aberta (fica montado mesmo fechado: a exportação em andamento não se perde) */}
        {comFuncoes && (
          <aside className={`w-80 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-4 overflow-y-auto ${funcao && !semPaineis && !emAjuste ? '' : 'hidden'}`} data-painel-funcao={funcao ?? ''}>
            <TituloFuncao modo={modoEd} />
            <ProtecaoErro nome="Painel da função">
            <LadoPainel lado="funcoes">
              {modoEd === 'base' && <PainelBase />}
              {modoEd === 'tema' && <><PainelTema /><PainelTemaPronto /><PainelExportar /><PainelLoja /></>}
            </LadoPainel>
            </ProtecaoErro>
          </aside>
        )}
        {/* palco com réguas */}
        <div className="flex-1 min-w-0 grid" style={{ gridTemplateColumns: `${ESPESSURA_REGUA}px 1fr`, gridTemplateRows: `${ESPESSURA_REGUA}px 1fr` }}>
          <div className="bg-slate-50 border-r border-b border-slate-300" />
          <div className="overflow-hidden"><canvas ref={reguaH} /></div>
          <div className="overflow-hidden"><canvas ref={reguaV} /></div>
          <div ref={areaRef} className="relative overflow-hidden bg-slate-200 dark:bg-slate-800 cursor-grab active:cursor-grabbing" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onDragOver={e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
            onDrop={e => {
              // Lote 5 (item 59): no "Ajustar" do pedido o tema fica travado (nada entra arrastando)
              if (usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido) { e.preventDefault(); return }
              const caminho = e.dataTransfer.getData(TIPO_ARRASTE)
              const arquivos = Array.from(e.dataTransfer.files)
              if (!caminho && !arquivos.length) return
              e.preventDefault()
              if (useEditor.getState().modo !== 'tema') { if (arquivos.length) window.dispatchEvent(new CustomEvent('mae:importar-moldes', { detail: arquivos })); return }
              // tema: o que foi solto numa face vai para a PARTE dela (com Alt: só para esta caixa)
              const box = e.currentTarget.getBoundingClientRect(), v = useMaeDoc.getState().viewport
              const mundo: [number, number] = [(e.clientX - box.left - v.x) / v.escala, (e.clientY - box.top - v.y) / v.escala]
              const d = useMaeDoc.getState().hist.atual
              const achado = localizarNoMundo(d, posicoes(d.artboards), mundo)
              const faceId = achado ? faceSemFuroNoPonto(achado.m, achado.local) : null
              const alt = e.altKey, empilhar = e.shiftKey
              if (!raiz || !faceId) return
              ;(async () => {
                const itens = caminho ? [await infoImagem(raiz, caminho)] : await Promise.all(arquivos.map(async f => guardarImagem(raiz, f, await temTransparencia(f) ? 'Elementos' : 'Papéis')))
                for (const it of itens) soltarNaFace(faceId, achado!.local, it, alt, empilhar)
              })()
            }} data-palco>
            {tam.w > 0 && tam.h > 0 && (
              <ProtecaoErro nome="Área de desenho">
              <Stage width={tam.w} height={tam.h} scaleX={viewport.escala} scaleY={viewport.escala} x={viewport.x} y={viewport.y} onWheel={onWheel}>
                <Layer listening={false}>
                  {doc.artboards.map((a, i) => (
                    <Shape key={a.id} x={ps[i].xMm} y={ps[i].yMm} perfectDrawEnabled={false}
                      sceneFunc={ctx => {
                        const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
                        const arte = previas.get(a.id) ?? null
                        if (!arte) {
                          desenharPrancheta(c, a, { pxPorMmDoDispositivo: viewport.escala * dpr, grade: { passoMm: passoDaGrade(viewport.escala) }, borda: true })
                          return
                        }
                        // a arte inteira vem pronta do motor; aqui só se coloca na folha (em mm) e se desenha a borda
                        c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
                        c.drawImage(arte.bitmap, 0, 0, a.widthMm, a.heightMm); c.restore()
                        desenharPrancheta(c, a, { pxPorMmDoDispositivo: viewport.escala * dpr, grade: false, borda: true, corFundo: 'rgba(0,0,0,0)' })
                      }} />
                  ))}
                </Layer>
                <TitulosPranchetas ps={ps} escala={viewport.escala} />
                <CamadaMoldes posicoes={ps} escala={viewport.escala} />
                {folhasAplique && (
                  <Layer listening={false} data-folhas-aplique-palco>
                    {folhasAplique.map((f, k) => {
                      const pos = posFolhasAplique[k]
                      return (
                        <Group key={f.nome} x={pos.x} y={pos.y}>
                          <Rect width={f.wMm} height={f.hMm} fill="#ffffff" stroke="#0284c7" strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} />
                          <KImage image={f.bitmap as unknown as HTMLImageElement} width={f.wMm} height={f.hMm} />
                          <KText y={-16 / viewport.escala} text={f.nome} fontSize={11 / viewport.escala} fill="#0284c7" fontStyle="bold" />
                        </Group>
                      )
                    })}
                  </Layer>
                )}
                {previasSobre.size > 0 && (
                  <Layer listening={false} data-sobre-linhas>
                    {doc.artboards.map((a, i) => previasSobre.has(a.id) && (
                      <Shape key={a.id} x={ps[i].xMm} y={ps[i].yMm} perfectDrawEnabled={false}
                        sceneFunc={ctx => {
                          const c = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
                          const arte = previasSobre.get(a.id)
                          if (!arte) return
                          c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
                          c.drawImage(arte.bitmap, 0, 0, a.widthMm, a.heightMm); c.restore()
                        }} />
                    ))}
                  </Layer>
                )}
                {modoEd === 'tema' && textosForaDaFace.length > 0 && (
                  <Layer data-textos-fora>
                    {textosForaDaFace.map(t => {
                      const i = doc.artboards.findIndex(a => a.id === t.artboardId)
                      if (i < 0) return null
                      const pts = t.cantosMm!.flatMap(([x, y]) => [x + ps[i].xMm, y + ps[i].yMm])
                      // Lote 9 (item 144): um ÍCONE ⚠️ pequeno no canto do texto (antes, o rótulo "revise — …" e a caixa ficavam
                      // por cima da arte enquanto ela trabalhava). Passar o mouse ou clicar abre o motivo e os botões.
                      const xs = t.cantosMm!.map(c => c[0] + ps[i].xMm), ys = t.cantosMm!.map(c => c[1] + ps[i].yMm)
                      const ix = Math.max(...xs), iy = Math.min(...ys), r = 7 / viewport.escala
                      const abrir = () => setRevise({ slotId: t.slotId, motivo: t.aviso ?? 'o texto não coube direito', x: viewport.x + ix * viewport.escala, y: viewport.y + iy * viewport.escala + 80 })
                      return (
                        <Group key={t.slotId} data-revise={t.slotId}>
                          {/* Lote 8 (item 123): o contorno não pega o mouse (o texto embaixo se arrasta) */}
                          <Line points={pts} closed stroke="#dc2626" strokeWidth={1} dash={[4 / viewport.escala, 3 / viewport.escala]} strokeScaleEnabled={false} opacity={0.6} listening={false} />
                          <Group x={ix} y={iy} onMouseEnter={abrir} onClick={abrir} onTap={abrir} data-revise-icone>
                            <Circle radius={r} fill="#dc2626" stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} />
                            <KText x={-r} y={-r * 0.75} width={2 * r} align="center" text="!" fontSize={r * 1.5} fill="#ffffff" fontStyle="bold" listening={false} />
                          </Group>
                        </Group>
                      )
                    })}
                  </Layer>
                )}
                {caixaSel && caixaSel.visible && modoEd === 'imagem' && (
                  <Layer>
                    <Group x={ps[iPag].xMm} y={ps[iPag].yMm}>
                      <Rect key={`${caixaSel.id}:${caixaSel.xMm}:${caixaSel.yMm}`}
                        x={caixaSel.xMm + caixaSel.wMm / 2} y={caixaSel.yMm + caixaSel.hMm / 2} offsetX={caixaSel.wMm / 2} offsetY={caixaSel.hMm / 2}
                        width={caixaSel.wMm} height={caixaSel.hMm} rotation={rotSel}
                        stroke="#f97316" strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} fill="rgba(249,115,22,0.04)"
                        draggable={!caixaSel.locked}
                        onPointerDown={e => { e.evt.stopPropagation() }}
                        onDragEnd={e => {
                          const n = e.target
                          const r = (v: number) => Math.round(v * 100) / 100
                          const x = r(n.x() - caixaSel.wMm / 2), y = r(n.y() - caixaSel.hMm / 2)
                          editarCamada(caixaSel.id, 'Mover camada', c => { if (c.type === 'image' || c.type === 'solid' || c.type === 'text' || c.type === 'vshape') { c.xMm = x; c.yMm = y } })
                        }}
                        ref={caixaRef}
                        onTransformEnd={e => {
                          // Sprint 13: alças de escala e giro (como no SOA Design / Photoshop)
                          const n = e.target, r = (v: number) => Math.round(v * 100) / 100
                          const w = r(caixaSel.wMm * Math.abs(n.scaleX())), h = r(caixaSel.hMm * Math.abs(n.scaleY()))
                          const cx = n.x(), cy = n.y(), rot = Math.round(n.rotation() * 10) / 10
                          n.scaleX(1); n.scaleY(1)
                          editarCamada(caixaSel.id, 'Transformar camada', c => {
                            if (c.type !== 'image' && c.type !== 'solid' && c.type !== 'text' && c.type !== 'vshape') return
                            c.wMm = w; c.hMm = h; c.xMm = r(cx - w / 2); c.yMm = r(cy - h / 2)
                            if (c.type !== 'solid') c.rotationDeg = ((rot % 360) + 540) % 360 - 180
                          })
                        }}
                        data-contorno />
                      {!caixaSel.locked && <Transformer ref={transf} onPointerDown={() => { alcaAtiva.current = true }} rotateEnabled={caixaSel.type !== 'solid'} keepRatio={caixaSel.type === 'image'} flipEnabled={false} ignoreStroke anchorSize={8} borderStroke="#f97316" anchorStroke="#f97316" rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]} data-transformador />}
                    </Group>
                  </Layer>
                )}
              </Stage>
              </ProtecaoErro>
            )}
            {retangulo && <div className="pointer-events-none absolute z-20 border border-orange-500 bg-orange-400/10" style={{ left: Math.min(retangulo.x0, retangulo.x1), top: Math.min(retangulo.y0, retangulo.y1), width: Math.abs(retangulo.x1 - retangulo.x0), height: Math.abs(retangulo.y1 - retangulo.y0) }} data-retangulo-selecao />}
            <MenuPrancheta ps={ps} viewport={viewport} area={tam} edita={modoEd !== 'tema'} onOrganizar={m => { useMaeDoc.getState().aplicar(`Organizar pranchetas (${m})`, d => organizarPranchetas(d, m)); requestAnimationFrame(fazerAjustar) }} />
            {modoEd === 'tema' && <MenuCamadaTema />}
            {modoEd === 'tema' && <JanelaColarEstilo />}
            {revise && modoEd === 'tema' && (
              <div className="absolute z-20 max-w-xs rounded-lg border border-red-200 bg-white dark:bg-gray-900 p-2 text-[11px] shadow-lg space-y-1" style={{ left: Math.max(4, revise.x), top: Math.max(4, revise.y - 70) }} onMouseLeave={() => setRevise(null)} data-revise-motivo>
                <p><b className="text-red-700">Revise:</b> {revise.motivo}</p>
                <div className="flex flex-wrap gap-1">
                  <button className="rounded border border-gray-200 px-1.5 py-0.5 hover:border-orange-400" onClick={() => { useMaeTema.getState().aplicar('Diminuir o texto (só nesta caixa)', t => { const x = t as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[revise.slotId.split(':')[0]] ??= {}); a.scale = Math.max(0.2, Math.round((a.scale ?? 1) * 0.9 * 100) / 100) }); setRevise(null) }} data-revise-diminuir>Diminuir 10% nesta caixa</button>
                  <button className="rounded border border-gray-200 px-1.5 py-0.5 hover:border-orange-400" onClick={() => { const id = revise.slotId.split(':')[0], s = doc.textSlots.find(x => x.id === id); useEditor.getState().set({ slot: id, face: s?.faceId ?? null, camada: null }); setRevise(null) }} data-revise-selecionar>Selecionar o texto</button>
                </div>
              </div>
            )}
            <AvisoSemFace />
            <AvisoRapido />
            {folhasAplique && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-sky-200 bg-white/95 px-3 py-1 text-[11px] shadow" data-aviso-folhas-aplique>
                <span className="text-sky-700 font-semibold">Folhas de aplique (prévia, não vão no arquivo do tema)</span>
                <button className="rounded-full border border-gray-200 px-2 py-0.5 hover:border-orange-400" onClick={fecharFolhasAplique} data-fechar-folhas-palco>Fechar</button>
              </div>
            )}
          </div>
        </div>

        {/* painéis — Lote 4 (item 39): o da direita recolhe (fica montado: nada se perde) */}
        {!semPaineis && direitaFechada && (
          <button onClick={() => fecharDireita(false)} className="w-6 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-400 hover:text-orange-600 text-xs [writing-mode:vertical-rl]" title="Mostrar o painel de propriedades" data-abrir-direita>‹ Propriedades</button>
        )}
        <aside className={`w-80 shrink-0 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-5 overflow-y-auto relative ${semPaineis || direitaFechada ? 'hidden' : ''}`} data-painel-propriedades>
          <button onClick={() => fecharDireita(true)} className="absolute top-1 right-1 rounded px-1 text-xs text-gray-400 hover:text-orange-600" title="Recolher o painel de propriedades" aria-label="Recolher o painel" data-recolher-direita>»</button>
          <ProtecaoErro nome="Painel de propriedades">
          {comFuncoes
            ? modoEd === 'tema' && <LadoPainel lado="propriedades"><PainelTema /></LadoPainel>
            : <>
              {modoEd === 'base' && <PainelBase />}
              {modoEd === 'tema' && <><PainelTema /><PainelTemaPronto /><PainelExportar /><PainelLoja /></>}
            </>}
          {modoEd === 'imagem' && <><PainelDesign /><PainelCamadas /><ExportarImagem />
            <details className="text-xs text-gray-500" data-avancado-motor><summary className="cursor-pointer">Avançado: teste do motor</summary><div className="pt-2"><PainelMotor /></div></details></>}
          </ProtecaoErro>
          {/* Lote 4 (item 40): sem ferramentas de teste; a pasta só aparece aqui quando precisa reconectar */}
          <PainelBiblioteca modo="aviso" />
        </aside>
      </div>

      {pergunta && <PerguntaEscopo parte={pergunta.parte} />}
      <AbrirBase />
      <PerguntaSalvar />
      {/* proteção contra perda (12/10/2026): rascunho automático + "Recuperar trabalho não salvo?" */}
      <RascunhoAutomatico />
      <RecuperarRascunhos />
      <AvisoVersaoNova />
      {escolherTipoBase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-escolher-tipo-base onClick={() => setEscolherTipoBase(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold">Que tipo de base?</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-orange-400" onClick={() => criarBase('caixas')} data-tipo-base="caixas">
                <b className="text-sm">Caixas e moldes</b><p className="text-[11px] text-gray-500 mt-1">Importar o molde (PDF, SVG, DXF), detectar as faces e montar as partes — milk, cubo, maleta…</p>
              </button>
              <button className="rounded-xl border border-orange-300 bg-orange-50/60 dark:bg-orange-950/20 p-3 text-left hover:border-orange-500" onClick={() => criarBase('medida')} data-tipo-base="medida">
                <b className="text-sm">Peças por medida</b><p className="text-[11px] text-gray-500 mt-1">Etiquetas escolares, tags, rótulos (tubete, Nutella, Pringles…): escolha as medidas — sem molde.</p>
              </button>
            </div>
          </div>
        </div>
      )}
      {tutorial.aberto && <TutorialMae onFechar={tutorial.fechar} />}
      {calibrando && <Calibracao atual={calib} onFechar={() => setCalibrando(false)} onSalvar={k => { setCalib(k); setCalibrando(false) }} />}
    </div>
  )
}

/** "Todas as FRENTES" ou "Só nesta caixa"? (com "lembrar escolha") — spec, Partes e vínculo. */
function PerguntaEscopo({ parte }: { parte: string }) {
  const [lembrar, setLembrar] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" data-pergunta-escopo>
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-xl space-y-3 max-w-sm w-full">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Esta mudança vale para…</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-xl border-2 border-orange-400 bg-orange-50 px-3 py-3 text-sm font-semibold text-orange-800" onClick={() => responderEscopo('parte', lembrar)} data-resposta="parte">Todas as {parte}</button>
          <button className="rounded-xl border-2 border-gray-300 px-3 py-3 text-sm font-semibold text-gray-800 dark:text-gray-100" onClick={() => responderEscopo('face', lembrar)} data-resposta="face">Só nesta caixa</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={lembrar} onChange={() => setLembrar(!lembrar)} className="accent-orange-500" /> Lembrar a escolha</label>
        <button className="text-xs text-gray-500 underline" onClick={() => useEditor.getState().set({ pergunta: null })}>Cancelar</button>
      </div>
    </div>
  )
}

/** Tempo da última prévia (o "< 0,3 s" da Sprint 6, à vista). */
function PreviaInfo() {
  const p = useEditor(s => s.previa)
  const modo = useEditor(s => s.modo)
  return (
    <>
      {p && modo !== 'imagem' && <span className="text-[11px] tabular-nums text-gray-400" title={`Recalcular a arte: ${p.resolverMs ?? '—'} ms · desenhar: ${p.desenhoMs ?? '—'} ms (${p.redesenhadas ?? p.folhas} de ${p.folhas} folhas)`} data-previa-ms={p.ms}>atualizado em {p.ms} ms</span>}
    </>
  )
}

/** PNG com transparência = elemento; foto/papel opaco = papel. */
async function temTransparencia(f: File): Promise<boolean> {
  if (!/png|webp/i.test(f.type)) return false
  const b = await createImageBitmap(f)
  const w = Math.min(64, b.width), h = Math.min(64, b.height)
  const c = new OffscreenCanvas(w, h); const g = c.getContext('2d')!
  g.drawImage(b, 0, 0, w, h); b.close()
  const d = g.getImageData(0, 0, w, h).data
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true
  return false
}

/**
 * Lote 6 (item 84): clicou numa área do molde que não é face — explica (a linha do molde está aberta, então a área
 * não fecha) e oferece "Criar face aqui" (fecha a fresta só ali).
 */
function AvisoSemFace() {
  const sf = useMoldes(s => s.semFace)
  const ocupado = useMoldes(s => s.ocupado)
  if (!sf) return null
  const nome = useMaeDoc.getState().hist.atual.molds.find(m => m.id === sf.moldeId)?.name ?? 'molde'
  async function criar() {
    const r = await criarFaceAqui(sf!.moldeId, sf!.ponto)
    useMoldes.getState().set({ semFace: r === null ? { ...sf!, msg: 'Não achei uma área fechada aqui, nem fechando frestas de até 4,5 mm. Use o Laço (Base → Faces) para desenhar a face.' } : null })
    if (r !== null) useEditor.getState().set({ face: null })
  }
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 max-w-md rounded-xl border border-red-200 bg-white/95 dark:bg-gray-900/95 px-3 py-2 text-[11px] shadow space-y-1" data-aviso-sem-face>
      <p><b className="text-red-700">Esta área não é uma face</b> ({nome}): a linha do molde está <b>aberta</b> aqui (tem uma fresta), então a área não fecha e o sistema não a reconhece como face.</p>
      {sf.msg && <p className="text-amber-700">{sf.msg}</p>}
      <div className="flex gap-1.5">
        <button className="rounded-lg bg-orange-500 px-2 py-1 font-semibold text-white disabled:opacity-50" disabled={!!ocupado} onClick={() => void criar()} data-criar-face-aqui>{ocupado ? 'Procurando…' : 'Criar face aqui'}</button>
        <button className="rounded-lg border border-gray-200 px-2 py-1" onClick={() => useMoldes.getState().set({ semFace: null })}>Fechar</button>
      </div>
    </div>
  )
}


/** Lote 9 (item 145): "Colar estilo…" — escolher o que colar (só aparece o que serve para os selecionados). */
function JanelaColarEstilo() {
  const aberto = useEditor(s => s.colarEstiloAberto)
  const [marcadas, setMarcadas] = useState<CategoriaEstilo[] | null>(null)
  if (!aberto) return null
  const cats = categoriasParaColar()
  const sel = marcadas ?? cats
  const fechar = () => { setMarcadas(null); useEditor.getState().set({ colarEstiloAberto: false }) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onMouseDown={e => { if (e.target === e.currentTarget) fechar() }} data-janela-colar-estilo>
      <div className="w-72 space-y-2 rounded-lg bg-white p-3 text-xs shadow-xl dark:bg-gray-900">
        <p className="font-semibold">Colar estilo…</p>
        {!cats.length && <p className="text-gray-500">Nada do estilo copiado serve para o que está selecionado.</p>}
        {cats.map(c => (
          <label key={c} className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={sel.includes(c)} onChange={e => setMarcadas(e.target.checked ? [...sel, c] : sel.filter(x => x !== c))} data-cat-estilo={c} /> {ROTULO_CATEGORIA[c]}
          </label>
        ))}
        <p className="text-[10px] text-gray-500">Os efeitos se ajustam ao tamanho de cada item.</p>
        <div className="flex justify-end gap-2">
          <button className="rounded border px-2 py-1" onClick={fechar}>Cancelar</button>
          <button className="rounded bg-orange-500 px-2 py-1 text-white disabled:opacity-40" disabled={!sel.length} onClick={() => { colarEstilo(sel); fechar() }} data-colar-estilo-ok>Colar</button>
        </div>
      </div>
    </div>
  )
}

/** Lote 10 (item 153): o aviso rápido do palco (ex.: "Espelhar na horizontal não vale para texto."). */
function AvisoRapido() {
  const msg = useEditor(s => s.avisoRapido)
  const botao = useEditor(s => s.avisoBotao)
  if (!msg) return null
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-gray-900/85 px-3 py-1 text-[11px] text-white shadow" role="status" data-aviso-rapido>
      {msg}
      {/* Lote 10 (item 159): ação no aviso ("Excluir de todas as caixas") */}
      {botao && <button className="rounded-full bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25" onClick={() => { useEditor.getState().set({ avisoRapido: null, avisoBotao: null }); botao.acao() }} data-aviso-botao>{botao.rotulo}</button>}
    </div>
  )
}

/** Lote 10 (item 152): o menu do botão direito num TEXTO do tema — os mesmos itens dos outros objetos. */
function MenuTextoTema() {
  const menu = useEditor(s => s.menuCamada)
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const temEstilo = useEditor(s => !!s.estiloCopiado)
  const id = menu?.texto
  const slot = id ? doc.textSlots.find(x => x.id === id) : null
  if (!menu || !id || !slot) return null
  const aj = tema?.textSlotAdjust?.[id] ?? {}
  const fechar = () => useEditor.getState().set({ menuCamada: null })
  const fazer = (f: () => void) => () => { fechar(); f() }
  const item = 'w-full text-left px-3 py-1 hover:bg-orange-50'
  const nome = slot.variable === 'NOME_IDADE' ? 'Nome + idade' : slot.variable
  return (
    <div className="fixed z-50 min-w-[12rem] rounded-lg border border-gray-200 bg-white dark:bg-gray-900 py-1 text-xs shadow-lg" style={{ left: menu.x, top: menu.y }} data-menu-camada data-menu-texto={slot.variable}>
      <p className="px-3 py-1 text-[10px] uppercase text-gray-400 truncate">Texto · {nome}</p>
      <button className={item} onClick={fazer(() => reordenar(`t:${id}`, 'frente', 'Trazer para frente'))} data-menu-frente>Trazer para frente <span className="text-gray-400">(Ctrl+])</span></button>
      <button className={item} onClick={fazer(() => reordenar(`t:${id}`, 'tras', 'Enviar para trás'))} data-menu-tras>Enviar para trás <span className="text-gray-400">(Ctrl+[)</span></button>
      <button className={item} onClick={fazer(() => reordenar(`t:${id}`, 'topo', 'Trazer para o topo'))} data-menu-topo>Trazer para o topo</button>
      <button className={item} onClick={fazer(() => reordenar(`t:${id}`, 'fundo', 'Enviar para o fundo'))} data-menu-fundo>Enviar para o fundo</button>
      <div className="my-1 border-t border-gray-100" />
      <button className={item} onClick={fazer(() => duplicarTexto(id))} data-menu-duplicar>Duplicar <span className="text-gray-400">(Ctrl+J)</span></button>
      <button className={item} onClick={fazer(() => { useEditor.getState().set({ slot: id, camada: null }); copiarEstilo() })} data-menu-copiar-estilo>Copiar estilo <span className="text-gray-400">(Ctrl+Alt+C)</span></button>
      {temEstilo && <>
        <button className={item} onClick={fazer(() => { useEditor.getState().set({ slot: id, camada: null }); colarEstilo() })} data-menu-colar-estilo>Colar estilo <span className="text-gray-400">(Ctrl+Alt+V)</span></button>
        <button className={item} onClick={() => useEditor.getState().set({ menuCamada: null, slot: id, camada: null, colarEstiloAberto: true })} data-menu-colar-estilo-escolher>Colar estilo…</button>
      </>}
      <div className="my-1 border-t border-gray-100" />
      <button className={item} onClick={fazer(() => alternarOlho({ slot: id }))} data-menu-olho>{aj.hidden ? 'Mostrar' : 'Ocultar'} <span className="text-gray-400">(Ctrl+,)</span></button>
      <button className={item} onClick={fazer(() => alternarCadeado({ slot: id }))} data-menu-cadeado>{aj.locked ? 'Destravar' : 'Travar'} <span className="text-gray-400">(Ctrl+/)</span></button>
      <button className="w-full text-left px-3 py-1 hover:bg-red-50 text-red-600" onClick={() => { useEditor.getState().set({ menuCamada: null, slot: id, camada: null }); excluirSelecionado() }} data-menu-excluir>Excluir <span className="text-gray-400">(Delete)</span></button>
    </div>
  )
}

/** Menu do botão direito sobre um elemento do tema (Lote 2, item 16): "É aplique 3D" e "Pode vazar da face". */
function MenuCamadaTema() {
  const menu = useEditor(s => s.menuCamada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const temEstilo = useEditor(s => !!s.estiloCopiado)
  useEffect(() => {
    if (!menu) return
    const fechar = (e: MouseEvent) => { if (!(e.target as HTMLElement)?.closest?.('[data-menu-camada]')) useEditor.getState().set({ menuCamada: null }) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') useEditor.getState().set({ menuCamada: null }) }
    window.addEventListener('mousedown', fechar); window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', fechar); window.removeEventListener('keydown', esc) }
  }, [menu])
  if (menu?.texto) return <MenuTextoTema />
  const a = menu && tema ? acharCamadaTema(tema, menu.camada) : null
  if (!menu || !a) return null
  const c = a.c
  // Lote 10 (item 156): forma também pode ser aplique 3D
  const ehImagem = (c.type === 'image' || c.type === 'shape') && (c.anchor ?? 'face') !== 'paper'
  const mudar = (label: string, f: (x: typeof c) => void) => useMaeTema.getState().aplicar(label, t => { const x = acharCamadaTema(t as never, menu.camada); if (x) f(x.c as typeof c) })
  // Lote 6 (item 81): ordem das camadas no clique direito
  const ordem = (para: 'frente' | 'tras' | 'topo' | 'fundo', label: string) => {
    useEditor.getState().set({ menuCamada: null })
    reordenar(c.id, para, label)
  }
  const item = 'w-full text-left px-3 py-1 hover:bg-orange-50'
  return (
    <div className="fixed z-50 min-w-[12rem] rounded-lg border border-gray-200 bg-white dark:bg-gray-900 py-1 text-xs shadow-lg" style={{ left: menu.x, top: menu.y }} data-menu-camada>
      <p className="px-3 py-1 text-[10px] uppercase text-gray-400 truncate">{nomeDaCamada(c as never)}</p>
      <button className={item} onClick={() => ordem('frente', 'Trazer para frente')} data-menu-frente>Trazer para frente <span className="text-gray-400">(Ctrl+])</span></button>
      <button className={item} onClick={() => ordem('tras', 'Enviar para trás')} data-menu-tras>Enviar para trás <span className="text-gray-400">(Ctrl+[)</span></button>
      <button className={item} onClick={() => ordem('topo', 'Trazer para o topo')} data-menu-topo>Trazer para o topo</button>
      <button className={item} onClick={() => ordem('fundo', 'Enviar para o fundo')} data-menu-fundo>Enviar para o fundo</button>
      <div className="my-1 border-t border-gray-100" />
      {/* Lote 9 (itens 137/138) */}
      <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null }); duplicarCamada(c.id) }} data-menu-duplicar>Duplicar <span className="text-gray-400">(Ctrl+J)</span></button>
      {vale('espelharH', tipoDaCamada(tema, c)) && <>
        <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null }); espelharCamada(c.id, 'x') }} data-menu-espelhar="x">Espelhar na horizontal <span className="text-gray-400">(Shift+H)</span></button>
        <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null }); espelharCamada(c.id, 'y') }} data-menu-espelhar="y">Espelhar na vertical <span className="text-gray-400">(Shift+V)</span></button>
      </>}
      {/* Lote 9 (item 145): copiar e colar estilo */}
      <div className="my-1 border-t border-gray-100" />
      <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null }); copiarEstilo() }} data-menu-copiar-estilo>Copiar estilo <span className="text-gray-400">(Ctrl+Alt+C)</span></button>
      {temEstilo && <>
        <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null }); colarEstilo() }} data-menu-colar-estilo>Colar estilo <span className="text-gray-400">(Ctrl+Alt+V)</span></button>
        <button className={item} onClick={() => useEditor.getState().set({ menuCamada: null, colarEstiloAberto: true })} data-menu-colar-estilo-escolher>Colar estilo…</button>
      </>}
      <div className="my-1 border-t border-gray-100" />
      {ehImagem && <>
      <label className="flex items-center gap-2 px-3 py-1 hover:bg-orange-50 cursor-pointer"><input type="checkbox" checked={!!c.applique?.enabled} onChange={e => mudar(e.target.checked ? 'Marcar como aplique 3D' : 'Tirar aplique 3D', x => { if (x.type !== 'image' && x.type !== 'shape') return; if (e.target.checked) x.applique = { ...(x.applique ?? {}), enabled: true }; else delete x.applique })} data-menu-aplique /> É aplique 3D</label>
      <label className="flex items-center gap-2 px-3 py-1 hover:bg-orange-50 cursor-pointer"><input type="checkbox" checked={!!c.bleed} onChange={e => mudar(e.target.checked ? 'Pode vazar da face' : 'Recortar na face', x => { if (e.target.checked) x.bleed = true; else delete x.bleed })} data-menu-vazar /> Pode vazar da face</label>
      </>}
      {/* Lote 10 (item 155): recortar / mascarar (forma da face; no painel: seleção retangular, elíptica e laço) */}
      {(c.anchor ?? 'face') !== 'paper' && <button className={item} onClick={() => { useEditor.getState().set({ menuCamada: null, camada: c.id, slot: null }); mascaraDaFace(c.id) }} title="A camada só aparece dentro desta caixa. Para recortar uma parte (retângulo, elipse, laço): painel da direita → Recortar / selecionar" data-menu-mascara-face>Recortar pela forma da face</button>}
      {vale('mascaraCorte', tipoDaCamada(tema, c)) && <button className="w-full text-left px-3 py-1 hover:bg-orange-50" onClick={() => { alternarMascaraDeCorte(c.id); useEditor.getState().set({ menuCamada: null }) }} data-menu-mascara-corte>
        {(c as { recortada?: boolean }).recortada ? 'Soltar máscara de corte' : 'Criar máscara de corte'} <span className="text-gray-400">(Ctrl+Alt+G)</span>
      </button>}
      {/* Lote 10 (item 159): camada da PARTE com a caixa clicada — ocultar só aqui × excluir de todas (claro, sem surpresa) */}
      {soNestaCaixa(c.id) ? <>
        <button className="w-full text-left px-3 py-1 hover:bg-orange-50" onClick={() => { useEditor.getState().set({ menuCamada: null, camada: c.id, slot: null }); excluirSelecionado() }} data-menu-ocultar-caixa>
          Ocultar nesta caixa <span className="text-gray-400">(Delete)</span>
        </button>
        <button className="w-full text-left px-3 py-1 hover:bg-red-50 text-red-600" onClick={() => { useEditor.getState().set({ menuCamada: null, camada: c.id, slot: null }); excluirDeTodas(c.id) }} data-menu-excluir-todas>
          Excluir de todas as caixas
        </button>
      </> : <button className="w-full text-left px-3 py-1 hover:bg-red-50 text-red-600" onClick={() => { useEditor.getState().set({ menuCamada: null, camada: c.id, slot: null }); excluirSelecionado() }} data-menu-excluir>
        Excluir <span className="text-gray-400">(Delete)</span>
      </button>}
    </div>
  )
}

// setas: ajuste fino do que está selecionado (posição de texto, logo/QR, texto ou camada do tema). Shift = maior.
/** A camada do tema está travada (cadeado)? */
function camadaTravada(id: string): boolean {
  const t = useMaeTema.getState().hist?.atual
  return !!(t && (acharCamadaTema(t as DocTema, id)?.c as { locked?: boolean } | undefined)?.locked)
}

function moverComSetas(tecla: string, grande: boolean): boolean {
  const ed = useEditor.getState()
  const [ux, uy] = tecla === 'ArrowLeft' ? [-1, 0] : tecla === 'ArrowRight' ? [1, 0] : tecla === 'ArrowUp' ? [0, -1] : [0, 1]
  const f = grande ? 0.05 : 0.005, mm = grande ? 5 : 0.5, r3 = (x: number) => Math.round(x * 1000) / 1000
  if (ed.modo === 'base' && ed.passo === 6 && ed.slot) {
    useMaeDoc.getState().aplicar('Mover texto (setas)', d => { const s = d.textSlots.find(x => x.id === ed.slot); if (s) { s.box.x = r3(s.box.x + ux * f); s.box.y = r3(s.box.y + uy * f) } }, `setas:${ed.slot}`)
    return true
  }
  if (ed.modo === 'base' && ed.passo === 7 && ed.identSel) {
    const { moldeId, k } = ed.identSel
    useMaeDoc.getState().aplicar('Mover identidade (setas)', d => { const p = d.molds.find(x => x.id === moldeId)?.identity?.[k]; if (p) { p.xMm = Math.round((p.xMm + ux * mm) * 100) / 100; p.yMm = Math.round((p.yMm + uy * mm) * 100) / 100 } }, `setas:${moldeId}:${k}`)
    return true
  }
  const msel = useMoldes.getState().sel
  if (ed.modo === 'base' && ed.passo <= 3 && msel.length) {
    moverMoldes('Mover molde (setas)', new Map(msel.map(id => [id, { dx: ux * mm, dy: uy * mm }])), `setas:moldes:${msel.join(',')}`)
    return true
  }
  // Lote 6 (item 80): no Ajustar da edição em massa as setas mexem SÓ NO PEDIDO (antes gravavam no tema)
  if (ed.modo === 'tema' && ed.slot && usePedidoAberto.getState().ajustar && usePedidoAberto.getState().pedido) {
    ajustarTextoDoPedido(ed.slot, a => { a.dx = r3((a.dx ?? 0) + ux * f); a.dy = r3((a.dy ?? 0) + uy * f) }, `setas:${ed.slot}`, 'Mover texto (só neste pedido)')
    return true
  }
  if (ed.modo === 'tema' && ed.slot && useMaeTema.getState().hist) {
    if (useMaeTema.getState().hist?.atual.textSlotAdjust?.[ed.slot]?.locked) return true
    useMaeTema.getState().aplicar('Mover texto (só nesta caixa)', t => { const x = t as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[ed.slot!] ??= {}); a.dx = r3((a.dx ?? 0) + ux * f); a.dy = r3((a.dy ?? 0) + uy * f) }, `setas:${ed.slot}`)
    return true
  }
  // Lote 8 (item 123): camada do tema selecionada (elemento, aplique, forma, moldurinha) também anda com as setas
  if (ed.modo === 'tema' && ed.camada && useMaeTema.getState().hist) {
    const t = useMaeTema.getState().hist!.atual as DocTema
    const a = acharCamadaTema(t, ed.camada)
    if (!a || (a.c as { locked?: boolean }).locked) return !!a
    const naFace = !a.faceId && ed.face && ed.escopo === 'face' ? (t.localOverrides?.[ed.face]?.[ed.camada] as { transform?: { x?: number; y?: number } } | undefined) : undefined
    const base0 = { x: 0.5, y: 0.5, ...(a.c.transform ?? {}), ...(naFace?.transform ?? {}) }
    const fx = (a.c as { anchor?: string }).anchor === 'paper' ? f / 2 : f
    editarCamadaTema(ed.camada, { transform: { x: r3(base0.x + ux * fx), y: r3(base0.y + uy * f) } }, 'Mover (setas)', `setas:${ed.camada}`)
    return true
  }
  return false
}
