# Módulo MAE — Lote 20: Central de Ajuda (tutorial + perguntas) e página de vendas

Pedido da Naty em 15/10/2026, véspera do lançamento (live sexta 16/10, 20h, YouTube). Itens 246 e 247, em sequência ao Lote 19 (que foi até o 245). **Não são correções do editor**: são duas páginas novas.

Arquivos que vão junto (em `docs/`):
- `mae-central-de-ajuda.md` (especificação detalhada da Central, item 246);
- pasta `guia-referencia/` (o guia ilustrado `guia-metodo-mae.html` + 23 prints em `img/`, com nomes de clientes já escondidos onde precisava).

> **Decisões do Júnior (15/10, por cima deste doc):** o site em `usesoa.com.br/mae` (caminho, não subdomínio), publicado já, **com os preços já divulgados** (sem a chave `MAE_PRECOS_VISIVEIS`). Planos: só o MAE mensal e anual; SOA + MAE mensal e anual (a soma dos dois); e a troca do SOA mensal para o anual. O plano "Aluna Método MAE ou VPS" (R$ 49,90) ficou fora (não há como o checkout conferir quem é aluna).

---

## P0

### 247. Página de vendas do Método MAE no SOA

**Objetivo:** uma página pública (sem login), para onde a Naty manda o link na live, nos grupos e no direct. Ela explica o módulo, mostra o resultado e leva à assinatura.

**Onde:** uma rota pública do SOA, curta e fácil de falar em live (sugestão: `usesoa.com.br/mae`). Botão "Método MAE" também no site do SOA.

**Regras da página:**
- Funciona perfeito no **celular** (a maioria vem do Instagram e do WhatsApp).
- Carrega rápido; prints e vídeos leves.
- Sem pop-up, sem contagem regressiva falsa, sem "últimas vagas". Assinatura não tem promoção nem bônus (decisão da Naty): o argumento é valor.
- Visual do SOA, com o laranja da marca. Prints reais do sistema (pasta `guia-referencia/img`).
- Cada botão de compra leva ao checkout do plano certo: [PREENCHER: links de checkout dos 3 planos].
- Rastrear cliques nos botões (para a Naty saber de onde veio a venda), se o SOA já tiver isso.
- **Preços:** a Naty revela na live. Deixar a seção de preços pronta, atrás de uma chave (ex.: variável de ambiente ou flag `MAE_PRECOS_VISIVEIS`); antes da live mostra "Preço revelado na live de sexta, 20h", depois mostra os planos. A Naty liga a chave na hora.

**Estrutura e copy (usar como está):** ver a página publicada (`app/mae/page.tsx`) — seções 1 a 10: Topo, A dor, A virada, O que você ganha, A conta, Para quem é, Quem criou, Planos, Perguntas frequentes, Fechamento.

**Teste de aceite (247):**
- Abre sem login, em `usesoa.com.br/mae` (ou a rota escolhida), no computador e no celular (400 px, sem rolagem lateral).
- Todos os botões levam ao lugar certo; nenhum `[PREENCHER]` aparece na página publicada.
- Com a chave desligada, os preços não aparecem; ligando, aparecem os 3 planos sem precisar publicar de novo.
- Prints carregam rápido (comprimidos, com `loading="lazy"`).

---

## P1

### 246. Central de Ajuda do Método MAE (tutorial + perguntas frequentes com busca)

Especificação completa em `docs/mae-central-de-ajuda.md`. Resumo:
- **Onde:** dentro do SOA (menu Método MAE → "Como usar", e o botão "?" do editor) e com uma versão pública para quem ainda não assina (a página de vendas linka para ela).
- **Conteúdo:** todo o guia de referência, sem perder nenhum passo, print ou dica: 00 Antes de começar → 01 Base de caixas → 02 Tags, rótulos e etiquetas → 03 Marca de registro e corte → 04 Criar um tema → 05 Tema pronto → 06 Pedidos e edição em massa → 07 Gerar, imprimir e cortar → 08 Regras de ouro → Perguntas frequentes (15) → Glossário.
- **Fácil de atualizar:** um arquivo Markdown por artigo, com frontmatter (título, seção, resumo, palavras-chave, vídeo, telas, data). A Naty atualiza pedindo ao Claude Code.
- **Busca:** ignora acento e maiúscula, tolera erro de digitação, entende sinônimos ("MR", "cortou torto", "saiu 1", "gêmeas"); registra buscas sem resultado.
- **Ajuda contextual:** o "?" de cada etapa do editor abre o artigo daquela etapa.
- **Videoaula:** player do YouTube no topo do artigo quando houver link.

**Teste de aceite (246):** os do item 8 de `docs/mae-central-de-ajuda.md`.
