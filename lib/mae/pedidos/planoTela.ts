// Plano da tela de Pedidos (Lote 22, item 257): "só MAE" (pedidos avulsos: importar planilha / novo pedido) × SOA
// completo (pedidos do SOA). A conta "só MAE" já vem marcada no LOGIN (session.user.soMae) — a tela nunca depende de
// uma consulta para mostrar os botões dela (falha aberta). A consulta (/api/mae/pedidos/status) só pode PROMOVER para
// "mae" (contas avulsas antigas que não são standalone); nunca rebaixa a "só MAE" para "soa" (o servidor responde
// "soa" quando o banco falha). Conta SOA sem a marca: igual a antes (começa em "soa" e só muda se a consulta disser).
export type PlanoTela = 'soa' | 'mae'
export const planoDaTela = (soMaeSessao: boolean, planoDaConsulta: PlanoTela | null | undefined): PlanoTela =>
  soMaeSessao || planoDaConsulta === 'mae' ? 'mae' : 'soa'
