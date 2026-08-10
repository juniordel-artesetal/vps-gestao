// Tipos compartilhados da camada de logística (sem runtime — evita ciclos de import).

export type FonteEnvio = 'transportadora' | 'marketplace'

// Endereço mínimo p/ cotação/etiqueta
export interface EnderecoLog {
  cep: string
  nome?: string | null
  documento?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
}

// Pacote a cotar: dimensões em cm, peso em kg, valor segurado em R$
export interface Pacote {
  peso: number
  altura?: number
  largura?: number
  comprimento?: number
  valorSegurado?: number
  quantidade?: number
}

export interface CotacaoOpcao {
  provedor: string          // melhorenvio | shopee | ...
  servicoId: string         // id do serviço no provedor
  transportadora: string    // Correios, Jadlog...
  servico: string           // PAC, SEDEX, .Package...
  preco: number
  prazoDias: number | null
  erro?: string | null      // serviço indisponível para a rota
}

export interface ResultadoEtiqueta {
  ok: boolean
  provedorEnvioId?: string | null
  etiquetaUrl?: string | null
  rastreio?: string | null
  status?: string
  erro?: string | null
  pendente?: boolean        // ex.: marketplace aguardando integração
}

export interface ResultadoImpressao {
  ok: boolean
  url?: string | null       // PDF/URL da etiqueta
  erro?: string | null
  pendente?: boolean
}

export interface ResultadoRastreio {
  ok: boolean
  rastreio?: string | null
  status?: string | null
  eventos?: any[]
  erro?: string | null
  pendente?: boolean
}

// Config de logística do workspace (nunca inclui tokens em claro fora do servidor)
export interface LogisticaConfigPublica {
  provedor: string
  conectado: boolean
  remetenteNome: string | null
  remetenteDoc: string | null
  cepOrigem: string | null
  logradouroOrigem: string | null
  numeroOrigem: string | null
  bairroOrigem: string | null
  cidadeOrigem: string | null
  ufOrigem: string | null
  tokenExpiraEm: string | null
}
