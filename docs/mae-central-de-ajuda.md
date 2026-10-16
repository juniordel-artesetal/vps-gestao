# Módulo MAE — Central de Ajuda (tutorial + perguntas frequentes com busca)

Pedido da Naty em 15/10/2026, véspera do lançamento. Hoje o passo a passo do MAE existe como uma página avulsa (`guia-metodo-mae.html`, com 23 prints em `img/`; publicada também em `usesoa.com.br/mae/guia.html`). A ideia é levar esse conteúdo **para dentro do SOA**, numa Central de Ajuda fácil de atualizar, com busca e espaço para as videoaulas.

## 1. O que é

Uma página dentro do SOA, **"Central de Ajuda do Método MAE"**, com:
- **Busca** no topo ("Como posso te ajudar?").
- **Trilha do tutorial**, na ordem do guia: 00 Antes de começar → 01 Base de caixas → 02 Tags, rótulos e etiquetas → 03 Marca de registro e corte → 04 Criar um tema → 05 Tema pronto → 06 Pedidos e edição em massa → 07 Gerar, imprimir e cortar → 08 Regras de ouro.
- **Perguntas frequentes**, curtas, cada uma com resposta direta e link para o artigo completo.
- **Glossário**.
- **Videoaula** em cada artigo (a Naty vai gravar uma aula curta por seção).

Público: alunas do Método MAE, muitas iniciantes em sistema. Linguagem simples, frases curtas, prints reais.

## 2. Conteúdo fácil de atualizar

- **Um arquivo Markdown por artigo**, em `content/ajuda-mae/`, com frontmatter:
  ```yaml
  titulo: Marca de registro e corte certinho
  secao: 03
  tipo: tutorial        # tutorial | faq | glossario
  resumo: Como subir a marca da sua máquina e fazer o ajuste fino.
  palavras_chave: [marca de registro, MR, corte deslocado, silhouette, cameo, ajuste fino, print and cut]
  video: https://youtu.be/...      # opcional
  video_duracao: "4 min"           # opcional
  telas: [base.marca-registro]     # ids das telas do editor que abrem este artigo
  atualizado: 2026-10-15
  ```
- Prints em `public/ajuda-mae/img/` (os 23 do guia já vêm prontos, com nomes de clientes escondidos).
- Componentes simples no Markdown: **Dica** (laranja), **Atenção** (amarela), **Passo a passo numerado**, **Print com legenda** (clicar amplia), **Tabela**.
- Para a Naty atualizar: editar o `.md` (ou pedir ao Claude Code). Sem banco de dados, sem painel admin por enquanto.
- Rodapé de cada artigo: "Atualizado em 15/10/2026".

## 3. Busca

- No topo da Central e no **"?"** do editor (painel lateral).
- Procura em título, resumo, palavras-chave e texto dos artigos e das perguntas.
- **Ignora acento e maiúscula**; **tolera erro de digitação** ("registo", "tirangulove", "etiqueta escolra").
- **Sinônimos**:

  | A aluna digita | Encontra |
  |---|---|
  | MR, marca, registro, cameo, silhouette, corte torto, cortou errado | Marca de registro e corte |
  | sangria, filete branco, sobra | Arte inteligente |
  | quantidade, saiu 1, só 1 folha, kit de 10 | Regra da quantidade / Ligar ao produto do SOA |
  | tema não encontrado, não acha o tema | Pedidos: vincular tema |
  | nome pequeno, nome grande, fonte reduzida, não cabe | Nome e auto-ajuste |
  | acento, fonte sem acento, letra faltando | Fonte sem acento |
  | gêmeas, irmãos, dois nomes, dois temas | Dividir pedido |
  | lote, imprimir tudo, um PDF só | Gerar em lote |
  | tag, rótulo, nutella, etiqueta | Peças sob medida |

- Resultado: título, trecho com a palavra destacada e o tipo (Tutorial / Pergunta). Enter abre o primeiro.
- Nada encontrado: "Não achei. Tente outras palavras ou fale com o suporte" + link do suporte.
- Busca no navegador (índice gerado no build, MiniSearch ou Fuse.js). Sem serviço pago.
- Registrar as buscas **sem resultado** (só o termo), para a Naty saber quais artigos criar.

## 4. Ajuda contextual no editor

- Cada etapa do editor tem um id (`base.moldes`, `base.partes`, `base.grupos`, `base.marca-registro`, `tema.papeis`, `tema.texto`, `tema-pronto`, `pedidos`, `gerar`…).
- O **"?"** e "Como funciona esta etapa?" abrem o artigo daquela etapa (campo `telas`).
- Avisos do sistema podem ter "Saiba mais" levando ao artigo certo.

## 5. Videoaulas

- Player do YouTube no topo de cada artigo com `video` (título e duração). Sem vídeo: o espaço não aparece.

## 6. Visual

- Visual do SOA; referência: o guia avulso (passos numerados com bolinha laranja, prints emoldurados, caixas de Dica e Atenção, índice fixo à esquerda no computador e recolhível no celular). Funciona no celular.

## 7. Perguntas frequentes para começar

Migrar as 9 do guia e acrescentar:
1. Gerou só 1 unidade / 1 folha.
2. "Tema não encontrado".
3. Botão em "Gerar (0)".
4. Nome saiu pequeno demais.
5. A idade ficou longe do nome.
6. Mudei uma caixa e mudou tudo (ou o contrário).
7. Corte deslocado.
8. "Fonte não instalada".
9. O MAE não abre ou não acha a pasta.
10. Pegue e monte saiu em PDFs separados no lote (desligar "Um PDF por tipo de produto").
11. Pedido com dois nomes ou gêmeas.
12. Pedido sem nome: como usar a versão sem nome.
13. Marquei como impresso e o pedido continua em Pendentes.
14. Posso apagar papéis e elementos da Biblioteca?
15. Como colocar um produto novo (ex.: sacolas) numa base que já existe (grupos de produto).

## 8. Teste de aceite

- Os 11 tópicos do guia de referência estão na Central, com todos os prints e dicas.
- Buscar "mr", "cortou torto", "saiu 1", "gemeas", "acento" e "tirangulove" encontra o artigo certo.
- O "?" na etapa Marca de registro abre o artigo de marca de registro.
- A Naty muda uma frase num `.md`, publica, e a mudança aparece na Central.
- No celular (400 px), sem rolagem lateral.
