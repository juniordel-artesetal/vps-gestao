// MAE — erros em PORTUGUÊS (Lote 10, item 162). Puro. Os erros do navegador chegam em inglês ("The requested file
// could not be read, typically due to permission problems that have occurred after a reference to a file was
// acquired") — a tela mostra `mensagemDeErro(e)`, nunca o `e.message` cru.

/** O arquivo mudou no disco depois de escolhido (sincronização do Drive/OneDrive, outro programa salvando). */
export class ArquivoMudou extends Error {
  constructor(public caminho: string) {
    super(`O arquivo "${caminho.split('/').pop()}" mudou desde que foi escolhido (ex.: sincronização do Drive/OneDrive) ou está aberto em outro programa. Espere a sincronização terminar e tente de novo — ou escolha o arquivo outra vez.`)
    this.name = 'ArquivoMudou'
  }
}

const POR_NOME: Record<string, string> = {
  NotReadableError: 'Não deu para ler o arquivo: ele mudou no disco depois de escolhido (sincronização do Drive/OneDrive?) ou está aberto em outro programa. Tente de novo ou escolha o arquivo outra vez.',
  NotAllowedError: 'O navegador não deu permissão para a pasta da Biblioteca. Clique em "Escolher pasta" e permita o acesso.',
  SecurityError: 'O navegador bloqueou o acesso a este arquivo/pasta. Clique em "Escolher pasta" e permita o acesso.',
  NotFoundError: 'Arquivo ou pasta não encontrado na Biblioteca (foi movido, renomeado ou apagado?).',
  TypeMismatchError: 'Era esperado um arquivo e há uma pasta com esse nome (ou o contrário).',
  NoModificationAllowedError: 'O arquivo está bloqueado (aberto em outro programa ou só leitura). Feche o outro programa e tente de novo.',
  InvalidModificationError: 'O arquivo está bloqueado (aberto em outro programa ou só leitura). Feche o outro programa e tente de novo.',
  InvalidStateError: 'O arquivo mudou enquanto era usado. Tente de novo.',
  QuotaExceededError: 'Sem espaço para guardar neste computador (o armazenamento do navegador encheu). Libere espaço em disco e tente de novo.',
  AbortError: 'Cancelado.',
  EncodingError: 'A imagem não pôde ser aberta (formato não suportado ou arquivo corrompido).',
  TimeoutError: 'Demorou demais e foi interrompido. Tente de novo.',
}

// a ordem importa: "Failed to fetch dynamically imported module" é versão nova, não falta de internet
const POR_TEXTO: [RegExp, string][] = [
  // o leitor de PDF (pdf.js) não subiu o worker — antes do "versão nova" abaixo (a mensagem também traz "dynamically imported module")
  [/fake worker|pdf\.worker/i, 'Não consegui ler este PDF. Tente de novo ou importe o molde em SVG.'],
  [/loading chunk|chunkloaderror|failed to load chunk|failed to fetch dynamically imported module|importing a module script failed/i, 'Saiu uma versão nova do MAE — recarregue a página (seu trabalho está salvo).'],
  [/failed to fetch|networkerror|load failed|network request failed|err_internet_disconnected/i, 'Sem conexão com o servidor — confira a internet e tente de novo.'],
  [/array buffer allocation failed|out of memory|allocation failed|maximum call stack/i, 'A memória do navegador acabou — feche outras abas e tente de novo (ou diminua a qualidade da exportação).'],
  [/could not be decoded|source image cannot be decoded|the source image|createimagebitmap|invalid image|unsupported image/i, 'A imagem não pôde ser aberta (formato não suportado ou arquivo corrompido).'],
  [/unexpected token|unexpected end of json|is not valid json|json\.parse|in json at position/i, 'O arquivo tem conteúdo inválido (não é um arquivo do MAE ou está corrompido).'],
  [/permission/i, 'O navegador não deu permissão para a pasta da Biblioteca. Clique em "Escolher pasta" e permita o acesso.'],
]

/**
 * Lote 16 (item 203): o que o schema/servidor RECUSOU, em português — nunca o JSON cru ("too_big", "path"…).
 * `issues` = a lista do zod (do erro local ou do `detalhes` da resposta 400 do servidor).
 */
interface ProblemaSchema { code?: string; origin?: string; path?: (string | number)[]; maximum?: number | bigint; message?: string }
const CAMPOS: [RegExp, string][] = [
  [/^(partContent|faceContent)\.[^.]+\.\d+\.name$/, 'o nome de uma camada'],
  [/^parts\.\d+\.name$/, 'o nome de uma parte'],
  [/^molds\.\d+\.name$/, 'o nome de um molde'],
  [/^artboards\.\d+\.name$/, 'o nome de uma prancheta'],
  [/^name$/, 'o nome'],
  [/(^|\.)(name|nome)$/, 'um nome'],
  [/(^|\.)(path)$/, 'o caminho de um arquivo'],
]
export function explicarRecusa(issues: unknown): string {
  const lista = (Array.isArray(issues) ? issues : []) as ProblemaSchema[]
  if (!lista.length) return 'a receita foi recusada'
  const i = lista[0], caminho = (i.path ?? []).join('.')
  const campo = CAMPOS.find(([re]) => re.test(caminho))?.[1] ?? (caminho ? `o campo "${caminho}"` : 'um campo')
  const frase = i.code === 'too_big' && i.maximum != null ? `${campo} passa de ${i.maximum} letras`
    : i.code === 'too_small' && i.origin === 'string' ? `${campo} está vazio`
    : `${campo} está com um valor inválido`
  return lista.length > 1 ? `${frase} (e mais ${lista.length - 1} problema${lista.length > 2 ? 's' : ''})` : frase
}

/** Erro → frase em português para a tela. Erros do próprio MAE (já em português) passam como estão. */
export function mensagemDeErro(e: unknown): string {
  if (e == null) return 'Algo deu errado. Tente de novo.'
  if (typeof e === 'string') return traduzirTexto(e)
  const x = e as { name?: string; message?: string; status?: number; issues?: unknown }
  // Lote 16 (item 204): erro de validação (zod) → o motivo em português, nunca o JSON cru
  if (x.name === 'ZodError' || Array.isArray(x.issues)) return `A receita não pôde ser salva: ${explicarRecusa(x.issues)}.`
  if (x.name && x.name !== 'Error' && x.name !== 'TypeError' && POR_NOME[x.name]) return POR_NOME[x.name]
  if (x.status === 401) return 'Sua sessão expirou — entre de novo (o trabalho está salvo neste computador).'
  if (x.status === 403) return 'Este recurso não está liberado nesta conta.'
  return traduzirTexto(x.message ?? String(e))
}

function traduzirTexto(m: string): string {
  const t = m.trim()
  if (!t) return 'Algo deu errado. Tente de novo.'
  for (const [re, frase] of POR_TEXTO) if (re.test(t)) return frase
  return t
}
