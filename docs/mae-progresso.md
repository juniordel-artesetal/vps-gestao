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
