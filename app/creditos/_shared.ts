// Helpers/tipos compartilhados das telas de Créditos (arquivo não-rota).
import { Camera, FileText, Sparkles } from 'lucide-react'

export interface SaldoTipo {
  tipo: string
  saldo: number
  cotaGratisMes: number
  cotaUsadaMes: number
  cotaGratisRestante: number
  mesReferencia: string | null
}

export interface Mov {
  id: string
  tipo: string
  delta: number
  motivo: string
  referencia: string | null
  saldoResultante: number | null
  createdAt: string
}

// Rótulos amigáveis por tipo de crédito (parametrizável conforme novas features entram)
export const TIPO_INFO: Record<string, { label: string; icon: any; cor: string }> = {
  foto: { label: 'Fotos que vendem', icon: Camera, cor: '#8b5cf6' },
  nf:   { label: 'Notas fiscais',    icon: FileText, cor: '#0ea5e9' },
}
export function infoTipo(tipo: string) {
  return TIPO_INFO[tipo] || { label: tipo, icon: Sparkles, cor: '#f97316' }
}

export const MOTIVO_LABEL: Record<string, string> = {
  compra: '🛒 Compra de pacote',
  consumo: '📉 Uso',
  estorno: '↩️ Estorno',
  ajuste_master: '⭐ Crédito VPS',
}

export function fmtDataHora(d: string | null | undefined) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 'YYYY-MM' do mês corrente (mesma convenção do lib/creditos no servidor)
export function mesAtualISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Consumo do mês corrente por tipo = franquia grátis usada + o que saiu do saldo pago.
export function consumoDoMes(tipo: string, saldos: SaldoTipo[], historico: Mov[]): number {
  const s = saldos.find(x => x.tipo === tipo)
  const gratisUsada = s ? s.cotaUsadaMes : 0
  const mes = mesAtualISO()
  const pago = historico
    .filter(m => m.tipo === tipo && m.motivo === 'consumo' && m.delta < 0 && (m.createdAt || '').slice(0, 7) === mes)
    .reduce((acc, m) => acc + Math.abs(m.delta), 0)
  return gratisUsada + pago
}
