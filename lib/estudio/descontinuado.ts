// SOA DESIGN DESCONTINUADO (17/10/2026, decisão do Júnior): "o SOA Design não existe mais, vamos comercializar
// somente o MAE". Antes ele só saía de cena com a venda do MAE aberta (MAE_VENDA_ATIVO); agora sai de vez — menu, hub,
// telas (desviadas para o MAE) e as COMPRAS no servidor (assinatura do módulo, pacotes de imagens, Artes prontas).
// Quem assinava virou cortesia do MAE (lançamento de 16/10). O webhook continua tratando eventos antigos.
// Puro e sem dependências (é lido também pelo middleware).
export const SOA_DESIGN_DESCONTINUADO = true
export const MSG_SOA_DESIGN_DESCONTINUADO = 'O SOA Design foi descontinuado — as artes agora são feitas no Método Mãe.'
