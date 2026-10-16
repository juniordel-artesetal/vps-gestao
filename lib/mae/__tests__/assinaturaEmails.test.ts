// E-mails da assinatura do Método Mãe: textos (datas, valor/parcelas, links) e escape do nome.
import { describe, it, expect } from 'vitest'
import { montarEmailMae as montar0 } from '@/lib/mae/assinatura/emails'

// o real formatado usa espaço não separável (R$ 39,90)
const montarEmailMae = (...a: Parameters<typeof montar0>) => { const e = montar0(...a); return { ...e, html: e.html.replace(/ /g, ' ') } }

describe('e-mails do Método Mãe', () => {
  it('início do teste: data da 1ª cobrança, parcelas do anual e link do editor', () => {
    const e = montarEmailMae('inicioTeste', { nome: 'Naty Costa', valor: 458.52, parcelas: 12, ciclo: 'anual', data: '2026-10-19' })
    expect(e.assunto).toMatch(/teste/i)
    expect(e.html).toContain('Oi, Naty!'); expect(e.html).toContain('19/10/2026'); expect(e.html).toContain('12× de R$')
    expect(e.html).toContain('/estudio/mae')
  })
  it('fim do teste, atraso (acesso até) e cancelada; mensal mostra /mês', () => {
    expect(montarEmailMae('fimTeste', { valor: 39.9, ciclo: 'mensal', data: '2026-10-19' }).html).toContain('R$ 39,90/mês')
    const a = montarEmailMae('atraso', { data: '2026-11-19', acessoAte: '2026-11-24' })
    expect(a.html).toContain('19/11/2026'); expect(a.html).toContain('24/11/2026'); expect(a.html).toContain('/mae/assinatura')
    expect(montarEmailMae('cancelada', { acessoAte: '2026-11-24' }).html).toContain('até <b>24/11/2026</b>')
    expect(montarEmailMae('boasVindas', { nome: 'Ana' }).html).toContain('Assinar o Método Mãe')   // sem teste grátis (15/10)
  })
  it('nome com HTML é escapado', () => {
    expect(montarEmailMae('boasVindas', { nome: '<b>x</b>' }).html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
