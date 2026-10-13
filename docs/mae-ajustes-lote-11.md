# Módulo MAE — Ajustes do uso real (Lote 11)

Encontrados pela Naty em 13/10/2026, usando **temas prontos** (Masha e o Urso, Ursinhos Carinhosos, Moana — versões com e sem nome) e o **Gerar em lote** com pedidos reais da Shopee. Itens 165 a 170, em sequência ao Lote 10 (que foi até o 164).

## Comando para o Claude Code

```
Leia docs/mae-ajustes-lote-11.md, docs/mae-ajustes-lote-10.md,
docs/mae-spec.md e docs/mae-progresso.md. Se ainda houver itens do Lote 10
em aberto, mantenha a prioridade deles (P0 do Lote 10 vem antes do P1 deste
lote). Em modo plano, organize nesta ordem:
P0) 165 (Gerar em lote não gera 1 PDF único — quebra a função principal);
P1) 166 (fundo branco automático atrás das marcas de registro + aviso de MR
    resumido), 167 (busca e organização da lista de temas), 168 (filtro de
    data de envio com calendário);
P2) 169 (versão "sem nome" do tema), 170 (nome do arquivo exportado).
Comece pelo 165. Para cada item, diga quais arquivos mudam e como vamos
testar. Não implemente antes da minha aprovação. Ao fim de cada etapa, rode
os testes, confira que o desempenho não piorou e registre em
docs/mae-progresso.md o que foi feito, item por item.
```

---

## P0

### 165. Gerar em lote não gera 1 PDF único
- **Teste:** 2 pedidos aprovados de temas diferentes (Masha e o Urso, 24 pág., e Ursinhos Carinhosos, 12 pág.) → **Gerar em lote (2)** → ordem "Por modelo" + "Intercalar temas iguais" + "Imprimir identificação" + "Separar por produto" + "Até 10 pedidos por arquivo".
- O modal promete: *"Um PDF só para imprimir de uma vez, cada pedido já nas quantidades de cada caixa."*
- **O que aconteceu:** saíram **arquivos separados, um por pedido**, cada um na pasta do seu produto (`Exportações / hoje / Produto / …`). Como o nome do produto da Shopee já leva o tema ("PEGUE E MONTE Kit Personalizados MASHA E O URSO"), pareceu "separado por tema".
- **Causa provável:** o Gerar em lote obedece ao seletor da barra de cima, que só tem duas opções: **"1 PDF por pedido e produto"** e **"1 PDF por folha"**. Não existe opção "tudo junto", então o lote nunca consegue cumprir o que o modal diz.
- **Esperado:**
  - O **Gerar em lote ignora o seletor de cima** (que vale só para o "Gerar selecionados") e gera **1 PDF com todos os pedidos selecionados**, cada um na sua quantidade, na ordem escolhida (por pedido / por modelo + intercalar).
  - Abre um novo arquivo **a cada X pedidos**, conforme o campo "pedidos por arquivo".
  - **"Separar por produto"** só separa **kit × tag** (papéis diferentes) em PDFs diferentes. Nunca separa pedido nem tema.
  - Salva tudo numa pasta só, fora das pastas de produto: `Exportações / hoje / LOTES / LOTE_13-10_10h_2pedidos_36pag.pdf`.
  - Quando o lote mistura temas, o nome do arquivo **não leva o tema de um pedido só** (hoje sai "…PEGUE-E-MONTE-Kit-Personalizados-MASHA-E_24pag").
  - Se o seletor de cima estiver numa opção diferente, o modal avisa: *"No lote, sai 1 PDF único com todos os pedidos."*
- **Teste de aceite:** os 2 pedidos acima → **1 arquivo de 36 páginas** na pasta LOTES, na ordem por modelo, cada pedido na sua quantidade e com a identificação na margem.

---

## P1

### 166. Fundo branco automático atrás das marcas de registro
- Na linha do pedido, o tema pronto mostra este aviso **7 vezes, um parágrafo por prancheta** (MILK, CUBO, MAL ALÇA, TRIANGULOVE, MAL CORAÇÃO, PIRAMIDE…): *"A arte da prancheta 'X' entra em 7 área(s) da marca de registro — a câmera da máquina pode não ler a marca."*
- O risco é real: quando a arte vai até o canto da folha, a MR do MAE fica por cima da estampa e a câmera da plotter pode não ler.
- **Esperado:**
  - O MAE desenha **um quadrado branco atrás de cada MR** (tamanho da marca + folga em volta), sempre, em **qualquer tema** (pronto ou montado no editor). A arte pode ir até a borda; o MAE limpa só a área da marca.
  - Com o respiro ligado, **o aviso some**, porque o problema deixa de existir.
  - Opção nas configurações de impressão: **"Fundo branco atrás das marcas de registro"** (ligado por padrão) e **folga em mm** (padrão: 1 mm).
  - Com o respiro desligado, o aviso volta, mas **resumido em uma linha**: *"⚠ A arte invade a área da MR em 7 pranchetas"* + **"ver detalhes"**, que abre a lista.
- **Contexto:** a Naty já faz as MRs no Photoshop com um quadrado branco atrás. O script dela, que prepara os temas prontos, agora troca cada MR por um quadrado branco no mesmo lugar. Com o respiro no sistema, isso passa a valer para qualquer usuária, sem depender do PSD.
- **Para o ensino do sistema:** *"Pode fazer a arte até a borda. O MAE limpa o cantinho da marca de registro pra você."*

### 167. Busca e organização da lista de temas
- Em "Todos os temas" (painel Tema, à direita), a lista já tem 10 temas e vai crescer muito. Sem busca, fica difícil achar o tema.
- **Esperado:**
  - **Barra de pesquisa** no topo da lista, filtrando enquanto digita. Ignora maiúsculas e acentos e acha por qualquer parte do nome ("moana" acha "MOANA BABY_KIT FESTA"; "sem nome" traz todos os temas sem nome).
  - **A mesma busca** no "Abrir tema…" e no seletor de tema da edição em massa ("Vincular tema…" e "Tema do pedido").
  - **Ordem:** usados recentemente primeiro, depois ordem alfabética.
  - **Filtro "só desta base"**, ligado por padrão quando há uma base aberta.
  - **Nomes alinhados à esquerda, em uma linha**, com "…" no fim e o nome completo ao passar o mouse. Hoje, nomes longos aparecem centralizados e quebrados em 2 linhas ("Ursinhos carinhosos TRADICIONAL_SEM NOME_KIT FESTA (v3)").
  - **Excluir / arquivar tema** direto na lista (botão direito ou ícone), com confirmação. Hoje temas de teste ("renomeando teste (cópia) (cópia)", "teste (v6)") se misturam com os temas reais. Arquivado some da lista e pode ser restaurado.
  - A lista de arquivos do **Tema pronto** (painel da esquerda, "1. Arquivo") ganha a mesma busca quando passar de 10 arquivos.

### 168. Filtro de data de envio/postagem com calendário
- Na edição em massa, os filtros rápidos (Despacha hoje, Até amanhã, Atrasados) não permitem escolher um dia ou período específico.
- **Esperado:**
  - Chip **"+ Data de envio"** na fila de filtros, abrindo um **calendário**.
  - Seleciona **um dia** ou **um período** (clica no início e no fim).
  - Cada dia do calendário mostra a **quantidade de pedidos** daquele dia (ex.: "14 → 23"), para ver os picos e planejar a semana.
  - Os atalhos atuais (**Despacha hoje, Até amanhã, Atrasados**) viram presets desse mesmo filtro: clicar em "Até amanhã" marca o período no calendário. Novos atalhos: **"Esta semana"** e **"Próximos 7 dias"**.
  - **"Salvar filtro"** guarda a data **relativa** ("próximos 3 dias"), não fixa, para o filtro salvo não vencer no dia seguinte.
  - A data usada é a **data limite de postagem** que já vem do SOA/Shopee.
  - Avaliar um segundo filtro igual para a **data da festa**, útil para pedidos vindos de fora da Shopee.

---

## P2

### 169. Versão "sem nome" do tema
- Alguns clientes não mandam nome. Para esses pedidos, a Naty tem uma arte específica, com a logo do tema no lugar do nome e sem idade nem hashtag.
- **Hoje funciona assim (testado):** criar o tema "X_SEM NOME" (tema pronto) e escolher esse tema na linha do pedido. O PDF **sai normalmente**, com o aviso "faltam dados (NOME, IDADE)". **O aviso pode continuar**: a Naty prefere que o sistema lembre que o nome está faltando, desde que não trave a geração.
- **Esperado (para agilizar):**
  - Cada tema pode ter uma **"Versão sem nome"** vinculada (ex.: MASHA E O URSO → MASHA E O URSO_SEM NOME).
  - Botão **"Pedido sem nome"** na linha do pedido: troca para a versão sem nome com um clique (e volta, se o nome chegar depois).
  - Quando o pedido chega da Shopee **sem nome preenchido**, sugerir a versão sem nome: *"Este pedido veio sem nome. Usar MASHA E O URSO_SEM NOME?"*
  - **Filtro "Sem nome"** na fila de filtros, para ver esses pedidos de uma vez.

### 170. Nome do arquivo exportado: "Idadeanos" colado
- O padrão mostrado é `Exportações / hoje / Produto / Nome_Idadeanos_Tema_Quantidade.pdf`. "Idade" e "anos" saem colados.
- **Esperado:** `Valentina_5anos_Moana_24.pdf` (ou `Valentina_5_anos_…`). Sem idade, o trecho some, sem sobrar "_anos_".
