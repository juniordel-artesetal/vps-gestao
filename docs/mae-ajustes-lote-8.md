# Módulo MAE — Ajustes do teste (Lote 8)

Testado pela Naty em 11 e 12/10/2026, depois da entrega dos Lotes 6 e 7. Este lote traz:
- **Parte A:** resultado do reteste dos Lotes 6 e 7.
- **Parte B:** itens novos (122 a 134), em sequência ao Lote 7 (que foi até o 121).

Prints citados estão com a Naty.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-8.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-8.md (reteste dos Lotes 6 e 7 e novos ajustes da
Naty no módulo MAE), docs/mae-ajustes-lote-6.md, docs/mae-ajustes-lote-7.md,
docs/mae-spec.md e docs/mae-progresso.md. Em modo plano, organize nesta ordem:
P1) 122 (Ctrl+Z universal), 123 (mover com o mouse + cadeado e olho em todas
    as camadas), 124 (logo atrás do nome), 125 (96 reaberto);
Estrutural) 126 (padrão esquerda = conjunto / direita = individual, sem
    ferramentas redundantes) — revise o sistema inteiro; 127 (campo TEMA
    editável sincronizado com o SOA) e 128 (campos vindos da base) — avalie o
    impacto no modelo de dados do pedido;
P2) 129, 130, 131, 132, 133, 134.
Comece pelo 122. Para cada item, diga quais arquivos mudam e como vamos
testar. Não implemente antes da minha aprovação. Ao fim de cada etapa, rode
os testes e registre em docs/mae-progresso.md o que foi feito, item por item.
```

---

## Parte A — Reteste dos Lotes 6 e 7

| Status | Itens |
| --- | --- |
| ✅ Funcionando | **Lote 6:** 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 97, 99, 100, 102, 104, 105, 106, 107, 108, 109, 111, 113, 114, 115 · **Lote 7:** 116, 117, 118, 119 |
| ⚠️ Parcial | 96 (item 125), 98 (item 129), 103 (item 124), 110 (item 130), 112 (item 131), Alt + clique (item 132) |
| ⏸️ Ainda não testado | 93, 94, 95 (precisam de pedidos de teste), 120, 121 (precisam de conta sem SOA) |

### Destaques
- **Rodada 1 do Lote 6 inteira no verde** (seleção e camadas, ajuste do pedido, tema por pedido, frase, papel sobre cor, transição, SVG com medida e furo, fecho superior, Ctrl+Z no Ajustar, nome no aplique).
- **88:** a Naty selecionou vários pedidos e trocou o tema de todos de uma vez.
- **117 – Lote de impressão:** 3 pedidos, **45 páginas em menos de 1 minuto, 21,8 MB**.
- **116:** o filtro de tema mostra o tema cadastrado no campo tema do pedido no SOA (exatamente o desejado).
- **Menu do botão direito em Camadas** (trazer para frente, enviar para trás, topo, fundo, excluir): ótimo.

---

## Parte B — Itens novos

## P1

### 122. Ctrl+Z universal (reaberto de novo)
- O Ctrl+Z **funciona às vezes**. A Naty testou várias vezes em ferramentas diferentes.
- **Regra:** **toda ação, em qualquer ferramenta, entra no histórico** e é desfeita com Ctrl+Z / refeita com Ctrl+Shift+Z e Ctrl+Y, igual às setinhas: mover, sliders (um passo ao soltar o mouse), efeitos, formas, logo, camadas (ordem, ocultar, cadeado), papéis, textos, pranchetas, moldes, Ajustar.
- Criar um **teste automatizado** que percorre as ações principais e confere que cada uma é desfeita.

### 123. Mover com o mouse + cadeado e olho em todas as camadas
- **Textos ainda não se movem arrastando na arte** (o nome não sai do lugar com o mouse). Todo objeto selecionado (texto, bloco Nome + idade, frase, elemento, aplique, forma, logo, moldurinha) se move arrastando, com setas do teclado para ajuste fino.
- **Cadeado e olho em todas as camadas**, sem exceção, no painel Camadas:
  - **olho** = ocultar/mostrar;
  - **cadeado** = travar: camada travada não se move, não se seleciona clicando na arte e não é excluída ("Item travado — destrave para editar").
- É o cadeado que protege o que a usuária não quer mexer por engano.

### 124. Logo atrás do nome (item 103 reaberto)
- **Duplicação:** ao inserir a logo, aparecem **duas** (uma dentro e outra fora da área). No **Nome + idade**, parece que cria uma para o nome e outra para a idade. Deve haver **uma logo só para o bloco inteiro**.
- **Clicar de novo na logo cria mais uma.** Não pode.
- A logo **não aparece em Camadas** e não dá para clicar nela para diminuir.
- Ao sair do painel Texto e voltar, **a edição da logo some**.
- **Esperado:** a logo é uma camada do texto (aparece em Camadas, junto do texto), entra **do tamanho do texto**, com o retângulo pontilhado da área do nome, e a edição volta sempre que o texto é selecionado.

### 125. Grupo com nome digitado não vincula (item 96 reaberto)
- "Renomear grupo" funcionou. Em "Digitar um nome", o nome é digitado mas **não fica vinculado** ao grupo.

## Estrutural

### 126. Padrão único: esquerda = conjunto, direita = individual (sem redundância)
**Problema:** ferramentas repetidas confundem. Exemplo: no texto, "Posição ↔ ↕" (embaixo de nome composto, não funciona) e "Subir/descer texto" fazem quase a mesma coisa em lugares diferentes. Também havia dois controles de tamanho (item 98).

**Regra para o sistema inteiro:**
- **Painel da esquerda = o conjunto:** o que vale para todas as caixas da parte / o tema todo (fonte, estilo, efeitos, papel, presets, apliques padrão).
- **Painel da direita = o selecionado, só nesta caixa:** posição, tamanho, giro, ordem, opacidade, excluir.
- **Mover = sempre com o mouse** (item 123) e setas. Sliders de posição saem dos painéis (exceto onde não há como arrastar).
- "Subir/descer texto" (linha de base, ajusta a letra dentro da linha) fica; "Posição ↔ ↕" sai.
- **Revisar todas as ferramentas** com essa regra e remover qualquer duplicata. Listar no progresso o que foi removido/movido.

### 127. Campo TEMA editável na linha do pedido, sincronizado com o SOA
- Hoje o tema do pedido no SOA aparece só como aviso ("TEMA 'MASHA E O URSO' não encontrado").
- O **TEMA vira campo editável** na linha, como NOME e IDADE, com o valor do campo tema do pedido no SOA. Caso real: a cliente comprou o tema Bosque, mas quer Jardim.
- **Editou na linha, atualiza no SOA** (e vice-versa).
- O seletor de **tema MAE** se preenche pela ligação salva (item 97). O aviso só aparece quando o tema ainda não tem arte ligada: "Masha e o Urso ainda sem arte → escolher" (escolha lembrada).
- Sem SOA (MAE avulso): o campo TEMA é interno.

### 128. Campos do pedido vêm da base do produto
- **Produto ≠ tema.** Ex.: "AGENDA ESCOLAR MINNIE ROSA" = **produto** agenda escolar + **tema** Minnie Rosa.
- **Quem define os campos é a base (o grupo ligado ao produto):** a base da agenda escolar tem NOME, SÉRIE, PROFESSORA → todo tema dessa base herda esses campos. A base da agenda normal só tem NOME.
- A célula CAMPOS da edição em massa mostra **só os campos que a base do produto daquele pedido usa**. Quem não vende etiqueta escolar nunca vê série/turno.
- **"+ Campo" na base:** a usuária cria qualquer campo (ex.: casamento → "PADRINHOS"), posiciona na arte, e ele passa a aparecer nos pedidos daquele produto. Sem tela extra de configuração.
- **Biblioteca de campos compartilhada:** campos com o mesmo nome valem entre bases. Se o pedido do SOA trouxer um campo "Série", ele cai no campo SÉRIE automaticamente.
- Campo usado pela arte e vazio no pedido → "faltam dados (SÉRIE)".
- Botão **"Colunas"** na edição em massa para **esconder** campos da visualização (só preferência de tela; padrão: mostrar tudo).

## P2

### 129. Tirar "Todas as caixas da parte" do tamanho/giro do texto (item 98)
- "Só nesta caixa" funcionou; "Todas as caixas da parte" não. No dia a dia a Naty ajusta **molde por molde**: **retirar** a opção "todas" desses controles (tamanho e giro do texto na direita). O tamanho do conjunto continua no painel da esquerda (item 126).

### 130. Preset proporcional ao tamanho do texto (item 110 reaberto)
- O controle **"Escala dos efeitos"** apareceu, mas o preset aplicado no nome pequeno da tag continua **grosseiro** (traçado 1,6 mm não diminuiu).
- Ao aplicar um preset, os efeitos devem ser **escalados automaticamente** pela proporção entre o tamanho do texto e o tamanho de referência do preset. O controle serve só para ajuste fino.

### 131. Formas: opacidade e brilho externo
- O slider de **opacidade não anda** (o valor muda, a bolinha fica travada).
- A opacidade age **só no papel de dentro da forma**; o rosa da forma continua aparecendo. Deve ser a opacidade da **camada inteira** (forma + papel + efeitos), mostrando o que está embaixo. Se fizer sentido, manter também "opacidade do preenchimento" separada, como no Photoshop.
- **Brilho externo** no modo **"borda"** não funciona (testado no máximo, cor contrastante). No modo **"centro"** funciona.

### 132. Atalho errado no menu do botão direito
- O menu de Camadas pelo botão direito ficou ótimo (é o caminho que a Naty usa no lugar do Alt + clique).
- O atalho exibido em "Criar máscara de corte (Ctrl+Alt+G)" não corresponde ao que acontece. Conferir todos os atalhos exibidos nos menus.
- **Alt + clique** na arte (selecionar a camada de baixo) ainda não funciona.

### 133. "Abrir tema" filtrado pela base
- Com uma base escolhida (ex.: tag), **"Abrir tema" mostra só os temas daquela base** (com opção "ver todos").

### 134. Lembretes de teste pendente (sem mudança de código)
- 93 (nome completo dividido, série, turno), 94 (composição Nutella), 95 (gabarito fixo + marca de registro) e 120/121 (MAE avulso + planilha da Shopee) ainda não foram testados. Se algo neles mudar por causa dos itens 126 a 128, avisar no progresso.
