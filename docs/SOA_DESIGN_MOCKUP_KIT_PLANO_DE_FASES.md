# 🗺️ SOA Design — Mockup + Kit · Plano de Fases (do spec canônico ao produto)

> 🗄️ **ARQUIVADO em 30/09/2026** — o Mockup foi retirado do SOA Design (foco em Edição em massa + Método Mãe). O código está no histórico do git até o commit c727e1a; as tabelas EstudioMockup/EstudioCena/EstudioKit*/EstudioBox*/EstudioAplique*/EstudioComposicao/EstudioOutput/EstudioExportPreset ficaram dormentes no banco (nada apagado). Não executar os prompts de mockup.

> O spec (`SOA_DESIGN_MOCKUP_KIT_SPEC.md`) é grande — é um produto inteiro. Aqui está a ordem pra construir sem travar, entregando valor a cada fase. Cada fase é utilizável sozinha.

## ✅ FASE 1 — Mockup por Smart Areas (individual) + melhorias da Naty
- Imagem-base (upload + acervo por segmento). Smart Areas nomeadas, polígono editável, 2 modos.
- **Ampliar/posicionar a arte dentro da área** (escala/zoom do conteúdo).
- **Perspectiva real** (homography/warp) + **realismo** (sombras/luz do produto na arte).
- **Mockup criado 1x e reutilizado**; **vincular arte** → gera.
- **Menu botão direito** no editor. Remover redundância do menu "Gerar fotos".
- **Importar DXF no acervo → gerar mockup** (regiões viram Smart Areas).
- Entrega: a artesã já cria mockup de 1 produto e gera fotos.

## 🔵 FASE 2 — Batch individual + vinculação semântica
- **Gerar fotos em massa com o mockup:** sobe N artes → seleciona o mockup → gera sabendo frente/lado/alça (vinculação semântica região↔superfície).
- Importação de pasta / múltiplos arquivos + **file matcher determinístico** (nome/aliases) + **confidence** + **tela de conferência só nas exceções**.
- **Fila de jobs** (pending/processing/…); falha de 1 não derruba o lote. Cache (não re-renderizar o que não mudou).
- Entrega: 100 artes da Sacola P → 100 mockups numa operação.

## 🟣 FASE 3 — Box Instance viva + Aplique engine
- **BoxTemplate/Faca** (editor de faca: regiões semânticas em polígono normalizado, renderable).
- **BoxInstance** editável e reativa (altera → outputs atualizam).
- **Aplique**: objeto separado; usuária sobe só o PNG → **geração automática de camadas** (alpha → dilatação → silhueta → preenchimento; image/solid/metallic/texture) + profundidade (offset/shadow) + **presets**.
- Entrega: apliques 3D realistas, reutilizáveis, em lote.

## 🟠 FASE 4 — Kit Composer
- **KitTemplate/KitSlot/KitInstance** + **CompositionTemplate** (posições normalizadas) + compositor visual (arrastar/alinhar/z).
- Consome Box Instances direto (sem baixar/reenviar). Atualização reativa no kit.
- **Batch de kits:** 50 temas × 6 caixas → 300 individuais + 50 kits numa operação; importação por subpasta (subpasta = tema) ou pasta única.
- Entrega: o diferencial — kit inteiro automático.

## 🔴 FASE 5 — Cenas, outputs múltiplos e export
- **Scene/Background** separado; **Outputs** múltiplos por projeto referenciando as mesmas instâncias; **export presets** por marketplace (Shopee/Instagram…).
- **Cache/dependency graph** + **versionamento** de templates.
- Entrega: 1 projeto → kit + individuais + composições + cenários, em vários formatos.

## ⚪ FASE 6 — IA (fallback) + arquivos de corte (futuro)
- IA sugere regiões/faces/tipo de caixa/matching (usuária confirma → vira template determinístico).
- Reaproveitar silhuetas expandidas dos apliques pra **arquivos de corte**.

## 🎛️ Transversais (valem em todas as fases)
- Modo simples × modo avançado. Preview em baixa res / export em alta. Autosave. Coordenadas normalizadas. Blob + cota-servidor. Editor com polígono/vértices/undo/redo/botão direito.

## 📌 Recomendação de corte pra LANÇAR
- **Vendável:** Fase 1 + Fase 2 (mockup individual + batch com vinculação semântica). Já entrega "sobe artes → gera as fotos".
- **Diferencial forte (logo depois):** Fase 4 (Kit Composer) — é o que o concorrente não faz bem.
- Aplique engine (Fase 3) é alto valor pro público de caixa 3D — priorizar conforme demanda da Naty.
