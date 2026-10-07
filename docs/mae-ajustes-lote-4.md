# Módulo MAE — Ajustes do teste (Lote 4)

Testado pela Naty em 06/10/2026, depois da entrega dos Lotes 1, 2 e 3. Este lote traz:
- **Parte A:** resultado do reteste e pendências.
- **Parte B:** itens novos (38 a 52), em sequência ao Lote 3 (que foi até o 36).

Prints citados estão com a Naty.

## Comando para o Claude Code

```
Leia docs/mae-ajustes-lote-4.md (reteste e novos ajustes da Naty no módulo
MAE), docs/mae-spec.md e docs/mae-progresso.md. Em modo plano, organize a
correção pelas prioridades do arquivo:
P1) o que bloqueia o uso da edição em massa e dos Temas prontos (43, 44, 52, 50,
    47, 49, 41);
P2) pendências do reteste e itens de edição (21, 29, 30, 34, 51, 45, 46, 48,
    40, 42);
P3) layout (38, 39).
Para cada item, diga quais arquivos mudam e como vamos testar. Não implemente
antes da minha aprovação. Ao fim de cada etapa, rode os testes e registre em
docs/mae-progresso.md o que foi feito, item por item.
```

---

## Parte A — Reteste

| Status | Itens |
| --- | --- |
| ✅ Funcionando | 9, 10, 11, 15, 16, 19, 22, 25, 27, 28, 31, 32, 35, 36 |
| ⚠️ Parcial | 12 (ver 41), 21, 24 (ver 45), 26 (ver 43, 50, 51, 52) |
| ❌ Não funciona / não chegou | 29, 30, 34 |
| ⏸️ Não testado ainda | 17, 18, 23 |

### Detalhes das pendências

**21. Elementos dentro da face / "Pode vazar da face": ⚠️**
- ✅ Por padrão, os elementos ficam dentro da face, e a arte inteligente funciona.
- ❌ Com **"Pode vazar da face"** marcado, o elemento continua cortado no contorno da face (na tela). Esperado: com a opção ligada, o elemento aparece inteiro por cima da linha do molde, na tela e no arquivo exportado.

**26. Temas prontos: ⚠️**
- ✅ O cadastro existe (ícone "Tema pronto"), com os passos Arquivo → Páginas → Textos e salvar, e salva o tema.
- ❌ Não foi possível testar a geração em massa por causa dos itens 43 e 44.
- Faltam as funções dos itens 50, 51 e 52 no painel de texto do Tema pronto.

**29. Papel em padrão repetido: ❌**
Ao clicar no papel, não aparece a opção "Repetir (padrão)", nem tamanho do padrão, espelhar ou mover. Requisitos completos no Lote 3.

**30. Perguntar se quer salvar: ❌**
Clicar em "Nova base" com outra base aberta não perguntou nada. Esperado: **"Salvar as alterações em KIT FESTA antes de continuar?"**, com **Salvar · Não salvar · Cancelar**. Vale para Nova/Abrir base, Novo/Abrir tema e fechar a aba.

**34. Seleção múltipla de partes: ❌**
Não chegou. Requisitos completos no Lote 3 (Ctrl + clique, retângulo de seleção, Ctrl+A; aplicar cor, papel, moldurinha, estilos em todas de uma vez).

---

## Parte B — Itens novos

### P1 — Bloqueia o uso

### 43. Preencher NOME, IDADE e TEMA direto na lista da edição em massa
- **O que acontece:** os 116 pedidos aparecem como "faltam dados (NOME, IDADE) · tema não encontrado", e **não dá para clicar** neles. Nem num pedido de teste (#123) criado só para isso.
- **Esperado:**
  - Pedido com "faltam dados" **pode ser clicado** e abre a edição **na própria linha**: campos NOME, IDADE e um seletor de TEMA (lista dos temas prontos e dos temas do MAE).
  - Ao escolher o tema manualmente, perguntar: **"Usar este tema para todos os pedidos deste produto?"** (cria o vínculo produto ↔ tema).
  - Mostrar em cada linha o **nome do produto e a variação**, para a usuária saber qual é o tema.
  - Navegação rápida: **Tab** pula para o próximo campo; **Enter** salva e vai para o próximo pedido.
  - Preenchido, o alerta some e o pedido pode ser marcado para gerar.

### 44. Separar NOME e IDADE em campos individuais no pedido
- **Hoje:** existe um campo único "nome e idade", que a equipe preenche lendo o chat da Shopee.
- **Daqui para a frente:** dois campos, **NOME** e **IDADE**.
- **Pedidos antigos:** separar automaticamente o campo atual. O número vira IDADE e o resto vira NOME ("Isabella Costa 2 anos" → NOME: Isabella Costa · IDADE: 2). O que não der para separar com segurança vai para "revisar".
- **Como a Naty organiza os produtos (respondido):** o **produto** é o tipo de peça (Kit Festa de 6 caixas, Sacola P, Sacola G, Rótulo Pringles, Rótulo Nutella, Tag…), e **cada produto tem vários temas** (Ursinha, Sereia, Stitch…). O tema é a **variação** do produto (ou um campo TEMA do pedido).
- **Consequência para o vínculo:** a arte certa depende da **combinação produto + tema**, e não só do tema:
  - Kit Festa + Ursinha → `Temas/Kit Festa/Ursinha.pdf`
  - Sacola P + Ursinha → `Temas/Sacola P/Ursinha.pdf`
  - Rótulo Nutella + Sereia → `Temas/Rótulo Nutella/Sereia.pdf`
- **Sugestão de organização:** na pasta `Temas/`, uma **subpasta por produto**, com um arquivo por tema dentro. O sistema localiza a arte por **produto do pedido + tema da variação** (comparação ignorando maiúsculas e acentos). Se não achar, a usuária escolhe na linha (item 43) e o vínculo produto + tema fica salvo para os próximos pedidos.
- **No cadastro do Tema pronto (item 26):** além do nome do tema, escolher **a qual produto** ele pertence.
- **Pedido com vários produtos** (ex.: Kit Festa + Sacola P, mesmo tema): gerar **um arquivo separado por produto** (decisão da Naty: facilita a impressão).
- **Organização das exportações por produto:** `Exportações/AAAA-MM-DD/<Produto>/<Nome>_<Idade>anos_<Tema>.pdf`. Ex.: `Exportações/2026-10-06/Sacola P/AnaJúlia_5anos_Sereia.pdf`. Assim a equipe imprime de uma vez todas as sacolas do dia, depois todos os kits, e assim por diante.
- **Opção no lote:** "Juntar num PDF só **por produto**" (um PDF com todas as Sacolas P do lote, outro com todos os Kits Festa…), para mandar para a impressora de uma vez.

### 52. Replicar NOME, IDADE e HASHTAG entre as páginas do Tema pronto
- **O que acontece:** no Tema pronto, depois de criar o NOME numa página, não dá para copiar, colar ou replicar nas outras caixas.
- **Esperado:**
  - **Ctrl+C / Ctrl+V** em outra prancheta: cola com o mesmo estilo e posição relativa. **Ctrl+J** e **Alt + arrastar** duplicam. Arrastar entre pranchetas também.
  - Botão **"Colocar em todas as páginas"** no painel do texto: cria o NOME (ou IDADE, ou HASHTAG) em todas as pranchetas de uma vez, na mesma posição relativa.
  - Em cada prancheta, botões rápidos **"+ NOME · + IDADE · + HASHTAG"**.
  - Todas as cópias ficam **ligadas à mesma variável** (o nome do pedido aparece em todas).
  - **Estilo compartilhado** (fonte, efeitos; com "Só nesta caixa" se quiser diferente). **Posição, tamanho e rotação individuais** por caixa.

### 50. Nome simples × nome composto
Está na especificação (decisão 12) e não aparece no painel de texto (Tema pronto e MAE).
- Dois botões no painel do NOME: **"Nome simples"** e **"Nome composto"**, cada um com a sua configuração por caixa (tamanho, entrelinha, posição, efeitos).
- Em **Nome composto**, escolher **1 linha** ou **2 linhas**.
- Prévia com nome de exemplo em cada modo (ex.: "Isis" e "Ana Júlia").
- **Edição em massa:** 1 palavra usa a configuração de simples; 2 ou mais usa a de composto.
- **No pedido:** trocar só para aquele nome (ex.: forçar 1 linha).
- Quebra em 2 linhas mantém partículas com o segundo nome: "Maria" / "de Fátima".

### 47. Aplique NÃO pode sair impresso na caixa
- **O que acontece:** o elemento marcado como "É aplique 3D" (castelo, maleta coração) saiu impresso na face da caixa, além das folhas de aplique.
- **Esperado:** aplique sai **só** nas folhas de aplique (impressos e silhueta), **nunca** na arte da caixa.
- **Na tela,** continua visível na caixa para a usuária ver posição e composição, com indicador de aplique (ícone 3D ou contorno pontilhado) deixando claro que não vai ser impresso ali.

### 49. Janela de avisos antes de exportar: travada e cortada
- ✅ O aviso existe (detecta nome que passou da face etc.).
- ❌ A janela abre enorme, cortada, **sem rolagem**, **não fecha** e trava o sistema.
- **Esperado:**
  - Altura máxima de cerca de 70% da tela, com **rolagem**.
  - Fecha com **X, Esc e clique fora**.
  - Avisos **agrupados**, com resumo no topo ("3 nomes passaram da face · 1 prancheta sem marca").
  - Cada aviso com botão **"Ir até"** (fecha e seleciona a caixa com problema).
  - Rodapé fixo: **"Revisar"** e **"Exportar mesmo assim"**.

### 41. Girar a prancheta não leva os moldes junto e trava a orientação
- **O que acontece:** ao girar a prancheta (cubo com alça) para retrato, o molde continuou deitado e ficou fora da folha ("Ficaram fora da folha: CUBO COM ALÇA"). Depois, **não deu mais para voltar** a orientação da prancheta, e a página do cubo saiu errada no PDF.
- **Esperado:** ao girar a prancheta, os moldes giram 90° junto e se recentralizam. Se não couberem, perguntar **"Girar os moldes junto?"** (Sim / Só a folha). Girar de novo sempre funciona, nos dois sentidos.

### P2 — Edição e acabamento

### 51. Máscara de corte (papel dentro do texto ou do elemento)
Muito usada nos nomes (ex.: textura de glitter dentro do NOME, com traçado e sombra por cima). Precisa funcionar **no texto e em qualquer elemento**, no MAE e no Tema pronto.
- Criar com **Alt + clique** entre camadas, **Ctrl+Alt+G**, clique direito → **"Criar máscara de corte"**, ou botão **"Preencher com papel"** no painel do texto.
- Indicação na lista de camadas (setinha ↳ e recuo).
- Textura recortada pode ser movida e redimensionada.
- Efeitos do texto (traçado, sombra, chanfro) continuam por cima da textura.
- Na edição em massa, a textura acompanha o novo nome automaticamente.
- Presets de efeito podem incluir a textura.

### 45. Ícones Moldurinha e Transição abrem o mesmo painel
- **O que acontece:** os dois ícones abrem o painel de "Partes e camadas"; só muda uma frase de dica.
- **Esperado:** cada ícone abre **o painel da sua função**:
  - **Camadas:** partes + camadas da parte.
  - **Moldurinha:** distância, espessura, contínua/pesponto, cantos, cor, estilos e **lista de molduras salvas** com miniaturas.
  - **Transição:** segundo papel, direção, posição, suavidade, com prévia.
  - **Formas** (ícone próprio ou dentro de Elementos): retângulo, elipse, polígono, estrela, coração, linha, caneta.
- Os botões Transição, Moldurinha e + Forma **saem** do painel de Camadas.

### 46. Prévia ao vivo do aplique
Hoje, mexer na bordinha e no deslocamento da silhueta não mostra nada na tela. Não dá para avaliar proporção nem se a cor combina.
- No painel Apliques 3D, **miniatura do aplique selecionado** com bordinha e silhueta, atualizando na hora.
- Botão **"Ver folhas de aplique"**: mostra as pranchetas de impressos e silhuetas na área de trabalho antes de gerar.

### 48. Retrato ou paisagem nas folhas de aplique
Opção de orientação para as folhas de impressos e de silhuetas; a distribuição se ajusta à orientação.

### 40. Ferramentas de teste aparecendo para a usuária
- No painel direito do Tema: **"Gravar teste"**, **"Ler teste"**, **"Listar fontes instaladas"** e a lista completa de fontes do computador.
- Na Base: **cronômetro** ao lado de "Montar a base" (ex.: "2232:08").
- **Esperado:** remover. A troca de pasta da Biblioteca MAE vai para **Configurações** (ícone de engrenagem). A busca de fontes fica só dentro do seletor de fonte do painel de texto.

### 42. Menu da prancheta deixou de aparecer (investigar)
Em algum momento, clicar na prancheta parou de mostrar a barrinha (Organizar, Girar, Tamanho, Duplicar, Excluir). Não foi possível identificar o que causou; pode ter relação com o Ctrl+Z ou com o item 41.

### P3 — Layout

### 38. Recolher o menu principal do SOA
- Botão para recolher o menu lateral do SOA (só ícones ou escondido) e reabrir.
- No Método MAE, abrir já recolhido por padrão.
- Lembrar a escolha da usuária. Vale para o SOA inteiro.

### 39. Painéis do MAE no estilo Photoshop
Hoje o menu do SOA + a barra de ícones + o painel de opções ocupam quase metade da tela.
- **Barra de ferramentas fina** na esquerda, só ícones (com tooltip), sempre visível.
- **Barra de opções no topo:** as opções principais da ferramenta escolhida numa faixa horizontal acima da arte.
- **Painel da direita** (propriedades e camadas) **recolhível**.
- Atalho **Tab** esconde e mostra todos os painéis, deixando só a arte.
