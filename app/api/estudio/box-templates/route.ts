// SOA Design — box-templates: listar e criar (descrição em lib/estudio/crud).
import { rotasColecao } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasColecao('box-templates')
export const GET = r.GET
export const POST = r.POST
