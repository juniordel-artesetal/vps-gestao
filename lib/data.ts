// ─────────────────────────────────────────────────────────────
// Datas SEM conversão de fuso horário.
//
// dataEntrada / dataEnvio / prazos representam um DIA de calendário, não um
// instante. As colunas Postgres são do tipo `date`; ao chegarem no JS viram
// meia-noite UTC (ex.: 2026-07-14T00:00:00.000Z). Formatar isso com
// `new Date(x).toLocaleDateString('pt-BR')` num navegador em UTC-3 volta um
// dia (14/07 vira 13/07). Estas funções extraem o dia de calendário direto —
// aceitam tanto "YYYY-MM-DD" (TO_CHAR) quanto ISO completo — sem passar pelo
// fuso local. Use SEMPRE isto para datas sem hora, nunca new Date(...).toLocale.
// ─────────────────────────────────────────────────────────────

export function formatarDataBR(valor: string | Date | null | undefined): string {
  if (!valor) return '—'

  let ano: number, mes: number, dia: number

  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '—'
    ano = valor.getUTCFullYear()
    mes = valor.getUTCMonth() + 1
    dia = valor.getUTCDate()
  } else {
    const s = String(valor).trim()
    if (!s) return '—'
    // "YYYY-MM-DD" (com ou sem "Thh:mm..." depois) → pega o dia direto, sem fuso
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      ano = Number(m[1]); mes = Number(m[2]); dia = Number(m[3])
    } else {
      const d = new Date(s)
      if (isNaN(d.getTime())) return '—'
      ano = d.getUTCFullYear(); mes = d.getUTCMonth() + 1; dia = d.getUTCDate()
    }
  }

  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(dia)}/${p2(mes)}/${ano}`
}

// Converte qualquer data para "YYYY-MM-DD" (dia de calendário, sem fuso).
// Útil para <input type="date"> e para gravação consistente.
export function toYMD(valor: string | Date | null | undefined): string {
  if (!valor) return ''
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return ''
    return `${valor.getUTCFullYear()}-${String(valor.getUTCMonth() + 1).padStart(2, '0')}-${String(valor.getUTCDate()).padStart(2, '0')}`
  }
  const s = String(valor).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
