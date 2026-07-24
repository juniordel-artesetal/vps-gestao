// PROVA — notificação Telegram de nova candidata (determinística: stub de fetch).
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//     --env-file=.env --env-file=.env.local scripts/provar-telegram-parceira.mjs
import { prisma } from '../lib/prisma.ts'
import { notificarNovaParceiraTelegram } from '../lib/parceiras/notificacoes.ts'

const marca = Date.now().toString(36)
let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }

const realFetch = global.fetch
let capt = []
let modo = 'ok'
global.fetch = async (u, o) => {
  if (String(u).includes('api.telegram.org')) {
    if (modo === 'throw') throw new Error('rede caiu')
    capt.push(JSON.parse(o.body))
    return modo === 'erro' ? { ok: false, status: 500, text: async () => 'x' } : { ok: true, status: 200, json: async () => ({}), text: async () => '{}' }
  }
  return realFetch(u, o)
}

const ids = []
async function seed(comSenhaCodigo) {
  const id = `tg_${marca}_${comSenhaCodigo ? 'c' : 'i'}`; ids.push(id)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Parceiro" ("id","tipo","nome","email","whatsapp","instagram","status","ativo",${comSenhaCodigo ? '"senhaCripto","cupom","linkSlug",' : ''}"comissaoPercMensal","comissaoPercAnual","comissaoRecorrente","createdAt")
     VALUES ($1,'influencer','Maria <Teste>',$2,'(11) 98888-7777','maria.atelie','pendente',false,${comSenhaCodigo ? `'x','MARIA${marca.toUpperCase()}','MARIA${marca.toUpperCase()}',` : ''}30,40,true,NOW())`,
    id, `tg.${marca}.${comSenhaCodigo ? 'c' : 'i'}@teste-soa.local`)
  return id
}

async function main() {
  console.log('\n=== PROVA — Telegram nova candidata ===\n')
  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO'); process.exit(1) }
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) { console.error('❌ faltam TELEGRAM_* no env'); process.exit(1) }

  try {
    // [1] Incompleta → mensagem "aguardando"
    const id1 = await seed(false)
    capt = []; modo = 'ok'
    await notificarNovaParceiraTelegram(id1)
    checar('enviou 1 mensagem ao Telegram', capt.length === 1)
    const m = capt[0]
    checar('vai pro chat certo + parse HTML', m?.chat_id === process.env.TELEGRAM_CHAT_ID && m?.parse_mode === 'HTML')
    checar('título + nome + @instagram + whatsapp + email + link', /🤝 <b>Nova candidata a parceira na fila!/.test(m.text) && /@maria\.atelie/.test(m.text) && /\(11\) 98888-7777/.test(m.text) && new RegExp(`tg\\.${marca}\\.i@teste-soa\\.local`).test(m.text) && /usesoa\.com\.br\/master\/parceiros/.test(m.text))
    checar('completude: aguardando senha+código', /⏳ aguardando ela completar senha\+código/.test(m.text))
    checar('nome com HTML escapado (Maria &lt;Teste&gt;)', /Maria &lt;Teste&gt;/.test(m.text))

    // [2] Completa → "pronta para aprovar"
    const id2 = await seed(true)
    capt = []; modo = 'ok'
    await notificarNovaParceiraTelegram(id2)
    checar('completa → ✅ pronta para aprovar', /✅ pronta para aprovar/.test(capt[0]?.text || ''))

    // [3] Falha do Telegram NÃO derruba (não lança)
    modo = 'throw'
    let lancou = false
    try { await notificarNovaParceiraTelegram(id1) } catch { lancou = true }
    checar('falha de rede do Telegram não lança (best-effort)', !lancou)
    modo = 'erro'
    try { await notificarNovaParceiraTelegram(id1) } catch { lancou = true }
    checar('resposta !ok do Telegram não lança', !lancou)

  } finally {
    for (const id of ids) await prisma.$executeRawUnsafe(`DELETE FROM "Parceiro" WHERE "id"=$1`, id).catch(() => {})
    global.fetch = realFetch
    console.log('\n🧹 limpo')
  }
  console.log(`\n${falhas === 0 ? '✅ TELEGRAM PASSOU' : `❌ ${falhas} falha(s)`}\n`)
  process.exit(falhas === 0 ? 0 : 1)
}
main().catch(e => { console.error('❌', e.message, e.stack); process.exit(1) })
