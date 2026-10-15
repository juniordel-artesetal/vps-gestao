# Módulo MAE — Lote 19: lote mudando a arte da Nutella, dois nomes no mesmo pedido, tipo de produto no lote e corte com faca

Encontrados pela Naty em 15/10/2026 (manhã e tarde), na produção real, depois do Lote 18 publicado. Itens 231 a 245, em sequência ao Lote 18 (que foi até o 230).

⚠️ **URGENTE (lançamento 16/10, 20h):** o 231 trava a produção de rótulo Nutella em lote hoje.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-19.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-19.md, docs/mae-ajustes-lote-18.md,
docs/mae-ajustes-lote-15.md, docs/mae-spec.md e docs/mae-progresso.md.
Em modo plano, organize nesta ordem:
P0) 231 (geração em LOTE muda a arte do corpo da Nutella; sozinho sai
    certo) — está gerando pedido errado HOJE;
P1) 232 (janela "Limpar textos repetidos"), 233 (versões da base e
    textos repetidos: causa e telas), 234 (ajuste fino da marca de
    registro: acesso e unidade), 235 ("Um PDF por tipo de produto"
    separa pelo título do anúncio em vez da base), 237 (dois nomes no
    mesmo pedido: gêmeos/irmãos), 238 (pedido impresso "com aviso"
    continua em Pendentes), 239 (aviso de fonte reduzida sem dizer a
    caixa), 240 (tema pronto: ligar página à caixa por seletor),
    241 (espaço entre nome e idade cresce com a altura da área),
    242 (versão sem nome não aparece na busca), 243 (aviso de texto
    repetido em nome repetido de propósito), 244 (aviso de conflitos
    depois da limpeza), 245 (pedido com tema sem nome fica fora do lote);
P2) 236 (ajuste fino da arte para corte com faca, corte e vinco manual).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Publique o 231 assim que estiver
pronto (antes do resto), confira na URL de produção e registre em
docs/mae-progresso.md o que foi feito e publicado, item por item.
```

---

## Parte A — Reteste do Lote 15 e do Lote 18

| Status | Item |
| --- | --- |
| ✅ | **202** (Lote 15) Corte na máquina automática: ajuste fino salvo nas 6 marcas pelo "Medir num PDF que corta certo" (PDF da Helena): pirâmide, triangulove, maleta coração e cubo +3,1 mm; maleta alça +1,65 mm; milk +0,45 mm. Caixa Minecraft cortada antes × depois: **agora corta em cima da linha**. Falta só confirmar maleta alça e milk na máquina. |
| ✅ | **215** Nome duplicado na Nutella: a base ficou com 1 "Nome + idade" e o Ju tirou o 2º nome dos temas (depois que a Naty marcou "todos" na janela do "Limpar textos repetidos", que fez o contrário: ver 232). A Naty vai conferir gerando pedidos. |
| ✅ | **216** Salvar uma vez grava. |
| ✅ | **217** Lote com temas diferentes: cada pedido com a sua arte. O "Aproveitar folhas" juntou tampas da Antonella (Moana) e do Antonny (Pooh) na mesma folha, com a identificação de cada pedido na margem. Mas ver o 231. |
| ⏳ | 218 a 230: ainda não testados. |

---

## P0

### 231. Geração em LOTE muda a arte do corpo da Nutella (sozinho sai certo)
- **Teste:** lote com **#2610082RMUD8U2 Antonella, 2 anos** (tema **NUTELLA_MOANA BABY_MOD 1**) + **#2610070XQP19XQ Antonny, 1 ano** (tema Pooh).
- **No PDF do lote, o corpo da Antonella sai diferente do tema:**
  - a **arte pronta ampliada e cortada** (Moana maior, flores cortadas em cima);
  - a **idade em outra fonte** (sem o estilo do tema).
- A **tampa** sai certa, e o "Aproveitar folhas" também.
- **Gerando a Antonella sozinha, sai certo.**
- No tema aparece: *"A base mudou (v9 → v10): confira as faces e as pranchetas"* e *"Este tema está ligado à v9 da base; a base está na v10"*. Suspeita: o lote usa outra versão da base, ou outro encaixe da arte pronta e dos estilos, diferente do gerar individual.
- **Esperado:** a geração em lote sai **idêntica** à individual (mesmo encaixe da arte pronta, mesmas fontes e estilos, mesma versão do tema). O ideal é que as duas usem **o mesmo código de montagem da página**.
- **Teste de aceite:** gerar a Antonella sozinha e em lote (com o Antonny) e sobrepor os PDFs: o corpo e a tampa da Antonella são iguais nos dois.
- **Paliativo da Naty até sair:** "um PDF por pedido".

---

## P1

### 232. Janela "Limpar textos repetidos" lida ao contrário
- A janela dizia: *"O 2º Nome + idade aparece em 45 tema(s). **Marque os que DEVEM ter dois** (ex.: Ursinhos); nos outros ele sai."* A Naty marcou **todos** achando que marcar era limpar, e os 45 temas ficaram com o 2º nome como texto próprio. (Os dados já foram corrigidos pelo Ju; este item é para a janela não induzir ao erro de novo.)
- **Esperado:**
  - Nada de caixinha com sentido ambíguo. Duas colunas claras: **"Tirar o 2º nome"** (todos vêm aqui por padrão) | **"Manter 2 nomes"** (só os que a usuária escolher, ex.: Ursinhos).
  - Botões **"Selecionar todos" / "Nenhum"**.
  - Antes de aplicar, um resumo em português: *"Vou tirar o 2º nome de 44 temas e manter em 1 (Ursinhos). Confirmar?"*.
  - **Desfazer** essa ação ("voltar como estava") por 30 dias.

### 233. Versões da base e textos repetidos: causa e telas
- A base Rótulo Nutella passou da **v5 à v10** num dia só, e os temas mostram avisos diferentes ao mesmo tempo:
  - "A base mudou (v9 → v10): confira as faces e as pranchetas" + **"Corrigir na Base"**;
  - "Este tema está ligado à v9 da base; a base está na v10" + **"Atualizar o tema para a versão atual da base"**;
  - "Atualizar todos os temas desta base" → "0 tema(s) atualizado(s) para a versão 7. Nenhum conflito".
  
  A Naty não sabe qual clicar nem o que cada um muda, e tem medo de estragar o tema.
- **Causa a descobrir:** como a base ficou com **2 "Nome + idade" no corpo**, um em cima do outro. Na etapa **Textos** da base aparecia **só 1**, então não dava para ver nem apagar por lá.
- **Esperado:**
  - Corrigir a causa (não criar texto duplicado ao migrar a base).
  - A etapa Textos da base **mostra todos os textos**, inclusive sobrepostos.
  - Texto repetido idêntico e na mesma posição é **limpo sozinho**, sem depender de botão.
  - **Um aviso só**, claro, sobre versão: o que mudou na base e o que acontece com o tema se atualizar. Juntar ou explicar a diferença entre "Corrigir na Base", "Atualizar o tema" e "Atualizar todos os temas" (regra de ouro: a mesma ação não pode estar em dois lugares).
  - Alinhar com o item 218: se o tema segue a base sozinho, não deveria sobrar "tema ligado à v9".

### 234. Ajuste fino da marca de registro: acesso e unidade
- Na etapa Marca de registro, o **⚠️** ao lado de cada caixa **não é clicável e não explica nada** ao passar o mouse. A Naty só achou o ajuste fino clicando no **nome da marca na lista de baixo**.
- O ajuste aparece em **cm** (unidade do editor), mas marca e corte se medem em **mm**. O "Medir" achou 0,45 mm e o campo mostrou **0,05 cm** (arredondado).
- **Esperado:**
  - O ⚠️ diz o que é (ex.: "marca sem ajuste fino") e **abre o ajuste** ao clicar. Depois de ajustada, troca por ✓ com o valor ("+3,1 mm").
  - O ajuste fino abre também pela **linha da caixa** (PIRÂMIDE, TRIANGULOVE…).
  - Ajuste sempre em **mm**, com 2 casas, independente da unidade do editor.

### 235. "Um PDF por tipo de produto" separa pelo título do anúncio
- **Teste:** lote de **2 pedidos de Pegue e monte**, com temas diferentes. Configuração: "Juntar os pedidos (lote)" + **"Um PDF por tipo de produto"** + "A mesma caixa junta".
- **Resultado:** **2 PDFs separados**:
  - `LOTE_15-10_09h_Lembrancinhas-MOANA-BABY-Perso_1pedido_30pag`;
  - `LOTE_15-10_09h_Lembrancinhas-SONIC-Personaliz_1pedido_12pag`.
  
  O resumo da janela já mostrava: *"Vai gerar 2 arquivos: Pegue e monte · 1 PDF | PEGUE E MONTE Kit Personalizados RAPUNZEL ENROLADOS | Lembrancinhas Festa | Fazemos todos os temas · 1 PDF"*.
- **Causa:** o "tipo de produto" vem do **título do anúncio** no SOA/Shopee. Cada anúncio tem um título diferente (às vezes com o tema no nome), então cada pedido vira um "tipo".
- **Esperado:**
  - O tipo de produto é decidido pela **base/molde que o pedido usa** (as mesmas caixas), nunca pelo título do anúncio nem pelo tema. **Mesma base = mesmo PDF.**
  - Se precisar de exceção, a usuária pode **juntar anúncios num tipo** uma vez só ("estes 5 anúncios são Pegue e monte").
  - No resumo e no nome do arquivo, usar o nome **curto** do tipo (ex.: "Pegue-e-monte"), e não o título inteiro do anúncio.
- **Teste de aceite:** os mesmos 2 pedidos com "Um PDF por tipo de produto" ligado → **1 PDF** (`LOTE_…_Pegue-e-monte_2pedidos_…`), na ordem "a mesma caixa junta". Um lote com pegue e monte + tags → 2 PDFs (um de cada base).

### 237. Dois nomes no mesmo pedido (gêmeos, irmãos)
- **Caso real:** pedido de Pegue e monte, Laço Simples, 24, tema BOSQUE KIT: *"Nome e Idade: **Ayla Maria e Aylin Maria. 1 ano**"* (gêmeas). Há outros casos de mães que querem dois nomes na mesma arte. Hoje o MAE aceita um nome por pedido.
- É diferente do **Dividir pedido** (224): lá são duas artes, uma por criança (até temas diferentes). Aqui é **o mesmo tema e o mesmo kit**, com os dois nomes.
- **Esperado:**
  1. **Detectar e sugerir, nunca aplicar sozinho.** Quando o campo vier com "X e Y", a linha mostra *"Parece ter 2 nomes: **Ayla Maria** | **Aylin Maria**. Usar 2 nomes?"*. Tem que ser só sugestão: no mesmo dia veio *"Maitê e a idade e 2 anos"*, que é **um** nome só (Maitê, 2 anos).
  2. **Dois nomes, cada um com a sua idade** (às vezes muda a idade entre irmãos): Nome 1 + Idade 1, Nome 2 + Idade 2. Para gêmeos, a Idade 2 vem igual à 1 por padrão.
  3. **Modo de montagem**, escolhido na linha do pedido (com padrão salvo no tema/base):
     - **Um nome em cada face** (**padrão**, é o mais comum na produção da Naty): nas caixas com várias faces de nome, as faces alternam Nome 1 / Nome 2, cada um com a sua idade. Em peça de uma face só (tag, rótulo), alterna entre as peças.
     - **Metade das peças com cada nome:** divide a QTD (24 → 12 + 12, editável), mesmo tema.
     - **Os dois juntos na mesma face:** "Nome 1 + conector + Nome 2". Uma linha se couber, senão empilhado. O auto-ajuste vale para o bloco inteiro, como no nome composto. Conector configurável no tema: **&**, **e**, **♥** ou um **elemento**. Com idades diferentes, cada nome leva a sua.
  4. **Hashtag:** opção de usar **os 2 nomes** (#AylaEAylin…) ou um por face, junto com o nome da face.
  5. O nome do arquivo leva os dois nomes (`Ayla-Maria_Aylin-Maria_1ano_…`).
- **Teste de aceite:** o pedido das gêmeas no modo "um nome em cada face" → nas faces de nome de cada caixa, metade "Ayla Maria · 1 ano" e metade "Aylin Maria · 1 ano". O pedido da Maitê **não** é separado em dois nomes.

### 238. Pedido impresso "com aviso" continua em Pendentes
- O pedido **#26100714VBAP35** (Antonella, Moana Baby) foi gerado em lote (`LOTE_15-10_09h_2pedidos_42pag`), está **"gerada c/ aviso"** e foi **marcado como impresso** (aparece a etiqueta "impresso"). Mesmo assim continua em **Pendentes**. O outro pedido do mesmo lote foi para Já gerados.
- **Esperado (item 223):** pedido marcado como impresso sai de Pendentes, **mesmo com aviso**. Se o MAE quiser que a usuária revise, mostra como **etiqueta "revisar"**, sem prender o pedido na aba errada.

### 239. Aviso de fonte reduzida sem dizer a caixa
- O mesmo pedido mostra *"fonte reduzida para 40% / 96% / 47% / 51% / 88% / 97%"*: seis porcentagens soltas, sem dizer **em qual caixa**. 40% é muito: o nome pode ficar ilegível.
- **Esperado:**
  - Cada aviso diz a caixa: *"fonte reduzida para 40% no Cubo"*. Clicar abre o "Ver" naquela caixa.
  - Abaixo de ~60%: aviso **laranja forte**, *"nome pode ficar ilegível no Cubo: aumente a área do nome ou use 2 linhas"*.

### 240. Tema pronto: ligar a página à caixa por seletor, não por nome
- **Caso:** base nova **"Sacola P – ARTE PRONTA"** (1 caixa, "sacola P_molde"). Ao subir o PDF da arte e escolher essa base, apareceu:
  - *"⚠ Página 1 ('SACOLA PP SEM NOME_STITCH') não tem caixa com esse nome na base — dê a ela o nome da caixa (ou fica de fora)"*;
  - *"⚠ A caixa sacola P_molde da base não tem página neste PDF"*.
  
  A Naty precisou renomear a página para o nome exato da caixa.
- **Esperado:**
  - Base com **uma caixa só**: liga a página **sozinha**.
  - Com várias caixas: cada página tem um **seletor "Esta página é a caixa: [sacola P_molde ▾]"**, já com a melhor sugestão pelo nome ou pelo tamanho.
  - Mensagem simples: *"Diga qual caixa é esta página"*.
  - Se o tamanho da página for diferente do molde (aqui 296,9 × 210 contra 295 × 211 mm), avisar a diferença e oferecer "ajustar / preencher".

### 241. Espaço entre nome e idade cresce com a altura da área do nome
- **Tema:** SPIDEY E SEUS AMIGOS_KIT FESTA (base "kit festa_spidey e seus amigos_editavel v4"). A Naty ajusta o espaço entre nome e idade e depois a idade aparece **bem mais longe** do nome. Testado com "Maria Júlia" e com "Ana": nos dois a idade fica longe, então não é o nome encolhendo.
- **Causa observada:** na caixa **MILK**, onde a área do nome (caixa limitadora) é **baixa**, nome e idade ficam juntos. Nas caixas com área **alta**, o bloco se espalha: nome em cima e idade no pé da área. O espaçamento digitado é engolido pela altura da área.
- **Esperado:**
  - O bloco "Nome + idade" fica **junto e centralizado** (verticalmente) dentro da área. A altura da área serve **só de limite máximo** e nunca empurra a idade para baixo.
  - O espaço entre nome e idade é medido **em relação ao nome** (ex.: % da altura da letra) e acompanha o tamanho final do nome depois do auto-ajuste.
  - O valor digitado **nunca muda sozinho** depois de salvar ou reabrir.
- **Teste de aceite:** no tema Spidey, a mesma distância nome-idade em todas as caixas (MILK, Cubo, Pirâmide, Maleta…) com "Ana" e com "Maria Júlia", sem mexer na altura da área.

### 242. "Versão sem nome" não encontra o tema sem nome da mesma base
- A Naty cadastrou **SPIDEY E SEUS AMIGOS_KIT FESTA** (com nome) e **SPIDEY E SEUS AMIGOS_KIT FESTA_SEM NOME**, **as duas na mesma base** ("kit festa_spidey e seus amigos_editavel v4"). No tema com nome, o campo **"Versão sem nome"** não encontra o tema sem nome na busca.
- **Esperado:**
  - A busca lista os temas da mesma base, e também de outras bases com as mesmas caixas (avisando "este tema está na base X").
  - Se não encontrar, dizer o porquê, em vez de mostrar lista vazia.
- **Teste de aceite:** no Spidey com nome, digitar "spidey" ou "sem nome" no campo → aparece o SPIDEY…_SEM NOME. Escolher, salvar, gerar um pedido sem nome → sai com a arte sem nome.

### 243. Aviso de "texto repetido" quando o nome se repete de propósito
- Em vários temas (ex.: MOANA ADULTA_KIT FESTA), o mesmo nome aparece **de propósito em duas faces** (CUBO). Aparece o aviso amarelo *"A base tem 2 NOME no CUBO — o de baixo aparece em todos os temas que não o ocultaram"* + "Limpar textos repetidos". Parece erro na arte, e clicar em "Limpar" pode **tirar o nome que deveria ficar**.
- **Esperado:**
  - Só avisar quando os dois textos são **iguais e estão no mesmo lugar** (um em cima do outro, ±2 mm), como foi o caso da Nutella.
  - Nome em **posições diferentes** (faces diferentes, frente e verso) é **intencional** e **nunca** gera aviso.
  - Se aparecer, botão **"Está certo assim, não avisar mais nesta base"**.
  - Texto que não soe como erro: *"Encontrei 2 nomes no mesmo lugar no CUBO, um em cima do outro. Quer tirar o de baixo?"*.

### 244. Aviso de conflitos depois da limpeza dos textos
- No tema Spidey apareceu: *"0 tema(s) atualizado(s) para a versão 4. 4 conflito(s): 12 tema(s) tinham ajuste no texto IDADE, que saiu da base; 4 no NOME; 4 no SUFIXO — ver quais"*. A Naty olhou e **não viu nada errado** na arte. O aviso só assusta.
- **Esperado:**
  - Avisar só quando **algo mudou de verdade** na arte, em linguagem simples: *"No tema Spidey, a idade voltou para a posição da base. Recuperar o seu ajuste?"*, com o botão **"Recuperar meus ajustes"**.
  - Se nada mudou visualmente, não mostrar (ou mostrar como informação discreta, sem amarelo).

### 245. Pedido com tema SEM NOME fica fora do lote ("Gerar (0)")
- **Pedidos:** #2610070RKXA89B-p1 (SPIDEY E SEUS AMIGOS_KIT FESTA_SEM NOME) e #2610070RKXA89B-p2 (MOANA ADULTA_SEM NOME_KIT FESTA). Nome veio como *"PEDI O NOME"*, status "Aguardando dados da cliente", "faltam dados (NOME, IDADE)". Os dois selecionados → o botão fica **"Gerar (0)"**, sem explicação. O "Gerar" individual de cada linha funciona.
- **Esperado:**
  - **Tema sem nome escolhido = pedido completo:** não cobrar NOME e IDADE, nem no lote.
  - Ao escolher um tema sem nome, oferecer **"Este pedido vai sem nome"**, que limpa o "Aguardando dados" e o "PEDI O NOME".
  - O botão **nunca fica "Gerar (0)" sem explicar**: *"2 selecionados não entram no lote: faltam dados (NOME, IDADE). Gerar mesmo assim / Ver quais"*.
- **Teste de aceite:** os 2 pedidos acima, selecionados → "Gerar (2)" → 1 PDF com as duas artes sem nome.

---

## P2

### 236. Ajuste fino da arte para quem corta com faca (corte e vinco manual)
- Quem corta na **corte e vinco manual** usa **facas de corte** e não tem marca de registro: o papel encosta no esquadro da máquina. Com a arte centralizada na página, o corte muitas vezes sai **deslocado** e é preciso reposicionar a arte. Segundo a Naty, o desvio **geralmente vem da faca** (cada faca é montada com uma pequena diferença em relação ao molde digital).
- **Esperado:**
  1. Na base, etapa de corte, duas opções claras: **"Corto com marca de registro (máquina automática)"** (o que já existe) e **"Corto com faca (corte e vinco manual)"**.
  2. **Ajuste fino X/Y por faca/molde**, igual ao da marca, só que **movendo a arte** (e as linhas de corte da folha de teste), e não uma marca. Salvo uma vez por faca, vale para kit, pedido e edição em massa. Sem ajuste, sai igual a hoje.
  3. **"Imprimir folha de teste da faca" com régua de leitura:**
     - Imprime só o **contorno da faca** + **reguinhas milimetradas** atravessando a linha de corte nos 4 lados (de −5 a +5 mm, com o **0 exatamente em cima da linha** de corte certa, tracinho e número a cada 1 mm).
     - A usuária corta a folha com a faca e **lê na reguinha onde o corte caiu** em cada lado (ex.: "esquerda +2, topo −1").
     - Digita esses números no MAE (tela: "Onde a faca cortou em cada lado?") e o MAE calcula o X/Y.
     - Não precisa medir com régua nem de PDF de referência.
  4. Opção **"Alinhar a arte pelo canto do esquadro"** (superior esquerdo, superior direito…), em vez de centralizar. O A4 varia ±1 mm, e a arte centralizada "anda" junto.
- **Teste de aceite:** faca com desvio conhecido (ex.: +2 mm à direita) → folha de teste → reguinha mostra +2 → digita → gera de novo → o corte cai no 0.
