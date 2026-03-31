// ══════════════════════════════════════════════════════════════
// Destino: lib/serialize.ts
// Função : Serializa recursivamente BigInt, Decimal e Date
//          retornados pelo PostgreSQL/Prisma antes de enviar
//          como JSON nas respostas das APIs
// ══════════════════════════════════════════════════════════════

export function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber() // Prisma Decimal
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serialize(v)])
    )
  }
  return obj
}
