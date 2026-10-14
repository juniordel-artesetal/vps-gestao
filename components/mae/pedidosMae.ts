'use client'
// PEDIDOS → ARTE no navegador (Sprint 12): conversa com /api/mae/{pedidos,vinculos,addons}, acha o tema de
// cada pedido, abre tema + base (da Biblioteca; se não estiverem neste computador, da nuvem), gera a arte
// com o MESMO exportador do painel e registra no card (status + nome do arquivo + versão do tema).
import { criarHistorico, aplicar as aplicarHist, desfazer as desfazerHist, refazer as refazerHist, type Historico, type Passo } from '@/lib/mae/editor/historico'
import { anotar, esquecer, passoNovo, alteradoDesde, topoDe } from '@/lib/mae/editor/linhaDoTempo'
import { create } from 'zustand'
import { camposDoPedido, variaveis, alvosDoPedido, alertasDaLinha, type AlvoPedido, type CamposMae, type TemaAchado, type TemaLista, type Vinculo, type ArteRegistro } from '@/lib/mae/pedidos/pedidos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { listarBases, listarTemas, type Identidade, versaoBasesSalvas } from './arquivosMae'
import { sync, type MarcaRegistro } from './sincronia'
import { exportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'
import { mensagemDeErro } from '@/lib/mae/erros'
import type { EstiloTexto } from '@/lib/mae/texto/noTexto'

export type PosicaoPedido = { dx?: number; dy?: number; scale?: number; rotationDeg?: number; lines?: 1 | 2 }
export type TrocaPedido = { letra: string; so?: 'inicial' | 'todas'; fonte?: { postscriptName: string; family?: string; source?: 'local' | 'google'; url?: string }; gid?: number; escala?: number; baselineMm?: number; espacoMm?: number }
export interface PedidoApi {
  id: string; numero: string; cliente: string | null; status: string; criado: string
  /** Lote 5 (item 78): a observação do pedido no SOA. */
  observacoes?: string | null
  campos: Record<string, string>
  /** Lote 5 (item 79): peças da linha (`quantidade`), kits vendidos (`qtdVendida`) e peças do kit da Precificação. */
  itens: { nome: string; variacaoId: string | null; produtoId: string | null; produto?: string | null; variacao?: string | null; quantidade?: number | null; qtdVendida?: number | null; pecasKit?: number | null }[]
  artes: ArteRegistro[]
  /** Lote 1: tamanho do texto só deste pedido (NOME, IDADE, HASHTAG, ARROBA → fator). Lote 5: quantidades por
   *  caixa (por produto), posições ajustadas (botão Ajustar) e o formato da idade só deste pedido. */
  ajustes?: { escalas?: Record<string, number>; linhas?: Record<string, '1' | '2'>; quantidades?: Record<string, Record<string, number>>; posicoes?: Record<string, PosicaoPedido>; formatoIdade?: 'anos' | 'aninhos' | 'numero' | null; trocas?: Record<string, TrocaPedido[]>; estilos?: Record<string, EstiloTexto>; temaId?: string | null; divisaoNome?: number | null }
  /** Lote 7 (itens 116/120): de onde veio (SOA, planilha da Shopee, cadastro manual), canal/loja, prazo de envio
   *  (AAAA-MM-DD), a etapa atual na produção do SOA e o status do MAE avulso (gerado/impresso). */
  origem?: 'soa' | 'shopee' | 'manual'; canal?: string | null; loja?: string | null; dataEnvio?: string | null
  etapa?: { nome: string; tipo: string | null } | null; statusMae?: 'pendente' | 'gerado' | 'impresso' | null
}
export interface EstadoAddon { ativo: boolean; origem: string | null; preco: number | null }
export interface Addons { addons: { criacao: EstadoAddon; massa: EstadoAddon }; ehNaty: boolean; /** Lote 7 (item 120): SOA completo ou só o MAE. */ plano?: 'soa' | 'mae' }
export interface EtapaImpressao { id: string; nome: string; ordem: number; tipo: string | null }
/** Lote 7 (itens 120/121): pedido novo do MAE avulso (cadastro manual ou planilha). */
export interface NovoPedido { origem: 'manual' | 'shopee'; numero: string; cliente?: string | null; canal?: string | null; loja?: string | null; itens: { nome: string; variacao?: string | null; quantidade?: number | null }[]; dataEnvio?: string | null; observacao?: string | null; campos?: Record<string, string> }
export type ResumoStatus = Partial<Record<'movido' | 'ja_adiante' | 'finalizado' | 'sem_etapa' | 'nao_encontrado' | 'impresso', number>>

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { status: r.status })
  return j as T
}
export const apiMae = {
  addons: () => api<Addons>('/api/mae/addons'),
  pedidos: () => api<{ pedidos: PedidoApi[] }>('/api/mae/pedidos').then(r => r.pedidos),
  pedido: (id: string) => api<{ pedidos: PedidoApi[] }>(`/api/mae/pedidos?id=${encodeURIComponent(id)}`).then(r => r.pedidos[0]),
  registrarArte: (a: { orderId: string; themeId: string; themeVersion: number; variaveis: Record<string, string>; status: 'gerada' | 'revisar' | 'erro'; arquivo: string | null }) => api('/api/mae/pedidos/arte', { method: 'POST', body: JSON.stringify(a) }),
  vinculos: () => api<{ vinculos: (Vinculo & { id: string; produto: string | null; variacao: string | null })[] }>('/api/mae/vinculos').then(r => r.vinculos),
  vincular: (v: Vinculo) => api('/api/mae/vinculos', { method: 'PUT', body: JSON.stringify(v) }),
  /** Tamanho do texto só neste pedido (null tira o ajuste). */
  ajustarPedido: (id: string, escalas: Record<string, number | null>) => api<{ escalas: Record<string, number> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, escalas }) }),
  /** Lote 4 (item 50): nome composto em 1 ou 2 linhas só neste pedido (null = automático). */
  linhasPedido: (id: string, linhas: Record<string, '1' | '2' | null>) => api<{ linhas: Record<string, '1' | '2'> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, linhas }) }),
  /** Lote 4 (item 43): NOME, IDADE e TEMA preenchidos na lista — gravados no pedido (campo que o ateliê usa).
   *  Lote 5 (item 77): também a FRASE e os campos extras. */
  salvarCampos: (id: string, campos: Record<string, string>) => api<{ campos: Record<string, string> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, campos }) }),
  /** Lote 5 (item 79): quantidade de cada caixa, por produto (null tira as de um produto). */
  quantidades: (id: string, quantidades: Record<string, Record<string, number> | null>) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, quantidades }) }),
  /** Lote 5 (item 59): posição ajustada só neste pedido ({ '*': null } tira todas). */
  /** Lote 6 (item 88): tema escolhido SÓ para este pedido (null = volta ao automático). */
  /** Lote 6 (item 93): palavras no NOME (o resto vai para o SOBRENOME); 0 = sem sobrenome; null = automático. */
  divisaoNome: (id: string, divisaoNome: number | null) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, divisaoNome }) }),
  temaPedido: (id: string, temaId: string | null) => api<{ temaId: string | null }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, temaId }) }),
  posicoes: (id: string, posicoes: Record<string, PosicaoPedido | null>) => api<{ posicoes: Record<string, PosicaoPedido> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, posicoes }) }),
  /** Lote 5 (item 62): formato da idade só neste pedido (null = o do tema). */
  formatoIdade: (id: string, formatoIdade: 'anos' | 'aninhos' | 'numero' | null) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, formatoIdade }) }),
  /** Lote 5 (item 75): letra trocada só neste pedido, por variável (null tira). */
  trocas: (id: string, trocas: Record<string, TrocaPedido[] | null>) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, trocas }) }),
  /** Lote 13 (item 178): estilo do texto só neste pedido (null tira). */
  estilos: (id: string, estilos: Record<string, EstiloTexto | null>) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, estilos }) }),
  /** Lote 7 (item 116): o mesmo tema em vários pedidos (null = volta ao automático). */
  temaEmMassa: (ids: string[], temaId: string | null) => api<{ atualizados: number }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ ids, temaId }) }),
  /** Lote 7 (itens 119/120): iniciar a etapa Impressão / marcar como impresso (SOA ou status do MAE avulso). */
  status: (ids: string[], acao: 'iniciar_impressao' | 'impresso' | 'gerado') => api<{ resumo: ResumoStatus }>('/api/mae/pedidos/status', { method: 'POST', body: JSON.stringify({ ids, acao }) }).then(r => r.resumo),
  /** Lote 7 (item 119): a etapa de Impressão do fluxo (null = não tem) e o plano. */
  etapaImpressao: () => api<{ plano: 'soa' | 'mae'; etapa: EtapaImpressao | null }>('/api/mae/pedidos/status'),
  criarEtapaImpressao: () => api<{ criada: boolean; etapa: EtapaImpressao }>('/api/mae/pedidos/status', { method: 'PUT' }),
  /** Lote 7 (itens 120/121): pedidos do MAE avulso (cadastro manual / planilha); o mesmo nº não se repete. */
  criarPedidos: (pedidos: NovoPedido[]) => api<{ novos: number; existentes: number; invalidos: number }>('/api/mae/pedidos/manual', { method: 'POST', body: JSON.stringify({ pedidos }) }),
}

// ── temas e bases: Biblioteca primeiro, nuvem depois ─────────────────────────────────────────────
export interface TemaDisponivel extends TemaLista { doc?: DocTema; baseId?: string; baseNome?: string }

export async function temasDisponiveis(raiz: FileSystemDirectoryHandle | null): Promise<TemaDisponivel[]> {
  const out = new Map<string, TemaDisponivel>()
  if (raiz) for (const t of await listarTemas(raiz).catch(() => [])) out.set(t.doc.id, { id: t.doc.id, name: t.doc.name ?? t.doc.id, version: t.doc.version, doc: t.doc, baseId: t.doc.baseId, ...(t.doc.produto ? { produto: t.doc.produto } : {}) })
  for (const t of await sync.listarTemas()) if (!out.has(t.id) || (out.get(t.id)!.version < t.version)) out.set(t.id, { ...(out.get(t.id) ?? {}), id: t.id, name: t.nome, version: t.version, baseId: t.base_id, doc: out.get(t.id)?.version === t.version ? out.get(t.id)!.doc : undefined })
  // Lote 6 (item 97): o seletor mostra "Tema · base" (temas com o mesmo nome em bases diferentes)
  if (raiz) {
    const bases = new Map((await listarBases(raiz).catch(() => [])).map(b => [b.doc.id, b.doc.name ?? '']))
    for (const t of out.values()) if (t.baseId && bases.get(t.baseId)) t.baseNome = bases.get(t.baseId)
  }
  // Lote 13 (itens 181/186): arquivado não entra nos seletores (a lixeira já sai na listagem)
  return [...out.values()].filter(t => !t.doc?.arquivado).sort((a, b) => a.name.localeCompare(b.name))
}

const cacheBases = new Map<string, DocTrabalho>()
let cacheDaVersao = -1
export async function abrirTemaEBase(raiz: FileSystemDirectoryHandle | null, t: TemaDisponivel): Promise<{ tema: DocTema; base: DocTrabalho }> {
  // Lote 5 (item 58): base salva depois de entrar aqui (ex.: NOME colocado em todas as páginas) → relê
  if (cacheDaVersao !== versaoBasesSalvas) { cacheBases.clear(); cacheDaVersao = versaoBasesSalvas }
  const tema = t.doc ?? await sync.abrirTema(t.id)
  const chave = `${tema.baseId}@${tema.baseVersion}`
  let base = cacheBases.get(chave)
  if (!base && raiz) {
    const locais = (await listarBases(raiz).catch(() => [])).filter(b => b.doc.id === tema.baseId)
    base = (locais.find(b => b.doc.version === tema.baseVersion) ?? locais.sort((a, b) => b.doc.version - a.doc.version)[0])?.doc
  }
  if (!base) base = await sync.abrirBase(tema.baseId, tema.baseVersion).catch(() => sync.abrirBase(tema.baseId))
  if (!base) throw new Error(`A base do tema "${tema.name}" não está neste computador nem na nuvem.`)
  cacheBases.set(chave, base)
  return { tema, base }
}

// ── linha de um pedido (tema achado, variáveis, alertas) ─────────────────────────────────────────
export interface LinhaPedido {
  pedido: PedidoApi; campos: CamposMae
  /** O tema do 1º produto (o da linha); com vários produtos, cada um tem o seu em `alvos`. */
  tema: TemaAchado | null
  /** Lote 4 (item 44): um alvo por PRODUTO do pedido (Kit Festa + Sacola P = 2 arquivos). */
  alvos: AlvoPedido[]
  /** Valores editados na linha (NOME, IDADE, HASHTAG e — Lote 5 — FRASE e campos extras). */
  editadas: Partial<Record<string, string>>
  alertas: string[]
  /** Lote 1: tamanho do texto só deste pedido. */
  escalas?: Record<string, number>
  /** Lote 4 (item 50): nome composto em 1 ou 2 linhas só deste pedido. */
  linhas?: Record<string, '1' | '2'>
  /** Lote 5 (item 79): quantidades por caixa (por produto) salvas no pedido. */
  quantidades?: Record<string, Record<string, number>>
  /** Lote 5 (item 59): posições ajustadas só neste pedido. */
  posicoes?: Record<string, PosicaoPedido>
  /** Lote 5 (item 62): formato da idade só neste pedido. */
  formatoIdade?: 'anos' | 'aninhos' | 'numero' | null
  /** Lote 5 (item 75): letras trocadas só neste pedido. */
  trocas?: Record<string, TrocaPedido[]>
  /** Lote 13 (item 178): estilo do texto só neste pedido. */
  estilos?: Record<string, EstiloTexto>
  /** Lote 6 (item 88): tema escolhido SÓ para este pedido (vale mais que o vínculo e o apelido). */
  temaPedido?: string | null
  /** Lote 6 (item 93): divisão NOME × SOBRENOME só deste pedido. */
  divisaoNome?: number | null
}
export function linhaDoPedido(p: PedidoApi, temas: TemaDisponivel[], vinc: Vinculo[], apelidos: Record<string, string> = {}): LinhaPedido {
  const campos = camposDoPedido(p.campos)
  return comAlvos({ pedido: p, campos, tema: null, alvos: [], editadas: {}, alertas: [], escalas: p.ajustes?.escalas ?? {}, linhas: p.ajustes?.linhas ?? {},
    quantidades: p.ajustes?.quantidades ?? {}, posicoes: p.ajustes?.posicoes ?? {}, formatoIdade: p.ajustes?.formatoIdade ?? null, trocas: p.ajustes?.trocas ?? {}, estilos: p.ajustes?.estilos ?? {}, temaPedido: p.ajustes?.temaId ?? null, divisaoNome: p.ajustes?.divisaoNome ?? null }, temas, vinc, apelidos)
}
/** Acha de novo o tema de cada produto da linha (depois de editar o TEMA ou criar um vínculo). */
export function comAlvos(l: LinhaPedido, temas: TemaLista[], vinc: Vinculo[], apelidos: Record<string, string>): LinhaPedido {
  let alvos = alvosDoPedido(l.pedido.itens, vinc, temas, l.campos.TEMA, apelidos)
  // Lote 6 (item 88): o tema escolhido para ESTE pedido vale mais que tudo (e não muda quando outro pedido escolhe)
  if (l.temaPedido && temas.some(t => t.id === l.temaPedido)) {
    const t = { themeId: l.temaPedido, origem: 'manual' as const }
    alvos = alvos.length ? alvos.map((a, i) => (i === 0 ? { ...a, tema: t } : a)) : [{ produto: '', variacao: '', itens: [], tema: t } as never]
  }
  const tema = alvos.find(a => a.tema)?.tema ?? null
  return { ...l, alvos, tema, alertas: alertasLinha({ ...l, alvos, tema }) }
}
/** Alertas da linha + "tema não encontrado (Sacola P)" quando só um dos produtos ficou sem tema. */
export function alertasLinha(l: Pick<LinhaPedido, 'campos' | 'tema' | 'editadas' | 'alvos'>): string[] {
  const a = alertasDaLinha(l.campos, l.tema, l.editadas)
  if (l.tema && l.alvos.length > 1) for (const x of l.alvos) if (!x.tema) a.push(`tema não encontrado (${x.produto.slice(0, 30)})`)
  return a
}
/** Lote 4 (item 43): produto(s) e variação da linha, para a usuária saber qual é o tema. */
export function produtoEVariacao(l: LinhaPedido): { produto: string; variacao: string } {
  const produto = l.alvos.map(a => a.produto).filter(Boolean).join(' + ')
  const variacao = l.alvos.map(a => a.variacao).filter(Boolean).join(' + ') || l.campos.extras['VARIAÇÃO'] || l.campos.extras['VARIACAO'] || ''
  return { produto, variacao }
}
/** Valores do pedido (NOME, IDADE, HASHTAG…) + o tamanho só deste pedido (`_ESCALA_<VAR>`, lido pelo resolver). */
export const valoresDaLinha = (l: LinhaPedido, tema?: DocTema | null): Record<string, string> => ({
  ...variaveis(l.campos, tema?.hashtag?.middle ?? 'faz', l.editadas),
  ...Object.fromEntries(Object.entries(l.escalas ?? {}).map(([k, v]) => [`_ESCALA_${k}`, String(v)])),
  ...Object.fromEntries(Object.entries(l.linhas ?? {}).map(([k, v]) => [`_LINHAS_${k}`, v])),
  // Lote 5: posição ajustada só neste pedido (59), formato da idade (62), campo vazio some no arquivo (77)
  ...Object.fromEntries(Object.entries(l.posicoes ?? {}).map(([k, v]) => [`_POS_${k}`, JSON.stringify(v)])),
  ...(l.formatoIdade ? { _FORMATO_IDADE: l.formatoIdade } : {}),
  ...(l.divisaoNome !== null && l.divisaoNome !== undefined ? { _DIVISAO_NOME: String(l.divisaoNome) } : {}),
  ...Object.fromEntries(Object.entries(l.trocas ?? {}).map(([k, v]) => [`_TROCAS_${k}`, JSON.stringify(v)])),
  ...Object.fromEntries(Object.entries(l.estilos ?? {}).map(([k, v]) => [`_ESTILO_${k}`, JSON.stringify(v)])),
  _PEDIDO: '1',
})

/** Opções da geração do pedido: impressão em PDF, tudo junto (1 arquivo por pedido), com as do painel. */
export function opcoesDoPedido(base: Partial<OpcoesExportar>, valores: Record<string, string>, pasta?: string): OpcoesExportar {
  return { tipo: 'impressao', aprovacao: 'folha', formato: 'pdf', agrupar: 'tudo', linhas: false, linhasOriginais: true, svg: false, dxf: false, ...base, valores, ...(pasta ? { pasta } : {}) }
}

/** Gera a arte do pedido e registra no card. Devolve o resultado da exportação. */
export async function gerarArteDoPedido(o: {
  raiz: FileSystemDirectoryHandle; pedido: PedidoApi; tema: DocTema; base: DocTrabalho; identidade: Identidade; marcas: MarcaRegistro[]
  opcoes: OpcoesExportar; aoProgredir?: (t: string) => void; registrar?: boolean
}): Promise<ResultadoExportar> {
  const r = await exportar({ raiz: o.raiz, doc: o.base, tema: o.tema, identidade: o.identidade, marcas: o.marcas, aoProgredir: o.aoProgredir }, o.opcoes)
  if (o.registrar !== false) {
    const principal = r.arquivos.find(a => a.endsWith('.pdf')) ?? r.arquivos[0] ?? null
    await apiMae.registrarArte({ orderId: o.pedido.id, themeId: o.tema.id, themeVersion: o.tema.version, variaveis: o.opcoes.valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: principal }).catch(e => console.warn('[MAE] registrar arte', e))
  }
  return r
}

// ── pedido aberto no editor ("Gerar arte" do card) ───────────────────────────────────────────────
export interface EstadoPedidoAberto {
  pedido: PedidoApi | null; valores: Record<string, string>; origemTema: string | null; aviso: string | null
  /** Lote 5 (item 59): botão "Ajustar" da edição em massa — os textos se mexem SÓ neste pedido; o tema fica travado. */
  ajustar?: boolean
}
export const usePedidoAberto = create<EstadoPedidoAberto>()(() => ({ pedido: null, valores: {}, origemTema: null, aviso: null, ajustar: false }))

/**
 * Lote 6 (itens 80/85/100): o AJUSTE DO PEDIDO (posição/tamanho/giro/linhas dos textos só neste pedido) tem o seu
 * HISTÓRICO — entra no mesmo Ctrl+Z das setinhas (cada arrasto de um controle = 1 passo) — e só vai para o pedido no
 * "Salvar ajuste do pedido" (antes ia sozinho, sem desfazer, e os controles da direita gravavam no TEMA).
 */
/** Lote 12 (item 171): o ajuste do pedido = posições dos textos + LETRAS TROCADAS (antes a troca ia direto ao servidor,
 *  fora do Ctrl+Z, do "ajuste não salvo" e do "Voltar ao padrão", e um erro era engolido). */
export interface AjusteTexto { pos: Record<string, PosicaoPedido>; trocas: Record<string, TrocaPedido[]>; estilos: Record<string, EstiloTexto> }
export interface EstadoAjuste { hist: Historico<AjusteTexto> | null; marca: Passo | null; salvando: boolean }
export const useAjustePedido = create<EstadoAjuste>()(() => ({ hist: null, marca: null, salvando: false }))
const jsonDe = <T,>(x: string, padrao: T): T => { try { return JSON.parse(x) as T } catch { return padrao } }
const ajusteDosValores = (v: Record<string, string>): AjusteTexto => ({
  pos: Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('_POS_')).map(([k, x]) => [k.slice(5), jsonDe<PosicaoPedido>(x, {})])),
  trocas: Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('_TROCAS_')).map(([k, x]) => [k.slice(8), jsonDe<TrocaPedido[]>(x, [])]).filter(([, l]) => Array.isArray(l) && l.length)),
  estilos: Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('_ESTILO_')).map(([k, x]) => [k.slice(8), jsonDe<EstiloTexto | null>(x, null)]).filter(([, e]) => !!e)) as Record<string, EstiloTexto>,
})
/** Os valores do pedido aberto passam a refletir o ajuste do histórico (posições e trocas). */
function sincronizarPosicoes(a: AjusteTexto) {
  usePedidoAberto.setState(s => ({ valores: {
    ...Object.fromEntries(Object.entries(s.valores).filter(([k]) => !k.startsWith('_POS_') && !k.startsWith('_TROCAS_') && !k.startsWith('_ESTILO_'))),
    ...Object.fromEntries(Object.entries(a.pos).filter(([, p]) => Object.keys(p).length).map(([k, p]) => [`_POS_${k}`, JSON.stringify(p)])),
    ...Object.fromEntries(Object.entries(a.trocas).filter(([, l]) => l.length).map(([k, l]) => [`_TROCAS_${k}`, JSON.stringify(l)])),
    ...Object.fromEntries(Object.entries(a.estilos ?? {}).map(([k, e]) => [`_ESTILO_${k}`, JSON.stringify(e)])),
  } }))
}
/** Abriu um pedido: o histórico do ajuste começa nas posições salvas nele. */
let valoresSalvos: Record<string, string> = {}
export function iniciarAjustePedido() {
  valoresSalvos = { ...usePedidoAberto.getState().valores }
  useAjustePedido.setState({ hist: criarHistorico(ajusteDosValores(usePedidoAberto.getState().valores)), marca: null })
  esquecer('pedido')
}
export function ajustarTextoDoPedido(slotId: string | string[], f: (a: PosicaoPedido) => void, juntar?: string, label = 'Ajuste do texto (só neste pedido)') {
  const st = usePedidoAberto.getState()
  if (!st.pedido) return
  if (!useAjustePedido.getState().hist) iniciarAjustePedido()
  const antes = useAjustePedido.getState().hist!
  const ids = Array.isArray(slotId) ? slotId : [slotId]
  const depois = aplicarHist(antes, label, d => { for (const id of ids) { const a = (d.pos[id] ??= {}); f(a as PosicaoPedido); if (!Object.keys(a).length) delete d.pos[id] } }, juntar)
  if (depois === antes) return
  useAjustePedido.setState({ hist: depois })
  if (passoNovo(antes as never, depois as never)) anotar('pedido')
  sincronizarPosicoes(depois.atual)
}
/** Lote 12 (item 171): troca de letra SÓ NESTE PEDIDO — um passo do Ctrl+Z; vai ao pedido no "Salvar ajuste do pedido". */
export function trocarLetraDoPedido(variavel: string, lista: TrocaPedido[], label = 'Trocar letra (só neste pedido)') {
  const st = usePedidoAberto.getState()
  if (!st.pedido) return
  if (!useAjustePedido.getState().hist) iniciarAjustePedido()
  const antes = useAjustePedido.getState().hist!
  const depois = aplicarHist(antes, label, d => { if (lista.length) d.trocas[variavel] = JSON.parse(JSON.stringify(lista)); else delete d.trocas[variavel] })
  if (depois === antes) return
  useAjustePedido.setState({ hist: depois })
  if (passoNovo(antes as never, depois as never)) anotar('pedido')
  sincronizarPosicoes(depois.atual)
}
/** Lote 13 (item 178): estilo do texto SÓ NESTE PEDIDO (o painel Texto e a barra de cima, no Ajustar). */
export function mudarEstiloDoPedido(variavel: string, base: EstiloTexto, label: string, f: (e: EstiloTexto) => void, juntar?: string) {
  if (!usePedidoAberto.getState().pedido) return
  if (!useAjustePedido.getState().hist) iniciarAjustePedido()
  const antes = useAjustePedido.getState().hist!
  const depois = aplicarHist(antes, label, d => { d.estilos ??= {}; d.estilos[variavel] ??= JSON.parse(JSON.stringify(base)); f(d.estilos[variavel]) }, juntar ? `estilo:${variavel}:${juntar}` : undefined)
  if (depois === antes) return
  useAjustePedido.setState({ hist: depois })
  if (passoNovo(antes as never, depois as never)) anotar('pedido')
  sincronizarPosicoes(depois.atual)
}
/** "Voltar ao padrão": tira posições E trocas deste pedido num passo só. */
export function voltarAjusteAoPadrao() {
  if (!usePedidoAberto.getState().pedido) return
  if (!useAjustePedido.getState().hist) iniciarAjustePedido()
  const antes = useAjustePedido.getState().hist!
  const depois = aplicarHist(antes, 'Voltar ao padrão (pedido)', d => { d.pos = {}; d.trocas = {}; d.estilos = {} })
  if (depois === antes) return
  useAjustePedido.setState({ hist: depois })
  if (passoNovo(antes as never, depois as never)) anotar('pedido')
  sincronizarPosicoes(depois.atual)
}
export function desfazerAjustePedido() { const h = useAjustePedido.getState().hist; if (!h) return; const n = desfazerHist(h); useAjustePedido.setState({ hist: n }); sincronizarPosicoes(n.atual) }
export function refazerAjustePedido() { const h = useAjustePedido.getState().hist; if (!h) return; const n = refazerHist(h); useAjustePedido.setState({ hist: n }); sincronizarPosicoes(n.atual) }
export const ajustePedidoAlterado = () => {
  const s = useAjustePedido.getState(), v = usePedidoAberto.getState().valores
  return alteradoDesde(s.hist as never, s.marca) || Object.entries(v).some(([k, x]) => !k.startsWith('_') && k !== 'HASHTAG' && k !== 'ARROBA' && x !== (valoresSalvos[k] ?? ''))
}
/** Grava no pedido TODAS as posições do ajuste (substitui as anteriores). */
export async function salvarAjustePedido(): Promise<boolean> {
  const st = usePedidoAberto.getState(), aj = useAjustePedido.getState()
  if (!st.pedido) return false
  const atual = aj.hist?.atual ?? ajusteDosValores(st.valores)
  useAjustePedido.setState({ salvando: true })
  try {
    await apiMae.posicoes(st.pedido.id, { '*': null, ...atual.pos })
    // Lote 12 (item 171): as letras trocadas vão junto (null = tirou a troca daquela variável)
    const antesTrocas = ajusteDosValores(valoresSalvos).trocas
    const trocas: Record<string, TrocaPedido[] | null> = {}
    for (const k of new Set([...Object.keys(antesTrocas), ...Object.keys(atual.trocas)])) trocas[k] = atual.trocas[k]?.length ? atual.trocas[k] : null
    if (Object.keys(trocas).length) await apiMae.trocas(st.pedido.id, trocas)
    // Lote 13 (item 178): o estilo do texto deste pedido (null = voltou ao do tema)
    const antesEstilos = ajusteDosValores(valoresSalvos).estilos
    const estilos: Record<string, EstiloTexto | null> = {}
    for (const k of new Set([...Object.keys(antesEstilos), ...Object.keys(atual.estilos ?? {})])) estilos[k] = atual.estilos?.[k] ?? null
    if (Object.keys(estilos).length) await apiMae.estilos(st.pedido.id, estilos)
    valoresSalvos = { ...Object.fromEntries(Object.entries(valoresSalvos).filter(([k]) => !k.startsWith('_TROCAS_') && !k.startsWith('_ESTILO_'))), ...Object.fromEntries(Object.entries(atual.trocas).map(([k, l]) => [`_TROCAS_${k}`, JSON.stringify(l)])), ...Object.fromEntries(Object.entries(atual.estilos ?? {}).map(([k, e]) => [`_ESTILO_${k}`, JSON.stringify(e)])) }
    // os valores editados em "Textos deste pedido" (NOME, IDADE, frase, campos extras) também vão para o pedido
    const mudados = Object.fromEntries(Object.entries(st.valores).filter(([k, v]) => !k.startsWith('_') && k !== 'HASHTAG' && k !== 'ARROBA' && v !== (valoresSalvos[k] ?? '')))
    if (Object.keys(mudados).length) { await apiMae.salvarCampos(st.pedido.id, mudados); valoresSalvos = { ...st.valores } }
    useAjustePedido.setState({ marca: topoDe(aj.hist as never) as Passo | null })
    return true
  } catch (e) { alert(`Não consegui salvar o ajuste do pedido: ${mensagemDeErro(e)}`); return false }
  finally { useAjustePedido.setState({ salvando: false }) }
}
