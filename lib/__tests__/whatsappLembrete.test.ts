// WhatsApp (17/10/2026): telefone, texto, enviar() fail-open e a régua do LEMBRETE DE COBRANÇA (degraus, idempotência,
// opt-out, piloto, confirmação no Asaas, modo seco).
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const optout = new Set<string>()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(async (q: TemplateStringsArray, ...v: unknown[]) => (q.join('?').includes('WhatsappOptOut') && optout.has(String(v[0])) ? [{ ok: 1 }] : [])),
    $executeRaw: vi.fn(async () => 1),
  },
}))
vi.mock('@/lib/pagamento/asaas/client', () => ({ chamarAsaas: vi.fn(async () => ({ ok: false })) }))

import { normalizarTelefone, chaveTelefone, ehPedidoDeSaida, textoLembreteCobranca, montarMensagem } from '@/lib/whatsapp/mensagens'
import { enviar, mascarar } from '@/lib/whatsapp'
import { degrauDoDia, rodarLembreteCobranca, type Candidata, type Deps } from '@/lib/whatsapp/lembreteCobranca'
import type { ResultadoEnvio } from '@/lib/whatsapp'

beforeEach(() => optout.clear())

describe('telefone', () => {
  it('normaliza o do perfil para 55 + DDD + número', () => {
    expect(normalizarTelefone('(15) 99644-2242')).toBe('5515996442242')
    expect(normalizarTelefone('+55 15 99644 2242')).toBe('5515996442242')
    expect(normalizarTelefone('015996442242')).toBe('5515996442242')
    expect(normalizarTelefone('1533224455')).toBe('551533224455')          // 10 dígitos (fixo / celular antigo)
    expect(normalizarTelefone('55 99999-1234')).toBe('5555999991234')        // DDD 55 sem o código do país
  })
  it('recusa o que não dá para usar', () => {
    for (const v of [null, '', '12345', '(15) 89644-2242', '00 99644-2242', 'abc']) expect(normalizarTelefone(v)).toBeNull()
  })
  it('a chave do opt-out casa o número com e sem o 9 da frente', () => {
    expect(chaveTelefone('5515996442242')).toBe(chaveTelefone('551596442242'))
    expect(chaveTelefone('5515996442242@c.us')).toBe('1596442242')
  })
  it('PARAR e parecidos são pedido de saída; frase comum não é', () => {
    for (const t of ['PARAR', 'parar', ' Sair ', 'stop!', 'não quero']) expect(ehPedidoDeSaida(t)).toBe(true)
    for (const t of ['vou parar de usar?', 'oi', '']) expect(ehPedidoDeSaida(t)).toBe(false)
  })
  it('telefone no log sai mascarado', () => expect(mascarar('5515996442242')).toBe('55 15 9****-2242'))
})

describe('texto do lembrete', () => {
  const t = textoLembreteCobranca({ nome: 'VIVIANE marcondes', link: 'https://www.usesoa.com.br/api/cobranca/fatura?p=pay_1&t=x', produto: 'Método Mãe', degrau: 3, chave: 'pay_1|3' })
  it('nome, produto, link e a saída — sem valor nem dado financeiro', () => {
    expect(t).toContain('Oi, Viviane!')
    expect(t).toContain('Método Mãe')
    expect(t).toContain('https://www.usesoa.com.br/api/cobranca/fatura?p=pay_1')
    expect(t).toContain('Responda PARAR')
    expect(t).not.toMatch(/R\$|\d+,\d{2}/)
  })
  it('D0 fala em "vence hoje"; cobranças diferentes variam o texto (anti-ban)', () => {
    expect(textoLembreteCobranca({ link: 'x', degrau: 0, chave: 'a' })).toMatch(/hoje/)
    const textos = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(k => textoLembreteCobranca({ nome: 'Ana', link: 'l', degrau: 1, chave: k })))
    expect(textos.size).toBeGreaterThan(1)
  })
  it('sem link não há lembrete', () => expect(montarMensagem('lembrete_cobranca', {})).toBeNull())
})

describe('enviar() — fail-open', () => {
  const ON = { WHATSAPP_ATIVO: 'on', WHATSAPP_SERVICE_URL: 'http://127.0.0.1:9', WHATSAPP_SERVICE_SECRET: 's'.repeat(32) }
  const dados = { nome: 'Ana', link: 'https://www.usesoa.com.br/x' }
  it('desligado (padrão): nem chama o serviço', async () => {
    const f = vi.fn()
    expect(await enviar('lembrete_cobranca', '15996442242', dados, {}, f as never)).toMatchObject({ ok: false, pendente: true })
    expect(f).not.toHaveBeenCalled()
  })
  it('sem URL/segredo: pendente', async () => {
    expect(await enviar('lembrete_cobranca', '15996442242', dados, { WHATSAPP_ATIVO: 'on' })).toMatchObject({ ok: false, pendente: true })
  })
  it('serviço fora do ar: NÃO lança, devolve pendente', async () => {
    const r = await enviar('lembrete_cobranca', '15996442242', dados, ON, (async () => { throw new Error('ECONNREFUSED') }) as never)
    expect(r).toMatchObject({ ok: false, pendente: true })
  })
  it('telefone inválido e opt-out: erro permanente, sem chamar o serviço', async () => {
    const f = vi.fn()
    expect(await enviar('lembrete_cobranca', '123', dados, ON, f as never)).toMatchObject({ ok: false, permanente: true })
    optout.add('1596442242')
    expect(await enviar('lembrete_cobranca', '(15) 99644-2242', dados, ON, f as never)).toMatchObject({ ok: false, permanente: true, erro: expect.stringMatching(/PARAR/) })
    expect(f).not.toHaveBeenCalled()
  })

  // de ponta a ponta contra um "serviço" local (confere header de segredo, corpo e a resposta da fila)
  let srv: http.Server
  const recebidos: { segredo: string | undefined; corpo: { para: string; mensagem: string } }[] = []
  afterAll(() => srv?.close())
  it('serviço no ar: POST /send com o segredo, número normalizado e o texto; devolve o id da fila', async () => {
    srv = http.createServer((req, res) => {
      let b = ''; req.on('data', c => (b += c)); req.on('end', () => {
        recebidos.push({ segredo: req.headers['x-ws-secret'] as string, corpo: JSON.parse(b) })
        res.writeHead(202, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, id: 'job1', posicao: 1 }))
      })
    })
    await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r()))
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
    const r = await enviar('lembrete_cobranca', '(15) 99644-2242', dados, { ...ON, WHATSAPP_SERVICE_URL: url })
    expect(r).toEqual({ ok: true, pendente: false, id: 'job1' })
    expect(recebidos[0].segredo).toBe(ON.WHATSAPP_SERVICE_SECRET)
    expect(recebidos[0].corpo.para).toBe('5515996442242')
    expect(recebidos[0].corpo.mensagem).toContain('https://www.usesoa.com.br/x')
  })
})

describe('degraus', () => {
  it('D0, D+1, D+3, D+7 — sempre o maior já alcançado', () => {
    expect([-1, 0, 1, 2, 3, 6, 7, 30, 80].map(degrauDoDia)).toEqual([null, 0, 1, 1, 3, 3, 7, 7, 7])
  })
})

describe('régua do lembrete', () => {
  const AGORA = new Date('2026-10-17T15:00:00Z')        // hoje (SP) = 2026-10-17
  const cand = (id: string, venc: string, x: Partial<Candidata> = {}): Candidata => ({ paymentId: id, workspaceId: 'ws_' + id, subscriptionId: 'sub_' + id, referencia: null, vencimento: venc, valor: 39.9, billingType: 'PIX', whatsapp: '(15) 99644-2242', nomeProprietaria: 'Ana Souza', ...x })
  const ON = { WHATSAPP_ATIVO: 'on' }
  function fakes(cs: Candidata[], o: Partial<Deps> = {}) {
    const linhas = new Map<string, string>()                               // "pay|degrau" → status
    const enviados: { destino: string; dados: Record<string, unknown> }[] = []
    const confirmados: string[] = []
    const deps: Deps = {
      candidatas: async () => cs,
      jaEnviados: async () => new Set([...linhas.keys()]),
      saiu: async tel => tel.endsWith('0000'),
      confirmar: async id => { confirmados.push(id); return { aberta: !id.startsWith('pago'), cobranca: { id, status: 'OVERDUE', value: 39.9, dueDate: '2026-10-14', subscription: 'sub_' + id } } },
      dona: async c => (c.id.startsWith('cortesia') ? null : { produto: 'SOA', workspaceId: 'ws_' + c.id, userId: null, bloqueado: false, emDia: c.id.startsWith('emdia') }),
      nome: async () => 'Ana Souza',
      reservar: async (c, g) => { const k = `${c.paymentId}|${g}`; if (linhas.has(k)) return null; linhas.set(k, 'ENVIANDO'); return k },
      concluir: async (k, r: ResultadoEnvio) => { if (r.ok) linhas.set(k, 'ENFILEIRADO'); else if (r.permanente) linhas.set(k, 'ERRO'); else linhas.delete(k) },
      enviar: async (_t, destino, dados) => { enviados.push({ destino, dados }); return { ok: true, pendente: false, id: 'j' } },
      esperar: async () => {},
      ...o,
    }
    return { deps, linhas, enviados, confirmados }
  }

  it('desligado: não faz nada (nem lê as candidatas)', async () => {
    const f = fakes([cand('a', '2026-10-14')])
    const spy = vi.spyOn(f.deps, 'candidatas')
    const r = await rodarLembreteCobranca({ agora: AGORA, env: {}, deps: f.deps })
    expect(r.desligado).toBe(true); expect(spy).not.toHaveBeenCalled()
  })

  it('manda 1 por (cobrança, degrau), com o link certo — e a 2ª rodada não repete', async () => {
    const f = fakes([cand('a', '2026-10-14')])                     // D+3
    const r1 = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: f.deps })
    expect(r1.enviados).toBe(1)
    expect(f.enviados[0].destino).toBe('5515996442242')
    expect(f.enviados[0].dados).toMatchObject({ degrau: 3, produto: 'SOA', nome: 'Ana Souza' })
    expect(String(f.enviados[0].dados.link)).toMatch(/\/api\/cobranca\/fatura\?p=a&t=/)
    expect(f.linhas.get('a|3')).toBe('ENFILEIRADO')
    const r2 = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: f.deps })
    expect(r2.enviados).toBe(0); expect(r2.jaEnviados).toBe(1); expect(f.enviados).toHaveLength(1)
  })

  it('pula: antes do vencimento, sem telefone, PARAR, fora do piloto, já paga no Asaas, cortesia, antiga de quem está em dia', async () => {
    const cs = [
      cand('futura', '2026-10-20'), cand('semtel', '2026-10-14', { whatsapp: '123' }), cand('saiu', '2026-10-14', { whatsapp: '(15) 99999-0000' }),
      cand('pago1', '2026-10-14'), cand('cortesia1', '2026-10-14'), cand('emdia1', '2026-09-10'), cand('ok', '2026-10-17'),
    ]
    const f = fakes(cs)
    const r = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: f.deps })
    expect(r).toMatchObject({ candidatas: 7, semTelefone: 1, optOut: 1, pagasOuApagadas: 1, naoNossas: 1, emDia: 1, enviados: 1 })
    expect(f.enviados[0].dados).toMatchObject({ degrau: 0 })        // a que vence hoje
    const p = fakes([cand('x', '2026-10-14'), cand('y', '2026-10-14')])
    const rp = await rodarLembreteCobranca({ agora: AGORA, env: { ...ON, WHATSAPP_PILOTO: 'ws_y' }, deps: p.deps })
    expect(rp).toMatchObject({ foraDoPiloto: 1, enviados: 1 })
  })

  it('FAIL-OPEN: serviço fora → não quebra e libera o degrau para amanhã; erro permanente fica registrado', async () => {
    const f = fakes([cand('a', '2026-10-14')], { enviar: async () => ({ ok: false, pendente: true, erro: 'desconectado' }) })
    const r = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: f.deps })
    expect(r).toMatchObject({ enviados: 0, falhasTemporarias: 1 }); expect(f.linhas.size).toBe(0)
    const g = fakes([cand('b', '2026-10-14')], { enviar: async () => ({ ok: false, pendente: false, permanente: true, erro: 'numero_sem_whatsapp' }) })
    const rg = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: g.deps })
    expect(rg.falhasPermanentes).toBe(1); expect(g.linhas.get('b|3')).toBe('ERRO')
  })

  it('Asaas 403/429 → para a rodada (modo devagar); teto por rodada', async () => {
    const f = fakes([cand('a', '2026-10-14'), cand('b', '2026-10-14')], { confirmar: async () => ({ aberta: false, parar: true }) })
    const r = await rodarLembreteCobranca({ agora: AGORA, env: ON, deps: f.deps })
    expect(r.paradoNoAsaas).toBe(true); expect(f.enviados).toHaveLength(0)
    const g = fakes(['a', 'b', 'c'].map(i => cand(i, '2026-10-14')))
    const rg = await rodarLembreteCobranca({ agora: AGORA, env: { ...ON, WHATSAPP_LIMITE: '2' }, deps: g.deps })
    expect(rg).toMatchObject({ enviados: 2, limiteAtingido: true })
  })

  it('seco: prévia sem Asaas, sem reservar e sem enviar (mesmo desligado)', async () => {
    const f = fakes([cand('a', '2026-10-14')])
    const r = await rodarLembreteCobranca({ agora: AGORA, env: {}, seco: true, deps: f.deps })
    expect(r.previa).toEqual([{ ws: 'ws_a', degrau: 3, telefone: '55 15 9****-2242', venc: '2026-10-14' }])
    expect(f.confirmados).toHaveLength(0); expect(f.enviados).toHaveLength(0); expect(f.linhas.size).toBe(0)
  })
})
