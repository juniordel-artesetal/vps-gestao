// Cadência da régua de migração, relativa à dataInicio da campanha:
//   Semana 1 (D1–D7):  1 e-mail por dia
//   Semana 2 (D8–D14): dia sim, dia não (D8, D10, D12, D14)
//   Semanas 3–4 (D15–D28): 1x por semana (D15, D22)
//   Após D28: para a régua → 'expirada'
// D1 = o próprio dia da dataInicio.

export interface DecisaoCadencia { dia: number; enviar: boolean; expira: boolean }

const UM_DIA = 86400000
const soData = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / UM_DIA)

export function decidirCadencia(dataInicio: Date | string, hoje: Date | string): DecisaoCadencia {
  const ini = new Date(dataInicio)
  const h = new Date(hoje)
  const dia = soData(h) - soData(ini) + 1 // D1 = dataInicio
  if (dia < 1) return { dia, enviar: false, expira: false }
  if (dia <= 7) return { dia, enviar: true, expira: false }           // diário
  if (dia <= 14) return { dia, enviar: dia % 2 === 0, expira: false } // D8,10,12,14
  if (dia <= 28) return { dia, enviar: (dia - 15) % 7 === 0, expira: false } // D15, D22
  return { dia, enviar: false, expira: true }
}
