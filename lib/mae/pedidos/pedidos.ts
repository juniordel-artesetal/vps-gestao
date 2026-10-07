// mae-pedidos — PEDIDOS → ARTE (Sprint 12). Puro: lê os campos TEMA, NOME, IDADE (e extras) do pedido,
// calcula as variáveis (HASHTAG), acha o tema (vínculo produto/variação ↔ tema, senão o nome do campo
// TEMA), roda a FILA de geração e resume o status do card. Sem banco e sem navegador.
import { hashtag } from '../texto/diagramar'

/** Chave do TEMA: sem maiúsculas, acentos, espaços e pontuação ("Fazen dinha" = "Fazendinha"). */
export const chaveTema = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Nomes de campo aceitos (a usuária cria os campos nos produtos dela; o tutorial ensina TEMA, NOME e
 * IDADE, mas campos antigos do SOA Design — "Nome da criança", "Idade da criança" — também valem).
 */
const ALIASES: Record<'TEMA' | 'NOME' | 'IDADE', string[]> = {
  TEMA: ['tema', 'tema da festa', 'tema do kit'],
  NOME: ['nome', 'nome da crianca', 'nome do aniversariante', 'nome personalizado', 'nome na arte'],
  IDADE: ['idade', 'idade da crianca', 'anos', 'idade do aniversariante'],
}
export const OBRIGATORIOS = ['TEMA', 'NOME', 'IDADE'] as const

export interface CamposMae {
  TEMA?: string; NOME?: string; IDADE?: string; extras: Record<string, string>
  /** Lote 4 (item 44): texto do campo único "Nome e idade" que não deu para separar com segurança. */
  revisarNomeIdade?: string
}

/** Lote 4 (item 44): campo ÚNICO "Nome e idade" ("Nome e Idade", "Nome da criança e idade"…). */
export const ehCampoNomeIdade = (k: string) => { const n = norm(k); return n.includes('nome') && n.includes('idade') }

/** Palavras que denunciam recado em vez de nome ("PEDI O NOME", "arte da cliente", "Kit 01: …"). */
const NAO_E_NOME = /\b(pedi|pedir|nome|idade|kit|kits|arte|cliente|unidades?|modelo|cor|sem|cha|fralda|fraldas|revelacao|bebe|vai|faz|fazer|ele|ela|outra|metade|cada|divididos?|divididas?|serao|com|mesmo|level|aplique|dados|informados?|boa|noite|dia|tarde|ola|oi)\b/

/**
 * Lote 4 (item 44): separa o campo único "nome e idade" (digitado pela equipe lendo o chat da Shopee).
 * "Isabella Costa 2 anos" → NOME "Isabella Costa", IDADE "2". Aceita "Nome: Liz / Idade: 6 anos", "Laura, 9 anos",
 * "Davi Alexandre 1 aninho", "Pedro - 1 ano". Só o nome, sem idade, também vale ("Cecília" → NOME). Na dúvida
 * (duas crianças, meses, recado, número solto) devolve `revisar` e NÃO chuta: a usuária confere na lista.
 */
export function separarNomeIdade(bruto: string): { nome?: string; idade?: string; revisar: boolean } {
  const original = String(bruto ?? '')
  if (!original.trim()) return { revisar: false }
  // rótulos comuns: "Nome:", "Nome -", "Idade:", "Idade da criança:"
  let t = original
    .replace(/\bnome( da crian[cç]a| do aniversariante)?\s*[:\-–]\s*/gi, ' ')
    .replace(/\bidade( da crian[cç]a)?\s*[:\-–]\s*/gi, ' ')
    .replace(/\be a idade [eé](?=\s|$)/gi, ' ')      // "Davi e a idade é 2 anos"
    .replace(/\bidade\s+(?=\d)/gi, ' ')               // "Heloísa idade 01 ano"
  t = t.replace(/\s+/g, ' ').trim().replace(/^nome\s+/i, '')   // "Nome Eloá 1 aninho"
  const idades = [...t.matchAll(/(\d{1,3})\s*(anos?|aninhos?|meses|m[eê]s)(?![\p{L}])/giu)]
  if (idades.length > 1 || /\bmeses\b|\bm[eê]s\b/iu.test(t) || /[&|]/.test(t)) return { revisar: true }
  let idade: string | undefined
  if (idades.length === 1) {
    idade = String(Number(idades[0][1]))
    const i = idades[0].index ?? 0
    t = (t.slice(0, i) + ' ' + t.slice(i + idades[0][0].length)).trim()
  }
  // sobra o nome: tira pontuação das pontas ("Laura,", "Pedro -", "Liz -")
  const nome = t.replace(/[,;:.\-–]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!nome) return { ...(idade ? { idade } : {}), revisar: true }
  const palavras = nome.split(' ')
  const semAcento = norm(nome)
  if (/\d/.test(nome) || palavras.length > 4 || NAO_E_NOME.test(semAcento) || /(^| )e( |$)/.test(semAcento)) return { revisar: true }
  if (!/^[\p{L}' ]+$/u.test(nome)) return { revisar: true }
  return { nome, ...(idade ? { idade } : {}), revisar: false }
}

/** Campos do pedido (camposExtras achatado) → TEMA/NOME/IDADE + extras (FRASE, DATA DA FESTA…, em MAIÚSCULAS). */
export function camposDoPedido(campos: Record<string, string>): CamposMae {
  const out: CamposMae = { extras: {} }
  let juntos: string | undefined
  for (const [k, v0] of Object.entries(campos)) {
    const v = String(v0 ?? '').trim()
    if (!v) continue
    const n = norm(k)
    const qual = (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).find(q => ALIASES[q].includes(n))
    if (qual) { if (!out[qual]) out[qual] = v }
    else if (ehCampoNomeIdade(k)) { if (!juntos) juntos = v }
    else out.extras[k.toUpperCase().trim()] = v
  }
  // Lote 4 (item 44): sem os campos NOME/IDADE separados, separa o campo único (os separados sempre vencem)
  if (juntos && (!out.NOME || !out.IDADE)) {
    const s = separarNomeIdade(juntos)
    if (s.revisar) { if (!out.NOME) out.revisarNomeIdade = juntos }
    else { if (!out.NOME && s.nome) out.NOME = s.nome; if (!out.IDADE && s.idade) out.IDADE = s.idade }
  }
  return out
}

/**
 * Lote 4 (item 43): em que campo do pedido gravar NOME/IDADE/TEMA editados na lista — o campo que o ateliê já
 * usa (configurado ou já presente no pedido, ex.: "Nome da criança"), senão "Nome"/"Idade"/"Tema".
 */
export function campoParaGravar(variavel: 'NOME' | 'IDADE' | 'TEMA', nomesDoAtelie: string[], chavesDoPedido: string[] = []): string {
  const casa = (k: string) => ALIASES[variavel].includes(norm(k))
  return chavesDoPedido.find(casa) ?? nomesDoAtelie.find(casa) ?? ({ NOME: 'Nome', IDADE: 'Idade', TEMA: 'Tema' } as const)[variavel]
}

/** Quais dos obrigatórios faltam (para a geração em massa: "faltam dados"). */
export const faltando = (c: CamposMae): string[] => OBRIGATORIOS.filter(k => !c[k]?.trim())

/** Variáveis da arte: NOME, IDADE, HASHTAG (calculada, ou a editada) + extras. Edições da linha vencem. */
export function variaveis(c: CamposMae, meio = 'faz', editadas: Partial<Record<string, string>> = {}): Record<string, string> {
  const nome = (editadas.NOME ?? c.NOME ?? '').trim(), idade = (editadas.IDADE ?? c.IDADE ?? '').trim()
  const v: Record<string, string> = { ...c.extras, NOME: nome, IDADE: idade }
  v.HASHTAG = (editadas.HASHTAG ?? '').trim() || hashtag(nome, idade, meio)
  for (const [k, x] of Object.entries(editadas)) if (x !== undefined && !['NOME', 'IDADE', 'HASHTAG'].includes(k)) v[k] = x
  return v
}

export interface ItemPedido {
  variacaoId?: string | null; produtoId?: string | null; nome?: string
  /** Lote 4 (item 44): nome do produto da Precificação ("Sacola P") e da variação, quando o item está ligado. */
  produto?: string | null; variacao?: string | null
}
export interface Vinculo { produtoId: string; variacaoId: string | null; themeId: string }
export interface TemaLista {
  id: string; name: string; version: number
  /** Lote 4 (item 44): produto do tema ("Kit Festa", "Sacola P"). */
  produto?: string
}
export type OrigemTema = 'variacao' | 'produto' | 'campo' | 'manual'
export interface TemaAchado { themeId: string; origem: OrigemTema }

/** Produto do item para achar o tema e separar as exportações: o da Precificação, senão o nome do item (anúncio). */
export const produtoDoItem = (it: ItemPedido) => (it.produto ?? '').trim() || (it.nome ?? '').trim()
/** Chave do apelido "produto + tema" (Temas/apelidos.json). */
export const chaveProdutoTema = (produto: string, tema: string) => `${chaveTema(produto)}|${chaveTema(tema)}`
/** Chave do apelido "todos os pedidos deste produto" (resposta "Sim" no item 43). */
export const chaveProduto = (produto: string) => `produto:${chaveTema(produto)}`

/**
 * Tema do pedido: 1º vínculo da VARIAÇÃO, 2º vínculo do PRODUTO (sem variação), 3º o campo TEMA
 * comparado com os nomes dos temas (sem acento/maiúscula/espaço extra). Vários itens com temas
 * diferentes: vale o primeiro item que tiver vínculo.
 */
export function acharTema(itens: ItemPedido[], vinculos: Vinculo[], temas: TemaLista[], campoTema?: string, apelidos: Record<string, string> = {}): TemaAchado | null {
  const existe = (id: string) => temas.some(t => t.id === id)
  for (const it of itens) {
    const v = it.variacaoId ? vinculos.find(x => x.variacaoId === it.variacaoId && existe(x.themeId)) : undefined
    if (v) return { themeId: v.themeId, origem: 'variacao' }
  }
  for (const it of itens) {
    const v = it.produtoId ? vinculos.find(x => x.produtoId === it.produtoId && !x.variacaoId && existe(x.themeId)) : undefined
    if (v) return { themeId: v.themeId, origem: 'produto' }
  }
  // Lote 4 (item 43): "usar este tema para todos os pedidos deste produto" (produto sem cadastro na Precificação)
  for (const it of itens) {
    const ap = produtoDoItem(it) ? apelidos[chaveProduto(produtoDoItem(it))] : undefined
    if (ap && existe(ap)) return { themeId: ap, origem: 'produto' }
  }
  if (campoTema?.trim()) {
    // Lote 2 (item 26): ignora maiúsculas, acentos E espaços ("Fazen dinha" = "Fazendinha")
    const alvo = chaveTema(campoTema)
    // Lote 4 (item 44): a arte é a do PRODUTO + TEMA — com dois temas de mesmo nome (Kit Festa/Ursinha e
    // Sacola P/Ursinha), vale o do produto do pedido
    const mesmos = temas.filter(x => chaveTema(x.name) === alvo)
    if (mesmos.length) {
      const prods = itens.map(produtoDoItem).filter(Boolean).map(chaveTema)
      const doProduto = mesmos.find(x => x.produto && prods.some(p => p === chaveTema(x.produto!) || p.includes(chaveTema(x.produto!))))
      const t = doProduto ?? mesmos.find(x => !x.produto) ?? mesmos[0]
      return { themeId: t.id, origem: 'campo' }
    }
    // escolha feita à mão antes: para este produto + TEMA, senão para este TEMA (Temas/apelidos.json)
    for (const it of itens) {
      const ap = produtoDoItem(it) ? apelidos[chaveProdutoTema(produtoDoItem(it), campoTema)] : undefined
      if (ap && existe(ap)) return { themeId: ap, origem: 'manual' }
    }
    const ap = apelidos[alvo]
    if (ap && existe(ap)) return { themeId: ap, origem: 'manual' }
  }
  return null
}

/**
 * Lote 4 (item 44): pedido com VÁRIOS produtos (Kit Festa + Sacola P, mesmo tema) gera um arquivo por
 * produto — cada produto acha o seu tema. Itens do mesmo produto viram um alvo só.
 */
export interface AlvoPedido { produto: string; variacao: string | null; itens: ItemPedido[]; tema: TemaAchado | null }
export function alvosDoPedido(itens: ItemPedido[], vinculos: Vinculo[], temas: TemaLista[], campoTema?: string, apelidos: Record<string, string> = {}): AlvoPedido[] {
  const grupos = new Map<string, ItemPedido[]>()
  for (const it of itens) { const k = chaveTema(produtoDoItem(it)) || '_'; grupos.set(k, [...(grupos.get(k) ?? []), it]) }
  if (!grupos.size) return [{ produto: '', variacao: null, itens: [], tema: acharTema([], vinculos, temas, campoTema, apelidos) }]
  return [...grupos.values()].map(its => ({ produto: produtoDoItem(its[0]), variacao: its[0].variacao ?? null, itens: its, tema: acharTema(its, vinculos, temas, campoTema, apelidos) }))
}

/**
 * Lote 4 (item 44): pasta do PRODUTO no lote — Exportações/AAAA-MM-DD/<Produto>/ ("Sacola P", com acento e
 * espaço; só tira o que o Windows não aceita). Assim a equipe imprime todas as sacolas do dia de uma vez.
 */
export function pastaDoProduto(pastaDia: string, produto: string): string {
  const p = String(produto ?? '').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[. ]+$/, '')
  return `${pastaDia}/${p || 'Sem produto'}`
}

/** Pasta do pedido no lote: Exportações/AAAA-MM-DD/<pedido>_<nome>/ (nome seguro no Windows). */
export function pastaDoPedido(pastaDia: string, numero: string, nome: string): string {
  const s = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `${pastaDia}/${s(numero) || 'pedido'}_${s(nome) || 'sem-nome'}`
}

// ── fila de geração ─────────────────────────────────────────────────────────────────────────────
export type StatusGeracao = 'gerada' | 'aviso' | 'erro'
export interface ResultadoItem<R> { id: string; status: StatusGeracao; valor?: R; mensagem?: string; avisos?: string[] }

/**
 * Fila no computador: um pedido por vez (o motor e a memória agradecem), na ordem dada, com progresso;
 * erro num pedido não para a fila; `cancelar()` para depois do item atual. Determinística.
 */
export async function rodarFila<T extends { id: string }, R>(
  itens: T[],
  tarefa: (item: T, i: number) => Promise<{ valor: R; avisos?: string[] }>,
  o: { aoProgredir?: (feitos: number, total: number, atual: T | null) => void; cancelado?: () => boolean } = {},
): Promise<ResultadoItem<R>[]> {
  const out: ResultadoItem<R>[] = []
  for (let i = 0; i < itens.length; i++) {
    if (o.cancelado?.()) break
    o.aoProgredir?.(i, itens.length, itens[i])
    try {
      const r = await tarefa(itens[i], i)
      out.push({ id: itens[i].id, status: r.avisos?.length ? 'aviso' : 'gerada', valor: r.valor, avisos: r.avisos })
    } catch (e) {
      out.push({ id: itens[i].id, status: 'erro', mensagem: (e as Error)?.message || String(e) })
    }
  }
  o.aoProgredir?.(out.length, itens.length, null)
  return out
}

export function resumo<R>(rs: ResultadoItem<R>[]): Record<StatusGeracao, number> {
  return { gerada: rs.filter(r => r.status === 'gerada').length, aviso: rs.filter(r => r.status === 'aviso').length, erro: rs.filter(r => r.status === 'erro').length }
}

// ── status do card ──────────────────────────────────────────────────────────────────────────────
export type StatusArte = 'nao_gerada' | 'gerada' | 'revisar'
export interface ArteRegistro { status: string; arquivo: string | null; themeId: string; themeVersion: number; criadoEm: string; variaveis?: Record<string, string> }

/** Status do card = o da geração mais recente; o histórico fica (gerar de novo cria outro registro). */
export function statusDoCard(artes: ArteRegistro[]): { status: StatusArte; ultima: ArteRegistro | null; historico: ArteRegistro[] } {
  const h = [...artes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const u = h[0] ?? null
  const status: StatusArte = !u ? 'nao_gerada' : u.status === 'gerada' ? 'gerada' : u.status === 'revisar' ? 'revisar' : 'nao_gerada'
  return { status, ultima: u, historico: h }
}

/** Avisos da linha antes de gerar (a geração ainda pode achar outros, como "nome longo" no auto-ajuste). */
export function alertasDaLinha(c: CamposMae, tema: TemaAchado | null, editadas: Partial<Record<string, string>> = {}): string[] {
  const a: string[] = []
  const f = faltando({ ...c, NOME: editadas.NOME ?? c.NOME, IDADE: editadas.IDADE ?? c.IDADE, TEMA: c.TEMA ?? (tema ? 'ok' : undefined) })
  if (f.length) a.push(`faltam dados (${f.join(', ')})`)
  if (!tema) a.push('tema não encontrado')
  if (c.revisarNomeIdade && !(editadas.NOME ?? c.NOME)?.trim()) a.push('revisar nome e idade')
  const nome = (editadas.NOME ?? c.NOME ?? '').trim()
  if (nome.length > 16) a.push('nome longo')
  return a
}
