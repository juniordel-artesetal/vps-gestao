# Módulo MAE — Lote 22: cliente "só MAE" + ajustes de 16/10

Pedidos da Naty em 16/10/2026, dia do lançamento. Itens 257 a 265, em sequência ao Lote 21 (que foi até o 256). A live foi às 20h.

Dois blocos:
- **Antes da live (257 a 259), prazo 19h15:** itens pequenos e seguros. O 257 é o mais importante: garante que quem comprar hoje à noite consiga começar. **Cada item é publicado sozinho**, assim que estiver pronto e testado. O que não estiver pronto e testado até 19h15 fica para depois da live.
- **Depois da live (260 a 265):** fazer com calma, um de cada vez.

> **Registro:** o lote chegou às 21h59 de 16/10, depois do prazo de 19h15 e da live. Por isso todos os itens seguem a regra do "depois da live": um de cada vez, com plano e aprovação antes de cada um.

## Regra de execução

Para cada item:
1. Modo plano, com a lista dos arquivos que mudam.
2. Aprovação do Júnior.
3. Implementar.
4. Rodar todos os testes.
5. Publicar em produção sozinho.
6. Conferir na URL de produção com uma conta "só MAE" **e** com uma conta SOA completa. As duas precisam continuar funcionando.
7. Registrar em `docs/mae-progresso.md`.
8. Só então passar ao próximo.

Os itens 257, 258, 263 e 264 valem **só para o plano "só MAE"**: o fluxo de quem usa o SOA não pode mudar. Se um item publicado quebrar algo, volta-se a versão anterior na hora.

---

## Antes da live

### 257. Botões "Importar planilha" e "Novo pedido" podem sumir (cliente só MAE)
- Hoje a tela de Pedidos começa achando que a cliente é do SOA. Ela só mostra "Importar planilha" e "Novo pedido" depois de confirmar o plano. Se essa consulta falhar ou demorar, os botões não aparecem e a aluna nova fica travada (`EdicaoEmMassa.tsx`).
- **Esperado:**
  - Quando a confirmação do plano falhar, os botões aparecem mesmo assim (falhar aberto).
  - Enquanto carrega, os botões aparecem desabilitados com "carregando…", nunca escondidos.
- **Teste de aceite:**
  - Conta só MAE: os botões aparecem, inclusive simulando a falha da consulta.
  - Conta SOA completa: a tela continua igual a antes.

### 258. Textos que falam de "produto do SOA" para quem é só MAE
- Hoje a cliente só MAE vê mensagens que não consegue seguir:
  - Lista vazia manda ir em "Configurações → Campos do pedido", uma tela que ela não tem.
  - "Esta base não está ligada a nenhum produto do SOA — Ligue o produto", com a lista de produtos vazia (`EdicaoEmMassa.tsx`, `PainelGrupos.tsx`, `PainelFolhas.tsx`).
- **Esperado, só no plano só MAE:**
  - Lista vazia: "Nenhum pedido ainda. Importe a planilha da Shopee ou crie um pedido.", com os dois botões.
  - Aviso laranja de base sem produto: **não aparece**. No lugar, em Grupos/Folhas: "O kit é achado pelo nome do produto como vem na planilha."
  - Seletor "produto do SOA" nos Grupos: escondido.
- **Teste de aceite:**
  - Conta só MAE: nenhum texto fala em "produto do SOA" ou "Configurações".
  - Conta SOA completa: tudo igual a antes.

### 259. Trocar "Engasgar" por "Choke"
- No Brilho interno (item 252) e em qualquer outro efeito onde a palavra aparecer, usar **Choke**, o nome que as alunas conhecem do Photoshop. Só o texto muda; o valor salvo continua o mesmo.
- **Teste de aceite:** um tema salvo com Engasgar 50% abre mostrando Choke 50%.

---

## Depois da live

### 260. "A mesma caixa junta" separa tema pronto com marca no PDF
- **Caso real:** lote de 3 pedidos — Manuela, Ariel (2 pedidos, 84 + 18) e Benício, Heróis (30).
  - As caixas da Ariel saíram juntas por caixa (17 pirâmides, 17 maletas…).
  - As do Benício ficaram todas no fim, separadas, em vez de entrar junto das mesmas caixas da Ariel.
- **Causa provável:** as páginas do Benício vêm de um tema pronto com a marca de registro já desenhada no PDF, e o agrupamento é feito pelo arquivo da marca.
- **Esperado:**
  - Agrupar pela **caixa/molde** (PIRÂMIDE, MILK, CUBO…), também quando a marca veio no PDF do tema pronto.
  - Se a marca for diferente de verdade (outra máquina), avisar no resumo do lote: "2 grupos de marca: Ariel e Heróis não ficam juntos".
- **Arquivo de referência:** `LOTE_16-10_16h_3pedidos_132pag.pdf`.
- A Naty vai subir os temas prontos sem a marca, e isso vira regra nas aulas. Mesmo assim, o lote precisa se comportar bem.

### 261. Shift para selecionar vários elementos
- No reteste do 251, o Shift funcionou nas **faces**, mas não nos **elementos**.
- **Esperado:**
  - Shift + clique e Ctrl + clique somam elementos na seleção. Clicar de novo num elemento já selecionado tira ele da seleção.
  - Com vários selecionados: mover, escalar, alinhar, travar ou apagar todos de uma vez.
  - O painel mostra "3 elementos selecionados".

### 262. Salvar também em PNG
- Hoje o MAE só gera PDF.
- **Esperado:** opção **PDF ou PNG** na hora de gerar, no pedido e no lote.
  - PNG em 300 dpi, uma imagem por folha, com o pedido e a folha no nome do arquivo (ex.: `ARIEL_folha-01.png`).
  - Com várias folhas, sai um `.zip`.
  - Fundo **branco** ou **transparente**, à escolha.
  - A marca de registro sai no PNG, na mesma posição do PDF.

### 263. Quantidade editável no pedido (só MAE)
- Hoje não dá para corrigir a quantidade de um pedido já criado. O botão "Qtd." só reparte o total entre as caixas.
- **Esperado:** nos pedidos avulsos (importados ou manuais), a quantidade da linha é editável, também em massa. A mudança vale na próxima geração.

### 264. Planilha: colunas próprias, modelo genérico e canal (só MAE)
- **Colunas:** reconhecer **TEMA, NOME e IDADE** na importação. Hoje esses dados só saem da observação do comprador.
- **Modelo:** botão "Baixar modelo de planilha", com as colunas Pedido, Produto, Quantidade, Tema, Nome, Idade, Prazo, Observação e Canal. Serve para pedidos de Elo7, WhatsApp e site.
- **Canal:** escolher o canal na importação e no pedido manual (Shopee, Elo7, WhatsApp, Site, Outro). Hoje grava sempre "Shopee".
- A planilha da Shopee continua funcionando igual.

### 265. Conferências do plano só MAE
- Testar se o endereço `/pedidos` do SOA abre para a cliente só MAE. Se abrir, desviar para os pedidos do MAE (`middleware.ts`).
- No editor de imagem, esconder "Designs antigos (SOA Design)" para ela.
