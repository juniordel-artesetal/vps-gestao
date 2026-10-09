# Módulo MAE — Ajustes do teste (Lote 5)

Testado pela Naty em 08/10/2026, depois da entrega do Lote 4. Este lote traz:
- **Parte A:** resultado do reteste do Lote 4.
- **Parte B:** itens novos (53 a 79), em sequência ao Lote 4 (que foi até o 52). Os itens 72 a 79 foram acrescentados em 09/10.

Prints citados estão com a Naty.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-5.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-5.md (reteste do Lote 4 e novos ajustes da Naty
no módulo MAE), docs/mae-spec.md e docs/mae-progresso.md. Em modo plano,
organize a correção pelas prioridades do arquivo:
P1) erros que afetam a arte final e a edição em massa (68, 58, 71, 70, 65,
    67, 56, 53);
Estrutural) grupos de produto na Base (72), bloco Nome + idade (73) e
    fundo automático atrás do texto (74), troca de fonte por letra (75),
    folha de impressão montada (76), campos extras e frase junto do nome
    (77), lista de pedidos com observação do SOA e Gerar por linha (78),
    PDF na quantidade do pedido com quantidades por caixa (79):
    avalie primeiro o impacto do 72 no modelo de dados (base, tema,
    vínculo produto + tema) e do 77/79 no pedido (campos e quantidades)
    antes de mexer na Base por causa de outros itens;
P2) melhorias de fluxo (59, 62, 66, 57, 64, 63, 60, 69, 61);
P3) acabamento (54, 55).
Comece pelo 68 (arte inteligente): é o erro mais importante. Para cada item, diga
quais arquivos mudam e como vamos testar. Não implemente antes da minha
aprovação. Ao fim de cada etapa, rode os testes e registre em
docs/mae-progresso.md o que foi feito, item por item.
```

---

## Parte A — Reteste do Lote 4

| Status | Itens |
| --- | --- |
| ✅ Funcionando | 17, 18, 21, 30, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52 |
| ⚠️ Parcial | 29 (ver 70), 34 (ver 71) |
| ✅ Pasta Biblioteca MAE | Lembrada ao reabrir o navegador |

Destaques positivos da Naty: menu do SOA recolhido no MAE ("tela bem mais ampla"), Tab para esconder painéis ("amei"), painel de Apliques 3D com prévia ("ficou f*da"), papel dentro do nome ("perfeito"), edição em massa com preenchimento na linha e tema lembrado.

---

## Parte B — Itens novos

### P1 — Erros que afetam a arte final e a edição em massa

### 68. Arte inteligente gera formas irregulares na exportação (prioridade máxima)
Testado com MILK e MALETA COM ALÇA, sobra de 10 mm, exportado com e sem linhas de corte.

**O que acontece:**
1. **A sobra não respeita a medida.** Cada face parece vazar por um retângulo grande próprio; em alguns pontos chega à borda da folha (topo da milk, laterais da maleta), em outros quase não existe.
2. **As sobras se atropelam.** O rosa sólido do FUNDO invade a sobra das laterais e abas, criando manchas irregulares e degraus, em ordem aleatória.
3. **Abas dentro do molde ficam brancas.** Na maleta, a aba de colar da direita fica branca por dentro da linha de corte e rosa por fora (a sobra é desenhada, mas a aba em si não recebe papel). Na milk, o mesmo nos vãos entre as abas de baixo.
4. **Vãos brancos entre abas vizinhas**, justo onde a sobra deveria cobrir.

**Como deve ser (igual ao que a Naty faz no Photoshop), em ordem:**
1. **Preencher tudo que está dentro do molde:** cada face com seu papel; cada aba com o papel das abas ou o da face vizinha (item 63). Nenhum branco dentro da linha de corte.
2. **Calcular um único contorno externo** = contorno do molde inteiro ampliado pela sobra (Clipper2, o mesmo dos apliques), acompanhando o desenho do molde.
3. **Preencher a faixa entre o corte e esse contorno** com o papel da **face ou aba mais próxima de cada ponto**, continuando o papel dela. Cada face vaza só pelas suas bordas de **corte**, nunca invade a vizinha pelas bordas de **dobra**. Nada passa do contorno; nada se sobrepõe.
4. Elementos e textos continuam recortados dentro da face (item 21).

**Teste de aceitação:** exportação da milk e da maleta comparada com as artes de impressão da Naty (Stitch, Masha e o Urso): sobra uniforme, sem branco, sem manchas.

**Ajuste junto:** a opção **"Imprimir as linhas de corte e dobra" vem desligada por padrão** (a Naty sempre desliga: com plotter e marca de registro, as linhas impressas ficam feias). Na tela, as linhas continuam visíveis.

### 58. Prévia e arquivo da edição em massa só mostram o nome numa caixa
- **O que acontece:** no tema "PEQUENA SEREIA TESTE", o NOME foi colocado em todas as caixas (com "Colocar em todas as páginas" / "Duplicar"), mas na prévia do pedido #123 ("Naty") o nome aparece só numa caixa.
- **Provável causa:** as cópias criadas por "Colocar em todas as páginas" ou "Duplicar" não estão sendo preenchidas na geração; só a primeira posição do NOME recebe o dado do pedido.
- **Esperado:** todas as posições de NOME, IDADE e HASHTAG do tema recebem os dados do pedido, na prévia e no arquivo final.

### 71. Papel arrastado para uma parte com cor sólida fica escondido
- **O que acontece:** com 3 partes selecionadas (FUNDO, FRENTE, LATERAL DIREITA), o papel arrastado mudou FRENTE e LATERAL, mas o FUNDO continuou rosa. O cartão do FUNDO passou a mostrar "2 cam.": o papel entrou, mas **por baixo da cor sólida**.
- **Esperado:** ao arrastar um papel para uma parte que tem cor sólida, o papel **substitui o fundo** (a cor sai), ou entra **por cima**. Se a usuária quiser manter os dois, usa a transição ou a ordem das camadas.

### 70. "Repetir (padrão)" ignora o modo "Só nesta caixa"
- **O que acontece:** com "Só nesta caixa" ativo (caixa MILK), clicar em **Repetir (padrão)** aplica em todas as caixas da parte.
- **Esperado:** Preencher / Repetir, tamanho do padrão, espelhar e mover respeitam o modo ativo, como os outros ajustes (só nesta caixa = ajuste local).
- A função Repetir em si ficou ótima.

### 65. Papel não entra pelo cartão da parte FECHO SUPERIOR
- **O que acontece:** todas as partes recebem papel arrastado para o cartão do painel, menos **FECHO SUPERIOR** (9 faces, "0 camadas"). Arrastando direto **na face, na arte**, o papel entra (só naquela face).
- **Diagnóstico:** as faces estão boas; o problema é o drop no **cartão dessa parte**. Pista: a caixa de seleção de uma face do fecho sobe para fora da prancheta; talvez um contorno detectado maior que o real atrapalhe a parte toda.
- **Esperado:** arrastar para o cartão preenche as 9 faces. Se alguma face não puder receber papel, avisar qual e por quê.

### 67. Controles do padrão de aplique (painel da esquerda) não fazem efeito
- **O que acontece:** no painel Apliques 3D (padrão do tema), mover **Bordinha** e **Deslocamento da silhueta** não muda nada, nem na prévia nem nos apliques. Testado com aplique personalizado (ursinho) e com aplique sem valores próprios (coroa). No painel da direita ("só deste"), funciona e a prévia atualiza.
- **Esperado:**
  - O padrão do tema vale para todos os apliques sem valor próprio, com a prévia mudando na hora e nas folhas exportadas.
  - Aplique com valor próprio mostra **"Personalizado"** + **"Voltar ao padrão do tema"**.
  - No painel da esquerda: "2 apliques: 1 usa o padrão, 1 personalizado".
  - Ao mudar o padrão havendo personalizados: "Aplicar também nos personalizados?"
  - A prévia do painel da esquerda mostra o resultado do padrão.

### 56. Texto arrastado para outra prancheta some e vira uma caixinha "revise"
- **O que acontece:** a IDADE duplicada na milk e arrastada para a triangulove some; fica uma caixinha vermelha minúscula com "revise".
- **Provável causa:** a regra do item 21 recorta o texto, porque ele caiu entre faces ou numa dobra; a caixa também parece encolher na troca de prancheta.
- **Esperado:** o texto aparece onde foi solto, com o mesmo tamanho em mm. A face sob o cursor fica destacada durante o arraste e o texto se encaixa nela. Em dobra ou fora da face, o texto **continua visível**, com contorno vermelho de aviso. Nunca some.

### 53. Tecla Delete e lixeira para excluir o objeto selecionado
- **Delete** e **Backspace** excluem qualquer objeto selecionado (texto, elemento, papel, forma, moldurinha, camada). Hoje o Delete não funciona e não há lixeira para textos.
- Botão de **lixeira** no painel de propriedades e **"Excluir"** no clique direito. **Ctrl+Z** desfaz.
- **Cuidados:**
  - Com foco num campo de digitação, o Delete apaga a **letra**, não o objeto.
  - Itens **travados** (marca de registro, identidade) não são excluídos: "Item travado — destrave para excluir".
  - Elemento vinculado respeita o modo: "Só nesta caixa" exclui só ali; "Todas" pede confirmação ("Excluir de todas as 6 caixas?").
  - Excluir o NOME de uma caixa não apaga das outras.

### 72. Base de portfólio com grupos de produto (estrutural — ler antes de mexer na Base)
Ideia da Naty: a aluna monta **uma base com todo o portfólio** (kit festa, sacolas, tags, rótulos, forminhas…) e cria **cada tema uma vez só** para todos os produtos, com a mesma identidade visual.

- **Grupos de produto na Base:** cada molde pertence a um grupo, e **cada grupo é ligado a um produto do SOA** (não um nome digitado), para a edição em massa saber qual usar.
  - Ex.: Grupo Kit Festa → 6 caixas · Grupo Sacola P · Grupo Sacola G · Grupo Tag · Grupo Rótulo · Grupo Forminha… quantos quiser.
- **Painel "Grupos" no estilo camadas do Photoshop:**
  - Cada grupo é uma pastinha com os moldes dentro.
  - **Arrastar molde entre grupos** (ex.: a Milk sai do Kit Festa e vira produto individual).
  - Criar, renomear, reordenar e excluir grupos a qualquer momento (dá para montar a base e organizar os grupos depois). Excluir grupo não apaga moldes: eles vão para "Sem grupo".
  - **Um molde em mais de um grupo:** "Usar também em…" ou **Alt + arrastar** (a Milk no Kit Festa e também avulsa): mesmo molde, mesma arte.
- **Partes valem entre grupos:** FRENTE do kit, da sacola e da tag é a mesma parte; o papel arrastado uma vez vai para o portfólio inteiro. Também pode haver partes exclusivas de um grupo (ex.: "ÁREA DO RÓTULO").
- **Cada grupo com as suas pranchetas** (tags/rótulos com várias unidades por folha, sacolas em A4 deitado etc.).
- **Ao salvar o tema, o sistema separa por grupo:** "Sereia · Kit Festa", "Sereia · Sacola P"… Cada um é um tema por produto (produto + tema, item 44 do Lote 4).
- **Escolher os grupos no tema:** se um tema não tem rótulo, a usuária desmarca o grupo.
- **Temas antigos se atualizam** se um molde mudar de grupo ou entrar em um novo (ex.: Milk vira avulsa → o tema passa a gerar também "Sereia · Milk").
- **Edição em massa:** a cliente comprou Kit Festa + Sacola P da Sereia → o sistema usa os dois grupos. **Mesmo pedido, produtos diferentes = PDFs diferentes**, cada um com a sua quantidade no nome, porque as quantidades são diferentes (ex.: kit de 12 e sacola de 40):
  ```
  Kit Festa/  Naty_5anos_Sereia_Kit12.pdf
  Sacola P/   Naty_5anos_Sereia_SacolaP40.pdf
  ```
  Comprou só o kit → gera só o kit.
- **Nome, idade e hashtag** são os mesmos para todos os grupos do pedido; cada grupo tem as suas posições.
- **Futuro (negócio):** os packs da Loja da Naty podem ser vendidos como "pack portfólio" (kit + sacolas + tags num tema só).

### 73. Bloco "NOME + IDADE" juntos
Em sacolas, rótulos e tags, a Naty (e outras alunas) coloca **o nome e a idade juntos**, com a idade embaixo do nome, em vez de posições separadas.
- Novo tipo de texto: **"Nome + idade"**, um bloco único que se move, redimensiona e gira junto.
- **Modelos prontos de arranjo:**
  - Nome em cima, idade embaixo ("Maria Júlia" / "5 anos")
  - Nome e idade na mesma linha ("Maria Júlia · 5 anos")
  - Nome + "faz" + idade ("Maria Júlia faz 5")
- **Estilo:** por padrão, **o mesmo estilo para o bloco todo** (como nas sacolas da Naty: "Benjamin / 5 anos" e "Davi / Henrique / 1 ano", mesma fonte e efeitos, idade um pouco menor). Opcional: estilo próprio por linha (ex.: nome cursivo e idade em outra fonte). Tamanho da idade em % do nome e espaço entre linhas ajustáveis.
- **Nome composto + idade:** com "2 linhas" no composto, o bloco fica com 3 linhas ("Davi" / "Henrique" / "1 ano"), centralizado e ajustado ao espaço.
- Usa o **SUFIXO** automático do item 62 (ano/anos/aninho/aninhos) e as regras de **nome simples × composto** (item 50 do Lote 4); o bloco se ajusta para caber.
- Disponível em "+ Texto" ao lado de "+ NOME · + IDADE · + HASHTAG", e em "Colocar em páginas…" (item 57).
- Pode coexistir com NOME e IDADE separados em outras caixas do mesmo tema (ex.: separados nas caixas do kit, juntos na sacola e na tag).

### 74. Fundo automático atrás do texto (faixa da hashtag)
Nas artes da Naty, a **HASHTAG fica sobre um retângulo** (faixa) com estilos de camada, ex.: faixa vermelha sob "#ARTHURFAZ1", faixa laranja sob "#davilucca faz1". O retângulo precisa **acompanhar o tamanho do nome**: hoje ela ajusta à mão a cada pedido.
- No painel do texto, opção **"Fundo do texto": sem fundo / retângulo** (cantos vivos ou arredondados).
- **Ajuste automático:** o retângulo cresce e encolhe junto com o texto, na edição em massa também.
  - **Sobra nas laterais** (mm) configurável; por padrão, um pouco maior que o texto.
  - **Posição do texto sobre o fundo:** o texto fica **um pouco acima** do centro da faixa (configurável, como a Naty faz).
  - **Altura** da faixa configurável (mm ou % da altura do texto).
- **Dentro da caixa limitadora** definida na arte: se o nome for grande demais, o texto encolhe (auto-ajuste) e a faixa acompanha; nunca passa do limite.
- O retângulo aceita **cor, degradê, papel (máscara de corte)** e **todos os estilos de camada** (traçado, sombra, chanfro…), independentes do estilo do texto.
- Disponível para **HASHTAG** (uso principal) e também para **NOME**, **NOME + IDADE** (item 73), como a faixa vermelha atrás de "ARTHUR 1 ANO".
- Salvo nos presets de efeito junto com o estilo do texto.
- **Fundo do texto: imagem (logo do tema).** A Naty às vezes usa a **logo do tema** atrás do nome (ex.: a faixa vermelha do Toy Story atrás de "ARTHUR 1 ANO").
  - Opção **"Imagem (logo)"** no Fundo do texto: sobe o PNG da logo.
  - A usuária marca a **área do nome dentro da logo**.
  - **A logo nunca deforma:** o nome encolhe ou cresce para caber naquela área (auto-ajuste, regras de nome simples/composto e 1 ou 2 linhas).
  - **Logo e nome presos juntos:** movem, giram e redimensionam como uma peça só.
  - Opção extra para faixas lisas: **"esticar só na largura, até X%"**.

### 75. Trocar a fonte (ou o glifo) de uma letra só
Problema real, com **devoluções de pedidos**: em algumas fontes, certas letras ficam ilegíveis (ex.: o **J** de "Joaquim" parece um **T** ou um **L**). Hoje a equipe troca, à mão, só aquela letra por uma fonte parecida.
- **Na criação do tema: regras de troca de letra.** No painel do texto, **"Trocar letra"**: escolher a letra (ex.: J maiúsculo) e o que usar no lugar: **outra fonte** (ex.: fonte similar mais legível) ou **outro glifo** da mesma fonte (painel de glifos). A regra fica salva no tema e vale **automaticamente** para todos os pedidos (ex.: todo nome com J usa a fonte Y só no J).
  - Opção: aplicar a regra **só na letra inicial** ou **em todas as ocorrências**.
  - Ajuste fino da letra trocada: tamanho, linha de base e espaçamento, para combinar com a fonte principal.
- **Na edição em massa / botão "Ajustar" (item 59):** clicar numa letra do nome **daquele pedido** e trocar a fonte ou o glifo só ali.
- **Prévia ampliada do nome** na linha da edição em massa (ao passar o mouse na miniatura), para a equipe conferir a legibilidade antes de gerar.
- As regras de troca podem ser salvas também no **preset de efeito / da fonte**, para reaproveitar em outros temas com a mesma fonte.

### 76. Folha de impressão montada (várias peças por folha: rótulos, adesivos, etiquetas)
Produtos pequenos não se imprimem um por folha. Hoje a Naty monta a folha à mão; a concorrente já faz isso automático. Exemplos:
- **Adesivo redondo:** várias unidades iguais na A4.
- **Etiqueta escolar:** um **kit** com etiquetas de **tamanhos diferentes** (ex.: 4 de 9×5 cm + 10 de 5×2 cm + …) na mesma folha.
- **Rótulo Pringles / Nutella:** rótulo da frente + rótulo da tampa, em quantidades definidas por folha.

**Conceito: separar a PEÇA da FOLHA.**
1. **Peça** = a arte de uma unidade (etiqueta 9×5, etiqueta 5×2, rótulo frente, tampa, adesivo redondo). É criada no MAE como qualquer molde: partes, papéis, NOME/IDADE etc. Cada peça pode ter formato de corte próprio (retângulo, cantos arredondados, círculo, forma livre).
2. **Folha de impressão** = um modelo, criado **uma vez na Base**, que diz **quantas de cada peça cabem na folha e onde**.
   - Escolher o tamanho da folha (A4…) e a **marca de registro** (a área das marcas fica livre automaticamente).
   - Botão **"Preencher folha"**: escolhe a peça e o sistema calcula e distribui o máximo que cabe, com **espaçamento** configurável (mm) e sobra/arte inteligente de cada peça.
   - **Folha mista:** colocar peças de tamanhos diferentes na mesma folha (ex.: 4 de 9×5 + 10 de 5×2), com organização automática e ajuste manual (arrastar, girar 90° para aproveitar espaço).
   - Mostra o **aproveitamento** ("38 peças · 87% da folha usada").
   - A folha fica ligada ao **produto/grupo** (item 72): "Etiqueta escolar → Folha Kit Escolar", "Rótulo Pringles → Folha Pringles".

**Na edição em massa:**
- O sistema **personaliza as peças** (nome, idade, campos extras do item 77) e **monta a folha** automaticamente, com marca de registro, em vez de gerar uma unidade de cada.
- **Quantidade:** se o pedido pede mais do que cabe numa folha, gera quantas folhas forem necessárias (ex.: 40 rótulos e a folha comporta 12 → 4 folhas; a última pode ser completada com cópias extras ou ficar com espaço vazio, configurável).
- Exporta também o **arquivo de corte** (SVG/DXF) da folha montada, alinhado às marcas, para a plotter cortar cada peça.
- Arquivo separado por produto, com a quantidade no nome (itens 60 e 72).

**Decisões da Naty (respostas de 09/10):**
- **Mesmos dados em todas as peças do kit:** nome e, na etiqueta escolar, também **série/turma** e **nome da professora** (campos extras, item 77). Campo vazio **some e o restante se recentraliza** na peça.
- **Quantidade por kit é padronizada:** **1 kit = 1 folha**. Quem quer mais etiquetas compra mais kits (2 kits = 2 folhas). Não precisa de quantidade por variação dentro do kit.
- A usuária pode criar **outras folhas/bases** para vendas avulsas (ex.: só etiquetas de lápis 5×2). **Avulsos saem em folha própria**, nunca misturados na folha do kit.
- **Sem legenda de medida/uso** na folha (decidido: é firula). Se um dia o meio-corte pedir, volta como opção.

**Opção "Aproveitar folhas" (juntar pedidos diferentes na mesma folha):**
A Naty já faz isso à mão e quer automático.
- Opção na geração, **desligada por padrão**: "Aproveitar folhas (juntar pedidos)".
- As peças de cada pedido ficam **agrupadas** (lado a lado, nunca intercaladas).
- Junto de cada grupo, **fora da linha de corte**, um identificador discreto: `#123 · Naty`, para a equipe separar depois do corte.
- **Um kit nunca é dividido** entre folhas. Só peças avulsas (adesivos, rótulos) completam espaços.
- Gera um **PDF de lote** (`LOTE_Adesivo-redondo_09-10.pdf`) + um **resumo de separação** (lista: folha 1 → pedidos #123, #124; folha 2 → …).
- Não conflita com o item 60: essa junção é só para peças pequenas em folha montada; caixas continuam um arquivo por pedido.

### 77. Campos extras e frase fixa junto do nome
**Campos extras** (por tema/produto), além de NOME e IDADE: ex.: **SÉRIE/TURMA**, **PROFESSORA**, ou o que a usuária criar ("+ Campo").
- Cada campo é um texto próprio na arte: posicionável, com estilo próprio, "Colocar em…" e preset de efeito como os outros.
- Aparece como coluna editável na lista de pedidos (item 78).
- **Campo vazio some** e os textos do bloco se recentralizam (vale para peças da folha montada, item 76, e para caixas).

**Frase fixa antes/depois do nome** (ex.: **"A Pequena Laura"**, **"Fazendinha do Davi"**):
- No tema, o NOME pode ter uma **frase antes e/ou depois**: `A Pequena {NOME}`, `Fazendinha do {NOME}`.
- A frase é um **campo próprio com estilo próprio** (ex.: "A Pequena" menor, em fonte script, em cima do nome, como nas artes da Naty), ligado ao bloco do nome para acompanhar o posicionamento.
- O tema traz o **valor padrão**, editável por pedido na lista (ex.: trocar para "Fazendinha **da** Laura").
- Frase vazia some e o nome se recentraliza.

### 78. Lista de pedidos da edição em massa (uma linha por pedido)
Inspirado no concorrente, que mostra os pedidos em linhas editáveis. Cada linha:
- miniatura · **#pedido** · cliente · produto/variação;
- **NOME, IDADE, frase e campos extras editáveis ali mesmo** (item 77);
- **Observação do pedido puxada do SOA** (o campo já existe no pedido): ícone 💬 **aceso** quando há observação; clicando abre o texto inteiro. A equipe lê "quero só pirâmide e cubo" sem sair da tela;
- botão **Quantidades** (item 79);
- botões **Ver** (prévia), **Ajustar** (item 59) e **Gerar**, na própria linha.

Seleção e abas:
- Caixinha de seleção por linha, **"Selecionar aprovados"** (status de aprovação do pedido no SOA) e **"Gerar selecionados (5)"**.
- Duas abas: **Pendentes** e **Já gerados**. O pedido gerado sai de Pendentes e vai para Já gerados, com a data/hora e o botão **"Gerar de novo"**.
- Visual mais limpo que o atual: linhas com espaçamento, colunas alinhadas, status por cor.

### 79. PDF já na quantidade do pedido, com quantidades por caixa
Hoje a equipe imprime "N cópias" de cada página. O concorrente já entrega o arquivo na quantidade (kit 12 com 6 caixas = 2 de cada; kit 42 = 7 de cada = 42 páginas).
- Na exportação: **"Já sair na quantidade do pedido"** (padrão) ou **"1 de cada"** (aprovação/teste).
- **Desempenho (importante):** renderizar **cada caixa diferente uma vez só** e, no PDF, **reaproveitar o mesmo objeto de imagem** nas páginas repetidas (pdf-lib: `embedPng/embedJpg` uma vez, `drawImage` em várias páginas). Assim, 42 páginas com 6 caixas diferentes ficam quase do tamanho e do tempo de 6 páginas. Não re-renderizar nem re-embutir por cópia.
- **Botão "Quantidades" na linha do pedido** (item 78): lista das caixas do produto com um número em cada.
  - Vem **preenchido pela variação** do pedido: quantidade do kit ÷ número de caixas (kit 12 / 6 caixas = 2 de cada).
  - Kit que não divide certinho (ex.: kit 10 com 6 caixas): distribui o mais igual possível e marca ⚠️ para conferir.
  - A usuária ajusta conforme a observação da mãe (ex.: pirâmide 4, cubo 2, as outras 0). A **observação fica visível** ao lado enquanto ajusta.
  - Contador **"12 de 12 ✓"** ou **"10 de 12 ⚠️"** quando o total não bate com o kit. É aviso, **não trava** a geração.
  - Quantidade ajustada fica salva no pedido (ícone na linha).
- Vale também para a folha montada (item 76): o kit montado sai repetido na quantidade de kits.
- Nome do arquivo continua com a quantidade (item 60).

### P2 — Melhorias de fluxo

### 59. Botão "Ajustar" em cada pedido da edição em massa
- Ao lado do "ver", botão **"Ajustar"**: abre a arte daquele pedido com NOME, IDADE, HASHTAG (e SUFIXO, item 62) editáveis por caixa: mover, tamanho, girar, 1 ou 2 linhas.
- O tema fica **travado** por baixo; só os textos do pedido se mexem.
- **Salvar** guarda o ajuste só naquele pedido (ícone "ajustado" na linha).
- **"Usar este ajuste como padrão do tema"** e **"Voltar ao padrão"**.

### 62. Sufixo da idade: ANO / ANOS / ANINHO / ANINHOS
Nas artes da Naty, o "ANOS" muitas vezes fica **em pé ao lado da idade**, com o mesmo estilo.
- Nova variável **SUFIXO**, um texto próprio posicionável (girado 90°, embaixo, na frente…).
- Singular/plural automático: 1 → ANO / ANINHO; 2 ou mais → ANOS / ANINHOS. Bônus: **MÊS / MESES** para mesversário.
- **"Formato da idade"** por pedido na edição em massa: anos / aninhos / só o número (padrão definido no tema).
- Estilo: seguir o da IDADE ou próprio; maiúsculas/minúsculas configuráveis.
- Auto-ajuste ao espaço (ANINHOS é maior que ANO).
- "+ SUFIXO" e "Colocar em…" como os outros textos. A hashtag não muda.
- **Idade sempre em número** (confirmado pela Naty): não precisa de opção por extenso.

### 66. Juntar faces vizinhas num "cenário contínuo"
Nas artes da Naty (ex.: Masha e o Urso, lateral direita da milk), duas faces vizinhas viram um cenário único, com a arte atravessando a dobra e uma moldurinha só em volta.
- **Na Base:** selecionar 2+ faces vizinhas (Ctrl + clique) → **"Juntar como cenário contínuo"** → vira uma parte única (ex.: "CENÁRIO DIREITA").
- **No Tema:** a mesma opção **só nesta caixa**.
- A linha de dobra continua existindo para corte e linhas; só a arte passa por cima.
- Papel/imagem se ajusta ao retângulo das faces juntas, sem esticar.
- Moldurinha pode contornar o cenário inteiro ou cada face.
- **"Separar faces"** desfaz.

### 57. "Colocar em…" com escolha das páginas
- "Colocar em todas as páginas" passa a ser **"Colocar em páginas…"**: abre a lista de pranchetas com caixinhas (todas marcadas por padrão); a usuária desmarca as que não quer.
- Caso real: a Naty queria a IDADE só em algumas caixas e teve que duplicar e arrastar uma por uma (o que causou o item 56).

### 64. Cada tema com os seus papéis e elementos
- **Tema novo começa zerado:** hoje um tema novo vem com os papéis do tema anterior.
- Organização automática: `Papéis/<Tema>/`, `Elementos/<Tema>/`.
- Botão **"Buscar em outros temas"** (com miniaturas) para reaproveitar.
- Pasta **"Uso geral"** (poá, xadrez, glitter, laços) visível em todos os temas.
- **Duplicar tema** leva tudo junto.
- **Estilo dos textos também é herdado (confirmado):** o NOME de um tema novo veio com a textura e os efeitos do tema anterior. Tema novo deve começar com NOME, IDADE e HASHTAG **sem estilo** (fonte padrão, sem efeitos, sem papel dentro), exceto ao **duplicar** um tema.

### 63. "Papel das abas" no lugar certo, miniaturas e textos técnicos
- **Papel das abas sai da Base e vai para o Tema** (a Base é só esqueleto; com o papel na Base, todos os temas herdariam o mesmo papel).
  - Na Base fica só a **Sobra (mm)**, com a frase "Quanto a arte passa da linha de corte, para não ficar filete branco".
  - No Tema: papel, cor sólida ou **"usar o papel da face vizinha"** (sugerido como padrão), com prévia na arte.
- **Todo seletor de papel mostra miniaturas**, nunca nome de arquivo (hoje aparece "ChatGPT Image 25 de set. de 2026…png").
- **Remover textos técnicos da tela:** o painel mostra "(Sprint 9)". Procurar e retirar outros termos internos do sistema todo.

### 60. Exportação simplificada
- **v1:** só **"um arquivo por pedido, separado por produto"**, com a **quantidade/variação no nome** do arquivo para a equipe saber quantas cópias imprimir. Ex.: `Kit Festa/Naty_5anos_Sereia_Kit24.pdf`.
- **Retirar** a opção "Juntar num PDF só por produto": não considera que os kits têm quantidades diferentes (12, 24…). No teste, gerou um arquivo de lote igual ao individual.
- **Páginas repetidas conforme a quantidade:** entrou como item 79 (padrão "Já sair na quantidade do pedido").
- **Futuro, só se as alunas pedirem:** lote inteligente agrupado por variação (`LOTE_Kit-Festa_12un.pdf`). A exceção é a folha montada com "Aproveitar folhas" (item 76).

### 69. Escolher a parte no painel = aplicar em todas as caixas da parte
- **O que aconteceu:** a Naty escolheu a parte FRENTE no painel da esquerda para criar a moldurinha, mas o modo no topo estava em "Só nesta caixa", e a moldura foi só para uma caixa. Com "Todas as caixas da parte", funcionou.
- **Regra:** clicou na **parte no painel** → modo vira "Todas as caixas da parte"; clicou numa **face na arte** → "Só nesta caixa".
- Botões dizem onde vão aplicar: **"Nova moldurinha em todas as 2 FRENTES"** / **"só na MILK"**.
- Modo "Só nesta caixa" mais visível, com o nome: **"Editando só: MILK"**.
- Vale para papel, cor, moldurinha, transição e elementos.

### 61. Cada ícone da barra lateral com o seu painel, em todas as abas
- **Base:** os ícones **Moldes**, **Pranchetas** e **Faces** abrem o mesmo painel ("Montar a base / Moldes e faces"). Separar:
  - **Moldes:** importar, lista, excluir, posição/alinhamento.
  - **Pranchetas:** lista, nova, tamanho/orientação, girar, duplicar, excluir, organizar.
  - **Faces:** fechar pontilhado, detectar de novo, Selecionar / Medir / Laço, dividir e unir.
- **Revisar todos os ícones** das abas Base, Tema e Editor livre: nenhum repete o painel de outro; se uma função não justificar painel, o ícone sai.

### P3 — Acabamento

### 54. Lista de fontes com prévia no próprio formato
- Cada fonte escrita nela mesma, com o **nome de exemplo** (ex.: "Ana Júlia"); nome técnico pequeno embaixo.
- Passar o mouse ou as setas ↑↓ aplica uma prévia na arte; clicar confirma; sair sem clicar volta.
- Busca e **favoritas** (estrela) no topo.
- Carregar a prévia só das fontes visíveis (são 500+ instaladas).

### 55. Recursos OpenType com nomes em português e só os úteis
- Hoje aparecem códigos (c2sc, lnum, onum, pnum, smcp, tnum, unic, "Conjunto 1/2/3").
- Nomes claros: "Letras alternativas", "Estilo 1, 2, 3…", "Floreios" (swsh), "Ligaduras", "Versalete", "Números alinhados".
- Mostrar só os recursos que a fonte tem.
- Primeiro os úteis para festa (floreios, alternativas, estilos, ligaduras); técnicos (pnum, tnum, unic, c2sc) num "Avançado" recolhido.
- Tooltip com prévia do nome com o recurso aplicado.
