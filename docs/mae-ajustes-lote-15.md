# Módulo MAE — Lote 15 (URGENTE): corte deslocado na máquina automática

Encontrado pela Naty em 14/10/2026 na produção real. Item 202, em sequência ao Lote 14 (que foi até o 201). **Produção parada nas caixas com marca de registro.** Este lote passa na frente de tudo do Lote 14.

## Comando para o Claude Code

Salve este arquivo em `docs/mae-ajustes-lote-15.md` e cole no Claude Code:

```
Leia docs/mae-ajustes-lote-15.md (URGENTE: corte deslocado na máquina de
corte automática), docs/mae-ajustes-lote-14.md, docs/mae-spec.md e
docs/mae-progresso.md.
PARE o que estiver fazendo do Lote 14 (deixe registrado onde parou) e faça
o item 202 primeiro.
Arquivos de referência que a Naty vai mandar junto:
- kit_festa_arco_iris_boho-MR-Helena.pdf (feito no Photoshop, CORTA CERTO)
- Mait__5anos_mashaeourso-kitfesta_PEGUEEMONTEKitPersonaliz30_ped2610107WXRMG01.pdf
  (gerado pelo MAE, corta deslocado)
- milk_marca_registro.pdf (arquivo de marca original da MILK)
- fotos dos cortes.
Em modo plano:
1) Para cada caixa, compare o arquivo de marca original da Biblioteca com a
   marca no PDF gerado pelo MAE (posição dos 4 cantos e do QR, em mm).
   Diga se o MAE reproduz o arquivo 1:1 ou se desloca ao posicionar
   (rotação retrato→paisagem, recorte pelo conteúdo, centralização,
   página 296,9 × 297 mm…).
2) Compare também com o PDF da Helena, que é a referência que corta certo.
3) Proponha a correção e o "ajuste fino X/Y" por marca.
Não implemente antes da minha aprovação. Ao fim: rode os testes, PUBLIQUE em
produção, confira na URL de produção e registre em docs/mae-progresso.md.
Depois, volte ao Lote 14 de onde parou.
```

---

## P0

### 202. Corte deslocado na máquina automática (marca de registro fora do lugar)
- **Sintoma (14/10):** todas as caixas geradas pelo MAE, de tema pronto e de tema montado, cortam com **desvio na horizontal** na máquina de corte automática, que lê a marca de registro. A **arte está no lugar certo**: o mesmo PDF cortado na faca manual bate perfeito. Artes feitas fora do sistema (Photoshop) cortam perfeito na mesma máquina, no mesmo dia.
- **Medição** (PDF do MAE, pedido Maitê de 13/10, comparado com `kit_festa_arco_iris_boho-MR-Helena.pdf`, feito no Photoshop, que corta certo; posição das 4 marcas de canto e do QR, em mm a partir da borda da página):

| Caixa (código) | Photoshop: esquerda / topo | MAE: esquerda / topo | Deslocamento do MAE |
| --- | --- | --- | --- |
| PIRÂMIDE (154808) | 13,08 / 9,91 | 9,78 / 9,78 | **3,3 mm para a esquerda** |
| TRIANGULOVE (155241) | 12,95 / 9,91 | 9,91 / 9,91 | **3,0–3,3 mm para a esquerda** |
| MALETA CORAÇÃO (155028) | 12,95 / 9,91 | 9,91 / 9,91 | **3,0–3,3 mm para a esquerda** |
| CUBO COM ALÇA (154031) | 12,95 / 9,91 | 9,91 / 9,91 | **3,0–3,3 mm para a esquerda** |
| MALETA COM ALÇA (155504) | 8,64 / 6,86 | 6,86 / 6,86 | **1,8 mm para a esquerda** |
| MILK (140706) | 7,37 / 6,86 | 6,86 / 6,86 | **0,5 mm para a esquerda** |

  - **Confirmado na máquina (14/10, 12h):** a **MILK** (0,5 mm) cortou **perfeito**; a **TRIANGULOVE** (3,0–3,3 mm) e a **MALETA COM ALÇA** (1,8 mm) cortaram deslocadas, proporcionalmente ao desvio medido. Fotos enviadas junto.
  - **Vertical: igual** em todas (diferença ≤ 0,13 mm). O erro é só horizontal e **muda de caixa para caixa**, como a Naty viu no corte (a maleta alça desviou menos que a pirâmide).
  - **Padrão:** no MAE, a distância da marca até a borda esquerda é **sempre igual** à distância até o topo (9,78/9,78; 9,91/9,91; 6,86/6,86). No Photoshop, não.
  - **MILK:** a saída do MAE é **idêntica** ao arquivo `milk_marca registro.pdf` que a Naty subiu (Illustrator, A4 retrato, rotacionado). Então, ao menos na MILK, o MAE reproduz o arquivo fielmente, e é o **arquivo de marca** que difere 0,5 mm do que o Photoshop usa.
- **Investigar (em ordem):**
  1. Para cada caixa, comparar o **arquivo de marca original** que a Naty subiu × o **PDF do MAE**. Se forem iguais, o problema está nos arquivos de marca (não batem com o molde que a máquina usa). Se forem diferentes, o MAE está deslocando ao posicionar: recorte pelo conteúdo, centralização, rotação de retrato para paisagem, página de 296,9 × 297 mm…
  2. Conferir a rotação retrato → paisagem: os arquivos de marca vêm em A4 **retrato** e as pranchetas são **paisagem**. Uma rotação feita em torno do ponto errado desloca na horizontal.
  3. Garantir que a marca é colocada **1:1, nas coordenadas da página original**: sem recortar, sem centralizar, sem escalar.
- **Correção de segurança (vale independente da causa):** em cada marca de registro da Biblioteca, um **"Ajuste fino" X/Y em mm** (ex.: X +3,3), aplicado sempre que a marca é usada. Junto, um botão **"Imprimir folha de teste da marca"** (só a marca + o contorno da caixa), para calibrar na máquina antes de imprimir com arte.
- **Teste de aceite:** gerar as 6 caixas do kit festa e sobrepor cada página ao PDF do Photoshop da Helena: as 4 marcas e o QR batem com diferença menor que 0,2 mm. Cortar na máquina automática: corte em cima da linha em todas as caixas.
