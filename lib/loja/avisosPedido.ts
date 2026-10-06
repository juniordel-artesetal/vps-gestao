// Avisos de NOVO PEDIDO DA LOJA para a artesã (chamado Y20A — Gabriela/MIMOPAPEIR).
// Evento único "entrou pedido na loja" → 3 avisos: e-mail (por pedido), destaque da Sofia e pop-up de parabéns.
// Fonte única dos 2 agregados = pedidos da loja criados depois de "vistoEm" (tabela LojaAvisoPedido, 1 linha por
// workspace). Abrir Pedidos da Loja marca como vistos. Tudo FAIL-OPEN: nenhum aviso derruba o pedido nem a tela.
// A tabela é criada por migração (scripts/), nunca em runtime — se faltar, os avisos só ficam desligados.
import { prisma } from '@/lib/prisma'

export interface ConfigAvisos { emailAtivo: boolean; sofiaAtivo: boolean; popupAtivo: boolean }
export interface EstadoAvisos { novos: number; mostrarPopup: boolean; config: ConfigAvisos }

const PADRAO: ConfigAvisos = { emailAtivo: true, sofiaAtivo: true, popupAtivo: true }
// Sem registro ainda (nunca abriu a lista desde que o recurso entrou): só conta os pedidos dos últimos 3 dias.
const JANELA_INICIAL = '3 days'

export async function lerConfig(workspaceId: string): Promise<ConfigAvisos> {
  try {
    const [c] = await prisma.$queryRaw`
      SELECT "emailAtivo", "sofiaAtivo", "popupAtivo" FROM "LojaAvisoPedido" WHERE "workspaceId" = ${workspaceId} LIMIT 1
    ` as ConfigAvisos[]
    return c ? { emailAtivo: c.emailAtivo !== false, sofiaAtivo: c.sofiaAtivo !== false, popupAtivo: c.popupAtivo !== false } : PADRAO
  } catch { return PADRAO }
}

export async function estadoAvisos(workspaceId: string): Promise<EstadoAvisos> {
  try {
    const [r] = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(o."id")::int AS novos,
        MAX(o."createdAt") AS ultimo,
        MAX(a."popupVistoEm") AS "popupVistoEm",
        COALESCE(BOOL_AND(a."emailAtivo"), true) AS "emailAtivo",
        COALESCE(BOOL_AND(a."sofiaAtivo"), true) AS "sofiaAtivo",
        COALESCE(BOOL_AND(a."popupAtivo"), true) AS "popupAtivo"
      FROM (SELECT $1::text AS ws) x
      LEFT JOIN "LojaAvisoPedido" a ON a."workspaceId" = x.ws
      LEFT JOIN "Order" o ON o."workspaceId" = x.ws AND o."canal" = 'Loja' AND o."status" <> 'CANCELADO'
        AND o."createdAt" > COALESCE(a."vistoEm", NOW() - INTERVAL '${JANELA_INICIAL}')
    `, workspaceId) as { novos: number; ultimo: Date | null; popupVistoEm: Date | null; emailAtivo: boolean; sofiaAtivo: boolean; popupAtivo: boolean }[]
    const novos = Number(r?.novos) || 0
    const config = { emailAtivo: r?.emailAtivo !== false, sofiaAtivo: r?.sofiaAtivo !== false, popupAtivo: r?.popupAtivo !== false }
    // Pop-up: 1x por LOTE — só reaparece se chegou pedido depois do último pop-up fechado.
    const mostrarPopup = config.popupAtivo && novos > 0 && !!r?.ultimo
      && (!r.popupVistoEm || new Date(r.ultimo).getTime() > new Date(r.popupVistoEm).getTime())
    return { novos, mostrarPopup, config }
  } catch (e) {
    console.error('[LOJA-AVISOS] estado:', (e as Error)?.message)
    return { novos: 0, mostrarPopup: false, config: PADRAO }
  }
}

async function upsert(workspaceId: string, campo: 'vistoEm' | 'popupVistoEm') {
  // campo vem de lista fechada (nunca do usuário) — seguro interpolar o identificador.
  await prisma.$executeRawUnsafe(`
    INSERT INTO "LojaAvisoPedido" ("workspaceId", "${campo}", "updatedAt") VALUES ($1, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET "${campo}" = NOW(), "updatedAt" = NOW()
  `, workspaceId)
}

// Abriu Pedidos da Loja (ou clicou "Ver pedidos"): zera Sofia + pop-up.
export async function marcarVistos(workspaceId: string) {
  try { await upsert(workspaceId, 'vistoEm'); await upsert(workspaceId, 'popupVistoEm') } catch (e) { console.error('[LOJA-AVISOS] visto:', (e as Error)?.message) }
}

// Fechou o pop-up sem abrir a lista: o pop-up não volta para este lote; a Sofia segue lembrando.
export async function marcarPopupVisto(workspaceId: string) {
  try { await upsert(workspaceId, 'popupVistoEm') } catch (e) { console.error('[LOJA-AVISOS] popup:', (e as Error)?.message) }
}

export async function salvarConfig(workspaceId: string, c: ConfigAvisos) {
  await prisma.$executeRaw`
    INSERT INTO "LojaAvisoPedido" ("workspaceId", "emailAtivo", "sofiaAtivo", "popupAtivo", "updatedAt")
    VALUES (${workspaceId}, ${c.emailAtivo}, ${c.sofiaAtivo}, ${c.popupAtivo}, NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET "emailAtivo" = ${c.emailAtivo}, "sofiaAtivo" = ${c.sofiaAtivo}, "popupAtivo" = ${c.popupAtivo}, "updatedAt" = NOW()
  `
}

// ── E-mail por pedido ────────────────────────────────────────────────────────
export interface PedidoParaEmail {
  workspaceId: string
  numero: string
  cliente: string
  contato: string | null
  itens: { nome: string; quantidade: number; valorUnitario: number }[]
  frete: number
  total: number
  entrega: boolean
  pagamento: string
}

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const brl = (v: number) => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',')
const LINK = 'https://www.usesoa.com.br/minha-loja/pedidos'

export function htmlEmailNovoPedido(p: PedidoParaEmail, nomeLoja: string): string {
  const linhas = p.itens.map(i => `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f1f1">${esc(i.nome)}${i.quantidade > 1 ? ` <span style="color:#6b7280">(${i.quantidade}x)</span>` : ''}</td>
<td style="padding:6px 0;border-bottom:1px solid #f1f1f1;text-align:right;white-space:nowrap">${i.valorUnitario > 0 ? brl(i.valorUnitario * i.quantidade) : ''}</td></tr>`).join('')
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;max-width:560px">
<p style="font-size:18px;font-weight:bold;margin:0 0 4px">🎉 Novo pedido na sua loja!</p>
<p style="margin:0 0 16px;color:#6b7280">${esc(nomeLoja)} · pedido <b>#${esc(p.numero)}</b></p>
<p style="margin:0"><b>Cliente:</b> ${esc(p.cliente)}${p.contato ? ` · 📱 ${esc(p.contato)}` : ''}</p>
<p style="margin:0"><b>${p.entrega ? 'Entrega' : 'Retirada'}</b>${p.frete > 0 ? ` · frete ${brl(p.frete)}` : ''}</p>
<p style="margin:0 0 12px"><b>Pagamento:</b> ${esc(p.pagamento)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">${linhas}
<tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${brl(p.total)}</td></tr></table>
<p style="margin:16px 0 4px">O pedido já está na sua <b>Produção</b>. Lá em <b>Pedidos da Loja</b> você <b>aprova</b> (o valor entra no seu caixa) ou recusa.</p>
<p><a href="${LINK}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">Ver pedidos da loja</a></p>
<p style="font-size:12px;color:#9ca3af">Não quer mais receber este aviso? Desligue em Minha Loja → Pedidos da Loja → Avisos.</p>
<p>— Equipe SOA · usesoa.com.br</p></div>`
}

// Envia o aviso para as administradoras do ateliê. Fail-open: só registra o erro.
export async function enviarEmailNovoPedido(p: PedidoParaEmail): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key) return
    const cfg = await lerConfig(p.workspaceId)
    if (!cfg.emailAtivo) return
    const dest = await prisma.$queryRaw`
      SELECT DISTINCT lower(u."email") AS email FROM "User" u
      WHERE u."workspaceId" = ${p.workspaceId} AND u."role" = 'ADMIN' AND u."ativo" = true AND u."email" IS NOT NULL
    ` as { email: string }[]
    const [ws] = await prisma.$queryRaw`SELECT "nome", "emailContato" FROM "Workspace" WHERE "id" = ${p.workspaceId} LIMIT 1` as { nome: string; emailContato: string | null }[]
    const para = dest.map(d => d.email).filter(Boolean)
    if (!para.length && ws?.emailContato) para.push(ws.emailContato)
    if (!para.length) return
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SOA <suporte@vps-gestao.com.br>', to: para,
        subject: `🎉 Novo pedido na sua loja — #${p.numero} · ${brl(p.total)}`,
        html: htmlEmailNovoPedido(p, ws?.nome || 'Sua loja'),
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) console.error('[LOJA-AVISOS] e-mail HTTP', r.status, (await r.text()).slice(0, 160))
  } catch (e) { console.error('[LOJA-AVISOS] e-mail:', (e as Error)?.message) }
}
