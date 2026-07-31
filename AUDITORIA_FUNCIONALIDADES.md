# Pente-fino de funcionalidades — VPS Gestão (base para a Sofia 3.0)

> Relatório da Fase 1. Foco nas NOVIDADES que a Sofia ainda não conhece. Para cada item:
> **onde fica · o que faz · como funciona · erros comuns**. Este documento alimenta a base
> de conhecimento (Fase 2) e deve ser versionado e atualizado a cada novidade.

## 1. Custos fixos + Lucro real
- **Onde fica:** `/precificacao/custos-fixos` (flag `PrecCustosFixos.ativo`, OFF por padrão).
- **O que faz:** 2º modelo de precificação. Além da margem de contribuição (preço − custo variável),
  rateia os **custos fixos** (aluguel, energia, internet, **pró-labore**, depreciação) sobre cada peça,
  revelando o **lucro real** (contribuição − custos fixos).
- **Como funciona:** métodos de rateio = **por unidades**, **por horas**, **por faturamento** ou **manual**.
  Ao ligar, o preço passa a embutir o custo fixo rateado.
- **Erros comuns:** pró-labore lançado como mão de obra (conta 2×); preço "sobe" depois de ligar
  (esperado — agora inclui o fixo); método de rateio incoerente com o negócio.

## 2. Canais de venda + taxas
- **Onde fica:** `/precificacao/canais` e `/precificacao/meus-canais` (flags `moduloCanais` /
  `canaisLancaFinanceiro`, OFF por padrão). Catálogo Master em `/master/canais-catalogo`.
- **O que faz:** calcula a **receita líquida** por canal (Shopee, TikTok, Mercado Livre, Amazon, site
  próprio), descontando a taxa do canal por **faixa/categoria**.
- **Como funciona:** catálogo de taxas por faixa (ex.: TikTok 10% < R$50; Shopee 20% + R$4). A artesã pode
  **ajustar** a taxa do canal. ML tem **taxa fixa por peso** (precisa cadastrar o peso).
- **Erros comuns:** ML "sem peso" → taxa fixa não aplica (cadastrar peso); confundir preço de canais
  diferentes (cada um tem taxa própria).

## 3. Concluir pedido → receita líquida automática
- **Onde fica:** botão **Concluir** no pedido (workflow de produção / expedição).
- **O que faz:** ao concluir um pedido pago, lança a **receita líquida** no Financeiro (já descontada a
  taxa do canal), com a data conforme o meio (Pix D+0, cartão D+2).
- **Erros comuns:** achar que precisa lançar a receita na mão (não precisa); concluir sem querer
  (dá pra desfazer).

## 4. Módulo COMPRAS (Supply)
- **Onde fica:** grupo **Compras** no menu (flag `moduloCompras`): **Visão geral · Fornecedores ·
  Pesquisar preço · Pedido de compra · Histórico · Ofertas & Cupons**.
- **O que faz:** gestão de insumos. **Pedido de compra 3-em-1** = gera contas a pagar + atualiza o custo
  do material + dá entrada no estoque. **Histórico** com evolução de preço. **Visão geral** (volume,
  fornecedor top, material que mais pesa, nº de compras). **Pesquisar preço** (IA/índice crowd).
- **Como funciona:** o pedido pergunta se o custo mudou e propaga para os produtos (resync). Compra
  fiado/prazo vira contas a pagar. Comparação com mercado sinaliza "boa compra".
- **Erros comuns:** não ligar o módulo (some do menu); esquecer de marcar "custo mudou".

## 5. Plano de contas gerenciais + DRE
- **Onde fica:** `/financeiro/categorias` (árvore conta > subconta) e `/gestao/dre` (também no menu
  **Financeiro → DRE**).
- **O que faz:** organiza receitas/despesas por **conta e subconta**; o **DRE** mostra os grupos
  (receita, CMV, despesas) organizados.
- **Como funciona:** contas/subcontas editáveis pela artesã. Lançamento sem conta cai em "Sem categoria"
  (não some dos totais). CMV = custo da mercadoria vendida.
- **Erros comuns:** achar que precisa de conta pra tudo bater (os totais não dependem de conta).

## 6. Multi-canal por produto
- **Onde fica:** botão **"Lojas"** no produto (Precificação → Produtos); **selo do canal** (CanalBadge).
- **O que faz:** publica/precifica o mesmo produto em **várias lojas** de uma vez; cada loja mostra o
  preço ajustado pela sua taxa.
- **Erros comuns:** ML "sem peso" (cadastrar peso); achar que precisa copiar a variação por loja (o
  multi-canal propaga).

## 7. Ofertas & Cupons (vitrine de parceiros)
- **Onde fica:** Master publica em `/master/promocoes`; artesã vê em **Compras → Ofertas & Cupons**
  (`/promocoes`).
- **O que faz:** cards de ofertas de parceiros de insumos (logo, desconto, título, link, cupom).
- **Erros comuns:** oferta inativa/expirada não aparece (esperado).

## 8. Reconciliação financeira (Visão Geral × Entradas e Saídas)
- **O que faz:** os cards da Visão Geral e a lista de Entradas/Saídas usam a **mesma regra**:
  **realizada = pago/recebido**; **a receber/pagar = em aberto**, no mesmo mês.
- **Erros comuns:** somar pendentes junto com realizados (não bate) — corrigido.

## 9. Status PRONTO no workflow
- **Onde fica:** workflow de produção (`lib/statusPedido`).
- **O que faz:** renomeia CONCLUÍDO → **PRONTO**; regra única de "entregue/enviado".

## 10. Menu em 4 posições + Hub de módulos
- **Onde fica:** Sidebar (posições) e `/modulos` (hub por role). Menu Financeiro agora reúne DRE + Análise IA.
- **O que faz:** menu configurável em 4 posições, com destaque do módulo ativo; hub central de módulos.

---
_Este relatório é a fonte da Fase 2 (base de conhecimento gold-standard) e da Fase 3 (ferramentas
financeiras + conselhos). Atualizar a cada novidade lançada._
