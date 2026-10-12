# Módulo MAE — Ajustes do uso real (Lote 9)

Encontrados pela Naty em 12/10/2026, **criando um projeto real do zero** (base "kit caixas e sacolas" + tema "TRANSFORMERS_KIT FESTA"). Itens 135 a 148, em sequência ao Lote 8 (que foi até o 134).

**Contexto importante:** no uso real, o editor ficou **lento** e **não dá para clicar e arrastar objetos direto na arte**. Isso pesa mais que qualquer outro item: é o que a usuária faz centenas de vezes por tema. Os itens 135 e 136 vêm antes de tudo.

**Relação com o Lote 8:** os itens 122 (Ctrl+Z), 123 (mover com o mouse, cadeado e olho) e 131 (opacidade) do Lote 8 tratam de parte disso. Se ainda não foram feitos, faça junto com 135 e 136. Se já foram, confira com os casos deste lote.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-9.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-9.md (problemas encontrados no uso real do MAE),
docs/mae-ajustes-lote-8.md, docs/mae-spec.md e docs/mae-progresso.md.
Em modo plano, organize nesta ordem:
P0) 135 (desempenho: redesenho de 4-5 s por mudança) e 136 (clicar e
    arrastar direto na arte, em tempo real) — junto com os itens 122, 123 e
    131 do Lote 8, se ainda não feitos. Meça antes e depois ("atualizado em").
P1) 148 (atalhos completos, padrão Photoshop), 137, 138, 139, 140, 141, 146;
P2) 142, 143, 144, 145, 147.
Comece pelo 135. Para cada item, diga quais arquivos mudam e como vamos
testar. Não implemente antes da minha aprovação. Ao fim de cada etapa, rode
os testes e registre em docs/mae-progresso.md o que foi feito, item por item.
```

---

## P0 — Sem isso o editor não serve para criar

### 135. Desempenho: o tema inteiro é redesenhado a cada mudança
- **Evidência:** o indicador "atualizado em" mostra **4385 ms, 4576 ms, 5031 ms** no tema do kit completo (9 pranchetas). Na tag (uma peça só) mostrava **104 ms**. Ou seja: cada pequena mudança redesenha **o kit inteiro**.
- **Sintoma:** mover, aumentar, girar, mexer em slider: **tudo lento**. O nome demora para sair do lugar; a usuária não vê onde ele ficou enquanto arrasta.
- **Esperado (técnicas padrão de editor profissional):**
  1. **Durante o arraste/redimensionamento, mover só a "foto" do objeto** (bitmap em cache, ex.: `node.cache()` do Konva ou camada de interação separada). Efeitos, recorte na face, arte inteligente e avisos "revise" são recalculados **uma vez, ao soltar**.
  2. **Redesenhar só o que mudou:** mudou o nome da milk → redesenha **só a milk** (não as 9 pranchetas). Render incremental por prancheta/caixa/objeto.
  3. **Imagens de proxy na tela:** papéis e elementos em alta resolução (300 dpi) só na exportação; na tela, versão reduzida ao tamanho visível (gerada uma vez e guardada).
  4. **Desenhar só o visível:** pranchetas fora da tela não são redesenhadas durante a edição.
  5. **Não atualizar o estado do React a cada movimento do mouse:** usar `requestAnimationFrame` / refs durante o arraste e gravar o estado (e o histórico do Ctrl+Z) ao soltar.
  6. Trabalho pesado no Web Worker (`mae-render`), sem bloquear a tela.
- **Metas de aceite:** arrastar com **60 quadros por segundo**, sem engasgo; "atualizado em" **abaixo de 200 ms** no tema TRANSFORMERS_KIT FESTA completo. A exportação continua com qualidade total.

### 136. Clicar e arrastar direto na arte (reforço do item 123 do Lote 8)
- **O que acontece:** elemento colocado na face **não se seleciona nem se move clicando na arte**; só pelo painel Camadas, o que deixa a criação lenta. O nome também se move com atraso.
- **Esperado:**
  - **Um clique** em qualquer objeto (texto, bloco Nome + idade, elemento, forma, logo, moldurinha) **seleciona na hora**.
  - **Clicou e arrastou, move junto com o mouse, em tempo real** (item 135).
  - Vale em **qualquer face**, inclusive em partes com **cenário contínuo** (a lateral da milk do teste é a parte CENÁRIO).
  - Só camada com **cadeado** fica parada.
- **Teste de aceite:** colocar 3 elementos e o nome numa face e reposicionar todos em menos de 10 segundos, só com o mouse.

## P1

### 137. Duplicar e mais de um elemento na mesma face
- **O que acontece:** na lateral da milk (parte CENÁRIO), não foi possível **duplicar** o elemento "Explosão Festiva de Estrelas" por nenhum caminho (Ctrl+D, Ctrl+C/Ctrl+V, botão direito, Alt + arrastar). Também **não entrou um segundo elemento** na mesma lateral; só funcionou arrastando direto para dentro da face.
- **Esperado:**
  - Arrastar o mesmo elemento da biblioteca **várias vezes** cria **várias cópias**, em qualquer face.
  - **Duplicar** por todos os caminhos: **Ctrl+J** (padrão Photoshop), **Ctrl+C / Ctrl+V**, **Alt + arrastar**, **botão direito → Duplicar** e botão no painel da direita (atalhos completos no item 148).
  - A cópia aparece **na mesma face, levemente deslocada**, já selecionada; é independente (tamanho, giro, espelho próprios).
- Verificar se o problema é específico de partes com **cenário contínuo**.

### 138. Espelhar
- Não existe a opção de **espelhar** (refletir) elementos.
- **Espelhar horizontal** e **espelhar vertical** no botão direito, no painel da direita e com atalho (ex.: Shift+H / Shift+V). Funciona em elementos, logo, formas, apliques e papéis.

### 139. Sliders travados e resposta lenta
- O slider de **opacidade** do elemento **não anda** (o valor muda, a bolinha fica parada) e o resultado **demora** para aparecer. Mesmo problema das formas (item 131 do Lote 8).
- **Todos os sliders** devem acompanhar o mouse na hora e mostrar a prévia em tempo real (item 135); o valor exato vai para o histórico ao soltar.

### 140. Brilho no modo "borda" não funciona (interno e externo)
- **Brilho interno** no modo **"borda"** (vermelho, 60%, 0,47 cm), aplicado no papel do triângulo da milk: nada aparece.
- **Brilho externo** no modo "borda" (formas, Lote 8 item 131): também não funciona.
- No modo **"centro"**, funciona. Corrigir o modo "borda" nos dois brilhos, em todos os tipos de camada (papel, elemento, forma, texto).

### 141. Painel dos efeitos não obedece o modo do topo
- O topo mostra **"Editando só: MILK / Só nesta caixa"**, mas o painel do efeito diz **"Estilos da camada (todas as caixas)"**. A usuária não sabe onde o efeito vai ser aplicado.
- O painel deve **seguir o modo do topo** e dizer claramente onde aplica ("só na MILK" / "em todas as FRENTES"), seguindo o padrão do item 126 do Lote 8 (esquerda = conjunto, direita = individual).

### 146. Cenário contínuo na Base: faces em branco e giro por face
- Com o **cenário contínuo ligado na parte FUNDO** (36 faces), no **Enquadramento** algumas faces ficaram **em branco** (topo da milk, sacola P, vão do cubo com alça), e o **giro por face não funciona** (FUNDO da pirâmide, lateral da sacola P).
- **Esperado:**
  - Nenhuma face fica em branco no Enquadramento.
  - Face que faz parte de um cenário contínuo: ao tentar girar, perguntar **"Esta face faz parte de um cenário contínuo. Girar o cenário inteiro ou separar a face?"**
  - Ao ligar o cenário contínuo, **destacar na arte quais faces foram juntadas**, para a usuária ver o efeito antes de seguir.
  - Na própria opção, avisar quando a parte é grande: "O cenário contínuo junta todas as faces vizinhas desta parte. Para juntar só algumas, crie uma parte própria (ex.: CENÁRIO MILK)."

## P2 — Simplificar (menos ferramentas, mais clareza)

**Princípio da Naty:** excesso de ferramentas confunde mais do que ajuda. Cada ferramenta nova substitui algo ou usa os mesmos controles que já existem; nada de painel paralelo.

### 142. Tirar "Logo" do Fundo do texto e criar "Agrupar"
- A "Logo" no Fundo do texto se mostrou confusa: duplica, não aparece em Camadas, aceita só uma área (a logo do Transformers tem uma faixa para o nome e outra para a idade, e a idade sumiu), e **"Sem fundo" não removeu a logo**.
- A Naty resolveu colocando a **logo como elemento** + NOME e IDADE posicionados em cima. Funcionou e ficou bonito.
- **Decisão:**
  - **Remover** a opção "Logo" do Fundo do texto. Ficam **Sem fundo** e **Faixa** (a faixa funciona muito bem).
  - Criar **Agrupar (Ctrl+G) / Desagrupar (Ctrl+Shift+G)**: selecionar vários objetos (Ctrl + clique na arte ou em Camadas) e agrupar. O grupo move, gira e redimensiona junto; aparece em Camadas como pasta, com olho e cadeado; dá para editar cada item dentro do grupo.
  - Temas que já usam "Logo" no fundo do texto: converter para logo como elemento + texto, agrupados.

### 143. Nome + idade com os mesmos controles do NOME
- No bloco **Nome + idade** não aparecem **Nome simples / Nome composto** nem **1 linha / 2 linhas**; por isso "José Sérgio" quebrou sozinho em 2 linhas.
- O bloco usa **os mesmos controles do NOME** (simples/composto, linhas, auto-ajuste, fonte, efeitos) + só o que é dele (posição da idade, tamanho da idade, espaço entre linhas, estilo próprio da idade).
- **Idade que não cabe não pode sumir em silêncio:** mostrar aviso ("idade não coube").

### 144. Aviso "revise" como ícone, não como caixa sobre a arte
- A caixa "Revise: O nome passou da face na caixa MILK…" fica **aberta por cima da arte** enquanto a usuária trabalha.
- Trocar por um **ícone pequeno ⚠️** junto do texto. Ao passar o mouse ou clicar, abre a mensagem e os botões (Diminuir 10% nesta caixa / Selecionar o texto). Na lista do painel, os avisos continuam listados.

### 145. Copiar e colar estilo (botão direito)
Ideia da Naty: copiar de um objeto e colar em outro tudo o que foi aplicado.
- **Botão direito** em qualquer objeto (texto, elemento, forma, moldurinha, papel, aplique):
  - **Copiar estilo**;
  - **Colar estilo** (aplica tudo o que for compatível);
  - **Colar estilo…** (escolher: efeitos · fonte e formatação do texto · cor/papel de preenchimento · opacidade e mesclagem · tamanho e giro).
- **Entre tipos diferentes, cola só o que faz sentido** (texto → elemento: efeitos sim, fonte não).
- **Efeitos colados se ajustam ao tamanho** do destino (mesma regra do preset proporcional, item 130 do Lote 8).
- Funciona com **vários objetos selecionados**, **entre caixas e entre temas**.
- Atalhos **Ctrl+Alt+C / Ctrl+Alt+V**; Ctrl+Z desfaz.

### 147. Painel mostra um texto diferente do selecionado
- A barra de cima mostrava **NOME**, enquanto o painel mostrava **"Estilos do NOME_IDADE"**. A usuária não sabe em qual texto está mexendo.
- Barra de cima, painel da esquerda, painel da direita e Camadas mostram sempre **o mesmo objeto selecionado**.

### 148. Atalhos de teclado completos, no padrão Photoshop (essencial para escala)
**Por quê:** atalho é o que dá velocidade na criação em escala. Quem vai usar o MAE vem do Photoshop; os atalhos devem ser **os mesmos do Photoshop** sempre que existir equivalente.

**Regras gerais:**
- Funcionam em **qualquer aba e ferramenta** (Base, Tema, Ajustar, Editor livre), sempre que fizer sentido.
- **Não disparam** quando o foco está num campo de digitação (aí Delete apaga letra, Ctrl+C copia texto etc.).
- Todo atalho que altera algo entra no **histórico do Ctrl+Z** (item 122 do Lote 8).
- **Menus e dicas (tooltips) mostram o atalho correto** de cada ação (hoje o menu mostra atalho errado, item 132 do Lote 8).
- Tecla **?** (ou botão "?") abre a **lista de atalhos**, pesquisável.
- Criar **teste automatizado** que dispara cada atalho e confere o resultado.

**Lista:**

| Ação | Atalho |
| --- | --- |
| Desfazer / Refazer | **Ctrl+Z** / **Ctrl+Shift+Z** e **Ctrl+Y** |
| Salvar / Salvar como… | **Ctrl+S** / **Ctrl+Shift+S** |
| Copiar / Recortar / Colar | **Ctrl+C** / **Ctrl+X** / **Ctrl+V** (cola na mesma posição da face/prancheta de destino) |
| Duplicar | **Ctrl+J** e **Alt + arrastar** |
| Copiar estilo / Colar estilo | **Ctrl+Alt+C** / **Ctrl+Alt+V** (item 145) |
| Excluir | **Delete** / **Backspace** |
| Selecionar tudo / Desselecionar | **Ctrl+A** / **Ctrl+D** (como no Photoshop) |
| Selecionar vários | **Ctrl + clique** / **Shift + clique** / arrastar retângulo |
| Camada de baixo (sob o cursor) | **Alt + clique** |
| Mover fino / Mover 10× | **Setas** / **Shift + setas** |
| Transformar (alças) | **Ctrl+T** |
| Redimensionar | alças; **Shift** = livre/proporcional (como no Photoshop atual); **Alt** = a partir do centro |
| Girar | alça de giro; **Shift** = de 15° em 15° |
| Espelhar horizontal / vertical | **Shift+H** / **Shift+V** (item 138) |
| Trazer para frente / Enviar para trás | **Ctrl+]** / **Ctrl+[** |
| Trazer para o topo / Enviar para o fundo | **Ctrl+Shift+]** / **Ctrl+Shift+[** |
| Agrupar / Desagrupar | **Ctrl+G** / **Ctrl+Shift+G** (item 142) |
| Máscara de corte | **Ctrl+Alt+G** |
| Travar camada (cadeado) | **Ctrl+/** |
| Ocultar camada | **Ctrl+,** |
| Zoom + / − | **Ctrl + +** / **Ctrl + −** e **Ctrl + roda do mouse** |
| Ajustar à tela / Tamanho real | **Ctrl+0** / **Ctrl+1** |
| Mão (navegar) | **Espaço + arrastar** |
| Esconder/mostrar painéis | **Tab** (já existe) |

---

## Ainda pendente de teste (sem mudança de código)
93, 94, 95 (precisam de pedidos de teste), 120 e 121 (conta sem SOA). A Naty segue criando o tema real; o que aparecer vai para o Lote 10.
