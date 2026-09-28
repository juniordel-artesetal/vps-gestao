// SOA Design — FILA DE JOBS do mockup em massa (BatchJob). Vive FORA da tela (módulo do navegador): a artesã pode
// trocar de aba/módulo no SOA enquanto gera — o painel flutuante mostra o progresso em qualquer página.
// Itens: pendente → processando → concluído | falhou | cancelado. Falha de 1 NÃO derruba o lote; retry e cancelar
// pendentes. Cota: cada leva de até LIMITE_LOTE é autorizada (e debitada) pelo servidor antes de desenhar.
// CACHE: a chave de cada item é o hash de TODAS as dependências (mockup + artes + faces + enquadramento + saída);
// mesma chave = não re-renderiza nem cobra de novo. Mudou o mockup → só os itens dele mudam de chave.
// Arquivo LEVE de propósito (sem motor de imagem): quem cria o job manda a função que desenha.

export type EstadoItem = 'pendente' | 'processando' | 'concluido' | 'falhou' | 'cancelado'
export interface ArquivoFila { nome: string; blob: Blob }
/** `arquivo` = nome do arquivo (ou da PASTA, quando o item gera vários: aplique = composto + camadas + silhuetas). */
export interface ItemFila { id: string; rotulo: string; arquivo: string; chave: string; estado: EstadoItem; erro?: string; blob?: Blob; arquivos?: ArquivoFila[]; doCache?: boolean }
export interface JobFila {
  id: string; nome: string; criadoEm: number; itens: ItemFila[]
  /** desenha 1 item (recebe o id do lote autorizado — para guardar em Meus arquivos com a prova do servidor) */
  render: (item: ItemFila, ctx: { lote: string }) => Promise<Blob | ArquivoFila[]>
  /** autorização de cota para n itens (Autorizador do servidor) */
  autorizar: (n: number) => { lote: string; garantir: (i: number) => Promise<void> }
  /** erro de cota (SemCota) interrompe o job: os que faltam ficam "falhou" com a mensagem (retry depois) */
  ehSemCota?: (e: unknown) => boolean
  nomeZip: string
}
type Ouvinte = () => void

const TETO = 50
const cache = new Map<string, Blob | ArquivoFila[]>()
const MAX_CACHE = 600
let jobs: JobFila[] = []
const ouvintes = new Set<Ouvinte>()
let rodando = false
let versao = 0

const avisar = () => { versao++; jobs = [...jobs]; ouvintes.forEach(f => f()) }
export const assinar = (f: Ouvinte) => { ouvintes.add(f); return () => { ouvintes.delete(f) } }
export const listarJobs = () => jobs
export const versaoFila = () => versao
export const noCache = (chave: string) => cache.has(chave)
export function resumo(j: JobFila) {
  const c = { total: j.itens.length, concluido: 0, processando: 0, pendente: 0, falhou: 0, cancelado: 0, doCache: 0 }
  for (const i of j.itens) { c[i.estado]++; if (i.doCache) c.doCache++ }
  return c
}
/** Quantos itens deste conjunto de chaves vão custar cota (os que não estão no cache). */
export const custo = (chaves: string[]) => chaves.filter(k => !cache.has(k)).length

function guardar(chave: string, b: Blob | ArquivoFila[]) {
  cache.delete(chave); cache.set(chave, b)
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string)
}

export function criarJob(j: Omit<JobFila, 'id' | 'criadoEm' | 'itens'> & { itens: Omit<ItemFila, 'estado'>[] }): string {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
  jobs.push({ ...j, id, criadoEm: Date.now(), itens: j.itens.map(i => ({ ...i, estado: 'pendente' as const })) })
  avisar(); void rodar()
  return id
}
const conteudo = (b: Blob | ArquivoFila[]) => (Array.isArray(b) ? { arquivos: b, blob: undefined } : { blob: b, arquivos: undefined })
const mudar = (j: JobFila, it: ItemFila, p: Partial<ItemFila>) => { Object.assign(it, p); j.itens = [...j.itens]; avisar() }

async function rodar() {
  if (rodando) return
  rodando = true
  try {
    for (;;) {
      const j = jobs.find(x => x.itens.some(i => i.estado === 'pendente'))
      if (!j) break
      // 1) o que já está no cache sai na hora (sem desenhar, sem cota)
      for (const it of j.itens) if (it.estado === 'pendente' && cache.has(it.chave)) mudar(j, it, { estado: 'concluido', ...conteudo(cache.get(it.chave)!), doCache: true, erro: undefined })
      // 2) a próxima leva (até o teto do lote) é autorizada pelo servidor e desenhada
      const leva = j.itens.filter(i => i.estado === 'pendente').slice(0, TETO)
      if (!leva.length) continue
      let aut: ReturnType<JobFila['autorizar']>
      try { aut = j.autorizar(leva.length) } catch (e) { leva.forEach(it => mudar(j, it, { estado: 'falhou', erro: (e as Error).message })); continue }
      for (let k = 0; k < leva.length; k++) {
        const it = leva[k]
        if (it.estado !== 'pendente') continue                 // cancelado no meio do caminho
        mudar(j, it, { estado: 'processando' })
        try {
          await aut.garantir(k)
          await new Promise(r => setTimeout(r, 0))              // devolve a vez à tela entre um item e outro
          const b = await j.render(it, { lote: aut.lote })
          guardar(it.chave, b)
          mudar(j, it, { estado: 'concluido', ...conteudo(b), erro: undefined })
        } catch (e) {
          const msg = (e as Error)?.message || 'erro'
          if (j.ehSemCota?.(e)) { j.itens.filter(x => x.estado === 'pendente' || x === it).forEach(x => mudar(j, x, { estado: 'falhou', erro: msg })); break }
          mudar(j, it, { estado: 'falhou', erro: msg })          // falha de 1 não derruba o lote
        }
      }
    }
  } finally { rodando = false; avisar() }
}

export function cancelarPendentes(jobId: string) { const j = jobs.find(x => x.id === jobId); if (!j) return; j.itens.filter(i => i.estado === 'pendente').forEach(i => mudar(j, i, { estado: 'cancelado' })) }
export function tentarDeNovo(jobId: string, itemId?: string) {
  const j = jobs.find(x => x.id === jobId); if (!j) return
  j.itens.filter(i => (itemId ? i.id === itemId : true) && (i.estado === 'falhou' || i.estado === 'cancelado')).forEach(i => mudar(j, i, { estado: 'pendente', erro: undefined }))
  void rodar()
}
export function removerJob(jobId: string) { const j = jobs.find(x => x.id === jobId); if (j) j.itens.filter(i => i.estado === 'pendente').forEach(i => { i.estado = 'cancelado' }); jobs = jobs.filter(x => x.id !== jobId); avisar() }
export const emAndamento = () => jobs.some(j => j.itens.some(i => i.estado === 'pendente' || i.estado === 'processando'))

function baixarBlob(b: Blob, nome: string) {
  const u = URL.createObjectURL(b), a = document.createElement('a')
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 60_000)
}
export async function baixarItem(jobId: string, itemId: string) {
  const it = jobs.find(x => x.id === jobId)?.itens.find(i => i.id === itemId)
  if (it?.blob) baixarBlob(it.blob, it.arquivo)
  else if (it?.arquivos) { const JSZip = (await import('jszip')).default, z = new JSZip(); it.arquivos.forEach(a => z.file(a.nome, a.blob)); baixarBlob(await z.generateAsync({ type: 'blob', compression: 'STORE' }), `${it.arquivo}.zip`) }
}
export async function baixarZip(jobId: string) {
  const j = jobs.find(x => x.id === jobId); if (!j) return
  const prontos = j.itens.filter(i => i.estado === 'concluido' && (i.blob || i.arquivos))
  if (!prontos.length) return
  const JSZip = (await import('jszip')).default, zip = new JSZip()
  for (const i of prontos) { if (i.blob) zip.file(i.arquivo, i.blob); else i.arquivos!.forEach(a => zip.file(`${i.arquivo}/${a.nome}`, a.blob)) }
  baixarBlob(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), j.nomeZip)
}

// fechar a aba no meio do lote perde o que falta: avisa
if (typeof window !== 'undefined') window.addEventListener('beforeunload', e => { if (emAndamento()) { e.preventDefault(); e.returnValue = '' } })
