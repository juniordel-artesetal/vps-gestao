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

---

## Lote 5 — Reteste do Lote 4 + itens 53 a 79 · 09/10/2026

**Pedido:** `docs/mae-ajustes-lote-5.md`. **Decisões do Júnior:**
- Fazer tudo e subir no fim.
- No item 72, um tema só, com "Tema · Grupo" gerado na hora por grupo (sem duplicar arquivos).

**Valores padrão adotados** (as duas perguntas de modelo de dados ficaram sem resposta):
- A quantidade do kit vem da **Precificação**: as peças da linha do pedido e os kits vendidos (`qtdVendida`).
- Os campos extras usam os **campos de pedido do ateliê** (mesmo nome, sem acento/maiúscula). Se o campo não existir, entram com o próprio nome.

### P1 — arte final e edição em massa
- **68. Arte inteligente**
  - Contorno **único** da prancheta = união das faces + sobra (Clipper2). A faixa entre o corte e o contorno é dividida entre as faces: cada face cresce a partir de si, em passos de 0,5 mm.
  - Sem sobreposição e sem atravessar a dobra. Os vãos ficam com a face do lado.
  - A cor sólida também ganha sobra.
  - Aba sem papel continua o papel da **face vizinha**: entra na região da vizinha, com o papel desenhado uma vez.
  - Linhas impressas vêm **desligadas** por padrão (com migração do que estava salvo no navegador).
  - A sobra (mm) vem da Base (fonte única).
  - Arquivos: `lib/mae/exportar/sobra.ts` (`regioesDeImpressao`, `fatorParaCobrir`), `lib/mae/vinculo/resolver.ts`.
- **58.** As posições de NOME, IDADE e HASHTAG ficam na **Base**:
  - "Salvar tema" agora salva a Base alterada;
  - o cache da massa relê a Base salva (`versaoBasesSalvas`);
  - ir para Pedidos com alterações pergunta antes;
  - a miniatura mostra todas as folhas.
- **71.** O papel **substitui** a cor sólida (com Shift, entra por cima). "Só nesta caixa" também troca.
- **70.** Preencher, Repetir, tamanho, espelhar, mover e opacidade respeitam "Só nesta caixa": o ajuste local guarda `repeat` e `opacity`.
- **65.** Causa: o modo "Só nesta caixa" ficava lembrado e o papel solto no cartão ia para uma caixa só, por baixo.
  - Agora soltar ou clicar no cartão vale para a parte toda.
  - Se o arquivo não puder ser lido, aparece um aviso.
- **67.** Causa: focar a caixinha numérica e sair gravava o valor herdado, e o aplique virava "personalizado" sem a usuária perceber.
  - Agora só grava quando o valor muda.
  - Selo "Personalizado" com "Voltar ao padrão do tema".
  - Resumo "N apliques: X usam o padrão, Y personalizados" e a pergunta "Aplicar também nos personalizados?".
  - A prévia do painel mostra o padrão, e as folhas abertas se atualizam.
- **56.** Soltar o texto sobre outra face (Base ou Tema) leva o texto para ela com o **mesmo tamanho em mm**. O deslocamento é limitado (−1..1), então o texto nunca some e o tema salva.
- **53.** Delete, Backspace, lixeira no painel e "Excluir" no clique direito (`components/mae/excluir.ts`):
  - texto: sai só daquela caixa;
  - camada: "só nesta caixa" esconde ali; "todas" pede confirmação;
  - logo e QR no Tema: "travado";
  - Ctrl+Z desfaz.

### Estrutural
- **72. Grupos de produto** (`lib/mae/editor/grupos.ts`, `components/mae/PainelGrupos.tsx`; `DocBase.grupos`, `DocTema.gruposDesligados`):
  - Pastinhas com arrastar entre grupos. Alt ou "Usar também em…" põe o mesmo molde em mais de um grupo.
  - Criar, renomear, reordenar e excluir. Excluir manda os moldes para "Sem grupo".
  - Cada grupo pode ser ligado a um produto ou variação da Precificação.
  - No tema: "Este tema gera" lista "Tema · Grupo", e dá para desligar grupos.
  - Na massa: item do pedido → grupo (variação → produto → nome) → `docDoGrupo` → um PDF por produto, na pasta do grupo.
- **73. Nome + idade** (`NOME_IDADE`): empilhado (duas linhas presas na mesma caixa, giram juntas; sem idade, o nome recentraliza), na mesma linha, ou "Nome faz 5". Ajustes: idade em % do nome e espaço entre as linhas.
- **74. Fundo do texto:**
  - faixa que acompanha o texto (sobra lateral, altura em %, texto um pouco acima, cantos, cor, papel dentro, estilos de camada próprios);
  - ou a logo, com a área do nome marcada. A logo não deforma; "esticar só na largura até X%".
- **75. Trocar letra:**
  - regra do tema (letra → outra fonte, só na inicial ou em todas, com tamanho, base e espaço);
  - no "Ajustar" do pedido, a letra pode ser trocada só naquele pedido (`_mae.trocas`).
  - As fontes das trocas são carregadas junto com as do tema.
- **76. Folha montada** (`lib/mae/editor/folhaMontada.ts`, `components/mae/PainelFolhas.tsx`):
  - Peça = molde. Folha = modelo com marca de registro (a área dela fica livre).
  - "Preencher folha" (em pé ou deitada, a que couber mais), folha mista, aproveitamento, arrastar e girar 90° à mão.
  - A folha é ligada a um grupo. Na massa vira uma **prancheta virtual** (`docDaFolha`): sai 1 folha por kit, com a marca, o SVG/DXF de corte e a sobra de cada peça.
- **77. Campos extras e frase:**
  - "+ Campo" na Base (vira coluna na lista da massa) e FRASE com valor padrão no tema.
  - No arquivo do pedido, campo vazio **some** (`_PEDIDO`).
- **78. Lista nova** (uma linha por pedido):
  - prévia; NOME, IDADE, FRASE e campos editáveis;
  - formato da idade por pedido;
  - 💬 observação do pedido;
  - Quantidades, Ver, Ajustar e Gerar;
  - abas Pendentes × Já gerados (com data/hora e "Gerar de novo");
  - "Selecionar aprovados" = em produção ou com um campo de aprovação marcado.
- **79. PDF na quantidade:**
  - "Já sair na quantidade do pedido" (padrão) ou "1 de cada".
  - O PDF reaproveita a imagem embutida: 42 páginas ficam do tamanho de 6.
  - "Quantidades" vem do kit ÷ caixas, com ⚠️ quando não divide. O contador "36 de 36 ✓" avisa sem travar, e o resultado fica salvo no pedido (`_mae.quantidades`).

### P2 / P3
- **59. Ajustar** (`?ajustar=1`):
  - O tema fica travado; os textos do pedido mexem só nele (`_mae.posicoes`).
  - Dá para escolher 1 ou 2 linhas por caixa e trocar uma letra.
  - "Usar como padrão do tema" e "Voltar ao padrão".
- **62. SUFIXO:** ANO/ANOS, ANINHO/ANINHOS, MÊS/MESES; formato e caixa no tema; formato por pedido; segue o estilo da IDADE.
- **66. Cenário contínuo:**
  - parte da Base marcada "cenário contínuo", ou "só nesta caixa" no Tema (`tema.cenarios`);
  - a arte se enquadra na união das faces; a moldurinha contorna o cenário ou cada face.
- **57.** "Colocar em páginas…" com a escolha das pranchetas.
- **64.**
  - Biblioteca por tema: `Papéis/<Tema>/`, `Elementos/<Tema>/`, a pasta "Uso geral" e "Buscar em outros temas".
  - "Duplicar tema" leva tudo.
  - ⚠️ A herança de estilo de texto **não foi reproduzida**: o `novoTema` já nasce zerado. Pedir à Naty o passo a passo.
- **63.**
  - O papel das abas foi para o Tema: face vizinha (padrão), papel ou cor.
  - A Base ficou só com a Sobra.
  - O seletor de imagem tem miniaturas (`SeletorImagem.tsx`).
  - Saíram os textos "Sprint N" da tela.
- **69.**
  - Clicar na parte no painel = todas as caixas. Clicar na face na arte = "Editando só: MILK".
  - Os botões dizem onde aplicam ("Nova moldurinha em todas as 2 FRENTE").
- **61.** Moldes, Pranchetas e Faces com painéis próprios. Ícones novos: Grupos de produto e Folhas de impressão.
- **54.** Fontes com prévia no próprio formato (amostra "Ana Júlia"):
  - busca e favoritas;
  - mouse ou ↑↓ mostram na arte, e sair sem clicar volta;
  - só as visíveis carregam.
- **55.** OpenType em português (Floreios, Estilo N, Letras alternativas…), só os recursos da fonte, os técnicos em "Avançado", com prévia do nome.

### Testes
- `npm test`: **362** (2 pulados). `lib/mae/__tests__/lote5.test.ts` tem 33 testes:
  - 68: MILK e MALETA reais — sem branco no corte, sobra 9–11 mm, sem invasão, regiões disjuntas;
  - 71, 70, 56, 79 (divisão e PDF 42×6), 72, 62, 73, 74, 75, 77, 76, 66, 55.
- O teste de tempo da prévia (< 0,3 s) às vezes passa do limite quando a suíte inteira roda em paralelo; isolado, passa.
- Chrome com o React Compiler:
  - `fabtest/ui_mae_lote5.mts`: 61, 72, 76, 66, 62/73/77, 63, 64, 69, 74, 75, 54, 53 — **TUDO OK**;
  - `fabtest/ui_mae_lote5_massa.mts`: 78, 77, 62, 59, 79, 60 — **TUDO OK**;
  - regressões `ui_mae_lote4.mts` e `ui_mae_lote3.mts` — **TUDO OK**, ajustadas para a pasta do tema (64) e o "Colocar em páginas…" (57).
  - `ui_mae_lote4_massa.mts` foi substituído pelo da lista nova.
- `npm run build` ok.

### Pendências do Lote 5 — resolvidas no mesmo dia (09/10, 2ª entrega)
- **76. Aproveitar folhas (juntar pedidos).** Opção da edição em massa, **desligada** por padrão.
  - A folha montada ganhou **Tipo**:
    - **Kit**: as peças do pedido nunca se dividem entre folhas; se não cabem no que sobrou, vão para a próxima. Kit maior que a folha ocupa folhas só dele.
    - **Avulso**: preenche os buracos e continua na folha seguinte (peças ÷ capacidade → N folhas). Tem a opção "Completar a última folha com cópias" (senão, os lugares ficam vazios).
  - As peças de cada pedido ficam **juntas, na ordem de leitura**, nunca intercaladas. Cada peça recebe os textos do **seu** pedido (`valoresPorSlot`, por posição).
  - Fora da linha de corte, em cima da 1ª peça do pedido, sai `#123 · Naty`.
  - Saída: `LOTE_<peça>_<dd-mm>.pdf` (+ SVG/DXF) e `LOTE_…_separacao.txt` (`Folha 1 → #123 · Naty (6), #124 · Davi (6)`). A arte é registrada em **cada** pedido.
  - Só juntam pedidos com o **mesmo tema e a mesma folha**.
  - A folha avulsa já faz a conta de N folhas mesmo com a opção desligada (um pedido por arquivo).
  - Motor: `distribuirLote`, `docDoLote` e `ordemDeLeitura` em `lib/mae/editor/folhaMontada.ts`. Na exportação: `valoresPorSlot`, `nomeArquivo` e `rotulos`.
- **77. FRASE presa ao nome.** Em NOME e em Nome + idade: "Frase junto do nome" com as posições:
  - **Em cima / Embaixo**: linha própria, com o estilo da FRASE, tamanho em % do nome e espaço próprio;
  - **Antes / Depois**: na mesma linha.
  - A frase anda e gira com a caixa do nome. A frase padrão é do tema e o pedido troca na lista.
  - **Campo vazio no arquivo do pedido some e os outros textos da mesma face recentralizam** (`recentralizar`), não só dentro do bloco.
- **73.** Bloco Nome + idade: caixa "Estilo próprio para a idade". Ela cria o estilo `NOME_IDADE:IDADE`, que aparece como **"Idade do bloco"** nos botões do texto (outra fonte e outros efeitos). Desmarcar volta ao estilo do bloco.
- **74.** O preset de efeito guarda o **fundo do texto** (faixa/logo) e aplica junto.
- **75.** Trocar letra:
  - **"Outra fonte"** ou **"Outro glifo desta fonte"**: a letra normal, as alternativas OpenType e os floreios guardados fora do teclado;
  - as trocas vão para o **preset**.
  - O preset novo usa um envelope `{_v:2, textura, fundo, trocas}` na coluna `textura` (jsonb), **sem DDL**; os presets antigos continuam valendo.
- **64.** Herança de estilo entre temas não reproduzida. Correção defensiva: `ESTILO_PADRAO` agora é **congelado**. Quem for editar faz uma cópia, e uma alteração acidental nele quebra na hora em vez de passar para todo tema novo.

### Testes (2ª entrega)
- `npm test`: **394** (2 pulados). `lote5.test.ts` tem **39** testes:
  - frase em cima / antes / vazia, estilo da idade do bloco, recentralizar;
  - kit × avulso × completar × kit maior que a folha;
  - LOTE com o nome de cada pedido na sua peça, `#pedido` e separação;
  - preset com fundo e trocas.
- Chrome com o React Compiler:
  - `ui_mae_lote5.mts` — **TUDO OK**, com os passos novos:
    - folha Avulso + completar;
    - outro glifo da fonte;
    - frase em cima / sem frase;
    - estilo próprio da idade;
    - **LOTE de ponta a ponta no navegador**: motor → PDF 600×420 mm com 2 pedidos (Ana/Bia), SVG, `LOTE_Milk_09-10.pdf`.
  - `ui_mae_lote5_massa.mts` (opção "Aproveitar folhas" existe e vem desligada), `ui_mae_lote4.mts`, `ui_mae_lote3.mts` — **TUDO OK**.
  - O teste 54 passou a ler a fonte "antes" **antes** de abrir a lista: abrir já pode mostrar a prévia da opção sob o ponteiro.
  - `ui_mae_sprint1112.mts` ficou antigo: a parte de massa é a tela de 4 passos, substituída pelo item 78. Ele foi atualizado só no caminho dos papéis (64).
- `npm run build` ok.


## Lote 6 — Reteste do Lote 5 + itens 80 a 115 · 10/10/2026

Pedido em `docs/mae-ajustes-lote-6.md`. Tudo **aditivo** no schema (`SCHEMA_VERSION` continua 1), **sem DDL**.

### P1 — erros
- **81. Seleção e camadas.** Causa: o contorno do molde (arrastável e preenchido) roubava o clique, e o teste de acerto só olhava imagens.
  - `lib/mae/vinculo/pilha.ts`: a pilha de camadas no ponto (textos → apliques → elementos/formas/moldura → papéis/cores).
  - Clique pega o de cima; **Alt+clique** desce na pilha. Arrastar o contorno a menos de 4 px seleciona em vez de arrastar.
  - Painel Camadas lista a pilha inteira da face: cadeado, arrastar para reordenar, botão direito em qualquer camada.
  - **Trazer para frente / Enviar para trás / topo / fundo** pelo menu e por **Ctrl+] / Ctrl+[** (com Shift: topo/fundo).
- **80. Ajuste do pedido.** Os controles do Ajustar gravam no pedido (`ajustarTextoDoPedido`), com histórico próprio (fonte `pedido` na linha do tempo, Ctrl+Z) e botão **"Salvar ajuste do pedido"**.
- **88/97. Tema do pedido.**
  - O tema escolhido fica salvo no pedido (`camposExtras._mae.temaId`).
  - "Usar para o tema" liga pelo **nome do TEMA** do SOA. "Ajustar" abre com `?tema=` e os apelidos.
- **82. Herança de estilo.** Uma regra só, `estiloDaVariavel`: SUFIXO→IDADE, NOME_IDADE/FRASE/SOBRENOME→NOME. Antes, o estilo novo clonava o `ESTILO_PADRAO`.
- **83. Papel × cor sólida.**
  - Papel/cor substituem a camada de cima, e a cor guarda o que estava `antes`.
  - Lixeira **"Remover cor"** no cartão da parte.
  - Papel na parte libera os papéis "só nesta caixa".
- **87. Transição.** Fica por cima dos papéis da face e da parte (ordem do resolver corrigida).
- **89. SVG/furo.**
  - O recorte não soma mais margem + traço.
  - Furo redondo pequeno (≥ 4 mm², redondo, com uma face vizinha só) passa a ser detectado.
- **84. Face que não existe.** Clicar/soltar numa área sem face mostra o aviso **"Criar face aqui"** (fechamento de 1,5 mm + preenchimento).
- **85. Ctrl+Z no Ajustar.** Giro, tamanho e setas passam pelo histórico do pedido.
- **86. Nome no aplique.** Os textos que caem sobre o aplique saem impressos na folha de apliques.

### Peças por medida (90–96)
- **90.** Base nova pergunta o tipo: **"Caixas e moldes"** ou **"Peças por medida"**.
  - Catálogo `lib/mae/medidas/catalogo.ts`, com as medidas do anexo; 4 já foram conferidas pela Naty.
  - Peça própria: retângulo, cantos arredondados ou círculo, com furo.
  - Peças sem arquivo (`kind: 'medida'`); o corte é o contorno + furo, sem dobras.
- **91. Estruturas.**
  - Prontas: Inteiro, Fundo + base + faixa, Laterais com degradê.
  - Divisórias arrastáveis na arte; **"Salvar como minha estrutura"** (`Bases/estruturas.json`); "Marcar a área do NOME".
- **92. "Adaptar para as outras medidas".** A arte é recomposta pela âncora **"Presa em"** (canto/centro), não esticada.
- **93. Campos.**
  - Nome completo dividido em NOME + SOBRENOME. O jeito de dividir é por pedido (`_DIVISAO_NOME`).
  - SÉRIE e TURNO. Campo sem exemplo ganha um ao salvar o tema.
- **94. Composição por unidade no grupo** (ex.: Nutella = corpo + tampa). A folha comporta N **unidades completas**: nunca sai um corpo sem a tampa.
- **95. Gabarito fixo.**
  - Testar retrato × paisagem; travar/destravar.
  - **Importar gabarito da plotter** (SVG/DXF/PDF) nas posições exatas.
  - **Arquivo de corte do gabarito** gerado uma vez; "Corte por pedido" desligado por padrão.
  - Sangria limitada à metade do espaço até a vizinha. A separação do lote aparece na tela, sem `.txt`.
- **96. Grupos.** Lápis para renomear e **"✎ Digitar um nome…"** de produto (MAE avulso, sem SOA).

### P2 (98–101)
- **98.** Um controle de tamanho só; o slider antigo "Tamanho do nome" saiu (botão remove o `_ESCALA_NOME` velho).
- **99.** Ajustar limpo: some a barra de funções e entra o painel **"Textos do pedido"**.
- **100.** "← Voltar aos pedidos" (pergunta se há ajuste sem salvar), "Salvar e voltar", "Salvar e gerar".
- **101.** Selo de status na lista. Temas agrupados por produto, com o nome da base.

### P3 (102–115)
- **102.** Entrelinha mínima 0,2 (e 0,1 no schema); espaços até −1,5, com o total limitado.
- **103.** A logo entra do tamanho do nome; a área do nome é um **retângulo arrastável** (números no "Avançado").
- **104.** Cenário = **uma peça só**: todas as faces usam a arte da face líder. O "juntar com…" mostra nomes distintos (FUNDO 1, FUNDO 2) e acende a face ao passar o mouse.
- **105.** Com aplique selecionado, a direita mostra só posição/tamanho/giro/ordem; bordinha e silhueta ficam no painel Apliques 3D.
- **106.** A prévia da folha de aplique só aparece no Tema (fecha na Base e em base nova).
- **107.** A atualização da base **não** gira a prancheta. O erro era abrir o 1º arquivo da base em vez do mais novo. Aviso "A base mudou" com **"Corrigir na Base"**.
- **108.** "revise — motivo" ao lado do texto (passou da área / em cima da dobra / não coube nem reduzindo / fonte substituta). Ao passar o mouse: o motivo completo, **"Diminuir 10% nesta caixa"** e **"Selecionar o texto"**.
- **109.** No Tema, o menu da prancheta virou um botão **⋯** na barra de título (abre ao clicar); não cobre mais a arte.
- **110.** Preset proporcional à altura do texto.
  - O preset guarda `refAlturaMm`; os presets antigos assumem 15 mm. Vai no envelope `_v:2`, sem DDL.
  - Controle **"Escala dos efeitos (%)"**.
- **111. Tracking.**
  - Causa: o auto-ajuste trocava o tracking pelo valor que fazia caber, então qualquer valor dava o mesmo resultado.
  - Agora o espaçamento positivo escolhido é mantido e a letra diminui mais (até 50%).
  - Renomeados: **"Espaçamento entre letras"** e **"Subir/descer texto"**.
- **112. Formas.** Alças, modo de mesclagem e **"Preencher com papel…"** (papel recortado na forma).
- **113. Unidades.**
  - Engrenagem **mm · cm · px a 300 dpi** (lembrada no navegador), na régua e em todo controle em mm.
  - Qualquer campo aceita valor com unidade ("9cm" vira 90 mm).
- **114. Prancheta e importação.**
  - Redimensionar a prancheta leva os moldes para dentro; se não couber, ficam centralizados e o aviso aparece.
  - Importar vai para a **prancheta selecionada**.
- **115.** **Renomear** o tema (o arquivo salvo muda de nome junto) e **"Salvar como…"** (cópia com outro nome; segue editando a cópia).

### Testes
- `lib/mae`: **389** passando (2 pulados).
  - `lote6.test.ts`: medidas, estrutura, presa, composição, gabarito, furo redondo, cenário/líder, escala de efeitos, unidades, redimensionar.
  - `texto.test.ts`: espaçamento mantido na caixa apertada.
- `tsc` limpo, lint sem erro nos arquivos tocados, `npm run build` ok.

## Lote 7 — Pedidos, impressão e produção (itens 116 a 121) · 11/10/2026

Pedido em `docs/mae-ajustes-lote-7.md`. Plano aprovado. Ordem de execução: A (120) → B (116) → C (117/118) → D (119) → E (121).

**Decisões do Júnior:**
- "Só MAE" = marca na compra: linha em `mae_purchases` com `item_tipo='plano'` e `item_id='mae-avulso'`. Para teste, também pelo env `MAE_AVULSO_WORKSPACES`.
- Filtro de loja = canal + campo de pedido chamado "Loja". O pedido do SOA não guarda qual loja Shopee.
- A etapa de Impressão criada pelo MAE entra **antes da Expedição**.

**Banco** (script único `scripts/migrar-mae-lote7.mjs`, aditivo, rodado em 11/10 com backup da `SetorConfig` em `C:/vps-gestao/backups/`):
- tabela nova `mae_orders` (pedidos do MAE avulso, `UNIQUE (workspace_id, origem, numero)`);
- coluna `"SetorConfig"."tipo"` (null ou 'impressao').
- Nenhum DDL em runtime.

### Etapa A — item 120 (estrutura avulso × SOA)
- `lib/mae/servidor/plano.ts`: `planoMae()` devolve 'soa' ou 'mae' e sai em `GET /api/mae/addons`. Ids do MAE avulso têm prefixo `mo_`.
- **Fonte de pedidos** (`lib/mae/servidor/fontes.ts`):
  - `listarSoa`: o SQL que estava na rota, agora lendo também `canal`, `dataEnvio`, o campo "Loja" e a etapa atual;
  - `listarMae`: lê `mae_orders`;
  - `patchSoa`/`patchMae` e o tema em massa para as duas fontes.
- Os ajustes do pedido viraram funções puras únicas (`lib/mae/servidor/ajustesPedido.ts`), iguais nas duas fontes.
- **Destino do status** (`lib/mae/servidor/destinos.ts`, rota `POST /api/mae/pedidos/status`):
  - SOA → etapa de Impressão (item 119);
  - avulso → status interno gerado/impresso. Gerar de novo não tira o "impresso".
- **Cadastro manual rápido** (`PedidoManual.tsx`, `POST /api/mae/pedidos/manual`): só no plano 'mae'. A rota da arte aceita pedido `mo_` e marca "gerado".

### Etapa B — item 116 (busca, filtros, ações em massa)
- `lib/mae/pedidos/filtros.ts`, puro.
  - Busca única: nº, cliente, aniversariante, tema; sem acento.
  - Chips combináveis: tema, produto, status, canal, loja.
  - Prazo: despacha hoje / até amanhã / atrasados. Sem tema / com observação / ajustado.
  - Ordem do mais urgente para o menos urgente.
- Tela `FiltrosPedidos.tsx`: contador "N pedidos · M selecionados". Filtros salvos com nome na Biblioteca (`Pedidos/filtros.json`).
- **Barra de ações em massa:** Vincular tema / Gerar / Gerar em lote / Marcar como impresso.
  - O vincular grava num PATCH só (`{ids, temaId}`) e pergunta "Lembrar para os próximos pedidos com o tema X?". Isso reusa os apelidos do item 97.
  - Agora dá para selecionar pedido **sem** tema (para vincular em massa); gerar continua só com os que têm.
- Na linha: canal/loja, prazo de envio com a urgência, etapa atual na produção e selo do status do MAE avulso.

### Etapa C — itens 117 e 118 (lote de impressão e ordem)
- `exportar` ganhou `soPaginas`: devolve as páginas prontas (com cópias e o modelo) em vez de gravar o PDF. Sem a opção, nada muda.
- `components/mae/loteImpressao.ts`:
  - cada arte diferente é renderizada uma vez, e a mesma página serve a todas as cópias (as quantidades do item 79);
  - **Separar por produto** (padrão);
  - divisão em partes de até N pedidos (padrão 10), cada parte gravada antes da próxima, com nome `LOTE_2026-10-11_Kit-Festa_1de3_48pag.pdf`;
  - folha montada continua no gabarito + "Aproveitar folhas".
- `lib/mae/pedidos/ordemLote.ts` (ordem do item 118):
  - **por pedido** ou **por modelo**;
  - **intercalar temas iguais** (padrão): dois do mesmo tema não ficam colados, as cópias do mesmo pedido continuam juntas, e se não der fica a ordem normal, sem aviso;
  - "#123 · Naty" na margem esquerda, de pé, fora do corte e da sangria (ou no lado com mais espaço; sem 4 mm livres, não imprime).
- Modal `ModalLote.tsx` (escolhas lembradas no navegador). Cada pedido registra a arte com `variaveis._lote`, e "Já gerados" mostra o selo do lote.

### Etapa D — item 119 (etapa de Impressão no SOA)
- `lib/producao/etapaImpressao.ts` (mesmo SQL do fluxo):
  - etapa pelo **tipo**; sem nenhuma marcada, pelo nome /impress|imprim/;
  - `garantirEtapaImpressao` cria "Impressão" antes da Expedição;
  - `iniciarImpressao` só anda para a frente ("gerar de novo" não volta etapa);
  - `marcarImpresso` conclui a Impressão e ativa a próxima (Expedição → PRONTO). **Nunca** conclui a Expedição, então nenhum efeito de ENVIADO dispara.
- **Achado:** `"PedidoSetorAtual"` é uma **VIEW** (a 1ª etapa não concluída de `PedidoSetor`), não uma tabela.
  - A rota do fluxo grava nela dentro de try/catch e o erro é engolido.
  - A lib nova não grava, e a lista junta só por `pedidoId`, porque a view não tem `workspaceId`.
- **Configurações → Produção:** selo "Impressão?" em cada etapa, com `tipo` gravado pela rota `[id]`. Uma etapa de impressão por workspace; não aparece na Expedição.
- **Edição em massa:**
  - aviso "Seu fluxo de produção não tem etapa de Impressão. Criar agora?";
  - caixinha "Iniciar a etapa Impressão" (ligada) ao gerar e no lote;
  - "Marcar como impresso" na barra e na linha já gerada.
  - Nada disso aparece no plano 'mae'.

### Etapa E — item 121 (planilha da Shopee)
- `lib/mae/pedidos/planilha.ts`, puro:
  - mapeamento sugerido pelo cabeçalho da Shopee;
  - linhas com o mesmo nº viram um pedido; "Variação,10" = 10 peças;
  - datas da Shopee/Excel;
  - TEMA, NOME e IDADE da observação só quando é seguro (`separarNomeIdade`); o resto se completa na lista.
- Tela `ImportarPlanilha.tsx`: lê com `xlsx` no navegador e lembra o mapeamento em `Pedidos/mapeamento-planilha.json`. A 2ª importação da mesma planilha não repete (`ON CONFLICT DO NOTHING`).
- **Diferença do plano:** o `mapearLinhaShopee` do ModalImportacao do SOA **não** foi extraído. O MAE tem o seu leitor, com os mesmos cabeçalhos e a mesma regra do ",N", para não arriscar a importação do SOA.

### Testes
- `lib/mae/__tests__/lote7.test.ts` (16): plano, ajustes, cadastro, filtros/urgência/salvos, ordem/intercalar/divisão/nome/rótulo, etapa pelo tipo, planilha.
- Suíte inteira: **437** passando (2 pulados). `tsc` limpo; lint sem erro novo (os 11 erros de `any`/aspas em `config/producao` já existiam). `npm run build` ok.
- **SQL no Neon dentro de transação com ROLLBACK** (conta Natielle Videos):
  - ABERTO → Impressão;
  - gerar de novo = `ja_adiante`;
  - impresso → Costura;
  - Expedição continua PENDENTE;
  - histórico "Aguardando → Impressão (arte gerada no MAE)";
  - criar a etapa entra antes do Empacotamento [EXP].
- `mae_orders` testada com uma conta fictícia e apagada no fim: 2ª importação = 0 novos; impresso não volta a gerado.
- **Chrome com React Compiler** (`fabtest/ui_mae_lote7.mts`) — **TUDO OK**:
  - urgência, busca, chips, filtro salvo;
  - vincular em massa + lembrar;
  - criar etapa;
  - lote por modelo → 1 PDF `LOTE_…_12pag.pdf` (3 pedidos × 2 caixas × 2 cópias) + registro com o lote + iniciar Impressão;
  - avulso: cadastro manual, planilha 2× sem duplicar, gerar, marcar impresso.

## Monetização do Método Mãe (add-on + standalone, mensal + anual) · 12/10/2026

Tudo em `docs/mae-monetizacao.md`: decisões, como funciona e o checklist do lançamento. Construído **desligado**: `MAE_VENDA_ATIVO` + os 4 preços em env.

- **Banco** (migração aditiva aplicada em 12/10): colunas `moduloMae*` no `Workspace` + tabela `MaeAssinatura`.
- **Lib:**
  - `lib/mae/assinatura/precos.ts`, puro: preços, parcelamento Price, economia, regra de acesso e datas;
  - `lib/mae/assinatura/servidor.ts`: checkout hospedado, trial de 7 dias com cartão validado, eventos do webhook, cortesia.
- **Integração:**
  - `addonsDaConta` passa a liberar editor e massa pela assinatura ou cortesia. O SOA Design vira cortesia no lançamento;
  - webhook com prioridade para o MAE;
  - `validarCartaoDoCheckout` aceita a referência do MAE;
  - `planoMae` trata a conta standalone como avulsa.
- **Acesso:**
  - sessão com `soMae`;
  - middleware: com o lançamento, o SOA Design leva ao MAE, e a conta standalone fica só no MAE;
  - o layout do `/estudio` aceita quem tem o MAE sem o SOA Design.
- **Telas:**
  - `/mae/assinatura` e `/mae/cadastro`;
  - card no Hub;
  - menu: SOA Design some no lançamento; o grupo do MAE não exige mais o SOA Design; a conta standalone vê só o MAE.
- **Testes:**
  - `assinatura.test.ts` (7) e `assinaturaCheckout.test.ts` (4, Asaas simulado: corpo do checkout, 12× com juros, YEARLY/MONTHLY, trial só 1×, sem cobrança dupla, venda fechada);
  - webhook real (`aplicarEvento`) numa conta fictícia, apagada depois: pago → acesso até o vencimento + 5 dias; não vira `AsaasCobranca`; vencido/cancelado mantém até o fim do período; estorno corta;
  - `next start` com a flag OFF (tudo como antes, cadastro recusado) e ON (`/soa-edition` → `/mae/assinatura`, `/estudio/*` → `/estudio/mae`);
  - suíte inteira **448** passando; `tsc` e build ok; lint sem erro novo.
- **Ajuste:** os imports do `lote6.test.ts` viraram estáticos, porque o import dinâmico estourava 5 s com a suíte inteira rodando.
- **12/10 (2º pacote): e-mails + cancelar pela tela.**
  - 5 e-mails idempotentes: boas-vindas standalone, início do teste, fim do teste (cron diário `/api/cron/mae-assinatura`), atraso por vencimento e cancelada.
  - Botão "Cancelar assinatura": apaga no Asaas, sem estorno; o acesso segue até o fim do período.
  - Reassinar não cobra duas vezes o mesmo período.
  - Colunas `email*`/`canceladaPor` na `MaeAssinatura` (migração aditiva aplicada).
  - Testes: `assinaturaEmails.test.ts` (3) e cancelamento/reassinatura no `assinaturaCheckout.test.ts` (Asaas simulado). No banco, numa conta fictícia: cada marca de e-mail gravada 1×, e o cron não repete.
  - Suíte 452 passando (o teste de tempo do `vinculo.test.ts` oscila com a máquina carregada e passa sozinho). Build ok; lint sem erro novo.

## Lote 8 — Reteste dos Lotes 6/7 + itens 122 a 134 · 12/10/2026

Pedido em `docs/mae-ajustes-lote-8.md`. Plano aprovado; execução P1 → Estrutural → P2. Schema só com campos opcionais (`SCHEMA_VERSION` 1). Sem DDL.

### P1 (122–125)

**122. Ctrl+Z universal.** Causas e correções:
- **Foco preso em controle:** depois de mexer num controle deslizante, select, checkbox ou cor, o foco ficava nele e o atalho era ignorado. Agora o atalho só fica com o navegador em campo de **digitação**; nos outros controles o foco sai e o Ctrl+Z vale para o editor.
- **Passos que se fundiam:** a mesma chave `juntar` (setinhas, mover peça da folha, digitação) fundia ações para sempre. Agora há **janela de 700 ms** (`historico.ts`): uma rajada vira um passo; parou e voltou, passo novo.
- **Id do gesto do slider:** estava em `useState` e o valor digitado na caixinha fundia com o arraste anterior. Passou para `useRef`, e as teclas no controle deslizante também começam um passo novo.
- **Prévia de fonte:** gravava direto no tema, fora do histórico. Agora é só de tela (`useEditor.previaFonte`).
- **Prancheta:** girar "só a folha" usa `desfazerGlobal`.
- **Excluir texto no Tema:** mexe na base e no tema; agora é **uma** entrada na linha do tempo (`juntarUltimos`), um Ctrl+Z só.
- **Campos de frase e valor padrão:** viraram controlados e mostram o valor desfeito.
- **Atalhos Ctrl+] e Ctrl+[:** passaram a ser lidos pela tecla digitada. No teclado ABNT2 o Ctrl+[ fazia o contrário.
- **Teste automatizado:** `lote8-undo.test.ts` percorre camadas (mover, escala, giro, opacidade, olho, cadeado, ordem, excluir), papel, cor, moldura, forma e papel na forma, efeitos, logo, frase, texto, pranchetas (girar, redimensionar, duplicar) e moldes (mover, girar). Cada ação: Ctrl+Z volta exato e Ctrl+Y refaz exato. Também confere 2 gestos = 2 passos, rajada de setinhas = 1, pausa = passo novo, ordem entre base e tema, e ação composta = 1 Ctrl+Z.

**123. Mover com o mouse + olho e cadeado.**
- **Arrastar sem clicar antes:** todo texto do tema ganhou uma área de pegar invisível. O arraste seleciona e move no mesmo gesto (tema ou, no Ajustar, só o pedido); o clique simples continua indo para a pilha.
- **Rótulo "revise":** o contorno vermelho não pega mais o mouse; só o rótulo pega.
- **Setinhas:** passaram a mover também a camada selecionada do Tema.
- **Olho e cadeado no TEXTO** (`textSlotAdjust.hidden/locked`, só nesta caixa):
  - oculto não sai na arte nem no arquivo;
  - travado e oculto não se selecionam na arte;
  - travado não se move nem se exclui.
- **Cadeado nas camadas:** excluir, Ctrl+[ ] e o menu (frente/trás) respeitam o cadeado, com o aviso "Item travado — destrave para editar".
- **Olho da camada no painel:** vale para o conjunto, sem a pergunta "Todas / Só nesta caixa".

**124. Logo atrás do nome.**
- **Causa da duplicação:** cada linha do bloco Nome + idade (e da frase) desenhava a sua logo.
- **Agora:** `fundoDoBloco` desenha **uma** logo ou faixa para o bloco inteiro, em volta da união das linhas e girando junto. As linhas saem sem fundo próprio, e só vale o fundo do texto principal.
- **Cópias de estilo sem logo:** frase, idade do bloco, sufixo e sobrenome não herdam mais a logo, nem por cópia de estilo nem por preset.
- **Painel Camadas:** mostra "Logo atrás do NOME" junto do texto.
- **Painel Texto:** segue o texto selecionado na arte, então a edição da logo não "some".

**125. Grupo com nome digitado.** O nome digitado ganhou valor próprio no select. Antes dividia o valor com o placeholder, e escolhê-lo apagava o nome. Agora há "Trocar o nome digitado…", "Desligar o produto" e a frase "Ligado ao nome X". O casamento (`grupoDoItem`) já funcionava e ganhou teste.

**Testes do P1:**
- `lote8.test.ts`: 1 logo no bloco Nome + idade + frase; logo do texto simples; olho e cadeado na pilha e no resolver; grupo digitado.
- `lote8-undo.test.ts`: 5 testes.
- Suíte do MAE: 429 passando. O teste de tempo "6 folhas < 0,3 s" (`vinculo.test.ts`) falha hoje também **sem** as mudanças (0,43–0,48 s): é a máquina carregada, não uma regressão.
- tsc limpo; lint sem erro novo.

### Lote 8 — Estrutural (126, 127, 128 + 129)

**126. Esquerda = conjunto, direita = só a caixa selecionada.** Inventário ferramenta por ferramenta:

| Ferramenta | Antes | Agora |
|---|---|---|
| Tamanho / Girar do texto (todas as caixas) | Esquerda (Estilo) | **Mantido** na esquerda — vale para todas as caixas |
| Tamanho % na barra de ferramentas do texto | Barra (duplicava o da esquerda) | **Removido** |
| Seletor "Todas as caixas da parte / Só nesta caixa" do texto (`TextoSoNestaCaixa`) | Esquerda e direita | **Removido** — a direita é sempre "só nesta caixa" (item 129) |
| `TextoSoNestaCaixa` (tamanho/girar nesta caixa) | Esquerda e direita | **Movido** para a direita (na esquerda só aparece no layout de painel único) |
| "Tamanho (pt)" do nome simples/composto | Esquerda (ModoDoNome) | **Removido** — o tamanho é o do Estilo |
| "Posição ↔ ↕" do nome simples/composto (gravava na BASE) | Esquerda (ModoDoNome) | **Removido** — mover = arrastar/setas; quem já tinha valor vê "Zerar posição antiga" |
| Seletor de escopo da camada (Tema) "Todas as X / Só nesta caixa" | Direita e barra do topo | **Removido** — selo "Só nesta caixa: X" + "Editar todas as caixas" |
| Posição ↔ ↕ (sliders) da camada | Direita | **Removido** — arrastar na arte, setas = ajuste fino |
| Escala, girar, olho da camada | Direita (escopo do seletor) | **Mantido** — com caixa clicada grava só nela (`localOverrides`); sem caixa, no conjunto |
| Fonte, cor, caixa alta, alinhamento, espaçamentos, curva, efeitos, presets, papel, logo, trocar letra, simples × composto | Esquerda | **Mantidos** |
| Ordem, opacidade, excluir | Direita | **Mantidos** |

- **Bug junto:** o tamanho/giro do conjunto não valia para FRASE nem para a idade do bloco (o `posicaoEfetiva` lia só o estilo da própria variável). Agora segue a herança (`estiloDaVariavel`); as linhas do bloco usam o próprio estilo.

**127. TEMA editável, sincronizado com o SOA.**
- Campo "Tema do pedido" na linha da edição em massa. Ao gravar, salva no campo tema do pedido (SOA ou `mae_orders`) e **re-acha o tema MAE** pela ligação salva.
- Sem arte para o tema: "**Masha e o Urso** ainda sem arte → escolha o tema acima (fica lembrado)".
- **Bug grave corrigido:** salvar o pedido na tela do SOA apagava o `_mae` (tema escolhido, ajustes do pedido). A rota `PUT /api/producao/pedidos/[id]` agora preserva as chaves internas (`_…`) que o formulário não manda (`lib/pedidos/camposExtras.ts`, `mesclarInternos`).

**128. Campos do pedido vêm da base do produto.**
- `lib/mae/pedidos/camposDaBase.ts`: campos = variáveis dos textos do **grupo do produto** na base (NOME_IDADE → NOME + IDADE; frase presa → FRASE; calculadas fora).
- **Biblioteca compartilhada:** nome comparado sem acento e sem caixa ("Série" = SERIE = SÉRIE). O resolver alinha os valores do pedido aos nomes da arte (`alinharCampos`).
- Edição em massa: a célula Campos mostra só os campos do grupo do produto do pedido. O exemplo do tema virou **placeholder** e não preenche mais o pedido. O alerta "faltam dados (SÉRIE)" aparece na linha.
- Botão **Colunas**: esconde campos por nome (preferência do navegador; o padrão é mostrar tudo).
- Banco: nenhuma mudança.

**Testes do Estrutural:**
- `lote8.test.ts` (+4): herança de tamanho/giro, merge do `_mae` (objeto e string), campos da base, biblioteca compartilhada e faltam dados.
- Suíte inteira: 466 passando (o teste de tempo também passou desta vez).
- tsc limpo; build ok; lint sem erro novo (os 21 `any` da rota do pedido já existiam).

### Lote 8 — P2 (129–134)

**129.** O "Todas as caixas da parte" saiu do tamanho e do giro do texto na direita: a direita é sempre "só nesta caixa" (entregue com o 126).

**130. Preset proporcional.**
- **Causa:** a altura do texto era procurada pela variável do painel. No bloco Nome + idade a linha principal sai como NOME e a frase/idade como `<slot>:frase` / `<slot>:idade`, então não achava e o preset entrava a 100%. Nome em 2 linhas media o dobro.
- **Agora:** `alturaDeUmaLinha` (`lib/mae/efeitos/presets.ts`) acha a linha pelo texto selecionado (ou pelo 1º da variável) e divide pelo nº de linhas. A escala é aplicada sempre; o controle de % fica para o ajuste fino. Presets sem referência própria (os da Naty) usam 15 mm (nome de caixa grande).

**131. Formas.**
- **Opacidade:** o slider lia a opacidade crua da camada; com a caixa clicada, a mudança ia para o ajuste "só nesta caixa" e o slider não andava. Agora mostra o valor **efetivo** e grava no mesmo lugar ("Opacidade (só nesta caixa)").
- **Forma + papel dentro:** a opacidade da camada já agia no grupo de recorte inteiro, papel incluído (conferido no render). Entrou a **"Opacidade do preenchimento"** separada (`fillOpacity`, campo opcional do tema): só o conteúdo, os estilos ficam, como no Photoshop.
- **Brilho com "borda":** a folga do buffer de efeitos não contava brilho interno, sombra interna e chanfro. O buffer era cortado rente à forma e a borda ficava sem brilho. Agora conta.

**132. Atalhos e Alt + clique.**
- **Alt + clique:** desce na pilha a partir do selecionado. Camadas **travadas** (e ocultas) saem da pilha.
- **Windows:** Alt solto dentro do editor não ativa mais o menu do navegador (antes o Alt + clique seguinte se perdia).
- **Rótulos:** Ctrl+[ ] já eram lidos pela tecla digitada (122). O Ctrl+Alt+G continua pela tecla física (G), que funciona também com AltGr.

**133. Abrir tema.**
- A lista mostra só os temas da **base aberta**, com "ver todos".
- Aparece também com um tema aberto. O botão do topo não fecha mais o tema antes de escolher; trocar pergunta se há alteração.

**134. Impacto em itens anteriores.**
- **93** (campos sem exemplo viram coluna): as colunas agora vêm direto dos textos da base, o exemplo do tema é só placeholder.
- **120** (MAE sem SOA): `mae_orders.campos` segue igual; o TEMA editável grava lá.
- **121** (planilha Shopee): os campos importados casam com a arte pelo nome normalizado ("Série" = SÉRIE).
- **94/95:** sem mudança.

**Testes do P2:**
- `lote8.test.ts` (+5): altura de uma linha (bloco, frase, 2 linhas), traço 1,6 → 0,53 mm, folga dos efeitos internos, `fillOpacity` no nó, camada travada fora da pilha.
- Suíte inteira: 471 passando. tsc limpo, build ok, lint sem erro novo.

## Lote 9 — Uso real da Naty (itens 135 a 148) · 12/10/2026

Pedido em `docs/mae-ajustes-lote-9.md`. Ordem: P0 (135, 136) → P1 (148, 137, 138, 139, 140, 141, 146) → P2 (142, 143, 144, 145, 147).

### P0 — desempenho e arrastar direto na arte

**Como medimos.**
- **Kit de teste:** 9 pranchetas com os 6 moldes reais (+ MILK, CUBO e PIRÂMIDE de novo).
  - Base: FRENTE em 9 caixas e VERSO em 124 faces (`scripts/mae-gerar-kit-perf.mts`).
  - Tema: papel por parte, 3 elementos com sombra e traçado, Nome + idade com frase.
- **No Chrome:** harness `fabtest/ui_mae_lote9_perf.mts`, com React Compiler, mede da mudança até a prévia pronta.
- **"Atualizado em":** agora mostra recalcular + desenhar (passe o mouse para ver a quebra e quantas folhas foram redesenhadas).

**Resultado (tamanho real, tempo da mudança até a arte nova na tela):**

| Ação | Antes | Depois | Antes, cenário contínuo no VERSO | Depois, cenário contínuo |
|---|---|---|---|---|
| Mover elemento (todas as caixas) | ~930 ms | **~120 ms** | ~1.800 ms | **~180 ms** |
| Mover só nesta caixa | ~930 ms | **~45 ms** (1 de 9 folhas) | ~1.800 ms | **~115 ms** |
| Trocar o texto / efeito no NOME | ~910 ms | **~110 ms** | ~1.850 ms | **~180 ms** |
| Rajada de slider (10 passos) | 1,9 s | **0,6 s** | 3,9 s | **1,4 s** |

**135. Desempenho — o que mudou:**
- **O que pesava:** o desenho, não o cálculo.
  - O motor criava buffers do tamanho da **folha inteira** para cada face (e para cada camada recortada nela): centenas de buffers de ~9 MB por mudança.
  - As 9 pranchetas eram desenhadas **uma atrás da outra** num Worker só.
- **Buffers do tamanho da face** (`renderizar.ts`, grupo de recorte): mesmos pixels. Referência gravada antes e comparada depois:
  - maior diferença de 1 nível em 0,002% dos valores (arredondamento);
  - teste `lib/mae/__tests__/referencia-pixels.test.ts`, que roda quando chamado.
  - Motor no Node, kit com cenário: 5,0 s → 1,6 s.
- **Vários Workers em paralelo** (`lib/mae/render/motor.ts`): até 3, conforme os núcleos da máquina. Cada um guarda as imagens; as pranchetas são divididas entre eles.
- **Só a prancheta que mudou é redesenhada** (`motorEditor.ts` `usePrevias`): as outras reaproveitam a imagem anterior. A prévia não descarta mais as prontas.
- **Contorno do cenário contínuo calculado uma vez por molde** (`poligonoDoCenarioDoMolde`). Antes, a união das faces era refeita para cada face, a cada mudança: recalcular caiu de 110 para ~30 ms.
- **Sliders com valor ao vivo** (`Deslizador` → `useValorAoVivo`, também nas faixas do painel Texto): a bolinha anda na hora, e a arte recebe o valor no máximo 1× por quadro e o final ao soltar.
- **Miniaturas das partes:** dependem só do conteúdo da própria parte e esperam a prévia principal.
- **Resolução da prévia:** já acompanhava o zoom (afastado = menos pixels); mantido.
- **Imagens reduzidas no Worker:** não foram necessárias para a meta, então não foram feitas.

**136. Clicar e arrastar direto na arte.**
- **Um gesto só:** apertar o mouse sobre um elemento, forma ou aplique de qualquer face já seleciona e começa a arrastar. Antes só o que já estava selecionado tinha alça; apertar sobre o resto movia a vista.
- **Papel e cor de fundo** continuam movendo a vista (selecionar e arrastar o contorno, como antes). Cadeado não move; Alt pega o de baixo.
- **Foto durante o arraste:**
  - a camada sai das pranchetas e a foto dela (imagem reduzida, guardada) segue o mouse, sem redesenhar nada;
  - ao soltar, a foto fica no lugar novo até a arte nova chegar (sem piscar);
  - efeitos, recorte e avisos são recalculados uma vez.
- **Cenário contínuo — causa real do "não seleciona" e do "segundo elemento sumiu":**
  - a arte é desenhada no contorno das faces juntas, com o enquadramento da face líder;
  - mas o clique, o contorno, o arrastar e o soltar elemento usavam o quadro da face clicada;
  - nova fonte única `arteDaFace` (`lib/mae/vinculo/cenario.ts`), usada pelo resolvedor, pela pilha, pelo contorno e alças, pelo menu do botão direito e pelo soltar da biblioteca;
  - tudo vai para a face líder, onde as camadas e os ajustes ficam.
- **Como valida:** `fabtest/ui_mae_lote9.mts`, com o kit de 9 pranchetas no Chrome:
  - elemento da FRENTE arrastado sem clicar antes, foto visível no meio do arraste, posição gravada, foto sai com a arte nova;
  - no cenário contínuo, elemento numa face **não líder** selecionado e arrastado pelo mouse.

**Lote 8 conferido:** 122 (Ctrl+Z), 123 (olho/cadeado) e 131 (opacidade) seguem com os testes verdes.

**Testes:**
- suíte inteira: 471 passando;
- referência de pixels do motor;
- `ui_mae_lote9.mts` e `ui_mae_lote9_perf.mts`;
- regressão `ui_mae_lote8.mts`, `ui_mae_lote8e.mts` e `ui_mae_lote5.mts`;
- tsc e lint limpos.

### P1 — atalhos, duplicar, espelhar, sliders, brilho, escopo dos efeitos, cenário na Base

**148. Atalhos no padrão Photoshop.**
- **Tabela única** em `lib/mae/editor/atalhos.ts`. Dela saem o teclado do editor, a lista **"?"** (tecla ? ou o botão de teclado no topo, com busca) e os rótulos dos menus.
- **Novos:**
  - Ctrl+S / Ctrl+Shift+S (o "Salvar" da aba aberta);
  - Ctrl+C / Ctrl+X / Ctrl+V de camada do tema (cola na parte da caixa clicada, ou na parte de onde veio);
  - Ctrl+J duplica camada do tema;
  - Ctrl+D desseleciona (antes abria o "favoritar" do navegador);
  - Shift+H / Shift+V espelham;
  - Ctrl+/ cadeado e Ctrl+, olho (camada ou texto);
  - Espaço + arrastar = mão (move a vista mesmo em cima de um objeto).
- **Mantidos:** Ctrl+Z/Y, zoom, Ctrl+]/[ (com Shift = topo/fundo), Ctrl+Alt+G, setas, Delete, Tab.
- **Para o P2:** Ctrl+G / Ctrl+Shift+G no Tema (agrupar, item 142) e Ctrl+Alt+C/V (estilo, item 145) já estão na tabela.
- **Ctrl+T não entra:** o navegador não deixa usar (abre aba nova). As alças já aparecem ao selecionar.
- **Teste automático** (`atalhos.test.ts`): cada atalho da tabela dispara a ação dele, sem repetição, AltGr do ABNT2 incluído.

**137. Duplicar.**
- **Caminhos:** Ctrl+J, botão direito → Duplicar, botão no painel da direita, **Alt + arrastar** (a cópia fica no lugar novo, a original não sai, um Ctrl+Z desfaz) e Ctrl+C/V.
- **A cópia:** é independente, fica logo acima, deslocada, já selecionada, e leva junto os ajustes "só nesta caixa" da original.
- **"Segundo elemento sumiu":** era o cenário contínuo (corrigido no 136).

**138. Espelhar.**
- **Onde:** botões ↔ ↕ na linha de ações da camada (antes escondidos no "Transformar" recolhido), botão direito e Shift+H/V.
- **Valor:** lê o espelho **efetivo** e grava no mesmo escopo dos outros controles da direita. Antes, o 2º clique não desfazia.

**139. Sliders.**
- **Bolinha ao vivo:** todos os sliders do MAE passam pelo valor ao vivo do P0 (a bolinha anda na hora).
- **Altura e Inclinar:** leem o valor efetivo e gravam no escopo da caixa. Antes gravavam na caixa e mostravam o do conjunto, por isso a bolinha não andava.

**140. Brilho "borda".**
- **Causa:** num papel (ou elemento) recortado na face, a "borda" usada era a do retângulo do papel, fora da face e cortada, então nada aparecia.
- **Correção:** os efeitos **internos** (brilho interno, sombra interna, chanfro) nascem agora da borda **visível** (camada ∩ face).
- **Sem mudança visual:** elementos inteiros dentro da face e efeitos externos ficam iguais (referência de pixels do kit inalterada).
- **Brilho externo:** não tem modo "borda" no Photoshop nem no MAE. Ele aparece em volta da forma, dentro da face.
- **Mesclagem dos brilhos:** continua sendo ignorada, de propósito. Ligar agora mudaria a aparência dos temas já aprovados (o padrão é "tela"). Fica para decidir com a Naty.

**141. Efeitos seguem o modo do topo.**
- **Com caixa clicada:** "Estilos da camada — só na MILK · 2" grava os efeitos SÓ NESTA CAIXA (novo `effects` no ajuste local). Aparece em "Ajustado só nesta caixa" com "voltar ao padrão".
- **Sem caixa clicada:** "Estilos da camada — em todas as FRENTE".
- **Antes:** o painel dizia "todas as caixas" mesmo editando só uma.

**146. Cenário contínuo na Base.**
- **Faces em branco:**
  - **Causa:** quando as faces do cenário não formam uma região só, a arte ficava só na maior região e as outras saíam brancas.
  - **Correção:** a arte cobre o retângulo de todas.
  - **Antes/depois no kit:** a pirâmide (aba de cima e faixas da borda) passa a ficar com papel. É a única mudança de pixels do lote, e é intencional.
- **Girar uma face de cenário que não é a líder:** em vez de controles que não faziam nada, o Enquadramento pergunta "Ajustar o cenário inteiro" ou "Separar esta face". Separar usa o campo opcional `foraDoCenario` da parte.
- **Ao ligar o cenário:** as faces juntadas ficam com **contorno roxo** na arte. Parte com mais de 6 faces mostra o aviso para criar uma parte própria (ex.: CENÁRIO MILK).
- **Fica para depois:** aspecto de referência por molde. Mudaria a posição dos elementos de temas já feitos.

**Testes:**
- `lote9.test.ts` (9): brilho na borda da face, pilha no cenário, duplicar/colar, estilos só na caixa, cenário com faces separadas.
- `atalhos.test.ts` (4).
- `fabtest/ui_mae_lote9.mts`: Ctrl+J, Ctrl+Z, Shift+H duas vezes, Ctrl+, , Ctrl+/ , Ctrl+C/V, Ctrl+D, lista "?" com busca, botão direito com Duplicar/Espelhar.
- Suíte inteira: 484 passando. Regressão de tela dos Lotes 5 e 8 OK.
- Desempenho mantido: mover ~170 ms com cenário. tsc, lint sem erro novo e build ok.

### P2 — um objeto selecionado, Nome + idade, Revise em ícone, agrupar, copiar/colar estilo

**147. Um só objeto selecionado em todo lugar.**
- **Fonte única:** a variável do painel Texto vem do texto selecionado. Escolher NOME, FRASE ou idade no painel seleciona o texto correspondente na caixa.
- **Mesmo estado em tudo:** a barra de cima, o painel Texto e o Camadas leem a mesma seleção (`variavelTexto` no estado do editor, só para frase/idade do bloco).
- **Linhas do bloco** (`:idade`, `:frase`) viram o texto base na seleção, nos avisos e no "Diminuir 10%". Antes gravavam numa chave que ninguém lia.

**143. Nome + idade com os controles do NOME.**
- **Controles:** simples/composto, linhas e auto-ajuste aparecem também no bloco Nome + idade.
- **Causa do nome composto quebrado:** o resolvedor decidia o modo por `NOME_IDADE`, que é sempre vazio, e caía no simples. Agora decide pelo NOME, e "José Sérgio" respeita o modo composto.
- **"Idade não coube":** idade sem fonte, vazia por erro ou reduzida abaixo de 60% vira aviso (ícone na arte + lista do painel).

**144. "Revise" como ícone.**
- O quadro vermelho sobre a arte virou um ícone pequeno junto do texto. O motivo e os botões ("Diminuir 10% nesta caixa", "Selecionar o texto") abrem ao passar o mouse ou clicar.
- A lista do painel continua.

**142. "Logo" saiu do fundo do texto + Agrupar.**
- **Fundo do texto:** ficam "Sem fundo" e "Faixa". "Sem fundo" vale de verdade: a barra de cima não copia mais o fundo para as variáveis.
- **Grupos no tema** (`tema.grupos`, campo opcional):
  - um grupo junta camadas da parte e textos (pela variável), então o mesmo grupo vale em toda caixa da parte;
  - **criar:** Shift + clique na arte, ou Ctrl + clique no Camadas, depois Ctrl+G ou o botão "Agrupar N itens";
  - **na arte:** clicar num item do grupo seleciona o grupo (contorno roxo com alça de tamanho e de giro); apertar e arrastar move o grupo inteiro; **duplo clique** seleciona o item para editar dentro do grupo;
  - **mexer no grupo numa caixa vale só nela**, como o arraste na arte (item 126);
  - **no Camadas:** pasta com olho, cadeado, renomear (duplo clique) e desagrupar; Ctrl+Shift+G desagrupa; Delete com o grupo selecionado tira os itens.
- **Temas antigos com Logo:** o painel Tema mostra o aviso com o botão **"Converter"**. A logo vira elemento no mesmo lugar e tamanho, com o texto por cima, os dois agrupados. A conversão é feita por botão, e não sozinha ao abrir: assim nada muda no tema sem a Naty ver.

**145. Copiar e colar estilo** (`lib/mae/editor/estiloCopiado.ts`).
- **Copiar estilo** (Ctrl+Alt+C ou botão direito) guarda tudo o que foi aplicado no objeto: efeitos, fonte e formatação, preenchimento (cor/papel), opacidade e mesclagem, tamanho e giro.
- **Colar estilo** (Ctrl+Alt+V ou botão direito) aplica só o que serve no destino. De texto para elemento, por exemplo, vão os efeitos e não a fonte.
- **Ajuste ao tamanho:** os efeitos se ajustam à altura do destino, com a mesma regra do preset proporcional (item 130).
- **Colar estilo…** (botão direito, ou Ctrl+Alt+Shift+V) abre caixas para escolher as categorias.
- **Alcance:**
  - vale para vários selecionados e para o grupo;
  - vale entre caixas e entre temas (fica no editor);
  - item travado fica de fora;
  - um Ctrl+Z desfaz.
- **Fonte única:** o copiar/colar de efeitos do painel Estilos usa o mesmo estilo copiado (saiu o armazenamento solto que ele tinha).

**Correções achadas no teste do P2 (vinham do P0):**
- **Clique rápido grudava o elemento no mouse:** um clique rápido num elemento (soltar antes de 2 quadros) começava o arraste depois de o botão já estar solto, e o elemento ficava preso ao mouse até o clique seguinte. Agora o arraste só começa se o botão ainda estiver apertado.
- **Clique engolido:** depois de um apertar-e-soltar sobre um elemento, o clique seguinte era ignorado.
- **Erro no Alt ao soltar um arraste iniciado pelo editor:** o evento não tinha o teclado. Agora a leitura é protegida.

**Testes (P2):**
- `lote9.test.ts`: 16 testes (+ grupos, Nome + idade, copiar/colar estilo: texto → elemento, forma → forma, só as categorias escolhidas).
- `fabtest/ui_mae_lote9.mts` (Chrome + React Compiler), TUDO OK:
  - Shift + clique soma, Ctrl+G, pasta, arrastar o grupo (elemento + NOME_IDADE juntos), Ctrl+Shift+G;
  - Ctrl+Alt+C/V, Ctrl+Z, botão direito, "Colar estilo…";
  - ícone do Revise.
- Regressão de tela: Lotes 5, 8 e 8e OK.
- Suíte inteira: 491 passando. Dois testes de tempo falham só com a máquina carregada e passam sozinhos.
- tsc limpo, lint sem erro e build ok.
- **Desempenho:** P1 e P2 medidos lado a lado, na mesma hora, deram o mesmo tempo (mover ~460 ms, só nesta caixa ~240 ms). O P2 não piorou nada. A diferença em relação aos ~170 ms do P1 é a máquina, que hoje está mais lenta.

## Urgente pós-Lote 9 — editor lento no TRANSFORMERS + tema perdido · 12/10/2026

**Recuperação.**
- **O que havia no Neon:** o TRANSFORMERS_KIT FESTA tem 7 versões de 12/10 (v2 a v10). A v10 (18:33) tem 8 partes, 14 camadas e 3 estilos.
- **Como abrir:** a lista de Temas mostra a versão da nuvem quando o arquivo local some ou quebra. O painel do tema ganhou **"Versões salvas na nuvem"**, que abre qualquer versão.

**Diagnóstico** (tema real do Neon + base de 172 faces, Chrome com React Compiler):
- **~90% do tempo era recalcular efeitos.** Sem efeitos, o mesmo tema fica 20 a 25× mais rápido.
- **Por que cresce com o tema:** o custo é faces × efeitos. O papel com 3 efeitos está em 17 faces, a moldurinha em 31, e os 29 textos têm 4 efeitos cada.
- **Item 135, na prática:**
  - o arraste com a "foto" funcionava (59 fps);
  - mas o mínimo redesenhado era a folha inteira;
  - mexer num estilo refazia as 9 folhas;
  - folhas fora da tela também eram redesenhadas.

**Proteção contra perda** (`components/mae/rascunhos.ts`, `Salvamento.tsx`):
- **Rascunho automático do tema e da base:**
  - neste computador (IndexedDB), 2 s depois de cada mudança;
  - no servidor (`mae_rascunhos`, migração aditiva já aplicada), a cada 30 s, ao trocar de aba e ao fechar ou recarregar a página;
  - ao fechar, o envio usa keepalive, que vai até ~64 KB; o tema cabe, e a base de 200 KB fica no local.
- **Indicador no topo:** "Salvo há X s", "Salvando…" ou "Sem conexão — salvo neste computador".
- **Ao reabrir:** "Recuperar trabalho não salvo?". O tema volta junto com a base dele. Salvar apaga o rascunho, e "Não salvar" descarta.
- **Erros:**
  - `ProtecaoErro` nas barras, nos painéis e na área de desenho: o aviso fica só na ferramenta e o rascunho é gravado na hora;
  - `app/estudio/mae/error.tsx` é o último recurso.

**Desempenho:**
1. **Cache de efeitos no Worker, só na tela.** O resultado dos efeitos de cada camada fica guardado; a chave é a camada inteira + escala + forma do recorte. A mesma prancheta vai sempre para o mesmo Worker.
2. **Sombra e brilho em meia resolução, só na tela.**
3. **Thread principal:**
   - a folha cujo pedaço do tema não mudou reaproveita a resolução (a mesma lista, sem JSON);
   - as folhas fora da tela ficam para quando aparecem;
   - o bitmap antigo só é fechado depois que o novo foi aplicado (corrige "image source is detached").

**Exportação e aprovação:** seguem o caminho de sempre (sem cache e sem meia resolução). Referência de pixels do kit, antes × depois: **0 de 35,9 milhões de valores diferentes**, com e sem cenário. `cache-efeitos.test.ts`: depois de várias edições, o render com cache dá exatamente os pixels do render do zero.

**Antes × depois** (TRANSFORMERS v10, zoom real, "atualizado em", média de 2 rodadas):

| Ação | Antes | Depois |
|---|---|---|
| Mover elemento | 140 ms (1 folha) | 28 ms |
| Slider de opacidade (rajada) | 515 ms | 43 ms |
| Efeito do NOME | 600 ms (7 folhas) | 20 ms |
| Efeito no papel da lateral (11 faces) | 595 ms (8 folhas) | 45 ms |
| Só nesta caixa | 122 ms | 10 ms |
| Carga do tema | 343 ms | 52 ms |
| Arrastar | 59 fps | 59–60 fps |

**Limite conhecido:** a primeira vez que uma folha aparece (ou depois de mudar o zoom) ainda calcula os efeitos do zero; rolar até 3 folhas novas levou ~360 ms.

**Testes:**
- `ui_mae_rascunho.mts`: TUDO OK.
- Regressão dos Lotes 9, 8, 8e e 5: TUDO OK.
- Suíte de testes: 490 passando (lote9 com prazo de 30 s, porque os imports pesados passam de 5 s na suíte paralela).
- tsc e build ok.

## Lote 10 — primeira arte real (TRANSFORMERS) · itens 150 a 164 · 13/10/2026

Doc: `docs/mae-ajustes-lote-10.md`. Ordem aprovada: P0 (150, 161, 151, 152, 153) → P1 (154–156) → Estrutural (157, 158) → P2 (162, 163, 164, 159, 160).

### P0 — sincronia, versão nova, ordem das camadas, texto como objeto, nada "morto"

**150. "Não sincronizado".**
- **O que estava acontecendo:**
  - tema e base **sincronizavam** (o TRANSFORMERS chegou à v17 no Neon);
  - o "☁ não sincronizado" era um aviso **global**: qualquer envio que falhasse (tema, base, marca, preset, identidade) o deixava preso até um próximo sucesso, sem motivo e sem nova tentativa;
  - erros 4xx não deixavam rastro no log.
- **Agora:**
  - uma **fila de envio** (IndexedDB) com nova tentativa automática em 5 s, 30 s e 2 min, e também ao voltar a conexão ou a aba;
  - no topo, um indicador só: "Não sincronizou: <o quê> — <motivo em português> **[Tentar de novo]**". Sessão expirada, conta sem MAE, recusa do servidor com o motivo, arquivo grande e sem conexão têm textos próprios;
  - toda recusa das rotas `/api/mae/*` fica registrada no log da Vercel (`recusa()` em `lib/mae/servidor/acesso.ts`).

**161. Versão nova com a página aberta.**
- **Detectar:** `deploymentId` no `next.config.ts` + `/api/versao`. O editor confere a cada 5 min e ao voltar para a aba e avisa: "Saiu uma versão nova do MAE. Seu trabalho está salvo. **[Atualizar agora]**". O botão guarda o rascunho antes de recarregar.
- **Arquivo do app que não carrega** ("Failed to load chunk"): guarda o rascunho e recarrega **uma vez** sozinho, sem erro em inglês. Ao voltar, o "Recuperar trabalho não salvo?" traz o que estava aberto.
- **Recomendação:** ligar o *Skew Protection* da Vercel.

**151. Ordem das camadas.**
- **Não era regressão do desempenho.** "Frente/trás" só mexia **dentro da lista** da camada, a da parte **ou** a só desta caixa. Os elementos do TRANSFORMERS estão sozinhos na lista da caixa deles, então não tinham com quem trocar. Os textos ficavam sempre por cima, e arrastar entre listas era ignorado.
- **Agora** existe `tema.ordemFace` (opcional), com a ordem de baixo para cima de **camadas da parte, só desta caixa e textos**, numa regra única (`lib/mae/vinculo/ordem.ts`) usada pelo resolvedor (tela e arquivo), pelo Camadas e pelo clique.
  - Menu, Ctrl+]/[ e o arrastar passam a valer entre listas e com textos. Com a caixa clicada, a ordem vale só nela; sem caixa, em todas as caixas da parte.
  - Uma camada posta **acima de um texto** é desenhada depois dos textos daquela caixa, recortada na face.
- **Corrigido junto:** o olho de uma camada oculta "só nesta caixa" escondia a camada em **todas** as caixas. No Tema, frente/trás/máscara de corte não caem mais nas ações do Editor livre.

**152. Texto é objeto.**
- **Botão direito na arte:** pega o objeto **de cima**. Em cima do NOME abre o menu do texto, e não mais o do papel.
- **Menu do texto:** frente/trás/topo/fundo, Duplicar (Ctrl+J), Copiar/Colar estilo, Ocultar/Travar e Excluir. Abre também pelo botão direito na linha do texto em Camadas, que antes abria o menu do Chrome.
- **Ctrl+J / Duplicar:** duplica o texto com os ajustes da caixa, num passo só no Ctrl+Z. Ctrl+C/X/V valem para texto no Tema. O botão Duplicar do painel aparece mesmo com 1 prancheta.
- **Corrigido:** com um texto selecionado, "Excluir" no menu de uma camada apagava o **texto**. Agora a seleção acompanha o menu.

**153. Nada "morto".**
- Tabela única do que vale para cada tipo de objeto (`CAPACIDADE` em `lib/mae/editor/atalhos.ts`): texto, elemento, aplique, forma, papel, cor, moldurinha e grupo.
- O menu só mostra o que vale, e o atalho que não vale **avisa** ("Espelhar na horizontal não vale para texto.").
- **Teste automático** `fabtest/ui_mae_menus.mts`: percorre 112 combinações de atalho × tipo e 70 itens de menu. Resultado: nenhum morto, e 19 avisos corretos.

**Testes (P0):**
- `lote10.test.ts`: 11 testes (ordem pura, entre listas, com textos, resolvedor na mesma ordem, tabela de capacidade, motivos da sincronia).
- `ui_mae_menus.mts`: TUDO OK. Regressão das telas `ui_mae_rascunho`, Lote 9, 8, 8e e 5: TUDO OK.
- Suíte inteira: 502 passando. tsc e build ok.
- Exportação: referência de pixels antes × depois com **0 de 35,9 milhões** de valores diferentes.
- **Desempenho no TRANSFORMERS** (mesma hora, "atualizado em"):
  - mover 71 → 67 ms;
  - efeito do NOME 68 → 56 ms;
  - efeito no papel 150 → 130 ms;
  - arrastar a 60 fps.
  - A máquina estava mais carregada que na medição de ontem, mas antes e depois foram medidos na mesma hora: **não piorou**.
