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

---

## Sprints 3 + 4 — Importação de moldes + Detecção de faces · concluídas em 04/10/2026

**Pronto quando (3):** os moldes reais entram em escala com erro de até 0,5 mm. **Atingido:** erro máximo de 0,37 mm e médio de 0,04 mm contra o vetor do próprio PDF, nos 6 moldes.
**Pronto quando (4):** 85% ou mais das faces saem certas sem ajuste. **Atingido:** 90 de 90 faces (100%) e todos os furos certos nos 6 moldes reais. Ainda falta a Naty conferir nos moldes dela.

### O que foi feito

| Peça | Onde | O que faz |
| --- | --- | --- |
| Importação | `lib/mae/importacao/` | **PDF** (pdf.js; uma página = um molde), **SVG** (unidades e viewBox; `stroke-dasharray` = dobra, lido por `getComputedStyle`), **DXF** (pelo conversor DXF→SVG que o SOA Design já tem: LINE, LWPOLYLINE com bulge, ARC, CIRCLE, SPLINE, blocos, linetype tracejado; unidade por `$INSUNITS`, pergunta se faltar), **PNG/JPG** (DPI do arquivo — PNG pHYs, JPEG JFIF/EXIF — e largura **sempre** confirmada, ou medida com 2 cliques). Vários arquivos de uma vez (botão ou arrastar para a folha). |
| Recorte e calibração | `importacao/preparar.ts`, `unidades.ts` | Rasteriza a 200 dpi, acha o desenho e recorta com 3 mm de margem. A receita guarda caminho, hash, página, recorte (mm) e calibração. O arquivo fica em `Bases/moldes/` na Biblioteca. |
| Detecção de faces | `lib/mae/faces/` (Worker) | Pipeline da spec: binarizar → fechar pontilhado → rotular regiões → descartar o fundo e as < 20 mm² → expandir até o centro da linha (distância chanfrada) → contorno pelas bordas dos pixels → suavizar + Douglas-Peucker → mm. Cada trecho de borda é classificado: com o fundo = **corte**; com outra face = **dobra**; perto de linha tracejada do arquivo = dobra. |
| Ferramentas manuais | `faces/ferramentas.ts` | Ímã (gruda no centro da linha), **laço** (Enter ou clique no 1º ponto fecha; substitui as faces cujo centro ele cobre), **dividir** (2 cliques atravessando a face; a linha nova é dobra), **unir** (face + vizinha), excluir face e furo ↔ face. Corte e dobra são recalculados pela geometria. Tudo entra no Ctrl+Z. |
| Equivalentes | `faces/equivalentes.ts` | Nota de 0 a 100% por proporção, área relativa, posição no molde e número de vizinhas. Ao selecionar uma face, as parecidas (em todos os moldes) ficam destacadas e listadas. |
| Organizar | `lib/mae/editor/moldes.ts` | Cada molde novo entra na primeira folha onde couber. Uma folha vazia gira para paisagem. Se não couber, cria A4 na orientação certa ou uma folha do tamanho do molde. Botão **+ Folha** para mais pranchetas. |
| Tela | `components/mae/PainelMoldes.tsx`, `ImportarMoldes.tsx`, `CamadaMoldes.tsx`, `moldesEditor.ts` | Painel "Moldes e faces": lista (tamanho, faces, furos, dobras), "Fechar pontilhado" + **Detectar de novo**, ferramentas (Selecionar, **Medir**, Laço, Dividir, Unir, Ímã) e o painel da face. No palco, **corte em vermelho contínuo, dobra em azul tracejado**, furos em cinza e o número de cada face. Ao reabrir a base, a prévia é refeita a partir da Biblioteca, com o hash conferido. |

### Medições com os moldes reais (`docs/mae-exemplos/moldes`)

A verdade de escala é o próprio vetor do PDF. Cada vértice de face detectada é comparado com a linha desenhada no arquivo.

| Molde | Tamanho (mm) | Faces | Furos | Erro máx. | Erro médio |
| --- | --- | --- | --- | --- | --- |
| CUBO COM ALÇA | 264,3 × 184,9 | 16 / 16 | 6 | 0,37 mm | 0,05 mm |
| MALETA COM ALÇA | 290,7 × 194,7 | 15 / 15 | 4 | 0,25 mm | 0,05 mm |
| MALETA CORAÇÃO | 265,6 × 202,2 | 11 / 11 | 7 | 0,24 mm | 0,04 mm |
| MILK | 279,3 × 200,7 | 22 / 22 | 0 | 0,28 mm | 0,05 mm |
| PIRÂMIDE | 257,4 × 197,5 | 11 / 11 | 1 | 0,22 mm | 0,04 mm |
| TRIANGULOVE | 255,9 × 199,0 | 15 / 15 | 2 | 0,32 mm | 0,04 mm |

- **Medir no app** (ferramenta Medir com ímã), painel do meio do MILK: **62,99 mm**; o vetor diz 63,00 mm.
- Os mesmos moldes por outros caminhos:
  - MILK em SVG (mm): 22 faces, 279,4 mm.
  - MILK em PNG a 150 dpi, com DPI no arquivo: 22 faces.
  - TRIANGULOVE em PNG sem DPI, medido com 2 cliques: 15 faces, 256,4 mm contra 255,9 mm do PDF. Aqui a precisão depende dos cliques.
  - Caixa DXF de teste (bulge, arco, círculo, spline, bloco, tracejado), em mm e em cm sem `$INSUNITS`: 4 faces, 2 furos, 132,07 × 126,24 mm contra 132 × 126,25.
- Detecção: ~0,6 a 1 s por molde, no Worker; a tela não trava.

### Decisões técnicas

- **Vetor do PDF não é desenhado de novo**: só é rasterizado para achar as faces e lido para conferir escala e tracejado. A exportação (Sprint 9) usa o arquivo original da Biblioteca, como manda a spec.
- **"Fechar pontilhado" padrão = 0,25 mm em vetor, 0,4 mm em imagem.** Os PDFs reais têm frestas de 0,2 a 0,4 mm onde as linhas deveriam se encontrar (medido no vetor). Sem fechar, a PIRÂMIDE junta faces (7 em vez de 11). O controle vai de 0 a 3 mm, por molde.
- **Tracejado do arquivo é desenhado contínuo** na detecção (senão o pontilhado ligaria duas faces) e anotado à parte como dica de dobra.
- **Limiar de binarização 240** (imagem: 235): linha de molde tem 0,1 mm e sai cinza-clara no raster.
- **Ids das faces são estáveis**: edição manual mantém o id das faces que não mudaram; face nova pega o próximo número livre. As partes da Sprint 5 vão apontar para esses ids.

### Conflitos com a spec (sinalizados antes de codar)

1. **Furo** não está na spec. Região que não toca o fundo e é "abraçada" por uma face (≥ 60% do contorno) vira furo; fenda estreita (< 2,5 mm de largura média) também. Exemplos: janela da alça, corações, círculos, fendas. A usuária troca furo ↔ face com 1 clique.
2. Os PDFs vêm numa página A4 com o molde no meio. O molde é **recortado** da página (a receita guarda página + recorte) e o **Organizar** coloca nas pranchetas.
3. Não havia medidas conferidas pela Naty; a régua de verdade foi o vetor do PDF. Os 30 moldes do roadmap viraram os 6 reais, mais SVG/DXF/PNG gerados a partir deles.
4. Atribuir faces a partes (FRENTE, LATERAL…) é a Sprint 5. Aqui as equivalentes só são sugeridas e destacadas.
5. Um PDF com vários moldes soltos na mesma página entra como um molde só. Separar por "ilhas" fica como melhoria, se a Naty precisar.

### Testes

- `npm test` — **116 testes**:
  - etapas raster (binarizar com transparência, fechar pontilhado, expandir até o centro, contorno);
  - detecção sintética (dobra × corte, furo, < 20 mm², fresta + fechar, tracejado = dobra, determinismo);
  - geometria e ferramentas (dividir, unir, laço, reclassificar, excluir, furo, ímã);
  - equivalentes; DPI (PNG pHYs, JPEG JFIF), calibração por largura e 2 cliques, unidades SVG, `$INSUNITS`;
  - recorte, Organizar, receita (Zod) ida e volta;
  - **os 6 moldes reais** (escala ≤ 0,5 mm, faces/furos certos, 85%+, determinismo) e o MILK como PNG a 150 dpi.
- Teste de tela no Chrome real (`scratchpad/fabtest/ui_mae_sprint34.mts`), **todos os checks ok**:
  - 6 PDFs de uma vez, faces/furos por molde, 6 folhas A4 paisagem, arquivos em `Bases/moldes/`;
  - **medir 62,99 mm**;
  - selecionar face + parecidas;
  - dividir/unir/laço/furo/Delete + Ctrl+Z;
  - fechar pontilhado 0 → 0,25 mm na PIRÂMIDE (7 → 11 faces);
  - SVG (MILK + tracejado);
  - DXF (mm + sem unidade → cm);
  - PNG com DPI (pede confirmação) e PNG sem DPI medido com 2 cliques;
  - gravar → nova → abrir: 12 moldes com a prévia refeita da Biblioteca.
- `npx tsc --noEmit` limpo, lint limpo em `lib/mae` e `components/mae`, `npm run build` ok.

### Pendências

- **Teste da Naty** com os moldes dela (roteiro abaixo), principalmente SVG/DXF/PNG que ela tiver e moldes com pontilhado de verdade.
- Segurança (da Sprint 2): **trocar a senha da conta demo e apagar `C:\vps-gestao\.env.shots`** — ação do Júnior.
- Sem mudança: tabelas `mae_*` e conta = workspace (Sprint 5); cota × ilimitado, Packs, preço dos add-ons (Sprint 12).

### Como a Naty testa (Chrome ou Edge)

1. **usesoa.com.br/estudio/mae** → **Biblioteca MAE** → Escolher pasta (ou Reconectar).
2. **Moldes e faces → Importar moldes…** (ou arraste os arquivos para a folha). Selecione vários: os PDFs dela, e SVG/DXF/PNG se tiver.
   - PNG/JPG: confira a largura (ou **Medir com 2 cliques**) e clique em **Confirmar**.
   - DXF sem unidade: escolha mm/cm/pol.
3. **Importar**: cada molde vai para uma folha, com as faces coloridas. **Vermelho contínuo = corte, azul tracejado = dobra, cinza = furo.**
4. **Escala:** ferramenta **Medir** → clique nas 2 pontas de uma medida que ela conhece (o ímã gruda na linha) → compare com a régua real. Meta: diferença ≤ 0,5 mm.
5. **Faces:** conte quantas saíram certas sem mexer (meta ≥ 85%). Onde falhar:
   - **Fechar pontilhado** → Detectar de novo;
   - **Dividir** (2 cliques atravessando a face);
   - **Unir** (selecione a face e clique na vizinha);
   - **Laço** (clique nos cantos; Enter fecha);
   - **É furo / É face**, **Excluir face** (Delete).
   - Ctrl+Z desfaz.
6. Clique numa face: as **parecidas** aparecem destacadas (base para a Sprint 5).
7. Anote o que faltou ou errou e mande para o Júnior.

---

## Sprints 5 + 6 — Assistente da base + Vínculo MAE · concluídas em 04/10/2026

**Pronto quando (5):** montar uma base de 6 moldes em menos de 20 min. **Atingido no roteiro:** com os 6 moldes reais, o fluxo completo leva **9 s de cliques** (sem contar o pensar), em ~30 cliques: partes FRENTE + VERSO com sugestões aceitas, enquadramento, NOME nos 6 moldes, logo nos 6, QR, papel das abas e salvar. O tempo real da Naty é medido pelo **cronômetro** no topo do assistente (começa no 1º molde e aparece ao salvar).
**Pronto quando (6):** papel arrastado na FRENTE atualiza todas as frentes em < 0,3 s. **Atingido:** **79 ms** no Chrome (6 folhas redesenhadas no Worker) e < 300 ms também no teste do Node. O tempo da última atualização fica à vista na barra ("atualizado em N ms").

### O que foi feito

**Sprint 5 — modo "Base" (assistente em 9 passos):**

| Passo | O que faz |
| --- | --- |
| 1–3 Moldes, Pranchetas, Faces | O painel das Sprints 3+4. |
| 4 Partes | Lista pronta (FRENTE, VERSO, LATERAL DIREITA, LATERAL ESQUERDA, FUNDO, FECHO SUPERIOR, ALÇA, ABA), renomear (duplo clique), criar e excluir. Clique na face marca/desmarca na parte ativa (cor por parte). A **sugestão automática** destaca em amarelo a face mais parecida de cada outro molde, com a nota; **"Aceitar todas"** = 1 clique. |
| 5 Enquadramento | **Papel quadriculado de teste** (grade, "▲ TOPO", nome da parte) em todas as faces da parte. Por face: Preencher / Caber / Esticar / Manual, escala, deslocamento, rotação, **Girar 180°**, **Espelhar** e "Igual em todas". |
| 6 Nome e textos | NOME / IDADE / HASHTAG: clique na face posiciona a caixa (em % da face, acompanha a rotação). Ajustes de posição, tamanho, nome simples (pt) e composto (1 ou 2 linhas, pt). A prévia usa "Maria Júlia" em fonte comum; o texto de verdade é a Sprint 7. |
| 7 Identidade | Cadastro do ateliê em `Identidade/` (logo, **QR Code gerado no navegador** a partir do link, @). "Posicionar logo/QR" por molde (largura em mm). Fica travado nos temas. |
| 8 Arte inteligente | Sobra em mm (padrão 10) + **papel das abas** (faces sem parte e partes sem conteúdo no tema). |
| 9 Salvar | Nome + **Salvar base** (versão sobe a cada salvamento) → `Bases/<nome>.mae-base.json`. Resumo do que falta. **Abrir base…** |

**Sprint 6 — modo "Tema" (vínculo MAE):**
- **Novo tema** → aponta para a versão salva da base → nome. **Abrir tema** carrega a base dele pelo id e avisa se a base mudou de versão.
- **Biblioteca de papéis e elementos** (`Papéis/`, `Elementos/`) com miniaturas, adicionar do computador e arrastar.
  - Soltar na **miniatura da parte** ou numa **face da folha** → vai para a **PARTE toda**.
  - Com **Alt** na face → só naquela caixa.
  - Arquivo do computador solto na folha: PNG com transparência vira **elemento**; imagem opaca vira **papel**. Isso confere com os arquivos reais do tema-exemplo: os 4 papéis são opacos e os ursos transparentes.
- **Papel** (âncora "papel") vai para o fundo da parte; soltar outro papel **troca** em vez de empilhar. **Elemento** (âncora "face") entra onde foi solto (posição em % da face) e se replica em todas as faces.
- **Painel de Partes** com miniatura desenhada pelo motor; camadas da parte (olho, ordem, excluir).
- **"Só nesta caixa"**:
  - clique numa caixa da folha → editar posição/escala/rotação/visível **pergunta "Todas as FRENTE" ou "Só nesta caixa"** (com "lembrar a escolha"), ou se escolhe direto no painel;
  - o ajuste local grava **só a propriedade mudada**; ícone 📌 na camada e na propriedade;
  - **Voltar ao padrão** por propriedade ou tudo;
  - **Desvincular** = a camada vira exclusiva da caixa e some do vínculo só ali;
  - arrastar o contorno da camada na folha move (com **Alt** = só nesta caixa).
- Ctrl+Z no tema tem histórico próprio. **Salvar tema** → `Temas/<nome>.mae-tema.json` (versionado).
- Modo **"Imagem"**: a arte única da Sprint 2 (camadas + teste do motor) continua lá.

### Decisões técnicas

- **Motor único mantido:** o vínculo vira a mesma árvore de camadas da Sprint 2 (`lib/mae/vinculo/resolver.ts`). Cada face com conteúdo é forma da face (com os furos, regra par-ímpar) + camadas recortadas por ela. O motor ganhou só a **forma poligonal** e a **imagem com matriz afim**, para esticar, espelhar e girar. Não existe outro caminho de desenho.
- **Espaço de referência da parte:** `[0, A] × [0, 1]`; A = proporção da 1ª face marcada. Enquadramento por face = retângulo envolvente girado pela rotação do enquadramento (`vinculo/enquadramento.ts`):
  - **âncora papel** passa pelo modo (preencher/caber/esticar/manual) + escala/deslocamento/espelhar;
  - **âncora face** = % do quadro da face (gira junto, não espelha — personagem não fica ao contrário).
- **Ordem de desenho de cada face** (spec): camadas da parte → ajustes locais da face → enquadramento → recorte pelo polígono → camadas exclusivas da face. Texto, efeitos e sobra entram nas Sprints 7, 8 e 9.
- **Sugestão de equivalentes:** "área relativa" passou a ser relativa à **maior face do molde**, não ao total, porque frente/verso costumam ser as maiores. A sugestão é a **melhor face de cada molde**, com a nota à vista (mínimo 10%). Nos 6 moldes reais, marcar a frente do MILK sugere certo nos outros 5.
- **Prévia:** todas as folhas são redesenhadas no Worker a cada mudança (a mais recente vence), com no máximo 6 px/mm quando há várias folhas.

### Conflitos com a spec (sinalizados antes de codar)

1. **Onde salvar:** a spec põe base e tema no Neon (`mae_bases`/`mae_themes`). Nome das tabelas e "conta = workspace" eram decisões em aberto, e criar tabela em produção é difícil de desfazer. Salvei **na Biblioteca** (`Bases/*.mae-base.json`, `Temas/*.mae-tema.json`) no mesmo formato validado pelo Zod. A sincronização com o Neon fica para quando o Júnior confirmar as tabelas.
2. **Identidade do Ateliê** ("cadastro por conta") pelo mesmo motivo foi para `Identidade/identidade.json`. Trocar a logo lá muda todas as bases (elas guardam só a posição).
3. **`faceContent`** foi acrescentado ao tema: a spec cita "camadas exclusivas da face" (Desvincular / Alt), mas o schema não tinha onde guardar.
4. **Papel das abas:** a base guarda um padrão (`smartArt.flapFill`); o `overflowFill` do tema substitui. "Aba" = face sem parte ou parte sem conteúdo no tema.
5. **A sobra (10 mm) só é configurada aqui:** desenhá-la exige offset de polígono e é exportação (Sprint 9).
6. O **texto de prévia** dos passos 6/7 é só marcador (fonte comum); HarfBuzz/fontes locais = Sprint 7.

### Testes

- `npm test` — **145 testes**. Novos:
  - matrizes; **enquadramento referência → face** (preencher, caber, esticar, manual com escala/deslocamento, girar 180°, espelhar, quadro da face sem espelho);
  - partes (lista pronta, marcar/desmarcar, criar/excluir, receita válida);
  - **resolução do vínculo**: papel em todas as frentes recortado pela face; elemento na mesma posição relativa em faces de tamanhos diferentes; **"Só nesta caixa"** só naquela face; `efetiva()` com troca de imagem; camada exclusiva; papel das abas (o do tema vence o da base); grade de teste; furo como anel;
  - motor desenhando forma com furo + imagem espelhada;
  - **moldes reais**: marcar a frente do MILK sugere 1 face grande em cada um dos outros 5; aceitar dá 6 FRENTES; resolver + desenhar as 6 folhas em < 0,3 s;
  - operações do tema (papel troca e não empilha, ajuste local por propriedade, Voltar ao padrão, Desvincular, Alt, ordem/remover, desfazer exato).
- Teste de tela no Chrome real (`scratchpad/fabtest/ui_mae_sprint56.mts`, 6 moldes + papéis/ursos reais), **todos os checks ok**:
  - lista pronta;
  - 5/5 sugestões e 6 FRENTES com 1 clique;
  - VERSO; renomear; criar parte;
  - papel de teste visível; caber + 180° + espelhar;
  - NOME nos 6 + IDADE;
  - logo + QR gerado;
  - sobra + papel das abas; base salva;
  - novo tema;
  - **papel na FRENTE → 6/6 frentes em 79 ms**;
  - elemento vinculado (87 ms);
  - pergunta Todas × Só nesta caixa; só o MILK muda; 📌 + Voltar ao padrão;
  - Todas as FRENTE; Alt = só a caixa;
  - Desvincular + Ctrl+Z;
  - salvar → fechar → abrir tema.
- Regressão: testes de tela das Sprints 2 e 3+4 **ok**.
- `tsc` limpo, lint limpo em `lib/mae` e `components/mae`, `npm run build` ok.

### 🔴 Checkpoint com a Naty (antes das Sprints 7–12)

Recomendação do Júnior/Claude: a Naty valida o fluxo **"monto a base → crio tema → arrasto papel → replica"** antes de seguir. Se o modelo de partes/vínculo estiver certo para ela, seguimos para a 7. Se não, corrigimos agora, enquanto é barato.

### Pendências

- **Checkpoint da Naty** (acima). Perguntas para ela:
  - a sugestão de frentes acerta nos moldes dela?
  - preencher/caber/esticar faz sentido por face?
  - "Só nesta caixa" e "Desvincular" são o que ela espera?
- **Decisão do Júnior:** tabelas `mae_*` no Neon e conta = workspace → aí base/tema/identidade passam a sincronizar.
- **Segurança (há 3 sprints):** trocar a senha da conta demo e apagar `C:\vps-gestao\.env.shots`.
- Sem mudança: cota × ilimitado, Packs × Artes prontas, preço dos add-ons (Sprint 12).

### Como a Naty testa (Chrome ou Edge)

1. **usesoa.com.br/estudio/mae** → Biblioteca MAE conectada. Barra de cima: modo **Base**.
2. **Passos 1–3:** importe os moldes dela.
3. **4 Partes:**
   - deixe FRENTE ativa e clique na frente de UM molde;
   - confira as amarelas → **Aceitar todas**;
   - repita para VERSO, LATERAIS etc.;
   - renomeie ou crie partes se quiser.
4. **5 Enquadramento:** o quadriculado mostra como a arte cai. Clique numa face e ajuste: Preencher/Caber/Esticar/Manual, Girar 180° (fecho), Espelhar.
5. **6 Nome e textos:** NOME → clique na frente de cada molde. IDADE/HASHTAG onde quiser.
6. **7 Identidade:** escolha a logo, gere o QR pelo link do WhatsApp e posicione nos moldes.
7. **8 Arte inteligente:** sobra (10 mm) e papel das abas.
8. **9 Salvar:** dê um nome → **Salvar base**. Anote o tempo do cronômetro (meta < 20 min).
9. Modo **Tema:**
   - nome → **Novo tema nesta base**;
   - em **Papéis/Elementos**, **Adicionar…** os arquivos do tema;
   - arraste um papel para a miniatura **FRENTE**: todas as frentes ficam com o papel na hora;
   - arraste um personagem para uma frente na folha: aparece em todas as frentes;
   - **Alt** ao soltar = só naquela caixa.
10. Clique numa caixa → selecione o personagem → mexa a posição → escolha **Só nesta caixa** → as outras não mudam. 📌 mostra o ajuste; **Voltar ao padrão** desfaz.
11. **Salvar** o tema.
12. Conte para o Júnior se o modelo "parte → todas as faces + ajuste por caixa" é o que ela usa no Photoshop.

---

## Sprints 7 + 8 — Texto e nome + Estilos de camada e presets · concluídas em 04/10/2026

**Pronto quando (7):** "Maria Júlia" com swash sai IGUAL na tela e no render do motor. **Atingido:**
- com a fonte real **Milkshake** (conjunto estilístico ss01) + estilo Princesa Dourada, a folha desenhada no Worker (tela) e na página dá **0 valores diferentes** em 3.991.680;
- o swash muda os glifos (teste do Node e da tela);
- texto e efeitos são o MESMO caminho vetorial e o mesmo motor.

**Pronto quando (8):** montar 5 estilos de nome de temas reais para a Naty aprovar. **Pronto para ela aprovar:** os 5 estilos estão na "Loja da Naty", com a prancha **`docs/mae-exemplos/estilos-nome-aprovacao.png`**, desenhada pelo motor com as fontes dela:

| Estilo | Fonte do exemplo |
| --- | --- |
| Ursinha Princesa Rosa | Milkshake swash |
| Stitch Azul Havaí | Amarillo |
| Safari Selva | Wild Monkeys |
| Fundo do Mar | Pacifico |
| Princesa Dourada | Vila Valent |

### O que foi feito

**Sprint 7 — Texto:**
- **HarfBuzz (WASM, `harfbuzzjs`)** molda o texto com OpenType completo: ligaduras, contextuais, alternativos, conjuntos estilísticos, swashes. Os glifos viram **caminhos em mm** num nó novo do motor (`path`), desenhado com Path2D na tela e no arquivo (`lib/mae/texto/`).
- **Fontes:**
  - **locais**: Local Font Access, inclusive as compradas. Há o botão "Liberar as fontes do computador".
  - **Google Fonts**: 10 de festa, baixadas do repositório oficial e guardadas em `Fontes Google/` na Biblioteca.
  - **substituta**: a Sniglet (OFL) vem embutida em `/mae/fontes/` e entra quando falta uma fonte, com o aviso "fonte X não instalada — usando substituta".
  - O tema guarda só o nome técnico (+ origem).
- **Estilo por variável** (`textStyles` no tema: "estilizar o nome uma vez, vale para todas as posições"):
  - cor, caixa alta/baixa, alinhamento;
  - tracking (milésimos do em), kerning, entrelinha;
  - escala horizontal/vertical, linha de base;
  - **texto em curva** (arco para cima/baixo);
  - recursos OpenType da fonte (botões por recurso que ela tem).
- **Painel de glifos:** clicar numa letra do nome mostra as variações dela. São as variações por recurso OpenType + os swashes e enfeites fora do teclado: Unicode privado (PUA; a Milkshake tem 375) e glifos sem código (a Vila Valent guarda os alternativos assim, sem GSUB). A escolha grava o glifo exato daquela letra.
- **Nome simples × composto:** 2+ palavras = composto, com a configuração da posição (1 ou 2 linhas, tamanho, entrelinha) e **quebra equilibrada**.
- **Auto-ajuste:** não coube → tamanho até 70%, depois o tracking; se ainda não → **"revisar"**. Os avisos aparecem no painel ("MILK: fonte reduzida para 86%").
- **HASHTAG** = `#` + nome sem espaços (acentos e maiúsculas como digitado) + texto do tema ("faz", editável) + idade. Valores de prévia (NOME, IDADE) no tema.
- **Gerar PNG da folha (teste do motor)** no modo Tema, a 300 dpi, na Biblioteca.

**Sprint 8 — Estilos e presets:**
- **Estilos de camada** no motor (`lib/mae/render/efeitos.ts`), para texto, papel, elemento e camadas do modo Imagem:
  - **traçado** (vários; fora/centro/dentro; exato em texto, por dilatação em imagem);
  - **sombra projetada**, **sombra interna**, **brilho externo** e **interno**;
  - **chanfro e entalhe** (aproximação: realce + sombra internos);
  - sobreposição de **cor**, **degradê** (linear/radial, várias cores) e **padrão**.
  - Ordem do Photoshop; opacidade × preenchimento respeitados (preenchimento 0 mantém os efeitos).
  - Cada camada com efeito usa um buffer do tamanho dela.
- Editor de efeitos: + efeito, ligar/desligar, ordem, editar cada um, **copiar e colar estilo** entre camadas.
- **Presets** (`lib/mae/efeitos/presets.ts`): guardam **só os efeitos** (nunca a fonte; validado). Aplicar = cópia editável.
  - **Biblioteca privada** (salvar, renomear, excluir) na nuvem; offline fica no navegador até sincronizar.
  - **Loja da Naty**: os 5 estilos embutidos + os publicados no Neon. Prévia em fonte grátis + **"Testar com minha fonte"**, selo grátis/preço; a compra é a Sprint 12.

**Neon (decisão do Júnior — sincronização ligada):**
- **Tabelas criadas no `neondb`** (as 8 da spec, `lib/mae/servidor/tabelas.sql`):
  - `mae_bases` e `mae_themes`, um registro por versão;
  - `mae_identity` e `mae_effect_presets`;
  - `mae_registration_presets`, `mae_product_theme_links`, `mae_order_arts` e `mae_purchases`, para as Sprints 9/12.
  - Antes: conferido `current_database() = neondb` e salvo o estado (`backups/schema_antes_mae_2026-10-04.json`). Só `CREATE … IF NOT EXISTS`; nada existente foi tocado. **A DDL roda uma vez por script, nunca em runtime.**
- **Rotas:** `/api/mae/bases`, `/bases/[id]`, `/temas`, `/temas/[id]`, `/identidade`, `/presets`. Exigem sessão + workspace no beta, validam com o mesmo Zod do editor e guardam **só receitas JSON**, nenhuma arte. Conta = `workspaceId`.
- **No editor:**
  - salvar base/tema/identidade grava na Biblioteca **e** envia à nuvem;
  - "Abrir base/tema" lista também os salvos em outro computador da conta;
  - indicador "☁ sincronizado / não sincronizado" na barra;
  - offline, tudo continua funcionando na Biblioteca.

### Decisões técnicas

- **Texto = caminho vetorial no motor** (não `fillText`): a tela e o arquivo usam exatamente os mesmos contornos moldados pelo HarfBuzz. É o que garante o "igual na tela e no PDF" da Sprint 9.
- **Glifo escolhido = glifo exato** (não o recurso): se um conjunto estilístico estiver ligado no texto todo, ele não "esconde" a escolha feita numa letra.
- **Efeitos determinísticos:** blur/composição do Skia no Worker; teste de pixels para cada efeito; 2 renders = mesmos pixels.
- **`next.config.ts`**: alias só para o navegador (`turbopack.resolveAlias.module.browser`) para um módulo vazio. O `harfbuzzjs` importa o built-in `module` do Node num ramo que nunca roda no navegador, e o Turbopack não montava o bundle sem isso. O servidor não é afetado.
- **Fontes da Naty instaladas no PC do Júnior** (usuário atual, sem admin, reversível) para o teste manual.

### Conflitos com a spec (sinalizados antes de codar)

1. O exemplo da spec põe o texto dentro de `partContent`; o fluxo diz "estilizar o nome uma vez, vale para todas as posições". Ficou `textStyles` por variável no tema.
2. Pasta nova **`Fontes Google/`** na Biblioteca (a spec lista 10 pastas).
3. Das 8 tabelas, 4 já são usadas (bases, temas, identidade, presets); as outras ficam prontas e vazias até as Sprints 9 e 12.
4. Chanfro e entalhe: aproximação boa, não "igual ao Photoshop" (como a spec já previa).

### Testes

- `npm test` — **174 testes**. Novos:
  - hashtag;
  - shaping determinístico; caixa; **swash da Milkshake** (glifos mudam); painel de glifos (alternativas, PUA, glifo sem código, escolha só na letra);
  - composto em 2 linhas; quebra equilibrada; auto-ajuste (tamanho → tracking → revisar);
  - alinhamento, linha de base, curva;
  - caminho SVG estável; texto na caixa da posição; substituta + aviso;
  - "Maria Júlia" swash: mesmo caminho = mesmos pixels;
  - serialização do estilo;
  - **cada efeito nos pixels** (traçado fora/dentro/centro, vários traçados, traçado em sólido, sombra, cor, degradê, preenchimento 0, opacidade, brilhos, sombra interna, chanfro), determinismo, caixa/folga;
  - presets (só efeitos, cópia profunda, os 5 da Naty).
- Teste de tela no Chrome com as **fontes reais** (`scratchpad/fabtest/ui_mae_sprint78.mts`), **todos os checks ok**:
  - 17 fontes listadas; Milkshake carregada;
  - swash muda a tela; 5 variações do "a" + 122 do PUA;
  - composto em 2 linhas; nome longo com auto-ajuste e aviso;
  - preset da Naty aplicado sem trocar a fonte; + efeito; copiar/colar estilo;
  - preset salvo só com efeitos; "Testar com minha fonte";
  - **Worker × página: 0 diferenças**; Gerar PNG; "não sincronizado" sem servidor;
  - reabrir o tema.
- Regressão: telas das Sprints 2, 3+4 e 5+6 **ok**.
- `tsc` limpo, lint limpo em `lib/mae`, `components/mae`, `app/api/mae`; `npm run build` ok.

### Pendências

- **A Naty aprova (ou ajusta) os 5 estilos** da prancha e da Loja. Depois disso, publicar os definitivos como `workspace_id = 'naty'` no Neon (ou manter embutidos).
- **Segurança (há 4 sprints):** trocar a senha da conta demo e apagar `C:\vps-gestao\.env.shots`.
- Próximo: **Sprint 9 (Exportação real)** — sangria, marca de registro, PDF 300 dpi em tamanho real. Fecha o "coração usável" para o beta.

### Como a Naty testa (Chrome ou Edge, no computador onde as fontes dela estão instaladas)

1. **usesoa.com.br/estudio/mae** → Biblioteca conectada → modo **Tema** → abra o tema da Sprint 6 (ou crie um).
2. Seção **Textos** → **NOME**:
   - **Liberar as fontes do computador** (1 vez);
   - escolha a fonte cursiva (ex.: Milkshake);
   - ligue um **Conjunto** (swash).
3. **Glifos:** clique numa letra do nome e escolha a variação (também as de baixo, "fora do teclado").
4. Teste a prévia: NOME "Maria Júlia" (2 linhas) e um nome longo (o aviso diz quanto reduziu ou "revisar").
5. **Estilos do NOME:** aplique um da **Loja da Naty** e ajuste (traçado, sombra, degradê…); **Salvar preset** com um nome. **Testar com minha fonte** mostra os da loja na fonte dela.
6. **Gerar PNG da folha** e compare com a tela.
7. Diga quais dos **5 estilos** aprova (prancha em `docs/mae-exemplos/estilos-nome-aprovacao.png`).

---

## Sprints 9 + 10 — Exportação (o marco do beta) + Ferramentas de edição · concluídas em 04/10/2026

**Sprint 9, pronto quando:** "100 mm na tela = 100 mm impressos".
- **No arquivo: atingido.** O PDF sai com a página em mm exatos (210 × 297, 297 × 210…) e com "imprimir em tamanho real" gravado (`PrintScaling = None`).
- Uma linha de corte vetorial de 100 mm mede 100,00 mm quando relida do PDF.
- O vetor original do MILK sai com as mesmas medidas do `MILK.pdf`, girado 90°.
- **No papel: falta o teste manual** (roteiro abaixo).

**Sprint 10, pronto quando:** a transição entre dois papéis com máscara em degradê sai NÍTIDA no PDF. **Atingido.**
- O degradê da máscara é **vetorial**: é calculado no pixel final, a 300 dpi, e não ampliado de um raster.
- A transição é contínua: nenhum degrau grande entre pixels vizinhos.
- A borda da face continua com degrau de 1 px.
- Bate com a imagem de referência (pixelmatch).

### O que foi feito — Sprint 9 (Exportação)

| Peça | Onde | O que faz |
| --- | --- | --- |
| Sangria | `lib/mae/exportar/sobra.ts` | Usa o **Clipper2** (`clipper2-ts` 2.0.1-18, versão exata). Região de impressão = face expandida pela sobra (cantos em esquadria) − as faces vizinhas: a arte vaza pelas arestas de CORTE e não invade a face ao lado. |
| Resolver | `lib/mae/vinculo/resolver.ts` | Modos `tela` / `aprovacao` (recorte exato pela face) e `impressao` (veja a lista abaixo). |
| Linhas | `lib/mae/exportar/linhas.ts` | Corte = contorno da união das faces + furos. Dobra = aresta encostada em outra face, ou marcada como dobra. Saem como camadas do motor (contorno da aprovação), em vetor no PDF e, só as linhas, em **SVG** (mm reais) e **DXF R12** (`$INSUNITS = 4`, camadas CORTE e DOBRA). |
| Marca de registro | `lib/mae/exportar/marca.ts`, `components/mae/marcasMae.ts`, `app/api/mae/marcas` | Veja a lista abaixo. |
| PDF | `lib/mae/exportar/pdf.ts` (pdf-lib) | Página em mm exatos. Por cima da arte (PNG 300 dpi do **mesmo motor**), em VETOR: identidade, linhas de corte e dobra, e a página da marca em tamanho real (`embedPdf`). Grava `PrintScaling = None` e "bandeja pelo tamanho". |
| Nomes | `lib/mae/exportar/nomes.ts` | `{tema}_{nome}_{molde}_{data}`, dentro de `Exportações/AAAA-MM-DD/`. Nome seguro no Windows e sem sobrescrever (`(2)`, `(3)`…). |
| DPI no arquivo | `lib/mae/exportar/png.ts` | `pHYs` no PNG (300 dpi) e densidade JFIF no JPG (150 dpi). |
| Exportar | `components/mae/exportarMae.ts`, `PainelExportar.tsx` | O painel **Exportar** do modo Tema (veja a lista abaixo). |

**Resolver no modo `impressao`:**
- recorta pelo polígono **expandido** pela sobra;
- os furos encolhem só 1 mm (folga do corte; furo pequeno não some);
- põe por baixo uma cópia ampliada do papel de fundo, para cobrir a sobra sem mudar nada dentro da face;
- as abas recebem o papel das abas com sobra.

**Também no resolver (Sprint 10):** inclinar, espelhar e altura independente na matriz; máscara, ajustes e deformação viram parte do nó do motor; formas viram caminho.

**Marca de registro:**
- O PDF da marca vai para `Marcas de registro/`. A receita (folha em mm, hash, página e zonas com tinta) fica em `marcas.json` e sincroniza com a conta (`mae_registration_presets`). O arquivo não sai do computador.
- Cada prancheta escolhe a sua marca.
- **Alertas:**
  - arte entrando na área da marca;
  - prancheta de tamanho diferente da marca (a arte é centralizada);
  - prancheta paisagem com marca retrato (a arte entra **girada 90°**).

**Painel Exportar (modo Tema):**
- **Arte pra aprovação:** JPG 150 dpi, recorte exato e contorno; numa imagem só ou uma por molde.
- **Arte pra impressão:**
  - PDF por prancheta, por molde ou tudo junto, ou PNG 300 dpi;
  - sobra ajustável (10 mm padrão);
  - imprimir ou ocultar as linhas; moldes em PDF podem usar as **linhas do arquivo original** (vetor exato);
  - só as linhas em SVG e/ou DXF;
  - marca por prancheta e alertas;
  - **lembrete "Imprima em TAMANHO REAL"** ao terminar.
- **Gancho dos apliques** (`ganchosExportacao.apliques`): a Sprint 11 só pluga as camadas da silhueta; a saída é a mesma.

### O que foi feito — Sprint 10 (Ferramentas de edição)

| Peça | Onde | O que faz |
| --- | --- | --- |
| Schema | `lib/mae/schema/edicao.ts` | Máscara de camada (pintada em PNG + degradê vetorial linear/radial/angular/refletido; inverter, desativar, suavizar), 8 ajustes e deformação em grade. Tudo no **quadrado da própria camada**: o que se pinta numa caixa vale para todas as faces da parte. |
| Motor | `lib/mae/render/ajustes.ts`, `efeitos.ts`, `renderizar.ts` | Veja a lista abaixo. |
| Seleções | `lib/mae/edicao/selecao.ts` | Veja a lista abaixo. |
| Pintura | `lib/mae/edicao/pintura.ts` | Pincel e borracha (tamanho, dureza, opacidade do traço sem escurecer na sobreposição; respeitam a seleção), lata, degradê (4 tipos), conta-gotas e **paleta do tema** (corte pela mediana, determinístico). |
| Formas | `lib/mae/edicao/formas.ts` | Retângulo arredondado, elipse, polígono, estrela, coração e linha; **caneta Bézier** (clique = reto, arrastar = curva). Preenchimento e traçado. Viram caminho vetorial no motor (nítidas no PDF). |
| IA de objeto | `lib/mae/edicao/sam.ts` | **SlimSAM** (`Xenova/slimsam-77-uniform`) pelo **Transformers.js 3.7.6** fixado no CDN. Usa onnxruntime-web 1.22, **não** a 1.21, com backend WASM. Só carrega ao usar a ferramenta; a imagem não sai do computador. |
| Tela | `components/mae/PainelEdicao.tsx`, `EditorPixels.tsx`, `EditorCaneta.tsx`, `CamadaMoldes.tsx`, `PainelCamadas.tsx` | Veja a lista abaixo. |

**Motor:**
- os 8 ajustes por pixel, determinísticos: brilho/contraste, matiz/saturação (colorizar), níveis, curvas, equilíbrio de cores, vibração, preto e branco (6 cores + tonalizar), mapa de degradê;
- a máscara entra **depois dos ajustes e antes dos efeitos** (os efeitos seguem a forma mascarada);
- deformação desenhada por triângulos afins;
- formas com traçado.

**Seleções:**
- letreiro retangular e elíptico, laço, laço poligonal;
- varinha (tolerância, contígua), intervalo de cores (suave), objeto (IA);
- somar, subtrair, intersectar;
- expandir e contrair (distância de chanfro), suavizar, inverter;
- formigas e **virar máscara**.

**Tela:**
- Na camada selecionada do tema:
  - **Transformar**: altura independente, inclinar, espelhar ↔ ↕, distorcer / perspectiva / malha 3×3;
  - **Máscara**: degradê, ativa, inverter, suavizar, editar;
  - **Ajustes** (+ Ajuste…);
  - **Pintar numa camada nova**;
  - formas: cor, traçado, cantos, lados/pontas, proporção.
- **Editor de pixels** (janela): todas as ferramentas acima, sobre a imagem da camada com a máscara aplicada (xadrez = transparente).
- **Alças no palco**: os cantos escalam e a bolinha de cima gira (Shift = de 15 em 15°; Alt = só nesta caixa).
- **+ Forma** e **Caneta** na lista de camadas da parte.
- **Shift + arrastar** um papel: entra **por cima** (sem Shift, troca o papel do fundo), para montar a transição entre dois papéis.
- Modo **Imagem**: ajustes e máscara em degradê também na arte única.

### Decisões técnicas

- **Um motor só.** Tela, aprovação e impressão chamam o mesmo `resolverPrancheta` e o mesmo `renderizarPrancheta`. A impressão só muda o recorte (com sobra) e a resolução (300 dpi).
- **Por cima em vetor:**
  - linhas (detectadas, ou a página original do molde em PDF via `embedPage`);
  - QR em quadradinhos vetoriais (pelo link da Identidade);
  - logo embutida;
  - marca de registro em tamanho real.
  - O nome e as formas vão no raster de 300 dpi do motor (iguais à tela).
- **Arte dentro do PDF em PNG (sem perda).** Montar uma página A4 a 300 dpi leva cerca de 5 s no pdf-lib. Aceitável para o beta; dá para trocar por JPG 95% se pesar.
- **Degradê da máscara = vetor:** o motor monta o degradê no quadrado da camada e o canvas leva para o pixel final. Nítido em qualquer resolução (é o critério da Sprint 10).
- **Transformers.js pelo CDN, não pelo npm:** o pacote puxaria `onnxruntime-node` e `sharp` para o build da Vercel. O `import()` do CDN não passa pelo bundler. Não há CSP no SOA que bloqueie.
- **Pintura e máscara pintada** viram PNG na Biblioteca (`Elementos/máscaras/`, `Elementos/pinturas/`). A receita guarda só caminho e hash.

### Conflitos com a spec (sinalizados antes de codar)

1. **As ferramentas agem nas camadas do TEMA, no espaço da camada.** Pintar numa caixa vale para a parte inteira. A arte única (modo Imagem) ganhou ajustes e máscara em degradê; o editor de pixels completo fica no tema.
2. **Marca retrato × prancheta paisagem:** as marcas reais são A4 retrato e as pranchetas dos moldes são paisagem. A arte entra **girada 90°** na folha da marca, com aviso, em vez de redimensionar a marca.
3. **"100 mm = 100 mm"** foi provado no arquivo. O teste do papel é manual.
4. **Por molde não leva marca** (a marca vale para a folha inteira). Há um aviso; para print & cut, exporte por prancheta.

### Testes

- `npm test`: **219 testes** + 2 pesados que rodam só com `MAE_SAIDAS=1`. Novos:
  - `exportar.test.ts`:
    - mm ↔ px a 300 dpi;
    - sangria (expandir, não invadir a vizinha, contrair, fator do papel);
    - resolver: aprovação = tela; impressão vaza 8 mm do lado de corte, sem invadir a vizinha; aba com sobra; furo vazado; **dentro da face idêntico à tela**;
    - linhas, SVG e DXF; nomes;
    - PDF: mm exatos e `PrintScaling = None`; **linha de 100 mm medida no PDF = 100,00 mm**; paisagem → retrato girado; QR vetorial;
    - **marca real** (`milk_marca registro.pdf`): zonas, conflito e entrada no PDF na mesma posição.
  - `edicao.test.ts`:
    - seleções (todas), pintura, degradês, conta-gotas, paleta, formas e caneta;
    - 8 ajustes (valores e determinismo);
    - máscara no motor (degradê contínuo e determinístico, inverter, desativar, pintada com a matriz da camada, suavizar);
    - deformação (neutra = sem deformação; perspectiva);
    - **marco**: transição entre dois papéis nítida a 300 dpi, no PDF, e igual à referência (`referencias/mascara-degrade.png`).
  - `exportar-reais.test.ts` (`MAE_SAIDAS=1 npx vitest run exportar-reais`): os **6 moldes reais** + tema da Naty + NOME.
    - Aprovação JPG 150 dpi e impressão PDF 300 dpi com a **marca real de cada molde**, girada.
    - MILK com o vetor original do PDF.
    - Saídas em `scratchpad/saidas-mae9/`; a folha de aprovação em `docs/mae-exemplos/aprovacao-6-moldes.jpg`.
    - Alertas reais: com 10 mm de sobra, os moldes grandes encostam nos cantos das marcas.
- Teste de tela no Chrome (`scratchpad/fabtest/ui_mae_sprint910.mts`), **33 checks, todos ok**:
  - **máscara**: degradê na transição entre 2 papéis, radial, inverter, desativar;
  - **editor de pixels**: letreiro + varinha → máscara gravada na Biblioteca; pincel + degradê refletido numa camada nova; paleta do tema;
  - **transformar e editar**: perspectiva simétrica; espelhar; os 8 ajustes mudam a tela; estrela com traçado; **caneta com curva**; **alça de canto escala**;
  - **objeto automático (SlimSAM) funcionando no Chrome**;
  - **exportar**: aprovação JPG 150 dpi (DPI gravado) numa imagem e por molde; marca real cadastrada (210 × 297 mm, 7 zonas); impressão por prancheta (MILK 210 × 297 com a marca, CUBO 297 × 210), `PrintScaling = None`, SVG e DXF, tudo junto (2 páginas), PNG por molde a 300 dpi (`pHYs`); lembrete de tamanho real; alerta "girada 90°".
- Regressão: telas das Sprints 2, 3+4, 5+6 e 7+8 **ok**.
- `tsc` limpo, lint limpo em `lib/mae`, `components/mae` e `app/api/mae`; `npm run build` ok.

### Pendências

- **Teste de impressão (Júnior):** imprimir um PDF a 100% e medir uma linha de corte com régua — 100 mm têm de dar 100 mm.
- **Teste da Naty** (roteiro abaixo), principalmente o print & cut com a marca dela na Silhouette.
- **Segurança (há 4 sprints):** trocar a senha da conta demo e apagar `C:\vps-gestao\.env.shots`.
- A Naty ainda aprova os 5 estilos de nome (Sprint 8).
- Não adiantado, como pedido: apliques (Sprint 11) e pedidos/massa/loja (Sprint 12).

### Como a Naty testa (Chrome ou Edge)

1. Abra **usesoa.com.br/estudio/mae** e conecte a Biblioteca. Vá ao modo **Tema** e abra o tema.
2. **Transição entre dois papéis:**
   - arraste um papel para a FRENTE;
   - segure **Shift** e arraste o 2º papel (ele entra por cima);
   - clique na camada de cima → **Máscara → + Degradê**;
   - em **Editar…**, use a ferramenta Degradê e arraste para posicionar a transição.
3. **Máscara pintada:** em Editar…, use a **varinha**, o **laço** ou o **Objeto (IA)** (clique no desenho; Shift + clique tira uma parte). Depois clique em **Virar máscara** e **Aplicar**.
4. Teste **Ajustes**, **Pintar numa camada nova**, **+ Forma**, **Caneta** e as **alças** no palco (clique numa caixa e depois na camada).
5. **Exportar → Arte pra aprovação → Gerar JPG** e abra o arquivo em `Exportações/<data>/`.
6. **Marca de registro:** use **Adicionar marca (PDF)** com a marca do Silhouette e escolha-a na folha.
7. **Gerar arquivo pra impressão** (PDF por prancheta) e leia os alertas.
8. **Imprima em tamanho real (100%)** e confira:
   - a régua: 100 mm no arquivo = 100 mm no papel;
   - a Silhouette lê a marca e corta na linha;
   - a sobra cobre o corte.

---

## Sprints 11 + 12 — Apliques 3D + Pedidos, massa e loja · concluídas em 04/10/2026

Com estas duas, os **12 passos do MAE estão completos**.

**Sprint 11, pronto quando:** um aplique + silhueta de 3 mm passam no rastreio do Silhouette Studio.
- **Do lado do arquivo: pronto.** As duas folhas saem em PNG transparente a 300 dpi, com a marca real. A silhueta fica entre 2,4 e 3,6 mm do desenho (medido), é cheia (sem buracos) e fica na mesma posição da peça impressa.
- **O rastreio na Silhouette é o teste manual da Naty.** Os arquivos estão em `scratchpad/saidas-mae11/`, com prévia em `docs/mae-exemplos/apliques-*.png`.

**Sprint 12, pronto quando:** 20 pedidos geram em lote e cada card mostra "Arte gerada ✓". **Atingido no teste de tela** (resultado abaixo).

### O que foi feito — Sprint 11 (Apliques 3D)

| Peça | Onde | O que faz |
| --- | --- | --- |
| Silhueta | `lib/mae/apliques/silhueta.ts` | Veja a lista abaixo. |
| Organizar na folha | `lib/mae/apliques/empacotar.ts` | MaxRects (de cima para baixo, da esquerda para a direita), 2 mm entre as peças, margem de 5 mm. As **zonas com tinta da marca de registro são obstáculos**. Determinístico; a peça que não cabe vira aviso. |
| Folhas | `lib/mae/apliques/folhas.ts` | Veja a lista abaixo. |
| Tema | `lib/mae/schema/tema.ts` | `appliques` no tema: ligado/desligado, bordinha (0–5 mm, branca, do tema ou personalizada), deslocamento (0–15 mm), a marca da folha de impressos e a das silhuetas. Na camada, `applique.enabled`, com bordinha e deslocamento próprios opcionais. |
| Tela e exportação | `components/mae/apliquesMae.ts`, `PainelEdicao.tsx`, `PainelExportar.tsx`, `exportarMae.ts` | Veja a lista abaixo. |
| Marca nos PNG | `lib/mae/exportar/marca.ts` (`soTinta`) | A marca rasterizada perde o fundo branco (fica só a tinta) para ir por cima do PNG transparente. |

**Silhueta (`silhueta.ts`):**
- contorno pelo **canal alfa**;
- **buracos preenchidos** (as regiões transparentes que não tocam a borda viram desenho);
- offset com o **Clipper2, canto redondo** (o "deslocamento externo" do Silhouette Studio);
- **suavizar** (abrir e fechar redondo + simplificar);
- só os anéis de fora, porque a silhueta é cheia;
- a poeira (pedaços menores que 2 mm²) é ignorada;
- a **bordinha** é o mesmo offset, menor, na cor escolhida.

**Folhas (`folhas.ts`):**
- acha os apliques: cada camada marcada × cada face onde aparece = um aplique **ligado ao molde de origem**, **no tamanho em que está na arte**;
- monta as duas folhas:
  - **impressos**: bordinha por baixo, a imagem, e o **nome do molde em cima** (vetor HarfBuzz, só nesta folha);
  - **silhuetas**: em **preto**, nas mesmas posições.

**Tela e exportação:**
- "**É aplique 3D**" na camada selecionada.
- Seção **Apliques 3D** no painel Exportar: ligar no tema, bordinha, cor, deslocamento e as duas marcas.
- "**Organizar na folha e gerar os 2 PNG**".
- A "Arte pra impressão" também gera as duas folhas quando o tema usa apliques.
- O gancho da Sprint 9 virou a chamada de verdade.

### O que foi feito — Sprint 12 (Pedidos, massa e loja)

| Peça | Onde | O que faz |
| --- | --- | --- |
| Regras puras | `lib/mae/pedidos/pedidos.ts` | Veja a lista abaixo. |
| Pack | `lib/mae/pedidos/loja.ts` | O pack encaixa na base pelo **nome** da parte. Os caminhos vão para `Packs Naty/<pack>/`. Avisa "o pack não tem ALÇA, escolha um papel". Lista os arquivos para publicar. |
| Add-ons | `lib/mae/servidor/addons.ts`, `/api/mae/addons` | Veja a lista abaixo. |
| Rotas | `/api/mae/pedidos`, `/api/mae/pedidos/arte`, `/api/mae/vinculos` | Veja a lista abaixo. |
| Loja da Naty | `/api/mae/loja`, `loja/comprar`, `loja/pack/[id]`, `loja/publicar`, `loja/upload`, webhook | Veja a lista abaixo. |
| Card do pedido | `components/mae/ArteMaeDoPedido.tsx` na tela do pedido | Status (não gerada / **Arte gerada ✓** / revisar), nome do arquivo, versão do tema, campos que faltam, **Gerar arte** e histórico. Some sozinho sem o add-on. |
| Gerar arte | `BarraPedido.tsx` (`/estudio/mae?pedido=<id>`) | Veja a lista abaixo. |
| Edição em massa | `EdicaoEmMassa.tsx` (botão **Pedidos (massa)**) | Veja a lista abaixo. |
| Loja na tela | `PainelLoja.tsx` (modo Tema) | Packs e presets com preço; **pegar grátis / comprar** (abre a fatura); **baixar e aplicar** na base aberta, com os avisos. A conta da Naty **publica** o tema aberto como pack (com preço e descrição). |
| Tutorial | `TutorialMae.tsx` | 7 passos; abre sozinho na 1ª vez e depois pelo botão **?**. Ensina a criar os campos TEMA, NOME e IDADE. |

**Regras puras (`pedidos.ts`):**
- campos TEMA, NOME e IDADE (aceita "Nome da criança", "Idade da criança" etc.) + extras;
- variáveis e **HASHTAG** (`#MariaJúliafaz1`, com o texto do meio do tema; editável);
- **tema do pedido**: vínculo da variação → vínculo do produto → campo TEMA, sem diferenciar acento e maiúscula;
- **fila** (um pedido por vez, progresso, erro não para a fila, cancelar);
- resumo;
- status do card pelo último registro, com histórico;
- alertas: faltam dados, tema não encontrado, nome longo;
- pasta `<pedido>_<nome>`.

**Add-ons (`addons.ts`, `/api/mae/addons`):**
- "Criação de artes MAE" e "Edição em massa", **por conta**. Beta = os dois liberados. Uma linha em `mae_purchases` (`addon`) = cortesia ou compra. A Edição em massa exige a Criação.
- **Preço em env** (`MAE_ADDON_CRIACAO_PRECO`, `MAE_ADDON_MASSA_PRECO`). Sem valor = **"em breve" e não cobra**.
- A página e as rotas `/api/mae/*` passaram a usar este controle.

**Rotas de pedidos:**
- pedidos em aberto, com campos, itens (variação → produto) e histórico de artes;
- registrar a arte gerada (tema, **versão do tema**, variáveis, status e nome do arquivo; gerar de novo = novo registro);
- vínculo produto/variação ↔ tema.

**Loja da Naty (rotas e webhook):**
- Os packs são temas da conta `naty` publicados; os presets são os da Sprint 8 com preço.
- Grátis libera na hora.
- Pago gera uma **cobrança avulsa no Asaas** (Pix ou cartão), com `externalReference` `MAE:…`. **Só o webhook confirmado grava a compra**; o estorno retira.
- Arquivos dos packs: a Naty sobe direto do navegador para o **Vercel Blob** (`mae-loja/`).

**Gerar arte (`BarraPedido.tsx`):**
- acha o tema, abre base + tema (Biblioteca, ou a nuvem se não estiverem neste computador);
- preenche NOME e IDADE e calcula a HASHTAG;
- barra do pedido com as variáveis editáveis e os avisos (nome longo / auto-ajuste);
- a "Arte pra impressão" do painel **registra no card**.

**Edição em massa (`EdicaoEmMassa.tsx`):**
- os pedidos pendentes, **agrupados por tema**;
- cada linha: pedido, tema detectado (trocável, com "sempre usar para <produto>" = vínculo), NOME, IDADE e HASHTAG editáveis, **miniatura** (motor) e alertas;
- **Gerar todos**: fila com barra de progresso, 1 PDF por pedido (+ apliques) em `Exportações/AAAA-MM-DD/<pedido>_<nome>/`;
- **resumo** (geradas / com aviso / com erro); as com aviso têm "Revisar", que abre no editor;
- **Juntar num PDF só**.

### Conflitos com a spec (sinalizados antes de codar)

1. **Packs precisam ficar hospedados para serem baixados.** Exceção consciente à regra "nenhuma arte no sistema": no Vercel Blob ficam só os produtos que a Naty **vende**; arte de aluna nunca sobe.
2. **Preço dos add-ons em aberto:** o controle está pronto com o valor por env. Sem valor, "em breve" e não cobra. Contas do beta ganham os dois.
3. **`mae_purchases` não tem coluna de status:** a linha só nasce quando o webhook confirma o pagamento. Sem DDL nova (as 8 tabelas da Sprint 7 bastaram).
4. **O pack encaixa pelo NOME da parte** (os ids mudam de base para base). Ajustes "só nesta caixa" do pack não vêm, porque são da base da Naty.
5. **"Gerar arte" abre o editor numa aba nova** (`/estudio/mae?pedido=…`): a arte precisa da Biblioteca e das fontes do computador, que só o editor tem.
6. **A silhueta usa o alfa da imagem** do elemento. Uma máscara pintada na camada não entra no contorno; use um PNG já recortado.

### Testes

- `npm test`: **239 testes** + 2 pesados (`MAE_SAIDAS=1`). Novos:
  - `apliques.test.ts`:
    - anel → disco (furo preenchido);
    - offset redondo com área exata;
    - dois pedaços próximos viram uma silhueta só; poeira ignorada;
    - MaxRects: sem sobrepor, 2 mm de espaço, fora das zonas da marca, dentro da margem, determinístico; peça grande sobra;
    - apliques ativados por tema, um por face/molde, no tamanho da arte;
    - **elemento real da Naty + marca real**: silhueta a ~3 mm, folhas a 300 dpi com fundo transparente, rótulo do molde, preto cobrindo a peça.
  - `pedidos.test.ts`: campos e aliases, hashtag, tema (variação > produto > campo), fila (um por vez, 20 itens, erro não para, cancelar), status e histórico do card, pack (encaixe pelo nome, caminhos, aviso de parte).
- Teste de tela no Chrome (`scratchpad/fabtest/ui_mae_sprint1112.mts`, servidor simulado): **33 checks, todos ok**:
  - tutorial de primeiro uso (abre sozinho, 7 passos, não volta);
  - **aplique** marcado + apliques do tema (bordinha 1,5 mm, silhueta 3 mm) + marca real: 2 PNG A4 a 300 dpi (`pHYs`), silhuetas pretas, fundo transparente;
  - **card** do pedido "Não gerada" → **Gerar arte** abre o editor no pedido: NOME/IDADE preenchidos, `#MaximilianaValentinafaz4`, o nome entra na arte (auto-ajuste 92%/79% com aviso), editar NOME recalcula a hashtag, arte pra impressão **registrada no pedido** (tema v2);
  - **edição em massa**: 21 pendentes, agrupados por tema, alertas "faltam dados", "tema não encontrado" e "nome longo", tema pelo **vínculo** e pelo campo TEMA, NOME editado → hashtag, miniatura;
  - **"Gerar todos" nos 20 pedidos: 16 geradas + 4 com aviso, 0 erro, em 211 s**; 1 pasta por pedido (PDF + 2 PNG de apliques); **"Juntar num PDF só" = 40 páginas**; os 20 registrados e com "Arte gerada ✓" na linha; o card do pedido passa a "Arte gerada ✓";
  - **Loja**: pack grátis baixado para Packs Naty/ e aplicado pelo nome da parte; aviso "o pack não tem FRENTE, escolha um papel"; pack pago abre a fatura.
- Regressão: telas das Sprints 2, 3+4, 5+6, 7+8 e 9+10 **ok** (com o tutorial marcado como visto, já que ele agora abre sozinho na 1ª vez)..
- `tsc` limpo, lint limpo em `lib/mae`, `components/mae` e `app/api/mae`; `npm run build` ok.

### Pendências

- **Rastreio na Silhouette (Naty)**: abrir `apliques_silhuetas_300dpi.png` + impressos e rastrear com a silhueta de 3 mm.
- **Preço dos add-ons (Júnior):** definir `MAE_ADDON_CRIACAO_PRECO` e `MAE_ADDON_MASSA_PRECO`. A cobrança recorrente desses add-ons (como o SOA Design) entra quando houver preço; hoje só liberam beta e cortesia.
- **Conta da Naty para publicar na Loja:** definir `MAE_NATY_WORKSPACES` (o workspace dela) na Vercel. O Blob já é o do SOA Design (`BLOB_READ_WRITE_TOKEN`).
- Teste de impressão a 100% (Sprint 9); os 5 estilos de nome (Sprint 8); sobra de 10 mm × marcas nos moldes grandes (avaliar sobra menor).
- **Segurança (há 5 sprints):** trocar a senha da conta demo e apagar `C:\vps-gestao\.env.shots`.
- **Fechar o beta e preparar o lançamento:** preço, item no menu do SOA Edition e comunicação.

### Como a Naty testa (Chrome ou Edge)

1. **Apliques:**
   - no tema, selecione um elemento (patinho, urso) e marque **É aplique 3D**;
   - em **Exportar → Apliques 3D**: ligue, bordinha 1 mm branca, deslocamento 3 mm, marca da Silhouette;
   - clique em **Organizar na folha e gerar os 2 PNG**;
   - imprima os impressos a 100%, abra as silhuetas no Silhouette Studio e **rastreie**.
2. **Pedidos:** em Configurações → Campos do pedido, crie **TEMA**, **NOME** e **IDADE**. Num pedido de teste, preencha-os e clique em **Gerar arte** no card.
3. O editor abre com o nome. Confira os avisos e clique em **Arte pra impressão**; o card mostra **Arte gerada ✓**.
4. **Em massa:** clique em **Pedidos (massa)** e confira a lista (temas, alertas, miniatura). Clique em **Gerar todos** (com **Juntar num PDF só**, se quiser).
5. **Loja:** no modo Tema, abra **Loja da Naty** e use **Baixar e aplicar** num pack grátis. A conta da Naty publica um tema como pack.

---

## Sprint 13 — SOA Design dentro do Método MAE (editor unificado, pedidos com a cara do SOA Design) · 04/10/2026

**Pedido do Júnior:** trazer as funções do editor de imagem do SOA Design (o mais parecido com o Photoshop) para o Método MAE e somá-las às dele. "Pedidos e edição em massa" deve ter o mesmo desenho do SOA Design, sem esconder o menu. O que fosse redundante fica só no MAE.

**Decisões do Júnior:**
1. O MAE entra no plano do SOA Design: todo assinante do SOA Design tem a "Criação de artes MAE". A "Edição em massa" por pedidos continua add-on à parte.
2. O editor de imagem salva no computador (Biblioteca) e tem "Guardar em Meus arquivos" opcional para a nuvem.

**Antes de tirar qualquer coisa do SOA Design:** conferido no banco (só leitura) que ele tem só 2 contas, as duas da Naty, em cortesia. Existia 1 design no editor antigo e nenhum kit, template ou arte de pedido. Nenhuma cliente perdeu nada.

### O que foi feito

**1. Pedidos e edição em massa** (`components/mae/EdicaoEmMassa.tsx`, rota `/estudio/mae/pedidos`)
- Página normal do SOA, com o menu visível, no mesmo desenho da Edição em massa do SOA Design: cartões numerados (laranja; verde com ✓ quando feito), abas em "pílula" e o botão grande laranja.
- Os quatro passos:
  1. **Escolha os pedidos**: pendentes / já gerados / todos, agrupados por tema, com "marcar todos do tema".
  2. **Confira nomes, idades e temas**: tabela editável, miniatura, alertas, "sempre usar para <produto>".
  3. **Formato e pastas**: 1 PDF por pedido ou por folha, sobra, linhas, apliques, "Juntar num PDF só".
  4. **Gerar tudo**: barra de progresso, parar, resumo, Revisar.
- Barra para conectar ou reconectar a Biblioteca. O botão "Pedidos (massa)" do editor leva a esta página.

**2. Editor de imagem unificado** (modo Imagem do MAE; `components/mae/EditorImagemMae.tsx`, `lib/mae/editor/materializar.ts`, `lib/mae/texto/livre.ts`)

| Função (vinda do SOA Design) | Como ficou no MAE |
| --- | --- |
| Design com nome, novo nos tamanhos de impressão e de marketplace (Shopee, ML, Elo7, Amazon, Instagram, Pinterest), abrir, salvar | Salva em `Designs/<nome>.mae-design.json`; os tamanhos em px viram mm a 300 dpi. A lista "Abrir…" mostra também os **designs antigos da nuvem**, que continuam abrindo no editor antigo. |
| Páginas (estilo Canva): nova, duplicar com as camadas, mover, excluir | Cada página é uma prancheta; o painel de camadas trabalha na página escolhida. |
| Texto | Camada de texto com parágrafos (Enter) e quebra na caixa; fonte (Google ou do computador), tamanho, cor, alinhamento, Aa/AA/aa/Título, espaçamento, entrelinha, contorno, recursos ss01/swsh/salt. Vira caminho (HarfBuzz): tela = arquivo. |
| Formas | Retângulo (cantos), círculo, triângulo, hexágono, estrela, coração, linha e **seta**; preenchimento e contorno. |
| Camada de ajuste | Vale para tudo o que está abaixo; com "Máscara de recorte", só para a camada de baixo; tem opacidade e máscara. |
| Alças de escala e giro | Transformador no palco (giro de 45 em 45°). |
| Caixa, alinhar, preencher | X, Y, largura, altura e giro; alinhar à página (6) e centralizar; "Preencher a página" e "Ajustar à página"; **espelhar ↔ ↕** em imagens. |
| Filtros | Original, Vivo, Suave, Quente, Frio, P&B, Sépia, Vintage (viram os ajustes não destrutivos do MAE). |
| IA | O **mesmo painel do SOA Design**: remover fundo, apagar, expandir, aumentar resolução, recolorir (1 imagem da cota por uso). O resultado entra como camada nova. |
| Máscara, seleção, pintura, deformar | O editor de pixels do MAE (letreiro, laço, varinha, objeto por IA, pincel, degradê, perspectiva e malha) agora também vale para as imagens do editor de imagem. A máscara anda com a imagem quando ela é movida ou redimensionada. |
| Importar | **PSD com as camadas** (grupos, opacidade, modo de mesclagem, recorte), **PDF por objetos** (desenho, imagens e textos) e imagem. Os arquivos vão para a Biblioteca. |
| Exportar | Todas as páginas ou só a atual; tamanho original (300 dpi) ou de marketplace (encaixar com fundo ou preencher); PNG com fundo transparente, JPG, WebP ou **PDF com as páginas juntas em tamanho real**. Grava na Biblioteca e, opcionalmente, **em Meus arquivos**. |

**3. Fora do SOA Design (redundante, agora só no MAE)**
- **Editor de imagem:** saiu do menu e do início do SOA Design; `/estudio/editor` leva ao editor de imagem do MAE. O design antigo continua abrindo em `/estudio/editor/<id>`.
- **Kits de várias faces (o Método Mãe antigo):** `/estudio/caixas` leva à base do MAE; saiu a aba da Edição em massa e o cartão do Criador de templates.
- **Arte automática por tema na tela do pedido:** deu lugar ao card "Arte (Método MAE)".
- **Acesso:** `addonsDaConta` libera a "Criação de artes MAE" para quem tem o SOA Design.

**O que sobrou no SOA Design:**
- Edição em massa por template (colar lista, planilha, a partir dos pedidos).
- Criador de templates.
- Artes prontas.
- Meus arquivos (nuvem e Google Drive).
- Ações em lote (recortar, redimensionar, ajustes, marca d'água).
- Assinatura e créditos.
- As artes geradas no pedido (`ArtesDoPedido`).

### Testes
- `npm test`: **250 testes**. Novo `editor-imagem.test.ts`:
  - texto quebra na caixa e respeita o Enter; título e maiúsculas;
  - o caminho fica centrado na caixa e gira com ela; o texto aparece no motor;
  - todas as formas, inclusive a seta, e a linha só com contorno;
  - camada de ajuste: vale para o que está abaixo, não para o de cima; opacidade, desligar e recortada;
  - schema;
  - espelhar troca os lados; máscara em degradê acompanha a caixa movida.
- Chrome (`fabtest/ui_mae_editor_imagem.mts`), **17 checks**:
  - design do Instagram (1080×1350 px = 91,44 × 114,3 mm) e IA na camada;
  - imagem com filtro, espelhar e preencher;
  - texto com quebra e MAIÚSCULAS, estrela, camada de ajuste P&B;
  - **alça lateral estica a estrela** (36,6 → 58,8 mm);
  - páginas (duplicar e nova); **PSD com 2 camadas e modo multiplicação**; máscara pelo editor de pixels;
  - exportar: 3 PNG, **PDF de 3 páginas em tamanho real**, JPG 1080×1080 do Instagram;
  - salvar, reabrir.
- Chrome `ui_mae_sprint1112.mts` (pedidos na página nova): **35 checks**:
  - 4 passos em cartões **sem cobrir o menu**;
  - **20 pedidos em lote: 16 geradas + 4 com aviso, 0 erro**, PDF juntado com 40 páginas;
  - cards com "Arte gerada ✓".
- Regressão: telas das Sprints 2, 3+4, 5+6, 7+8, 9+10 e 11+12 **ok** (os testes antigos marcam o tutorial como visto e abrem "Avançado: teste do motor", que agora fica recolhido no editor de imagem).

### Pendências
- **Ainda não veio do SOA Design para o MAE:**
  - objeto inteligente (substituir conteúdo em vários designs);
  - biblioteca de elementos, molduras e grades desenhadas por código;
  - Kit da marca;
  - guias inteligentes;
  - histórico de versões do design (o MAE tem desfazer sem limite e o arquivo na Biblioteca);
  - "Salvar como template" para a Edição em massa do SOA Design (os templates continuam sendo criados a partir de uma arte no Criador de templates).

  Avisar se a Naty sentir falta de algum.
- **Limpeza de código:** o código do editor antigo (`EditorCamadas` etc.) e dos kits (`components/estudio/caixas`) ficou, sem entrada no menu, para o design antigo continuar abrindo. Pode ser apagado quando não houver mais designs antigos.

---

## Lote 1 — Ajustes do teste da Naty (Base, Tema e Editor) · 05/10/2026

**Pedido:** `docs/mae-ajustes-lote-1.md` — 4 erros e 10 melhorias. **Decisões do Júnior:**
1. O ajuste do nome **só no pedido** fica guardado dentro do próprio pedido (`Order.camposExtras._mae.escalas`, campo escondido da tela), sem mudar o banco.
2. **Girar a prancheta** não mexe nos moldes; o MAE avisa se algum ficou fora da folha.

### Etapa 1 — Erros (itens 1 a 4)
- **1. "Só nesta caixa" ignorado no arraste com Shift:** soltar na miniatura da parte (`soltarNaParte`) e na face do palco (`soltarNaFace`) não olhava a escolha "Só nesta caixa". Agora, com ela ativa, papel, elemento e cor vão só para a caixa. `components/mae/acoesVinculo.ts`, `lib/mae/vinculo/tema.ts` (`colocarNaFace` com `empilhar`).
- **2. Ctrl+Z na máscara:** o editor de máscara/pintura não tinha histórico, e o Ctrl+Z desfazia o TEMA por trás. Agora ele tem desfazer/refazer próprio: cada pincelada, borracha, lata, degradê, seleção, inverter e deformação é um passo. Ao "Aplicar", tudo entra como um passo só no tema. O editor principal não reage com a janela aberta. `components/mae/EditorPixels.tsx`, `EditorMae.tsx`.
- **3. Transição: o papel de baixo não aparecia.** Causa: soltar um papel com Shift **na face do palco** ignorava o Shift e **trocava** o papel de fundo, então não sobrava papel embaixo. Agora o Shift empilha. O papel que vale só para uma caixa passou a ficar logo acima dos papéis da parte e abaixo dos elementos (antes ficava por cima de tudo). O motor estava certo: um teste confirma que o degradê revela o papel de baixo. `components/mae/EditorMae.tsx`, `lib/mae/vinculo/resolver.ts`.
- **4. Nomes dos botões:** "Nova área de trabalho" e "+ Nova prancheta".

### Etapa 2 — Botão "Transição" (item 5)
- Na parte: **Transição** → direção (↓ ↑ → ← e do centro) → 2º papel. Na camada criada, **posição** e **suavidade** com prévia na hora.
- Por baixo é uma camada de papel com máscara em degradê (`transition` + `mask.gradient`). O pincel na máscara continua valendo para refinar.
- Respeita "Todas × Só nesta caixa".
- Arquivos: `lib/mae/vinculo/transicao.ts`, `components/mae/PainelTransicao.tsx`.

### Etapa 3 — Moldurinha (item 6)
- **Camada nova `frame`:** a borda da face recuada para dentro com Clipper2. Opções:
  - distância da borda, espessura;
  - linha contínua ou **pesponto** (traço e espaço);
  - cantos vivos ou **arredondados** (raio exato);
  - cor; degradê, traçado, sombras, brilhos e chanfro nos Estilos da camada.
- Clicar de novo cria a **moldura dupla**.
- **Presets** em `Presets/Molduras/*.json` na Biblioteca (local).
- O motor ganhou contorno tracejado (`stroke.dashMm`).
- Arquivos: `lib/mae/vinculo/moldura.ts`, `components/mae/PainelMoldura.tsx`.

### Etapa 4 — Cor sólida (item 7)
- **Camada `solid`:** funciona como papel, trocando o papel de fundo; "Por cima" empilha.
- **Controles:** seletor de tom e saturação, **hexa**, **conta-gotas** (EyeDropper do Chrome/Edge, pega qualquer cor da tela) e **paleta do tema** (`DocTema.palette`, até 24 cores; duplo clique preenche).
- Respeita "Só nesta caixa".
- Arquivo: `components/mae/PainelCor.tsx` (aba **Cor** da Biblioteca do tema).

### Etapa 5 — Tamanho do nome + aviso (item 8) e caixa de transformação (item 9)
- **Tamanho:**
  - **no tema**, deslizador "Tamanho (todas as caixas)" (`textStyles[VAR].sizeScale`);
  - **só nesta caixa**, clicando no texto na folha (`textSlotAdjust`: tamanho, deslocamento, giro, "Voltar ao padrão");
  - **só no pedido**, na barra do pedido e na coluna "Tam. nome" da edição em massa (`PATCH /api/mae/pedidos`).
  - A caixa cresce junto com a fonte, em volta do centro.
- **Aviso:** se o texto sai da face ou encosta numa linha de corte ou dobra (folga de 0,4 mm), fica com **contorno vermelho** e "revise". A lista mostra "O nome passou da face na caixa MILK, revise". Na edição em massa o pedido vai para **revisar**. Vale para NOME, IDADE, HASHTAG e @. Arquivo: `lib/mae/texto/limites.ts`.
- **Caixa de transformação** (`components/mae/CaixaTransformavel.tsx`): arrastar move; os cantos mudam o tamanho mantendo a proporção; a alça de cima gira (Shift = 15°); as setas do teclado fazem o ajuste fino (Shift = maior). Vale para:
  - base, passo 6: NOME, IDADE, HASHTAG e o novo **@ do ateliê** (variável ARROBA, valor da Identidade), com deslizadores de tamanho e giro e campo de ângulo;
  - base, passo 7: logo e QR, com deslizadores de tamanho e giro. O giro sai no PNG e no PDF (QR vetorial girado);
  - tema: o texto clicado.

### Etapa 6 — Pranchetas (itens 10, 11 e 12)
- **10.** Cada prancheta tem uma **barra de título**: arrastar move, com ímã nas bordas, centros e espaço padrão das outras e guias rosa. A posição é salva na base (`xMm`, `yMm` opcionais; bases antigas abrem em fila). **Organizar…** arruma em linha, coluna ou grade.
- **11.** Tamanho e orientação ficam ao lado de "+ Nova prancheta" (já existia na barra; agora com dica).
- **12.** Clicar na prancheta abre o **menu rápido**:
  - **Girar** (retrato ↔ paisagem; avisa os moldes que ficaram fora da folha);
  - **Tamanho** (A4, A5, A6 ou personalizado);
  - **Duplicar** (com os moldes; a cópia já sai nas mesmas partes e com as posições de texto);
  - **Excluir**, com "Excluir a prancheta e os moldes dela?". O Ctrl+Z traz de volta.
- Arquivos: `lib/mae/editor/pranchetas.ts`, `components/mae/PranchetasPalco.tsx`.

### Etapa 7 — Atalhos (item 13) e dicas (item 14)
- **13.** **Ctrl+A** (tudo), **Ctrl+D** (desmarcar, sem abrir o "favoritos" do navegador) e **Ctrl+Shift+I** (inverter) no editor de máscara e seleção. Também entram no Ctrl+Z dele.
- **14.** Janelinha de dica com **nome, frase curta e atalho** em todos os botões do MAE (`components/mae/Dicas.tsx`, dicionário único `lib/mae/ajuda/dicas.ts`). A dica é localizada pelo `data-*` do botão, pelo texto ou pelo title. O teste confere que nenhum botão visível do tema e da base (passos 1 e 6) fica sem frase.

### Testes
- `npm test`: **295 testes**. Os 24 novos do lote estão em `lib/mae/__tests__/lote1.test.ts`:
  - "Só nesta caixa" no arraste;
  - ordem papel da caixa × parte × elemento;
  - degradê revelando o papel de baixo (pixels);
  - transição em cada direção, posição e suavidade;
  - moldura: recuo exato, cantos, pesponto alternando na folha, moldura dupla;
  - cor pintando a face toda e paleta;
  - tamanho tema × caixa × pedido, aviso "passou da face", escala com proporção, giro com Shift;
  - logo e QR girados (matriz e PDF);
  - pranchetas: fila × posição salva, ímã, organizar, girar, duplicar com vínculo, excluir.
- Chrome (`fabtest/ui_mae_lote1.mts`, moldes reais MILK + CUBO): **34 conferências**, todas ✔, cobrindo os itens 1 a 14. Destaques:
  - Ctrl+Z e Ctrl+Shift+Z na máscara sem desfazer o tema;
  - prancheta arrastada com ímã para (0, 249,5) mm;
  - menu rápido com Ctrl+Z;
  - "O nome passou da face na caixa MILK, revise".
- Correção achada no teste: o menu rápido tapava a barra de título (por onde se arrasta). Agora fica dentro da prancheta, e o aviso de "fora da folha" some com o Ctrl+Z.
- Regressão no Chrome: telas das Sprints 2, 3+4, 5+6, 7+8, 9+10, editor de imagem (13) e 11+12 — todas **TUDO OK**. Achado no caminho: uma reserva de espaço para a barra de título no "Ajustar à tela" deslocava a vista; tirada (a barra cabe na margem de 32 px).

### Pendências
- Cor da Moldurinha em **degradê** usa o efeito "Sobreposição de degradê" dos Estilos da camada (não há um seletor de degradê próprio no painel da moldura).
- A dica cobre tudo o que o teste visitou (tema, base passos 1 e 6, editor de máscara). Telas raras sem dica própria mostram o nome e o title; se a Naty achar algum botão sem frase, é só uma linha em `lib/mae/ajuda/dicas.ts`.

## Lote 2 — Ajustes do teste da Naty (marca, exportação, navegação, temas prontos) · 05/10/2026

**Pedido:** `docs/mae-ajustes-lote-2.md` — itens 15 a 26, na ordem 23, 22, 19, 17, 21 / 16, 18 / 25, 24 / 26 / 15.

**Decisões do Júnior:**
1. A escolha à mão do "tema não encontrado" fica **só na Biblioteca** (`Temas/apelidos.json`), sem tabela nova.
2. Etapas na ordem pedida, tudo junto em produção; o teste é no fim.

**Respostas às perguntas:**
- **Item 16:** não era erro. A caixa "É aplique 3D" ficava escondida no fim do painel da camada. Agora fica no topo dele, no botão direito sobre o elemento e num ícone 3D na lista de camadas.
- **Item 25:** a aba Imagem é o **editor livre** (arte sem molde). Foi renomeada para "3. Editor livre", sem juntar com o Tema.
- **Item 26:** não existia caminho para temas prontos. Foi criado reaproveitando base + tema (Etapa 4).

### Etapa 1 — Marca de registro e exportação (itens 23, 22, 19, 17, 21)
- **23. A marca não se perde mais.**
  - O vínculo guarda o código **e a impressão digital (sha256)** do PDF da marca (`registrationPresetSha`). Se o código mudar (marca cadastrada de novo, ou vinda de outro computador), a prancheta acha a mesma marca pelo arquivo.
  - Cadastrar o mesmo PDF de novo reaproveita o código.
  - Vincular a marca **já grava a base** na Biblioteca.
  - Abrir um tema ou pedido **não recarrega** a base aberta quando ela é a mesma, na mesma versão ou mais nova. Essas eram as duas causas prováveis do "voltou para Sem marca".
  - Ao exportar com prancheta sem marca: "As pranchetas X e Y estão sem marca de registro. Exportar mesmo assim?".
  - Arquivos: `components/mae/marcasMae.ts`, `PainelExportar.tsx`, `BarraPedido.tsx`, `PainelTema.tsx`, `lib/mae/schema/prancheta.ts`.
- **22 e 19. Página = prancheta.**
  - Toda página (PDF por prancheta, "tudo junto" e PNG) tem o tamanho e a orientação da **prancheta**.
  - Quando a marca está em outra orientação, quem gira é a **marca**, nunca a arte nem o molde. As zonas da marca giram junto para o aviso de conflito.
  - O PDF "tudo junto" usa o mesmo código das páginas individuais.
  - A arte entra no PDF como **JPG q0,92**: o teste com 2 páginas A4 deu ~0,5 MB, sem perda visível na impressão.
  - Arquivos: `lib/mae/exportar/marca.ts` (`marcaNaFolha`, `zonasNaFolha`), `lib/mae/exportar/pdf.ts`, `components/mae/exportarMae.ts`.
  - Na tela: o editor livre mostra "Página atual: W × H mm · paisagem/retrato". A barra diz "Nova prancheta:" antes do tamanho e da orientação, que valem para a próxima.
- **17. Linha da marca por prancheta:** **MILK** → marca (210 × 297 mm) ▾.
  - ✓ quando tamanho e orientação batem; ⚠️ quando não batem (girada ou diferente).
  - Marca perdida aparece como "⚠️ marca não encontrada".
  - Atalho: "Usar esta marca em todas as pranchetas A4".
- **21. Elementos não vazam mais com a arte inteligente.**
  - Na impressão com sobra, papéis, cores e abas vazam até a sobra.
  - Elementos, NOME, IDADE, HASHTAG, moldurinhas e identidade ficam recortados no contorno exato da face, por uma forma invisível (`clipOnly`) no motor.
  - Opção **"Pode vazar da face"** (`bleed`) no elemento, desligada por padrão.
  - Arquivos: `lib/mae/vinculo/resolver.ts`, `lib/mae/render/renderizar.ts`, `lib/mae/schema/{camadas,tema}.ts`.

### Etapa 2 — Apliques e conclusão da exportação (itens 16, 18)
- **16.** "É aplique 3D" e "Pode vazar da face" aparecem em três lugares:
  - no **topo** do painel da camada, com a frase "Selecione o elemento na arte e marque 'É aplique 3D' no painel ao lado.";
  - no **botão direito** sobre o elemento na folha (`MenuCamadaTema`);
  - no ícone **3D** da lista de camadas.
- **18.**
  - **Barra de progresso** ("Gerando MILK… 2 de 6").
  - Ao terminar, a janela **"Arquivo salvo em Exportações/AAAA-MM-DD/"** mostra a lista e os botões **Abrir o arquivo**, **Mostrar a pasta** (o seletor do sistema abre já nela) e **Copiar caminho**.
  - Alertas e o lembrete de **tamanho real** vêm na mesma janela, com "Não mostrar mais".
  - A demora vinha do PNG gigante no PDF; resolvida pelo JPG do item 22.

### Etapa 3 — Navegação e painel de funções (itens 25, 24)
- **25.**
  - Uma entrada só no menu do SOA, **"Método MAE"**, que abre na **última aba usada**. Ao lado ficam Pedidos (massa), Loja da Naty e Como usar.
  - Abas **"1. Base · 2. Tema · 3. Editor livre"**, com tooltip.
- **24. Barra de ícones fixa na esquerda (Base e Tema).**
  - Clicar abre ao lado **só** aquele painel; clicar de novo fecha. Ícone ativo destacado; dica com frase em cada um.
  - O painel da **direita** fica com as **propriedades da seleção** (camada, "só nesta caixa"), o cabeçalho do tema (nome, Salvar, Fechar) e a Biblioteca/Fontes.
  - Lembra o último painel por aba (`mae:funcao:<aba>`).
  - **Base:** os ícones são os passos 1 a 9, mais "Marca de registro". O "Próximo/Voltar" acompanha o ícone.
  - **Tema:** Papéis, Elementos, Cor, Partes e camadas, Texto, Moldurinha, Transição, Apliques 3D, Marca de registro, Exportar, Tema pronto e Loja.
  - O painel de exportação **fica montado** mesmo fechado, então uma exportação em andamento não se perde. A barra de progresso aparece em qualquer função.
  - Técnica: os painéis continuam sendo um componente só. Cada parte fica em `<Secao ids=[…]>` / `<Secao props>` (`components/mae/Funcoes.tsx`).
  - O "painel clássico" (tudo empilhado) continua disponível com `localStorage['mae:painel-classico']='1'`; os testes antigos usam ele.
  - O editor livre manteve o layout dele.

### Etapa 4 — Temas prontos (item 26)
Ícone **Tema pronto** na aba Tema. O primeiro uso é guiado em 3 passos, com tooltip em todo botão.
1. **Arquivo:** PDF (uma caixa por página) ou PNG/JPG da pasta `Temas/`, ou escolhido do computador (a cópia vai para `Temas/`).
2. **Páginas:** miniatura e nome de cada página (CAIXA MILK, TOPO…), com o tamanho em mm. O nome do tema vem do arquivo, e é ele que o campo **TEMA** do pedido procura.
3. **Textos e salvar:**
   - cada página vira **prancheta + molde retangular + face + parte**;
   - o tema põe a própria página (JPG 300 dpi em `Temas/paginas/<tema>/`) como **papel**;
   - NOME, IDADE e HASHTAG nascem na 1ª página;
   - "Posição dos textos" leva à Base → Nome e textos; "Estilo do texto" leva ao Tema → Texto; **Salvar** grava base e tema.

Detalhes:
- **Base pronta** (`DocBase.pronto`): a exportação sai **sem sobra e sem linhas** de corte/dobra, porque a arte já vem fechada. Marca e identidade continuam valendo (itens 19, 22 e 23).
- **Pedido → tema:**
  - o nome do tema é comparado ao TEMA do pedido **sem maiúsculas, acentos, espaços e pontuação** (`chaveTema`);
  - o vínculo com o produto ou a variação continua vencendo;
  - se não achar, a linha mostra "tema não encontrado — escolha acima". A escolha à mão vai para `Temas/apelidos.json` e vale na hora para as outras linhas com o mesmo TEMA e para os próximos pedidos.
- **Edição em massa:** **TEMA editável** na linha (procura de novo ao digitar); botão "Gerar **selecionados**"; a **miniatura abre ampliada** ao clicar (todas as folhas, em resolução melhor).
- **Nome do arquivo (tema pronto):**
  - `{Nome}_{Idade}anos_{Tema}_{data}`; por caixa, `…_{Tema}_{CAIXA}_{data}`;
  - se o nome já existir, entra o número do pedido (`…_ped1234`);
  - os arquivos ficam soltos em `Exportações/AAAA-MM-DD/`, sem pasta por pedido.
- Arquivos: `lib/mae/temasProntos/montar.ts`, `components/mae/PainelTemaPronto.tsx`, `lib/mae/importacao/navegador.ts` (`paginasDoPdf`, `paginaPdfComoImagem`), `lib/mae/pedidos/pedidos.ts`, `lib/mae/exportar/nomes.ts` (`nomeTemaPronto`), `components/mae/EdicaoEmMassa.tsx`.

### Etapa 5 — Posição dos moldes (item 15)
- **Centralizado por padrão:** numa prancheta que estava vazia, os moldes importados entram no centro, como bloco.
- **Selecionar:** clique no molde (na folha ou na lista); Shift + clique soma ou tira. O contorno fica tracejado laranja.
- **Painel "Posição na prancheta"** (Base → Moldes):
  - **Centralizar**;
  - **alinhar** à esquerda, centro, direita, em cima, meio ou embaixo — **à prancheta** (move o bloco) ou **entre si** (2+);
  - **distribuir** com espaço igual, na horizontal ou na vertical (3+).
- **Setas:** 0,5 mm; **Shift + seta:** 5 mm. Cada sequência é um passo só no Ctrl+Z.
- **Área útil:** a prancheta menos as áreas da marca de registro vinculada (cantos e réguas, + 2 mm de folga).
- Arquivos: `lib/mae/editor/alinhamento.ts`, `components/mae/PainelMoldes.tsx`, `moldesEditor.ts` (`moverMoldes`), `CamadaMoldes.tsx`, `EditorMae.tsx`.

### Testes
- `npm test`: **310 testes** (2 pulados, como antes). Os 15 novos do lote estão em `lib/mae/__tests__/lote2.test.ts`. Cobrem:
  - marca girada e zonas;
  - PDF misto (retrato + paisagem) com cada página na sua orientação;
  - JPG menor que PNG;
  - vínculo pelo sha e selo ✓/⚠️;
  - elemento recortado × papel vazando (pixels) e "Pode vazar";
  - tema pronto: base e tema válidos, página preenchendo a prancheta, TEMA sem espaços, apelido, nome do arquivo com o pedido;
  - área útil, centralizar, alinhar e distribuir.
- Chrome, `fabtest/ui_mae_lote2.mts` (layout novo; moldes MILK + CUBO e marca reais): **38 conferências**, todas ✔, cobrindo os itens 15 a 26.
  - PDF "tudo junto" com 2 páginas paisagem, 0,5 MB.
  - Tema pronto de 2 páginas gerando `Maria-Julia_1anos_Fazendinha-Pronta_CAIXA-MILK_….pdf`.
- Regressão no Chrome, com o painel clássico (Sprints 1, 2, 3+4, 5+6, 7+8, 9+10, 11+12, editor de imagem e Lote 1): todas **TUDO OK** (a Sprint 1 voltou a rodar: o teste não tinha `external: [module]` nem o `window.process`; ficou fora da regressão do Lote 1).
- **Testes antigos ajustados de propósito:**
  - o 9+10 esperava a página girada para a orientação da marca (regra antiga, trocada pelos itens 19/22); agora confere página = prancheta e o alerta "a MARCA foi girada";
  - os testes antigos aceitam o novo "Exportar mesmo assim?" (item 23) e fecham a janela de conclusão (item 18).

### Pendências
- **Apelidos de tema** ficam só na Biblioteca deste computador (decisão 1). Em outro computador, a escolha à mão precisa ser feita de novo uma vez.
- **Mostrar a pasta:** o navegador não abre o Explorer direto. O botão abre o seletor de pastas do sistema já na pasta da exportação, e "Copiar caminho" ajuda a colar no Explorer.
- **Tema pronto em PNG/JPG:** o tamanho em mm parte de 300 dpi. Se a imagem tiver outra resolução, corrija largura e altura no passo 2.

## Lote 3 — Reteste do Lote 1 + itens 27 a 36 · 05/10/2026 (noite)

**Pedido:** `docs/mae-ajustes-lote-3.md`. Ordem:
1. Parte A (9, 10, 12).
2. Erros: 32, 31, 36, 35.
3. Melhorias: 28, 27, 34, 30, 29.

**Decisões do Júnior:**
1. Arrastar pranchetas no Tema muda a arrumação guardada na base, sem contar como alteração e sem versão nova.
2. Base e Editor livre com documentos separados.
3. Deploy junto com o Lote 2, no fim.

**Diagnóstico antes de corrigir.** No Chrome, com mouse de verdade, as alças (9/28), o arraste da prancheta (10) e o menu rápido (12) funcionavam, inclusive compilando com o React Compiler, como em produção, e com a tela em 150%. As causas prováveis eram de uso:
- arraste e menu só existiam na aba Base, e só pela barrinha de título;
- as alças tinham 9 px e não mostravam nada até soltar o mouse.

Os harnesses agora compilam com o React Compiler (`fabtest/compilador.mts`).

### Etapa 1 — Pendências do Lote 1 (9, 10, 12)
- **9.** "Girar (todas as caixas)" no painel de texto (`EstiloTexto.rotationDeg`). Ele soma com o giro da posição e com o "só nesta caixa". Todo giro em graus ganhou o botão **0°** (texto, logo, QR, posição de texto). O campo numérico vem do item 27.
- **10.**
  - Barra de título e arraste das pranchetas em **todas as abas**, também pela **borda** da prancheta (cursor de mover).
  - "Organizar" na barra e no menu rápido.
  - A arrumação é a mesma na Base e no Tema, porque é a do mesmo documento.
  - "Mover prancheta" e "Organizar" são **só vista**: não contam como alteração e não mudam o arquivo exportado.
- **12.**
  - O menu rápido aparece em todas as abas.
  - Na Base e no Editor livre: Girar, Tamanho, Duplicar e Excluir (com "Excluir a prancheta e os moldes dela?" e Ctrl+Z).
  - No Tema: só Organizar, com o aviso de que as pranchetas vêm da base.
  - A tecla **Delete** exclui a prancheta selecionada.
  - Duplicar uma página do editor livre gera ids novos nas camadas.
- Arquivos: `PranchetasPalco.tsx`, `EditorMae.tsx`, `PainelTexto.tsx`, `PainelBase.tsx`, `lib/mae/editor/pranchetas.ts`, `lib/mae/vinculo/resolver.ts`, `lib/mae/schema/tema.ts`.

### Etapa 2 — Erros (32, 31, 36, 35)
- **32. Estilo de camada desfazia a moldurinha.** Eram duas causas:
  1. A moldura era uma **linha com traço**: o Traçado engrossava a linha central e a "área" da camada virava a face inteira.
  2. A **caixa** da moldura ia como `[x, y, largura, altura]`, mas o motor usa `[x0, y0, x1, y1]`. O buffer dos estilos cortava a moldura numa linha reta. O mesmo erro estava nas formas e na **cor sólida**.
  - Agora a moldura é um **anel preenchido** (Clipper2; pesponto = um polígono por traço), e a caixa vai certa.
  - Traçado (por fora, dentro, centro), sombra, brilho, chanfro e degradê acompanham a linha em retângulo, triângulo e coração.
  - Arquivos: `lib/mae/vinculo/moldura.ts`, `lib/mae/vinculo/resolver.ts`.
- **31. Ctrl+Z global.** Uma **linha do tempo** registra a ordem dos passos da base, do tema e do design (`lib/mae/editor/linhaDoTempo.ts`).
  - Ctrl+Z e a setinha desfazem **o último passo**, venha de onde vier. Antes, no Tema, o Ctrl+Z só desfazia o tema e a prancheta criada não voltava.
  - Refazer: **Ctrl+Shift+Z** e **Ctrl+Y**.
  - Deslizar um controle conta como um passo só. A dica da setinha mostra o nome do passo.
  - A janela de máscara mantém o histórico próprio.
- **36. Cada aba com os seus botões.**
  - **Base:** Nova base · Abrir base · + Nova prancheta.
  - **Tema:** Novo tema · Abrir tema (recentes primeiro).
  - **Editor livre:** Novo design · Abrir design · + Nova página.
  - "Nova área de trabalho" saiu.
  - O topo mostra sempre o que está aberto, por exemplo **"Tema: Ursinha Princesa · Base: KIT FESTA v3"**.
  - Base e Editor livre têm **documentos separados**: trocar de aba guarda o de cada uma.
- **35. Abrir base** (`components/mae/AbrirBase.tsx`).
  - Lista as bases com miniatura, nome, versão, nº de moldes, data da edição e "usada em N tema(s)".
  - Ações: **Abrir** (pergunta se quer salvar a aberta), **Duplicar** e **Excluir**.
  - Excluir apaga da Biblioteca e da nuvem: `DELETE /api/mae/bases/[id]`, **sem DDL**. Recusa com aviso se algum tema usa a base, porque os pedidos dependem dela.
  - Ao salvar: "Esta base é usada em N tema(s). As mudanças vão valer para eles (os pedidos já gerados não mudam)".
  - No tema: "⚠️ N faces sem papel", contando as faces de partes que o tema ainda não vestiu. As abas sem parte não contam, porque a arte inteligente cobre.

### Etapa 3 — Melhorias (28, 27, 34, 30, 29)
- **28. Alças (Ctrl+T).**
  - O contorno **acompanha o mouse** durante o arraste.
  - **Cantos:** escala presa no canto oposto; **Alt** = a partir do centro.
  - **Laterais:** esticam só a largura ou só a altura (posições de texto).
  - **Giro:** Shift = 15°.
  - Cursores de redimensionar, mover e girar (seta curva). Alças maiores, com área de clique de 12 px.
  - Nas alças dos elementos do tema, o Alt continua sendo "só nesta caixa".
- **27. Campo numérico** ao lado de **todo** controle deslizante (`components/mae/Deslizador.tsx`):
  - unidade (pt, mm, %, °), sincronizado com o controle;
  - ↑↓ = 1, Shift = 10; Enter confirma, Esc cancela.
  - Cobre texto, base, efeitos, camada, moldura, transição, apliques, pincel, tamanho do nome no pedido e na massa.
- **34. Várias partes de uma vez** (Tema).
  - Seleção: **Ctrl + clique** na parte, **Ctrl + arrastar** um retângulo na folha, **Ctrl+A**.
  - O painel mostra "N partes selecionadas".
  - Papel, elemento, cor, moldurinha (e preset) e transição vão para todas **num passo só** do Ctrl+Z.
  - Também: **opacidade** de todas e **Copiar estilos da camada** para as camadas do mesmo tipo.
  - Cada parte recebe a sua própria camada e continua editável sozinha.
  - Camadas do tema ganharam **opacidade** (`opacity`), também no painel da camada.
- **30. "Salvar as alterações em … antes de continuar?"** (Salvar · Não salvar · Cancelar).
  - Vale ao abrir ou criar base, tema ou design, e ao fechar a aba do navegador.
  - Cada histórico guarda a marca de "salvo". Desfazer até ela volta a "sem alterações".
  - Arrumar pranchetas não conta.
- **29. Papel em padrão repetido.**
  - No painel da camada de papel: **Preencher** ou **Repetir (padrão)**, com tamanho do azulejo em mm, **Espelhar repetição** e **mover o padrão**.
  - O tamanho é em mm da folha, então a estampa tem a mesma escala em todas as faces da parte.
  - O resolver gera os azulejos (com folga para a sobra), recortados na face; o motor não mudou.

### Testes
- `npm test`: **322 testes** (2 pulados). Os 12 novos estão em `lib/mae/__tests__/lote3.test.ts`:
  - moldura numa face triangular com Traçado, sombra, brilho e chanfro (pixels: sem faixa e sem corte reto);
  - giro do texto em todas as caixas;
  - duplicar página com ids novos;
  - Ctrl+Z global na ordem certa (base × tema) e passo juntado;
  - marca de "salvo";
  - Base × Editor livre separados;
  - faces sem papel;
  - azulejos (tamanho em mm, espelho, pixels) e opacidade;
  - cor sólida com sombra.
- Dois testes antigos foram ajustados de propósito para a regra nova:
  - `lote1.test.ts`: a moldura agora é forma, não traço;
  - `edicao.test.ts`: a caixa `[x0, y0, x1, y1]`.
- Chrome, `fabtest/ui_mae_lote3.mts` (layout novo, **React Compiler**, moldes reais): **TUDO OK** — alças com o mouse (prévia ao vivo, canto oposto, lateral, giro com Shift), caixinha numérica (digitar e ↑/Shift+↑), menu e Delete da prancheta, Ctrl+Z/Ctrl+Y/setinha, abas com os seus botões e nome no topo, arrastar prancheta no Tema (só vista), Ctrl+Z na ordem certa, girar texto, padrão repetido, Ctrl+A e Ctrl+clique em partes com cor num passo só, "Salvar as alterações…", Abrir base (miniatura, duplicar, excluir, trava de tema) e Editor livre separado.
- Regressão no Chrome (Sprints 1–12, editor livre, Lotes 1 e 2): todas **TUDO OK**. Os testes antigos foram ajustados ao item 36 ("Nova base" / "Novo design" no lugar de "Nova área de trabalho") e ao 30 (respondem "Não salvar").

### Pendências
- Os temas recentes ficam no navegador (`localStorage`). Em outro computador, a lista começa sem recentes.
- "Excluir base" na nuvem exige estar logada. Sem conexão, nada é apagado e a tela avisa.
- As alças dos **elementos** do tema continuam escalando pelo centro, porque o Alt delas já é "só nesta caixa". As da posição de texto, logo e QR seguem o padrão Photoshop.

## Lote 4 — Reteste + itens 38 a 52 · 06/10/2026

**Pedido:** `docs/mae-ajustes-lote-4.md`. Prioridades: P1 (43, 44, 52, 50, 47, 49, 41), P2 (21, 29, 30, 34, 51, 45, 46, 48, 40, 42), P3 (38, 39).

**Decisões do Júnior:**
1. Migrar os pedidos antigos (campo único "Nome e Idade" → NOME e IDADE), com backup.
2. Criar os campos NOME e IDADE no cadastro do ateliê da Naty.
3. Fazer todas as etapas e subir tudo no fim.

**Diagnóstico dos "não chegou" do Lote 3 (29, 30, 34).** O código existia e passava no Chrome. O problema era o caminho até ele:
- **29:** o "Repetir" só aparecia pelo papel da lista de camadas; clicar na face nunca selecionava o papel.
- **30:** exportar e vincular a marca salvavam a base em silêncio. Abrir pelo pedido, pela loja e "outro tema pronto" não perguntavam. Sair pelo menu do SOA não dispara o aviso do navegador.
- **34:** o Ctrl+clique só funcionava nas miniaturas.

### Etapa 1 — Edição em massa e exportação (43, 44, 47, 49)
- **43. Lista da edição em massa.**
  - A linha abre a edição ali mesmo (NOME, IDADE, TEMA e o tema da arte), inclusive nas que "faltam dados".
  - Tab passa de campo; Enter grava no pedido e abre o próximo; Esc fecha.
  - Ao escolher o tema: **"Usar … para todos os pedidos de <produto>?"**
    - Sim: vínculo na Precificação ou, se o produto não está lá, apelido `produto:` em `Temas/apelidos.json`.
    - Não: lembra produto + TEMA.
  - Cada linha mostra o produto e a variação.
  - `PATCH /api/mae/pedidos` aceita `campos` e grava no campo que o ateliê usa (`campoParaGravar`), com merge `jsonb ||`.
- **44. NOME e IDADE.**
  - `separarNomeIdade` é conservador: duas crianças, meses, recado ou número solto vão para "revisar" e o texto original aparece na linha.
  - **Tema com produto** (`DocTema.produto`): a arte é produto + tema. Com dois "Ursinha", vale o do produto do pedido. O Tema pronto pergunta o produto e sugere pela subpasta (`Temas/<Produto>/<Tema>.pdf`).
  - O tema com produto é salvo em `Temas/<Produto>/` e a cópia antiga sai.
  - Pedido com vários produtos gera um arquivo por produto (`alvosDoPedido`).
  - Exportações em `Exportações/AAAA-MM-DD/<Produto>/<Nome>_<Idade>anos_<Tema>.pdf`, com acento e sem a data no nome.
  - "Juntar num PDF só **por produto**".
- **47. Aplique fora da caixa.** `resolverPrancheta({ semApliques })` só na impressão da caixa. As folhas de aplique continuam achando o elemento. Na tela ele tem contorno pontilhado azul e o selo "3D · só na folha de aplique".
- **49. Avisos.**
  - `checarAntes` roda antes de gerar, sem gravar arquivo: texto que passou da face e prancheta sem marca.
  - A janela tem resumo no topo, avisos agrupados, "Ir até" (seleciona e enquadra a prancheta), rodapé fixo com Revisar · Exportar mesmo assim, até 70% da tela com rolagem, e fecha com X, Esc e clique fora.
  - A janela de concluído ganhou o mesmo tratamento.

### Etapa 2 — Textos (52, 50)
- **52.** `lib/mae/editor/textosReplicar.ts` + `components/mae/TextosPaginas.tsx`:
  - "Colocar em todas as páginas" (mesma posição relativa, uma por página);
  - "+ NOME · + IDADE · + HASHTAG" na barrinha da prancheta e no painel;
  - Ctrl+C / Ctrl+V cola na prancheta selecionada; Ctrl+J duplica; Alt + arrastar duplica; arrastar até outra página leva o texto.
  - Variável e estilo são os mesmos; "Só nesta caixa" continua por posição.
- **50.** Painel do NOME com **Nome simples** e **Nome composto**:
  - tamanho, entrelinha, 1 ou 2 linhas e posição por modo, por caixa ou em todas;
  - prévia com "Isis" e "Ana Júlia";
  - a quebra mantém "de/da/dos…" com o 2º nome;
  - na lista da massa, "Linhas" força 1 ou 2 só naquele pedido (`camposExtras._mae.linhas`).

### Etapa 3 — Girar a prancheta (41)
- `lib/mae/editor/giroMolde.ts`: o giro do molde, de 90° em 90°, vale em todo lugar: tela (grupo girado, clique, seleção), resolver, recortes, linhas, logo/QR, "por molde", organizar e miniatura da base.
- Girar ↻ e ↺ leva os moldes junto e recentraliza. Se não couberem, pergunta "girar só a folha". As outras pranchetas não pulam.
- Molde girado usa as linhas detectadas (vetor das faces) no PDF, não o PDF original.

### Etapa 4 — Pendências e acabamento (21, 29, 30, 34, 42, 40)
- **21.** O elemento "Pode vazar da face" sai inteiro, sem recorte, depois de todas as faces. No PDF entra numa camada transparente desenhada **depois** das linhas de corte (`PaginaPdf.sobreLinhas`).
- **29.** Clicar na arte seleciona o elemento de cima; clicar no papel, o papel. "Preencher · Repetir (padrão)" é a 1ª coisa do painel.
- **30.** As trocas que faltavam perguntam antes: abrir pedido, pack da loja, "outro tema pronto" e sair do MAE por link do SOA.
- **34.** Ctrl+clique na face soma ou tira a parte; as partes ficam destacadas na folha; soltar um arquivo vai para todas.
- **42.**
  - Clicar de novo no título não desmarca a prancheta.
  - Clicar na prancheta seleciona em todas as abas.
  - A seleção some se o Ctrl+Z tirar a prancheta.
  - O menu fica sempre dentro da tela.
- **40.**
  - Saíram "Gravar/Ler teste", a lista de fontes, o cronômetro e o PNG de teste do motor.
  - A pasta da Biblioteca foi para Configurações (engrenagem). No painel ela só aparece para escolher ou reconectar.

### Etapa 5 — Painéis e apliques (45, 46, 48)
- **45.**
  - **Camadas:** partes + camadas.
  - **Moldurinha:** nova, molduras salvas com miniatura e editor.
  - **Transição:** já aberta, com prévia.
  - **Formas:** ícone próprio.
- **46.** Miniatura ao vivo do aplique (silhueta + bordinha + imagem) e "Ver folhas de aplique" antes de gerar.
- **48.** Folhas de aplique em retrato ou paisagem. A marca de registro e as áreas dela giram junto (`girarZonas`).

### Etapa 6 — Máscara de corte (51)
- Camada `recortada`: Alt + clique na lista (↳ e recuo), Ctrl+Alt+G, botão direito "Criar/Soltar máscara de corte".
- Texto: "Preencher com papel" (`EstiloTexto.textura`, movível e redimensionável), que acompanha o nome na massa.
- O preset de efeito leva a textura junto. Fica na cópia deste computador; a nuvem guarda só os efeitos.
- Motor: base com estilos recorta pela FORMA, e traçado, chanfro e sombra/brilho internos voltam por cima da textura.

### Etapa 7 — Layout (38, 39)
- **38.** O menu principal do SOA esconde e reabre pelo botão "Menu" flutuante. A escolha fica lembrada no navegador; no MAE já abre recolhido.
- **39.** Barra de opções no topo (ferramenta, dica, "Todas as caixas × Só nesta caixa"), painel de propriedades recolhível, Tab esconde e mostra todos os painéis.

### Migração (item 44) — 06/10/2026, Artes e Tal
- Backup: `C:/vps-gestao/backups/mae_lote4_nome_idade_*.json`.
- Campos **Nome** (ordem 51) e **Idade** (52) criados logo depois de "Nome e Idade". O campo antigo continua ativo, com os valores intactos.
- **2.868 de 3.500** pedidos ganharam Nome e Idade. **630** ficaram para revisar na lista, com o texto original. A separação na hora cobre os que chegarem pelo campo antigo.

### Testes
- `npm test`: **348 testes** (2 pulados). 26 novos em `lib/mae/__tests__/lote4.test.ts`:
  - separar nome e idade com amostras reais;
  - produto + tema, alvos por produto, pastas e nomes;
  - aplique fora da caixa;
  - colocar em todas, +IDADE, colar e duplicar;
  - partícula na quebra e modo por caixa;
  - giro de ida e volta, arte e linhas giradas;
  - vazar da face;
  - orientação das folhas;
  - máscara de corte em pixels: textura dentro, traçado por fora visível, traçado por dentro por cima.
- Ajustados de propósito:
  - `lote2.test.ts`: o nome do arquivo do tema pronto (sem data, com acento);
  - `lote1.test.ts`: girar "só a folha".
- Chrome com o **React Compiler**:
  - `fabtest/ui_mae_lote4.mts`: 40, 52, 42, 41, 29, 34, 45, 51, 50, 39, 49 — **TUDO OK**;
  - `fabtest/ui_mae_lote4_massa.mts`: 43, 44 com a API simulada — **TUDO OK**;
  - regressão `ui_mae_lote3.mts` — **TUDO OK**.

### Pendências do Lote 4 — resolvidas no mesmo dia (06/10, 2ª entrega)
- **21 (tela):** uma 2ª prévia transparente, só com o que vaza e os textos, é desenhada **por cima** das linhas do molde (`usePrevias(..., fundo null)`). Na tela também fica inteiro por cima da linha.
- **50 (efeitos):** "Efeitos próprios do nome composto" (`EstiloTexto.efeitosComposto`). O editor de estilos passa a mexer nos do composto, e o resolver usa os do composto quando o nome tem 2 ou mais palavras.
- **51 (preset na nuvem):** coluna `mae_effect_presets.textura` (jsonb). A migração aditiva `scripts/migrar-mae-preset-textura.mjs` foi aplicada no neondb antes do deploy. A API grava e devolve a textura, e o preset vale em qualquer computador da conta.
- **46 (folhas na área de trabalho):**
  - "Ver folhas de aplique" põe as folhas de impressos e de silhuetas como **pranchetas de prévia** à direita das pranchetas do tema, com enquadramento automático (`components/mae/folhasAplique.ts`).
  - São só vista: não vão no arquivo do tema.
  - "Fechar" e "Atualizar" tiram ou refazem as folhas.
- **39 (opções no topo):** `components/mae/OpcoesFerramenta.tsx`. Cada ferramenta mostra as opções principais do que está selecionado:
  - **texto:** tamanho, cor, alinhamento, caixa;
  - **moldurinha:** distância, espessura, contínua/pesponto, cantos, cor;
  - **transição:** direção, posição, suavidade;
  - **papel/elemento:** escala, giro, opacidade, preencher/repetir, vazar, aplique, ocultar;
  - **Base:** posição de texto (tamanho, giro, + NOME/IDADE/HASHTAG) e prancheta (girar ↻ ↺, duplicar).
- Corrigido junto: a prévia da transição usava nomes de direção errados (agora segue `degradeDaTransicao`).
- Testes:
  - `npm test`: **350** (2 pulados), com os novos efeitos do composto e textura no preset;
  - Chrome `ui_mae_lote4.mts` (mais 21 tela, 50 efeitos, 39 barra, 46 folhas): **TUDO OK**;
  - regressões `ui_mae_lote3.mts` e `ui_mae_lote4_massa.mts`: **TUDO OK**.

### Pendências
- 44: os 630 pedidos "para revisar" aparecem com o texto original na linha da massa. O campo antigo "Nome e Idade" pode ser desligado em Configurações → Campos do pedido quando a equipe passar a usar só NOME e IDADE (decisão da Naty).
