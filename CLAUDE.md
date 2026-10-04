@AGENTS.md

## SOA Edition (módulo MAE) — local-first
- Fonte da verdade: docs/mae-spec.md. Em dúvida, perguntar antes de inventar regra.
- Uma sprint por vez, na ordem do "Roadmap de sprints" da spec. Não adiantar sprints futuras.
- Antes de implementar, apresentar o plano em modo plano e esperar aprovação.
- Ao terminar cada sprint, atualizar docs/mae-progresso.md (o que foi feito, decisões, pendências, como testar).
- Tudo em milímetros no modelo de dados. Nenhuma arte/imagem/fonte vai ao servidor: o editor lê e grava na pasta local (File System Access API). Fontes via Local Font Access API.
- Só Chrome e Edge, só desktop. Se outro navegador, mostrar "Use o Chrome ou o Edge".
- Motor de render (mae-render) é o MESMO para tela e exportação. Nunca criar segundo caminho de desenho.
- Schemas com Zod compartilhados cliente/API. Testes com Vitest; algoritmos puros (faces, offset, auto-ajuste, enquadramento) sempre com teste unitário. Usar docs/mae-exemplos/ nos testes.
- MAE é submódulo do SOA Edition; os itens (Editor de imagem, Método Mãe, Criador de templates, Edição em massa, Artes prontas, Meus arquivos) compartilham a mesma fundação local-first.
