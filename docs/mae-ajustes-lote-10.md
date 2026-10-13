# Módulo MAE — Ajustes do uso real (Lote 10)

Encontrados pela Naty em 12/10/2026, **terminando a primeira arte real do começo ao fim** (tema TRANSFORMERS_KIT FESTA, base "kit caixas e sacolas v5"). Itens 150 a 164, em sequência ao Lote 9 (que foi até o 148).

🎉 **Marco:** primeira arte completa feita no MAE.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-10.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-10.md (ajustes do primeiro tema real completo
feito no MAE), docs/mae-ajustes-lote-9.md, docs/mae-spec.md e
docs/mae-progresso.md. Em modo plano, organize nesta ordem:
P0) 150 (sincronização "não sincronizado"), 161 (versão nova com a
    página aberta: "Failed to load chunk"), 151 (ordem das camadas
    quebrou — provável regressão da otimização de desempenho), 152
    (duplicar texto e menu do botão direito em textos), 153 (itens de menu
    e atalhos que não fazem nada + teste automatizado);
P1) 154 (preset de moldurinha não salva), 155 (recorte/máscara e máscara
    em aplique 3D), 156 (formas como aplique e "preencher com papel");
Estrutural) 157 (conjunto de aplique em camadas, por material) e 158
    (moldurinha em qualquer peça) — avalie o impacto no modelo de dados
    do aplique e na exportação das folhas;
P2) 162 (arquivo alterado no disco), 163 (montar acentos em fontes sem acento), 164 (caixa do nome maior que a face), 159, 160.
Comece pelo 150. Para cada item, diga quais arquivos mudam e como vamos
testar. Não implemente antes da minha aprovação. Ao fim de cada etapa, rode
os testes, meça o desempenho de novo no TRANSFORMERS (não pode piorar) e
registre em docs/mae-progresso.md o que foi feito, item por item.
```

---

## Parte A — Reteste do Lote 9 e do diagnóstico de desempenho

| Status | Item |
| --- | --- |
| ✅ | **Desempenho:** "atualizado em" caiu de **5979 ms para 38–161 ms** no kit completo. Arrastar e redimensionar o nome ficaram rápidos. |
| ✅ | **Recuperação do tema:** a v10 do TRANSFORMERS foi recuperada do servidor. |
| ✅ | **Salvamento automático local:** o topo mostra "Salvando…" / "Salvo há 25 s". |
| ✅ | Clicar e arrastar direto na arte (melhorou muito). |
| ✅ | **Ctrl+J em elementos** funciona. Menu do botão direito com Duplicar, Espelhar, Copiar/Colar estilo apareceu. |
| ⚠️ | Sincronização com o servidor: aparece "não sincronizado" (item 150). |
| ⚠️ | Duplicar em **textos** (item 152). Ordem das camadas (item 151). |
| ⏸️ | Ainda não testados: 93, 94, 95, 120, 121; copiar/colar estilo; agrupar; espelhar. |

---

## Parte B — Itens novos

## P0

### 150. "Não sincronizado" com o servidor
- O topo mostrou **"Salvo há 25 s"** e, logo abaixo, **"não sincronizado"** (laranja). O trabalho está salvo no navegador, mas não subiu para o servidor.
- **Verificar:** por que não sincroniza (erro de rede, tamanho, conflito de versão, permissão)? Registrar o erro.
- **Esperado:** sincronizar sozinho em poucos segundos; se falhar, tentar de novo; se continuar falhando, mostrar o motivo e um botão **"Tentar de novo"**. Nunca deixar a usuária sem saber se está protegida.

### 151. Ordem das camadas parou de funcionar (regressão)
- **Arrastar** camadas na lista de Camadas não muda a ordem.
- **Botão direito → Trazer para frente / Enviar para trás / Topo / Fundo** também não faz nada.
- Funcionava no reteste do Lote 6. Provável regressão da otimização de desempenho (cache dos objetos com efeito não é invalidado quando a ordem muda?).
- Conferir também **Ctrl+]** / **Ctrl+[**.

### 152. Duplicar texto e menu do botão direito em textos
- **Ctrl+J** funciona em elementos, mas **não em textos** (NOME, IDADE, SUFIXO).
- **Botão direito num texto na lista de Camadas** abre o **menu do Chrome**, não o do MAE.
- **Botão direito em cima do texto na arte** abre o menu do **papel de baixo** (título do menu: "GRADE QUADRICULADA MINIMALISTA"), não do texto.
- Hoje só dá para duplicar texto pelo botão "Duplicar" do painel Texto.
- **Esperado:** textos têm o mesmo menu e os mesmos atalhos dos outros objetos (Duplicar Ctrl+J, Copiar/Colar estilo, ordem, excluir, ocultar, travar), na arte e em Camadas. O botão direito pega sempre **o objeto de cima** sob o cursor.

### 153. Itens de menu e atalhos que não fazem nada
- Clicar em "Duplicar" no menu do botão direito não fez nada (no caso testado, o menu era do papel de baixo — ver 152).
- **Regra:** nenhum item de menu ou atalho pode aparecer sem estar ligado à ação.
- Criar **teste automatizado** que percorre todos os itens dos menus e todos os atalhos da lista do item 148 (Lote 9) em cada tipo de objeto (texto, elemento, aplique, forma, papel, moldurinha, grupo) e confere o resultado.

## P1

### 154. Preset de moldurinha não está salvando
- Ao salvar o preset da moldurinha, ele não fica salvo. Funcionava no Lote 3.
- Investigar: não aparece em "Molduras salvas…"? Aparece sem os efeitos? Some ao recarregar ou trocar de tema? (Confirmar com a Naty se precisar.)

### 155. Recorte / máscara, inclusive em aplique 3D
**Caso real:** a Naty queria mostrar só a parte de cima do robô (aplique) numa face. No Photoshop: seleção retangular + máscara.
- **Hoje:** a seção "Máscara" do painel não aparece quando o objeto é **Aplique 3D**. A máscara de corte com forma funciona **só sem** aplique 3D, e mesmo assim a forma de base aparece (fundo rosa). Com aplique 3D, nenhum recorte funciona, nem pela borda da face, e a **folha de aplique sai com o robô inteiro**.
- **Esperado:**
  - Ferramenta **"Recortar / mascarar"** (botão direito e painel): **seleção retangular, elíptica, laço** e **"usar a forma da face"**; "mostrar só a seleção" / "esconder a seleção"; suavizar borda; "remover máscara" volta ao original (nada se perde).
  - **Máscara em todo tipo de camada:** elemento, aplique, papel, forma, texto.
  - **Aplique 3D com máscara:** impressão, bordinha e silhueta seguem o recorte.
  - **Máscara de corte com forma:** a forma de base pode ficar invisível — **opacidade do preenchimento separada da opacidade da camada** (como no Photoshop) e **forma sem preenchimento** (só contorno).

### 156. Formas como aplique e "preencher com papel"
- Uma **forma** (elipse) **não pode ser marcada como Aplique 3D**. A Naty teve que subir um PNG de círculo.
- Num **PNG** (ex.: círculo) não há como **preencher com papel**.
- **Esperado:**
  - Formas podem ser **Aplique 3D**.
  - **"Preencher com papel"** em qualquer forma ou PNG (usando o contorno/transparência como máscara), como já existe no NOME, funcionando também em aplique 3D.

## Estrutural

### 157. Conjunto de aplique (aplique em camadas, vários materiais)
**Caso real (caixa pirâmide, print com Baby Shark):** o aplique é feito de 3 peças empilhadas:
1. **moldura escalopada** — **só recorte em papel dourado** (sem impressão; é a última camada, sem silhueta atrás);
2. **círculo** — impresso, com papel digital e **moldurinha interna** afastada da borda;
3. **personagem** — impresso, por cima.

Hoje o MAE só conhece "impresso + silhueta preta".
- **Esperado:**
  - Novo tipo de objeto: **"Conjunto de aplique"** (nome escolhido pela Naty), ao lado de Elemento, Forma e Texto. Dá para criar do zero ou transformar um aplique simples em conjunto. Dentro dele: empilhar peças e definir o **tipo de cada uma**:
    - **Impressa** (imprime e corta);
    - **Só recorte**, com o **nome do material** ("Dourado", "Glitter rosa", "Preto");
    - bordinha/silhueta opcional por peça.
  - Na arte, prévia do conjunto de aplique na ordem certa, que se move/gira/redimensiona como uma peça só (pode usar o Agrupar do item 142).
  - Na exportação, **uma folha por material**: folha impressa, folha de recorte "Dourado", folha de recorte "Preto"… cada peça com o nome da caixa (como hoje).
  - **Salvar o conjunto de aplique como preset** (o nome é a usuária quem dá; ex.: "Frame escalopado") e reaproveitar em outros temas, trocando só o papel do círculo e o personagem. *(A Naty adorou essa ideia.)*
  - **Genérico, não é só para esse frame:** funciona com **qualquer formato e qualquer número de camadas** — escalope, coração, nuvem, estrela, retângulo, ou um contorno próprio (PNG/SVG/forma). Ex.: coração dourado (só recorte) + coração menor impresso + personagem; nuvem branca + placa com o nome; etiqueta com 2 papéis de cores diferentes. Cada camada pode ser trocada (formato, papel, material) mantendo o resto do preset.

### 158. Moldurinha em qualquer peça, com distância da borda
- Hoje a moldurinha existe só nas faces. O círculo do aplique tem uma **moldurinha interna afastada da borda**; o Traçado não serve porque fica colado na borda.
- **Esperado:** a ferramenta Moldurinha funciona em **formas, elementos e peças de aplique**, com **distância da borda** ajustável, espessura, cor/papel, efeitos e presets, acompanhando o formato (círculo, escalope, coração).

## P2

### 159. Delete em objeto da parte, no modo "só nesta caixa"
- Apertar Delete num objeto que pertence à parte (ícone de alfinete), com "Editando só: TRIANGULOVE", **oculta só naquela caixa** (comportamento correto), mas não fica claro.
- Mostrar aviso rápido: "Oculta só no TRIANGULOVE. [Excluir de todas as caixas]", rótulo "oculta nesta caixa" na camada, e no botão direito as duas opções lado a lado: **Ocultar nesta caixa** / **Excluir de todas**.

### 161. Versão nova publicada com a página aberta ("Failed to load chunk")
- Na tela de Marca de registro, ao subir a marca dos apliques, apareceu: **"Failed to load chunk /_next/static/chunks/…js … from module 825834"**. Causa: uma versão nova foi publicada no Vercel com a página aberta; o navegador tentou carregar um arquivo da versão antiga que não existe mais. Recarregar com Ctrl+Shift+R resolveu.
- Vai acontecer com qualquer aluna a cada atualização. **Esperado:**
  - Detectar versão nova (ex.: checar a versão do build periodicamente ou ao falhar o carregamento de um chunk).
  - Mostrar aviso amigável: **"Saiu uma versão nova do MAE. Seu trabalho está salvo. [Atualizar agora]"**, salvando o rascunho antes de recarregar.
  - Se um chunk falhar, tentar recarregar sozinho uma vez (após salvar o rascunho), sem mostrar erro técnico em inglês.
  - Nunca perder trabalho por causa de atualização.

### 162. Arquivo alterado no disco ao criar Tema pronto
- Ao criar um **Tema pronto** (passo 2. Páginas) apareceu: **"An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk."** (o PDF mudou depois de escolhido — reexportado ou pasta sincronizada com Drive/OneDrive). Escolher o arquivo de novo resolveu.
- **Esperado:** reler o arquivo sozinho e seguir; se não conseguir, mensagem em português: "O arquivo mudou desde que foi escolhido. [Escolher de novo]". Nunca erro técnico em inglês (revisar todas as mensagens de erro do sistema).

### 163. Fontes sem acento: montar o acento automaticamente
**Problema real:** várias fontes decorativas não têm letras acentuadas (ex.: "Júlia" saiu "J▯lia"). No Photoshop a Naty escreve sem acento, usa outra fonte e mascara para aparecer só o acento.
- **Detectar** (harfbuzz/tabela de glifos da fonte) as letras que a fonte não tem e avisar: "Esta fonte não tem: á é í ó ú â ê ô ã õ ç…". Na edição em massa, avisar no pedido quando o nome tiver letra sem glifo.
- **"Montar acentos"** (no painel do texto, ligado por padrão quando faltar acento):
  - a letra base vem da **própria fonte** (u → ú);
  - o **acento** (´ ` ^ ~ ¨ e a cedilha ¸) vem: 1) do acento solto da própria fonte, se existir; ou 2) de uma **fonte de acentos escolhida** pela usuária;
  - ajustes: **altura, tamanho e deslocamento** do acento, com prévia de todas as letras acentuadas de uma vez ("á é í ó ú â ê ô ã õ ç");
  - o acento herda cor, papel e efeitos do texto;
  - salvo no tema e no preset da fonte, valendo automaticamente para todos os pedidos.
- Complementa o "Trocar letra" (item 75), que troca a letra inteira.

### 164. Caixa do nome (área de auto-ajuste) maior que a face
- Ao criar o NOME (tema Moana, milk), a **caixa laranja pontilhada** ficou enorme: atravessa várias faces e sai da prancheta. A usuária não sabe se um nome longo vai crescer até esse limite.
- **Esperado:**
  - A caixa nasce **do tamanho da face** onde o texto foi colocado (com uma margem), nunca maior que a face.
  - Se a usuária esticar além da face, aviso: "A área do nome passa da face MILK".
  - Deixar claro na tela o que é a caixa: rótulo pequeno "área do nome — nomes longos encolhem para caber aqui".
  - Botão **"Testar nome longo"** (ex.: "Maria Eduarda Beatriz") para ver o encaixe na hora.
- **Erro encontrado:** hoje **área e tamanho do nome estão presos um ao outro**. Diminuir a caixa pelas alças diminui o nome; aumentar o nome pelo controle "Tamanho" aumenta a caixa de novo. Não há como ter um nome grande numa área pequena e controlada.
- **Separar os dois ajustes:**
  - **Tamanho do nome** (alças dos cantos e controle "Tamanho"): muda só a letra; a área não muda.
  - **Área do nome** (alças das laterais, ou botão "Ajustar área do nome", ou arrastar com Alt): muda só o limite; a letra não muda.
  - Regra do auto-ajuste: o nome fica no tamanho definido; se não couber na área, encolhe até caber; nunca passa da área.

### 160. Lembretes de teste pendente (sem mudança de código)
- 93, 94, 95, 120, 121 ainda não testados.
- A Naty vai testar a próxima rodada já com o fluxo completo: tema pronto → edição em massa → PDF → impressão.
