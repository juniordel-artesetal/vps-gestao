// SERVIÇO WHATSAPP do SOA (17/10/2026) — companheiro do SOA, roda num VPS (NÃO na Vercel): whatsapp-web.js + Chromium,
// número DEDICADO, sessão salva em disco (LocalAuth). O SOA chama POST /send (lib/whatsapp/index.ts → enviar()).
//
//   POST /send     { para: '5515999999999', mensagem }   header x-ws-secret   → 202 { ok, id, posicao }  (vai para a FILA)
//   GET  /send/:id                                       header x-ws-secret   → { status, erro? }
//   GET  /health                                                             → { conectado, ultimaConexao, fila }  (+ número com o segredo)
//   GET  /qr                                             header x-ws-secret   → página com o QR para escanear (1ª vez / sessão caiu)
//   Mensagem recebida "PARAR" → repassa para o SOA (SOA_ENTRADA_URL) e responde a confirmação.
//
// ANTI-BAN: 1 envio por vez, com espera ALEATÓRIA entre envios (ENVIO_MIN_S..ENVIO_MAX_S, padrão 5–15 s); número
// conferido no WhatsApp antes de enviar (getNumberId — também acerta o 9º dígito). WhatsApp NÃO-OFICIAL: risco de ban.
import express from 'express'
import qrcodeTerminal from 'qrcode-terminal'
import QRCode from 'qrcode'
import wweb from 'whatsapp-web.js'
import { timingSafeEqual } from 'node:crypto'

const { Client, LocalAuth } = wweb
const PORT = Number(process.env.PORT) || 3080
const SEGREDO = (process.env.WHATSAPP_SERVICE_SECRET || '').trim()
const ENTRADA = (process.env.SOA_ENTRADA_URL || '').trim()          // ex.: https://www.usesoa.com.br/api/whatsapp/entrada
const MIN_S = Number(process.env.ENVIO_MIN_S) || 5, MAX_S = Number(process.env.ENVIO_MAX_S) || 15
const FILA_MAX = Number(process.env.FILA_MAX) || 500
if (SEGREDO.length < 24) { console.error('WHATSAPP_SERVICE_SECRET ausente ou curto (mínimo 24 caracteres). Abortando.'); process.exit(1) }

const estado = { conectado: false, numero: null, ultimaConexao: null, qr: null, iniciando: true }
const fila = []                       // { id, para, mensagem }
const envios = new Map()              // id → { status: 'na-fila'|'enviando'|'enviado'|'erro', erro?, em }
const mascarar = t => String(t).replace(/^(\d{2})(\d{2})(\d)\d+(\d{4})$/, '$1 $2 $3****-$4')
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const dormir = ms => new Promise(r => setTimeout(r, ms))

// ── cliente WhatsApp ────────────────────────────────────────────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: process.env.SESSAO_DIR || './.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
})
client.on('qr', qr => {
  estado.qr = qr; estado.conectado = false
  console.log('[WA] escaneie o QR com o número DEDICADO (WhatsApp → Aparelhos conectados):')
  qrcodeTerminal.generate(qr, { small: true })
})
client.on('authenticated', () => console.log('[WA] autenticado'))
client.on('auth_failure', m => { console.error('[WA] falha de autenticação:', m); estado.conectado = false })
client.on('ready', () => {
  estado.conectado = true; estado.qr = null; estado.iniciando = false
  estado.numero = client.info?.wid?.user ?? null
  estado.ultimaConexao = new Date().toISOString()
  console.log(`[WA] conectado (${estado.numero ? mascarar(estado.numero) : '?'})`)
})
client.on('disconnected', async motivo => {
  console.error('[WA] desconectado:', motivo)
  estado.conectado = false
  await dormir(10_000)
  client.initialize().catch(e => console.error('[WA] reconectar:', e.message))
})
client.on('message', async msg => {
  try {
    if (msg.fromMe || msg.isGroupMsg || String(msg.from).endsWith('@g.us')) return
    const texto = String(msg.body || '').trim()
    if (!/^(parar|pare|sair|stop|cancelar|descadastrar|n[aã]o quero)[.!]*$/i.test(texto)) return
    if (!ENTRADA) return
    const de = String(msg.from).replace(/@.*$/, '')
    const r = await fetch(ENTRADA, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-ws-secret': SEGREDO },
      body: JSON.stringify({ de, texto }), signal: AbortSignal.timeout(10_000),
    })
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.resposta) await msg.reply(j.resposta)
    console.log(`[WA] opt-out ${mascarar(de)}: ${r.status}`)
  } catch (e) { console.error('[WA] mensagem recebida:', e.message) }
})

// ── fila (um por vez, espera aleatória) ─────────────────────────────────────────────────────────────────────────────
async function trabalhar() {
  for (;;) {
    const job = estado.conectado ? fila.shift() : null
    if (!job) { await dormir(1000); continue }
    const reg = envios.get(job.id); reg.status = 'enviando'
    try {
      const wid = await client.getNumberId(job.para)            // existe no WhatsApp? (e acerta o 9º dígito)
      if (!wid) { reg.status = 'erro'; reg.erro = 'numero_sem_whatsapp' }
      else { await client.sendMessage(wid._serialized, job.mensagem); reg.status = 'enviado' }
    } catch (e) { reg.status = 'erro'; reg.erro = String(e.message || e).slice(0, 200) }
    reg.em = new Date().toISOString()
    console.log(`[WA] ${reg.status} ${mascarar(job.para)}${reg.erro ? ' — ' + reg.erro : ''}`)
    // limpa o histórico antigo
    if (envios.size > 2000) for (const k of [...envios.keys()].slice(0, 500)) envios.delete(k)
    await dormir((MIN_S + Math.random() * (MAX_S - MIN_S)) * 1000)
  }
}

// ── HTTP ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json({ limit: '32kb' }))
const autorizado = req => {
  const s = Buffer.from(String(req.get('x-ws-secret') || '')), k = Buffer.from(SEGREDO)
  return s.length === k.length && timingSafeEqual(s, k)
}
const exigir = (req, res, next) => (autorizado(req) ? next() : res.status(401).json({ ok: false, erro: 'nao_autorizado' }))

app.get('/health', (req, res) => {
  const base = { conectado: estado.conectado, ultimaConexao: estado.ultimaConexao, fila: fila.length, aguardandoQr: !!estado.qr }
  res.json(autorizado(req) ? { ...base, numero: estado.numero } : base)
})
app.get('/qr', exigir, async (_req, res) => {
  if (estado.conectado) return res.type('html').send('<p>Já conectado.</p>')
  if (!estado.qr) return res.type('html').send('<p>Aguardando o QR… recarregue em alguns segundos.</p>')
  const img = await QRCode.toDataURL(estado.qr, { margin: 2, width: 320 })
  res.type('html').send(`<meta http-equiv="refresh" content="20"><p>WhatsApp → Aparelhos conectados → Conectar aparelho:</p><img src="${img}" alt="QR">`)
})
app.post('/send', exigir, (req, res) => {
  const para = String(req.body?.para || '').replace(/\D/g, '')
  const mensagem = String(req.body?.mensagem || '').trim()
  if (!/^55\d{10,11}$/.test(para)) return res.status(400).json({ ok: false, erro: 'telefone_invalido' })
  if (!mensagem || mensagem.length > 2000) return res.status(400).json({ ok: false, erro: 'mensagem_invalida' })
  if (!estado.conectado) return res.status(503).json({ ok: false, erro: 'desconectado' })
  if (fila.length >= FILA_MAX) return res.status(429).json({ ok: false, erro: 'fila_cheia' })
  const id = gid()
  envios.set(id, { status: 'na-fila' })
  fila.push({ id, para, mensagem })
  res.status(202).json({ ok: true, id, posicao: fila.length })
})
app.get('/send/:id', exigir, (req, res) => {
  const r = envios.get(req.params.id)
  return r ? res.json(r) : res.status(404).json({ erro: 'nao_encontrado' })
})

app.listen(PORT, () => console.log(`[WA] serviço na porta ${PORT}`))
client.initialize().catch(e => { console.error('[WA] não iniciou:', e.message); estado.iniciando = false })
trabalhar()
