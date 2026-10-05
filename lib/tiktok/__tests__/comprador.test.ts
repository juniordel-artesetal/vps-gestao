// Pedido TikTok → comprador/endereço do SOA, e campos extras visíveis (sem "[object Object]").
import { describe, it, expect } from 'vitest'
import { dadosComprador, ROTULO_COMPRADOR } from '@/lib/tiktok/comprador'
import { camposExtrasVisiveis } from '@/lib/camposExtrasVisiveis'

describe('comprador do pedido TikTok', () => {
  it('nome vazio do sandbox vira "Cliente TikTok" (nunca em branco)', () => {
    const c = dadosComprador({ recipient_address: { name: '' }, buyer_email: 'V4B@scs2.tiktok.com', user_id: '7494001234' })
    expect(c.nome).toBe(ROTULO_COMPRADOR); expect(c.nomeReal).toBe(false)
    expect(c.email).toBe('v4b@scs2.tiktok.com'); expect(c.buyerId).toBe('7494001234')
    expect(dadosComprador({}).nome).toBe(ROTULO_COMPRADOR)
  })
  it('nome real, endereço por district_info e CEP', () => {
    const c = dadosComprador({ recipient_address: {
      name: ' Maria Júlia ', phone_number: '(+55)11*****99', address_line1: 'Rua das Flores, 10', postal_code: '01001-000',
      district_info: [{ address_level_name: 'Country', address_name: 'Brasil' }, { address_level_name: 'State', address_name: 'SP' },
        { address_level_name: 'City', address_name: 'São Paulo' }, { address_level_name: 'District', address_name: 'Sé' }],
    } })
    expect(c.nome).toBe('Maria Júlia'); expect(c.nomeReal).toBe(true)
    expect([c.uf, c.cidade, c.bairro, c.cep]).toEqual(['SP', 'São Paulo', 'Sé', '01001-000'])
    expect(c.endereco).toBe('Rua das Flores, 10 - Sé - São Paulo/SP - CEP 01001-000')
    expect(dadosComprador({ recipient_address: { full_address: 'Av. X, 1' } }).endereco).toBe('Av. X, 1')
    expect(dadosComprador({ recipient_address: { first_name: 'Ana', last_name: 'Lima' } }).nome).toBe('Ana Lima')
  })
})

describe('campos extras visíveis', () => {
  it('esconde objetos, listas, produtos e chaves de controle', () => {
    expect(camposExtrasVisiveis({ tiktok: { orderId: '1' }, produtos: [{ nome: 'x' }], _freelancers: {}, Tema: 'Safari', Idade: 3, Brinde: true, lista: ['a'] }))
      .toEqual([['Tema', 'Safari'], ['Idade', '3'], ['Brinde', 'true']])
    expect(camposExtrasVisiveis(null)).toEqual([])
  })
})
