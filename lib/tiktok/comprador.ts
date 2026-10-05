// Comprador/endereço do pedido do TikTok (Order 202309) → campos do SOA. PURO (testável).
// No sandbox (e às vezes em produção) o nome vem vazio/mascarado: nunca deixa o pedido em branco.
type Distrito = { address_level_name?: string; address_level?: string; address_name?: string }
type Endereco = {
  name?: string; first_name?: string; last_name?: string; phone_number?: string
  full_address?: string; address_detail?: string; address_line1?: string; address_line2?: string
  address_line3?: string; address_line4?: string; postal_code?: string; district_info?: Distrito[]
}
export interface PedidoTTComprador { recipient_address?: Endereco; buyer_email?: string; user_id?: string }

export const ROTULO_COMPRADOR = 'Cliente TikTok'

const limpo = (s: unknown) => String(s ?? '').trim()

export function dadosComprador(o: PedidoTTComprador) {
  const ra = o?.recipient_address || {}
  const nomeApi = limpo(ra.name) || [limpo(ra.first_name), limpo(ra.last_name)].filter(Boolean).join(' ')
  const nome = nomeApi || ROTULO_COMPRADOR
  // Nível do distrito: L0 país, L1 estado, L2 cidade, L3 bairro (BR). Aceita o nome do nível também.
  const nivel = (re: RegExp, l: string) => (ra.district_info || []).find(d => re.test(limpo(d.address_level_name)) || limpo(d.address_level) === l)?.address_name
  const uf = limpo(nivel(/state|estado|province/i, 'L1')) || null
  const cidade = limpo(nivel(/city|cidade|munic/i, 'L2')) || null
  const bairro = limpo(nivel(/district|bairro|neighbo/i, 'L3')) || null
  const cep = limpo(ra.postal_code) || null
  const rua = [ra.address_line1, ra.address_line2, ra.address_line3, ra.address_line4, ra.address_detail].map(limpo).filter(Boolean)
  const ruaTxt = [...new Set(rua)].join(', ')
  const endereco = limpo(ra.full_address) || [ruaTxt, bairro, cidade && uf ? `${cidade}/${uf}` : (cidade || uf), cep ? `CEP ${cep}` : ''].filter(Boolean).join(' - ') || null
  return {
    nome, nomeReal: !!nomeApi,
    telefone: limpo(ra.phone_number) || null,
    email: limpo(o?.buyer_email).toLowerCase() || null,   // e-mail relay do TikTok: estável por comprador
    buyerId: limpo(o?.user_id) || null,
    endereco, rua: ruaTxt || null, bairro, cidade, uf, cep,
  }
}
