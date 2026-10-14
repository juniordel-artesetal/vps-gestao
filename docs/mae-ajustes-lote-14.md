# Módulo MAE — Ajustes do uso real (Lote 14)

Encontrados pela Naty em 14/10/2026 ao criar a primeira **base de tag** (tag redonda de 4 cm com furo, 24 por folha A4) e ao subir os temas prontos pela automação, e no primeiro uso real do **conjunto de aplique**. Itens 187 a 201, em sequência ao Lote 13 (que foi até o 186).

**Resumo:** a folha de impressão com gabarito da plotter **quase funciona**: gabarito e marca de registro saíram certos, mas a arte não entra na folha e a quantidade não vira folhas. E criar uma peça pequena ficou **complexo demais**: 12 etapas, metade sem sentido para peça plana. A Naty tentou várias vezes e não conseguiu terminar a base da tag.

> "Tá muito difícil criar, sério. Vamos pensar num processo mais fluido."

Por isso este lote traz, além das correções, um **redesenho do fluxo de peças sob medida** (item 189).

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-14.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-14.md, docs/mae-ajustes-lote-13.md,
docs/mae-spec.md e docs/mae-progresso.md. Se ainda houver P0 do Lote 13
em aberto, eles vêm primeiro.
Em modo plano, organize nesta ordem:
P0) 187 (geração da folha: arte não entra nas posições e a quantidade do
    pedido não vira número de folhas) e 188 (24 tags de 4 cm "não cabem"
    numa A4);
Estrutural) 189 (REDESENHO do fluxo de bases de peças sob medida). Antes de
    codar, desenhe o novo fluxo (tipos de base, etapas, modelo de dados de
    "Folha do kit") e diga o que do código atual é reaproveitado (peças por
    medida, folhas de impressão, gabarito, grupos, marca de registro) e o
    que sai da tela para peças sob medida;
P1) 190 (sobra de folha e "Aproveitar folhas"), 191 (criar tema criou outra
    base), 192 (botão Próximo não avança), 193 (mensagens de erro com a
    causa real), 195 (conjunto de aplique: ajustes do primeiro uso real),
    196 (selecionar vários objetos com Shift), 197 (estilos acompanham o
    tamanho do objeto), 198 (formas: esticar livremente e digitar a
    medida), 199 (lote com kit + tag: "Separar por papel" desligado
    continua separando), 200 (lote por modelo: agrupar pela marca de
    registro da prancheta, não pelo nome da caixa), 201 (Gerar: uma tela só, com opções claras;
    absorve o 199);
P2) 194 (tema pronto numa base existente).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes,
PUBLIQUE em produção, confira na URL de produção e registre em
docs/mae-progresso.md o que foi feito e publicado, item por item.
Regra de ouro: NENHUMA ferramenta pode existir em dois lugares (ex.: marca
de registro na folha E na etapa Marca de registro). Se algo mudou de lugar,
remova do lugar antigo.
```

---

## P0

### 187. Folha de impressão: a arte não entra e a quantidade não vira folhas
- **Configuração do teste:** base "tag agradecimento 4x4 · teste tag v2". Folha 1 A4 deitada (297 × 210 mm), gabarito **importado da plotter** (24 tags redondas com furo), espaço 2 mm, modo "Kit (não divide entre folhas)", prévia "24 peças · 62% da folha usada". Grupo "teste tag" ligado a "Tags (todas as variações)" do SOA. Tema com a arte do Woody (Toy Story), NOME "Guilherme", IDADE "1 ano".
- **Resultado 1, pedido de 1 unidade** (`Guilherme_1ano_teste-tag_teste-tag-1un.pdf`): **1 folha A4** com os 24 círculos de corte (com o furo) e a marca de registro nos 4 cantos. ✅ Gabarito e MR certos. ❌ **Nenhuma arte**: só as linhas vermelhas de corte, sem o Woody, sem o nome.
- **Resultado 2, pedido de 96 unidades** (`Guilherme_1ano_teste-tag_teste-tag-96un.pdf`): **48 páginas de 40 × 40 mm**, todas iguais. Cada página mostra um recorte do meio da folha, entre 4 círculos, com a arte esticada. ❌ Ignorou a folha e gerou peça por peça, com quantidade errada (48, não 96 nem 4).
- **Esperado:**
  - Pedido de produto ligado a uma folha **sempre sai em folhas** (nunca peça por peça).
  - **A arte do tema entra em cada posição do gabarito**: a arte da tag (com NOME/IDADE) dentro de cada círculo, com a sobra (0,5 mm) passando da linha de corte, sem invadir a vizinha nem a marca.
  - **Número de folhas = quantidade do pedido ÷ peças por folha, arredondado para cima.** 96 ÷ 24 = **4 folhas**; 48 = 2; 24 = 1; 30 = 2 (a 2ª com 6, ver item 190).
  - O PDF sai em **A4** (o tamanho da folha), com a MR da folha em todas as páginas.
- **Teste de aceite:** pedido do Guilherme com 96 tags → **1 PDF de 4 páginas A4**, cada página com 24 tags do Woody com "Guilherme 1 ano" encaixadas nos círculos, MR nos cantos. Com 48 → 2 páginas.

### 188. Bug: 24 tags de 4 cm "não cabem" numa A4
- Base "tag agradecimento 4x4 · teste tag v4". Folha A4, sem gabarito, peça **Tag redonda 40 × 40 mm com furo Ø 3,5**, quantidade **24**, Preencher folha.
- **Resultado:** "**0 peças · 0% da folha usada — 24 peça(s) não couberam nesta folha**". A prévia mostra uma grade de quadrados cinza vazios.
- **A conta:** em A4 deitada (297 × 210), 6 × 4 tags de 40 mm com 2 mm de espaço ocupam 250 × 166 mm. Cabem, com folga, mesmo descontando a marca de registro.
- **Esperado:** 24 tags redondas posicionadas, prévia com os círculos, "24 peças · ~62% da folha".

---

## Estrutural

### 189. Novo fluxo de PEÇAS SOB MEDIDA (folhas de kit)
- **Problema:** para criar uma tag, a usuária passa por 12 etapas (Moldes, Peças por medida, Folhas de impressão, Grupos, Pranchetas, Faces, Partes, Enquadramento, Texto, Arte inteligente, Marca de registro, Salvar). Faces, partes, enquadramento e pranchetas não fazem sentido numa peça plana. A marca de registro aparece em dois lugares. Adicionar a tag redonda num grupo que já tinha um molde virou, sem aviso, um kit "1 de cada".
- **Este item substitui** o antigo assistente "Peça pequena" e resolve, para peças sob medida: aviso de folha sem produto, marca de registro na folha × na peça, formatos do gabarito escritos na tela, "Preencher folha" sem retorno, molde × arte e formatos (círculo, furo) na medida personalizada.

#### Princípios

1. **Fácil antes de completo.** A usuária preenche campos e vê o resultado na hora. O ajuste fino existe, mas é opcional.
2. **Sem redundância.** Cada coisa se configura em um lugar só.
3. **A unidade visual é a FOLHA.** Na base, no tema e na prévia, a tela mostra as folhas montadas, nunca uma etiqueta solta.
4. **1 unidade no pedido = 1 kit = N folhas.** Ex.: um kit com Folha 1 (×2) + Folha 2 (×3) gera 5 folhas; 2 kits geram 10.
5. **Só aparece a etapa que faz sentido** para o tipo de base.

#### 189.1 Dois tipos de base, cada um com suas etapas
- Em **Nova base**, a primeira pergunta:
  - **"Caixas e peças com molde"** (milk, cubo, pirâmide, sacolas): o fluxo atual (moldes, faces, partes, enquadramento…).
  - **"Peças sob medida"** (etiquetas, tags, rótulos, adesivos, toppers): o fluxo novo abaixo.
- **Etapas da base de peças sob medida** (só estas aparecem na barra da esquerda):
  1. **Peças**
  2. **Folhas do kit**
  3. **Ajuste fino** (opcional)
  4. **Fundo e miolo**
  5. **Textos**
  6. **Produto do SOA**
  7. **Salvar**
- **Saem** da base de peças sob medida: **Moldes**, **Faces** (fechar pontilhado, laço, dividir, unir, ímã), **Enquadramento** e a etapa separada de **Marca de registro**, que passa a ficar dentro de cada folha (item 189.3).
- O botão **Próximo** percorre as etapas na ordem (item 192).

#### 189.2 Etapa 1 — Peças
- **Medidas prontas** (o catálogo atual: Etiqueta escolar, Tag, Tubete, Nutella, Mini Pringles…). Clicar em um chip mostra as peças dele com caixinha de marcar (ex.: Etiqueta escolar → Livros 9 × 5, Caderno 7 × 3, Lápis 5 × 2,6).
- **Medida personalizada:** nome + **formato** (retângulo, quadrado, **círculo**, oval, retângulo com canto arredondado → raio) + largura × altura + **furo** opcional (diâmetro e posição).
- Pode **misturar**: marcar peças prontas e adicionar personalizadas no mesmo kit (caso do kit de etiqueta escolar).
- Lista "Peças desta base" com nome, formato, medida, editar, duplicar e excluir.
- Adicionar uma peça **não cria kit escondido** (hoje, adicionar a tag redonda num grupo que já tinha um molde virou "1 de cada"). A composição do kit se define só na etapa 2.

#### 189.3 Etapa 2 — Folhas do kit (o coração do fluxo)
- Cada folha é um **cartão** de preencher, com a **prévia da folha ao lado, atualizando na hora**:

```
┌─ Folha 1 ──────────────────────────────── [Duplicar] [Excluir] ─┐
│ Papel: [A4 ▾]  Orientação: [Automática ▾]                         │
│ Marca de registro: [TAG A4_MR ▾]  (+ Adicionar nova · Sem marca)  │
│ Espaço entre peças: [2] mm    Margem da folha: [5] mm             │
│                                                                   │
│ Peças nesta folha:                                                │
│   [Livros 9×5 ▾]   [ 4 ]                                         │
│   [Caderno 7×3 ▾]  [ 6 ]                                         │
│   + Adicionar peça                                                │
│                                                                   │
│ Impressões desta folha no kit: [ 2 ]                             │
│ ✔ 10 peças · cabem até 14 · 71% da folha                          │
│                                                                   │
│ Gabarito / faca de corte (opcional): [Enviar arquivo]             │
│   Aceita: SVG, PDF, DXF                                           │
└───────────────────────────────────────────────────────────────────┘
[ + Adicionar folha ]

Este kit = 5 folhas impressas (Folha 1 × 2 · Folha 2 × 3)
```

- **Marca de registro fica aqui, por folha** (lista + "Adicionar nova" + "Sem marca"). A marca nova sobe direto daqui e entra na lista geral. **Não existe outro lugar** para configurar marca nessa base.
- **Orientação automática:** o MAE escolhe retrato ou paisagem, o que couber mais. Dá para fixar.
- **Gabarito / faca de corte (opcional):** quem corta em **faca de corte** ou já tem o arquivo da plotter sobe o arquivo, e **as posições ficam idênticas a ele** (travadas).
  - Formatos aceitos escritos na tela.
  - O MAE reconhece as formas do arquivo e associa cada uma à peça de mesma medida. Forma sem peça correspondente → aviso.
  - O mesmo arquivo serve de **arquivo de corte**, entregue junto com o PDF. Não há botão separado.
- **Sem gabarito:** o MAE distribui sozinho, em grade, respeitando espaço, margem e área da marca de registro.
- **Coube / não coube, em tempo real:** "✔ cabem até 14" ou "⚠ 3 peças não couberam: diminua a quantidade, troque o papel ou ajuste na etapa Ajuste fino". Nunca deixa salvar sem avisar.
- **Resumo do kit** sempre visível embaixo: "Este kit = 5 folhas impressas".
- **Como o pedido conta** (escolha única, logo acima do resumo):
  - **"1 unidade no pedido = 1 kit"** (padrão): qtd 2 = 2 kits = 10 folhas.
  - **"O pedido vem em quantidade de peças"** (ex.: a Shopee manda **96 tags**): o MAE divide pelas peças do kit (96 ÷ 24 por folha = 4 folhas). É o caso real da tag do Guilherme.

#### 189.4 Etapa 3 — Ajuste fino (opcional)
- A tela mostra as **folhas inteiras** (Folha 1, Folha 2…), não uma peça solta. Substitui a etapa "Pranchetas" para essa base.
- Ferramentas: mover, girar, alinhar, distribuir, espaçamento; **"Reorganizar automaticamente"** para voltar à grade do MAE.
- **Peças que não couberam** aparecem em vermelho, fora da folha, com o alarme "3 peças fora da folha: arraste para dentro ou diminua a quantidade".
- Com gabarito travado, só leitura (cadeado), com opção "destravar".

#### 189.5 Etapa 4 — Fundo e miolo (camadas da peça)
- Substitui "Faces / Partes" nessa base. Inspirada na tag real da Naty: **papel de fundo** (xadrez) + **círculo interno** onde fica a arte + nome.
- Cada peça tem, por padrão:
  - **Fundo:** a peça inteira, com a sobra de corte.
  - **Miolo:** uma forma interna. Pode ser no **mesmo formato da peça**, com **margem** (mm), ou em **outro formato** (círculo, retângulo, oval…). Dá para aumentar, diminuir e mover.
  - Opcional: **Borda / moldurinha** entre fundo e miolo (o recurso de moldurinha que já existe).
- No **tema**, cada camada recebe o que já existe hoje: papel, cor, estilos, contorno, sombra.
- Define uma vez **por tipo de peça**; vale para todas as cópias nas folhas.

#### 189.6 Etapa 5 — Textos
- NOME, IDADE, HASHTAG, Nome + idade, Sufixo (anos), campos extras.
- **Área desenhada uma vez por tipo de peça** (ex.: na etiqueta 9 × 5 e na 5 × 2), valendo para todas as cópias de todas as folhas.
- Auto-ajuste dentro da área (como no 164), com prévia "nome curto / nome longo".

#### 189.7 Etapa 6 — Produto do SOA
- Ligar a base ao produto do SOA (ex.: "Kit etiqueta escolar", "Tags de agradecimento").
- Mostrar como o pedido vai sair: *"1 pedido de 2 kits = 10 folhas"* (ou, no modo por peças, *"96 tags = 4 folhas"*).
- **Aviso ao salvar** se não houver produto ligado.

#### 189.8 Tema e geração para peças sob medida
- **Tema / arte pronta:** a usuária sobe a arte **de cada tipo de peça** (ex.: a tag do Woody para a "Tag redonda 4 cm"; uma arte para a 9 × 5, outra para a 7 × 3). O MAE encaixa a arte **em todas as cópias daquela medida** e **a tela mostra as folhas inteiras já preenchidas**.
  - Arte com proporção diferente da peça: aviso + opção "ajustar / preencher".
  - Também dá para montar o tema com Fundo e miolo (papéis, cores, estilos) em vez de arte pronta.
- **Geração (edição em massa):**
  - 1 kit → as folhas do kit, cada uma repetida pelo número de impressões, com nome/idade em todas as peças.
  - **Ordem:** todas as Folhas 1 juntas, depois todas as Folhas 2 (mesma regra de "ordem por modelo" das caixas). Em lote, junta vários pedidos do mesmo produto nessa ordem, com a identificação do pedido na margem.
  - **Sobra:** folha incompleta (quantidade quebrada) pode ser completada com outro pedido se "Aproveitar folhas" estiver ligado (item 190).
  - Marca de registro de cada folha + **fundo branco atrás da marca** (item 175).

#### 189.9 Melhorias extras

- **Modelos prontos de kit:** começar de "Kit etiqueta escolar" ou "Tags 4 cm × 24 (A4)" já configurado, e só ajustar.
- **Folha de teste de corte:** botão "Imprimir teste" que gera a folha só com os contornos e a marca de registro, para conferir o corte na plotter ou na faca antes de imprimir com arte.
- **Validações automáticas:** peça maior que a folha, peças sobrepostas, peça invadindo a área da marca de registro, furo fora da peça.
- **Duplicar folha** (para criar variações rápidas) e **reordenar folhas** arrastando.
- Mensagens de erro com a causa real: ver item 193.

### Teste de aceite do novo fluxo

1. **Kit de etiqueta escolar:** Folha 1 = 4 × "Livros 9 × 5" + 6 × "Caderno 7 × 3", impressa 2 vezes; Folha 2 = 30 × "5 × 2", impressa 3 vezes. Marca de registro A4 nas duas. Pedido de **1 kit** → **1 PDF de 5 folhas**; pedido de **2 kits** → 10 folhas, na ordem Folhas 1 e depois Folhas 2.
2. **Tag do Guilherme:** tag redonda 4 cm com furo, 24 por A4, fundo xadrez + miolo circular com o Woody e "Guilherme 1 ano". Pedido Shopee de **96 tags** (modo "por peças") → **4 folhas**, arte em todas as tags, marca nos cantos sobre fundo branco.
3. **Com faca de corte:** subir o arquivo da faca → as peças ficam exatamente nas posições da faca; o PDF impresso bate com a faca.
4. Criar a base da tag do zero em **menos de 3 minutos**, sem passar por Moldes, Faces ou Enquadramento.

---

## P1

### 190. Sobra de folha e "Aproveitar folhas"
- A Naty sempre vende kits que fecham folha (48 = 2 folhas), mas outras usuárias podem vender quantidades quebradas.
- **Regra esperada:**
  - **Folhas cheias são do pedido.** 30 tags = 1 folha cheia + 1 folha com 6.
  - Com **"Aproveitar folhas (juntar pedidos)"** ligado na edição em massa, **a sobra** (as 18 posições livres da 2ª folha) é preenchida com tags de outros pedidos do lote, com identificação de cada pedido na margem.
  - Definir como isso convive com o modo **"Kit (não divide entre folhas)"**: o kit não se divide entre folhas, mas a folha incompleta pode receber outro pedido.

### 191. Criar o tema criou outra base
- A Naty tinha criado a base da tag. Ao criar o tema, apareceu uma base nova, **"tag agradecimento 4x4 · teste tag v2"**.
- **Esperado:** criar tema **nunca** cria nem duplica base. Se for necessário salvar uma nova versão da base, avisar e perguntar.

### 192. Botão "Próximo" não avança na criação de base
- A partir do segundo ícone (**Peças por medida**), clicar em **Próximo** não leva à etapa seguinte. Só dá para seguir clicando direto no ícone da barra da esquerda.
- **Esperado:** "Próximo" percorre todas as etapas na ordem, até Salvar.

### 193. Mensagens de erro com a causa real
- Ao gerar o pedido do Guilherme sem gabarito, apareceu *"erro: Nenhuma prancheta tem molde com faces — monte a base antes de exportar"*. A causa real era outra: **o molde "teste tag" tinha perdido o arquivo** (o PNG não estava mais na Biblioteca).
- **Esperado:** a mensagem diz a causa (*"O molde 'teste tag' perdeu o arquivo — PNG não encontrado na Biblioteca"*) e traz um botão de correção (**"Corrigir molde"** / **"Trocar por peça por medida"**).
- Na base de **caixas** (com molde), ao importar um PNG/JPG colorido como molde, avisar: *"Isto parece uma arte, não um molde. O molde é só o contorno de corte; a arte vai no Tema."*

### 195. Conjunto de aplique: ajustes do primeiro uso real
Testado em 14/10/2026 num pedido real (TRANSFORMERS_KIT FESTA, base "kit caixas e sacolas v5"): conjunto **"frame pirâmide"** com 3 peças, de cima para baixo: **personagem** (imagem, impressa) + **Círculo** (impressa) + **Moldura escalopada** (recorte · Dourado). **O uso ficou bem legal** e as folhas saíram. Ajustes:

- **Poder sair da face.** Na caixa (pirâmide), o conjunto fica preso **dentro da face**. Os apliques 3D comuns podem passar da borda da caixa; o conjunto também precisa ter essa opção ("pode sair da face").
- **Tamanho em medida real.** Hoje o tamanho de cada peça é um número de proporção (ex.: 0,87). Mostrar e aceitar a **medida exata** (largura × altura) na unidade escolhida nas configurações (**cm, mm ou px**).
- **Máscara de corte.** Opção em cada peça: **"Recortar pela peça de baixo"** (ex.: o personagem recortado dentro do círculo). Opcional, desligada por padrão.
- **Estilos em cada peça.** As peças do conjunto não têm os estilos que as caixas têm. A Naty quer, por exemplo, a **moldurinha estilizada no círculo**, igual à das caixas. Cada peça do conjunto deve ter o mesmo painel de estilos (moldurinha, contorno, sombra, brilho, papel…).
- **Escolher em quais caixas o conjunto vai.** Ao aplicar o conjunto, ele foi colocado em **todas as caixas** e a Naty teve de tirar à mão, pela lista de camadas. O certo é o mesmo seletor do NOME/IDADE: marcar as caixas que recebem o conjunto (ex.: só a PIRÂMIDE).
- **Painel limpo.** Com o conjunto selecionado, o painel da direita mostra **só as configurações do conjunto**. Hoje aparecem junto "Este tema gera", "Versão sem nome", "Cenário contínuo", escala/rotação genéricas etc., e fica confuso.
- **Folhas de aplique (prévia):**
  - **Reorganizar com o mouse:** arrastar as peças na folha de impressos e na de recorte, além da organização automática.
  - **Títulos opcionais:** hoje cada peça sai com o nome escrito em cima, obrigatoriamente. Opção **"Mostrar títulos"**, **desligada por padrão**.
  - A terceira prévia (só as molduras escalopadas) aparece como "Folha de silhuetas", mas é a **folha de recorte do Dourado**. O título deve dizer o material: "Folha de recorte — Dourado".
- **Aviso de marca de registro.** O padrão estava **"Marca impressos: Sem marca"**. Se a folha impressa vai ser recortada na plotter (print & cut), sem marca a câmera não acha a posição. Avisar: *"A folha impressa dos apliques está sem marca de registro — a plotter não vai conseguir recortar as silhuetas"* e sugerir a marca A4 (ex.: APLIQUES_MR). A folha só de recorte (Dourado) não precisa de marca.

### 196. Selecionar vários objetos e ajustar em conjunto
- Hoje só dá para mexer em um objeto por vez.
- **Esperado:**
  - **Shift + clique** soma objetos à seleção (NOME, IDADE, HASHTAG, elementos, apliques, conjuntos); Shift + clique de novo tira. Também **arrastar uma caixa de seleção** com o mouse em área vazia.
  - Com vários selecionados, dá para, de uma vez: **mover, aumentar/diminuir, girar, alinhar e distribuir, opacidade, ocultar, excluir** e **aplicar estilo** (moldurinha, contorno, sombra, brilho, papel, cor, preset de estilo).
  - O painel da direita mostra só o que é comum a todos. Valores diferentes entre eles aparecem como "—"; mexer no campo aplica a todos.
  - **Ctrl+Z** desfaz a mudança do grupo inteiro de uma vez.
  - Vale no editor de tema e no Ajustar do pedido, respeitando "só nesta caixa" × "todas as caixas".

### 197. Estilos acompanham o tamanho do objeto
- A Naty cria o estilo (contorno, sombra, brilho, moldurinha) num NOME, numa IDADE ou num objeto. Ao **redimensionar**, o estilo fica com a mesma espessura: o contorno fica grosso demais quando o objeto diminui, ou fino demais quando aumenta.
- **Esperado:**
  - Ao redimensionar, **os estilos escalam na mesma proporção** (espessura do contorno, distância e desfoque da sombra, tamanho do brilho, largura da moldurinha), como o "Dimensionar estilos" do Photoshop.
  - Vale também para o **auto-ajuste do nome**: nome longo que encolhe para caber na área encolhe o contorno junto. O visual fica igual em "Ana" e em "Maria Eduarda".
  - Vale ao copiar/colar estilo e ao aplicar preset em objetos de tamanhos diferentes: o estilo é guardado em proporção ao objeto, não em valor fixo.
  - Opção **"Escalar estilos junto"**, ligada por padrão, para quem quiser manter a espessura fixa.

### 198. Formas: esticar livremente e digitar a medida
- Caso real: a cliente pediu um ajuste e a Naty fez uma **moldurinha com a ferramenta Formas** (retângulo, só traçado vermelho de 1 mm) na face CENÁRIO MILK. Precisava de uma medida diferente, mas **não conseguiu esticar a forma em cima e embaixo**: as alças só aumentam e diminuem tudo junto. O único caminho é o controle "Proporção (largura ÷ altura)", que obriga a fazer conta.
- **Esperado:**
  - **Alças laterais** esticam só a largura; **alças de cima e de baixo**, só a altura; **cantos** mudam os dois. **Shift** nos cantos mantém a proporção.
  - Campos **Largura × Altura** com a medida real, na unidade das configurações (**cm, mm ou px**), para digitar o valor exato (ex.: 6,5 × 4,2 cm).
  - **Regra geral do MAE:** toda barra deslizante tem, ao lado, um campo para digitar o valor exato, na unidade certa (mm, cm, %, °). Vale para formas, apliques, conjuntos de aplique (item 195), textos, moldurinha, espessura do traçado etc.

### 199. Gerar em lote: "Separar por papel" desligado continua separando (resolver junto com o 201)
- **Teste (14/10, 11h):** Gerar em lote com 2 pedidos: **Guilherme** (tag de agradecimento, 96 unidades) + **Liz Gabriele** (kit festa Moana Baby, 84 unidades). Ordem por modelo + intercalar temas + identificação + "até 10 pedidos por arquivo".
- **Resultado:** saíram **2 arquivos** em `Exportações/2026-10-14/LOTES`: `LOTE_14-10_11h_1pedido_36pag.pdf` (a tag) e `LOTE_14-10_11h_kit-festa_1pedido_30pag.pdf` (o kit). A Naty testou **com e sem** "Separar por papel (kit × tag)" e o resultado foi o mesmo.
- Mais cedo, um lote de **3 pedidos de kit festa** saiu certo num arquivo só (`LOTE_14-10_10h_3pedidos_126pag.pdf`). Então o problema é misturar kit e tag.
- **Esperado:**
  - **"Separar por papel" ligado:** 2 arquivos (kit e tag), como saiu. Os **dois** nomes dizem o papel: `…_kit-festa_…` e `…_tag_…` (hoje só o do kit diz).
  - **Desligado:** **1 arquivo só** com os dois pedidos.
  - Se kit e tag tiverem tamanho de folha diferente e não puderem ir no mesmo PDF, o modal avisa antes de gerar, em vez de ignorar a opção.
- **A tag saiu com 36 páginas.** 96 tags ÷ 24 por folha = **4 folhas**. É o mesmo problema do item 187.

### 200. Lote "por modelo": caixas iguais de temas diferentes não ficam juntas
- **Teste (14/10, 11h):** Gerar em lote com 2 pedidos de kit festa, **Transformers** (base "kit caixas e sacolas v5") + **Moana Baby** (tema pronto, com base própria). Ordem **por modelo** + intercalar temas, "Separar por papel" desligado. Saiu `LOTE_14-10_11h_2pedidos_66pag.pdf`, 1 arquivo de 66 páginas. ✅ Arquivo único.
- ❌ **A ordem não ficou por modelo.** Lendo o código da marca de registro impresso em cada página (o número da plotter de cada molde), a sequência foi:

| Páginas | Código da MR (molde) | Tema |
| --- | --- | --- |
| 1–11 | 60623140706 (MILK) | Transformers 5 + Moana 6 ✅ juntas |
| 12–16 | 60623154031 | só Transformers |
| 17–21 | 60623155504 | só Transformers |
| 22–26 | 60623155028 | só Transformers |
| 27–37 | 60623155241 | Transformers 5 + Moana 6 ✅ juntas |
| 38–42 | 60623154808 | só Transformers |
| 43–48 | 60623154031 | só Moana ❌ (devia estar junto das 12–16) |
| 49–54 | 60623155504 | só Moana ❌ (17–21) |
| 55–60 | 60623155028 | só Moana ❌ (22–26) |
| 61–66 | 60623154808 | só Moana ❌ (38–42) |

- **Causa confirmada:** o agrupamento compara o **nome da prancheta**, e as duas bases dão nomes diferentes para a mesma caixa. Só batem MILK e TRIANGULOVE, justamente as duas que ficaram juntas:

| Base Moana (tema pronto) | Base Transformers (kit caixas e sacolas v5) | Marca de registro (igual nas duas) |
| --- | --- | --- |
| MILK | MILK ✅ | milk_marca registro |
| CUBO | CUBO COM ALÇA ❌ | cubo_marca registro |
| MAL ALÇA | MALETA COM ALÇA ❌ | maleta alça_marca registro |
| MAL CORAÇÃO | MALETA CORAÇÃO ❌ | maleta coração_marca registro |
| TRIANGULOVE | TRIANGULOVE ✅ | triagulove_marca registro |
| PIRAMIDE | PIRÂMIDE ❌ (só o acento) | piramide_marca registro |

- **Esperado (não usar o código impresso: nem toda marca tem código):**
  1. **Agrupar pela marca de registro escolhida na prancheta** (o arquivo da Biblioteca: "cubo_marca registro", "maleta alça_marca registro"…). Mesma marca = mesmo molde de corte = mesma caixa, seja qual for o nome da prancheta. Na tela de Marca de registro, cada caixa já aponta para a marca certa nas duas bases.
  2. Sem marca: comparar o **nome normalizado** (sem maiúsculas, acentos, "_molde", "_MR", "marca registro"). Assim "PIRAMIDE" = "PIRÂMIDE".
  3. Se ainda assim não bater, **"Mesma caixa que…"** na prancheta, para a usuária ligar "CUBO" a "CUBO COM ALÇA" uma vez e o MAE lembrar.
  4. **Renomear as caixas da base.** Hoje não dá para editar o nome dos moldes (MILK, CUBO COM ALÇA, MALETA COM ALÇA… na lista "Moldes") nem das pranchetas, que aparecem só como "297 × 210 mm · paisagem". Clicar duas vezes no nome (ou ✏️) para renomear, na base comum e na base do tema pronto. O nome novo vale para os temas e pedidos que usam a base.
  - **Teste de aceite:** o mesmo lote → 6 grupos seguidos (MILK, CUBO, MALETA ALÇA, MALETA CORAÇÃO, TRIANGULOVE, PIRÂMIDE), cada um com Transformers e Moana intercalados.
- Com o item 194 (tema pronto na base existente), as bases passam a ser a mesma, mas agrupar pela marca de registro continua sendo o certo para bases diferentes.

### 201. Gerar: uma tela só, com opções claras (substitui a barra de opções + o modal do lote)
- **Problema (palavras da Naty):** "essa parte de gerar impressão em lote tá confusa".
  - O seletor **"1 PDF por pedido e produto" × "1 PDF por folha"** não diz o que faz.
  - No modal do lote, **"Por pedido" × "Por modelo"** parecem ser "separar por cliente" × "juntar", mas na verdade são só a **ordem das páginas** dentro do mesmo PDF. Escolhendo "Por pedido", o arquivo continua se chamando LOTE.
  - **"Separar por papel (kit × tag)"** parece separar os pedidos, o que seria redundante com o de cima.
  - Opções repetidas: "Iniciar a etapa Impressão" aparece na barra **e** no modal; há dois botões (**Gerar selecionados** e **Gerar em lote**) para quase a mesma coisa.
- **Esperado:** **um botão só, "Gerar (N)"**, que abre esta tela. A barra de opções em cima da lista sai (regra de ouro: cada opção em um lugar só). A tela lembra a última escolha.

```
┌─ Gerar 80 pedidos ─────────────────────────────────────────────────┐
│ ARQUIVOS                                                           │
│ (•) Um PDF por pedido                                              │
│     Cada cliente no seu arquivo: Liz-Gabriele_1ano_Moana-Baby_84un │
│     Pasta: Exportações / hoje / Pedidos                            │
│ ( ) Juntar os pedidos para imprimir de uma vez (lote)              │
│     Vários pedidos no mesmo PDF: LOTE_14-10_11h_80pedidos_…        │
│     Pasta: Exportações / hoje / LOTES                              │
│     [x] Um PDF por tipo de produto                                 │
│         Pegue e Monte num PDF, Tags noutro, Etiquetas noutro…      │
│     Até [10] pedidos por PDF                                       │
│                                                                    │
│ ORDEM DAS PÁGINAS (no lote)                                        │
│ (•) A mesma caixa junta: todas as MILK, depois todos os CUBOS…     │
│     (para cortar em sequência, sem trocar o arquivo de corte)      │
│     [x] Intercalar temas (dois do mesmo tema não ficam colados)    │
│ ( ) O kit de cada cliente junto                                    │
│                                                                    │
│ NA FOLHA                                                           │
│ [x] Nome do pedido na margem ("#123 · Naty"), fora do corte        │
│ [x] Fundo branco atrás das marcas de registro · folga [1] mm       │
│ [ ] Linhas de corte                                                │
│ [x] Folhas de aplique                                              │
│ [ ] Aproveitar folhas: completar folhas incompletas com outros     │
│     pedidos (tags, etiquetas)                                      │
│                                                                    │
│ DEPOIS DE GERAR                                                    │
│ [x] Passar os pedidos para a etapa Impressão no SOA                │
│                                                                    │
│ ▸ Avançado: quantidade (na do pedido / 1 de cada, para prova),     │
│   cada folha num arquivo separado (para gráfica/RIP),              │
│   arquivo de corte por pedido                                      │
│                                                                    │
│ Vai gerar 3 arquivos:                                              │
│   Pegue e Monte · 62 pedidos · 8 PDFs (até 10 por PDF)             │
│   Tags · 12 pedidos · 2 PDFs                                       │
│   Etiquetas escolares · 6 pedidos · 1 PDF                          │
│                                          [Cancelar]  [Gerar]       │
└────────────────────────────────────────────────────────────────────┘
```

- **Regras:**
  - **"Um PDF por pedido"**: o nome do arquivo é **cliente + idade + tema + quantidade**, nunca "LOTE". "LOTE" só existe quando há **mais de um pedido no mesmo PDF**.
  - **"Um PDF por tipo de produto"** substitui o "Separar por papel (kit × tag)". Separa por **produto** (Pegue e Monte, Tags, Etiquetas escolares…), nunca por pedido nem por tema. Desligado, tudo que couber no mesmo tamanho de folha vai num PDF só.
  - **A ordem das páginas** só aparece quando é lote (com 1 pedido por PDF não faz diferença).
  - **"A mesma caixa junta"** agrupa pela marca de registro da prancheta (item 200).
  - **O resumo** "Vai gerar N arquivos" atualiza na hora, antes de clicar, para não haver surpresa.
  - O antigo "1 PDF por folha" vai para **Avançado**, com o nome "Cada folha num arquivo separado (para gráfica/RIP)". Se ninguém usa, pode sair.
- **Teste de aceite:** com Guilherme (tag), Liz Gabriele (Moana) e José Sérgio (Transformers) selecionados:
  - **Um PDF por pedido** → 3 arquivos com o nome de cada cliente, na pasta Pedidos.
  - **Lote + por tipo de produto** → 2 arquivos: `LOTE_…_pegue-e-monte_2pedidos_…` (Moana + Transformers, mesma caixa junta) e `LOTE_…_tags_1pedido_4pag`.
  - **Lote sem separar** → os de mesmo tamanho de folha num arquivo só.

---

## P2

### 194. Tema pronto numa base existente
- Hoje o "Criar tema pronto" **cria uma base nova para cada tema** (cada página do PDF vira uma prancheta). Os 21 temas prontos subidos até agora ganharam 21 bases quase iguais, e cada uma precisa ter as caixas ligadas aos produtos do SOA de novo.
- **Esperado:**
  - Ao criar tema pronto, escolher a base (ex.: "kit caixas e sacolas"). Cada página do PDF entra na **prancheta de mesmo nome** (MILK → MILK, CUBO → CUBO, SACOLA P → SACOLA P), inteira, como imagem. Não é preciso preencher face nenhuma.
  - Página sem prancheta correspondente, ou prancheta sem página: **aviso**, nunca encaixe errado.
  - Página com tamanho diferente da prancheta: aviso antes de criar.
  - Opção por tema: **"Este PDF já tem marca de registro"**, para o MAE não colocar a dele só nesse tema (casos Candy Colors, Marinheiro e Stitch, cuja MR impressa já foi testada).
  - O tema herda da base a ligação com os produtos e as quantidades do SOA.
  - **Migração:** juntar os temas prontos que já têm base própria na base única, sem a Naty refazer.
