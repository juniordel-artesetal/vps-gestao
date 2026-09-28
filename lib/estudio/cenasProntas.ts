// SOA Design — CENAS PRONTAS (acervo autoral, gerado por código): fundos lisos, degradês, estúdio, texturas, festa e
// cenários decorados por tema (fundo + enfeites). A artesã escolhe uma e aplica ao mockup em "Usar mockup".
// 🔒 IP: tudo desenhado por nós (FUNDOS_PRONTOS/PROPS de cenasAcervo) — nenhuma imagem de terceiros.
import type { ConfigCena, PropCena } from './mockupTipos'

export interface CenaPronta { id: string; nome: string; categoria: string; cena: ConfigCena }

const base = (fundo: ConfigCena['fundo'], extra: Partial<ConfigCena> = {}): ConfigCena => ({
  fundo, produto: { cx: 0.5, cy: 0.55, altura: 0.66 }, sombra: { contato: 55, projetada: 20, suavidade: 60 }, reflexo: 0, luz: { direcao: 60, intensidade: 18 }, props: [], ...extra,
})
let n = 0
const p = (elemento: string, x: number, y: number, escala: number, cor?: string, rot = 0): PropCena => ({ id: `p${++n}`, elemento, x, y, escala, rot, cor: cor ?? null })

export const CENAS_PRONTAS: CenaPronta[] = [
  // lisos
  { id: 'liso-branco', nome: 'Branco', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#ffffff' }) },
  { id: 'liso-offwhite', nome: 'Off-white', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#f7f4ef' }) },
  { id: 'liso-rosa', nome: 'Rosa bebê', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#fbe4ec' }) },
  { id: 'liso-azul', nome: 'Azul bebê', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#dfeefa' }) },
  { id: 'liso-lilas', nome: 'Lilás', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#ece3f7' }) },
  { id: 'liso-menta', nome: 'Menta', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#dcf3ea' }) },
  { id: 'liso-amarelo', nome: 'Amarelo claro', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#fdf4d6' }) },
  { id: 'liso-cinza', nome: 'Cinza claro', categoria: 'Lisos', cena: base({ tipo: 'cor', cor: '#eeeff1' }) },
  // degradês
  { id: 'deg-algodao', nome: 'Algodão-doce', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#fdf2f8', para: '#e0f2fe', angulo: 90 }) },
  { id: 'deg-por-do-sol', nome: 'Pôr do sol', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#ffe4d1', para: '#fbcfe8', angulo: 180 }) },
  { id: 'deg-ceu', nome: 'Céu', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#cfe8fb', para: '#ffffff', angulo: 180 }) },
  { id: 'deg-lavanda', nome: 'Lavanda', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#ede9fe', para: '#fce7f3', angulo: 135 }) },
  { id: 'deg-menta', nome: 'Menta e azul', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#d1fae5', para: '#dbeafe', angulo: 135 }) },
  { id: 'deg-dourado', nome: 'Champanhe', categoria: 'Degradês', cena: base({ tipo: 'gradiente', de: '#fdf6e3', para: '#f3e1c0', angulo: 180 }) },
  // estúdio (fundo infinito)
  { id: 'estudio-branco', nome: 'Estúdio branco', categoria: 'Estúdio', cena: base({ tipo: 'preset', id: 'estudio-branco' }) },
  { id: 'estudio-rosa', nome: 'Estúdio rosa', categoria: 'Estúdio', cena: base({ tipo: 'preset', id: 'estudio-rosa' }) },
  { id: 'estudio-azul', nome: 'Estúdio azul', categoria: 'Estúdio', cena: base({ tipo: 'preset', id: 'estudio-azul' }) },
  { id: 'estudio-bege', nome: 'Estúdio bege', categoria: 'Estúdio', cena: base({ tipo: 'preset', id: 'estudio-bege' }) },
  // superfícies / texturas
  { id: 'mesa-madeira', nome: 'Mesa de madeira', categoria: 'Superfícies', cena: base({ tipo: 'preset', id: 'mesa-madeira' }, { produto: { cx: 0.5, cy: 0.52, altura: 0.64 } }) },
  { id: 'mesa-marmore', nome: 'Mármore', categoria: 'Superfícies', cena: base({ tipo: 'preset', id: 'marmore' }, { reflexo: 18 }) },
  { id: 'tex-kraft', nome: 'Papel kraft', categoria: 'Superfícies', cena: base({ tipo: 'textura', textura: 'kraft', cor: '#d9b98c' }) },
  { id: 'tex-linho', nome: 'Linho', categoria: 'Superfícies', cena: base({ tipo: 'textura', textura: 'linho', cor: '#efe7da' }) },
  { id: 'tex-papel', nome: 'Papel texturizado', categoria: 'Superfícies', cena: base({ tipo: 'textura', textura: 'papel', cor: '#faf7f2' }) },
  // festa
  { id: 'festa-confete', nome: 'Confete', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'confete' }) },
  { id: 'festa-bolinhas', nome: 'Bolinhas', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'bolinhas' }) },
  { id: 'festa-baloes', nome: 'Balões', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'baloes' }) },
  { id: 'festa-bandeirinhas', nome: 'Bandeirinhas', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'bandeirinhas' }) },
  { id: 'festa-listras', nome: 'Listras', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'listras' }) },
  { id: 'festa-nuvens', nome: 'Céu com nuvens', categoria: 'Festa', cena: base({ tipo: 'preset', id: 'nuvens' }) },
  // decorados por tema (fundo + enfeites autorais)
  { id: 'tema-aniversario', nome: 'Aniversário', categoria: 'Temas', cena: base({ tipo: 'preset', id: 'confete' }, { produto: { cx: 0.5, cy: 0.56, altura: 0.6 }, props: [p('balao', 0.13, 0.24, 0.22, '#f472b6', -8), p('balao', 0.87, 0.2, 0.2, '#60a5fa', 10), p('presente', 0.84, 0.82, 0.16, '#a78bfa'), p('cupcake', 0.15, 0.83, 0.14, '#f9a8d4')] }) },
  { id: 'tema-cha-bebe-azul', nome: 'Chá de bebê (azul)', categoria: 'Temas', cena: base({ tipo: 'preset', id: 'nuvens' }, { produto: { cx: 0.5, cy: 0.56, altura: 0.6 }, props: [p('estrela', 0.14, 0.2, 0.12, '#93c5fd', -10), p('estrela', 0.86, 0.26, 0.09, '#bfdbfe', 12), p('coracao', 0.84, 0.8, 0.1, '#93c5fd'), p('laco', 0.16, 0.8, 0.14, '#60a5fa')] }) },
  { id: 'tema-cha-bebe-rosa', nome: 'Chá de bebê (rosa)', categoria: 'Temas', cena: base({ tipo: 'gradiente', de: '#fff1f5', para: '#fde2ea', angulo: 180 }, { produto: { cx: 0.5, cy: 0.56, altura: 0.6 }, props: [p('coracao', 0.14, 0.22, 0.11, '#f9a8d4', -12), p('estrela', 0.86, 0.22, 0.1, '#fbcfe8', 8), p('laco', 0.85, 0.8, 0.15, '#f472b6'), p('confete-punhado', 0.15, 0.84, 0.16)] }) },
  { id: 'tema-romantico', nome: 'Romântico', categoria: 'Temas', cena: base({ tipo: 'preset', id: 'estudio-rosa' }, { produto: { cx: 0.5, cy: 0.56, altura: 0.62 }, props: [p('coracao', 0.13, 0.26, 0.13, '#e11d48', -14), p('coracao', 0.86, 0.2, 0.1, '#fb7185', 10), p('coracao', 0.82, 0.82, 0.08, '#fda4af'), p('vela', 0.15, 0.8, 0.14, '#fecdd3')] }) },
  { id: 'tema-natal', nome: 'Natal', categoria: 'Temas', cena: base({ tipo: 'gradiente', de: '#fef2f2', para: '#ecfdf5', angulo: 180 }, { produto: { cx: 0.5, cy: 0.56, altura: 0.6 }, props: [p('estrela', 0.14, 0.2, 0.13, '#eab308', -6), p('presente', 0.15, 0.82, 0.16, '#dc2626'), p('presente', 0.85, 0.83, 0.13, '#16a34a'), p('laco', 0.86, 0.22, 0.13, '#dc2626')] }) },
  { id: 'tema-luxo', nome: 'Luxo (dourado)', categoria: 'Temas', cena: base({ tipo: 'gradiente', de: '#fdf6e3', para: '#e9d5a6', angulo: 160 }, { reflexo: 14, props: [p('pedra', 0.16, 0.8, 0.08, '#fde68a'), p('pedra', 0.84, 0.84, 0.06, '#fef3c7'), p('estrela', 0.85, 0.2, 0.08, '#d4a017')] }) },
  { id: 'tema-mesa-festa', nome: 'Mesa de festa', categoria: 'Temas', cena: base({ tipo: 'preset', id: 'mesa-madeira' }, { produto: { cx: 0.5, cy: 0.52, altura: 0.6 }, props: [p('balao', 0.14, 0.2, 0.2, '#fbbf24', -6), p('balao', 0.86, 0.18, 0.18, '#f472b6', 8), p('confete-punhado', 0.82, 0.86, 0.16)] }) },
]
export const CATEGORIAS_CENA = [...new Set(CENAS_PRONTAS.map(c => c.categoria))]
export const cenaPronta = (id: string) => CENAS_PRONTAS.find(c => c.id === id) || null
