// Segmentos de ateliê — LISTA CANÔNICA.
//
// Extraída de app/setup/page.tsx, onde vivia inline. Agora o cadastro e o
// onboarding leem daqui: duas cópias da mesma lista derivam com o tempo, e
// `Workspace.segmento` guarda o `id` — um id divergente entre as telas viraria
// segmento órfão, invisível nos filtros e nos relatórios.
//
// ⚠️ O `id` é o que vai para o banco (ex.: 'festas', 'papelaria'). NUNCA renomear
//    um id sem migrar os dados: em produção há 227 workspaces já classificados.

export interface Segmento {
  id: string
  nome: string
  emoji: string
  descricao: string
  /** Setores criados no onboarding. Vazio = a artesã monta do zero. */
  setores: string[]
}

export const SEGMENTOS: Segmento[] = [
  { id: 'lacos',            nome: 'Laços e Tiaras',           emoji: '🎀', descricao: 'Laços, tiaras e acessórios para cabelo',                     setores: ['Pedido', 'Arte', 'Produção', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'biscuit',          nome: 'Biscuit e Porcelana Fria', emoji: '🎨', descricao: 'Biscuit, porcelana fria, topos de bolo e lembrancinhas',      setores: ['Modelagem', 'Estrutura Interna', 'Secagem', 'Lixamento', 'Pintura', 'Verniz', 'Embalagem', 'Expedição'] },
  { id: 'sublimacao',       nome: 'Sublimação',                emoji: '🖨️', descricao: 'Camisetas, canecas, almofadas e personalizados',             setores: ['Arte', 'Impressão', 'Prensa', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'croche_trico',     nome: 'Crochê, Tricô e Amigurumi', emoji: '🧶', descricao: 'Crochê, tricô, amigurumi e tapetes artesanais',             setores: ['Design', 'Produção', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'costura',          nome: 'Costura e Moda',            emoji: '🧵', descricao: 'Roupas, uniformes, bolsas e moda autoral',                   setores: ['Modelagem', 'Corte', 'Costura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'bijuteria',        nome: 'Bijuteria e Joias',         emoji: '💍', descricao: 'Bijuterias, joias artesanais e acessórios',                   setores: ['Design', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'festas',           nome: 'Festas e Lembrancinhas',    emoji: '🎉', descricao: 'Lembrancinhas, topos de bolo, decoração de festas e eventos', setores: ['Arte', 'Produção', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'resina',           nome: 'Resina Epóxi',              emoji: '💎', descricao: 'Chaveiros, joias, porta-copos e peças decorativas em resina', setores: ['Design', 'Moldagem', 'Cura', 'Desmoldagem', 'Lixamento', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'mdf_madeira',      nome: 'MDF e Madeira',             emoji: '🪵', descricao: 'Peças em MDF, madeira, placas decorativas e corte a laser',  setores: ['Design', 'Corte', 'Lixamento', 'Pintura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'sublimacao_dtf',   nome: 'DTF e Transfer',            emoji: '🖌️', descricao: 'Impressão DTF, transfer, patch e personalização em tecidos', setores: ['Arte', 'Impressão DTF', 'Aplicação', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'velas_cosmeticos', nome: 'Velas e Cosméticos',        emoji: '🕯️', descricao: 'Velas artesanais, sabonetes, difusores e cosméticos naturais', setores: ['Formulação', 'Produção', 'Resfriamento', 'Rotulagem', 'Embalagem', 'Expedição'] },
  { id: 'papelaria',        nome: 'Papelaria Criativa',        emoji: '📒', descricao: 'Convites, cartões, adesivos, scrapbook e papelaria personalizada', setores: ['Arte', 'Impressão', 'Corte', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'feltro_eva',       nome: 'Feltro e EVA',              emoji: '🧸', descricao: 'Bonecos, lembrancinhas, enfeites de festa e decoração em feltro ou EVA', setores: ['Design', 'Corte', 'Montagem', 'Pintura e Detalhes', 'Embalagem', 'Expedição'] },
  { id: 'ceramica',         nome: 'Cerâmica e Barro',          emoji: '🏺', descricao: 'Cerâmica, argila, porcelana e escultura',                    setores: ['Modelagem', 'Secagem', 'Queima', 'Esmaltação', 'Queima Final', 'Embalagem', 'Expedição'] },
  { id: 'macrame',          nome: 'Macramê e Bordado',         emoji: '🪢', descricao: 'Macramê, bordado, ponto cruz e arte têxtil',                 setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'encadernacao',     nome: 'Encadernação Artesanal',    emoji: '📚', descricao: 'Cadernos, agendas, planners e álbuns costurados',            setores: ['Arte', 'Impressão', 'Corte e Dobra', 'Furação', 'Costura', 'Capa e Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'costura_criativa', nome: 'Bolsas e Acessórios',       emoji: '👜', descricao: 'Bolsas, carteiras, nécessaires e acessórios em tecido ou couro', setores: ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'saboaria',         nome: 'Saboaria Artesanal',        emoji: '🧴', descricao: 'Sabonetes artesanais, sais de banho e produtos naturais',    setores: ['Formulação', 'Produção', 'Cura', 'Corte', 'Rotulagem', 'Embalagem', 'Expedição'] },
  { id: 'pet',              nome: 'Artesanato Pet',            emoji: '🐾', descricao: 'Acessórios, camas, brinquedos e roupinhas para pets',        setores: ['Design', 'Corte', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'balao',            nome: 'Balão Personalizado',       emoji: '🎈', descricao: 'Balões personalizados, bubble, cromados e decoração',        setores: ['Design', 'Impressão', 'Corte', 'Montagem', 'Acabamento', 'Expedição'] },
  { id: 'impressao_3d',     nome: 'Impressão 3D',              emoji: '🧊', descricao: 'Miniaturas, topos, chaveiros e utilidades impressas em 3D (PLA, PETG, resina)', setores: ['Modelagem', 'Fatiamento', 'Impressão', 'Pós-processamento', 'Pintura e Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'personalizado',    nome: 'Personalizado',             emoji: '⚙️', descricao: 'Configuro meus próprios setores do zero',                    setores: [] },
]

/** Nome legível de um id — para telas de leitura (lista de leads, Master). */
export function nomeDoSegmento(id: string | null | undefined): string | null {
  if (!id) return null
  return SEGMENTOS.find(s => s.id === id)?.nome ?? id
}

export function ehSegmentoValido(id: unknown): boolean {
  return typeof id === 'string' && SEGMENTOS.some(s => s.id === id)
}
