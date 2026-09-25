// SOA Edition — moldes-caixa: abrir, atualizar e excluir um item.
import { rotasItem } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasItem('moldes-caixa')
export const GET = r.GET
export const PUT = r.PUT
export const DELETE = r.DELETE
