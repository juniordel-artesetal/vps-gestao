# Módulo MAE — Ajustes do uso real (Lote 12) — URGENTE

Encontrados pela Naty em 13/10/2026 na produção real: pedido #2610107WXRMG01, tema **masha e o urso_kit festa** (tema pronto), NOME **"Maitê"**, fonte **Jessica Justine**, que **não tem "ê"**. Itens 171 a 174, em sequência ao Lote 11 (que foi até o 170).

⚠️ **Urgente:** nome com acento em fonte sem acento acontece todo dia na produção, e hoje não há como resolver dentro do MAE.

## Comando para o Claude Code

```
Leia docs/mae-ajustes-lote-12.md (URGENTE — trava a produção real),
docs/mae-ajustes-lote-11.md, docs/mae-ajustes-lote-10.md (item 163,
montar acentos), docs/mae-spec.md e docs/mae-progresso.md.
Este lote passa na frente dos itens P1/P2 dos Lotes 10 e 11.
Em modo plano, organize nesta ordem:
P0) 171 (Trocar letra não aplica a fonte nem salva) — comece por aqui,
    descubra onde a escolha se perde (renderização, ajuste do pedido,
    miniatura, PDF) e corrija o caminho inteiro;
P1) 172 (edição completa do texto no Ajustar do pedido + aviso de letra
    faltando na fonte), 173 (prévia das fontes nos seletores);
P2) 174 (conferir acentos ao escolher a fonte do tema).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes,
confira que o desempenho não piorou e registre em docs/mae-progresso.md o
que foi feito, item por item.
```

---

## P0

### 171. "Trocar letra" não aplica a fonte nem salva
- **Passo a passo:** Pedidos (massa) → pedido #2610107WXRMG01 → **Ajustar** ("Ajustando só este pedido") → NOME "Maitê" → **Trocar letra: M a i t ê** → cliquei no **ê** → escolhi **Lavanderia** na lista.
- **O que aconteceu:**
  1. O seletor mostrou "Lavanderia", mas **o ê continuou na fonte anterior** (Jessica Justine) na arte.
  2. Cliquei em **"Salvar ajuste do pedido"** (apareceu "ajuste salvo ✓") e voltei para a edição em massa: **a alteração não estava lá.**
- **Provável:** a escolha muda só o controle da tela. Não chega na renderização do texto nem no ajuste salvo do pedido.
- **Esperado:**
  - Só o **ê** passa para a fonte escolhida. O resto do nome continua na fonte do tema.
  - A letra trocada se ajusta ao nome: **mesma altura visual, mesma linha de base**, cor, papel e efeitos do texto (contorno, sombra, brilho).
  - Vale **na arte na hora**, no **"Salvar ajuste do pedido"**, na **miniatura da edição em massa**, ao **reabrir** o pedido e no **PDF gerado**.
  - Se a troca for feita no tema (não só no pedido), vale para todos os pedidos daquele tema.
- **Teste de aceite:** "Maitê" na Jessica Justine com o ê em Lavanderia → aparece na tela → salvar → voltar para a lista (a miniatura mostra a troca) → reabrir (continua) → gerar o PDF (sai trocado). Repetir com "Zoê" e "Renê".

---

## P1

### 172. Edição completa do texto no "Ajustar" do pedido + aviso de letra faltando
- Hoje, no "Ajustando só este pedido", dá para mover, mudar o tamanho, girar e trocar letra. Não dá para **mudar a fonte, a cor nem os efeitos** do texto. No caso da Maitê, se o Trocar letra não resolver, não há saída.
- **Esperado:**
  - Clicou num texto (NOME, IDADE, HASHTAG) no Ajustar, abre o **mesmo painel da ferramenta Texto** do editor de tema: fonte, cor, papel, contorno, sombra, brilho, espaçamento entre letras, entrelinha.
  - Tudo vale **só para este pedido**, com o fluxo que já existe: "Salvar ajuste do pedido", "Voltar ao padrão" e "Usar este ajuste como padrão do tema".
- **Aviso de letra faltando, antes de gerar:**
  - Se o nome (ou a hashtag) tem uma letra que a fonte não tem, a **linha do pedido na edição em massa avisa**: "A fonte Jessica Justine não tem **ê** — Maitê", com botão **"Resolver"** que abre o Ajustar já no Trocar letra.
  - **Filtro "Letra faltando"** na fila de filtros, para achar todos esses pedidos de uma vez.
  - Hoje só se descobre olhando a arte ou o PDF.
- **Conecta com o item 163 do Lote 10** (montar o acento automaticamente). Quando ele existir, o caso da Maitê se resolve sozinho e o aviso vira só conferência.

### 173. Prévia das fontes nos seletores
- A lista de fontes do Trocar letra (e do editor) mostra os nomes em letra comum ("Komika Title - Axis", "Kunstler Script", "Lavanderia"…). Não dá para ver como a fonte fica antes de escolher.
- **Esperado (em todo seletor de fonte do MAE):**
  - **Cada fonte aparece escrita nela mesma.** No Trocar letra, mostrar a **própria letra** ("ê" grande) em cada fonte, com o nome do pedido ("Maitê") pequeno ao lado.
  - **Prévia ao vivo na arte:** passou o mouse numa fonte, a letra muda na arte. Clicou, confirma. Saiu sem clicar, volta como estava.
  - No Trocar letra, **"Só fontes que têm ê"** ligado por padrão, escondendo as que também não têm a letra.
  - **Busca** no topo da lista (a lista já é enorme; só Komika Title tem 12 variações).
  - **Recentes e favoritas** no topo.
  - **Lembrar a troca no tema:** opção "Sempre usar Lavanderia para o ê nesta fonte", aplicando sozinha nos próximos pedidos (Maitê, Zoê, Renê…).

---

## P2

### 174. Conferir os acentos ao escolher a fonte do tema
- Muitas fontes script vêm em versão grátis ou demo **sem acentos**. A usuária só descobre no primeiro pedido com acento.
- **Esperado:** ao escolher a fonte do NOME/HASHTAG no editor de tema, o MAE testa **"á é í ó ú à â ê ô ã õ ç"** (maiúsculas e minúsculas) e avisa: "Esta fonte não tem: ê, õ, ç". Sugere configurar a troca de letra (171/173) ou o acento montado (163) já no tema.
