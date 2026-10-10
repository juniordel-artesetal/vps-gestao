// Lote 6 (item 90): CATÁLOGO INICIAL DE MEDIDAS PRONTAS (Anexo do Lote 6) — peças planas definidas por medida
// (etiquetas, tags, rótulos). Medidas em mm (largura × altura; círculo = diâmetro). ⚠️ A Naty valida a lista antes de
// publicar: as medidas variam entre fontes e marcas; `conferida` = confirmada por ela. Cada medida é editável na base.

export type FormaMedida = 'retangulo' | 'arredondado' | 'circulo'
export interface MedidaPronta {
  id: string; categoria: string; nome: string; forma: FormaMedida
  larguraMm: number; alturaMm: number; raioMm?: number
  /** Furo da fita (tag): centro em fração da peça e diâmetro em mm. */
  furo?: { x: number; y: number; diametroMm: number }
  conferida?: boolean
}

const R = (id: string, categoria: string, nome: string, wCm: number, hCm: number, extra: Partial<MedidaPronta> = {}): MedidaPronta =>
  ({ id, categoria, nome, forma: 'retangulo', larguraMm: Math.round(wCm * 100) / 10, alturaMm: Math.round(hCm * 100) / 10, ...extra })
const C = (id: string, categoria: string, nome: string, dCm: number, extra: Partial<MedidaPronta> = {}): MedidaPronta =>
  ({ id, categoria, nome, forma: 'circulo', larguraMm: Math.round(dCm * 100) / 10, alturaMm: Math.round(dCm * 100) / 10, ...extra })

export const CATALOGO_MEDIDAS: MedidaPronta[] = [
  R('esc-livros', 'Etiqueta escolar', 'Livros', 9, 5, { forma: 'arredondado', raioMm: 3 }),
  R('esc-caderno', 'Etiqueta escolar', 'Caderno', 7, 3, { forma: 'arredondado', raioMm: 2.5 }),
  R('esc-lapis', 'Etiqueta escolar', 'Lápis', 5, 2.6, { forma: 'arredondado', raioMm: 2 }),
  C('tag-cofrinho', 'Tag', 'Tag redonda (cofrinho)', 4, { furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } }),
  R('tag-agradecimento', 'Tag', 'Tag de agradecimento', 4.5, 3.5),
  R('tubete-8', 'Tubete', '8 cm', 3, 5),
  R('tubete-13m', 'Tubete', '13 cm médio', 4, 6),
  R('tubete-13g', 'Tubete', '13 cm grande', 5, 8),
  R('acrilica-quadrada', 'Caixinha acrílica', 'Quadrada', 3.5, 3.5),
  R('acrilica-tampa', 'Caixinha acrílica', 'Tampa', 5, 5),
  R('acrilica-lateral', 'Caixinha acrílica', 'Lateral', 5, 4),
  R('acrilica-sextavada', 'Caixinha acrílica', 'Sextavada', 6, 3),
  R('sacolinha', 'Sacolinha', 'Sacolinha / kraft', 9, 9),
  R('pringles-corpo', 'Mini Pringles', 'Corpo', 22, 7.8, { conferida: true }),
  R('pringles-frente', 'Mini Pringles', 'Frente', 10, 8),
  C('pringles-tampa', 'Mini Pringles', 'Tampa', 7, { conferida: true }),
  R('nutella-corpo', 'Nutella', 'Corpo', 20, 3.5, { conferida: true }),
  C('nutella-tampa', 'Nutella', 'Tampa', 5.7, { conferida: true }),
  R('toddynho-frente', 'Toddynho', 'Frente', 6.3, 8.3),
  R('toddynho-volta', 'Toddynho', 'Volta toda', 21.9, 8.3),
  R('agua-corpo', 'Água mineral', 'Corpo (500 ml)', 20, 3.5),
  C('agua-tampa', 'Água mineral', 'Tampa', 2.8),
  R('choc-bis', 'Chocolates', 'Bis', 6.5, 5.5),
  R('choc-bis-duplo', 'Chocolates', 'Bis duplo', 10, 5.5),
  R('choc-batom', 'Chocolates', 'Batom', 6.5, 6.5),
  R('choc-pastilha', 'Chocolates', 'Pastilha Garoto', 7.5, 6),
  R('choc-mentos', 'Chocolates', 'Mini Mentos', 4.5, 6.5),
  R('choc-tictac', 'Chocolates', 'Tic Tac', 3, 8.5),
  C('pirulito-rotulo', 'Pirulito', 'Rótulo', 5),
  R('pirulito-capa', 'Pirulito', 'Capa', 8, 16),
  R('brigadeiro-frente', 'Copinho de brigadeiro', 'Frente', 3, 3),
  C('brigadeiro-tampa', 'Copinho de brigadeiro', 'Tampa', 2.5),
  R('marmita-250', 'Marmitinha', '250 g', 12, 9),
  R('marmita-500', 'Marmitinha', '500 g', 16, 12),
  C('marmita-redonda', 'Marmitinha', 'Redonda', 11),
  C('mint-tampa', 'Lata Mint to Be', 'Tampa', 5),
  R('pacoquinha', 'Paçoquinha', 'Rótulo', 9.5, 4.7),
  R('trakinas', 'Mini Trakinas', 'Rótulo', 9, 9),
  C('topper-docinho', 'Toppers', 'Docinho', 5),
  C('topper-colher', 'Toppers', 'Colherzinha', 3.5),
  C('avulso-redondo', 'Avulsos', 'Redondo (livre, Ø 2,5 a 20 cm)', 5),
  R('avulso-retangulo', 'Avulsos', 'Quadrado/retângulo (livre, 2 a 20 cm)', 5, 5),
]

export const CATEGORIAS_MEDIDAS = [...new Set(CATALOGO_MEDIDAS.map(m => m.categoria))]
