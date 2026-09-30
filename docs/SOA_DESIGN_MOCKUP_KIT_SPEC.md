# 📐 SOA Design — Spec CANÔNICA do Mockup + Kit (arquitetura-norte da Naty)

> 🗄️ **ARQUIVADO em 30/09/2026** — o Mockup foi retirado do SOA Design (foco em Edição em massa + Método Mãe). O código está no histórico do git até o commit c727e1a; as tabelas EstudioMockup/EstudioCena/EstudioKit*/EstudioBox*/EstudioAplique*/EstudioComposicao/EstudioOutput/EstudioExportPreset ficaram dormentes no banco (nada apagado). Não executar os prompts de mockup.

> Documento de referência. É o "norte" do módulo de mockup/kit. Construção é faseada (ver `SOA_DESIGN_MOCKUP_KIT_PLANO_DE_FASES.md`). Nada aqui obriga a construir tudo de uma vez, mas todo código novo deve respeitar estes princípios e este modelo de objetos.

## 🎯 Princípios inegociáveis
- **Configurar 1x → reutilizar sempre.** A complexidade fica na criação dos templates; o uso diário é simples.
- **Objetos por referência, nunca imagem-final-como-fonte.** Nenhum output vira insumo obrigatório do próximo. Box Instance é editável e viva.
- **Atualização reativa.** Alterou uma Box Instance (arte/aplique/posição/perspectiva) → todos os outputs que a usam atualizam, sem reexportar/reimportar.
- **Coordenadas normalizadas** (0..1), não pixels — funciona em qualquer resolução.
- **Intervenção só nas exceções.** Em lote de 300, se 292 casaram, pedir atenção só nos 8.
- **IA é fallback futuro**, não dependência do MVP. Matching e regiões são determinísticos primeiro.
- **Qualidade final = foto real do produto montado** (nada de adesivo colado, PNG flutuando, perspectiva/sombra falsa, borda serrilhada).

## 🧱 Modelo de objetos (16 entidades)
1. **BoxTemplate / Faca** — a planificação: regiões (frente, verso, laterais, alça, tampa, fundo, abas…) como **polígonos editáveis**, cada uma com `faceType`, `polygonPoints` (normalizados), `rotation`, `renderable` (aba de colagem pode não aparecer), `enabled`.
2. **Artwork** — a arte planificada.
3. **BoxMockupTemplate** — o mockup por modelo (Mockup Milk, Cubo…). Não depende de uma foto única com todas as caixas; renderiza cada caixa e compõe depois. (Mockup de cena com várias caixas = suporte futuro/opcional.)
4. **BoxInstance** — arte aplicada a um BoxTemplate; **editável** (faces, artworks, masks, transforms, appliques, shadows). Alteração reflete em todos os outputs.
5. **MockupSurface** — superfície visível no mockup: `destinationPolygon`, `mask`, `foregroundMask`, `backgroundMask`, `zIndex`, `opacity`, `blendMode`.
6. **Applique** — objeto independente da arte impressa (personagem recortado aplicado à parte). 0..N por BoxInstance.
7. **AppliquePreset** — config reutilizável de aplique (ex.: "dourado 2 camadas").
8. **AppliqueLayers** — camadas do aplique (image, solid_color, metallic, custom_texture), geradas automaticamente do alpha do PNG (silhueta → dilatação → nova silhueta → preenchimento), com profundidade simulada (offset/shadow).
9. **KitTemplate** — o kit (ex.: Kit Festa 6 caixas): slots com `boxTemplateId`, `required`, `aliases`, `order`.
10. **KitSlot** — cada vaga do kit.
11. **KitInstance** — kit de um tema (Sereia → milk/cubo/…); cada artwork gera sua BoxInstance, que alimenta o compositor.
12. **CompositionTemplate** — disposição das caixas (posição/escala/rotação/z normalizados), reutilizável por qualquer tema do mesmo KitTemplate.
13. **CompositionInstance** — composição aplicada.
14. **Scene / Background** — cenário separado das caixas (branco, rosa, decorado…).
15. **Output** — múltiplos por projeto (kit completo, cada caixa, composições, cenários), **referenciando as mesmas Box Instances** (sem duplicar).
16. **BatchJob** — fila (pending/processing/completed/failed/cancelled); falha de 1 não cancela o lote.

## 🔧 Pipeline
```
ARTWORK → BOX TEMPLATE → FACE EXTRACTION → PERSPECTIVE TRANSFORM (homography/warp)
→ MASKING → BOX MOCKUP → APPLIQUE ENGINE → BOX INSTANCE
→ INDIVIDUAL OUTPUT → KIT COMPOSER → COMPOSITION TEMPLATE → SCENE → FINAL KIT OUTPUT → EXPORT PRESET
```
Lote:
```
FOLDER/MULTI-FILES → IMPORTER → FILE MATCHER → KIT GROUPER → VALIDATION → BATCH QUEUE
→ BOX RENDERERS → APPLIQUE ENGINE → KIT COMPOSER → OUTPUT GENERATOR → EXPORT
```

## 🔑 Regras específicas que não podem se perder
- **Vinculação semântica:** `Milk.frente → MockupMilk.frente` (por identidade, não por posição física).
- **Perspectiva real:** região retangular da faca pode virar trapézio no mockup → homography/warp, não resize/crop.
- **Oclusão/realismo:** foregroundMask/backgroundMask/shadowLayer/artworkLayer preservam laço, pedra, alça, dobra na frente da arte + luz/textura/sombra.
- **Aplique = objeto separado da arte** (impressão à parte); usuária sobe só o PNG principal, SOA gera as camadas (bordas/cores/metálico/sombra/profundidade). Guardar geometria das silhuetas expandidas (reaproveitável p/ arquivos de corte no futuro).
- **Kit composer consome Box Instances direto** (nada de gerar→baixar→reenviar→montar).
- **Importação:** por subpastas (subpasta = tema/KitInstance) OU pasta única (extrai tema+modelo do nome). File matcher determinístico (nome/aliases/estrutura/histórico/proporção), com confidence score + tela de conferência só nas exceções.
- **Cache/dependency graph:** só re-renderiza o que mudou + composições dependentes. Versionamento de templates (snapshot) sem quebrar projetos antigos.
- **Preview rápido em baixa resolução; export final em alta.**
- **Modo simples** (uso diário: escolhe kit → sobe artes → gerar) × **Modo avançado** (editores de faca/mockup/máscara/aplique/composição/cena).

## 🖼️ Melhorias da Naty pós-teste (entram já — ver prompt de melhorias)
1. **Ampliar/posicionar a arte dentro da Smart Area** (escala/zoom do conteúdo pra encaixar).
2. **Mockup da caixa é criado 1 vez** (define as faces uma vez) e reutilizado.
3. **Gerar fotos EM MASSA usando o mockup:** sobe as artes → seleciona o mockup → gera sabendo o que é frente/lado/alça (vinculação semântica).
4. **Menu "Gerar fotos" está redundante** → remover/unificar.
5. **Em "Escolher acervo": importar DXF → gerar mockup de produto.**
