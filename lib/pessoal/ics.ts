// Geração de iCalendar (.ics) das Tarefas pessoais. Só título + prazo (all-day) — nada de conteúdo.
// Usado pelo download (.ics) e pelo feed webcal público-por-token.

export interface TarefaICS { id: string; titulo: string; prazo: string; concluida?: boolean }

// Escapa vírgula/;/barra/newline conforme RFC 5545.
function esc(s: string): string {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// 'YYYY-MM-DD' → 'YYYYMMDD' (VALUE=DATE, evento de dia inteiro).
function dataICS(prazo: string): string { return prazo.slice(0, 10).replace(/-/g, '') }

/** Quebra linhas longas em 75 octetos (folding) conforme RFC 5545. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = []
  let s = line
  out.push(s.slice(0, 75)); s = s.slice(75)
  while (s.length) { out.push(' ' + s.slice(0, 74)); s = s.slice(74) }
  return out.join('\r\n')
}

export function gerarICS(tarefas: TarefaICS[], nomeCalendario = 'Minhas Tarefas — SOA'): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SOA//Agenda Pessoal//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold('X-WR-CALNAME:' + esc(nomeCalendario)),
    'X-PUBLISHED-TTL:PT1H',
  ]
  for (const t of tarefas) {
    if (!t.prazo) continue
    const d = dataICS(t.prazo)
    linhas.push('BEGIN:VEVENT')
    linhas.push(`UID:${t.id}@usesoa.com.br`)
    linhas.push(`DTSTAMP:${stamp}`)
    linhas.push(`DTSTART;VALUE=DATE:${d}`)
    linhas.push(fold('SUMMARY:' + esc((t.concluida ? '✓ ' : '') + t.titulo)))
    linhas.push(`STATUS:${t.concluida ? 'COMPLETED' : 'CONFIRMED'}`)
    linhas.push('TRANSP:TRANSPARENT')
    linhas.push('END:VEVENT')
  }
  linhas.push('END:VCALENDAR')
  return linhas.join('\r\n') + '\r\n'
}

/** URL do Google Calendar já preenchida (título + data all-day). Client abre em nova aba. */
export function linkGoogleCalendar(titulo: string, prazo: string): string {
  const d = dataICS(prazo)
  const fim = dataICS(new Date(new Date(prazo.slice(0, 10) + 'T00:00:00Z').getTime() + 864e5).toISOString())
  const p = new URLSearchParams({ action: 'TEMPLATE', text: titulo, dates: `${d}/${fim}` })
  return 'https://calendar.google.com/calendar/render?' + p.toString()
}
