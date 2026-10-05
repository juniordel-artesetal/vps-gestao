# Módulo MAE — Ajustes do teste (Lote 1)

Testado pela Naty em 05/10/2026, nas áreas Base, Tema e Editor. Ela continua testando; os próximos ajustes virão em novos lotes.

## Erros (corrigir primeiro)

### 1. "Só nesta caixa" ignorado ao arrastar papel com Shift
- **Onde:** Tema, ao arrastar um papel novo com Shift por cima de outro papel (o atalho para criar a transição com máscara).
- **O que acontece:** mesmo com "Só nesta caixa" selecionado, o papel novo entra em todas as caixas vinculadas àquela face.
- **Esperado:** com "Só nesta caixa" ativo, qualquer conteúdo novo (papel, elemento, máscara) entra só na caixa escolhida, como ajuste local.

### 2. Ctrl+Z não funciona na edição de máscara
- **Onde:** Editor, editando a máscara de um papel.
- **Esperado:** pincel, borracha, degradê e seleções feitos na máscara são desfeitos com Ctrl+Z e refeitos com Ctrl+Shift+Z, como no resto do editor.

### 3. Transição entre papéis: o papel de baixo não aparece
- **Onde:** Tema, ao aplicar degradê na máscara do papel novo para mesclar dois papéis.
- **O que acontece:** o degradê é aplicado, mas o papel de baixo não aparece.
- **Esperado:** o papel de cima some suavemente seguindo o degradê e revela o papel de baixo. Verificar se o papel novo está substituindo o antigo em vez de ficar numa camada acima, ou se a máscara está escondendo as duas camadas.

### 4. Nomes dos botões de prancheta trocados
- **Onde:** Base, barra superior.
- **O que acontece:** "Nova prancheta" cria uma nova área de trabalho, e "+ Folha" cria uma prancheta na mesma área.
- **Esperado:** renomear para **"Nova área de trabalho"** e **"+ Nova prancheta"**.

## Melhorias

### 5. Botão "Transição de papéis"
A transição suave entre dois papéis é marca registrada das artes da Naty e precisa de um caminho simples, além da máscara manual:
1. Na face, botão **"Transição"** → escolher o segundo papel.
2. Escolher a direção: de cima para baixo, de baixo para cima, da esquerda, da direita, do centro.
3. Controles deslizantes de **posição** (onde a transição acontece) e **suavidade**, com prévia em tempo real.
4. Por baixo, o sistema cria a camada do segundo papel com máscara em degradê. Quem quiser pode refinar com o pincel na máscara.
5. Respeita "Todas as caixas" × "Só nesta caixa", como os demais conteúdos.

### 6. Ferramenta "Moldurinha" (bordinhas internas nas faces)
Detalhe característico das artes da Naty (molduras dentro das faces, simples ou duplas). Hoje ela faz no Photoshop com deslocamento interno → demarcador → forma.
- Clicar na face → **"Moldurinha"**. Vinculada à parte inteira ou só naquela caixa.
- **Distância da borda:** controle deslizante em mm, com a moldura se movendo em tempo real.
- **Tipo de linha:** contínua ou **tracejada estilo pesponto**, com tamanho do traço e do espaço ajustáveis.
- **Espessura:** controle deslizante.
- **Cantos:** vivos ou arredondados, com controle do arredondamento.
- **Estilos:** cor, degradê e os mesmos estilos de camada do texto (traçado, sombras, brilhos, chanfro).
- **Várias molduras na mesma face** (moldura dupla).
- **Salvar como preset** para reaplicar em outros temas.
- Técnica: deslocamento interno do polígono da face com Clipper2, o mesmo recurso já usado na silhueta dos apliques.

### 7. Cor sólida como preenchimento da parte
Ao preencher uma parte, além de Papéis e Elementos, a opção **Cor**:
- seletor visual (tom e saturação);
- **conta-gotas** para pegar a cor de qualquer papel ou elemento da arte;
- campo de **hexa** (ex.: #F7A8C8);
- **paleta do tema**: cores usadas ficam salvas para reaplicar com um clique.
Funciona como um papel: aplicada na FRENTE, preenche todas as frentes (ou só a caixa escolhida).

### 8. Ajustar o tamanho do nome + aviso de que saiu da face
- **Controle deslizante** de tamanho e alças nos cantos da caixa de texto.
- **No tema:** muda o tamanho do nome em todas as caixas (ou só numa, com "Só nesta caixa").
- **No pedido:** ajuste só daquele nome, sem alterar o tema.
- **Aviso automático:** se o nome sair da face ou encostar numa linha de dobra ou de corte, fica com contorno vermelho e aparece "O nome passou da face na caixa MILK, revise". Na edição em massa, o pedido vai para "revisar".
- Vale também para IDADE e HASHTAG.

### 9. Controles visuais de transformação (identidade e textos)
Para logo, QR, @, NOME, IDADE e HASHTAG, inclusive no passo "Identidade" da base, a mesma caixa de transformação do Ctrl+T do Photoshop:
- **Girar:** alça de rotação no próprio elemento (com Shift, de 15° em 15°) + campo de ângulo para ajuste fino.
- **Tamanho:** controle deslizante no lugar de digitar número, e alças nos cantos mantendo a proporção.
- **Mover:** arrastar com o mouse; setas do teclado para ajuste fino.

### 10. Pranchetas livres na área de trabalho
Hoje as pranchetas ficam presas numa fila horizontal.
- Arrastar cada prancheta pelo título para qualquer lugar, com ímã para alinhar nas outras.
- Botão **"Organizar"**: em linha, em coluna ou em grade.
- A posição fica salva na base.

### 11. Orientação da prancheta (retrato ou paisagem)
- Ao criar uma prancheta, escolher tamanho (A4, A5, A6 ou personalizado) e **orientação**.
- Trocar a orientação de uma prancheta existente pelo menu rápido (item 12).

### 12. Menu rápido da prancheta
Ao clicar numa prancheta, uma barrinha de ícones aparece sobre ela:
- **Girar** (retrato ↔ paisagem);
- **Redimensionar** (A4, A5, A6, personalizado);
- **Duplicar**;
- **Excluir**, com confirmação "Excluir a prancheta e os moldes dela?" e possibilidade de desfazer com Ctrl+Z.

### 13. Atalhos de seleção no padrão do Photoshop
- **Ctrl+D:** desmarcar seleção
- **Ctrl+Shift+I:** inverter seleção
- **Ctrl+A:** selecionar tudo

### 14. Explicação em todos os botões (tooltips)
Ao passar o mouse em qualquer botão, uma janelinha com o nome da ferramenta, uma frase curta e simples do que ela faz e o atalho de teclado, se houver.
Exemplo: **"Fechar pontilhado** — junta as linhas tracejadas do molde para o sistema encontrar as faces."
