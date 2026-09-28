// SOA Design — presets-aplique: listar e criar (descrição em lib/estudio/crud).
import { rotasColecao } from '@/lib/estudio/crud'

export const dynamic = 'force-dynamic'
const r = rotasColecao('presets-aplique')
export const GET = r.GET
export const POST = r.POST
