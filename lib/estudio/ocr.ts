// SOA Edition — OCR ASSISTENTE (servidor). Em arte ACHATADA (JPEG/PDF sem camadas), a visão do Gemini
// SUGERE onde há texto e chuta o que é nome/idade; a artesã confirma e o campo nasce posicionado.
// NÃO reconstrói fundo nem troca texto sozinho (decisão de arquitetura: texto queimado não se
// "desqueima" — o campo vai sobre molde limpo ou com cobertura).
// A chave vem de env e nunca sai do servidor (nome histórico: ANTHROPIC_API_KEY_GESTAO guarda a chave Google).

export interface TextoDetectado {
  texto: string
  /** Caixa normalizada 0…1 na imagem ORIGINAL (x, y = canto sup. esq.). */
  x: number; y: number; w: number; h: number
  /** Direção de leitura em graus (0 = normal; 90 = de cima para baixo; -90/270 = de baixo para cima; 180 = de cabeça para baixo). */
  rotacao: number
  tipo: 'nome' | 'idade' | 'nome_idade' | 'outro'
  /** Nome/idade chutados a partir do texto (ex.: "#sophiafaz4" → nome "Sophia", idade "4"). */
  nome: string | null
  idade: string | null
  estilo: 'cursiva' | 'arredondada' | 'serifada' | 'sem_serifa' | 'decorativa'
  cor: string
  /** Cor do contorno em volta das letras (se houver). */
  contorno: string | null
  /** Tem sombra projetada. */
  sombra: boolean
  curvado: boolean
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    textos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          texto: { type: 'STRING' },
          box_2d: { type: 'ARRAY', items: { type: 'INTEGER' } },
          primeira_letra: { type: 'STRING', enum: ['esquerda', 'direita', 'topo', 'base'] },
          tipo: { type: 'STRING', enum: ['nome', 'idade', 'nome_idade', 'outro'] },
          nome: { type: 'STRING', nullable: true },
          idade: { type: 'STRING', nullable: true },
          estilo: { type: 'STRING', enum: ['cursiva', 'arredondada', 'serifada', 'sem_serifa', 'decorativa'] },
          cor: { type: 'STRING' },
          contorno: { type: 'STRING', nullable: true },
          sombra: { type: 'BOOLEAN' },
          curvado: { type: 'BOOLEAN' },
        },
        required: ['texto', 'box_2d', 'primeira_letra', 'tipo', 'estilo', 'cor', 'curvado'],
      },
    },
  },
  required: ['textos'],
}

const PROMPT = `Você analisa artes de papelaria personalizada (topos de bolo, caixinhas, tags, convites) que foram "achatadas" numa imagem.
Encontre TODOS os textos legíveis que parecem PERSONALIZADOS por cliente (nome da criança, idade, hashtag com nome/idade, frases com o nome) e também os demais textos.
Para cada texto devolva:
- texto: exatamente como aparece;
- box_2d: [ymin, xmin, ymax, xmax] da caixa que envolve o texto, normalizada de 0 a 1000 na imagem inteira;
- primeira_letra: onde fica a PRIMEIRA letra do texto dentro da caixa, olhando a imagem como ela está — "esquerda" (texto normal), "base" (o texto sobe: começa embaixo e termina em cima), "topo" (o texto desce: começa em cima e termina embaixo) ou "direita" (de cabeça para baixo);
- tipo: "nome" (só o nome), "idade" (só a idade, ex.: "4 anos", "faz 4"), "nome_idade" (junta os dois, ex.: "#sophiafaz4", "Sophia 4 anos") ou "outro";
- nome: o nome próprio contido, com inicial maiúscula (ex.: "Sophia"), ou null;
- idade: só o número da idade (ex.: "4"), ou null;
- estilo: cursiva, arredondada, serifada, sem_serifa ou decorativa;
- cor: cor principal (preenchimento) das letras em hexadecimal (#rrggbb);
- contorno: cor do contorno/borda em volta das letras em hexadecimal, ou null se não houver;
- sombra: true se as letras têm sombra projetada;
- curvado: true se o texto segue um arco.
Ignore textos minúsculos de marca d'água/créditos e códigos QR.`

function chave(): string | null {
  return process.env.ANTHROPIC_API_KEY_GESTAO || process.env.GEMINI_API_KEY || null
}
export const ocrDisponivel = () => !!chave()

/** Analisa a imagem (JPEG/PNG em base64, sem o prefixo data:). */
export async function detectarTextos(base64: string, mime: string): Promise<TextoDetectado[]> {
  const k = chave()
  if (!k) throw new Error('Leitura de texto indisponível neste ambiente.')
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${k}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: base64 } }, { text: PROMPT }] }],
      // Saída JSON estruturada no 2.5 exige thinkingBudget 0 (senão estoura o limite "pensando").
      generationConfig: { temperature: 0, maxOutputTokens: 4000, responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(45_000),
  })
  if (!r.ok) throw new Error(`A leitura de texto falhou (${r.status}).`)
  const j = await r.json()
  const txt = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '{}'
  let bruto: { textos?: { texto: string; box_2d: number[]; primeira_letra: string; tipo: TextoDetectado['tipo']; nome?: string | null; idade?: string | null; estilo: TextoDetectado['estilo']; cor: string; contorno?: string | null; sombra?: boolean; curvado: boolean }[] }
  try { bruto = JSON.parse(txt) } catch { return [] }
  const lim = (v: number) => Math.max(0, Math.min(1, v))
  return (bruto.textos || []).filter(t => Array.isArray(t.box_2d) && t.box_2d.length === 4 && t.texto?.trim()).map(t => {
    const [y0, x0, y1, x1] = t.box_2d.map(n => Number(n) / 1000)
    // Pergunta concreta ("onde está a 1ª letra?") acerta mais que pedir o ângulo: o modelo erra o sentido do giro.
    const rot = ({ esquerda: 0, base: -90, topo: 90, direita: 180 } as Record<string, number>)[t.primeira_letra] ?? 0
    return {
      texto: t.texto.trim().slice(0, 200), x: lim(Math.min(x0, x1)), y: lim(Math.min(y0, y1)), w: lim(Math.abs(x1 - x0)), h: lim(Math.abs(y1 - y0)),
      rotacao: rot, tipo: t.tipo, nome: t.nome?.trim() || null, idade: t.idade?.replace(/\D/g, '') || null,
      estilo: t.estilo, cor: /^#[0-9a-f]{6}$/i.test(t.cor) ? t.cor : '#1f2937',
      contorno: t.contorno && /^#[0-9a-f]{6}$/i.test(t.contorno) ? t.contorno : null, sombra: !!t.sombra, curvado: !!t.curvado,
    }
  })
}
