# Especificação — Módulo Método MAE no SOA (v2)

04/10/2026 · Naty Costa

## Visão geral e decisões fechadas

O módulo leva o Método MAE (Molde, Arrasta, Encaixa) para dentro do SOA como um editor de artes no navegador, só para computador. A aluna monta a base do kit uma vez; a cada tema novo, arrasta papéis e elementos uma única vez e tudo se replica em todos os moldes. A venda é: "o Método MAE está dentro do SOA".

O princípio técnico é **tudo no computador da usuária**: artes, papéis, elementos, fontes e exportações ficam numa pasta local "Biblioteca MAE". O SOA guarda no Neon só a "receita" (estrutura das bases e temas), com poucos kilobytes por tema.

Decisões tomadas com a Naty:

| # | Decisão |
| --- | --- |
| 1 | Sem gerador de mockup (acordo com concorrente). |
| 2 | Só computador, nos navegadores Chrome e Edge. Nada de versão celular. |
| 3 | QR Code e logo não são personalização: entram no bloco fixo "Identidade do Ateliê", junto com a marca de registro. |
| 4 | Hashtag mantém acentos e maiúsculas como o nome foi digitado (#MariaJúliafaz1), e é editável. |
| 5 | Sem remoção automática de fundo na v1. |
| 6 | Sem IA para estilizar nomes. Estilos de nome são presets de efeito (sem fonte): biblioteca privada da usuária + loja de presets da Naty (grátis ou pagos). |
| 7 | Venda em add-ons: "Criação de artes MAE" e "Edição em massa" (nomes e idades). Exportação ilimitada. |
| 8 | Usuária não publica presets nem artes para outras. Só a Naty vende (packs de tema e presets). |
| 9 | "Arte inteligente" no lugar de sangria: dois botões de exportação, Aprovação (contorno da caixa) e Impressão (arte com sobra). |
| 10 | Partes já vêm com nomes prontos (FRENTE, FUNDO, LATERAL DIREITA…), editáveis. |
| 11 | Elementos vinculados por padrão, com opção "Só nesta caixa" para mudar um molde específico. |
| 12 | Nome simples e nome composto configurados em cada posição do nome; composto em 1 ou 2 linhas, detectado automaticamente e ajustável por caso. |
| 13 | Marca de registro: a usuária sobe a dela; o sistema só insere, no tamanho exato da folha (ex.: A4 inteira, 100%), com as marcas nos cantos. |
| 14 | Apliques: tamanho igual ao da arte; bordinha e silhueta com controle deslizante; silhueta sai em preto, para rastreio. |
| 15 | Edição em massa exige os campos TEMA, NOME e IDADE no pedido. |
| 16 | Sem link de aprovação: a usuária manda a arte de aprovação (ou um print) pelo WhatsApp. |
| 17 | Nenhuma arte fica armazenada no sistema; nada de renderização em servidor. |

## Glossário

| Termo | O que é |
| --- | --- |
| Biblioteca MAE | Pasta no computador da usuária onde ficam todos os arquivos do módulo. |
| Base | O kit montado uma vez: pranchetas, moldes, faces e partes. Reutilizada em todos os temas. |
| Prancheta | Folha física em mm: A4, A5, A6 ou personalizada. Uma base pode misturar tamanhos. |
| Molde | Desenho de uma peça (caixa milk, triangulove, sacola P…) com linhas de corte e de dobra. |
| Face | Uma região fechada do molde (a frente da milk, por exemplo). |
| Parte | Nome que agrupa faces equivalentes de vários moldes: FRENTE, FUNDO, LATERAL DIREITA… |
| Conteúdo vinculado | Papel ou elemento colocado numa parte; aparece em todas as faces dela. É o "objeto inteligente" do MAE. |
| Ajuste local | Mudança feita "só nesta caixa"; não afeta as outras. |
| Enquadramento | Como o conteúdo da parte entra em cada face: preencher, caber, esticar ou manual, com escala e posição. |
| Tema | Papéis, elementos, fontes e estilos aplicados sobre uma base (ex.: "Stitch Angel"). |
| Variáveis | NOME, IDADE, HASHTAG e campos extras; vêm do pedido ou são digitados. |
| Identidade do Ateliê | Logo, QR Code e @ da usuária. Fixos, cadastrados uma vez, nunca mudam com tema ou pedido. |
| Arte inteligente | A arte de impressão, que vaza além da linha de corte para evitar filete branco no corte. |
| Arte de aprovação | A arte recortada no formato exato do molde, para a mãe aprovar. |
| Aplique impresso | Elemento 3D impresso em prancheta própria, com bordinha opcional e o nome do molde acima. |
| Silhueta | Contorno do aplique ampliado, em preto, para rastrear e cortar no lamicote. |
| Marca de registro | Arquivo da plotter da usuária, inserido no tamanho exato da folha nas pranchetas para o print and cut. |
| Preset de efeito | Estilo de texto salvo (traçados, chanfro, sombra, degradê…), sem a fonte. |

## Arquitetura

O editor roda inteiro no navegador da usuária e lê e grava direto na pasta Biblioteca MAE. A Vercel e o Neon só servem a aplicação, guardam a receita das bases e temas e controlam os add-ons. Nenhuma arte passa pelo servidor, então não há custo de armazenamento nem de renderização.

```
COMPUTADOR DA USUÁRIA (Chrome ou Edge)          NUVEM DO SOA
┌──────────────────────────────────────┐        ┌──────────────────────────┐
│ Editor MAE                           │◄──────►│ SOA na Vercel            │
│ react-konva + motor de render (Worker)│ receita│ app, API, add-ons        │
│ exporta PDF/PNG 300 dpi na pasta     │ status │ nenhuma arte passa aqui  │
└───────▲──────────────────▲───────────┘        └───────────▲──────────────┘
        │ lê e grava       │ lê as fontes                   │ salva e lê
┌───────▼──────────┐ ┌─────┴────────────┐       ┌───────────▼──────────────┐
│ Pasta Biblioteca │ │ Fontes instaladas│       │ Postgres no Neon         │
│ MAE (Dropbox/    │ │ Creative Fabrica,│       │ receitas, presets,       │
│ Drive)           │ │ Google Fonts...  │       │ status dos pedidos       │
└───────▲──────────┘ └──────────────────┘       └──────────────────────────┘
        │ packs comprados                       ┌──────────────────────────┐
        └───────────────────────────────────────│ Packs da Naty            │
                                                │ Vercel Blob ou R2        │
                                                └──────────────────────────┘
```

O editor lê e grava tudo na pasta local. Para a nuvem vão só a receita do tema e o status do pedido; de lá só descem os packs comprados.

**Pasta local (File System Access API).** No primeiro uso, o SOA pede para a usuária escolher ou criar a pasta (`showDirectoryPicker`). O acesso fica guardado no IndexedDB do navegador e é reconfirmado com um clique a cada sessão (`requestPermission`). Estrutura sugerida, criada automaticamente:

- `Bases/` · `Temas/` · `Papéis/` · `Elementos/` · `Apliques/`
- `Identidade/` (logo, QR) · `Marcas de registro/` · `Packs Naty/`
- `Exportações/AAAA-MM-DD/<pedido>_<nome>/` · `Backups/`

A recomendação para as alunas é deixar a pasta dentro do Dropbox, do Drive ou do OneDrive, que funcionam como backup automático e sincronizam entre computadores.

**Fontes locais (Local Font Access API).** O SOA lista as fontes instaladas no computador (`queryLocalFonts`), inclusive as compradas na Creative Fabrica, e lê o arquivo de cada uma para desenhar o texto. Nenhuma fonte é enviada ao servidor. O tema guarda só o nome técnico da fonte (`postscriptName`); se ela não existir em outro computador, o editor avisa "fonte não instalada".

**Referência de arquivos.** A receita guarda cada arquivo pelo caminho relativo dentro da Biblioteca + um hash SHA-256. Se a usuária mover ou renomear um arquivo, o SOA procura pelo hash; se não achar, mostra "arquivo não encontrado, localizar".

**No Neon (Postgres).** Ficam a receita da base e do tema (JSON versionado), os presets de efeito da usuária, os presets de marca de registro (só a posição e o nome do arquivo), o vínculo produto ↔ tema, o status "arte gerada" de cada pedido e as compras de packs e presets.

**Renderização e exportação.** O mesmo motor desenha na tela e gera o arquivo final, num Web Worker com OffscreenCanvas, para a tela não travar. O PDF é montado com pdf-lib e gravado direto na pasta. A prévia usa imagens reduzidas; a exportação usa os originais a 300 dpi.

**Requisito de navegador.** As duas APIs de acesso local só existem no Chrome e no Edge. O módulo detecta o navegador e, se for outro, mostra "Use o Chrome ou o Edge para o Método MAE".

**Packs da Naty.** São o único conteúdo que fica no servidor, porque são produto dela: armazenamento de objetos (Vercel Blob ou Cloudflare R2), download liberado após a compra e salvo em `Packs Naty/`.

## Fluxos da usuária

### 1. Primeiro acesso (uma vez)

1. Escolher ou criar a pasta Biblioteca MAE.
2. Cadastrar a Identidade do Ateliê: logo, QR Code de contato e @.
3. Subir a marca de registro da plotter (PDF ou SVG) para cada tamanho de folha que usa (ex.: A4).

### 2. Criar a base (uma vez por kit, assistente passo a passo)

1. **Moldes:** arrastar os arquivos (PNG, PDF, SVG ou DXF), vários de uma vez. Num PNG, confirmar a largura real em cm, ou medir com dois cliques sobre uma linha conhecida.
2. **Pranchetas:** escolher tamanho e orientação; o botão "Organizar" distribui os moldes. Pode haver pranchetas de tamanhos diferentes na mesma base (caixas em A4, capa de agenda, etiquetas).
3. **Faces:** o sistema destaca as regiões fechadas de cada molde. O controle "Fechar pontilhado" ajusta a tolerância; laço poligonal, "dividir face" e "unir faces" corrigem o que faltar.
4. **Partes:** a lista pronta (FRENTE, VERSO, LATERAL DIREITA, LATERAL ESQUERDA, FUNDO, FECHO SUPERIOR, ALÇA, ABA) aparece na lateral. A usuária escolhe FRENTE e clica em todas as frentes de todos os moldes. Depois de marcar uma, o sistema sugere as equivalentes nos outros moldes, e ela confirma com um clique. Partes são renomeáveis, e ela pode criar novas.
5. **Enquadramento:** um papel quadriculado de teste aparece em todas as faces de cada parte. Para cada face, ela escolhe preencher, caber, esticar ou manual e ajusta escala e posição. Há também "girar 180°", para fechos que ficam de ponta-cabeça montados, e "espelhar".
6. **Nome e textos:** posicionar NOME, IDADE e HASHTAG em cada molde, configurando nome simples e nome composto (1 ou 2 linhas) em cada posição.
7. **Identidade e marca:** posicionar logo e QR em cada molde (no fundo, por exemplo) e conferir a marca de registro. Tudo fica travado.
8. **Arte inteligente:** definir a sobra em mm (padrão 10 mm) e o papel que preenche as abas.
9. Salvar a base.

### 3. Criar um tema (minutos)

1. "Novo tema" → escolher a base → dar nome.
2. O painel de Partes mostra uma miniatura por parte. Arrastar um papel para FRENTE preenche todas as frentes na hora.
3. Elementos (personagem, laço, flores) entram vinculados e se replicam. Para mudar uma caixa só, clicar no elemento daquele molde e escolher "Só nesta caixa".
4. Estilizar o nome uma vez: fonte local, glifos e preset de efeito. Vale para todas as posições.
5. Marcar os elementos que serão aplique 3D, se houver.
6. Conferir a grade com todas as pranchetas e salvar.

### 4. Personalizar um pedido

1. No card do pedido, clicar em "Gerar arte". O SOA acha o tema (pelo vínculo produto ↔ tema ou pelo campo TEMA) e preenche NOME e IDADE; a HASHTAG é calculada.
2. O editor abre já personalizado. Ela confere avisos como "nome longo: fonte reduzida para 82% na caixa cone" e ajusta, se quiser.
3. "Arte pra aprovação" gera um JPG leve com o contorno das caixas, para mandar à mãe no WhatsApp.
4. Com a arte aprovada, "Arte pra impressão" gera o PDF com a sobra, a marca de registro e as pranchetas de aplique.
5. Os arquivos vão para `Exportações/`, e o card passa a mostrar "Arte gerada ✓" com o nome do arquivo.

### 5. Edição em massa (add-on)

1. Ao abrir "Edição em massa", a tela já lista todos os pedidos pendentes de arte, de vários temas ao mesmo tempo, agrupados por tema.
2. Cada linha mostra pedido, tema detectado (pode trocar), NOME, IDADE e HASHTAG, editáveis direto na linha, mais miniatura e alertas ("nome longo", "tema não encontrado", "faltam dados").
3. Ela confere, desmarca o que não quiser e clica em "Gerar todos". O SOA gera tudo de uma vez numa fila no computador, com barra de progresso, e salva um PDF por pedido em `Exportações/AAAA-MM-DD/<pedido>_<nome>/`. Não há salvar um por um.
4. No fim, aparece um resumo: geradas, com aviso e com erro. As com aviso abrem no editor para revisão, e os cards passam a mostrar "Arte gerada ✓".
5. Opcional: "Juntar num PDF só" para imprimir o lote de uma vez.

## Requisitos funcionais por bloco

### Importação de moldes

- Aceitar PNG, JPG, PDF (várias páginas), SVG e DXF, vários de uma vez.
- Converter tudo para milímetros, com origem no canto superior esquerdo da prancheta.
- PNG/JPG: ler o DPI do arquivo, se houver, e sempre pedir confirmação da largura real.
- PDF: rasterizar com pdf.js para detectar faces, mantendo o vetor original para as linhas na exportação.
- SVG: respeitar `viewBox` e unidades; traço pontilhado (`stroke-dasharray`) = dobra.
- DXF: LINE, LWPOLYLINE (com bulge), ARC, CIRCLE, SPLINE e blocos; unidade por `$INSUNITS` (perguntar se faltar); linetype tracejado = dobra.
- O arquivo do molde fica na Biblioteca; a receita guarda só caminho, hash e calibração.

### Detecção de faces

Pipeline único, raster, para todos os formatos (mais robusto que montar faces a partir dos vetores):

1. Rasterizar o molde a ~200 dpi e binarizar (pixel de linha = escuro ou opaco).
2. Fechar o pontilhado: fechamento morfológico de N px, controlado pelo "Fechar pontilhado".
3. Rotular regiões conexas; a que toca a borda é o fundo e é descartada, assim como regiões menores que 20 mm².
4. Expandir cada região até o centro da linha, para não sobrar fresta.
5. Extrair o contorno (marching squares), simplificar (Douglas-Peucker, ~0,1 mm) e converter para mm.
6. Classificar cada aresta: borda com o fundo = **corte**; borda com outra face = **dobra**.
7. Ferramentas manuais: laço poligonal com ímã nas linhas, dividir face e unir faces.

A sugestão de faces equivalentes compara a proporção, a área relativa, a posição dentro do molde e o número de vizinhas.

### Partes, vínculo e ajustes locais

- Uma face pertence a no máximo uma parte; uma parte reúne N faces em M moldes.
- O conteúdo da parte é desenhado num espaço de referência normalizado (0 a 1), e o enquadramento de cada face converte esse espaço para a face.
- Cada elemento tem âncora "face" (posição em % da face; padrão para elementos) ou "papel" (acompanha o papel; padrão para fundos).
- **Ajuste local ("Só nesta caixa"):** qualquer propriedade (posição, escala, rotação, visibilidade, troca de imagem) pode ser sobrescrita numa face. O que não foi sobrescrito continua seguindo o vínculo. Um ícone marca o elemento ajustado, e "Voltar ao padrão" desfaz, por propriedade.
- **Desvincular:** o elemento vira exclusivo daquela face.
- **Arrastar direto numa face** com Alt pressionado = elemento só daquela face; sem Alt = vai para a parte toda.
- Ao editar um elemento vinculado dentro de uma face, o sistema pergunta "Todas as FRENTES" ou "Só nesta caixa", com opção de lembrar a escolha.

### Editor e ferramentas (paridade com o MAE no Photoshop)

- **Camadas e grupos:** opacidade, preenchimento separado da opacidade, bloqueio, visibilidade, renomear, reordenar.
- **Modos de mesclagem:** normal, multiplicação, tela, sobreposição, escurecer, clarear, subexposição e superexposição de cor, luz dura, luz suave, diferença, exclusão, matiz, saturação, cor, luminosidade (todos nativos do Canvas 2D).
- **Máscaras:** máscara de camada pintável (pincel e borracha com dureza e opacidade), degradê na máscara para transição suave entre dois papéis, máscara de recorte, inverter, desativar, suavizar.
- **Ajustes não destrutivos:** brilho/contraste, matiz/saturação (com colorizar), níveis, curvas, equilíbrio de cores, vibração, preto e branco, mapa de degradê.
- **Seleção:** letreiro, laço, laço poligonal, varinha mágica (tolerância, contígua), intervalo de cores, seleção automática de objeto (modelo SlimSAM rodando no navegador, sem custo). Somar, subtrair, intersectar, expandir, contrair, suavizar, virar máscara.
- **Pintura:** pincel, borracha, lata de tinta, degradê (linear, radial, angular, refletido), conta-gotas, seletor de cor com paleta do tema.
- **Formas:** retângulo com cantos arredondados, elipse, polígono, estrela, coração, linha, caneta Bézier; preenchimento e traçado.
- **Transformar:** mover, escalar, girar, inclinar, espelhar, distorcer, perspectiva e deformar (malha).
- **Produtividade:** desfazer/refazer ilimitado, histórico, réguas em mm, guias, grade, ímã, zoom "tamanho real" e atalhos no padrão Photoshop (V, M, L, W, B, G, T, Ctrl+T, Ctrl+J, Alt+Ctrl+G), para aproveitar a memória das alunas.

### Texto e nome

- Fontes locais (Local Font Access) + Google Fonts.
- Caixa alta/baixa, alinhamento, tracking, kerning, entrelinha, escala, deslocamento da linha de base, texto em curva.
- **OpenType completo** via HarfBuzz: ligaduras, alternativos, conjuntos estilísticos e swashes, mais um painel de glifos que mostra as variações de cada letra. É essencial para fontes cursivas de festa.
- **Nome simples × composto:** cada posição do nome guarda duas configurações. Duas palavras ou mais = composto, e o sistema aplica a configuração de composto escolhida (1 ou 2 linhas, tamanho, quebra). A usuária pode trocar a configuração num pedido específico.
- **Auto-ajuste:** se o nome não couber, reduzir o tamanho até 70%, depois o tracking; se ainda não couber, marcar o pedido como "revisar".
- **Estilos de camada editáveis:** traçado (vários), sombra projetada, sombra interna, brilho externo e interno, chanfro e entalhe, sobreposição de cor, de degradê e de padrão.

### Presets de efeito

- Um preset guarda só os efeitos, nunca a fonte; ao aplicar, a usuária usa a fonte que quiser e pode editar qualquer efeito depois. Ela monta o preset com todas as opções de estilos de camada listadas acima, como no Photoshop.
- **Biblioteca privada:** a usuária salva, renomeia e reusa os próprios presets.
- **Loja da Naty:** presets grátis ou pagos, com prévia numa fonte gratuita e botão "Testar com minha fonte" antes de comprar.

### Variáveis

- Padrão: NOME, IDADE e HASHTAG; a usuária pode criar campos extras (ex.: FRASE, DATA DA FESTA).
- HASHTAG = `#` + nome sem espaços, com acentos e maiúsculas como foi digitado + texto do tema + idade. Ex.: "Maria Júlia", 1 → `#MariaJúliafaz1`. O texto do meio ("faz") é configurável por tema, e a hashtag pode ser editada no pedido.

### Identidade do Ateliê

- Cadastro único por conta: logo, QR Code (gerado a partir de um link ou enviado como imagem) e @.
- Posicionados uma vez por molde na base, travados, fora do alcance dos temas e pedidos.
- Trocou a logo ou o número? Atualiza no cadastro e todas as bases mudam.

### Marca de registro

- A usuária sobe o arquivo da própria plotter (PDF vetorial de preferência; SVG; PNG só com DPI conhecido). O sistema não gera marcas.
- Um preset por tamanho de folha. O botão "Inserir marca de registro" aplica o preset do tamanho certo em cada prancheta.
- A marca entra como vetor, no tamanho exato da folha (ex.: A4 inteira, 100%, sem redimensionar), com as marcas nos cantos da prancheta, numa camada travada no topo.
- Alertas: arte invadindo a área das marcas; prancheta de tamanho diferente do preset.
- O PDF sai com a opção de impressão em tamanho real ligada, e o download mostra um lembrete: "Imprima em Tamanho real / 100%".
- Exportação opcional das linhas de corte em SVG ou DXF, alinhadas às marcas, para quem preferir não rastrear.

### Arte inteligente e exportação

- **"Arte pra aprovação":** cada molde recortado no formato exato, com contorno, em JPG leve (150 dpi), numa folha só ou separado por molde.
- **"Arte pra impressão":** o conteúdo de cada face vaza além das arestas de corte até a sobra definida (padrão 10 mm, ajustável), e as abas e áreas sem conteúdo recebem o papel de fundo escolhido. Inclui marca de registro, identidade e pranchetas de aplique.
- Formatos: PDF (um arquivo por molde, por prancheta ou tudo junto) e PNG.
- Resolução 300 dpi; página em mm exatos (A4 = 210 × 297 mm), para a impressão sair em tamanho real.
- Linhas de corte e dobra: opção de imprimir ou ocultar.
- Nome do arquivo: `{tema}_{nome}_{molde}_{data}`.

### Apliques 3D

- Ativados por tema. Qualquer elemento pode ser marcado como aplique, ligado ao molde de origem.
- **Prancheta de impressos:** cada aplique no tamanho em que está na arte, com o nome do molde acima (só nessa prancheta).
- **Bordinha:** controle deslizante de 0 a 5 mm, cor branca, do tema ou personalizada.
- **Prancheta de silhuetas:** controle deslizante do deslocamento de 0 a 15 mm; silhueta preenchida em preto.
- **Algoritmo da silhueta:** contorno pelo canal alfa → preencher buracos → offset com Clipper2 (canto redondo, como o "deslocamento externo" do Silhouette Studio) → suavizar → desenhar em preto.
- "Organizar na folha" distribui as peças com 2 mm de espaço, dentro da área livre das marcas de registro.
- Saem dois PNG com fundo transparente: impressos e silhuetas, cada um na sua prancheta e com a sua marca de registro.

### Pedidos

- Vínculo explícito produto ↔ tema no SOA (preferido); se não houver, comparar o campo TEMA com os nomes de tema.
- TEMA, NOME e IDADE obrigatórios para a geração em massa (não vêm por padrão: a usuária cria esses campos nos produtos dela no SOA, e o tutorial ensina); pedidos sem eles aparecem como "faltam dados".
- O card guarda o status (não gerada, gerada, revisar) e o nome do arquivo; o arquivo em si fica no computador.
- Gerar de novo (nome corrigido) cria outro arquivo e mantém o histórico no card.
- O pedido guarda a versão do tema usada, então um ajuste no tema depois não altera pedidos já gerados.

### Loja da Naty (packs e presets)

- Packs de tema: como as partes têm nomes padronizados, o pack encaixa na base da aluna. Ela compra, baixa e aplica.
- Se a base dela tiver uma parte que o pack não cobre, o sistema avisa ("o pack não tem ALÇA, escolha um papel").
- Compras liberadas pelo checkout do SOA; arquivos baixados para `Packs Naty/`.

## Modelo de dados

Tudo em milímetros, validado com Zod, com `schemaVersion`. Base e tema são documentos separados e versionados; o tema aponta para uma versão da base, e o pedido aponta para uma versão do tema. Arquivos são referenciados por caminho relativo na Biblioteca + hash, nunca embutidos.

Tabelas no Neon:

| Tabela | Conteúdo |
| --- | --- |
| `mae_bases` | id, conta, nome, versão, `doc` (JSONB) |
| `mae_themes` | id, conta, base_id, base_version, nome, versão, `doc` (JSONB), publicado |
| `mae_identity` | conta, nome do arquivo da logo e hash, link do QR, @ |
| `mae_registration_presets` | conta, folha (mm), nome do arquivo, hash, área livre (mm) |
| `mae_effect_presets` | conta ou "naty", nome, `effects` (JSONB), preço, grátis |
| `mae_product_theme_links` | produto/variação do SOA ↔ tema |
| `mae_order_arts` | pedido, tema + versão, variáveis usadas, status, nome do arquivo, data |
| `mae_purchases` | conta, pack ou preset, data |

Exemplo de base (trecho):

```json
{
  "schemaVersion": 1, "type": "base", "id": "base_kitfesta6", "version": 3,
  "name": "Kit 6 caixas", "units": "mm",
  "smartArt": { "overflowMm": 10 },
  "artboards": [
    { "id": "ab_1", "widthMm": 210, "heightMm": 297, "registrationPresetId": "reg_a4" },
    { "id": "ab_apl_print", "widthMm": 210, "heightMm": 297, "role": "appliques_print" },
    { "id": "ab_apl_cut", "widthMm": 210, "heightMm": 297, "role": "appliques_silhouette" }
  ],
  "molds": [
    { "id": "m_milk", "name": "MILK", "artboardId": "ab_1",
      "source": { "path": "Bases/moldes/milk.svg", "sha256": "9f2c…", "widthMm": 182 },
      "transform": { "xMm": 12, "yMm": 10, "rotationDeg": 0 },
      "faces": [
        { "id": "f_milk_frente", "partId": "p_frente",
          "polygonMm": [[40.1,62.0],[95.3,62.0],[95.3,140.2],[40.1,140.2]],
          "edges": [{ "from": 0, "to": 1, "kind": "fold" }, { "from": 3, "to": 0, "kind": "cut" }] }
      ],
      "identity": { "logo": { "xMm": 70, "yMm": 160, "wMm": 12 }, "qr": { "xMm": 88, "yMm": 158, "wMm": 14 } } }
  ],
  "parts": [
    { "id": "p_frente", "name": "FRENTE", "referenceAspect": 0.706,
      "instances": [
        { "faceId": "f_milk_frente", "fit": { "mode": "cover", "scale": 1, "offsetX": 0, "offsetY": 0, "rotationDeg": 0 } },
        { "faceId": "f_piramide_frente", "fit": { "mode": "cover", "scale": 1.15, "offsetY": -0.08 } }
      ] }
  ],
  "textSlots": [
    { "id": "ts_nome_milk", "variable": "NOME", "faceId": "f_milk_frente",
      "box": { "x": 0.1, "y": 0.62, "w": 0.8, "h": 0.18 },
      "single": { "lines": 1, "sizePt": 28 },
      "compound": { "lines": 2, "sizePt": 22, "lineHeight": 0.9 },
      "autoFit": { "minScale": 0.7 } }
  ]
}
```

Exemplo de tema (trecho):

```json
{
  "schemaVersion": 1, "type": "theme", "id": "th_stitch_angel", "version": 5,
  "baseId": "base_kitfesta6", "baseVersion": 3,
  "overflowFill": { "path": "Papéis/stitch/hibisco_rosa.png" },
  "partContent": {
    "p_frente": [
      { "id": "l_papel", "type": "image", "path": "Papéis/stitch/praia.png", "sha256": "a81b…", "anchor": "paper" },
      { "id": "l_angel", "type": "image", "path": "Elementos/stitch/angel_1.png", "anchor": "face",
        "transform": { "x": 0.5, "y": 0.45, "scale": 0.6 },
        "effects": [{ "type": "dropShadow", "color": "#00000055", "distanceMm": 0.8, "sizeMm": 1.2 }],
        "applique": { "enabled": true, "borderMm": 1.0, "borderColor": "#FFFFFF", "silhouetteMm": 3.0 } },
      { "id": "l_nome", "type": "text", "slot": "NOME",
        "font": { "postscriptName": "MagicSparkles-Regular", "features": { "liga": 1, "swsh": 1 } },
        "effectPresetId": "ep_rosa_glitter" }
    ]
  },
  "localOverrides": {
    "f_cone_frente": { "l_angel": { "transform": { "y": 0.32, "scale": 0.48 } } }
  },
  "hashtag": { "middle": "faz" }
}
```

Exemplo de arte de pedido (no Neon, só metadados):

```json
{ "orderId": "soa_55120", "themeId": "th_stitch_angel", "themeVersion": 5,
  "variables": { "NOME": "Maria Júlia", "IDADE": "1", "HASHTAG": "#MariaJúliafaz1" },
  "status": "generated", "file": "Exportações/2026-10-04/55120_MariaJulia/impressao.pdf" }
```

**Como cada face é desenhada:** camadas da parte → aplicar os ajustes locais da face → resolver variáveis e auto-ajuste → aplicar o enquadramento (referência → face) → recortar pelo polígono (aprovação) ou pelo polígono expandido com a sobra (impressão) → camadas exclusivas da face → por cima, em vetor: identidade, linhas e marca de registro.

## Stack e bibliotecas

Editor próprio sobre react-konva, sem SDK pago: a lógica de partes vinculadas é o diferencial e não existe pronta em nenhum SDK. Todas as bibliotecas abaixo são gratuitas, com licença permissiva (MIT, Apache ou similar).

| Área | Biblioteca | Observação |
| --- | --- | --- |
| Interface e estado | React + TypeScript, Zustand + Immer, Radix/shadcn, dnd-kit | Immer gera os patches do desfazer/refazer. |
| Canvas interativo | konva + react-konva | Seleção, arraste, transformação, camadas. |
| Motor de render (`mae-render`) | Canvas 2D / OffscreenCanvas em Web Worker | Mesmo código desenha a tela e o arquivo final. |
| Texto | harfbuzzjs (WASM) | OpenType completo; glifos viram caminhos desenhados no canvas. |
| Metadados de fonte | fontkit ou opentype.js | Listar alternativos no painel de glifos. |
| Pasta e fontes locais | File System Access API, Local Font Access API | Nativas do Chrome e do Edge. |
| Ler PDF | pdfjs-dist | |
| Gerar PDF | pdf-lib | `embedPdf` para a marca de registro em tamanho real. |
| Ler DXF | dxf-parser ou `dxf` | |
| Escrever DXF/SVG de corte | dxf-doc, SVG manual | |
| Offset e booleanos | clipper2-ts | Silhueta, bordinha, sobra da arte inteligente. |
| Vetorizar contornos | esm-potrace-wasm | Opcional, para contornos suaves. |
| Distribuir apliques | MaxRects (próprio) | SVGnest (MIT) se precisar de encaixe irregular. |
| Seleção automática | Transformers.js + SlimSAM | Roda no navegador; fixar versões (houve regressão do onnxruntime-web 1.21 com WebGPU). |
| Validação | Zod | Mesmo schema no cliente e na API. |
| Testes | Vitest, Playwright, pixelmatch | Comparar renders com imagens de referência. |

Desempenho no computador: a prévia trabalha com imagens reduzidas (cerca de 150 dpi efetivos no zoom atual) e guarda em cache o bitmap de cada face, invalidado quando muda algo nela. A exportação abre os originais um molde por vez, desenha a 300 dpi (A4 = 2480 × 3508 px) e libera a memória antes do próximo. Isso mantém a edição em massa estável mesmo com dezenas de pedidos.

## Fora do escopo da v1

- Gerador de mockup (acordo com a concorrente).
- Versão para celular ou tablet.
- IA para estilizar nomes e remoção automática de fundo.
- Link de aprovação online para a mãe.
- Armazenamento de artes ou renderização no servidor; o PDF não aparece sozinho no card sem a usuária clicar em "Gerar".
- Presets ou artes publicados pelas usuárias para outras.
- Navegadores além de Chrome e Edge.
- Conversão para CMYK (as alunas imprimem em jato de tinta, que trabalha em RGB).

## Riscos

| Bloco | Risco | Como reduzir |
| --- | --- | --- |
| Detecção de faces | Pontilhado irregular, desenhos dentro do molde viram face falsa | Controle de fechamento + ferramentas manuais; testar com 30 moldes reais das alunas |
| Partes vinculadas | "Mudei aqui e mudou tudo" | Pergunta "Todas ou só esta", ícone de ajuste local, Voltar ao padrão |
| Texto OpenType | Painel de glifos e swashes dão trabalho | HarfBuzz desde o início; validar com as fontes da Creative Fabrica mais usadas |
| Estilos de camada | Chanfro idêntico ao do Photoshop é difícil | Aproximação boa + presets da Naty; não prometer "igual ao PS" |
| Pasta local | Aluna apaga, move ou troca de computador | Busca por hash, "localizar arquivo", orientação para usar Dropbox/Drive |
| Fontes locais | Tema aberto num computador sem a fonte | Aviso "fonte não instalada" + substituta temporária |
| Print and cut | Impressora redimensiona, marca fora da área | PDF em tamanho real, lembrete no download, alerta de área |
| Packs da Naty | Arquivo baixado pode ser repassado | Termos de uso; marca d'água invisível por compradora (opcional) |
| Packs com personagens | Notificação de direitos autorais (Disney, Sega…) por distribuir dentro da plataforma | Decisão da Naty: seguir com termos de uso dos packs |

## Roadmap de sprints

12 sprints de 2 semanas, cerca de 24 semanas para um dev com Claude Code, mais 20% de margem: entre 6 e 7 meses até o lançamento completo (estimativa conservadora; com dedicação total pode cair). Ao fim da sprint 9 o coração do MAE já funciona e dá para abrir um beta fechado com algumas alunas.

1. **Fundações:** pacotes `mae-schema`, `mae-render` e `mae-editor`; schemas Zod; estado com desfazer; prancheta em mm com zoom tamanho real; pasta Biblioteca e fontes locais funcionando. *Pronto quando:* abre uma A4 vazia, grava e lê um arquivo da pasta e lista as fontes instaladas.
2. **Motor de render:** camadas, grupos, modos de mesclagem, máscara de recorte, desenho em Worker; testes de comparação de imagem. *Pronto quando:* a mesma receita gera o mesmo PNG sempre.
3. **Importação:** PNG, PDF, SVG e DXF; calibração; várias pranchetas. *Pronto quando:* 30 moldes reais entram em escala com erro de até 0,5 mm.
4. **Detecção de faces:** pipeline + corte/dobra + ferramentas manuais. *Pronto quando:* 85% ou mais das faces saem certas sem ajuste.
5. **Assistente da base:** partes com nomes prontos, sugestão de equivalentes, enquadramento, posições de nome, identidade. *Pronto quando:* uma aluna monta uma base de 6 moldes em menos de 20 minutos.
6. **Vínculo MAE:** conteúdo por parte, âncoras, "Só nesta caixa", Voltar ao padrão, painel de partes, tema. *Pronto quando:* um papel arrastado na FRENTE atualiza todas as frentes em menos de 0,3 s.
7. **Texto e nome:** HarfBuzz, fontes locais, OpenType, painel de glifos, nome simples/composto, auto-ajuste, hashtag. *Pronto quando:* "Maria Júlia" com swash sai igual na tela e no PDF.
8. **Estilos de camada e presets:** todos os efeitos, copiar e colar estilo, biblioteca privada. *Pronto quando:* a Naty aprova 5 nomes de temas reais.
9. **Exportação:** aprovação e impressão, arte inteligente com sobra, PDF e PNG a 300 dpi, marca de registro em tamanho real, linhas de corte. *Pronto quando:* 100 mm na tela = 100 mm impressos.
10. **Ferramentas de edição:** máscara pintável, degradê, seleções (incluindo a automática), pincel, lata de tinta, formas, ajustes, transformações e deformação. *Pronto quando:* a transição de dois papéis com degradê na máscara sai nítida no PDF.
11. **Apliques 3D:** pranchetas de impressos e silhuetas, bordinha e deslocamento com controle deslizante, rótulo do molde, distribuição na folha. *Pronto quando:* patinho + silhueta de 3 mm passam no rastreio do Silhouette Studio.
12. **Pedidos, massa e loja:** vínculo produto ↔ tema, "Gerar arte" no card, edição em massa com "Gerar todos" e resumo, controle dos add-ons, loja de packs e presets da Naty, tutorial de primeiro uso. *Pronto quando:* 20 pedidos geram em lote e cada card mostra "Arte gerada ✓".

Se o prazo apertar, estes itens podem entrar simplificados sem sair do escopo: chanfro básico, distribuição só retangular dos apliques e painel de glifos só com os alternativos mais comuns.

## Pontos ainda em aberto

- [ ] Preço dos add-ons "Criação de artes MAE" e "Edição em massa".

Decidido em 04/10: sobra padrão de 10 mm; o módulo avisa que exige Chrome ou Edge; sem bateria de testes dedicada em plotters; campos TEMA, NOME e IDADE criados pela usuária; sem consulta jurídica; "faz" como texto padrão da hashtag, editável.
