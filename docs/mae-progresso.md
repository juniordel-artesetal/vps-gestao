# Progresso — Módulo MAE (SOA Edition local-first)

Atualizado pelo Claude Code ao fim de cada sprint: o que foi feito, decisões técnicas, pendências e como testar.

---

## Sprint 1 — Fundações · concluída em 04/10/2026

**Pronto quando:** abre uma A4 vazia, grava e lê um arquivo da pasta e lista as fontes instaladas. **Atingido** (testes automáticos e de tela abaixo; falta o teste manual do Ju com pasta e fontes reais).

### O que foi feito

| Peça | Onde | O que faz |
| --- | --- | --- |
| mae-schema | `lib/mae/schema/` | Schemas Zod da base, do tema e da prancheta, fiéis aos exemplos da spec; tudo em mm; caminho de arquivo sempre relativo à Biblioteca (recusa `..` e caminho absoluto). |
| mae-render | `lib/mae/render/` | Unidades mm ↔ px (A4 a 300 dpi = 2480 × 3508), viewport (Ajustar, Tamanho real com calibração, zoom no cursor) e `desenharPrancheta` — o **motor único** que a tela já usa e a exportação vai usar. |
| mae-editor | `lib/mae/editor/` | Histórico por patches do Immer (desfazer/refazer, teto de 500 passos) + store Zustand. Zoom e posição da vista não entram no histórico. |
| Biblioteca MAE | `lib/mae/biblioteca/` | Escolher a pasta (`showDirectoryPicker`), lembrar dela no IndexedDB, reconectar com 1 clique, criar as 10 pastas da spec, gravar, ler, listar e calcular SHA-256. |
| Fontes locais | `lib/mae/fontes/` | Lista as fontes instaladas (`queryLocalFonts`) agrupadas por família; trata permissão negada; detecta navegador sem suporte. |
| Tela | `app/estudio/mae/page.tsx`, `components/mae/` | Editor react-konva: barra (nova prancheta A4/A5/A6/personalizada, retrato ou paisagem; desfazer/refazer; Ajustar; Tamanho real; zoom; Calibrar tela), réguas em mm, painel Biblioteca (gravar e ler `Backups/teste-mae.json`) e painel Fontes. |

### Decisões técnicas

- **Pacotes = pastas do app** (`lib/mae/schema`, `render`, `editor`), sem npm workspaces: nada muda no build da Vercel. Regra: `schema` e `render` não importam React, Next nem DOM (o `render` vai rodar num Worker na Sprint 2).
- **Konva só para interação**: a folha é desenhada pelo `desenharPrancheta` dentro de um `Konva.Shape` (`sceneFunc`). O contexto já vem com 1 unidade = 1 mm, e a exportação vai fazer o mesmo com `ctx.scale(pxPorMm(300))`. Assim não existe segundo caminho de desenho.
- **Tamanho real exige calibração**: o navegador não informa o tamanho físico do pixel. A usuária encosta um cartão de crédito (85,6 mm) na tela e ajusta uma barra; o fator fica no `localStorage` daquele computador. Sem calibrar, vale o pixel nominal (96 dpi), que costuma errar alguns por cento.
- **Acesso**: a rota fica dentro do layout do `/estudio` (sessão + ADMIN + módulo SOA Design) e, além disso, só abre para os workspaces da variável `MAE_BETA_WORKSPACES` (separados por vírgula; `*` libera todos). Fora do menu até o beta.
- **Versões fixadas**: `react-konva` 19.2.7 exato (a 19.3 exige React 19.3; o projeto está no 19.2.4). Vitest 4 (o 5 exige `@types/node` 22+, o projeto usa a 20). Alias `@/` nos testes via `resolve.tsconfigPaths` nativo do Vite.
- **Sem IndexedDB** (aba anônima, armazenamento bloqueado): a pasta funciona na sessão, só não é lembrada. Não é erro.
- **Nenhuma tabela nova e nenhuma API** nesta sprint: tudo é local.

### Testes

- `npm test` — **28 testes** (Vitest, ambiente node): schemas (exemplos da spec passam; caminhos perigosos, mm negativo e versão errada falham), unidades e viewport (tamanho real com calibração = 100 mm físicos), histórico (200 passos de ida e volta exatos, teto de passos), Biblioteca com pasta falsa em memória (estrutura idempotente, gravar/ler/listar, nomes inválidos no Windows, **sha256 do molde real `docs/mae-exemplos/moldes/MILK.pdf`**) e fontes (agrupamento, permissão negada, sem suporte).
- Teste de tela no Chrome real (`scratchpad/fabtest/ui_mae_sprint1.mts`, com pasta e fontes simuladas): **15 de 15** — A4 renderizada (centro branco), Tamanho real = 100%, nova prancheta + desfazer/refazer (botões e Ctrl+Z / Ctrl+Shift+Z), 10 pastas criadas, gravar e ler com sha256 igual, fontes agrupadas, e a tela "Use o Chrome ou o Edge" quando as APIs não existem.
- `npx tsc --noEmit` limpo, lint limpo nos arquivos novos e `npm run build` ok.

### Pendências

- **Teste manual do Ju** com pasta real e fontes reais (roteiro abaixo). Antes, instalar as 19 fontes da pasta `FONTES/` da Naty: hoje **nenhuma está instalada** neste PC.
- **Ligar o beta**: definir `MAE_BETA_WORKSPACES` (local ou na Vercel) com o workspace de teste. Sem isso a rota mostra "Em desenvolvimento".
- Decisões em aberto para sprints futuras (do plano aprovado): nome das tabelas `mae_*` (Sprint 5); "conta" = workspace (Sprint 5); cota diária × exportação ilimitada, Packs × Artes prontas e preço dos add-ons (Sprint 12); COOP/COEP só nas rotas do MAE se o HarfBuzz/SlimSAM pedirem (Sprints 7/10).

### Como testar no navegador (Chrome ou Edge)

1. Instale as fontes da Naty: abra `SOA_ARQ_MOD_METMAE/FONTES/`, selecione todas → clique direito → **Instalar para todos os usuários**. Feche e abra o Chrome.
2. Rode o SOA com a flag de beta. Local: na `.env.local` da `main`, `MAE_BETA_WORKSPACES=*` (e o `DATABASE_URL` do Neon de produção, como de costume) → `npm run dev`. Ou peça o deploy com a flag ligada só para a conta de teste.
3. Entre com uma conta ADMIN que tenha o SOA Design e abra **`/estudio/mae`**.
4. **A4 vazia**: a folha aparece inteira, com as réguas mostrando 0 a 210 mm no topo.
5. **Tamanho real**: clique em **Calibrar tela**, encoste um cartão de crédito na barra laranja e ajuste até bater → Salvar → **Tamanho real**. Meça 100 mm na régua da tela com uma régua de verdade: deve dar 100 mm.
6. **Desfazer**: troque para A5 paisagem → Nova prancheta → Ctrl+Z volta para a A4 → Ctrl+Shift+Z refaz.
7. **Pasta**: **Escolher pasta** → crie "Biblioteca MAE" dentro do OneDrive → confira no Explorer as 10 pastas (Bases, Temas, Papéis, Elementos, Apliques, Identidade, Marcas de registro, Packs Naty, Exportações, Backups).
8. **Gravar e ler**: **Gravar teste** → o arquivo `Backups/teste-mae.json` aparece no Explorer → recarregue a página (F5) → **Reconectar** (1 clique) → **Ler teste**: mostra o conteúdo e "✓ igual ao gravado" (o selo só aparece se gravou nesta mesma sessão; depois do F5 basta conferir que o conteúdo é o documento).
9. **Fontes**: **Listar fontes instaladas** → aceite a permissão → busque "Pacifico", "Amarillo", "Sniglet": aparecem, com a prévia na própria fonte.
10. **Outro navegador**: abra no Firefox → aparece "Use o Chrome ou o Edge para o Método MAE."
