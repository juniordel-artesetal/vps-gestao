// app/api/precificacao/ncm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ─────────────────────────────────────────────────────────────────────────────
// BASE NCM ARTESANATO BRASIL — 35 categorias pesquisadas e validadas 2025/2026
// Fontes: TIPI (Decreto 11.158/2022), Receita Federal, SEFAZ, contabeis.com.br
// ATENÇÃO: Consulte sempre um contador para validação fiscal definitiva
// ─────────────────────────────────────────────────────────────────────────────
const NCM_BASE = [

  // ── LAÇOS / ACESSÓRIOS CABELO ──────────────────────────────────────────────
  {
    id: '9615.19.00', nome: 'Laço de Cabelo / Tiara / Faixa de Cabelo',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0% (artesanato). NCM específico para laços e tiaras de cabelo confeccionados com fitas, tecidos e apliques.',
    palavras: ['laço','laco','lacos','laços','tiara','faixa cabelo','acessório cabelo','acessorio cabelo','scrunchie','xuxinha','presilha']
  },
  {
    id: '6217.10.00', nome: 'Acessórios de Vestuário em Tecido / Fitas',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Aplica-se a laços, fitas e acessórios confeccionados em tecido (gorgurão, cetim, organza, tule).',
    palavras: ['gorgurão','gorgurao','cetim','organza','tule','veludo','fita cabelo','fita laço','fita laco','tecido laço']
  },

  // ── CROCHÊ / TRICÔ / AMIGURUMI ─────────────────────────────────────────────
  {
    id: '5801.23.00', nome: 'Pelúcias / Crochê / Artesanato em Malha',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0% (artesanato manual). NCM para peças de crochê, tricô e amigurumi feitos à mão.',
    palavras: ['crochê','croche','tricô','trico','amigurumi','pelúcia','pelucia','bicho de crochê','boneco crochê','boneco pelucia']
  },
  {
    id: '6116.10.00', nome: 'Luvas / Artigos de Malha em Fibra',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Artigos de malha em fibra sintética ou artificial.',
    palavras: ['luva crochê','touca','gorro tricô','cachecol','meias artesanais','roupa crochê']
  },

  // ── BIJUTERIAS / SEMIJOIAS ─────────────────────────────────────────────────
  {
    id: '7117.19.00', nome: 'Bijuterias / Semijoias (metais comuns)',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Para colares, pulseiras, brincos e anéis artesanais em metais comuns, resina ou acrílico.',
    palavras: ['bijuteria','bijou','semijoia','semi joia','colar','pulseira','brinco','anel','broche','berloque','charm','pingente','gargantilha']
  },
  {
    id: '7113.19.00', nome: 'Joias / Artefatos em Prata ou Ouro',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Para peças em prata, ouro ou folheadas.',
    palavras: ['prata','ouro','folheado','joia','joalheria','cordão prata','anel prata']
  },

  // ── SUBLIMAÇÃO / PERSONALIZAÇÃO ────────────────────────────────────────────
  {
    id: '4911.99.00', nome: 'Impressos Gráficos Personalizados / Sublimação',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. NCM utilizado por MEI/artesãos para sublimação geral (canecas, almofadas, camisas). Consulte contador para uso específico por produto.',
    palavras: ['sublimação','sublimacao','personalizado','personalizada','estampado','impresso personalizado','placa personalizada','placa sublimada']
  },
  {
    id: '6302.60.00', nome: 'Toalha Personalizada / Sublimação Têxtil',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Toalhas de praia, rosto e banho personalizadas com sublimação.',
    palavras: ['toalha personalizada','toalha sublimada','toalha praia','toalha microfibra personalizada']
  },
  {
    id: '9404.90.00', nome: 'Almofada Personalizada / Sublimação',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Almofadas recheadas personalizadas com sublimação.',
    palavras: ['almofada','almofada personalizada','almofada sublimada','cushion personalizado','capa almofada']
  },

  // ── CERÂMICA / PORCELANA ───────────────────────────────────────────────────
  {
    id: '6912.00.00', nome: 'Caneca / Prato / Xícara de Cerâmica',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Canecas, pratos, xícaras e artigos de cerâmica comuns.',
    palavras: ['caneca','canecas','xicara','xícara','prato cerâmica','prato ceramica','copo cerâmica','artigo cerâmica']
  },
  {
    id: '6913.10.00', nome: 'Estatuetas / Enfeites de Porcelana / Cerâmica',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Estatuetas, bonequinhos e enfeites decorativos de porcelana ou cerâmica.',
    palavras: ['estatueta','bonequinho porcelana','miniatura cerâmica','enfeite porcelana','biscuit','porcelana fria','cold porcelain']
  },
  {
    id: '6914.10.00', nome: 'Outros Artigos de Porcelana',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Artigos de porcelana não enquadrados em outras posições.',
    palavras: ['porcelana','pote porcelana','vaso porcelana','cachepot porcelana']
  },

  // ── MDF / MADEIRA / LASER ──────────────────────────────────────────────────
  {
    id: '4421.99.00', nome: 'Artigos de Madeira / MDF / Corte Laser',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Organizadores, caixas, suportes e artigos decorativos em MDF ou madeira, inclusive com corte a laser.',
    palavras: ['mdf','madeira','corte laser','laser','organizador mdf','caixa mdf','bandeja mdf','nicho mdf','porta treco','suporte madeira','display madeira','personali laser']
  },
  {
    id: '4419.11.00', nome: 'Tábua de Madeira / Utensílio de Cozinha em Madeira',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Tábuas de corte, colheres, utensílios de cozinha em madeira personalizados.',
    palavras: ['tábua madeira','tabua madeira','tábua corte personalizada','colher madeira','espatula madeira','utensilio madeira','kit cozinha madeira']
  },
  {
    id: '4420.90.00', nome: 'Porta-Joias / Porta-Bijoux de Madeira',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Porta-joias, porta-bijoux e estojos de madeira decorados.',
    palavras: ['porta joia','porta joias','porta bijoux','porta bijou','estojo madeira','caixinha madeira joias']
  },

  // ── PORTA-RETRATO / MOLDURA ────────────────────────────────────────────────
  {
    id: '8306.30.00', nome: 'Porta-Retrato / Moldura / Quadro Decorativo',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Porta-retratos, molduras e quadros decorativos.',
    palavras: ['porta retrato','porta-retrato','moldura','quadro decorativo','frame personalizado','quadro personalizado']
  },

  // ── ARTE / PINTURAS FEITAS À MÃO ──────────────────────────────────────────
  {
    id: '9701.10.00', nome: 'Pinturas / Quadros Feitos à Mão',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0% (obra de arte). Pinturas, aquarelas e quadros feitos inteiramente à mão.',
    palavras: ['pintura','quadro pintado','arte à mão','arte a mao','aquarela','tela pintada','óleo sobre tela','acrílico sobre tela','watercolor','ilustração manual']
  },

  // ── ARTIGOS DE FESTA / DECORAÇÃO ──────────────────────────────────────────
  {
    id: '9505.90.00', nome: 'Artigos de Festa / Decoração / Toppers',
    icmsInterno: 0.18, ipi: 0.15,
    nota: 'ICMS 18% SP. IPI 15%. Toppers, enfeites de festa, balões e artigos decorativos para festas.',
    palavras: ['topper','festa','decoração festa','decoracao festa','enfeite festa','balão','balao','topo de bolo','painel festa','kit festa','festinha','mesversário','mesversario']
  },
  {
    id: '6304.99.00', nome: 'Artigos Decorativos Têxteis / Guirlandas',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Guirlandas, banners têxteis e artigos decorativos em tecido.',
    palavras: ['guirlanda','bandeirinha','banner tecido','festão','bunting','decoração tecido']
  },

  // ── EMBALAGENS ─────────────────────────────────────────────────────────────
  {
    id: '4819.20.00', nome: 'Caixas / Embalagens de Papelão Personalizadas',
    icmsInterno: 0.18, ipi: 0.10,
    nota: 'ICMS 18% SP. IPI 10%. Caixas e embalagens de papelão, kraft ou cartão personalizadas.',
    palavras: ['caixa embalagem','caixa kraft','caixa papelão','caixa cartao','embalagem personalizada','gift box','caixa presente','caixinha presente','caixa brinde']
  },
  {
    id: '3923.21.90', nome: 'Saquinhos / Embalagens Plásticas',
    icmsInterno: 0.18, ipi: 0.10,
    nota: 'ICMS 18% SP. IPI 10%. Sacos e saquinhos plásticos para embalagem.',
    palavras: ['saquinho plástico','saquinho celofane','saco personalizado','embalagem plastica','zip lock personalizado']
  },

  // ── CONVITES / PAPELARIA ───────────────────────────────────────────────────
  {
    id: '4909.00.00', nome: 'Convites / Cartões Impressos Personalizados',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Convites, cartões de aniversário, casamento e eventos personalizados.',
    palavras: ['convite','cartão personalizado','cartao personalizado','convite festa','convite casamento','convite aniversário','papelaria personalizada','save the date']
  },
  {
    id: '4911.10.00', nome: 'Tags / Etiquetas / Adesivos / Stickers',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Tags de produto, etiquetas personalizadas, adesivos e stickers.',
    palavras: ['tag','etiqueta','adesivo','sticker','tag produto','etiqueta personalizada','adesivo personalizado','rótulo','rotulo']
  },
  {
    id: '4901.99.00', nome: 'Cadernos / Planners / Agendas Personalizadas',
    icmsInterno: 0.00, ipi: 0.00,
    nota: 'ICMS isento SP (livros e cadernos). IPI 0%. Cadernos, planners, agendas e bloquinhos personalizados.',
    palavras: ['caderno','planner','agenda personalizada','bloquinho','bloco personalizado','caderneta','sketchbook personalizado']
  },

  // ── RESINA / POLÍMEROS ─────────────────────────────────────────────────────
  {
    id: '3926.40.00', nome: 'Estatuetas / Artigos Decorativos de Resina / Plástico',
    icmsInterno: 0.18, ipi: 0.15,
    nota: 'ICMS 18% SP. IPI 15%. Cofrinho, estatuetas, enfeites e artigos decorativos moldados em resina ou plástico.',
    palavras: ['resina','cofrinho','cofre resina','estatueta resina','enfeite resina','artigo resina','molde resina','epóxi','epoxi','silicone artesanal','vela perfumada']
  },
  {
    id: '3924.10.00', nome: 'Utensílios de Mesa em Plástico / Acrílico',
    icmsInterno: 0.18, ipi: 0.15,
    nota: 'ICMS 18% SP. IPI 15%. Porta-copos, bandejas e utensílios de mesa em acrílico ou plástico.',
    palavras: ['acrílico','acrilico','porta copo acrílico','bandeja acrílico','display acrílico','placa acrílico']
  },

  // ── BOLSAS / NECESSAIRES ───────────────────────────────────────────────────
  {
    id: '4202.92.00', nome: 'Bolsas / Necessaires / Organizadores de Tecido',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Bolsas, necessaires, pochetes e organizadores confeccionados em tecido.',
    palavras: ['necessaire','bolsa tecido','pochete','organizador tecido','bolsinha','clutch','frasqueira','ecobag personalizada']
  },
  {
    id: '4205.00.90', nome: 'Artigos em Couro / Couro Sintético',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Carteiras, porta-documentos e artigos em couro ou couro sintético.',
    palavras: ['couro','couro sintético','couro sintetico','carteira couro','porta documento couro','cinto couro']
  },

  // ── ROUPAS / VESTUÁRIO PERSONALIZADO ──────────────────────────────────────
  {
    id: '6109.10.00', nome: 'Camisetas Personalizadas (algodão)',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Camisetas em algodão com estampa, bordado ou sublimação.',
    palavras: ['camiseta','camisa personalizada','camiseta personalizada','camiseta estampada','baby look','regata personalizada']
  },
  {
    id: '6211.43.00', nome: 'Avental / Roupa de Trabalho Personalizada',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Aventais e uniformes personalizados.',
    palavras: ['avental personalizado','uniforme personalizado','jaleco','avental chef']
  },

  // ── VELAS / AROMATERAPIA ───────────────────────────────────────────────────
  {
    id: '3406.00.10', nome: 'Velas Decorativas / Aromáticas Artesanais',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Velas artesanais decorativas, aromáticas e de soja.',
    palavras: ['vela','vela artesanal','vela aromática','vela aromatica','vela soja','vela decorativa','vela perfumada','difusor']
  },

  // ── SABONETES / COSMÉTICOS ARTESANAIS ─────────────────────────────────────
  {
    id: '3401.11.90', nome: 'Sabonetes Artesanais',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0% (artesanal). Sabonetes artesanais em barra, glicerinados e naturais.',
    palavras: ['sabonete','sabonete artesanal','sabonete glicerinado','sabonete natural','sabonete vegano','hidratante artesanal']
  },

  // ── PAPELÃO / PAPEL ARTESANAL ──────────────────────────────────────────────
  {
    id: '4823.90.90', nome: 'Artigos de Papel / Scrapbook / Papelaria Artesanal',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Artigos de papel, scrapbook, dobraduras e papelaria artesanal em geral.',
    palavras: ['scrapbook','origami','dobradura','papel decorativo','papelaria artesanal','álbum artesanal','album fotos artesanal']
  },

  // ── PORTA-BEBÊ / MATERNIDADE ───────────────────────────────────────────────
  {
    id: '6209.20.00', nome: 'Artigos para Bebê (tecido de algodão)',
    icmsInterno: 0.12, ipi: 0.00,
    nota: 'ICMS 12% SP. IPI 0%. Cueiros, fraldas de pano, roupinhas e acessórios de algodão para bebê.',
    palavras: ['bebê','bebe','cueiro','fralda pano','body bebê','enxoval bebê','maternidade personalizada','kit bebe']
  },

  // ── ARTIGOS DE VIDRO ───────────────────────────────────────────────────────
  {
    id: '7013.49.00', nome: 'Artigos de Vidro Decorativos',
    icmsInterno: 0.18, ipi: 0.00,
    nota: 'ICMS 18% SP. IPI 0%. Potes, vasos, castiçais e artigos decorativos em vidro.',
    palavras: ['vidro decorativo','pote vidro','vaso vidro','castiçal vidro','lustre vidro','garrafa decorada','lanterna vidro']
  },
]

// ─── Score e busca ────────────────────────────────────────────────────────────
function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
}

function scoreNCM(ncm: typeof NCM_BASE[0], busca: string): number {
  const bNorm = normStr(busca)
  const bTokens = bNorm.split(/\s+/).filter(t => t.length > 2)
  let score = 0
  for (const palavra of ncm.palavras) {
    const pNorm = normStr(palavra)
    if (bNorm.includes(pNorm)) score += pNorm.split(' ').length * 2 // frase completa vale mais
    else {
      const pTokens = pNorm.split(/\s+/)
      for (const pt of pTokens) {
        if (pt.length > 2 && bTokens.some(bt => bt.includes(pt) || pt.includes(bt))) score += 1
      }
    }
  }
  return score
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const { produto } = await req.json()
    if (!produto?.trim()) return NextResponse.json({ error: 'Descrição obrigatória' }, { status: 400 })

    const scores = NCM_BASE.map(ncm => ({ ...ncm, score: scoreNCM(ncm, produto) }))
    const ordenados = scores.sort((a, b) => b.score - a.score)

    const encontrados = ordenados
      .filter(n => n.score > 0)
      .slice(0, 5)
      .map(({ palavras, score, ...ncm }) => ncm)

    if (encontrados.length > 0) {
      return NextResponse.json({ ncms: encontrados })
    }

    // Fallback: retorna os 4 mais comuns para artesanato
    const fallback = [NCM_BASE[0], NCM_BASE[6], NCM_BASE[12], NCM_BASE[18]]
      .map(({ palavras, ...ncm }) => ncm)
    return NextResponse.json({
      ncms: fallback,
      mensagem: 'Nenhum NCM específico encontrado. Mostrando os mais comuns. Consulte um contador para sua atividade.'
    })
  } catch (error) {
    console.error('[POST ncm]', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
