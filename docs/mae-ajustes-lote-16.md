# Módulo MAE — Lote 16: primeiro uso real das PEÇAS SOB MEDIDA (rótulo Nutella)

Encontrados pela Naty em 14/10/2026, montando a primeira base de peças sob medida de verdade: **Rótulo Nutella** (Corpo 20 × 3,5 cm e Tampa redonda 5,7 cm; Folha 1 = 7 corpos, Folha 2 = 12 tampas; kit vendido = 10 rótulos). Itens 203 a 207, em sequência ao Lote 15 (que foi o 202).

⚠️ **Urgente:** o 203 trava o teste. O tema não salva e a Naty não consegue sair da tela.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-16.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-16.md, docs/mae-ajustes-lote-14.md (item 189,
peças sob medida), docs/mae-spec.md e docs/mae-progresso.md.
Em modo plano, organize nesta ordem:
P0) 203 (tema da base Rótulo Nutella não salva: "Sem conexão" com a
    internet ok e janela "Salvar antes de continuar?" em ciclo) — comece
    pelo log do servidor: qual validação está recusando o salvamento;
    204 (nome com mais de 80 caracteres derruba o salvamento);
P1) 205 (tema pronto em base de peças sob medida: uma arte por peça),
    206 (kit de N peças + aproveitar folhas entre temas diferentes),
    207 (estrutura por peça, não "para todas as medidas").
Para cada item, diga quais arquivos mudam e como vamos testar. Não
implemente antes da minha aprovação. Ao fim de cada etapa, rode os testes,
PUBLIQUE em produção, confira na URL de produção e registre em
docs/mae-progresso.md o que foi feito e publicado, item por item.
```

---

## P0

### 203. Tema não salva: "Sem conexão" com a internet funcionando, e a janela de salvar em ciclo
- **Onde:** tema **"Nutella_carros teste"**, base **Rótulo Nutella** (peças sob medida).
- **O que acontece:**
  - O topo mostra **"Sem conexão — salvo neste computador"**, com a internet funcionando (outros sites e o próprio SOA abrem).
  - Ao clicar em **Pedidos (massa)**, aparece "Salvar as alterações em Nutella_carros teste antes de continuar?". **Salvar** não resolve e a janela volta; não dá para sair da tela.
  - **"Salvar como…"** com outro nome: mesmo resultado.
  - **Ctrl + Shift + R:** pede para recuperar, recupera, mas salvar dá a mesma mensagem.
  - O topo diz **"Base: Rótulo Nutella v3"** e o painel da direita diz **"Base: Rótulo Nutella v1"**.
- **Palpite:** o servidor está **recusando o salvamento por validação** e a tela mostra isso como falta de conexão. No mesmo dia, o tema pronto da Nutella (item 204) deu o erro *"partContent … p_rotulo_nutella_carros_disney_mod_2_todos_persona… — Too big: expected string to have <= 80 characters"*. É provável que o tema ou a base tenham ficado com uma parte de nome comprido, e todo salvamento é recusado.
- **Esperado:**
  - Descobrir no log o erro real e corrigir (inclusive limpando o tema e a base que já estão com o dado inválido, sem a Naty perder o trabalho guardado no computador).
  - **Erro do servidor nunca aparece como "Sem conexão".** Mostrar a causa ("O servidor recusou: nome da parte maior que 80 caracteres") e o que fazer.
  - A janela "Salvar antes de continuar?" **nunca vira um ciclo sem saída**: se o salvamento falhar, oferecer **"Continuar com o salvo neste computador"** (sincroniza depois) e mostrar o motivo.
  - Conferir por que o tema aponta para a base **v1** se a base está na **v3**.

### 204. Nome com mais de 80 caracteres derruba o salvamento
- No **Tema pronto**, o MAE usou o nome do arquivo inteiro como nome do tema e das partes: *"rotulo-NUTELLA_carros-disney-mod-2-todos-personagens_Gabriel-rotulos-nutella-20x3,5-cm"*. Apareceu o erro em vermelho (JSON cru na tela: `"too_big"`, `"maximum": 80`, `"path": ["partContent", "p_rotulo_nutella_carros_disney_mod_2_todos_persona…"]`) e o tema **não salvou**.
- **Esperado:**
  - Nome de tema, base e parte **encurtado sozinho** (ou o campo avisa e não deixa passar de 80), **antes** de salvar.
  - O **identificador interno** da parte não deve vir do nome do arquivo (usar um id curto); o nome é só o rótulo de tela.
  - Nunca mostrar JSON cru para a usuária.

---

## P1

### 205. Tema pronto em base de peças sob medida: uma arte por peça
- Ao subir a arte do rótulo em **Tema pronto**:
  - Em **"Onde entra"**, a base **Rótulo Nutella** (peças sob medida, recém-criada) **não aparece**. A lista só traz bases de caixas ("kit caixas e sacolas", "KIT FESTA", "Nova base", "tag 4x4", "tag teste").
  - Só há lugar para **um arquivo**. Não dá para subir a **arte da tampa**.
  - Resultado: o MAE criou uma **base nova só com a frente** (200 × 35 mm), em vez de usar a base Rótulo Nutella.
- **Esperado (como no item 189.8 do Lote 14):**
  - "Onde entra" lista também as bases de **peças sob medida**.
  - Numa base de peças, o tema pronto pede **uma arte por peça**: "Arte do Corpo (20 × 3,5)", "Arte da Tampa (Ø 5,7)". Cada arte vai para **todas as cópias** daquela peça nas folhas, e a tela mostra as folhas inteiras preenchidas.
  - Se a arte tiver proporção diferente da peça: aviso + "ajustar / preencher".
  - **Nunca criar base nova** quando já existe base com peça daquela medida: perguntar em qual base e em qual peça a arte entra.

### 206. Kit de N peças e "Aproveitar folhas" entre temas diferentes
- **Caso real:** a Folha 1 tem **7 corpos** e a Folha 2 tem **12 tampas**. O kit vendido é de **10 rótulos** (10 corpos + 10 tampas).
  - Em **"1 unidade = 1 kit"**, a tela diz *"Este kit = 2 folhas impressas (rótulo frente × 1 · rótulo tampa × 1)"*, ou seja, 7 corpos + 12 tampas. **Não bate com o kit de 10.**
  - Em **"Por peças"**, o exemplo da tela ("96 ÷ 7 por folha = 14 folhas") só considera um tipo de peça. Não fica claro como conta corpo e tampa juntos.
- **Esperado:**
  - **"Kit de N peças":** a usuária define o conteúdo do kit por peça (**10 corpos + 10 tampas**) e o MAE distribui nas folhas pela capacidade de cada uma: 10 corpos = 7 + 3 (2 folhas), 10 tampas = 1 folha com 10. A tela mostra *"Este kit = 3 folhas (Corpo 7 + 3 · Tampa 10)"*.
  - **"Aproveitar folhas"** junta pedidos do **mesmo produto mesmo com temas diferentes** (cada rótulo já leva a arte e o nome do seu pedido), com a identificação do pedido na margem ou na sobra da peça. Hoje, pelo progresso, só junta pedidos do mesmo kit **e do mesmo tema**.
  - Exemplo: 3 pedidos de 10 (Carros, Moana, Stitch) = 30 corpos → **5 folhas cheias** (35 posições) em vez de 6 com espaço vazio.

### 207. Estrutura por peça (e não "vale para todas as medidas")
- Na etapa **Fundo e miolo**, o bloco **"Estrutura (o esqueleto da arte) — vale para todas as medidas"** aplica a mesma estrutura em todas as peças.
- A Naty usa estruturas diferentes por peça: no **corpo**, **2 papéis + uma faixa**; na **tampa**, **um papel no fundo e outro no miolo**.
- **Esperado:**
  - Seletor **"Aplicar em: [Todas as peças / Nutella · Corpo / Nutella · Tampa]"**, com o **padrão por peça**.
  - A divisória (linha laranja) aparece só na peça selecionada.
  - **"Salvar como minha estrutura"** salva a estrutura daquela peça.
  - **"Copiar estrutura de…"** para repetir a de outra peça quando quiser.
