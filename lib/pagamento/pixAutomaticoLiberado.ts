// PIX AUTOMÁTICO DE VERDADE (autorização no app do banco) — 17/10/2026: o Asaas liberou no PAINEL, mas a API
// (/pix/automatic/authorizations) ainda responde 403 na nossa chave. Sem a API não há o QR de autorização que o banco
// pede, e o "link Pix recorrente" é só um Pix por mês. Enquanto isso (decisão do Júnior: "vamos no mensal por
// enquanto"): o SOA esconde a opção "Pix Automático" (fica o "Pix, mês a mês"), o convite D-1 não sai, e o MAE oferece
// "Pix mensal" com o texto honesto. Quando o Asaas liberar a API: virar para true (e ligar a autorização com QR).
// Puro e sem dependências (lido também nas telas).
export const PIX_AUTOMATICO_LIBERADO = false
