# Módulo MAE — Melhorias (Lote 7)

Ideias da Naty em 11/10/2026, para o fluxo de **pedidos, impressão e produção**. Não é reteste: o Lote 6 ainda não foi testado, e a Naty vai testar os Lotes 6 e 7 juntos.

Itens 116 a 121, em sequência ao Lote 6 (que foi até o 115).

**Depende do Lote 6:** item 88 (tema por pedido salvo corretamente), item 97 (ligação pelo nome do tema do SOA) e item 95 (folha de impressão com gabarito fixo). Faça o Lote 7 **depois do P1 do Lote 6**.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-7.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-7.md (melhorias de pedidos, impressão e
produção do módulo MAE), docs/mae-ajustes-lote-6.md, docs/mae-spec.md e
docs/mae-progresso.md. O Lote 7 depende dos itens 88, 95 e 97 do Lote 6:
faça-o depois do P1 do Lote 6. Em modo plano:
1) avalie primeiro o item 120 (MAE avulso × SOA): ele define a camada de
   "fonte de pedidos" e de "destino do status", que os itens 116, 117 e 119
   usam. Mesmo que a importação de planilha (121) fique para depois, a
   estrutura precisa nascer agora;
2) depois: 116 (busca, filtros e ações em massa), 117 (lote de impressão
   com vários pedidos), 118 (ordem do PDF), 119 (etapa de impressão na
   produção do SOA), 121 (planilha da Shopee).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes e
registre em docs/mae-progresso.md o que foi feito, item por item.
```

---

### 116. Busca, filtros e ações em massa na edição em massa
**Objetivo:** encontrar e tratar vários pedidos de uma vez. Ex.: filtrar todos os pedidos do tema **Mickey Safari**, selecionar todos e vincular a arte num clique.

- **Busca única** no topo: "buscar pedido, cliente, aniversariante…". Procura em nº do pedido, nome do cliente, nome do aniversariante e tema.
- **Filtros em chips** (combináveis):
  - **tema** (nome do tema no SOA);
  - **produto** / variação;
  - **status** (aprovado, aguardando aprovação…);
  - **loja / canal** (ex.: Artes e Tal, Fofuras de Papel);
  - **prazo de envio** ("despacha hoje", "até amanhã", "atrasados"). O SOA já tem a data limite de envio. Ordenar do mais urgente para o menos urgente;
  - **sem tema vinculado**, **com observação**, **ajustado**.
- **Barra de ações em massa** quando há pedidos selecionados: **Vincular tema**, **Gerar**, **Gerar em lote** (item 117), **Marcar como impresso** (item 119).
- **Vincular tema em massa:** ao vincular um tema aos pedidos filtrados, perguntar **"Lembrar para os próximos pedidos com o tema Mickey Safari?"** (mesma ligação do item 97 do Lote 6: nome do tema no SOA → tema MAE).
- **Filtros salvos** (ex.: "Hoje – Shopee"), para não remontar todo dia.
- Contador: "12 pedidos · 5 selecionados".

### 117. Lote de impressão: vários pedidos num PDF só, já nas quantidades
**Objetivo:** em vez de abrir o PDF de cada cliente, abrir **um único arquivo** e mandar imprimir de uma vez. Cada pedido já entra repetido na sua quantidade (item 79 do Lote 5).

- Selecionar pedidos → **"Gerar em lote"**.
- Cada pedido entra com **as suas quantidades por caixa** (as do botão Quantidades, item 79).
- **Mesma técnica do item 79:** renderizar cada arte diferente uma vez e reaproveitar o mesmo objeto de imagem nas páginas repetidas. O que pesa é o número de **artes diferentes** (pedidos × caixas), não o de cópias.
- **Divisão automática:** acima de um limite (sugestão: **10 pedidos** ou um nº de páginas a calibrar em teste), o sistema divide em vários arquivos: `LOTE_2026-10-11_Kit-Festa_1de3.pdf`. Não travar o navegador nem a impressora.
- **"Separar por produto"** ligado por padrão (kit e tag costumam ir em papéis diferentes): um lote por produto.
- Produtos com **folha montada** (tags, etiquetas, rótulos) seguem o gabarito fixo e o "Aproveitar folhas" (item 95 do Lote 6).
- Nome do arquivo com data, produto e total de páginas/cópias.
- Os pedidos do lote vão para a aba **Já gerados**, com a indicação do lote.
- **Revisão do item 60 (Lote 5):** o "Juntar num PDF só por produto" foi retirado porque não considerava as quantidades. Agora, com as quantidades resolvidas, o lote volta assim.

### 118. Ordem das páginas no lote
Na geração em lote, escolher a ordem:
- **Por pedido:** o kit de cada cliente junto (pedido 1 completo, depois pedido 2…).
- **Por modelo:** todas as milks dos pedidos do lote, depois todos os cubos, depois todas as pirâmides… Ideal para quem separa os moldes iguais depois de impresso para mandar cortar.

**Na ordem por modelo:**
- **"Intercalar temas iguais"** (ligado por padrão): dentro de cada modelo, ordenar os pedidos para que **dois do mesmo tema não fiquem colados**, evitando erro na separação. Ex.: milk Moana (Ana) → milk Safari (Bento) → milk Moana (Bia) → milk Safari (Caio).
  - As **cópias do mesmo pedido continuam juntas** (as 2 milks da Ana lado a lado); o que se intercala são os pedidos.
  - Se não for possível intercalar (todos do mesmo tema), seguir a ordem normal, sem erro e sem aviso.
- **"Imprimir identificação do pedido"** (ligado por padrão): "#123 · Naty" pequeno, **fora da linha de corte e da sangria**, em cada página. Quem separa pelo tema, nome e idade (como a Naty) pode desligar.

### 119. Ligação com a etapa de impressão da produção do SOA
**Objetivo:** o que foi impresso aparece na produção do SOA, para a equipe saber em que fase cada pedido está.

- **Tipo de etapa:** as etapas de produção do SOA ganham um **tipo** (ex.: impressão, expedição). O MAE se liga pelo **tipo**, não pelo nome. Se a etapa se chama "Imprimir" ou "Impressão", funciona igual.
- **Etapa de impressão obrigatória para quem usa a edição em massa:** na primeira vez na edição em massa, se não houver nenhuma etapa do tipo impressão:
  - alerta: **"Seu fluxo de produção não tem etapa de Impressão. Criar agora?"**;
  - o sistema cria a etapa; a usuária só define a posição dela no fluxo nas **configurações do SOA** (como já faz hoje). A expedição continua obrigatória, no fim.
- **Gerar não é imprimir** (às vezes gera hoje e imprime amanhã):
  - ao gerar (um pedido ou lote): caixinha **"Iniciar a etapa Impressão nestes pedidos"**, ligada por padrão;
  - quem prefere marcar depois: botão **"Marcar como impresso"** na aba Já gerados e na barra de ações em massa.
- **"Gerar de novo"** não faz o pedido voltar de etapa.
- Sem SOA (MAE avulso), esse item não aparece (item 120).

### 120. MAE avulso × SOA completo (estrutura — planejar agora)
O MAE também será **vendido separado**. O sistema precisa saber se a pessoa usa o **SOA completo** ou **só o MAE** e se adaptar sem confundir.

- **Detecção do plano** (SOA completo / só MAE). A interface mostra só o que existe no plano.
- **Camada "fonte de pedidos":**
  - **SOA** (como hoje);
  - **planilha da Shopee** (item 121) — caminho escolhido pela Naty para o MAE avulso;
  - **cadastro manual rápido** (nº, cliente, produto, quantidade, nome, idade, tema, observação).
- **Camada "destino do status":**
  - com SOA: etapas de produção (item 119);
  - sem SOA: status interno do MAE (**gerado / impresso**), visível na lista de pedidos.
- **Grupos e produtos** (item 96 do Lote 6): com SOA, ligar a produtos do SOA; sem SOA, nome digitado.
- **Tema do pedido:** com SOA, vem do pedido; sem SOA, vem da planilha ou é escolhido na lista.
- A estrutura tem que nascer agora, mesmo que a planilha (121) seja feita depois.

### 121. Importar planilha de pedidos da Shopee (MAE avulso)
- Botão **"Importar pedidos (planilha da Shopee)"** na edição em massa, quando não há SOA.
- **Mapear colunas** na primeira importação (nº do pedido, produto/variação, quantidade, prazo de envio, observação do comprador, nome do cliente) e **lembrar o mapeamento** para as próximas.
- Personalização (nome, idade, tema): ler da observação quando possível e completar na lista de pedidos (colunas editáveis, item 78).
- Pedidos já importados não se repetem (chave: nº do pedido).
- Depois de importados, funcionam igual aos do SOA: filtros (116), lote (117), ordem (118).
