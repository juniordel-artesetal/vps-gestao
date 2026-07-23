import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const BASE=(process.env.PREVIEW_URL||'').replace(/\/+$/,'')
const BYPASS=(process.env.VERCEL_BYPASS_SECRET||'').trim()
const MASTER=(process.env.MASTER_SECRET_TOKEN||'').trim()
const url=p=>`${BASE}${p}${BYPASS?(p.includes('?')?'&':'?')+'x-vercel-protection-bypass='+BYPASS:''}`
const marca=Date.now().toString(36)
let falhas=0; const checar=(n,ok,d='')=>{if(!ok)falhas++;console.log(`  ${ok?'✅':'❌'} ${n}${d?` — ${d}`:''}`)}

console.log('\n=== PROVA — segmento no cadastro → lista de leads ===\n')
const host=(()=>{try{return new URL(process.env.DATABASE_URL).host}catch{return''}})()
if(host.includes('ep-lively-firefly')){console.error('❌ PRODUÇÃO');process.exit(1)}

const ids=[]
try {
  // 1) segmento VÁLIDO grava
  const e1=`seg.${marca}@teste-soa.local`
  const r1=await fetch(url('/api/auth/register'),{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({nome:'Maria',email:e1,senha:'Teste@123456',nomeNegocio:`Ateliê Festas ${marca}`,segmento:'festas'})})
  const w1=(await r1.json()).workspaceId; ids.push(w1)
  const [a]=await prisma.$queryRawUnsafe(`SELECT "segmento","assinaturaStatus" FROM "Workspace" WHERE "id"=$1`,w1)
  checar('segmento gravado no cadastro', a?.segmento==='festas', a?.segmento)
  checar('conta nasce como lead', a?.assinaturaStatus==='AGUARDANDO_PAGAMENTO')

  // 2) segmento INVENTADO é recusado (vira null, não lixo no banco)
  const e2=`seginv.${marca}@teste-soa.local`
  const r2=await fetch(url('/api/auth/register'),{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({nome:'Ana',email:e2,senha:'Teste@123456',nomeNegocio:`Ateliê X ${marca}`,segmento:'inventado_xyz'})})
  const w2=(await r2.json()).workspaceId; ids.push(w2)
  const [b]=await prisma.$queryRawUnsafe(`SELECT "segmento" FROM "Workspace" WHERE "id"=$1`,w2)
  checar('id inventado NÃO entra no banco', b?.segmento===null, String(b?.segmento))

  // 3) aparece na lista de leads do Master
  const m=await (await fetch(url('/api/master/assinaturas'),{headers:{cookie:`master_token=${MASTER}`}})).json()
  const lead=(m.leads??[]).find(x=>x.workspaceId===w1)
  checar('lead na lista do Master', !!lead, lead?.workspace)
  checar('com o segmento', lead?.segmento==='festas', lead?.segmento)

  // 4) os ids do formulário existem de verdade
  const usados=await prisma.$queryRawUnsafe(
    `SELECT DISTINCT "segmento" FROM "Workspace" WHERE "segmento" IS NOT NULL`)
  const {SEGMENTOS}=await import('../lib/segmentos.ts')
  const validos=new Set(SEGMENTOS.map(s=>s.id))
  const orfaos=usados.map(u=>u.segmento).filter(s=>!validos.has(s))
  checar('nenhum segmento órfão no banco dev', orfaos.length===0, orfaos.join(',')||'nenhum')
} finally {
  for(const id of ids.filter(Boolean)){
    for(const t of ['WorkspaceTheme','User']) await prisma.$executeRawUnsafe(`DELETE FROM "${t}" WHERE "workspaceId"=$1`,id).catch(()=>{})
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id"=$1`,id)
  }
  console.log('\n  🧹 limpo')
}
console.log(`\n${falhas===0?'✅ SEGMENTO PASSOU':`❌ ${falhas} falha(s)`}\n`)
process.exitCode=falhas===0?0:1
await prisma.$disconnect()
