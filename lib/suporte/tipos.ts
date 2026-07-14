// Tipo da entrada RICA da base de conhecimento (padrão-ouro: 8 seções).
// conteudo = texto completo (o que é · passo a passo · como funciona por trás · erros comuns).
// palavrasChave = MUITAS variações de pergunta (linguagem de leiga) + termos — usado no retrieval.
// faq = perguntas variadas × respostas completas, para popular a Central de FAQ.

export interface EntradaConhecimento {
  slug: string
  modulo: string
  tela: string
  caminho: string
  palavrasChave: string
  conteudo: string
  faq?: { pergunta: string; resposta: string }[]
}
