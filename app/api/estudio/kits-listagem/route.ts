// SOA Edition — kits-listagem: listar e criar (descrição em lib/estudio/crud).
import { rotasColecao } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasColecao('kits-listagem')
export const GET = r.GET
export const POST = r.POST
