# Módulo MAE — Ajustes do uso real (Lote 13)

Reteste dos **Lotes 11 e 12** feito pela Naty em 13/10/2026, **já na produção real** (pedidos Shopee de Masha e o Urso, Moana Baby e Rapunzel). Itens 175 a 186, em sequência ao Lote 12 (que foi até o 174).

⚠️ **Atenção, Ju:** dos Lotes 11 e 12, **só o 165 (Gerar em lote) e o 171 (Trocar letra) chegaram funcionando** na produção. Vários itens não apareceram na tela (busca nos temas, calendário, botão "Pedido sem nome", prévia de fontes, avisos de acento). Confira se tudo foi publicado e se o `docs/mae-progresso.md` não marcou como feito algo que não subiu.

## Comando para o Claude Code

```
Leia docs/mae-ajustes-lote-13.md, docs/mae-ajustes-lote-12.md,
docs/mae-ajustes-lote-11.md, docs/mae-spec.md e docs/mae-progresso.md.
Antes de tudo: compare o mae-progresso.md com a Parte A deste arquivo.
Vários itens dos Lotes 11 e 12 estão marcados como feitos mas não
aparecem em produção. Me diga, item por item, se foi implementado, se foi
publicado e por que não aparece.
Depois, em modo plano, organize nesta ordem:
P0) 175 (fundo branco atrás da MR não foi aplicado), 176 (limpar a idade
    que vem como texto: "1 ANO", "2 años"), 177 (nomes dos arquivos);
P1) 178 (edição completa do texto no Ajustar: faltam fonte e efeitos),
    179 (lembrar a troca de letra no tema + prévia das fontes),
    180 (avisos de letra faltando), 181 (busca nos temas),
    182 (calendário de data de envio), 183 (pedido sem nome e
    "aguardando dados"), 184 (primeiro ajuste vale para as outras caixas),
    186 (excluir tema — fazer antes do 181);
P2) 185 (área do texto: nascer do tamanho certo e mostrar o limite).
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes,
PUBLIQUE em produção, confira na URL de produção que a mudança aparece e
registre em docs/mae-progresso.md o que foi feito e publicado, item por item.
```

---

## Parte A — Reteste dos Lotes 10, 11 e 12

| Status | Item |
| --- | --- |
| ✅ | **171 Trocar letra:** o ê da Maitê mudou de fonte na arte, na miniatura, ao reabrir e no PDF. |
| ✅ | **165 Gerar em lote:** 1 PDF só, quantidades certas. (Nome do arquivo ainda errado → item 177.) |
| ✅ | **164 (Lote 10) Área × tamanho do texto:** separados. As laterais mudam só a área; o nome respeita largura e altura da área. |
| ✅ | **Tema vinculado fica lembrado:** escolhido uma vez, aplicou em todos os pedidos "MASHA E O URSO - KIT". |
| ✅ | Acentos certos em fonte que tem acento ("Maria Júlia", "#MariaJúliafaz1"). |
| ⚠️ | **172 Edição no Ajustar:** vieram só cor, alinhamento e maiúsculas/minúsculas. Faltam fonte e efeitos → item 178. |
| ❌ | **166 Fundo branco na MR:** não aplicado; aviso gigante continua → item 175. |
| ❌ | **170 Nome do arquivo:** → item 177. |
| ❌ | **172 Aviso de letra faltando** e **174 aviso na fonte do tema:** não aparecem → item 180. |
| ❌ | **173 Prévia das fontes:** a lista ainda mostra os nomes em letra comum → item 179. |
| ❌ | **167 Busca nos temas:** não apareceu → item 181. |
| ❌ | **168 Calendário de data de envio:** não apareceu → item 182. |
| ❌ | **169 Botão "Pedido sem nome":** não apareceu → item 183. |

---

## P0

### 175. Fundo branco atrás da marca de registro não foi aplicado (era o 166)
- **Teste:** Gerar em lote com Cecília (Masha e o Urso) → no PDF, caixa MALETA ALÇA: a **MR da lateral esquerda caiu em cima da estampa de florzinhas rosa**, sem quadrado branco. A câmera da plotter pode não ler.
- Na linha do pedido continua o aviso repetido 6 vezes, um parágrafo por prancheta ("A arte da prancheta 'PIRAMIDE' entra em 7 área(s) da marca de registro…").
- **Esperado (repetindo o 166):**
  - O MAE desenha **um quadrado branco atrás de cada MR** (tamanho da marca + folga, padrão 1 mm), em todo PDF gerado, de qualquer tema (pronto ou montado), em pedido único e em lote.
  - Com o respiro ligado, **o aviso some**.
  - Opção nas configurações de impressão: "Fundo branco atrás das marcas de registro" (ligado por padrão) + folga em mm.
  - Com o respiro desligado, aviso **resumido em uma linha** + "ver detalhes".
- **Teste de aceite:** gerar a Cecília → toda MR do PDF sobre fundo branco, inclusive a da lateral da MALETA ALÇA; a linha do pedido sem o aviso de MR.

### 176. Limpar a idade que vem como texto
- No SOA, a IDADE às vezes vem como texto: **"1 ANO"** (Liz Gabriele, #261013HGR9YF1S), **"2 años"** (Martina, #261013FBNTXV35), "2 aninhos", "1 ano".
- **Resultado hoje:**
  - hashtag **"#LIZGABRIELEFAZ1 ANO"** (o texto "ANO" entrou na hashtag e quebrou em 2 linhas);
  - arquivo **"LizGabriele_1ANOanos_…"**.
- **Esperado:**
  - O MAE pega **só o número** da idade ("1 ANO", "1 ano", "2 aninhos", "2 años", "3anos" → 1, 2, 3) e usa o número em todos os textos (IDADE, hashtag, sufixo "anos", nome do arquivo).
  - Se não achar número (ex.: "um ano"), avisa na linha: "revisar idade".
  - O campo IDADE na linha do pedido mostra o número limpo.
- **Teste de aceite:** Liz Gabriele com idade "1 ANO" → hashtag "#LizGabrielefaz1" (em 1 linha), IDADE "1", arquivo "LizGabriele_1ano_…".

### 177. Nomes dos arquivos (era o 170 e parte do 165)
- **Pedido único** saiu assim: `LizGabriele_1ANOanos_MOANABABY-KITFESTA_PEGUEEMONTEKitPersonaliz84`
  - nome sem separação ("LizGabriele");
  - idade com texto + "anos" ("1ANOanos", ver 176);
  - tema e título do produto da Shopee colados um no outro;
  - quantidade colada no fim, sem separador.
- **Lote** saiu assim: `LOTE_2026-10-13_PEGUE-E-MONTE-Kit-Personalizados-MASHA-E_24pag`. Leva o produto e o tema de um pedido só, apesar de a linha do pedido mostrar "LOTE_13-10_17h_2pedidos_96pag".
- **Esperado:**
  - Pedido único: `Liz-Gabriele_1ano_Moana-Baby_84un.pdf` (nome com hífen, idade limpa, tema curto, quantidade com "un"). **Sem o título do produto da Shopee.** Sem idade, o trecho some.
  - Lote: `LOTE_13-10_17h_2pedidos_96pag.pdf`, igual ao que a linha do pedido já mostra.
  - Se o nome ficar longo demais para o Windows, corta o tema, nunca o nome da criança.

---

## P1

### 178. Edição completa do texto no "Ajustar" do pedido (era o 172)
- Hoje, no "Ajustando só este pedido", ao clicar no NOME aparecem só **cor, alinhamento (Esq./Centro/Dir.) e Aa/AA/aa**.
- **Faltam:** **fonte**, **contorno, sombra, brilho**, papel no texto, espaçamento entre letras, entrelinha. É o mesmo painel da ferramenta Texto do editor de tema.
- **Regra (importante para a Naty):** tudo o que muda no Ajustar vale **só para aquele pedido** (é comum a cliente pedir outra cor ou fonte só no pedido dela). O tema padrão **só muda** se ela clicar em **"Usar este ajuste como padrão do tema"**.

### 179. Lembrar a troca de letra no tema + prévia das fontes (era o 173)
- **Caso real de produção:** há **duas Maitê** nos pedidos de Masha e o Urso (#26100963C9BWJF e #261013FW434XDC). Como a troca de letra é só por pedido, é preciso trocar o ê de novo em cada uma.
- **Esperado:**
  - No Trocar letra, opção **"Sempre usar esta fonte para o ê no tema"**. Vale automaticamente para todos os pedidos do tema (Maitê, Zoê, Renê…), com "voltar à do tema" por pedido.
  - **Prévia das fontes:** o menu atual é o seletor padrão do navegador, que só mostra texto comum. Trocar por uma **lista própria** em que cada fonte aparece escrita nela mesma (o "ê" grande e "Maitê" pequeno ao lado).
  - Prévia ao vivo ao passar o mouse; **"Só fontes que têm ê"** ligado por padrão; **busca** no topo; **recentes e favoritas** primeiro.

### 180. Avisos de letra faltando (eram o 172 e o 174)
- **Na edição em massa:** mesmo com o tema vinculado (masha e o urso_kit festa, fonte Jessica Justine), as duas Maitê **não mostram aviso**.
  - **Esperado:** "A fonte Jessica Justine não tem **ê** — Maitê", com botão **"Resolver"** (abre o Ajustar já no Trocar letra) e filtro **"Letra faltando"**. Se a troca já estiver definida no tema (item 179), o aviso não aparece.
- **No editor de tema:** ao escolher a Jessica Justine para o NOME, **nenhum aviso**.
  - **Esperado:** testar "á é í ó ú à â ê ô ã õ ç" (maiúsculas e minúsculas) e avisar "Esta fonte não tem: ê, …", sugerindo configurar a troca de letra no tema.

### 181. Abrir tema por busca rápida, no lugar da lista lateral (substitui o 167)
- Hoje o painel da direita mostra "Todos os temas (16)": uma lista de links com nomes centralizados e quebrados em 2 linhas, temas de teste misturados ("renomeando teste (cópia) (cópia) (v1)") e só o filtro "só desta base". Com 16 temas já é difícil achar um; com 100 fica inviável.
- **Não melhorar a lista: trocar por uma busca rápida** (no estilo do Ctrl+P do VS Code ou da busca do Canva).
- **Esperado:**
  - **Um campo só, "Buscar tema…"**, no lugar da lista do painel direito e do botão "Abrir tema". Atalho **Ctrl+O** abre a busca de qualquer tela do editor.
  - Digitou **qualquer parte do nome** ("pint", "masha sem", "sereia"), aparece uma **lista suspensa com até 8 resultados**. Ignora maiúsculas, acentos, "_" e "-".
  - **Cada resultado é um cartão:** **miniatura da arte** (primeira caixa do tema), **nome limpo em uma linha** com "…" e nome completo ao passar o mouse, **base** em letra pequena e **"editado há 2 h"**.
  - **Enter ou clique abre o tema.** Setas ↑↓ navegam, Esc fecha.
  - **Campo vazio:** mostra os **5 temas recentes**.
  - **"Só desta base"** vira um botãozinho dentro da busca, ligado por padrão quando há base aberta.
  - **"Ver todos os temas"** (link no fim da lista) abre uma **tela própria em grade de miniaturas**, onde ficam as ações de gerenciar: **renomear, duplicar, arquivar, excluir** (com confirmação; arquivado pode ser restaurado).
  - **A mesma busca** em todo lugar que escolhe tema: "Vincular tema…" e "Tema do pedido" na edição em massa.
  - A lista de arquivos do **Tema pronto** (painel "1. Arquivo") usa o mesmo componente de busca.
- **Teste de aceite:** com 16 temas, digitar "pint" → aparece "O MAIOR PINTOR DO MUNDO MENINA_KIT FESTA" com miniatura → Enter abre o tema. Campo vazio mostra os 5 recentes. Os "renomeando teste" podem ser arquivados na tela "Ver todos os temas" e somem da busca.

### 182. Filtro de data de envio com calendário (era o 168 — não subiu)
- A fila de filtros continua com Despacha hoje, Até amanhã, Atrasados, Sem tema vinculado, Com observação, Ajustado, + Tema, + Produto, + Status, + Canal, + Loja. **Sem calendário.**
- **Esperado (repetindo o 168):** chip **"+ Data de envio"** com calendário (um dia ou um período); quantidade de pedidos em cada dia; os atalhos atuais viram presets do calendário + "Esta semana" e "Próximos 7 dias"; "Salvar filtro" guarda a data relativa; a data usada é a data limite de postagem do SOA/Shopee.

### 183. Pedido sem nome e "aguardando dados" (era o 169 — não subiu)
- **Botão "Pedido sem nome" não apareceu.** Repetindo o 169: vincular a **versão sem nome** a cada tema (ex.: MASHA E O URSO → MASHA E O URSO_SEM NOME); botão **"Pedido sem nome"** na linha do pedido, que troca com um clique (e volta); filtro **"Sem nome"**.
- **Caso novo (print do pedido #2610070RKXA89B-p2):**
  - O SOA mandou no campo TEMA o texto **"AGUARDANDO DADOS"**, e o MAE tratou como nome de tema: "AGUARDANDO DADOS ainda sem arte → escolha o tema acima (fica lembrado)".
  - A observação diz "Veio: 'PEDI O NOME'" (a loja já pediu o nome à cliente).
- **Esperado:**
  - "AGUARDANDO DADOS" (e variações) **não é tema**. O MAE mostra um selo **"Aguardando dados da cliente"** na linha, não pede para escolher tema e **não "lembra"** esse valor como tema para outros pedidos.
  - "PEDI O NOME" significa **aguardando**, não **sem nome**: não sugerir a versão sem nome nesses casos.
  - Esses pedidos ficam fora do "Selecionar aprovados" e do Gerar em lote até chegarem os dados.
  - Filtro **"Aguardando dados"**.

### 184. O primeiro ajuste vale para as outras caixas (tema pronto)
- No tema pronto, depois de ajustar NOME, IDADE, HASHTAG (e outros campos) na primeira caixa (tamanho, área, cor, estilo), ao inserir esses campos nas próximas caixas eles **chegam já com o mesmo ajuste**.
- Depois, a Naty muda uma caixa ou outra individualmente ("só nesta caixa").
- Caixas de tamanhos diferentes: manter a **proporção** em relação à caixa, não o valor em cm.
- Botão **"Aplicar este ajuste às outras caixas"**, para repassar uma mudança feita depois.

### 186. Excluir tema (hoje não existe — fazer antes da busca do 181)
- A Naty **não consegue apagar** temas de teste e temas que errou e refez (ex.: "renomeando teste (cópia) (v1)", "renomeando teste (cópia) (cópia) (v1)", "teste (v6)", "CINDERELA_KIT FESTA (v4)" × "(v7)"). Eles poluem a lista e os seletores de tema da edição em massa.
- **Esperado (independente do 181, para sair já):**
  - **Excluir tema** pelo botão direito no nome do tema (e, depois do 181, na tela "Ver todos os temas"), com confirmação: *"Excluir 'teste (v6)'? Ele some da lista e dos seletores. Você pode restaurar em até 30 dias."*
  - Excluir apaga **o arquivo do tema na Biblioteca** (`Temas/….mae-tema.json`) **e as versões na nuvem**, para o tema não voltar ao recarregar.
  - **Testado em 13/10:** a Naty apagou os arquivos de teste da pasta Temas da Biblioteca e **eles continuaram na lista**. A lista vem da nuvem, não da pasta. Hoje não há nenhum caminho para remover um tema.
  - Se o arquivo local foi apagado mas o tema existe na nuvem, a lista deve mostrar isso (ex.: "só na nuvem") e oferecer **"Excluir da nuvem"** ou **"Baixar de novo"**.
  - **Lixeira por 30 dias** com "Restaurar".
  - Se algum **pedido estiver vinculado** ao tema, avisar quantos ("3 pedidos usam este tema") e pedir para escolher outro tema para eles antes de excluir.
  - **Seleção múltipla** para excluir vários de uma vez.

---

## P2

### 185. Área do texto: nascer do tamanho certo e mostrar o limite
- No tema pronto novo (Rapunzel), a área do NOME **nasce gigante de novo**. Dá para ajustar pelas laterais (✅ 164), mas é fácil esquecer e só descobrir no PDF.
  - **Esperado:** a área nasce pequena, em volta do texto, ou o MAE pede "Desenhe a área do NOME nesta caixa".
- Quando o texto **para de crescer** por causa da área, a Naty não entendeu o porquê (era a **altura** da área segurando).
  - **Esperado:** mensagem **"no limite da altura da área — aumente a área para o nome crescer"** (ou "da largura"), destacando o lado que está segurando; mostrar quanto o auto-ajuste encolheu ("encolhido para 82%").
  - Botão de prévia com **nome curto e nome longo** ("Ana" / "Maria Eduarda Beatriz"), para definir o tamanho vendo os dois casos.
