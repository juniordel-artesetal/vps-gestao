// app/api/meta/conversion/route.ts
// Meta Conversion API — envio server-side de eventos
// Mais confiável que client-side (não bloqueado por ad blockers)
// Doc: https://developers.facebook.com/docs/marketing-api/conversions-api

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const PIXEL_ID     = process.env.META_PIXEL_ID || '836930858768662'
const ACCESS_TOKEN = process.env.META_PIXEL_ACCESS_TOKEN || ''

function sha256(s: string) {
  return crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex')
}

function normalizePhone(phone: string) {
  // Remove tudo exceto dígitos, garante DDI 55 para Brasil
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11 || digits.length === 10) return '55' + digits
  return digits
}

export async function POST(req: NextRequest) {
  if (!ACCESS_TOKEN) {
    console.warn('[Meta Conversion API] META_PIXEL_ACCESS_TOKEN não configurado')
    return NextResponse.json({ ok: false, motivo: 'access_token_missing' })
  }

  try {
    const body = await req.json()
    const {
      eventName,      // 'Lead' | 'CompleteRegistration' | 'Purchase' | 'InitiateCheckout'
      eventId,        // ID único para deduplicação com pixel client
      email,
      phone,
      firstName,
      lastName,
      value,
      currency = 'BRL',
      eventSourceUrl,
      testEventCode,  // opcional, para testar via Events Manager
    } = body

    if (!eventName) return NextResponse.json({ error: 'eventName obrigatório' }, { status: 400 })

    // Pegar IP e User Agent reais (necessários para o Meta fazer matching)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || ''
    const userAgent = req.headers.get('user-agent') || ''

    // Pixel cookies do Facebook (fbp, fbc) — ajudam no matching
    const cookieHeader = req.headers.get('cookie') || ''
    const fbp = cookieHeader.match(/_fbp=([^;]+)/)?.[1]
    const fbc = cookieHeader.match(/_fbc=([^;]+)/)?.[1]

    const userData: Record<string, string | string[]> = {
      client_ip_address: ip,
      client_user_agent: userAgent,
    }
    if (email)     userData.em = sha256(email)
    if (phone)     userData.ph = sha256(normalizePhone(phone))
    if (firstName) userData.fn = sha256(firstName)
    if (lastName)  userData.ln = sha256(lastName)
    if (fbp)       userData.fbp = fbp
    if (fbc)       userData.fbc = fbc

    const event: any = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: eventSourceUrl || req.headers.get('referer') || 'https://vps-gestao.com.br',
      user_data: userData,
    }
    if (eventId) event.event_id = eventId
    if (value !== undefined && value !== null) {
      event.custom_data = { currency, value: Number(value) }
    }

    const payload: any = { data: [event] }
    if (testEventCode) payload.test_event_code = testEventCode

    const r = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )

    const data = await r.json()
    if (!r.ok) {
      console.error('[Meta Conversion API] Falha:', data)
      return NextResponse.json({ ok: false, error: data }, { status: 500 })
    }

    console.log('[Meta Conversion API] OK:', eventName, data)
    return NextResponse.json({ ok: true, eventName, response: data })
  } catch (err: any) {
    console.error('[Meta Conversion API]', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
