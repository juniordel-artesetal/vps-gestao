// SOA Design — kit-instancias: abrir, atualizar e excluir um item.
import { rotasItem } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasItem('kit-instancias')
export const GET = r.GET
export const PUT = r.PUT
export const DELETE = r.DELETE
