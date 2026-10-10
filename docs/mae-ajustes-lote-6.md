# Módulo MAE — Ajustes do teste (Lote 6)

Testado pela Naty em 10/10/2026, depois da entrega do Lote 5. Este lote traz:
- **Parte A:** resultado do reteste do Lote 5 (incluindo o teste da tag com folha montada e pedidos juntos).
- **Parte B:** itens novos (80 a 115), em sequência ao Lote 5 (que foi até o 79).
- **Anexo:** catálogo inicial de medidas prontas (a validar pela Naty).

**Prioridade comercial:** a **volta às aulas** está perto. Etiquetas, rótulos e tags (bloco "Peças por medida", itens 90 a 96) entram logo depois dos erros que travam o uso (P1).

Prints citados estão com a Naty.

## Parte A — Reteste do Lote 5

| Status | Itens |
| --- | --- |
| ✅ Funcionando | 53, 58, 70, 75, 78, 79 |
| ✅ Funcionando, com acréscimos | 72 (item 96), 74 faixa (logo: item 103), 76 folha montada e "Aproveitar folhas" (item 95) |
| ⚠️ Parcial | 59 (itens 80, 85, 97 a 100), 65 (item 84), 66 (item 104), 67 (itens 81, 86, 105), 73 (item 102), 77 frase (itens 82, 88) |
| ❌ Não funciona | 71 (item 83) |
| ⏸️ Ainda não testado | 68 com arte nova, impressão de teste, 77 campos extras, 62, 57, 64, 63, 69, 61, 54, 55, folhas de aplique saindo junto na edição em massa, geração de 5 a 10 pedidos de uma vez |

### O que deu certo
- **78 – Lista de pedidos:** ótima (miniatura, selo de status, nome/idade editáveis, quantidade, Ver / Ajustar / Gerar de novo, abas Pendentes / Já gerados).
- **79 – Quantidades:** "36 de 36 ✓", 6 de cada caixa, observação ao lado. **PDF de 36 páginas com 7 MB** (o do Photoshop fica com quase 200 MB), rápido e nítido no zoom de 400%. Manter essa técnica.
- **58:** nome em todas as caixas, em todos os PDFs.
- **72 – Grupos:** criar, ligar ao produto do SOA e "Usar também" funcionaram.
- **74 – Faixa da hashtag:** perfeita.
- **75 – Trocar letra:** ok.
- **76 – Folha montada:** "Nova folha", "Preencher folha", aproveitamento ("19 peças · 66%"), "+ na mista", "Avulso (preenche e continua)", "Completar a última folha com cópias" e ligação com o grupo funcionaram.
- **Teste A (pedido maior que a folha):** pedido de 10 tags saiu numa folha montada, com nome certo.
- **Teste B ("Aproveitar folhas"):** Bento (15) + Ana (20) = 35 tags em **19 + 16**, num **PDF de lote**, **agrupadas sem misturar**, com "#teste2 · Bento" e "#teste1 · Ana" marcando cada grupo.
- **Apliques (painel da esquerda):** "2 personalizados", "Aplicar também nos personalizados?" e a folha de impressos com o nome da caixa em cima de cada aplique.
- **73:** "Na mesma linha" e o estilo próprio da idade no bloco Nome + idade.
- **Moldurinha** na tag redonda: ótima (falta só a ordem das camadas, item 81).

---

## Parte B — Itens novos

## P1 — Erros que travam o uso

### 81. Seleção e painel Camadas (prioridade máxima: destrava metade do editor)
- **O que acontece:**
  - Clicar em **texto (NOME, NOME + IDADE), aplique, forma ou moldurinha** não seleciona o objeto; quem fica selecionado é o **papel da parte que está embaixo** (o painel da direita mostra Preencher / Repetir / Cenário contínuo). Nada disso pode ser movido com o mouse.
  - O painel **Camadas** mostra **só uma camada por parte** (ex.: na tag, só "ChatGPT Image… 3D FACE"). Faltam papel, moldurinha, textos, formas e elementos. Exatamente o que não aparece ali é o que não se consegue mover.
  - A **moldurinha ficou na frente do ursinho** e não há como mudar a ordem.
- **Esperado:**
  - O clique seleciona **o objeto de cima**: textos e apliques, depois elementos e formas, depois papel. **Alt + clique** alterna para as camadas de baixo (como no Photoshop).
  - **Camadas** lista **todas** as camadas da caixa/parte (papel, elementos, apliques, formas, moldurinha, textos), cada uma clicável, com olho (ocultar) e cadeado.
  - **Ordem das camadas:** arrastar na lista e, no clique direito, **"Trazer para frente / Enviar para trás"** (e "Trazer para o topo / Enviar para o fundo").

### 80. Ajuste do pedido não é salvo
**Passo a passo:**
1. Edição em massa → **Ajustar** no pedido #123.
2. Mudar tamanho e posição do nome numa caixa.
3. Clicar em **Salvar** (painel da direita).
4. Voltar à edição em massa e abrir o **Ver** do pedido.
5. A prévia aparece **sem o ajuste**.

**Provável causa:** o "Salvar" da direita é o do **tema**; o ajuste do pedido não é gravado.
**Esperado:** o ajuste fica salvo **no pedido** e aparece no Ver, no Gerar e ao abrir o Ajustar de novo, com o ícone "ajustado" na linha. Ver item 100 (Salvar e voltar).

### 88. Tema escolhido na linha do pedido não fica salvo
- **O que acontece:**
  - Escolher o tema num pedido e depois em outro **desfaz a escolha do primeiro**, e vice-versa (com "Só com este TEMA" e também escolhendo direto no seletor).
  - O pedido **guardou o campo FRASE ("A Pequena") do tema anterior** (sereia), e enquanto ele estava lá o tema novo não "pegava". A Naty não colocou essa frase no pedido; só depois de apagá-la o tema novo funcionou.
- **Esperado:**
  - Cada pedido guarda o seu tema, independente dos outros.
  - **Trocar o tema recalcula os campos do pedido**: campos que não existem no tema novo somem (ou ficam guardados sem efeito), e nada do tema anterior impede a troca.
  - O botão **"Só com este TEMA"** passa a se chamar **"Só neste pedido"**.

### 82. Frase do nome perde a fonte e os efeitos ao mexer em qualquer ajuste
- **O que acontece:** na frase ("A Pequena"), mexer em **qualquer** ajuste (entrelinha, tamanho…) ou **trocar o papel** troca a fonte pela padrão (Sniglet) e **apaga todos os efeitos**.
- **Esperado:** cada ajuste muda **só aquela propriedade**. Verificar também NOME, IDADE, HASHTAG, SUFIXO e o bloco Nome + idade.

### 83. Papel sobre parte com cor sólida (item 71 reaberto)
- **O que acontece:** o papel arrastado para uma parte com cor sólida continua escondido, e depois de pintar com cor **não há como voltar para o papel**.
- **Esperado:** arrastar um papel para uma parte com cor sólida **troca a cor pelo papel**. No cartão da parte, **"Remover cor"** (lixeirinha), voltando ao que era antes.

### 87. Transição de papéis não funciona
- **O que acontece:** na tag, a Naty escolheu a parte e clicou no 2º papel em "Transição de papéis" (painel da esquerda e da direita). Nada acontece na arte.
- **Esperado:** o 2º papel entra por cima do atual, com a máscara em degradê na direção, posição e suavidade escolhidas, com prévia na hora.

### 89. Importação de SVG no tamanho errado e furo não detectado
- **Tamanho:** um círculo de **4,000 × 4,000 cm** feito no **Silhouette Studio Business Edition** (traçado 0 pt) entrou como **46,5 × 46,5 mm** (16% maior). O MAE deve ler a unidade gravada no SVG (cm, mm, pt, polegada, px) e o `viewBox`. A Naty tem o arquivo para teste.
- **Conferência:** antes de confirmar a importação, mostrar a **medida da peça** detectada ("círculo 40 × 40 mm"), não só o tamanho da página do arquivo.
- **Furo:** a tag tem um **furinho** para a fita (círculo pequeno no alto) e o MAE mostrou **"0 furos"**. O furo deve ser reconhecido: área sem arte, cortada junto.

### 84. Fecho superior (item 65): face que não existe e drop no cartão
- No topo da milk existe um **retângulo branco sem face** (a área não fecha, provável falha na linha). Ao clicar numa área branca que não é face, mostrar **por quê** ("linha aberta aqui", com destaque) e oferecer **"Criar face aqui"**, fechando a falha.
- **Ainda aberto:** arrastar papel no **cartão** da parte FECHO SUPERIOR não preenche as 9 faces existentes.

### 85. Ctrl+Z não desfaz giro e tamanho "nesta caixa" no Ajustar
- Mexer em **Girar nesta caixa** e **Tamanho nesta caixa** (controles da direita) não entra no histórico.
- Cada ajuste num controle deslizante vira **um passo** do Ctrl+Z, registrado ao soltar o mouse. Ajustar e tema usam o mesmo histórico das setinhas.

### 86. Nome não sai impresso em cima do aplique
- O NOME colocado sobre o aplique (ursinho) não aparece na folha de impressos dos apliques. Textos sobre o aplique devem sair **impressos no aplique**.

---

## Peças por medida (prioridade comercial — volta às aulas)

Exemplos da Naty: etiquetas escolares (9×5 livros, 7×3 caderno, 5×2,6 lápis), tags redondas 4×4 de cofrinho, rótulos (tubete, caixa acrílica, sacolinha, Pringles, Nutella), e até peças de costura (bolsinhas) e encadernação. Nada disso tem "molde" de caixa: são peças planas definidas por medida.

### 90. Dois tipos de base: "Caixas e moldes" e "Peças por medida"
Ao clicar em **Nova base**, escolher:
- **Caixas e moldes** — fluxo atual (importar molde, detectar faces, partes).
- **Peças por medida** — sem molde e sem detecção de faces:
  - **Catálogo de medidas prontas**, por categoria (ver Anexo). A usuária marca as que vende e todas entram na base de uma vez.
  - Cada medida continua **editável** (largura, altura, formato), porque cada uma trabalha com uma medida um pouco diferente.
  - **"+ Medida personalizada"**: nome, largura, altura e formato (**retângulo**, **cantos arredondados** com raio, **círculo/oval**), opcionalmente com **furo** (posição e diâmetro). Atende costura, encadernação e o que surgir.
  - Cada peça já nasce com contorno de corte e 1 face, pronta para receber estrutura, papel e textos.
  - Duplicar uma peça com outra medida em um clique.

### 91. Estruturas prontas (o "esqueleto" da arte), editáveis
O padrão de montagem das etiquetas da Naty vira **modelos prontos de divisão da peça**. Cada pedaço da divisão é uma **parte** (como as faces das caixas), que recebe papel no Tema.
- **Estruturas prontas (iniciais):**
  - **Fundo inteiro** (um papel).
  - **Fundo + base + faixa** (papel no fundo, outro papel embaixo, faixa dividindo os dois).
  - **Lateral esquerda + lateral direita com transição suave**.
- **Tudo editável, mesmo partindo de uma pronta:**
  - as **divisórias aparecem na peça como linhas arrastáveis** (subir a base, engrossar a faixa, inclinar);
  - **tirar ou acrescentar** pedaços ("só fundo + faixa", "+ lateral");
  - entre dois pedaços, **corte reto** ou **transição suave** (com o tamanho da transição).
- **Faixa:** **papel**, **cor sólida**, **glitter** ou **elemento** (renda, fita, onda, washi tape).
  - Elemento na faixa **acompanha a divisória** e **se repete ao longo da faixa** (como azulejo) em vez de esticar; opção "esticar só na largura até X%". Pode ficar **por cima da emenda** dos dois papéis, escondendo o corte.
  - **Contorno (traçado) e efeitos opcionais** (a Naty não usa, mas outras alunas sim).
- **Criar do zero** e **"Salvar como minha estrutura"** (com nome), para reaproveitar em outras bases.
- A **mesma estrutura vale para todas as medidas da base**, proporcional (base do item 92). Pode trazer a **área do nome** já marcada.

### 92. "Adaptar para as outras medidas" (arte recomposta, não esticada)
A arte das etiquetas é **recomposta** entre medidas (personagem à esquerda, logo no canto, nome à direita), não esticada.
- A usuária monta a arte completa na **maior medida** (ex.: 9×5).
- **"Adaptar para as outras medidas"**: cada camada guarda **onde está presa** (canto, lateral, centro; escolhido pela usuária ou detectado) e **o tamanho proporcional à altura** da peça. O sistema monta as outras medidas (7×3, 5×2,6).
- **Retoques "só nesta medida"** (mesma lógica do "Só nesta caixa"): mover, redimensionar, **girar o nome 90°** (como na etiqueta de lápis), ocultar um personagem. Salvos no tema: feitos uma vez, valem para todos os pedidos.
- Papel por parte/estrutura: arrastou uma vez, vai para todas as medidas, sem esticar.
- Textos com **caixa de auto-ajuste** por medida.

### 93. Campos das etiquetas: nome completo dividido, série e turno
- **NOME COMPLETO dividido sozinho:** a mãe manda "Laura Marques" / "Benício Dettoni de Azevedo" e o sistema divide em **NOME** (primeira palavra, grande) e **SOBRENOME** (o resto, menor), cada um com estilo e posição próprios.
  - **Nome composto** ("João Arthur", "Ana Júlia"): na lista de pedidos dá para **mudar o ponto da divisão** ou marcar "sem sobrenome".
  - Sobrenome vazio some e o nome se recentraliza (item 77).
- **SÉRIE** ("2º ANO") como campo extra, com a **faixa** do item 74 atrás.
- **TURNO** ("VESP", "MAT") como campo extra.
- Todos viram colunas editáveis na lista de pedidos (item 78).

### 94. Composição por unidade dentro do grupo
**Regra:** grupo = o que se vende. Um produto pode ser **várias peças**.
- **Rótulo Nutella** = 1 frente (retângulo) + 1 tampa (círculo). Pedido de 20 → 20 frentes + 20 tampas, encaixadas na folha (mista). Nunca sai uma frente sem a sua tampa. Vale para Pringles (corpo + tampa), potinho de vidro (pote + tampa), papinha (corpo + tampa).
- **Kit escolar** = 1 de cada etiqueta (ou N de cada), **1 kit = 1 folha** (decisão do Lote 5, item 76).
- **Quantidade por peça dentro da unidade:** ex.: encadernação = 1 capa + 1 contracapa + **2 guardas**; cada peça com a sua medida.
- **Capa aberta (encadernação):** capa + lombada + contracapa numa peça só, com a arte atravessando (cenário contínuo, item 66). A **lombada** tem largura própria (muda com a grossura do caderno).
- **Ordem no PDF** segue a ordem da composição (arrastável).
- **Peça avulsa:** se a peça também é vendida sozinha (ex.: só a tampa, só a etiqueta de lápis), outro grupo com "Usar também" (mesma peça, mesma arte).
- A quantidade vem do **pedido**; a folha se monta a partir dela (item 95).

### 95. Folha de impressão com gabarito fixo (marca de registro)
**Descoberta do teste:** com **marca de registro**, a plotter (Silhouette) corta usando um **arquivo de corte fixo**, sempre o mesmo. As peças na folha impressa precisam estar **sempre nas mesmas posições**. Hoje o MAE reorganiza as peças a cada pedido, o que quebra o corte. Exemplo real da Naty: **tag 4×4, A4 paisagem, 6 × 4 = 24 por folha**, posições que nunca mudam.

- **A folha é um gabarito com posições (vagas) fixas**, criado uma vez na Base. Depois de salvo, **as posições não mudam**.
- **"Preencher folha" automático continua**, mas **só para criar o gabarito**. Depois ele fica congelado. Ao criar:
  - escolher **retrato ou paisagem** (ou o sistema testa os dois e sugere: "paisagem: 24 · retrato: 22");
  - encaixe **em grade** ou **intercalado** (o que couber mais), espaçamento e margem configuráveis;
  - aproveitar os espaços ao lado das marcas e a sobra do fim da folha.
- **Importar gabarito da plotter:** importar o arquivo de corte do Silhouette (SVG/DXF/PDF exportado pela Business Edition) com as peças e as marcas. O MAE usa **exatamente** essas posições. Assim o arquivo de corte que a Naty já usa continua valendo.
- **Pedido ocupa vagas:** as peças do pedido entram nas vagas, na ordem. Vaga que sobra fica **vazia** (ou completada com cópias, se marcado); nada se mexe.
- **"Aproveitar folhas"** também só ocupa vagas: pedido 1 nas vagas 1–15, pedido 2 da 16 em diante. Identificação "#nº · Nome" continua (funcionou no teste), sempre **fora das áreas de corte e de sangria**.
- **Arquivo de corte:** gerado **uma vez, com o gabarito** (é sempre o mesmo), e não a cada pedido. Hoje sai um .dxf + um .svg por folha (`…Folha 1 1-linhas.dxf`), com nome estranho ("Folha 1 1"). Opcional: continuar gerando por pedido para quem corta sem marca.
- **Sobra (arte inteligente) nas peças pequenas:** no teste, a sobra padrão das caixas (**10 mm**) com **3 mm** de espaço fez a sangria de cada tag **invadir a vizinha** e as **marcas de registro** (o próprio sistema avisou: "entra na área da marca de registro"). Regras:
  - a sangria de cada peça **nunca passa da metade do espaço** até a vizinha (cortar no meio do caminho);
  - **peças por medida começam com sobra pequena** (1,5–2 mm);
  - o gabarito é calculado **com a sobra incluída**: nada sai da folha nem entra nas marcas.
- **Resumo de separação:** **não gerar** como arquivo nem como página (ninguém vai gastar folha com isso; o "#nº · Nome" na folha já resolve). No máximo, mostrar na tela, na aba "Já gerados".
- **Meta de teste:** tag 4×4 (medida correta, item 89) → **24 por A4 paisagem**, batendo com o gabarito da Naty.

### 96. Grupos: renomear e digitar o nome do produto
- Grupo criado não pode ser **renomeado**: permitir.
- Hoje o grupo só se liga a um produto do SOA. O MAE também será **vendido avulso**, sem SOA: manter a lista do SOA e acrescentar **"Digitar um nome"**.

---

## P2 — Fluxo da edição em massa e do Ajustar

### 97. Tema do pedido: ligação pelo nome do tema do SOA (não pelo produto)
- **Ajustar abre com o tema escolhido na linha.** Hoje aparece "O tema 'Ariel' do pedido não existe — escolha o tema", mesmo com o tema escolhido.
- **"Sim, para todos" hoje liga o tema ao produto inteiro** (todo Cofrinho Simples com a mesma arte). Isso está errado: um produto tem vários temas.
- **Esperado:** cada pedido chega do SOA com o tema que a cliente escolheu ("Ariel", "Ursinha Princesa"). Na primeira vez, a usuária escolhe o tema MAE correspondente e o sistema pergunta **"Usar para todos os pedidos com o tema Ursinha Princesa?"**. A ligação **nome do tema no SOA → tema MAE** fica salva; os próximos pedidos com esse tema já chegam certos.
- **Seletor de tema:** mostrar **nome + base** ("Tag Ursinha · base tag teste") e **só os temas que servem para o produto** do pedido (um cofrinho não oferece o tema das caixas do kit).
- **Miniatura** de produto com folha montada: legenda "1 tag · 10 un. · 1 folha".

### 98. Um controle de tamanho só, obedecendo o modo
- Hoje há **"Tamanho do nome"** na barra de cima (vale para o pedido inteiro: aumentou na milk, a cubo cresceu junto) e **"Tamanho nesta caixa"** na direita. Com "Todas as caixas da parte", o painel da direita some.
- **Fica só o controle da direita**, obedecendo o modo ("Só nesta caixa" / "Todas as caixas da parte", painel sempre visível). A barra de cima fica só com os dados do pedido.

### 99. Modo Ajustar limpo
- No Ajustar, o painel da esquerda vira **"Textos deste pedido"** (NOME, IDADE, HASHTAG, SUFIXO, frase, campos extras, cada um com a lista das caixas). Some Papéis, Elementos, Cor, Abas e Partes (o tema está travado).
- "Salvar" da direita vira **"Salvar ajuste do pedido"**.

### 100. Voltar do Ajustar para a lista
- **"← Voltar aos pedidos"** e **"Salvar e voltar"** (volta na linha desse pedido, destacada, com ícone "ajustado").
- **"Salvar e gerar"**: salva, gera e volta com o pedido em "Já gerados".
- Sair sem salvar pergunta: "Salvar o ajuste do pedido #123 antes de voltar?" (Salvar · Não salvar · Cancelar).

### 101. Selo de status na lista
- "aprovado" vem do status do pedido no SOA e alimenta o "Selecionar aprovados". Outros status com selo próprio (ex.: "aguardando aprovação"), fora dessa seleção. Conferir com a Naty os nomes exatos.

---

## P3 — Editor e acabamento

### 102. Entrelinha e espaços sem mínimo distante (item 73)
- No nome composto, no bloco Nome + idade e no espaço entre **frase e nome** (parou em −50%), o mínimo deixa as linhas distantes. Os controles devem descer até **encostar e sobrepor**.
- Ao trocar o arranjo do Nome + idade, os controles de **tamanho da idade (% do nome)** e **espaço entre linhas** não podem sumir.

### 103. Logo atrás do nome (item 74)
- A logo entra **gigante** e ocupa a caixa; o nome fica minúsculo. Deve entrar **do tamanho do nome que já estava ali**, com o nome encaixado.
- A área do nome é marcada com um **retângulo pontilhado sobre a logo**, arrastável com o mouse. Números (Esquerda, Topo, Largura, Altura) num "Avançado" recolhido.

### 104. Cenário contínuo como uma peça só (item 66)
- Mexer na escala muda só uma parte. O cenário deve ser **uma camada só**, com um controle de escala, posição e giro.
- Na lista "juntar com…", nomes distintos ("FUNDO 1", "FUNDO 2"), com a face acendendo na arte ao passar o mouse.

### 105. Painel da direita com aplique selecionado
- Bordinha e silhueta **só no painel Apliques 3D (esquerda)**. Com aplique selecionado, a direita mostra só posição, tamanho, giro e ordem.

### 106. Prévia da folha de aplique só no tema
- A prévia "Folhas de aplique" continua aberta na Base e até numa base nova. Deve fechar ao sair do tema e **nunca aparecer na Base**.

### 107. Base atualizada girou a prancheta? (verificar)
- No tema apareceu "A base mudou (v3 → v4)", a prancheta ficou em retrato e a CUBO COM ALÇA ficou fora da folha. Verificar se a atualização da base girou a prancheta sozinha (se sim, é erro).
- No aviso, botão **"Corrigir na Base"**. Girar prancheta continua só na Base, de propósito.

### 108. Aviso "revise" com o motivo
- Ao passar o mouse: o motivo ("nome passou da área", "em cima da dobra", "não coube nem com 70%"…) e, se possível, um botão para corrigir.

### 109. Caixinha "Organizar…" por cima da arte
- A caixinha "Organizar… / As pranchetas vêm da base…" cobre a arte em todas as telas do Tema. Abrir só ao clicar, ou ficar na barra da prancheta.

### 110. Presets de efeito proporcionais ao tamanho do texto
- Aplicar um preset num nome pequeno (tag 4 cm) deixou o resultado grosseiro: os efeitos estão em **mm fixos** (traçado 1,6 mm).
- Efeitos do preset **acompanham o tamanho do texto** (proporcionais, como "Escalar efeitos" do Photoshop), com um controle **"Escala dos efeitos (%)"** para ajuste fino.

### 111. "Tracking" não funciona e termos técnicos
- Mudar o Tracking (ex.: 55, fonte Albertho) não altera nada. Corrigir.
- Renomear para **"Espaçamento entre letras"**. Revisar outros termos técnicos (ex.: "Linha de base" → "Subir/descer texto").

### 112. Formas completas
- A forma (elipse, retângulo, coração…) é criada, mas não dá para clicar, redimensionar nem colocar papel (parte do item 81).
- A forma deve ter: alças, **preenchimento com cor ou papel** (máscara de corte), **traçado**, **opacidade**, **modo de mesclagem** (multiplicar, sobrepor, tela…) e estilos de camada, como qualquer camada.

### 113. Unidades: mm, cm ou px
- Configuração (engrenagem) com **mm · cm · px**, valendo para régua, painéis e campos. Fica lembrada.
- **px** sempre com a resolução ("px a 300 dpi").
- Em qualquer campo, aceitar valor com unidade ("9cm" num campo em mm vira 90 mm).

### 114. Prancheta redimensionada e importação na prancheta errada
- Ao mudar o tamanho da prancheta, o molde ficou **fora** dela. Manter os moldes dentro (centralizar/reposicionar) e avisar se algum não couber.
- Com a prancheta 2 selecionada, o molde importado foi para a **prancheta 1**. A importação deve ir para a **prancheta selecionada**.

### 115. Renomear tema e "Salvar como…"
- Não há como renomear um tema. Permitir **renomear** e **"Salvar como…"** (cópia com outro nome).

---

## Anexo — Catálogo inicial de medidas prontas (item 90)

**Atenção:** as medidas variam entre fontes e marcas (ex.: Bis 7 × 5,5 em um site, 6,5 × 5,5 em outro). **A Naty valida a lista antes de publicar.** Medidas marcadas com ✔ Naty já foram confirmadas por ela. Medidas em cm (largura × altura; Ø = diâmetro).

| Categoria | Peça | Medida |
| --- | --- | --- |
| Etiqueta escolar | Livros | 9 × 5 |
| Etiqueta escolar | Caderno | 7 × 3 |
| Etiqueta escolar | Lápis | 5 × 2,6 |
| Tag | Tag redonda (cofrinho) | Ø 4 (com furo) |
| Tag | Tag de agradecimento | 4,5 × 3,5 |
| Tubete | 8 cm | 3 × 5 |
| Tubete | 13 cm médio | 4 × 6 |
| Tubete | 13 cm grande | 5 × 8 |
| Caixinha acrílica | Quadrada | 3,5 × 3,5 |
| Caixinha acrílica | Tampa | 5 × 5 |
| Caixinha acrílica | Lateral | 5 × 4 |
| Caixinha acrílica | Sextavada | 6 × 3 |
| Sacolinha | Sacolinha / kraft | 9 × 9 |
| Mini Pringles | Corpo | 22 × 7,8 ✔ Naty |
| Mini Pringles | Frente | 10 × 8 |
| Mini Pringles | Tampa | 7 × 7 (Ø 7) ✔ Naty |
| Nutella | Corpo | 20 × 3,5 ✔ Naty |
| Nutella | Tampa | 5,7 × 5,7 (Ø 5,7) ✔ Naty |
| Toddynho | Frente | 6,3 × 8,3 |
| Toddynho | Volta toda | 21,9 × 8,3 |
| Água mineral 500 ml | Corpo | 20 × 3,5 |
| Água mineral | Tampa | Ø 2,8 |
| Chocolates | Bis | 6,5 × 5,5 |
| Chocolates | Bis duplo | 10 × 5,5 |
| Chocolates | Batom | 6,5 × 6,5 |
| Chocolates | Pastilha Garoto | 7,5 × 6 |
| Chocolates | Mini Mentos | 4,5 × 6,5 |
| Chocolates | Tic Tac | 3 × 8,5 |
| Pirulito | Rótulo | Ø 5 |
| Pirulito | Capa | 8 × 16 |
| Copinho de brigadeiro | Frente | 3 × 3 |
| Copinho de brigadeiro | Tampa | Ø 2,5 |
| Marmitinha | 250 g | 12 × 9 |
| Marmitinha | 500 g | 16 × 12 |
| Marmitinha | Redonda | Ø 11 |
| Lata Mint to Be | Tampa | Ø 5 |
| Paçoquinha | Rótulo | 9,5 × 4,7 |
| Mini Trakinas | Rótulo | 9 × 9 |
| Toppers | Docinho | Ø 5 |
| Toppers | Colherzinha | Ø 3,5 |
| Avulsos | Redondo | Ø 2,5 a 20 (livre) |
| Avulsos | Quadrado/retângulo | 2 × 2 a 20 × 20 (livre) |

Fontes de referência: Cally's Design (tabela de medidas), Help Festas (medidas para impressão), Inspire sua Festa (tamanhos dos rótulos).
