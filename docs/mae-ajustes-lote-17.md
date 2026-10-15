# Módulo MAE — Lote 17: rótulo Nutella em produção + nome mais criativo

Reteste do Lote 16 feito pela Naty em 14/10/2026 (noite), com o **rótulo Nutella** (base "Rótulo Nutella" v5, peças sob medida: Corpo 20 × 3,5 cm, 7 por folha; Tampa Ø 5,7 cm, 12 por folha). Itens 208 a 214, em sequência ao Lote 16 (que foi até o 207).

⚠️ **Urgente:** a Naty tem **pedidos reais de rótulo Nutella** esperando. O 208 e o 209 travam a produção.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-17.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-17.md, docs/mae-ajustes-lote-16.md,
docs/mae-ajustes-lote-14.md (item 189, peças sob medida), docs/mae-spec.md
e docs/mae-progresso.md.
Em modo plano, organize nesta ordem:
P0) 208 (a quantidade do pedido não multiplica o kit de N peças) e 209
    (em peças sob medida, cada peça precisa ter as suas partes) — são os
    que travam pedidos reais;
P1) 210 (versão da base diferente no topo e no painel), 211 (texto dos
    campos do kit e o resumo), 212 (exemplo do nome do arquivo na lista);
P2) 213 (cor por letra), 214 (elemento preso ao nome).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Publique o 208 e o 209 assim que
estiverem prontos (antes do resto), confira na URL de produção e registre
em docs/mae-progresso.md o que foi feito e publicado, item por item.
```

---

## Parte A — Reteste do Lote 16

| Status | Item |
| --- | --- |
| ✅ | **203** O tema salva; sumiu o "Sem conexão". (⚠️ versões diferentes no topo e no painel → item 210) |
| ⏭️ | **204** Não testado (a Naty não precisa agora). |
| ✅ | **205** Tema pronto encaixou a arte de cada peça certinho. |
| ✅ | **207** Estrutura por peça funciona. O miolo da tampa só recebeu papel **depois** de preencher as outras faces sem papel (aviso "2 faces sem papel: Nutella · Corpo · 0, Nutella · Tampa · 0"). Funcionou, mas não era óbvio. |
| ❌ | **206** "Kit de N peças": a quantidade do pedido não multiplica → item 208. |
| ✅ | Nome do arquivo: `Bento_2anos_teste-nutella…`, certo. |

---

## P0

### 208. A quantidade do pedido não multiplica o "Kit de N peças"
- **Configuração:** "Como o pedido conta" = **Kit de N peças**, com **Corpo: 1** e **Tampa: 1** (cada unidade do pedido = 1 rótulo completo). A Naty sobe a quantidade da variação escolhida pela cliente (kit 10, 15, 20…) na QTD do pedido.
- **Teste:** pedido **#teste2 — Bento, 2 anos**, **QTD 15**, tema "teste nutella".
- **Resultado:** `Bento_2anos_teste-nutella…pdf` com **2 páginas**: 1 folha cheia de corpos (7) + 1 folha cheia de tampas (12). A QTD 15 foi ignorada.
- **Antes**, com o kit definido como Corpo 7 · Tampa 12, também saíam 2 folhas para o pedido de 10.
- **Esperado:**
  - Peças a imprimir = **kit × QTD do pedido**: 1 corpo × 15 = **15 corpos**; 1 tampa × 15 = **15 tampas**.
  - Distribuir pela capacidade de cada folha: corpos **7 + 7 + 1** (3 folhas), tampas **12 + 3** (2 folhas) = **5 folhas**.
  - A última folha de cada peça sai só com as peças que faltam (sem completar com cópias a mais). Com "Aproveitar folhas" ligado no lote, a sobra pode receber outros pedidos do mesmo produto (item 206).
- **Teste de aceite:** Bento QTD 15 → **1 PDF de 5 páginas** (3 de corpo: 7, 7, 1; 2 de tampa: 12, 3), "Bento 2 anos" em todas as peças. QTD 10 → 2 de corpo (7, 3) + 1 de tampa (10) = 3 páginas. QTD 20 → 3 de corpo (7, 7, 6) + 2 de tampa (12, 8) = 5 páginas.

### 209. Em peças sob medida, cada peça precisa ter as suas partes
- No tema "teste nutella", a parte **FUNDO** aparece com **"2 faces"**: é **a mesma parte no Corpo e na Tampa**. A arte que a Naty colocou no fundo da tampa (o medalhão "5" dos Carros) **saiu também no corpo**, ampliada, no lugar da arte dos Carros.
- Isso contradiz o item 207 (estrutura por peça): a estrutura é por peça, mas as partes continuam compartilhadas.
- **Esperado:**
  - Em base de peças sob medida, **cada peça tem as suas partes**: "Corpo · Fundo", "Corpo · Faixa", "Corpo · Base", "Tampa · Fundo", "Tampa · Miolo". O papel arrastado para "Tampa · Fundo" nunca vai para o corpo.
  - Opção para compartilhar quando a usuária quiser ("usar o mesmo papel no fundo de todas as peças"), mas **não por padrão**.
  - O painel Partes mostra as partes agrupadas por peça.
  - Soltar papel ou elemento **direto no miolo** funciona mesmo com outras faces ainda sem papel.
- **Paliativo até sair:** segurar **Alt** ao soltar o papel na face aplica só naquela peça. Confirmar que isso funciona em peças sob medida.

---

## P1

### 210. Versão da base diferente no topo e no painel
- Mesmo depois do 203, o topo mostra **"Base: Rótulo Nutella v3"** (ou v4/v5) e o painel da direita mostra **"Base: Rótulo Nutella v2"**.
- **Esperado:** os dois mostram a mesma versão. Se o tema estiver ligado a uma versão antiga da base, avisar e oferecer **"Atualizar o tema para a versão atual da base"**.

### 211. Texto dos campos do kit e o resumo
- A Naty preencheu **"Este kit tem: Corpo 7 · Tampa 12"** achando que era quanto cabe na folha. É o mesmo número que aparece nas folhas, e a confusão é natural.
- **Esperado:**
  - Rótulos claros: **"Quantos corpos vêm em 1 unidade do pedido?"**, **"Quantas tampas vêm em 1 unidade do pedido?"**. Embaixo, cinza: "Na folha cabem 7 corpos e 12 tampas".
  - O resumo mostra a conta com um exemplo: **"1 unidade = 1 corpo + 1 tampa · um pedido de 15 = 5 folhas (corpo 7 + 7 + 1 · tampa 12 + 3)"**. Hoje mostra "Este kit = 2 folhas (Corpo 1 · Tampa 1)", que não diz nada sobre o pedido.

### 212. Exemplo do nome do arquivo na lista de pedidos
- Acima da lista aparece "Arquivos em Exportações / hoje / Pedidos (ou LOTES) / **Liz-Gabriele_1ano_Moana-Baby_84un.pdf**", nome de outra cliente (o último gerado). A Naty gerou o Bento e achou que o arquivo tinha saído com o nome errado.
- **Esperado:** mostrar o nome do **próximo arquivo** a sair, com os pedidos selecionados (ex.: `Bento_2anos_Teste-Nutella_15un.pdf`), ou um exemplo genérico ("Nome_idade_Tema_quantidade.pdf"). Nunca o de outra cliente.

---

## P2

### 213. Cor por letra (estilo "MÁRIO JR.")
- A Naty tem temas em que **cada letra do nome tem uma cor** (ex.: Mário: azul, amarelo, vermelho, verde, com o mesmo contorno e 3D no nome todo).
- **Esperado:**
  - No estilo do texto: **"Cor: única / por letra"**.
  - **Por letra:** a usuária monta uma **sequência de cores**, e o MAE pinta letra por letra **repetindo a sequência**, em qualquer nome ("MÁRIO", "VALENTINA", "JOÃO PEDRO").
  - Opções: **pular espaços** (espaço não gasta cor), **começar da cor…**, **papel por letra** (além de cor).
  - Contorno, sombra, brilho e 3D continuam **iguais para o nome todo**.
  - Opcional, **"letras brincando"**: giro alternado leve e sobe/desce letra por letra, com controle de intensidade.
  - Vale para NOME, IDADE e "Nome + idade", e acompanha o auto-ajuste.

### 214. Elemento preso ao nome (o laço da Hello Kitty)
- A Naty tem temas com um **elemento preso ao nome** (ex.: o lacinho da Hello Kitty em cima da última letra de "Luisa").
- **Esperado:**
  - Ao inserir um elemento: **"Prender ao nome"**, com âncora: **na última letra**, **na primeira letra**, **no pingo do i**, **antes do nome**, **depois do nome**, **em cima/embaixo, centralizado**.
  - O elemento **acompanha o nome**: nome curto ou comprido, ele vai para a letra certa; e **diminui junto** quando o auto-ajuste encolhe o nome.
  - Posicionar pelo **topo real da letra**, não por uma altura fixa (em "Isabel", terminado em "l", o laço não pode afundar na letra).
  - Distância e giro em relação à letra ajustáveis uma vez no tema, valendo para todos os pedidos.
