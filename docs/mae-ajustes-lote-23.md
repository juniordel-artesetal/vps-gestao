# Módulo MAE — Lote 23: melhorias pedidas no suporte (17/10)

Itens 266 e 267, em sequência ao Lote 22 (que foi até o 265). Vieram do primeiro dia de alunas usando o sistema e dos testes da Naty.

Regra de execução: um item de cada vez — plano com os arquivos que mudam → aprovação do Júnior → implementar → rodar todos os testes → publicar → conferir em produção com uma conta "só MAE" e uma conta SOA completa → registrar em `docs/mae-progresso.md` → só então o próximo. Nada fora do item da vez; se algo publicado quebrar, voltar a versão anterior na hora.

---

### 266. Barra da prancheta cobrindo o molde

**Problema:** na Base, a barra flutuante da prancheta (Girar, ↺, Tamanho…, Duplicar, Excluir, + NOME, + IDADE, + HASHTAG, + Nome + idade, + Sufixo (anos)) fica **por cima do molde** e esconde o topo das caixas, justo onde a aluna precisa clicar e conferir. A reclamação veio de uma aluna e foi confirmada pela Naty (print: prancheta 297 × 210 mm paisagem, zoom 43%).

**Esperado:**
- A barra **nunca fica por cima da arte nem do molde**: vai para fora da prancheta, acima da faixa laranja (297 × 210 mm · paisagem), ou para dentro da própria faixa laranja, numa linha só.
- Aparece só com a prancheta selecionada ou com o mouse em cima dela. Com várias pranchetas, só aparece a da prancheta ativa.
- Um botão recolhe a barra: fica só o ícone "⋯".
- Os botões + NOME / + IDADE / + HASHTAG / + Nome + idade / + Sufixo também ficam no painel da esquerda (etapa Nome e textos), para quem não acha a barra.

**Teste de aceite:**
- Com zoom de 43% e de 100%, o topo de todas as caixas aparece inteiro e clicável.
- A barra continua acessível em 1 clique.
- Com 2 ou mais pranchetas, uma barra não cobre a prancheta de baixo.

### 267. Tema pronto com PNG: vários arquivos, adicionar página e lista de bases

**Problema (teste da Naty, 17/10):**
- No passo **1. Arquivo** do Tema pronto, só dá para escolher **1 PNG**. Um kit tem uma página por caixa, então são vários PNGs.
- A Naty criou um tema pronto com 1 PNG (tema "dourado"), com "Base nova (uma prancheta por página)". Isso criou a base "teste" (teste png v1).
- Para acrescentar o 2º PNG, ela voltou em Tema pronto → Arquivo, mas a base "teste" **não aparece** em "Onde entra". Aparecem só: kit caixas e sacolas, KIT FESTA, Rótulo Nutella - ARTE PRONTA, Rótulo Nutella, Sacola P - ARTE PRONTA, TAG - ARTE PRONTA e tag teste.
- Resultado: um tema pronto que começou com PNG não tem como ser completado.

**Esperado:**
- **Vários PNGs de uma vez** no passo Arquivo, um por página. Entram na ordem do nome do arquivo, e a ordem pode ser ajustada arrastando as miniaturas.
- **"+ Adicionar página"** num tema pronto que já existe: sobe 1 ou mais PNGs (ou um PDF) e cria as pranchetas novas **na mesma base**, sem criar base nova. Também dá para **trocar o arquivo** de uma página.
- **"Onde entra"** lista **todas** as bases, inclusive as criadas por um tema pronto, com busca quando houver mais de 8.
- O PNG entra no tamanho real da folha (pelos dpi do arquivo). Se o tamanho não bater com a folha, o MAE avisa e pergunta se é para ajustar à folha.

**Teste de aceite:**
- Subir 3 PNGs de uma vez cria 3 pranchetas na ordem certa.
- Depois, "+ Adicionar página" com um 4º PNG cria a 4ª prancheta na mesma base, sem base nova.
- A base criada pelo tema pronto aparece em "Onde entra".
- Gerar um pedido desse tema sai com as 4 páginas, no tamanho certo.
