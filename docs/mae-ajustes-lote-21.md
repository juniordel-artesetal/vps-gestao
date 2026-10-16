# Módulo MAE — Lote 21: dia da live (sub-abas no Texto) + sugestões de 16/10

Pedidos da Naty em 16/10/2026, criando uma arte do zero no MAE no dia do lançamento. Itens 248 a 256, em sequência ao Lote 20 (que foi até o 247). A live é **hoje às 20h**.

Dois blocos:
- **Hoje, antes da live (248 a 253):** decisão da Naty, para usar na demo. Ordem do mais simples e seguro para o mais complexo; **cada item é publicado sozinho**, assim que estiver pronto e testado. Prazo final 16h: o que não estiver pronto e testado até lá fica para depois da live.
- **Fase 2 (254 a 256):** ideias maiores, planejar com calma.

> **Decisão do Júnior (16/10, por cima do doc):** fazer 248–253 de uma vez e publicar **num único push** no fim (o doc pedia um push por item). 254–256: só o plano.

---

## HOJE (antes da live, prazo 16h)

### 248. Sub-abas no painel Texto

**Problema:** o painel Texto tem muitas funções empilhadas e é preciso rolar muito para achar cada uma.

**Esperado:** quatro sub-abas fixas no topo do painel Texto (abaixo do seletor NOME / HASHTAG / IDADE / Nome + idade, que continua sempre visível). Os controles são os **mesmos de hoje**, só redistribuídos:

| Aba | Controles que vão para ela |
|---|---|
| **Conteúdo** | prévia (NOME, IDADE), hashtag, nome simples / composto (1 linha, 2 linhas, entrelinha, efeitos próprios do nome composto), Duplicar, Colocar em páginas, + NOME / + IDADE / + HASHTAG / + Nome + idade / + Sufixo |
| **Fonte** | fonte, tamanho, tracking, entrelinha, escalas, curva, glifos/alternativos, cor (Única / Por letra), letras brincando, Montar acentos, Trocar letra |
| **Efeitos** | estilos da camada (+ Efeito), escala dos efeitos, meus presets, Loja da Naty, fundo do texto (Sem fundo / Faixa / Logo), preencher com papel |
| **Enfeite** | prender um enfeite ao nome |

Regras:
- O painel **lembra a última aba** usada (por sessão).
- A barra de cima (Texto · NOME · Cor · Esq/Centro/Dir · Aa/AA/aa) continua como está.
- Avisos importantes ("Esta fonte não tem: í", "Revise: o nome passou da face") aparecem **em qualquer aba**, no topo do painel.
- Nada some: se um controle não couber claramente numa aba, vai para **Conteúdo**.

**Teste de aceite:**
- Cada controle que existe hoje no painel Texto está em uma das 4 abas e funciona igual.
- Trocar de aba não perde o que foi digitado nem a seleção.
- Salvar o tema e gerar um pedido saem idênticos a antes da mudança.
- Em tela de notebook (1366 × 768), as abas Fonte e Efeitos cabem com pouca ou nenhuma rolagem.

### 249. Acento falso da fonte (Montar acentos não age)
- Fontes cursivas de festa às vezes têm um "ú" (ou outra letra acentuada) **desenhado sem acento**. O MAE acha que a fonte tem a letra e não monta o acento. Resultado: nome sai sem acento.
- **Caso real:** tema **BOSQUE_KIT FESTA** (fonte cursiva). O aviso diz "Esta fonte não tem: í" (só o í), mas o ú da fonte sai sem acento. No **MARIO_KIT FESTA** (fonte Anton, sem nenhum acento) o "Montar acentos" funciona perfeito ("MARIA JÚLIA").
- **Esperado:**
  - Em "Montar acentos", uma lista de letras (á é í ó ú â ê ô ã õ ç e maiúsculas) para marcar as que o MAE **sempre monta**, mesmo que a fonte diga ter.
  - **Detectar sozinho:** se o desenho da letra acentuada for igual ao da letra sem acento (ex.: ú = u), tratar como letra faltando e avisar: "o ú desta fonte não tem acento, vou montar".
- **Teste de aceite:** tema Bosque com a prévia "Maria Júlia" e "Lívia" → os dois acentos aparecem, montados com a fonte escolhida em "Montar acentos".

### 250. Transição com cor e com elemento
- Hoje a "Transição de papéis" só aceita **outro papel** como 2º item ("Escolha o 2º papel"). Caso real: tema **URSINHO MARINHEIRO_KIT FESTA**, parte CENÁRIO MILK.
- **Esperado:**
  - No lugar de "Escolha o 2º papel", três abas: **Papel · Cor · Elemento**.
  - **Cor:** uma cor lisa entra por cima do papel atual com o mesmo degradê (direção, posição, suavidade). Ex.: âncoras desbotando para azul-marinho liso embaixo.
  - **Elemento:** nuvens, ondas, grama ou flores entram com a borda suave, presos à posição da transição. Ex.: ondas subindo do fundo da caixa.
  - Também **cor para cor** (degradê de duas cores, sem papel).
  - Vale para todas as faces da parte, com "Só nesta caixa" quando precisar.

### 251. Shift para selecionar várias partes não funciona
- No tema, Shift + clique em mais de uma parte/face não soma a seleção (fica só a última). Já foi pedido antes (multisseleção com Shift).
- **Esperado:**
  - Shift + clique soma; Ctrl + clique também (atalho do Photoshop). Clicar numa já selecionada tira da seleção.
  - Vale na folha (faces) e na lista de Partes.
  - Com várias selecionadas, soltar papel, cor ou elemento aplica em todas de uma vez; o painel mostra "3 partes selecionadas".

### 252. Brilho interno com máximo baixo
- Em Estilos da camada, o "Brilho interno" vai até 0,8 cm e fica fraco numa face grande (ex.: TRIANGULOVE do tema URSINHO MARINHEIRO, usado como moldurinha da face).
- **Esperado:**
  - Tamanho até pelo menos 3 cm (ou proporcional à face), com campo digitável além do fim do controle deslizante, como no Photoshop.
  - Acrescentar **Engasgar (choke)** 0–100% e **Contorno/suavizar**, para a borda ficar mais cheia e não só esfumada.
  - Rever com o mesmo critério os limites de brilho externo, sombra e traçado.

### 253. Travar elemento pelo botão direito
- Ao mexer num elemento, às vezes o clique pega o elemento errado. Hoje, para travar, é preciso ir na lista de camadas.
- **Esperado:**
  - No menu do botão direito do elemento na folha: **"Travar" / "Destravar"** (junto de Trazer para frente, Duplicar, Copiar estilo…). Atalho **Ctrl+L**.
  - Elemento travado não é selecionado nem arrastado pelo clique; o clique passa para o que está embaixo. Cadeadinho ao passar o mouse.
  - Destravar: botão direito em cima dele (o menu abre mesmo travado) ou pelo cadeado nas camadas.
  - Extra: botão direito → **"Selecionar o que está embaixo"** (ou Alt + clique), para pegar o elemento certo quando há vários empilhados.

---

## FASE 2 (planejar com calma)

### 254. Paleta do tema
- Na aba Cor, o MAE lê os papéis e elementos do tema e cria quadradinhos com os tons que já existem neles (5 a 8 cores principais + um tom mais claro e um mais escuro de cada).
- A paleta se atualiza quando entra papel ou elemento novo.
- Vale para cor do nome, contorno, faixa, formas e a transição com cor (250).

### 255. Aplicar papel e elemento sem arrastar
- Com muitos papéis e elementos, arrastar até cada face é cansativo e impreciso.
- **Esperado:**
  - Clicar na face (ou na parte na lista) e depois no papel: aplica. Ou o contrário.
  - Botão em cada papel: **"Aplicar em… [FRENTE ▾]"**, com as partes da base.
  - Painel de papéis maior / em tela cheia, com miniaturas maiores e busca.
  - Arrastar continua funcionando.

### 256. Painéis da lateral organizados (continuação do 248)
- **Busca de função** no topo do painel ("o que você quer fazer?"): digitar "acento", "contorno", "laço", "2 linhas" abre a aba certa e destaca o controle.
- **Blocos recolhíveis** dentro de cada aba, com o título sempre visível; os mais usados ficam abertos.
- O mesmo padrão de sub-abas em Papéis, Camadas e Base.
