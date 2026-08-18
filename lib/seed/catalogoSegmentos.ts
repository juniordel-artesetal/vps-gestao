// Catálogo de onboarding por segmento (SEM preços): materiais + produtos com composição
// (vínculo material→produto) já montada. A artesã só preenche os valores dela.
// GERADO por scripts/gerarCatalogoSegmentos.mjs a partir de lib/seed/segmentos/*.json — NÃO editar à mão.
// id = value canônico de Workspace.segmento / /setup / config. idSeed = id original do seed (traço).

export interface MaterialSeed { nome: string; unidade: string }
export interface ItemComposicao { nome: string; qtd: number }
export interface ProdutoSeed { nome: string; categoria: string; materiais: ItemComposicao[] }
export interface SegmentoSeed { id: string; idSeed: string; nome: string; icone: string; setores: string[]; materiais: MaterialSeed[]; produtos: ProdutoSeed[] }

export const CATALOGO_SEGMENTOS: SegmentoSeed[] = [
  {
    "id": "balao",
    "idSeed": "balao-personalizado",
    "nome": "Balão Personalizado",
    "icone": "🎈",
    "setores": [
      "Arte/Adesivo",
      "Aplicação",
      "Montagem",
      "Entrega"
    ],
    "materiais": [
      {
        "nome": "Balão bubble 18\"",
        "unidade": "un"
      },
      {
        "nome": "Balão bubble 24\"",
        "unidade": "un"
      },
      {
        "nome": "Balão látex 5\"",
        "unidade": "un"
      },
      {
        "nome": "Balão látex 9\"",
        "unidade": "un"
      },
      {
        "nome": "Balão látex 12\"",
        "unidade": "un"
      },
      {
        "nome": "Adesivo vinil recorte",
        "unidade": "un"
      },
      {
        "nome": "Adesivo dourado",
        "unidade": "un"
      },
      {
        "nome": "Fita de balão",
        "unidade": "m"
      },
      {
        "nome": "Fio de nylon",
        "unidade": "m"
      },
      {
        "nome": "Peso para balão",
        "unidade": "un"
      },
      {
        "nome": "Vareta com suporte",
        "unidade": "un"
      },
      {
        "nome": "Cola de balão (glue dots)",
        "unidade": "un"
      },
      {
        "nome": "Papel de seda",
        "unidade": "folha"
      },
      {
        "nome": "Confete",
        "unidade": "g"
      },
      {
        "nome": "Laço metalizado",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Balão bubble personalizado",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 18\"",
            "qtd": 1
          },
          {
            "nome": "Adesivo vinil recorte",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Balão bubble com confete",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 24\"",
            "qtd": 1
          },
          {
            "nome": "Adesivo vinil recorte",
            "qtd": 1
          },
          {
            "nome": "Confete",
            "qtd": 10
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Balão bubble com nome",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 18\"",
            "qtd": 1
          },
          {
            "nome": "Adesivo dourado",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Balão desnudo (papel de seda)",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 24\"",
            "qtd": 1
          },
          {
            "nome": "Papel de seda",
            "qtd": 3
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Balão surpresa (confete dentro)",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 24\"",
            "qtd": 1
          },
          {
            "nome": "Confete",
            "qtd": 15
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Balão metalizado com laço",
        "categoria": "Bubble",
        "materiais": [
          {
            "nome": "Balão bubble 18\"",
            "qtd": 1
          },
          {
            "nome": "Laço metalizado",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 1
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Buquê de balões",
        "categoria": "Buquês",
        "materiais": [
          {
            "nome": "Balão látex 5\"",
            "qtd": 5
          },
          {
            "nome": "Balão látex 9\"",
            "qtd": 3
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Buquê bubble + látex",
        "categoria": "Buquês",
        "materiais": [
          {
            "nome": "Balão bubble 18\"",
            "qtd": 1
          },
          {
            "nome": "Balão látex 5\"",
            "qtd": 5
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Topo de balões para bolo",
        "categoria": "Buquês",
        "materiais": [
          {
            "nome": "Balão látex 5\"",
            "qtd": 5
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 1
          },
          {
            "nome": "Fio de nylon",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Painel de balões pequeno",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 9\"",
            "qtd": 30
          },
          {
            "nome": "Balão látex 12\"",
            "qtd": 10
          },
          {
            "nome": "Cola de balão (glue dots)",
            "qtd": 40
          },
          {
            "nome": "Fio de nylon",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Painel de balões orgânico",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 5\"",
            "qtd": 40
          },
          {
            "nome": "Balão látex 9\"",
            "qtd": 30
          },
          {
            "nome": "Balão látex 12\"",
            "qtd": 15
          },
          {
            "nome": "Cola de balão (glue dots)",
            "qtd": 80
          },
          {
            "nome": "Fio de nylon",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Arco de balões",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 9\"",
            "qtd": 50
          },
          {
            "nome": "Balão látex 12\"",
            "qtd": 20
          },
          {
            "nome": "Cola de balão (glue dots)",
            "qtd": 70
          },
          {
            "nome": "Fio de nylon",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Coluna de balões",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 12\"",
            "qtd": 25
          },
          {
            "nome": "Cola de balão (glue dots)",
            "qtd": 30
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Cascata de balões",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 5\"",
            "qtd": 30
          },
          {
            "nome": "Balão látex 9\"",
            "qtd": 20
          },
          {
            "nome": "Fio de nylon",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Nuvem de balões",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Balão látex 9\"",
            "qtd": 25
          },
          {
            "nome": "Balão látex 12\"",
            "qtd": 15
          },
          {
            "nome": "Fio de nylon",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Balão no palito",
        "categoria": "Avulsos",
        "materiais": [
          {
            "nome": "Balão látex 12\"",
            "qtd": 1
          },
          {
            "nome": "Adesivo vinil recorte",
            "qtd": 1
          },
          {
            "nome": "Vareta com suporte",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Kit decoração de mesa",
        "categoria": "Kits",
        "materiais": [
          {
            "nome": "Balão bubble 18\"",
            "qtd": 1
          },
          {
            "nome": "Balão látex 9\"",
            "qtd": 6
          },
          {
            "nome": "Peso para balão",
            "qtd": 1
          },
          {
            "nome": "Fita de balão",
            "qtd": 2
          }
        ]
      }
    ]
  },
  {
    "id": "bijuteria",
    "idSeed": "bijuteria-joias",
    "nome": "Bijuteria e Joias",
    "icone": "💍",
    "setores": [
      "Separação",
      "Montagem",
      "Acabamento",
      "Embalagem"
    ],
    "materiais": [
      {
        "nome": "Fio de nylon 0,4mm",
        "unidade": "m"
      },
      {
        "nome": "Fio de aço encapado",
        "unidade": "m"
      },
      {
        "nome": "Corrente folheada",
        "unidade": "m"
      },
      {
        "nome": "Fio elástico",
        "unidade": "m"
      },
      {
        "nome": "Miçanga de vidro",
        "unidade": "un"
      },
      {
        "nome": "Pérola shell",
        "unidade": "un"
      },
      {
        "nome": "Pedra natural",
        "unidade": "un"
      },
      {
        "nome": "Pingente folheado",
        "unidade": "un"
      },
      {
        "nome": "Berloque",
        "unidade": "un"
      },
      {
        "nome": "Entremeio",
        "unidade": "un"
      },
      {
        "nome": "Fecho lagosta",
        "unidade": "un"
      },
      {
        "nome": "Argola aberta",
        "unidade": "un"
      },
      {
        "nome": "Tarraxa",
        "unidade": "par"
      },
      {
        "nome": "Pino castiçal",
        "unidade": "un"
      },
      {
        "nome": "Pino de cabeça",
        "unidade": "un"
      },
      {
        "nome": "Base de anel",
        "unidade": "un"
      },
      {
        "nome": "Acabamento terminal",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Colar de pérolas",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Fio de nylon 0,4mm",
            "qtd": 0.6
          },
          {
            "nome": "Pérola shell",
            "qtd": 40
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          },
          {
            "nome": "Acabamento terminal",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Colar com pingente",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.5
          },
          {
            "nome": "Pingente folheado",
            "qtd": 1
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          },
          {
            "nome": "Argola aberta",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Colar longo",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.9
          },
          {
            "nome": "Entremeio",
            "qtd": 3
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Colar choker",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Fio de aço encapado",
            "qtd": 0.4
          },
          {
            "nome": "Pedra natural",
            "qtd": 1
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Colar mandala",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.5
          },
          {
            "nome": "Entremeio",
            "qtd": 1
          },
          {
            "nome": "Pingente folheado",
            "qtd": 1
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Gargantilha de pedra",
        "categoria": "Colares",
        "materiais": [
          {
            "nome": "Fio de aço encapado",
            "qtd": 0.4
          },
          {
            "nome": "Pedra natural",
            "qtd": 5
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          },
          {
            "nome": "Acabamento terminal",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Brinco argola",
        "categoria": "Brincos",
        "materiais": [
          {
            "nome": "Argola aberta",
            "qtd": 2
          },
          {
            "nome": "Tarraxa",
            "qtd": 1
          },
          {
            "nome": "Miçanga de vidro",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Brinco pérola",
        "categoria": "Brincos",
        "materiais": [
          {
            "nome": "Pérola shell",
            "qtd": 2
          },
          {
            "nome": "Pino de cabeça",
            "qtd": 2
          },
          {
            "nome": "Tarraxa",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Brinco pedra",
        "categoria": "Brincos",
        "materiais": [
          {
            "nome": "Pedra natural",
            "qtd": 2
          },
          {
            "nome": "Pino castiçal",
            "qtd": 2
          },
          {
            "nome": "Tarraxa",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Brinco berloque",
        "categoria": "Brincos",
        "materiais": [
          {
            "nome": "Berloque",
            "qtd": 2
          },
          {
            "nome": "Argola aberta",
            "qtd": 2
          },
          {
            "nome": "Tarraxa",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Brinco ear cuff",
        "categoria": "Brincos",
        "materiais": [
          {
            "nome": "Fio de aço encapado",
            "qtd": 0.2
          },
          {
            "nome": "Miçanga de vidro",
            "qtd": 10
          }
        ]
      },
      {
        "nome": "Pulseira de pérolas",
        "categoria": "Pulseiras",
        "materiais": [
          {
            "nome": "Fio elástico",
            "qtd": 0.3
          },
          {
            "nome": "Pérola shell",
            "qtd": 20
          },
          {
            "nome": "Acabamento terminal",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Pulseira de miçangas",
        "categoria": "Pulseiras",
        "materiais": [
          {
            "nome": "Fio elástico",
            "qtd": 0.3
          },
          {
            "nome": "Miçanga de vidro",
            "qtd": 30
          }
        ]
      },
      {
        "nome": "Pulseira berloque",
        "categoria": "Pulseiras",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.25
          },
          {
            "nome": "Berloque",
            "qtd": 3
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          },
          {
            "nome": "Argola aberta",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Tornozeleira",
        "categoria": "Pulseiras",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.3
          },
          {
            "nome": "Berloque",
            "qtd": 2
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Anel ajustável",
        "categoria": "Anéis",
        "materiais": [
          {
            "nome": "Base de anel",
            "qtd": 1
          },
          {
            "nome": "Pedra natural",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Anel de pérola",
        "categoria": "Anéis",
        "materiais": [
          {
            "nome": "Base de anel",
            "qtd": 1
          },
          {
            "nome": "Pérola shell",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Conjunto colar + brinco",
        "categoria": "Conjuntos",
        "materiais": [
          {
            "nome": "Corrente folheada",
            "qtd": 0.5
          },
          {
            "nome": "Pingente folheado",
            "qtd": 1
          },
          {
            "nome": "Tarraxa",
            "qtd": 1
          },
          {
            "nome": "Fecho lagosta",
            "qtd": 1
          }
        ]
      }
    ]
  },
  {
    "id": "ceramica",
    "idSeed": "ceramica-barro",
    "nome": "Cerâmica e Barro",
    "icone": "🏺",
    "setores": [
      "Modelagem",
      "Secagem",
      "Esmaltação",
      "Queima"
    ],
    "materiais": [
      {
        "nome": "Argila branca",
        "unidade": "kg"
      },
      {
        "nome": "Argila vermelha",
        "unidade": "kg"
      },
      {
        "nome": "Massa porcelanato",
        "unidade": "kg"
      },
      {
        "nome": "Esmalte transparente",
        "unidade": "ml"
      },
      {
        "nome": "Esmalte colorido",
        "unidade": "ml"
      },
      {
        "nome": "Óxido/pigmento",
        "unidade": "g"
      },
      {
        "nome": "Engobe",
        "unidade": "ml"
      },
      {
        "nome": "Verniz cerâmico",
        "unidade": "ml"
      }
    ],
    "produtos": [
      {
        "nome": "Vaso pequeno",
        "categoria": "Vasos",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.6
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 40
          },
          {
            "nome": "Óxido/pigmento",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Vaso médio",
        "categoria": "Vasos",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 1.2
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 60
          }
        ]
      },
      {
        "nome": "Vaso de suculenta",
        "categoria": "Vasos",
        "materiais": [
          {
            "nome": "Argila vermelha",
            "qtd": 0.4
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 30
          }
        ]
      },
      {
        "nome": "Cachepô",
        "categoria": "Vasos",
        "materiais": [
          {
            "nome": "Argila vermelha",
            "qtd": 1
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 50
          }
        ]
      },
      {
        "nome": "Xícara",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.3
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 25
          }
        ]
      },
      {
        "nome": "Xícara com pires",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.5
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 30
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Caneca de cerâmica",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.4
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 30
          }
        ]
      },
      {
        "nome": "Bowl/tigela",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.5
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 35
          }
        ]
      },
      {
        "nome": "Jogo de bowls",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 2
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 140
          }
        ]
      },
      {
        "nome": "Petisqueira",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.6
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 40
          },
          {
            "nome": "Engobe",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Saboneteira",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.3
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Prato decorativo",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.7
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 45
          },
          {
            "nome": "Óxido/pigmento",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Enfeite de parede",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.4
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 30
          },
          {
            "nome": "Óxido/pigmento",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Castiçal",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.4
          },
          {
            "nome": "Esmalte colorido",
            "qtd": 25
          }
        ]
      },
      {
        "nome": "Porta-incenso",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Argila vermelha",
            "qtd": 0.25
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 18
          }
        ]
      },
      {
        "nome": "Difusor de aromas cerâmica",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Argila branca",
            "qtd": 0.35
          },
          {
            "nome": "Esmalte transparente",
            "qtd": 22
          },
          {
            "nome": "Óxido/pigmento",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Peça decorativa modelada",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Massa porcelanato",
            "qtd": 0.3
          },
          {
            "nome": "Verniz cerâmico",
            "qtd": 15
          }
        ]
      }
    ]
  },
  {
    "id": "costura",
    "idSeed": "costura-moda",
    "nome": "Costura e Moda",
    "icone": "🧵",
    "setores": [
      "Corte",
      "Costura",
      "Acabamento",
      "Embalagem"
    ],
    "materiais": [
      {
        "nome": "Tecido algodão",
        "unidade": "m"
      },
      {
        "nome": "Tecido tricoline",
        "unidade": "m"
      },
      {
        "nome": "Tecido nylon",
        "unidade": "m"
      },
      {
        "nome": "Tecido oxford",
        "unidade": "m"
      },
      {
        "nome": "Tecido tactel",
        "unidade": "m"
      },
      {
        "nome": "Zíper 20cm",
        "unidade": "un"
      },
      {
        "nome": "Zíper 40cm",
        "unidade": "un"
      },
      {
        "nome": "Linha",
        "unidade": "m"
      },
      {
        "nome": "Entretela",
        "unidade": "m"
      },
      {
        "nome": "Viés",
        "unidade": "m"
      },
      {
        "nome": "Elástico",
        "unidade": "m"
      },
      {
        "nome": "Botão",
        "unidade": "un"
      },
      {
        "nome": "Velcro",
        "unidade": "m"
      },
      {
        "nome": "Enchimento manta",
        "unidade": "m"
      },
      {
        "nome": "Cadarço",
        "unidade": "m"
      },
      {
        "nome": "Fivela",
        "unidade": "un"
      },
      {
        "nome": "Ilhós",
        "unidade": "un"
      },
      {
        "nome": "Etiqueta bordada",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Necessaire média",
        "categoria": "Necessaires",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.3
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 2
          },
          {
            "nome": "Entretela",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Necessaire grande",
        "categoria": "Necessaires",
        "materiais": [
          {
            "nome": "Tecido nylon",
            "qtd": 0.5
          },
          {
            "nome": "Zíper 40cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 3
          },
          {
            "nome": "Entretela",
            "qtd": 0.5
          }
        ]
      },
      {
        "nome": "Nécessaire de viagem",
        "categoria": "Necessaires",
        "materiais": [
          {
            "nome": "Tecido nylon",
            "qtd": 0.6
          },
          {
            "nome": "Zíper 40cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 3
          },
          {
            "nome": "Entretela",
            "qtd": 0.5
          }
        ]
      },
      {
        "nome": "Bolsa de ombro",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Tecido oxford",
            "qtd": 0.7
          },
          {
            "nome": "Zíper 40cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 4
          },
          {
            "nome": "Fivela",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Bolsa tote",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.8
          },
          {
            "nome": "Cadarço",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Ecobag",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.6
          },
          {
            "nome": "Cadarço",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 2
          },
          {
            "nome": "Etiqueta bordada",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Bolsa térmica",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Tecido nylon",
            "qtd": 0.7
          },
          {
            "nome": "Zíper 40cm",
            "qtd": 1
          },
          {
            "nome": "Enchimento manta",
            "qtd": 0.5
          },
          {
            "nome": "Linha",
            "qtd": 4
          },
          {
            "nome": "Velcro",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Porta-moeda",
        "categoria": "Pequenos",
        "materiais": [
          {
            "nome": "Tecido tricoline",
            "qtd": 0.15
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Estojo escolar",
        "categoria": "Pequenos",
        "materiais": [
          {
            "nome": "Tecido oxford",
            "qtd": 0.2
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          },
          {
            "nome": "Entretela",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Porta-treco",
        "categoria": "Pequenos",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.2
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          }
        ]
      },
      {
        "nome": "Porta-documentos",
        "categoria": "Pequenos",
        "materiais": [
          {
            "nome": "Tecido oxford",
            "qtd": 0.25
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          },
          {
            "nome": "Ilhós",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Avental de cozinha",
        "categoria": "Aventais",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.8
          },
          {
            "nome": "Viés",
            "qtd": 2
          },
          {
            "nome": "Linha",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Avental infantil",
        "categoria": "Aventais",
        "materiais": [
          {
            "nome": "Tecido tricoline",
            "qtd": 0.5
          },
          {
            "nome": "Viés",
            "qtd": 1.5
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Almofada decorativa",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.5
          },
          {
            "nome": "Zíper 40cm",
            "qtd": 1
          },
          {
            "nome": "Enchimento manta",
            "qtd": 0.5
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Jogo americano",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.4
          },
          {
            "nome": "Viés",
            "qtd": 1.5
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Pano de prato bordado",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido algodão",
            "qtd": 0.3
          },
          {
            "nome": "Viés",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          },
          {
            "nome": "Etiqueta bordada",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Saco organizador",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido tactel",
            "qtd": 0.4
          },
          {
            "nome": "Cadarço",
            "qtd": 0.6
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          }
        ]
      },
      {
        "nome": "Capa de caderno",
        "categoria": "Papelaria têxtil",
        "materiais": [
          {
            "nome": "Tecido tricoline",
            "qtd": 0.3
          },
          {
            "nome": "Elástico",
            "qtd": 0.2
          },
          {
            "nome": "Linha",
            "qtd": 1.5
          },
          {
            "nome": "Entretela",
            "qtd": 0.3
          }
        ]
      }
    ]
  },
  {
    "id": "costura_criativa",
    "idSeed": "costura-criativa",
    "nome": "Costura Criativa",
    "icone": "🧷",
    "setores": [
      "Corte",
      "Costura",
      "Montagem",
      "Acabamento"
    ],
    "materiais": [
      {
        "nome": "Feltro (folha)",
        "unidade": "un"
      },
      {
        "nome": "Feltro adesivo",
        "unidade": "un"
      },
      {
        "nome": "Tecido patchwork",
        "unidade": "m"
      },
      {
        "nome": "Manta acrílica",
        "unidade": "m"
      },
      {
        "nome": "Enchimento fibra",
        "unidade": "g"
      },
      {
        "nome": "Linha",
        "unidade": "m"
      },
      {
        "nome": "Cola quente (refil)",
        "unidade": "un"
      },
      {
        "nome": "Cola de tecido",
        "unidade": "ml"
      },
      {
        "nome": "Olhos",
        "unidade": "par"
      },
      {
        "nome": "Fita de cetim",
        "unidade": "m"
      },
      {
        "nome": "Guizo",
        "unidade": "un"
      },
      {
        "nome": "Velcro",
        "unidade": "m"
      },
      {
        "nome": "Entretela",
        "unidade": "m"
      },
      {
        "nome": "Zíper 20cm",
        "unidade": "un"
      },
      {
        "nome": "Cordão",
        "unidade": "m"
      },
      {
        "nome": "Imã",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Lembrancinha de feltro",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 1
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 10
          },
          {
            "nome": "Linha",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Chaveiro de feltro",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 1
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 8
          },
          {
            "nome": "Linha",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Imã de feltro",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          },
          {
            "nome": "Imã",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Móbile de feltro",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 3
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 40
          },
          {
            "nome": "Linha",
            "qtd": 2
          },
          {
            "nome": "Cordão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Guirlanda de feltro",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 4
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 30
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.3
          },
          {
            "nome": "Cordão",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Enfeite de porta maternidade",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 3
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 40
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Topo de cesto de feltro",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 1
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 15
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Enfeite de árvore de natal",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 2
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 20
          },
          {
            "nome": "Linha",
            "qtd": 1
          },
          {
            "nome": "Cordão",
            "qtd": 0.5
          }
        ]
      },
      {
        "nome": "Boneca de pano",
        "categoria": "Bonecos",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.4
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 120
          },
          {
            "nome": "Linha",
            "qtd": 3
          },
          {
            "nome": "Olhos",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Boneco de pano",
        "categoria": "Bonecos",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.4
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 120
          },
          {
            "nome": "Linha",
            "qtd": 3
          },
          {
            "nome": "Olhos",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Naninha de bebê",
        "categoria": "Bebê",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.3
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 60
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Dedoche (fantoche)",
        "categoria": "Bebê",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 1
          },
          {
            "nome": "Olhos",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Livrinho sensorial",
        "categoria": "Bebê",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 4
          },
          {
            "nome": "Linha",
            "qtd": 3
          },
          {
            "nome": "Velcro",
            "qtd": 0.3
          },
          {
            "nome": "Guizo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Necessaire patchwork",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.3
          },
          {
            "nome": "Entretela",
            "qtd": 0.3
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Porta-treco de feltro",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Feltro (folha)",
            "qtd": 2
          },
          {
            "nome": "Feltro adesivo",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Jogo americano patchwork",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.4
          },
          {
            "nome": "Manta acrílica",
            "qtd": 0.4
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Almofada patchwork",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 0.5
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 300
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Colcha de retalhos",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Tecido patchwork",
            "qtd": 3
          },
          {
            "nome": "Manta acrílica",
            "qtd": 2
          },
          {
            "nome": "Linha",
            "qtd": 6
          }
        ]
      }
    ]
  },
  {
    "id": "croche_trico",
    "idSeed": "croche-trico",
    "nome": "Crochê e Tricô",
    "icone": "🧶",
    "setores": [
      "Tecer",
      "Montagem",
      "Acabamento",
      "Embalagem"
    ],
    "materiais": [
      {
        "nome": "Fio de algodão 4/8",
        "unidade": "novelo"
      },
      {
        "nome": "Fio de malha",
        "unidade": "kg"
      },
      {
        "nome": "Lã",
        "unidade": "novelo"
      },
      {
        "nome": "Barbante",
        "unidade": "rolo"
      },
      {
        "nome": "Enchimento fibra",
        "unidade": "g"
      },
      {
        "nome": "Olhos de segurança",
        "unidade": "par"
      },
      {
        "nome": "Forro de tecido",
        "unidade": "m"
      },
      {
        "nome": "Zíper 20cm",
        "unidade": "un"
      },
      {
        "nome": "Botão",
        "unidade": "un"
      },
      {
        "nome": "Fita de cetim",
        "unidade": "m"
      },
      {
        "nome": "Marcador",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Amigurumi pequeno",
        "categoria": "Amigurumi",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 1
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 30
          },
          {
            "nome": "Olhos de segurança",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Amigurumi grande",
        "categoria": "Amigurumi",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 3
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 120
          },
          {
            "nome": "Olhos de segurança",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Chaveiro amigurumi",
        "categoria": "Amigurumi",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 0.3
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 10
          },
          {
            "nome": "Olhos de segurança",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sousplat",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 1.5
          }
        ]
      },
      {
        "nome": "Jogo de sousplat (4)",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Porta-copos de crochê",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 0.5
          }
        ]
      },
      {
        "nome": "Tapete redondo",
        "categoria": "Tapetes",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Tapete oval",
        "categoria": "Tapetes",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 1.2
          }
        ]
      },
      {
        "nome": "Cesto organizador",
        "categoria": "Cestos",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 0.8
          }
        ]
      },
      {
        "nome": "Cesto com alça",
        "categoria": "Cestos",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Puff de crochê",
        "categoria": "Cestos",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 2.5
          },
          {
            "nome": "Enchimento fibra",
            "qtd": 500
          }
        ]
      },
      {
        "nome": "Bolsa de crochê",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Fio de malha",
            "qtd": 1
          },
          {
            "nome": "Forro de tecido",
            "qtd": 0.4
          },
          {
            "nome": "Zíper 20cm",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Touca de bebê",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Lã",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Manta de bebê",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Lã",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Manta casal",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Lã",
            "qtd": 12
          }
        ]
      },
      {
        "nome": "Cachecol",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Lã",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Top de crochê",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Fio de algodão 4/8",
            "qtd": 2
          },
          {
            "nome": "Botão",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Boina/gorro",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Lã",
            "qtd": 2
          }
        ]
      }
    ]
  },
  {
    "id": "encadernacao",
    "idSeed": "encadernacao-artesanal",
    "nome": "Encadernação Artesanal",
    "icone": "📓",
    "setores": [
      "Corte do miolo",
      "Costura",
      "Montagem da capa",
      "Prensa e Acabamento"
    ],
    "materiais": [
      {
        "nome": "Papel miolo 75g",
        "unidade": "folha"
      },
      {
        "nome": "Papel offset 120g",
        "unidade": "folha"
      },
      {
        "nome": "Papel kraft",
        "unidade": "folha"
      },
      {
        "nome": "Papelão cinza 2mm",
        "unidade": "un"
      },
      {
        "nome": "Papelão holler",
        "unidade": "un"
      },
      {
        "nome": "Tecido de revestimento",
        "unidade": "m"
      },
      {
        "nome": "Papel de revestimento",
        "unidade": "folha"
      },
      {
        "nome": "Linha de encadernação",
        "unidade": "m"
      },
      {
        "nome": "Cola branca PVA",
        "unidade": "ml"
      },
      {
        "nome": "Tarlatana",
        "unidade": "m"
      },
      {
        "nome": "Papel de guarda",
        "unidade": "folha"
      },
      {
        "nome": "Fita cabeço",
        "unidade": "m"
      },
      {
        "nome": "Wire-o",
        "unidade": "un"
      },
      {
        "nome": "Cadarço/fita",
        "unidade": "m"
      }
    ],
    "produtos": [
      {
        "nome": "Caderno costurado capa dura",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 96
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.4
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 30
          },
          {
            "nome": "Tarlatana",
            "qtd": 0.3
          },
          {
            "nome": "Papel de guarda",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Caderno wire-o",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 100
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 2
          },
          {
            "nome": "Wire-o",
            "qtd": 1
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Caderno pautado A5",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 80
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 2
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 25
          },
          {
            "nome": "Tarlatana",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Caderno de anotações kraft",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel kraft",
            "qtd": 60
          },
          {
            "nome": "Papelão holler",
            "qtd": 2
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 2
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 15
          }
        ]
      },
      {
        "nome": "Caderneta de bolso",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 48
          },
          {
            "nome": "Papelão holler",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 1
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 2
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 12
          }
        ]
      },
      {
        "nome": "Sketchbook",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 64
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.4
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 30
          }
        ]
      },
      {
        "nome": "Planner encadernado",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 60
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.4
          },
          {
            "nome": "Wire-o",
            "qtd": 1
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Planner de mesa encadernado",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 24
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 2
          },
          {
            "nome": "Wire-o",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Agenda encadernada",
        "categoria": "Agendas",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 180
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.4
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 4
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 30
          },
          {
            "nome": "Fita cabeço",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Diário costurado",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 96
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 2
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 25
          },
          {
            "nome": "Papel de guarda",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Álbum de fotos",
        "categoria": "Álbuns",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 40
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.5
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 35
          },
          {
            "nome": "Papel de guarda",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Álbum scrapbook",
        "categoria": "Álbuns",
        "materiais": [
          {
            "nome": "Papel kraft",
            "qtd": 30
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.5
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 30
          },
          {
            "nome": "Cadarço/fita",
            "qtd": 0.6
          }
        ]
      },
      {
        "nome": "Álbum do bebê",
        "categoria": "Álbuns",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 40
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.5
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 35
          },
          {
            "nome": "Papel de guarda",
            "qtd": 2
          },
          {
            "nome": "Cadarço/fita",
            "qtd": 0.6
          }
        ]
      },
      {
        "nome": "Livro de assinaturas",
        "categoria": "Álbuns",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 50
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.5
          },
          {
            "nome": "Linha de encadernação",
            "qtd": 3
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 30
          },
          {
            "nome": "Papel de guarda",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Bloco de notas capa dura",
        "categoria": "Blocos",
        "materiais": [
          {
            "nome": "Papel miolo 75g",
            "qtd": 50
          },
          {
            "nome": "Papelão holler",
            "qtd": 1
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 1
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 15
          }
        ]
      },
      {
        "nome": "Caderno de receitas encadernado",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 120g",
            "qtd": 70
          },
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Tecido de revestimento",
            "qtd": 0.4
          },
          {
            "nome": "Wire-o",
            "qtd": 1
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Fichário",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papelão cinza 2mm",
            "qtd": 2
          },
          {
            "nome": "Papel de revestimento",
            "qtd": 2
          },
          {
            "nome": "Cola branca PVA",
            "qtd": 20
          },
          {
            "nome": "Papel miolo 75g",
            "qtd": 40
          }
        ]
      }
    ]
  },
  {
    "id": "festas",
    "idSeed": "festas-lembrancinhas",
    "nome": "Festas e Lembrancinhas",
    "icone": "🎉",
    "setores": [
      "Arte",
      "Impressão",
      "Corte",
      "Montagem"
    ],
    "materiais": [
      {
        "nome": "Papel couché A4",
        "unidade": "folha"
      },
      {
        "nome": "Papel fotográfico",
        "unidade": "folha"
      },
      {
        "nome": "Papel adesivo",
        "unidade": "folha"
      },
      {
        "nome": "Papel de scrap",
        "unidade": "folha"
      },
      {
        "nome": "Papelão",
        "unidade": "un"
      },
      {
        "nome": "Caixa branca",
        "unidade": "un"
      },
      {
        "nome": "Tubete",
        "unidade": "un"
      },
      {
        "nome": "Latinha mint",
        "unidade": "un"
      },
      {
        "nome": "Saquinho celofane",
        "unidade": "un"
      },
      {
        "nome": "Fita de cetim",
        "unidade": "m"
      },
      {
        "nome": "Fita de florista",
        "unidade": "m"
      },
      {
        "nome": "Ilhós",
        "unidade": "un"
      },
      {
        "nome": "Cola branca",
        "unidade": "ml"
      },
      {
        "nome": "EVA glitter",
        "unidade": "folha"
      },
      {
        "nome": "Palito",
        "unidade": "un"
      },
      {
        "nome": "Tag kraft",
        "unidade": "un"
      },
      {
        "nome": "Laço pronto",
        "unidade": "un"
      },
      {
        "nome": "Cola quente (refil)",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Topo de bolo de papel",
        "categoria": "Topos",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 1
          },
          {
            "nome": "Palito",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Kit festa toppers",
        "categoria": "Topos",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 2
          },
          {
            "nome": "Palito",
            "qtd": 10
          },
          {
            "nome": "Cola branca",
            "qtd": 10
          },
          {
            "nome": "Fita de cetim",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Centro de mesa de papel",
        "categoria": "Topos",
        "materiais": [
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Papel de scrap",
            "qtd": 2
          },
          {
            "nome": "Palito",
            "qtd": 5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Caixa personalizada",
        "categoria": "Caixas",
        "materiais": [
          {
            "nome": "Caixa branca",
            "qtd": 1
          },
          {
            "nome": "Papel adesivo",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 5
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.5
          }
        ]
      },
      {
        "nome": "Caixa bem-nascido",
        "categoria": "Caixas",
        "materiais": [
          {
            "nome": "Caixa branca",
            "qtd": 1
          },
          {
            "nome": "Papel adesivo",
            "qtd": 1
          },
          {
            "nome": "Laço pronto",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Caixa cone",
        "categoria": "Caixas",
        "materiais": [
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Papel adesivo",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Caixa mini para doces",
        "categoria": "Caixas",
        "materiais": [
          {
            "nome": "Caixa branca",
            "qtd": 1
          },
          {
            "nome": "EVA glitter",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Tubete personalizado",
        "categoria": "Guloseimas",
        "materiais": [
          {
            "nome": "Tubete",
            "qtd": 1
          },
          {
            "nome": "Papel adesivo",
            "qtd": 1
          },
          {
            "nome": "Tag kraft",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Latinha personalizada",
        "categoria": "Guloseimas",
        "materiais": [
          {
            "nome": "Latinha mint",
            "qtd": 1
          },
          {
            "nome": "Papel adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Cone de guloseima",
        "categoria": "Guloseimas",
        "materiais": [
          {
            "nome": "Papel de scrap",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Porta-guloseima cônico",
        "categoria": "Guloseimas",
        "materiais": [
          {
            "nome": "EVA glitter",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Convite personalizado",
        "categoria": "Convites",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.3
          },
          {
            "nome": "Ilhós",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Convite scrap",
        "categoria": "Convites",
        "materiais": [
          {
            "nome": "Papel de scrap",
            "qtd": 1
          },
          {
            "nome": "Papel couché A4",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          },
          {
            "nome": "Laço pronto",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Tag de agradecimento",
        "categoria": "Tags e Rótulos",
        "materiais": [
          {
            "nome": "Tag kraft",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.2
          },
          {
            "nome": "Ilhós",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Rótulo de água",
        "categoria": "Tags e Rótulos",
        "materiais": [
          {
            "nome": "Papel adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Rótulo de guloseima",
        "categoria": "Tags e Rótulos",
        "materiais": [
          {
            "nome": "Papel adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sacolinha surpresa",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 5
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.4
          }
        ]
      },
      {
        "nome": "Lembrancinha saquinho",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Saquinho celofane",
            "qtd": 1
          },
          {
            "nome": "Tag kraft",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Bandeirola/varal",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Papel de scrap",
            "qtd": 3
          },
          {
            "nome": "Fita de florista",
            "qtd": 2
          },
          {
            "nome": "Cola branca",
            "qtd": 8
          }
        ]
      },
      {
        "nome": "Álbum de festa",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Papelão",
            "qtd": 2
          },
          {
            "nome": "Papel de scrap",
            "qtd": 4
          },
          {
            "nome": "Cola branca",
            "qtd": 15
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.5
          }
        ]
      }
    ]
  },
  {
    "id": "impressao_3d",
    "idSeed": "impressao-3d",
    "nome": "Impressão 3D",
    "icone": "🧊",
    "setores": [
      "Modelagem/Fatiamento",
      "Impressão",
      "Pós-processamento",
      "Pintura/Acabamento"
    ],
    "materiais": [
      {
        "nome": "Filamento PLA",
        "unidade": "g"
      },
      {
        "nome": "Filamento PETG",
        "unidade": "g"
      },
      {
        "nome": "Filamento ABS",
        "unidade": "g"
      },
      {
        "nome": "Filamento flexível TPU",
        "unidade": "g"
      },
      {
        "nome": "Resina 3D",
        "unidade": "ml"
      },
      {
        "nome": "Álcool isopropílico",
        "unidade": "ml"
      },
      {
        "nome": "Primer spray",
        "unidade": "ml"
      },
      {
        "nome": "Tinta acrílica",
        "unidade": "ml"
      },
      {
        "nome": "Verniz",
        "unidade": "ml"
      },
      {
        "nome": "Cola instantânea",
        "unidade": "ml"
      },
      {
        "nome": "Argola/chaveiro",
        "unidade": "un"
      },
      {
        "nome": "Ímã",
        "unidade": "un"
      },
      {
        "nome": "Base LED",
        "unidade": "un"
      },
      {
        "nome": "Parafuso/fixação",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Topo de bolo 3D",
        "categoria": "Topos",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 35
          },
          {
            "nome": "Primer spray",
            "qtd": 10
          },
          {
            "nome": "Tinta acrílica",
            "qtd": 8
          },
          {
            "nome": "Verniz",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Enfeite personalizado",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 40
          },
          {
            "nome": "Primer spray",
            "qtd": 10
          },
          {
            "nome": "Tinta acrílica",
            "qtd": 8
          },
          {
            "nome": "Verniz",
            "qtd": 5
          }
        ]
      },
      {
        "nome": "Chaveiro personalizado 3D",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 8
          },
          {
            "nome": "Argola/chaveiro",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Chaveiro nome/tag",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 10
          },
          {
            "nome": "Argola/chaveiro",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Marcador de página 3D",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Filamento flexível TPU",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Miniatura/action figure",
        "categoria": "Miniaturas",
        "materiais": [
          {
            "nome": "Resina 3D",
            "qtd": 30
          },
          {
            "nome": "Álcool isopropílico",
            "qtd": 20
          },
          {
            "nome": "Primer spray",
            "qtd": 8
          },
          {
            "nome": "Tinta acrílica",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Boneco articulado",
        "categoria": "Miniaturas",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 80
          },
          {
            "nome": "Parafuso/fixação",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Organizador de mesa",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 120
          }
        ]
      },
      {
        "nome": "Porta-canetas",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 90
          }
        ]
      },
      {
        "nome": "Porta-treco/gaveteiro",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 200
          }
        ]
      },
      {
        "nome": "Suporte de celular",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 60
          }
        ]
      },
      {
        "nome": "Suporte de fone/headset",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PETG",
            "qtd": 110
          },
          {
            "nome": "Parafuso/fixação",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Cortador de biscoito/pasta",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 25
          }
        ]
      },
      {
        "nome": "Vaso decorativo 3D",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Filamento PETG",
            "qtd": 150
          }
        ]
      },
      {
        "nome": "Cachepô 3D",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Filamento PETG",
            "qtd": 130
          }
        ]
      },
      {
        "nome": "Luminária 3D",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 140
          },
          {
            "nome": "Base LED",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Ímã decorativo 3D",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Filamento PLA",
            "qtd": 12
          },
          {
            "nome": "Ímã",
            "qtd": 1
          },
          {
            "nome": "Tinta acrílica",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Peça de reposição sob encomenda",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Filamento PETG",
            "qtd": 70
          }
        ]
      }
    ]
  },
  {
    "id": "lacos",
    "idSeed": "lacos-tiaras",
    "nome": "Laços e Tiaras",
    "icone": "🎀",
    "setores": [
      "Corte",
      "Montagem",
      "Acabamento",
      "Embalagem"
    ],
    "materiais": [
      {
        "nome": "Fita de gorgurão 22mm",
        "unidade": "m"
      },
      {
        "nome": "Fita de gorgurão 38mm",
        "unidade": "m"
      },
      {
        "nome": "Fita de cetim 10mm",
        "unidade": "m"
      },
      {
        "nome": "Fita de cetim 22mm",
        "unidade": "m"
      },
      {
        "nome": "Tiara plástica",
        "unidade": "un"
      },
      {
        "nome": "Tiara acrílica",
        "unidade": "un"
      },
      {
        "nome": "Bico de pato",
        "unidade": "un"
      },
      {
        "nome": "Presilha francesa",
        "unidade": "un"
      },
      {
        "nome": "Faixa meia de seda",
        "unidade": "un"
      },
      {
        "nome": "Elástico glitter",
        "unidade": "m"
      },
      {
        "nome": "Elástico fino",
        "unidade": "m"
      },
      {
        "nome": "Aplique de pérola",
        "unidade": "un"
      },
      {
        "nome": "Aplique de flor",
        "unidade": "un"
      },
      {
        "nome": "Aplique laço acrílico",
        "unidade": "un"
      },
      {
        "nome": "Strass",
        "unidade": "un"
      },
      {
        "nome": "Feltro",
        "unidade": "un"
      },
      {
        "nome": "Linha",
        "unidade": "m"
      },
      {
        "nome": "Cola quente (refil)",
        "unidade": "un"
      },
      {
        "nome": "Maria-chiquinha",
        "unidade": "un"
      },
      {
        "nome": "Xuxinha base",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Laço boutique P",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.5
          },
          {
            "nome": "Linha",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Laço boutique G",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Fita de gorgurão 38mm",
            "qtd": 0.7
          },
          {
            "nome": "Linha",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.15
          }
        ]
      },
      {
        "nome": "Laço duplo",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.5
          },
          {
            "nome": "Fita de cetim 10mm",
            "qtd": 0.4
          },
          {
            "nome": "Linha",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.15
          }
        ]
      },
      {
        "nome": "Laço com pérola",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.5
          },
          {
            "nome": "Aplique de pérola",
            "qtd": 1
          },
          {
            "nome": "Linha",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Laço glitter",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Elástico glitter",
            "qtd": 0.2
          },
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.4
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Laço texano",
        "categoria": "Laços",
        "materiais": [
          {
            "nome": "Fita de gorgurão 38mm",
            "qtd": 0.8
          },
          {
            "nome": "Linha",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.15
          }
        ]
      },
      {
        "nome": "Tiara de pérola",
        "categoria": "Tiaras",
        "materiais": [
          {
            "nome": "Tiara plástica",
            "qtd": 1
          },
          {
            "nome": "Aplique de pérola",
            "qtd": 8
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Tiara com laço",
        "categoria": "Tiaras",
        "materiais": [
          {
            "nome": "Tiara plástica",
            "qtd": 1
          },
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.5
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.15
          }
        ]
      },
      {
        "nome": "Tiara de flor",
        "categoria": "Tiaras",
        "materiais": [
          {
            "nome": "Tiara acrílica",
            "qtd": 1
          },
          {
            "nome": "Aplique de flor",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Tiara de strass",
        "categoria": "Tiaras",
        "materiais": [
          {
            "nome": "Tiara acrílica",
            "qtd": 1
          },
          {
            "nome": "Strass",
            "qtd": 20
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Bico de pato com laço",
        "categoria": "Bicos e Presilhas",
        "materiais": [
          {
            "nome": "Bico de pato",
            "qtd": 1
          },
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 0.4
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Presilha francesa decorada",
        "categoria": "Bicos e Presilhas",
        "materiais": [
          {
            "nome": "Presilha francesa",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim 22mm",
            "qtd": 0.3
          },
          {
            "nome": "Aplique de flor",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Presilha de feltro",
        "categoria": "Bicos e Presilhas",
        "materiais": [
          {
            "nome": "Presilha francesa",
            "qtd": 1
          },
          {
            "nome": "Feltro",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Faixa de bebê",
        "categoria": "Faixas",
        "materiais": [
          {
            "nome": "Faixa meia de seda",
            "qtd": 1
          },
          {
            "nome": "Aplique de flor",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Faixa turbante",
        "categoria": "Faixas",
        "materiais": [
          {
            "nome": "Faixa meia de seda",
            "qtd": 1
          },
          {
            "nome": "Aplique laço acrílico",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Maria-chiquinha (par)",
        "categoria": "Acessórios",
        "materiais": [
          {
            "nome": "Maria-chiquinha",
            "qtd": 2
          },
          {
            "nome": "Fita de cetim 10mm",
            "qtd": 0.4
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.1
          }
        ]
      },
      {
        "nome": "Xuxinha de fita",
        "categoria": "Acessórios",
        "materiais": [
          {
            "nome": "Xuxinha base",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim 22mm",
            "qtd": 0.5
          },
          {
            "nome": "Linha",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Kit 3 laços",
        "categoria": "Kits",
        "materiais": [
          {
            "nome": "Fita de gorgurão 22mm",
            "qtd": 1.2
          },
          {
            "nome": "Fita de cetim 10mm",
            "qtd": 0.8
          },
          {
            "nome": "Linha",
            "qtd": 1
          },
          {
            "nome": "Cola quente (refil)",
            "qtd": 0.3
          }
        ]
      }
    ]
  },
  {
    "id": "macrame",
    "idSeed": "macrame-textil",
    "nome": "Macramê e Têxtil",
    "icone": "🪢",
    "setores": [
      "Corte dos fios",
      "Amarração",
      "Montagem",
      "Acabamento"
    ],
    "materiais": [
      {
        "nome": "Barbante 4mm",
        "unidade": "m"
      },
      {
        "nome": "Barbante 6mm",
        "unidade": "m"
      },
      {
        "nome": "Corda de algodão",
        "unidade": "m"
      },
      {
        "nome": "Fio encerado",
        "unidade": "m"
      },
      {
        "nome": "Aro de metal",
        "unidade": "un"
      },
      {
        "nome": "Bastão de madeira",
        "unidade": "un"
      },
      {
        "nome": "Argola de madeira",
        "unidade": "un"
      },
      {
        "nome": "Conta de madeira",
        "unidade": "un"
      },
      {
        "nome": "Gancho/suporte",
        "unidade": "un"
      },
      {
        "nome": "Anilha",
        "unidade": "un"
      },
      {
        "nome": "Plaquinha",
        "unidade": "un"
      },
      {
        "nome": "Franja",
        "unidade": "m"
      }
    ],
    "produtos": [
      {
        "nome": "Suporte de planta simples",
        "categoria": "Suportes",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 8
          },
          {
            "nome": "Argola de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Suporte de planta duplo",
        "categoria": "Suportes",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 14
          },
          {
            "nome": "Argola de madeira",
            "qtd": 2
          },
          {
            "nome": "Conta de madeira",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Suporte de planta de parede",
        "categoria": "Suportes",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 10
          },
          {
            "nome": "Bastão de madeira",
            "qtd": 1
          },
          {
            "nome": "Gancho/suporte",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Painel de parede pequeno",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 25
          },
          {
            "nome": "Bastão de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Painel de parede grande",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Barbante 6mm",
            "qtd": 60
          },
          {
            "nome": "Bastão de madeira",
            "qtd": 1
          },
          {
            "nome": "Conta de madeira",
            "qtd": 6
          }
        ]
      },
      {
        "nome": "Mandala de macramê",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 20
          },
          {
            "nome": "Aro de metal",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Enfeite de porta",
        "categoria": "Painéis",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 18
          },
          {
            "nome": "Bastão de madeira",
            "qtd": 1
          },
          {
            "nome": "Conta de madeira",
            "qtd": 4
          },
          {
            "nome": "Franja",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Apanhador de sonhos",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 12
          },
          {
            "nome": "Aro de metal",
            "qtd": 1
          },
          {
            "nome": "Conta de madeira",
            "qtd": 6
          },
          {
            "nome": "Franja",
            "qtd": 1.5
          }
        ]
      },
      {
        "nome": "Luminária de macramê",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 22
          },
          {
            "nome": "Aro de metal",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Cortina de macramê",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Barbante 6mm",
            "qtd": 80
          },
          {
            "nome": "Bastão de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Chaveiro de macramê",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Fio encerado",
            "qtd": 2
          },
          {
            "nome": "Argola de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Chaveiro com plaquinha",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Fio encerado",
            "qtd": 1.5
          },
          {
            "nome": "Plaquinha",
            "qtd": 1
          },
          {
            "nome": "Anilha",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sousplat de macramê",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Corda de algodão",
            "qtd": 12
          }
        ]
      },
      {
        "nome": "Jogo americano de macramê",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Corda de algodão",
            "qtd": 16
          },
          {
            "nome": "Franja",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Porta-copos de macramê",
        "categoria": "Mesa",
        "materiais": [
          {
            "nome": "Corda de algodão",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Cesto de corda",
        "categoria": "Cestos",
        "materiais": [
          {
            "nome": "Corda de algodão",
            "qtd": 20
          }
        ]
      },
      {
        "nome": "Bolsa de macramê",
        "categoria": "Bolsas",
        "materiais": [
          {
            "nome": "Barbante 4mm",
            "qtd": 40
          },
          {
            "nome": "Argola de madeira",
            "qtd": 2
          }
        ]
      }
    ]
  },
  {
    "id": "papelaria",
    "idSeed": "papelaria-criativa",
    "nome": "Papelaria Criativa",
    "icone": "📎",
    "setores": [
      "Arte",
      "Impressão",
      "Corte",
      "Montagem"
    ],
    "materiais": [
      {
        "nome": "Papel offset 75g A4",
        "unidade": "folha"
      },
      {
        "nome": "Papel offset 90g A4",
        "unidade": "folha"
      },
      {
        "nome": "Papel couché A4",
        "unidade": "folha"
      },
      {
        "nome": "Papel adesivo",
        "unidade": "folha"
      },
      {
        "nome": "Capa dura",
        "unidade": "un"
      },
      {
        "nome": "Papelão",
        "unidade": "un"
      },
      {
        "nome": "Espiral wire-o",
        "unidade": "un"
      },
      {
        "nome": "Espiral plástico",
        "unidade": "un"
      },
      {
        "nome": "Elástico chapado",
        "unidade": "m"
      },
      {
        "nome": "Cola branca",
        "unidade": "ml"
      },
      {
        "nome": "Laminação BOPP",
        "unidade": "folha"
      },
      {
        "nome": "Ilhós",
        "unidade": "un"
      },
      {
        "nome": "Fita de cetim",
        "unidade": "m"
      },
      {
        "nome": "Marcador de tecido",
        "unidade": "un"
      },
      {
        "nome": "Separador plástico",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Planner permanente",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 90g A4",
            "qtd": 60
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Planner mensal",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 30
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Planner semanal",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 55
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Planner de mesa",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 90g A4",
            "qtd": 20
          },
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Planner financeiro",
        "categoria": "Planners",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 40
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          },
          {
            "nome": "Separador plástico",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Agenda",
        "categoria": "Agendas",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 180
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          },
          {
            "nome": "Marcador de tecido",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Caderno espiral",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 100
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral plástico",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Caderno inteligente",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 90g A4",
            "qtd": 120
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Caderno de receitas",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 90g A4",
            "qtd": 80
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          },
          {
            "nome": "Separador plástico",
            "qtd": 4
          }
        ]
      },
      {
        "nome": "Diário",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 90
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Bullet journal",
        "categoria": "Cadernos",
        "materiais": [
          {
            "nome": "Papel offset 90g A4",
            "qtd": 120
          },
          {
            "nome": "Capa dura",
            "qtd": 2
          },
          {
            "nome": "Elástico chapado",
            "qtd": 0.3
          },
          {
            "nome": "Marcador de tecido",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Bloco de notas",
        "categoria": "Blocos",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 50
          },
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 10
          }
        ]
      },
      {
        "nome": "Bloco de anotações adesivo",
        "categoria": "Blocos",
        "materiais": [
          {
            "nome": "Papel adesivo",
            "qtd": 20
          },
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 8
          }
        ]
      },
      {
        "nome": "Bloco planejador semanal",
        "categoria": "Blocos",
        "materiais": [
          {
            "nome": "Papel offset 75g A4",
            "qtd": 52
          },
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Cola branca",
            "qtd": 10
          }
        ]
      },
      {
        "nome": "Cartela de adesivos",
        "categoria": "Adesivos",
        "materiais": [
          {
            "nome": "Papel adesivo",
            "qtd": 1
          },
          {
            "nome": "Laminação BOPP",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Marcador de página",
        "categoria": "Marcadores",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 1
          },
          {
            "nome": "Laminação BOPP",
            "qtd": 1
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.2
          }
        ]
      },
      {
        "nome": "Kit marcadores",
        "categoria": "Marcadores",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 2
          },
          {
            "nome": "Laminação BOPP",
            "qtd": 2
          },
          {
            "nome": "Ilhós",
            "qtd": 4
          },
          {
            "nome": "Fita de cetim",
            "qtd": 0.6
          }
        ]
      },
      {
        "nome": "Calendário de mesa",
        "categoria": "Calendários",
        "materiais": [
          {
            "nome": "Papel couché A4",
            "qtd": 13
          },
          {
            "nome": "Papelão",
            "qtd": 1
          },
          {
            "nome": "Espiral wire-o",
            "qtd": 1
          }
        ]
      }
    ]
  },
  {
    "id": "resina",
    "idSeed": "resina-acrilico",
    "nome": "Resina e Acrílico",
    "icone": "💎",
    "setores": [
      "Preparo",
      "Mistura",
      "Molde",
      "Cura e Acabamento"
    ],
    "materiais": [
      {
        "nome": "Resina epóxi",
        "unidade": "ml"
      },
      {
        "nome": "Endurecedor",
        "unidade": "ml"
      },
      {
        "nome": "Corante para resina",
        "unidade": "ml"
      },
      {
        "nome": "Pigmento perolado",
        "unidade": "g"
      },
      {
        "nome": "Molde de silicone",
        "unidade": "un"
      },
      {
        "nome": "Glitter",
        "unidade": "g"
      },
      {
        "nome": "Flor seca",
        "unidade": "un"
      },
      {
        "nome": "Folha de ouro",
        "unidade": "un"
      },
      {
        "nome": "Argola/fixação",
        "unidade": "un"
      },
      {
        "nome": "Base de madeira",
        "unidade": "un"
      },
      {
        "nome": "Base MDF",
        "unidade": "un"
      },
      {
        "nome": "Álcool isopropílico",
        "unidade": "ml"
      },
      {
        "nome": "Corrente/chaveiro",
        "unidade": "un"
      },
      {
        "nome": "Verniz brilho",
        "unidade": "ml"
      },
      {
        "nome": "Bandeja acrílica",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Chaveiro de resina",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 15
          },
          {
            "nome": "Endurecedor",
            "qtd": 7
          },
          {
            "nome": "Corante para resina",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          },
          {
            "nome": "Corrente/chaveiro",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Chaveiro com flor seca",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 15
          },
          {
            "nome": "Endurecedor",
            "qtd": 7
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          },
          {
            "nome": "Flor seca",
            "qtd": 1
          },
          {
            "nome": "Corrente/chaveiro",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Marcador de página",
        "categoria": "Chaveiros",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 12
          },
          {
            "nome": "Endurecedor",
            "qtd": 6
          },
          {
            "nome": "Flor seca",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Porta-copos de resina",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 60
          },
          {
            "nome": "Endurecedor",
            "qtd": 30
          },
          {
            "nome": "Corante para resina",
            "qtd": 2
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Jogo de porta-copos",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 240
          },
          {
            "nome": "Endurecedor",
            "qtd": 120
          },
          {
            "nome": "Pigmento perolado",
            "qtd": 3
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          },
          {
            "nome": "Glitter",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Suporte de celular",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 50
          },
          {
            "nome": "Endurecedor",
            "qtd": 25
          },
          {
            "nome": "Corante para resina",
            "qtd": 2
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Bandeja resinada",
        "categoria": "Bandejas",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 200
          },
          {
            "nome": "Endurecedor",
            "qtd": 100
          },
          {
            "nome": "Corante para resina",
            "qtd": 3
          },
          {
            "nome": "Base de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Bandeja com alça",
        "categoria": "Bandejas",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 180
          },
          {
            "nome": "Endurecedor",
            "qtd": 90
          },
          {
            "nome": "Pigmento perolado",
            "qtd": 4
          },
          {
            "nome": "Bandeja acrílica",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Brinco de resina",
        "categoria": "Bijuteria",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 8
          },
          {
            "nome": "Endurecedor",
            "qtd": 4
          },
          {
            "nome": "Corante para resina",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          },
          {
            "nome": "Argola/fixação",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Colar/pingente de resina",
        "categoria": "Bijuteria",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 10
          },
          {
            "nome": "Endurecedor",
            "qtd": 5
          },
          {
            "nome": "Flor seca",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          },
          {
            "nome": "Argola/fixação",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Quadro resinado",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 120
          },
          {
            "nome": "Endurecedor",
            "qtd": 60
          },
          {
            "nome": "Corante para resina",
            "qtd": 3
          },
          {
            "nome": "Base MDF",
            "qtd": 1
          },
          {
            "nome": "Folha de ouro",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Enfeite geode",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 100
          },
          {
            "nome": "Endurecedor",
            "qtd": 50
          },
          {
            "nome": "Corante para resina",
            "qtd": 3
          },
          {
            "nome": "Glitter",
            "qtd": 3
          },
          {
            "nome": "Folha de ouro",
            "qtd": 2
          },
          {
            "nome": "Base MDF",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Luminária de resina",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 80
          },
          {
            "nome": "Endurecedor",
            "qtd": 40
          },
          {
            "nome": "Corante para resina",
            "qtd": 2
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vaso resinado",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 90
          },
          {
            "nome": "Endurecedor",
            "qtd": 45
          },
          {
            "nome": "Corante para resina",
            "qtd": 2
          },
          {
            "nome": "Base de madeira",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Porta-joias de resina",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 70
          },
          {
            "nome": "Endurecedor",
            "qtd": 35
          },
          {
            "nome": "Pigmento perolado",
            "qtd": 3
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Imã de geladeira",
        "categoria": "Lembrancinhas",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 8
          },
          {
            "nome": "Endurecedor",
            "qtd": 4
          },
          {
            "nome": "Corante para resina",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Prato decorativo",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 150
          },
          {
            "nome": "Endurecedor",
            "qtd": 75
          },
          {
            "nome": "Pigmento perolado",
            "qtd": 4
          },
          {
            "nome": "Glitter",
            "qtd": 3
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Caneta de resina",
        "categoria": "Utilidades",
        "materiais": [
          {
            "nome": "Resina epóxi",
            "qtd": 10
          },
          {
            "nome": "Endurecedor",
            "qtd": 5
          },
          {
            "nome": "Glitter",
            "qtd": 1
          },
          {
            "nome": "Molde de silicone",
            "qtd": 1
          }
        ]
      }
    ]
  },
  {
    "id": "sublimacao",
    "idSeed": "sublimacao",
    "nome": "Sublimação",
    "icone": "🖨️",
    "setores": [
      "Arte",
      "Impressão",
      "Prensa",
      "Acabamento"
    ],
    "materiais": [
      {
        "nome": "Caneca branca poliéster",
        "unidade": "un"
      },
      {
        "nome": "Caneca mágica",
        "unidade": "un"
      },
      {
        "nome": "Caneca cerâmica premium",
        "unidade": "un"
      },
      {
        "nome": "Camiseta poliéster",
        "unidade": "un"
      },
      {
        "nome": "Body poliéster",
        "unidade": "un"
      },
      {
        "nome": "Almofada poliéster",
        "unidade": "un"
      },
      {
        "nome": "Enchimento almofada",
        "unidade": "un"
      },
      {
        "nome": "Squeeze de alumínio",
        "unidade": "un"
      },
      {
        "nome": "Garrafa térmica",
        "unidade": "un"
      },
      {
        "nome": "Chinelo sublimático",
        "unidade": "par"
      },
      {
        "nome": "Azulejo 15x15",
        "unidade": "un"
      },
      {
        "nome": "Mousepad",
        "unidade": "un"
      },
      {
        "nome": "Porta-copo MDF",
        "unidade": "un"
      },
      {
        "nome": "Quebra-cabeça",
        "unidade": "un"
      },
      {
        "nome": "Chaveiro acrílico",
        "unidade": "un"
      },
      {
        "nome": "Papel sublimático A4",
        "unidade": "folha"
      },
      {
        "nome": "Tinta sublimática",
        "unidade": "ml"
      },
      {
        "nome": "Fita térmica",
        "unidade": "m"
      }
    ],
    "produtos": [
      {
        "nome": "Caneca personalizada",
        "categoria": "Canecas",
        "materiais": [
          {
            "nome": "Caneca branca poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Caneca mágica",
        "categoria": "Canecas",
        "materiais": [
          {
            "nome": "Caneca mágica",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Caneca premium",
        "categoria": "Canecas",
        "materiais": [
          {
            "nome": "Caneca cerâmica premium",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Kit caneca + caixa",
        "categoria": "Canecas",
        "materiais": [
          {
            "nome": "Caneca branca poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Camiseta personalizada",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Camiseta poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Camiseta infantil",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Camiseta poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Body de bebê",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Body poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Almofada personalizada",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Almofada poliéster",
            "qtd": 1
          },
          {
            "nome": "Enchimento almofada",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Almofada mágica lantejoula",
        "categoria": "Casa",
        "materiais": [
          {
            "nome": "Almofada poliéster",
            "qtd": 1
          },
          {
            "nome": "Enchimento almofada",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Squeeze personalizado",
        "categoria": "Bebidas",
        "materiais": [
          {
            "nome": "Squeeze de alumínio",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Garrafa térmica",
        "categoria": "Bebidas",
        "materiais": [
          {
            "nome": "Garrafa térmica",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Chinelo personalizado",
        "categoria": "Vestuário",
        "materiais": [
          {
            "nome": "Chinelo sublimático",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Azulejo decorativo",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Azulejo 15x15",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      },
      {
        "nome": "Mousepad",
        "categoria": "Escritório",
        "materiais": [
          {
            "nome": "Mousepad",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Porta-copo",
        "categoria": "Decoração",
        "materiais": [
          {
            "nome": "Porta-copo MDF",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Quebra-cabeça personalizado",
        "categoria": "Brindes",
        "materiais": [
          {
            "nome": "Quebra-cabeça",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          }
        ]
      },
      {
        "nome": "Chaveiro sublimático",
        "categoria": "Brindes",
        "materiais": [
          {
            "nome": "Chaveiro acrílico",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Caneca com nome",
        "categoria": "Canecas",
        "materiais": [
          {
            "nome": "Caneca branca poliéster",
            "qtd": 1
          },
          {
            "nome": "Papel sublimático A4",
            "qtd": 1
          },
          {
            "nome": "Tinta sublimática",
            "qtd": 2
          },
          {
            "nome": "Fita térmica",
            "qtd": 0.3
          }
        ]
      }
    ]
  },
  {
    "id": "velas_cosmeticos",
    "idSeed": "velas-cosmeticos",
    "nome": "Velas e Cosméticos",
    "icone": "🕯️",
    "setores": [
      "Preparo",
      "Aromatização",
      "Envase",
      "Cura e Rotulagem"
    ],
    "materiais": [
      {
        "nome": "Cera de soja",
        "unidade": "g"
      },
      {
        "nome": "Cera de coco",
        "unidade": "g"
      },
      {
        "nome": "Parafina",
        "unidade": "g"
      },
      {
        "nome": "Pavio de algodão",
        "unidade": "un"
      },
      {
        "nome": "Pavio de madeira",
        "unidade": "un"
      },
      {
        "nome": "Essência aromática",
        "unidade": "ml"
      },
      {
        "nome": "Corante para vela",
        "unidade": "ml"
      },
      {
        "nome": "Recipiente de vidro",
        "unidade": "un"
      },
      {
        "nome": "Recipiente de lata",
        "unidade": "un"
      },
      {
        "nome": "Pote PET",
        "unidade": "un"
      },
      {
        "nome": "Rótulo adesivo",
        "unidade": "un"
      },
      {
        "nome": "Base glicerina",
        "unidade": "g"
      },
      {
        "nome": "Fragrância cosmética",
        "unidade": "ml"
      },
      {
        "nome": "Forma de sabonete",
        "unidade": "un"
      },
      {
        "nome": "Álcool líquido",
        "unidade": "ml"
      },
      {
        "nome": "Óleo essencial",
        "unidade": "ml"
      },
      {
        "nome": "Manteiga de karité",
        "unidade": "g"
      },
      {
        "nome": "Embalagem kraft",
        "unidade": "un"
      }
    ],
    "produtos": [
      {
        "nome": "Vela aromática pote de vidro",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 180
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 12
          },
          {
            "nome": "Corante para vela",
            "qtd": 1
          },
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela aromática lata",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 150
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 10
          },
          {
            "nome": "Recipiente de lata",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela pote lata grande",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de coco",
            "qtd": 300
          },
          {
            "nome": "Pavio de madeira",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 20
          },
          {
            "nome": "Recipiente de lata",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela de pavio de madeira",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de coco",
            "qtd": 180
          },
          {
            "nome": "Pavio de madeira",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 12
          },
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela aromática mini",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 60
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 4
          },
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela decorativa",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Parafina",
            "qtd": 150
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Corante para vela",
            "qtd": 2
          },
          {
            "nome": "Essência aromática",
            "qtd": 8
          }
        ]
      },
      {
        "nome": "Vela flutuante",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Parafina",
            "qtd": 40
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Corante para vela",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela votiva",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 50
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 3
          }
        ]
      },
      {
        "nome": "Vela de massagem",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 120
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Óleo essencial",
            "qtd": 6
          },
          {
            "nome": "Recipiente de lata",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Vela religiosa",
        "categoria": "Velas",
        "materiais": [
          {
            "nome": "Parafina",
            "qtd": 120
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Difusor de ambiente",
        "categoria": "Aromatizadores",
        "materiais": [
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 30
          },
          {
            "nome": "Álcool líquido",
            "qtd": 70
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Home spray",
        "categoria": "Aromatizadores",
        "materiais": [
          {
            "nome": "Pote PET",
            "qtd": 1
          },
          {
            "nome": "Fragrância cosmética",
            "qtd": 20
          },
          {
            "nome": "Álcool líquido",
            "qtd": 80
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sabonete artesanal",
        "categoria": "Sabonetes",
        "materiais": [
          {
            "nome": "Base glicerina",
            "qtd": 100
          },
          {
            "nome": "Fragrância cosmética",
            "qtd": 3
          },
          {
            "nome": "Corante para vela",
            "qtd": 1
          },
          {
            "nome": "Forma de sabonete",
            "qtd": 1
          },
          {
            "nome": "Embalagem kraft",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sabonete esfoliante",
        "categoria": "Sabonetes",
        "materiais": [
          {
            "nome": "Base glicerina",
            "qtd": 100
          },
          {
            "nome": "Óleo essencial",
            "qtd": 3
          },
          {
            "nome": "Forma de sabonete",
            "qtd": 1
          },
          {
            "nome": "Embalagem kraft",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Sabonete infantil",
        "categoria": "Sabonetes",
        "materiais": [
          {
            "nome": "Base glicerina",
            "qtd": 90
          },
          {
            "nome": "Fragrância cosmética",
            "qtd": 2
          },
          {
            "nome": "Corante para vela",
            "qtd": 1
          },
          {
            "nome": "Forma de sabonete",
            "qtd": 1
          },
          {
            "nome": "Embalagem kraft",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Manteiga corporal",
        "categoria": "Cosméticos",
        "materiais": [
          {
            "nome": "Manteiga de karité",
            "qtd": 80
          },
          {
            "nome": "Óleo essencial",
            "qtd": 4
          },
          {
            "nome": "Pote PET",
            "qtd": 1
          },
          {
            "nome": "Rótulo adesivo",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Escalda-pés",
        "categoria": "Cosméticos",
        "materiais": [
          {
            "nome": "Base glicerina",
            "qtd": 120
          },
          {
            "nome": "Óleo essencial",
            "qtd": 5
          },
          {
            "nome": "Embalagem kraft",
            "qtd": 1
          }
        ]
      },
      {
        "nome": "Kit vela + sabonete",
        "categoria": "Kits",
        "materiais": [
          {
            "nome": "Cera de soja",
            "qtd": 120
          },
          {
            "nome": "Pavio de algodão",
            "qtd": 1
          },
          {
            "nome": "Essência aromática",
            "qtd": 8
          },
          {
            "nome": "Recipiente de vidro",
            "qtd": 1
          },
          {
            "nome": "Base glicerina",
            "qtd": 90
          },
          {
            "nome": "Forma de sabonete",
            "qtd": 1
          }
        ]
      }
    ]
  }
]

export const SEGMENTO_POR_ID: Record<string, SegmentoSeed> =
  Object.fromEntries(CATALOGO_SEGMENTOS.map(s => [s.id, s]))

export function resumoSegmentos(): { id: string; nome: string; icone: string; produtos: number; materiais: number }[] {
  return CATALOGO_SEGMENTOS.map(s => ({ id: s.id, nome: s.nome, icone: s.icone, produtos: s.produtos.length, materiais: s.materiais.length }))
}
