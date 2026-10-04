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

---

## Sprint 2 — Motor de render · concluída em 04/10/2026

**Pronto quando:** 2–3 camadas + máscara de recorte + um modo de mesclagem → exportar PNG → repetir → arquivos idênticos. **Atingido** (testes automáticos e no Chrome real abaixo; falta o teste da Naty).

### O que foi feito

| Peça | Onde | O que faz |
| --- | --- | --- |
| Árvore de camadas | `lib/mae/schema/camadas.ts` | Camadas `image` (arquivo da Biblioteca por caminho + sha256), `solid` (cor) e `group`; cada uma com visível, travada, opacidade, **preenchimento separado da opacidade**, modo de mesclagem e máscara de recorte. Fica em `prancheta.layers`, de baixo para cima. |
| Motor | `lib/mae/render/renderizar.ts` | `renderizarPrancheta`: desenha fundo + camadas num canvas do tamanho final. Os **16 modos nativos** do Canvas 2D; recorte no padrão Photoshop; grupos "atravessar" e isolados. Devolve os arquivos que faltam. |
| Cache | `lib/mae/render/cache.ts` | LRU por bytes (300 MB no Worker) com a imagem de cada camada já na escala de desenho. A chave tem só o que muda o raster (arquivo, tamanho, escala); mover, opacidade e modo não invalidam. |
| Web Worker | `lib/mae/render/render.worker.ts`, `motor.ts`, `protocolo.ts` | O motor roda fora da thread da tela (OffscreenCanvas). Prévia = `ImageBitmap`; exportação = PNG. Sem Worker, a mesma função roda na página. |
| Receita | `lib/mae/render/receita.ts` | JSON canônico + SHA-256 da receita (prancheta + resolução + fundo). É a impressão digital usada para comparar exportações. |
| Operações | `lib/mae/editor/camadas.ts` | Inserir, excluir, subir/descer, agrupar, desagrupar, duplicar (ids novos), lista do painel. Tudo pelo histórico; ajustes seguidos de um controle deslizante viram **1 passo** de desfazer. |
| Tela | `components/mae/PainelCamadas.tsx`, `PainelMotor.tsx`, `motorEditor.ts`, `acoesCamadas.ts`, `EditorMae.tsx` | Painel Camadas (olho, cadeado, renomear com duplo clique, modo de mesclagem com nomes em português, opacidade, preenchimento, recorte, "atravessar" no grupo, X/Y/L/A em mm, cor). "Imagem…" copia o arquivo para `Elementos/` na Biblioteca. Arrastar o contorno da camada selecionada move a camada. Prévia da folha vem do Worker. Painel **Teste do motor**. |

**Atalhos (padrão Photoshop):** Ctrl+G agrupar · Shift+Ctrl+G desagrupar · Alt+Ctrl+G máscara de recorte · Ctrl+J duplicar · Ctrl+] / Ctrl+[ subir/descer · Delete excluir · Esc tirar seleção.

### Decisões técnicas

- **Um motor só, em pixels do arquivo final.** A prévia da tela é o mesmo `renderizarPrancheta` em resolução menor, no Worker (degraus de √2 conforme o zoom, nunca acima de 300 dpi). O Konva só põe essa imagem na folha e desenha o contorno da seleção. Isso substitui o desenho direto no `sceneFunc` da Sprint 1 quando a folha tem camadas.
- **Determinismo:** os canvas do motor usam `willReadFrequently` (render em CPU, sem depender da placa de vídeo). A imagem de toda camada passa sempre pela mesma reamostragem, com ou sem cache. O teste prova: Worker × página = **0 valores diferentes**; 2 exportações = mesmo sha256.
- **Recorte (padrão Photoshop):** as camadas com `clip` logo acima de uma base formam um grupo de recorte. A base é desenhada com o próprio preenchimento; cada recortada aparece só onde a base tem pixel e mescla no modo dela; opacidade e modo da **base** valem para o conjunto. Base oculta esconde o conjunto; recortada oculta é ignorada; recorte na 1ª camada vale como camada comum.
- **Grupos:** "atravessar" (padrão), com 100% e modo normal, deixa os filhos mesclarem com o que está abaixo. Qualquer outro caso isola o grupo num buffer.
- **Limite conhecido:** nas bordas semitransparentes da base, um modo diferente de "normal" na recortada aproxima o alpha. Não aparece em arte com recorte de borda dura.
- **Arquivos:** a receita guarda caminho + sha256. Ao abrir, o motor lê pelo caminho e confere o hash. Se o arquivo sumiu ou mudou, a camada mostra "arquivo não encontrado" e o PNG não é gerado. A busca pelo hash quando o arquivo é movido fica para a Sprint 3.

### Conflitos com a spec (sinalizados antes de codar)

1. As camadas moram na **prancheta** (Editor de imagem = arte única). Na Sprint 6, o conteúdo do tema é convertido nesta mesma árvore, por face; o motor não muda.
2. "Gerar PNG" é **só teste do motor**. A exportação real (sangria, marcas de registro, PDF) é a Sprint 9.
3. "Imagem…" não é importação de molde (Sprint 3). Mover arrastando é o mínimo: transformar, girar e escalar com alças fica para a Sprint 10.
4. Estilos de camada (sombra, contorno…) são a Sprint 8. Opacidade e preenchimento já ficam separados para eles.

### Testes

- `npm test` — **67 testes**. Novos nesta sprint (com @napi-rs/canvas = Skia, o mesmo motor gráfico do Chrome):
  - matemática dos modos separáveis (multiplicação, tela, escurecer, clarear, diferença, exclusão, ±2);
  - opacidade × preenchimento, oculta, fundo transparente;
  - recorte (dentro/fora, base oculta, 1ª camada, mescla no modo da recortada, opacidade da base, recortada oculta);
  - grupos (oculto, isolado com opacidade, atravessar × isolado);
  - cache (LRU, chave);
  - arte real do tema de exemplo: render 2x = mesmos pixels e mesmo PNG; com cache = sem cache; comparação com a imagem de referência `lib/mae/__tests__/referencias/motor-01.png` via pixelmatch;
  - operações de camada + desfazer/refazer exatos + ajustes juntados.
- Teste de tela no Chrome real (`scratchpad/fabtest/ui_mae_sprint2.mts`), **22 de 22**:
  - motor no Worker;
  - prévia com cor sólida, imagem real copiada para `Elementos/`, recorte (fora da base fica o fundo) e multiplicação;
  - painel de cima para baixo;
  - **Worker × página: 0 diferenças**;
  - PNG 2480 × 3508 (A4 a 300 dpi);
  - **2ª exportação "idêntico ✓"**;
  - olho, Ctrl+Z, Ctrl+G, Shift+Ctrl+G, Ctrl+J, Delete, camada travada não sai;
  - arrastar move a camada;
  - gravar teste → nova prancheta → abrir teste traz as camadas de volta.
- `npx tsc --noEmit` limpo, lint limpo em `lib/mae` e `components/mae`, `npm run build` ok.

### Pendências

- **Teste da Naty** (roteiro abaixo).
- Instalar as fontes da Naty no PC do Ju. Vale para a Sprint 1 e só passa a importar na Sprint 7 (texto).
- Decisões em aberto, sem mudança: tabelas `mae_*` e conta = workspace (Sprint 5); cota × ilimitado, Packs × Artes prontas, preço dos add-ons (Sprint 12).

### Como a Naty testa (Chrome ou Edge, no computador)

1. Entre com a conta de teste e abra **usesoa.com.br/estudio/mae**.
2. Painel **Biblioteca MAE** → **Escolher pasta** (ou **Reconectar**) → a pasta "Biblioteca MAE".
3. Painel **Camadas**:
   - **Cor sólida** → um fundo rosa na folha inteira.
   - **Cor sólida** de novo → em X/Y/L/A digite 30 / 60 / 150 / 180 → Cor branca → duplo clique no nome → "Base".
   - **Imagem…** → escolha um PNG do tema (o arquivo é copiado para `Elementos/`) → marque **Máscara de recorte**: a imagem só aparece dentro da Base.
   - **Cor sólida** → cor laranja → **Modo de mesclagem: Multiplicação** → **Alt+Ctrl+G** (recorte).
4. Brinque: olho, cadeado, opacidade × preenchimento, outros modos, Ctrl+G / Ctrl+J, arrastar a camada na folha, Ctrl+Z.
5. **Teste do motor → Gerar PNG** → aparece "Gravado Exportações/AAAA-MM-DD/teste-motor_….png" (2480 × 3508 px).
6. **Gerar PNG** de novo, sem mexer na arte → deve aparecer **"idêntico ✓"**. Abra os dois PNGs na pasta: são a mesma imagem.
7. Opcional: **Gravar teste** (Biblioteca) → **Nova prancheta** → **Abrir teste no editor** → as camadas voltam.
