# Módulo MAE — Lote 18: rótulos Nutella duplicando nome, salvamento e véspera do lançamento

Encontrados pela Naty em 15/10/2026 (madrugada), produzindo pedidos reais de rótulo Nutella e tags. Itens 215 a 230, em sequência ao Lote 17 (que foi até o 214).

⚠️ **URGENTE (lançamento 16/10, 20h):** o 215, o 216 e o 217 travam a produção de hoje. Há pedidos de rótulo Nutella com envio 15/10 saindo com nome duplicado.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-18.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-18.md, docs/mae-ajustes-lote-17.md,
docs/mae-ajustes-lote-16.md, docs/mae-spec.md e docs/mae-progresso.md.
Em modo plano, organize nesta ordem:
P0) 215 (temas da base Rótulo Nutella com NOME/IDADE duplicados depois da
    base v5 + texto fora da peça imprimindo em cima da vizinha),
    216 (salvamento intermitente: alteração some ao reabrir o tema),
    217 (lote com temas diferentes sai todo com o tema do 1º pedido) —
    comece pelo 215 e pelo 216, que estão gerando pedido errado HOJE;
P1) 218 a 226;
P2) 227 a 230.
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Publique o 215, o 216 e o 217 assim
que estiverem prontos (antes do resto), confira na URL de produção e
registre em docs/mae-progresso.md o que foi feito e publicado, item por item.
```

---

## Parte A — Reteste do Lote 17

| Status | Item |
| --- | --- |
| ✅ | **208** Kit de N peças multiplica pela QTD: Bento QTD 15 → 5 folhas (corpo 7 + 7 + 1 · tampa 12 + 3). Só funcionou depois de **ligar a base a um produto do SOA** (sem produto, gera 1 unidade em silêncio → item 220). |
| ✅ | Gabarito próprio na folha do kit: subiu, reconheceu e cortou certo. |
| ✅ | **212** Exemplo do nome do arquivo agora mostra o pedido selecionado. |
| ⏭️ | **213 / 214** (cor por letra, elemento preso ao nome): telas aparecem, ainda não testados. |
| 🔁 | **211** Substituído pelo item 219 (simplificar "Como o pedido conta"). |

---

## P0

### 215. Rótulo Nutella: NOME e IDADE duplicados nos temas antigos + texto fora da peça imprimindo na vizinha
- **Base:** "Rótulo Nutella – ARTE PRONTA" **v5**, usada em **47 temas**. Na base está certo: **Corpo = 1 texto "Nome + idade"**, **Tampa = 1 texto "IDADE"**.
- **Sintoma:** temas criados antes da v5 saem com **o bloco "Nome + idade" certo + um NOME solto + uma IDADE solta**.
  - Exemplos reais: **NUTELLA_MOANA BABY_MOD 1** (pedido Antonella, 2 anos) e o tema **Capivara** (pedido Luisa, 7 anos).
  - O NOME solto sai embaixo, à esquerda. A IDADE solta fica posicionada **abaixo** do rótulo e por isso **imprime em cima do rótulo vizinho**. No último rótulo da folha, sai **fora da folha**.
  - No editor, a IDADE solta aparece fora da peça com o aviso "A idade passou da face na caixa Nutella · Corpo".
- **Palpite:** nas versões antigas da base, NOME e IDADE eram textos separados. Ao virar "Nome + idade" (v5), o "base atualizada" **acrescentou o bloco novo e manteve os textos antigos** nos temas.
- **Esperado:**
  1. **Limpeza agora** nos 47 temas da base: remover os NOME/IDADE antigos que foram substituídos pelo "Nome + idade". Mostrar antes a lista de temas afetados.
  2. Quando a base trocar um texto por outro, o tema **troca** (não soma). Ver item 218.
  3. **Texto fora da peça nunca imprime em cima de outra peça.** Recortar na borda da peça (+ sangria) ou travar a geração com aviso: "o texto IDADE está fora do rótulo. Corrigir antes de gerar".
- **Teste de aceite:** gerar Antonella (Moana) e Luisa (Capivara): cada rótulo com **um** nome e **uma** idade, nada invadindo o rótulo vizinho, nada fora da folha.

### 216. Salvamento intermitente: alteração some ao reabrir o tema
- **Caso real:** no tema Moana, a Naty apagou os textos a mais, **salvou**, reabriu pelo "Abrir tema" e **os textos voltaram**. Salvou **de novo**, ficou certo por um tempo, e depois voltou a sair errado na geração. No tema Ursinhos Carinhosos, só gravou no **segundo** "Salvar".
- Também houve vezes em que o **"Abrir tema" não funcionou** depois de editar e salvar um tema existente.
- O painel mostra "Tema salvo em Temas/… (versão 7) · **base atualizada**". Suspeita: ao abrir, a base é reaplicada **por cima** do que foi salvo no tema.
- **Esperado:**
  - Um "Salvar" sempre grava na nuvem. O "Salvo há X s" só aparece quando gravou **de verdade** (versão nova em "Versões salvas na nuvem").
  - O que foi salvo no tema **nunca é sobrescrito pela base** ao abrir. Texto apagado ou oculto no tema continua apagado ou oculto.
  - O "Abrir tema" sempre abre, sempre na **última versão salva**. Se der erro, mensagem clara, e nunca um botão que não responde.
- **Teste de aceite:** apagar um texto → Salvar (uma vez) → F5 → Abrir tema → o texto continua apagado. Gerar → sai sem o texto.

### 217. Lote com temas diferentes sai todo com o tema do 1º pedido
- **Teste:** 2 pedidos de rótulo Nutella gerados juntos (lote "LOTE_15-10_05h_Etiquetas_2pedidos_10pag"):
  - **#teste2** Bento, 2 anos, QTD 15, tema **NUTELLA_POOH BABY_MOD 1**;
  - **#teste1** Ana, 5 anos, QTD 20, tema **NUTELLA_POOL PARTY MENINAS_MOD 1**.
- **Resultado:** 10 páginas com quantidades e nomes certos e "Aproveitar folhas" juntando as tampas dos dois pedidos, mas **tudo com a arte da Pooh**, inclusive os 20 rótulos da Ana.
- **Esperado:** cada posição da folha leva **a arte do tema do seu pedido**, também quando "Aproveitar folhas" junta pedidos diferentes na mesma folha.
- **Teste de aceite:** o mesmo lote gera os corpos e tampas da Ana com Pool Party e os do Bento com Pooh. Na folha de tampas compartilhada, cada tampa tem a arte do seu pedido.

---

## P1

### 218. O tema segue a base sozinho (sem pedir "atualizar" tema por tema)
- Hoje, toda vez que a base muda, cada tema pede para ser atualizado. Com 200 temas isso não funciona, e o pior risco é a geração em lote usar em silêncio uma estrutura velha (ou somar textos, como no 215).
- **Esperado:**
  - A base é o esqueleto (peças, folhas, MR, gabarito, textos e posições). O tema guarda a arte e o que a usuária mudou nele. Quando a base muda, **todos os temas passam a usar a versão nova automaticamente**.
  - Só pergunta quando há **conflito real** (ex.: parte ou texto apagado da base que tinha arte ou ajuste no tema). Mostra **um aviso único na base**: "3 temas tinham ajuste no texto X. Ver quais", e não uma janela por tema.
  - Na geração em lote, nunca usar versão velha. Tema que não conseguiu acompanhar a base fica com **aviso laranja na linha do pedido** ("tema desatualizado com a base: abrir").
  - Botão na base: **"Atualizar todos os temas desta base"**, com resumo no fim (quantos atualizados, quantos com conflito).
  - Corrigir também o 210 (versão diferente no topo e no painel).

### 219. "Como o pedido conta" vira "Peças por unidade do pedido"
- Na base de tag (1 peça), as opções **"1 unidade no pedido = 1 kit"** e **"O pedido vem em quantidade de peças"** geraram **1 tag** só. Só o **"Kit de N peças"** funcionou.
- São 3 opções que fazem a mesma coisa (fere a regra de ouro). E o texto saiu quebrado: "Quantos **tag redonda 4 cmes** vêm em 1 unidade do pedido?"
- **Decisão da Naty:** fica só o "Kit de N peças", com texto mais claro. A regra é ensinada nas aulas: **a QTD do pedido é o total de peças que a cliente recebe** (kit 10 × 1 = 10).
- **Esperado:**
  - Remover "1 unidade = 1 kit" e "por quantidade de peças". Bases que usavam essas opções passam para a regra nova sozinhas.
  - O bloco fica assim, sem bolinha de escolha:
    > **Peças por unidade do pedido**
    > Tag redonda 4 cm: [ 1 ]
    > 💡 *A quantidade do pedido é o total que a cliente recebe. Kit de 10 → QTD 10.*
    > *Pedido de 96 = 4 folhas (24 + 24 + 24 + 24)*
  - Com mais de uma peça (rótulo): um campo por peça (Corpo [1] Tampa [1]), padrão 1, e o resumo "Pedido de 15 = 5 folhas (corpo 7 + 7 + 1 · tampa 12 + 3)".
  - Nome da peça escrito como está na base, **sem plural automático**.
  - A mesma dica curta ao lado da coluna QTD na lista de pedidos: *"QTD = total de peças (kit 10 × 1 = 10)"*.

### 220. Aviso quando a base não está ligada a um produto do SOA
- Sem produto do SOA ligado, a geração usa **quantidade 1 sem avisar**. A Naty perdeu um bom tempo achando que o kit estava mal configurado.
- **Esperado:**
  - Na linha do pedido, aviso laranja: "A base X não está ligada a nenhum produto do SOA. Vou gerar 1 unidade. **Ligar agora**". Ou usar a QTD do pedido mesmo assim.
  - Na etapa "Produto do SOA" da base, "(sem produto do SOA)" vira um alerta laranja, não texto cinza.

### 221. Elemento por cima da arte pronta
- **Base:** TAG – ARTE PRONTA v2, tema TAG_TOY STORY_MOD 1. A Naty pôs um elemento (laço vermelho) e ele **não aparece**: fica **atrás da arte pronta**.
- Tentou soltar na parte FUNDO, depois direto na tag na folha, e trazer para frente (↑). Nada funcionou. Cada tentativa virou mais uma camada "frame" escondida.
- **Esperado:**
  - A arte pronta **aparece na lista de camadas** como camada normal ("Arte pronta – Tag redonda 4 cm").
  - Elemento novo entra **por cima da arte pronta** por padrão, e dá para mudar a ordem (↑ ↓, trazer para frente / enviar para trás).
  - Se algo ficar 100% tapado: "este elemento está atrás da arte pronta. Trazer para frente?".
  - A camada leva o **nome do elemento**, não "frame".
  - Soltar um **elemento** (não papel) em cima de uma parte não pode virar fundo escondido sem aviso.

### 222. Texto duplicado no tema vira camada de verdade
- Num tema, a Naty duplicou o nome para ter 2 nomes no rótulo: no editor apareciam 2, e **no PDF saiu 1**. No Moana, o contrário: o texto a mais apagado **voltou** (ver 215/216).
- **Esperado:**
  - Duplicar um texto (botão Duplicar ou Ctrl+C/Ctrl+V) no tema cria um texto **igual a qualquer outro**: salva, reabre e **sai na impressão**.
  - Apagar ou ocultar um texto no tema fica apagado, mesmo que ele venha da base.
  - **O que aparece no editor é exatamente o que sai no PDF.** Se algo não for sair (ex.: texto fora da peça), avisar antes de gerar. Nunca mudar sozinho.
- **Teste de aceite:** tema NUTELLA_URSINHOS-CARINHOSOS_MOD 1 com 2 "Nome + idade" no corpo (um de cada lado dos ursinhos) → gerar → os 2 nomes saem em todos os rótulos.

### 223. "Marcar como impresso" tira o pedido de Pendentes
- **Esperado:**
  - Ao marcar como impresso, o pedido sai de **Pendentes** e vai para **Já gerados**, com a etiqueta verde **"impresso"**. Vale também para pedido impresso **fora do MAE**, que nunca foi gerado aqui.
  - Em Já gerados, filtro rápido **"Gerados, não impressos"** (fila do que falta mandar para a impressora).
  - **"Desmarcar impresso"** devolve o pedido para Pendentes.
  - A mesma regra vale para o "Marcar como impresso" da barra de selecionados (vários de uma vez).

### 224. Dividir pedido (duas crianças ou dois temas no mesmo pedido)
- **Caso real:** pedido **#2610071WRJQC9H**, 12 luxo, observação: "12 nossa senhora mod 1 Alice 7 anos – 12 menino maior pintor José Miguel". Hoje o MAE aceita 1 nome e 1 tema por linha, e o pedido trava em "tema não encontrado".
- **Esperado:**
  - Botão **"Dividir"** na linha, em 2, 3 ou mais partes.
  - Cada parte vira uma sublinha (**#…C9H-A**, **#…C9H-B**) com **nome, idade, tema e QTD próprios**.
  - A QTD vem dividida (12 → 6 + 6) e é editável. O MAE avisa se a soma não bater com o pedido. (Neste caso a cliente quer 12 de cada, então a soma pode passar do total, mas com confirmação.)
  - **Sugestão automática:** quando a observação tiver dois nomes ou "dois temas", aparece na linha "Parece ter 2 crianças. Dividir?".
  - As partes saem com o **mesmo número de pedido** no nome do arquivo e **juntas no lote**, para separar e embalar juntas.
  - O pedido no SOA só vira "impresso" quando **todas as partes** estiverem impressas.
  - **"Desfazer divisão"** junta de volta.

### 225. Excluir, trocar e substituir marca de registro
- Não há como excluir uma MR da Biblioteca. Quando a Naty troca a marca de uma caixa, ficam **duas do mesmo produto**, o que confunde na escolha e no agrupamento "mesma caixa junta".
- **Esperado:**
  - Botão **Excluir** em cada marca. Se estiver em uso: "usada em 3 bases e 12 pranchetas", com **"Trocar por outra marca"** (escolhe a nova e atualiza tudo de uma vez).
  - **"Substituir arquivo"**: sobe o arquivo novo e mantém o nome, o ajuste fino X/Y e todas as ligações.
  - Marca excluída vai para a **lixeira de 30 dias**, igual aos temas.

### 226. Organizar bases: mover temas e excluir com aviso útil
- O tema pronto criou várias bases de 1 tema cada ("kit festa_toy story_EDITAVEL-MR", "kit festa_tardezinha_3d-MR", "kit festa_amy rose-MR", "minecraft 3d-MR"…). A Naty quer juntar tudo na base original.
- Ao tentar excluir, aparece: *"'tag teste' é usada em 1 tema(s) — exclua ou troque a base desses temas antes"*. Mas **não diz qual tema** e **não existe "trocar a base"**.
- **Esperado:**
  - **"Mover temas para outra base"**: escolhe a base de destino, o MAE encaixa a arte e avisa conflitos (peça ou medida diferente).
  - Na mensagem de exclusão: o **nome do tema** + botões **"Mover para outra base"** e **"Excluir o tema e a base"** (os dois para a lixeira de 30 dias).
  - Manter o "usada em N tema(s)" na lista de bases.

---

## P2

### 227. Busca no "Abrir base"
- **Esperado:**
  - Campo **"buscar base…"** no topo, filtrando enquanto digita (igual à busca de temas, Ctrl+O, item 181).
  - Busca também pelo nome do molde ou caixa ("triangulove" acha todas as bases com essa caixa).
  - Filtros rápidos: **Caixas com molde · Peças sob medida · Arte pronta**.
  - Ordem padrão: **mais usadas primeiro**, com opção "mais recentes".

### 228. Apagar da biblioteca sem estragar temas
- "Adicionar…" guarda em Papéis/<TEMA>/. Não está claro se o tema guarda uma cópia do elemento ou aponta para o arquivo. A Naty não sabe se pode limpar a biblioteca.
- **Esperado:**
  - O tema guarda o elemento com segurança: **apagar da biblioteca não estraga tema pronto**.
  - Ao apagar um elemento ou papel em uso: "usado em 12 temas. Apagar mesmo assim?", com a lista dos temas.
  - Em cada item da biblioteca, **"em uso em N temas"**.

### 229. Aviso falso: "peças invadindo a área da marca de registro"
- Na "Folha de tags" (24 × Tag redonda 4 cm, MR "TAG 4X4_MR", margem 5 mm, gabarito travado) aparece **"24 peça(s) invadindo a área da marca de registro"**. A folha de teste impressa (`TESTE_Folhadetags.pdf`) mostra todas as tags **dentro** das 4 marcas, sem encostar.
- **Provável causa:** a área da MR é considerada como o retângulo do arquivo inteiro.
- **Esperado:** considerar só a área real das marcas (cantos e QR + 1 mm). Avisar só quando uma peça encosta de verdade, mostrando **qual** peça, em vermelho na folha.
- **Teste de aceite:** a Folha de tags não mostra aviso. Uma tag arrastada para cima de um canto mostra.

### 230. Aviso "2 faces sem papel" com a arte preenchida
- Nos temas de rótulo Nutella (arte pronta), o painel mostra **"2 faces sem papel: Nutella · Corpo · 0, Nutella · Tampa · 0"** mesmo com o corpo e a tampa preenchidos e o PDF saindo certo.
- **Esperado:** em arte pronta, a face com arte conta como preenchida. O aviso só aparece quando a face vai sair **em branco** no PDF.
