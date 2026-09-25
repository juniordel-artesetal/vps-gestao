// Master (área /master): token no header x-master-token OU cookie master_token — mesmo segredo do
// middleware (MASTER_SECRET_TOKEN). Nunca NextAuth aqui.
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function ehMaster(req: NextRequest): Promise<boolean> {
  const segredo = process.env.MASTER_SECRET_TOKEN
  if (!segredo) return false
  const h = req.headers.get('x-master-token')
  if (h) return h === segredo
  return (await cookies()).get('master_token')?.value === segredo
}
