// Recuperação (retrieval) da base de conhecimento do suporte: dada a pergunta da
// artesã, seleciona os TOP-N tópicos mais relevantes de SuporteConhecimento por
// sobreposição de palavras (normNome). Assim o robô fica preciso e o prompt fica leve.
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'

export interface TopicoConhecimento {
  modulo: string
  titulo: string
  caminho: string | null
  conteudo: string
}

// Stopwords PT — não ajudam no match
const STOP = new Set([
  'como','onde','quando','qual','quais','porque','por','que','para','pra','com','sem','meu','minha','meus','minhas',
  'uma','uns','umas','dos','das','nos','nas','the','and','ola','oi','voce','vc','tem','ter','fazer','faco','fazer',
  'sobre','esse','essa','isso','este','esta','aqui','ali','mais','menos','muito','pouco','sim','nao','ser','estar',
  'quero','preciso','gostaria','ajuda','ajudar','favor','pode','poderia','consigo','consegue','sei','saber',
])

function tokens(s: string): string[] {
  return normNome(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w))
}

/**
 * Retorna os tópicos mais relevantes para a pergunta. Pontua por sobreposição de
 * tokens: palavrasChave (peso 4) > título (peso 3) > caminho (peso 2) > conteúdo (peso 1).
 */
export async function recuperarConhecimento(pergunta: string, limite = 6): Promise<TopicoConhecimento[]> {
  const termos = tokens(pergunta)
  if (termos.length === 0) return []

  let rows: any[] = []
  try {
    rows = await prisma.$queryRaw`
      SELECT "modulo","titulo","caminho","conteudo","palavrasChave"
      FROM "SuporteConhecimento" WHERE "ativo" = true
    ` as any[]
  } catch {
    return []   // tabela ainda não existe — chat segue sem recuperação
  }

  const alvo = new Set(termos)
  const pontuados = rows.map((r) => {
    const kw = normNome(r.palavrasChave || '')
    const tit = normNome(r.titulo || '')
    const cam = normNome(r.caminho || '')
    const cont = normNome(r.conteudo || '')
    let score = 0
    for (const t of alvo) {
      if (kw.includes(t)) score += 4
      if (tit.includes(t)) score += 3
      if (cam.includes(t)) score += 2
      if (cont.includes(t)) score += 1
    }
    return { r, score }
  }).filter(x => x.score > 0)

  pontuados.sort((a, b) => b.score - a.score)

  return pontuados.slice(0, limite).map(({ r }) => ({
    modulo: r.modulo, titulo: r.titulo, caminho: r.caminho, conteudo: r.conteudo,
  }))
}

// Monta o bloco de contexto a injetar no prompt (só os tópicos recuperados).
export function montarContextoConhecimento(topicos: TopicoConhecimento[]): string {
  if (topicos.length === 0) return ''
  const blocos = topicos.map(t =>
    `### ${t.modulo} — ${t.titulo}${t.caminho ? `\n📍 Onde fica: ${t.caminho}` : ''}\n${t.conteudo}`
  ).join('\n\n')
  return `\n\n━━━ BASE DE CONHECIMENTO (tópicos relevantes para esta pergunta) ━━━\n${blocos}\n━━━ fim da base ━━━`
}
