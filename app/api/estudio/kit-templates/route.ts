// SOA Design — kit-templates: listar (com filtro por coluna) e criar (descrição em lib/estudio/crud).
import { rotasColecao } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasColecao('kit-templates')
export const GET = r.GET
export const POST = r.POST
