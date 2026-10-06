# Módulo MAE — Ajustes do teste (Lote 2)

Testado pela Naty em 05/10/2026, nas áreas Base, Tema, Exportação, Apliques, Navegação e Edição em massa. A numeração continua a do Lote 1 (itens 1 a 14). Prints e o PDF de teste estão com a Naty.

## Erros (corrigir primeiro)

### 23. Vínculo da marca de registro se desfaz sozinho (grave)
- 6 marcas vinculadas (uma por prancheta); sem mexer, 4 voltaram para "Sem marca" (maleta alça, maleta coração, triangulove, pirâmide). Milk e cubo continuaram. Os 6 arquivos continuam na lista.
- Esperado: a marca só sai se a usuária trocar/remover; vínculo salvo na base e mantido ao trocar de aba, exportar e reabrir.
- Pista: as 4 são pranchetas em paisagem (297 × 210) e as marcas são retrato (210 × 297) — avisar (item 17), nunca remover em silêncio.
- Proteção extra: ao exportar com prancheta sem marca: "As pranchetas X e Y estão sem marca de registro. Exportar mesmo assim?"

### 22. PDF "tudo junto" sai inconsistente
- Por prancheta sai certo. No PDF único (`teste_isa-costa-2-anos_impressao_2026-10-05.pdf`, 6 páginas): páginas 1–2 (Milk, Cubo) em retrato com o molde girado de lado e com marca; páginas 3–6 (Maleta alça, Maleta coração, Triangulove, Pirâmide) em paisagem e sem marca.
- Esperado: o PDF único é a junção das exportações individuais, página por página, pelo mesmo código — orientação da prancheta, a sua marca e o molde na posição da tela.
- Tamanho: 57 MB para 6 páginas — revisar a compressão (JPG de alta qualidade dentro do PDF) sem perder qualidade de impressão.

### 19. Orientação da prancheta: tela, marca e arquivo
- Na tela: a barra de cima e o painel da aba Imagem mostram "Retrato"/"A4 retrato" com pranchetas em paisagem. Mostrar a orientação real.
- No arquivo: PDF e PNG seguem exatamente a orientação da prancheta (base mista = cada página na sua).
- Na marca: orientação diferente → aviso ⚠️ (item 17), nunca remoção nem giro automático do molde.

### 17. Marca de registro: o nome da prancheta some ao vincular
- Cada linha mostra sempre: **MILK** → milk_marca registro (210 × 297 mm) ▾
- ✓ quando tamanho e orientação batem; ⚠️ quando não batem.
- Atalho: "Usar esta marca em todas as pranchetas A4".

### 21. Elementos vazando junto com a arte inteligente
- Com sobra de 20 mm, o ursinho da lateral passou para fora do molde.
- Regra: papéis e cores de fundo vazam até a sobra; elementos, nome, idade, hashtag, moldurinhas e identidade ficam recortados dentro do contorno da face.
- Opcional: caixa "Pode vazar da face" no elemento, desligada por padrão.

### 16. Apliques 3D: a opção "É aplique 3D" não aparece
- Com "Apliques 3D neste tema" ativado, a Naty subiu uma imagem em Elementos e não achou "É aplique 3D"; o botão "Organizar na folha e gerar os 2 PNG" fica desativado.
- Pergunta ao Ju: erro ou lugar escondido? Mandar o passo a passo.
- Esperado: caixa no painel de propriedades do elemento, no clique com o botão direito e ícone na lista de camadas (liga/desliga). Texto do painel: "Selecione o elemento na arte e marque 'É aplique 3D' no painel ao lado."

## Usabilidade

### 18. Exportação sem aviso de conclusão
1. Barra de progresso ("Gerando MILK… 2 de 6").
2. No fim: "Arquivo salvo em Exportações/2026-10-05/…" com botão "Abrir pasta".
3. O lembrete de tamanho real junto dessa mensagem, com "Não mostrar mais". Investigar a demora da janela.

### 25. Navegação duplicada e propósito das abas
- No menu do SOA, uma entrada só "Método MAE" (abre na última aba usada) + "Pedidos e edição em massa", "Loja da Naty" e "Como usar". Troca de etapa só nas abas do topo.
- Abas numeradas: 1. Base · 2. Tema · 3. Imagem, com tooltip.
- Pergunta ao Ju: propósito da aba Imagem? Editor livre → renomear "Editor livre"; editar a arte do tema → avaliar juntar no Tema.

### 24. Reorganizar o painel de funções
- Barra de ícones fixa na lateral esquerda (Moldes, Partes, Papéis, Elementos, Cor, Texto, Moldurinha, Apliques 3D, Identidade, Marca de registro, Exportar); clicar abre ao lado só aquele painel (clicar de novo fecha); tooltip; ícone ativo destacado; painel da direita só com as propriedades da seleção; lembra o último painel.

## Nova função

### 26. Temas prontos: nome, idade e hashtag em massa sobre artes que a aluna já tem
- Pergunta ao Ju: já existe caminho (ex.: "Importar PSD/PDF" na aba Imagem)?
1. Pasta `Temas/` na Biblioteca com as artes prontas (de preferência um PDF por kit, uma caixa por página; PNG aceito), sem o nome.
2. Cadastrar o tema: escolhe o arquivo, cada página vira prancheta, dá nome a cada página, cria NOME/IDADE/HASHTAG com caixa e o mesmo painel de texto; confere marca e identidade; salva.
3. Ligação com o pedido: nome do arquivo = campo TEMA (ignora maiúsculas, acentos e espaços); se não achar, "tema não encontrado" com escolha à mão guardada para os próximos; também vínculo direto com o produto.
4. Edição em massa: pedidos pendentes de vários temas, TEMA/NOME/IDADE/HASHTAG editáveis, alertas, seleção, prévia leve (abre ampliada), "Gerar selecionados".
5. Exportação PNG ou PDF (separado por caixa ou tudo junto), alta resolução, marca, seguindo 19/22/23; progresso e aviso (18).
6. Nome do arquivo: `{Nome}_{Idade}anos_{Tema}_{data}` (por caixa: `…_{Tema}_{CAIXA}_{data}`); se já existir, acrescentar o número do pedido; pasta `Exportações/AAAA-MM-DD/`.
7. UX simples: primeiro uso guiado em 3 passos e tooltip em todo botão.

## Melhoria

### 15. Posicionamento dos moldes na prancheta
- Centralizado por padrão.
- Alinhamento (esquerda, centro, direita, topo, meio, base) à prancheta ou entre os moldes selecionados; distribuir espaçamento igual.
- Setas 0,5 mm; Shift + seta 5 mm.
- Respeitar a área das marcas de registro.
