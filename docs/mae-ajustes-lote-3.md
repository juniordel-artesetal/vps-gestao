# Módulo MAE — Ajustes do teste (Lote 3)

Testado pela Naty em 05/10/2026 (noite). Este lote traz:
- **Parte A:** o resultado do reteste do Lote 1 e o que ficou pendente.
- **Parte B:** os itens novos (27 a 36), numerados em sequência ao Lote 2 (que vai até o 26).

O Lote 2 (itens 15 a 26) já foi enviado e ainda não foi retestado.

## Comando para o Claude Code

```
Leia docs/mae-ajustes-lote-3.md (reteste do Lote 1 + novos ajustes da Naty),
docs/mae-spec.md e docs/mae-progresso.md. Em modo plano, organize a correção
nesta ordem:
1) Pendências do Lote 1 (Parte A: itens 9, 10 e 12);
2) Erros do Lote 3: 32 (prioridade alta), 31, 36, 35;
3) Melhorias: 28, 27, 34, 30, 29.
Se ainda estiver trabalhando no Lote 2, diga como encaixar este lote sem
conflito. Para cada item, diga quais arquivos mudam e como vamos testar.
Não implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes
e registre em docs/mae-progresso.md o que foi feito, item por item.
```

---

## Parte A — Reteste do Lote 1

| Status | Itens |
| --- | --- |
| ✅ Funcionando | 1, 2, 3, 4, 5, 7, 8, 13, 14 |
| ⚠️ Parcial | 6, 9, 11 |
| ❌ Não chegou | 10, 12 |

### Pendências

**6. Moldurinha: ⚠️**
A função ficou ótima (fácil e intuitiva) e o preset salvo funciona pelo seletor "Molduras salvas…". Ficou pendente o erro de estilo de camada, detalhado no **item 32**.

**9. Transformar logo, QR e textos: ⚠️**
- ✅ Mover funciona (mouse e setas). Os controles deslizantes de tamanho funcionam.
- ❌ **As alças do mouse não respondem:** nem as bolinhas dos cantos (redimensionar) nem o círculo de cima (girar). Detalhe no item 28.
- ❌ **Falta controle de Rotação no painel de texto.** O painel tem Tamanho, Tracking, Entrelinha, Escala horizontal/vertical, Linha de base e Curva, mas não tem girar. Nos elementos o controle de Rotação existe; levar o mesmo para **NOME, IDADE, HASHTAG, logo e QR**: de −180° a 180°, com campo numérico (item 27) e botão para voltar a 0°.

**10. Pranchetas livres: ❌**
- ❌ **Arrastar as pranchetas não funciona.** Continuam presas na fila.
- ⚠️ **O "Organizar" só existe na aba Base.** Esperado:
  - arrastar e Organizar (linha, coluna, grade) disponíveis em **todas as abas** (Base, Tema, Imagem);
  - **a arrumação é a mesma** em todas as abas;
  - a posição é **só de visualização**: não muda nada no arquivo exportado.

**11. Retrato ou paisagem: ⚠️**
- ✅ Dá para criar pranchetas em retrato e em paisagem, e a barra de status mostra as medidas certas (210 × 297 e 297 × 210).
- ⏸️ A exportação com orientações misturadas não deu para testar por causa do item 36. Testar de novo depois.

**12. Menu rápido da prancheta: ❌ (prioridade)**
Não chegou. Hoje **não há como excluir uma prancheta** a não ser desfazendo. Ao clicar numa prancheta, mostrar a barrinha de ícones:
- **Girar** (retrato ↔ paisagem);
- **Redimensionar** (A4, A5, A6, personalizado);
- **Duplicar**;
- **Excluir**, com confirmação "Excluir a prancheta e os moldes dela?" e Ctrl+Z para desfazer.

---

## Parte B — Novos itens

### Erros

### 32. Estilo de camada desfaz a moldurinha (prioridade alta)
- **O que acontece:** ao aplicar o efeito **Traçado** na moldurinha, a moldura **inteira se desfaz**. Ela vira faixas grossas e escuras nas laterais e é cortada por uma linha reta horizontal no meio da face (teste numa face triangular).
- **Provável causa:** a moldurinha já é uma linha (um traçado). O efeito Traçado parece estar substituindo a linha da própria moldura ou sendo aplicado sobre uma caixa retangular (área do elemento), em vez de contornar a linha existente.
- **Esperado:** qualquer efeito (traçado, sombra, brilho, chanfro, degradê) acompanha **exatamente o formato da linha da moldura** em qualquer face (retângulo, triângulo, coração), sem cortes. O Traçado contorna a linha por fora e/ou por dentro, criando a moldura com contorno característica das artes da Naty.
- **Verificar também:** sombra, brilho e chanfro na moldurinha, para saber se o problema é só do Traçado ou de todos os efeitos.

### 31. Ctrl+Z e Ctrl+Shift+Z em todas as ações
- **O que acontece:** criar uma prancheta só é desfeito pela setinha de voltar no topo. O Ctrl+Z não funciona nesse caso.
- **Esperado:** o Ctrl+Z faz **exatamente o mesmo** que a setinha de voltar, em **qualquer** ação: criar, mover e excluir prancheta, mover molde, editar partes, papéis, elementos, textos, máscaras, estilos. Refazer: **Ctrl+Shift+Z** e **Ctrl+Y**, iguais à setinha de avançar.
- **Pedido:** um atalho global único, ligado ao mesmo histórico das setinhas, em vez de atalhos espalhados por ferramenta.

### 36. "Nova área de trabalho" dentro do Tema está confusa (erro de conceito)
- **O que acontece:** no Tema, "Nova área de trabalho" abre pranchetas em branco, mas o painel da direita continua mostrando o tema anterior ("teste", Base: KIT FESTA v3), com papéis e partes. Não dá para saber o que está aberto, e a única forma de voltar para a arte foi o Ctrl+Z.
- **Raiz:** três conceitos misturados (área de trabalho, base e tema). Cada aba deve ter só os seus botões:

| Aba | Botões no topo | Regra |
| --- | --- | --- |
| **Base** | Nova base · Abrir base (item 35) · + Nova prancheta | Pranchetas e moldes são criados **só aqui**. |
| **Tema** | Novo tema (escolhe a base) · Abrir tema | As pranchetas **vêm da base**; não se cria prancheta solta no Tema. |
| **Imagem** | Novo design · Abrir design · + Nova página | Editor livre. |

- **"Nova área de trabalho" sai** do Tema e da Base.
- **Nome do que está aberto sempre visível no topo.** Ex.: **"Tema: Ursinha Princesa · Base: KIT FESTA v3"**.
- **Voltar ao trabalho anterior** por "Abrir tema" (com a lista de recentes), nunca pelo Ctrl+Z. Trocar de trabalho pergunta se quer salvar (item 30).

### 35. Abrir uma base já criada para editar
- **O que acontece:** na aba Base não existe opção para abrir uma base salva e editar.
- **Esperado:**
  - Botão **"Abrir base"** com a lista das bases salvas: nome, miniatura, número de moldes e data da última edição.
  - Na base aberta: adicionar ou remover moldes, corrigir faces e partes, mover posições de nome e identidade, trocar a marca de registro.
  - Na lista: **Duplicar** e **Excluir** (com confirmação).
- **Temas ligados à base:**
  - Ao salvar a base, avisar: "Esta base é usada em 5 temas. As mudanças vão valer para eles."
  - Se surgir uma face nova sem conteúdo, o tema avisa: "1 face nova sem papel".
  - Pedidos já gerados não mudam, porque guardam a versão usada.

### Melhorias

### 28. Alças de transformação funcionando com o mouse
As bolinhas e o círculo laranja já aparecem em volta dos elementos, textos, logo e QR, mas não respondem. Comportamento esperado (padrão do Ctrl+T do Photoshop):
- **Bolinhas dos cantos:** arrastar aumenta ou diminui, mantendo a proporção. Com **Alt**, a partir do centro.
- **Bolinhas do meio das laterais** (se houver): esticam só a largura ou só a altura.
- **Círculo laranja de cima:** arrastar gira. Com **Shift**, de 15° em 15°.
- **Cursor** muda conforme a ação (setas de redimensionar, seta curva de girar).

### 27. Campo numérico ao lado de todo controle deslizante
- Ao lado de **cada** controle deslizante do sistema (tamanho do texto, tracking, entrelinha, rotação, bordinha, silhueta, moldurinha, sobra da arte inteligente, opacidade, posição, escala…), uma caixinha para digitar o valor exato, com a unidade (pt, mm, %, °).
- Controle e número sincronizados: mexeu num, o outro acompanha.
- Na caixinha, **setas ↑↓** mudam o valor de 1 em 1 (com Shift, de 10 em 10).

### 34. Seleção múltipla de partes e faces
- Selecionar várias com **Ctrl + clique**, **arrastando um retângulo** com o mouse ou **Ctrl+A**.
- Aplicar em todas de uma vez: **cor sólida, papel, moldurinha, preset de moldurinha, estilos de camada, transição de papéis, opacidade**.
- O painel mostra **"3 partes selecionadas"**.
- Depois de aplicado, cada parte continua editável sozinha.

### 30. Perguntar se quer salvar antes de trocar de trabalho
Ao abrir outra base, tema ou design (ou fechar a aba do navegador) com alterações não salvas: **"Salvar as alterações em KIT FESTA antes de continuar?"**, com os botões **Salvar · Não salvar · Cancelar**.

### 29. Papel em padrão repetido (para a textura não ficar gigante)
- **Problema:** um papel quadrado esticado numa face comprida (pirâmide, triangulove) fica com a estampa enorme e deformada.
- No papel, a opção **"Preencher"** (como é hoje) ou **"Repetir (padrão)"**, lado a lado como azulejo.
- No modo Repetir:
  - **tamanho do padrão** (com campo numérico);
  - **"Espelhar repetição"**, para disfarçar a emenda em papéis que não foram feitos para repetir;
  - **mover o padrão** dentro da face.
- O tamanho do padrão fica **igual em todas as faces da parte**, para a estampa ter a mesma escala em todas as caixas do kit.
