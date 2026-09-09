// Política de senha — regra ÚNICA de força de senha do SOA (baseline de segurança).
//
// Aplica-se APENAS a senhas NOVAS (registro, troca e redefinição). Senhas já
// existentes continuam válidas: nada aqui roda no login de quem já tem conta.
//
// Exigências (item 4 do baseline):
//   • mínimo 8 caracteres
//   • pelo menos 3 das 4 classes: minúscula, maiúscula, número, símbolo
//   • bloquear senhas óbvias, sequenciais e repetidas
//
// Também gera a senha TEMPORÁRIA (boas-vindas Hotmart / reset): aleatória e forte,
// no lugar da antiga "prefixo@VPSano" (previsível). Quem recebe é forçado a trocar
// no 1º acesso (primeiroLogin=true), então ela só precisa aguentar o primeiro login.
//
// Módulo ISOMÓRFICO (sem import de 'crypto' do Node): a validação roda também no
// cliente (medidor de força), e a geração usa Web Crypto (getRandomValues), presente
// tanto no navegador quanto no Node 18+.

export type ForcaSenha = 'fraca' | 'media' | 'forte'

export interface ResultadoForca {
  ok: boolean
  erros: string[]
  forca: ForcaSenha
}

const MINUSCULA = /[a-z]/
const MAIUSCULA = /[A-Z]/
const NUMERO = /[0-9]/
const SIMBOLO = /[^A-Za-z0-9]/

// Senhas óbvias mais comuns (pt/en) + termos do próprio produto. Comparação
// case-insensitive; qualquer uma barra a senha independentemente do resto.
const OBVIAS = new Set([
  '12345678', '123456789', '1234567890', 'senha123', 'password', 'password1',
  'password123', 'qwerty', 'qwerty123', 'qwertyui', 'abc12345', 'admin123',
  'iloveyou', '11111111', '00000000', 'aaaaaaaa', 'letmein', 'welcome',
  'senha1234', 'mudar123', 'trocar123', 'vpsgestao', 'vps2026', 'soa2026',
])

// Sequências de teclado/alfabeto/números usadas para detectar trechos sequenciais.
const SEQUENCIAS = [
  'abcdefghijklmnopqrstuvwxyz',
  '01234567890',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
]

// True se a senha contém um trecho sequencial de `min` caracteres (crescente ou
// decrescente) — ex.: "abcd", "4321", "qwert".
function temSequencia(senhaLower: string, min = 4): boolean {
  for (const seq of SEQUENCIAS) {
    const rev = seq.split('').reverse().join('')
    for (const base of [seq, rev]) {
      for (let i = 0; i + min <= base.length; i++) {
        if (senhaLower.includes(base.slice(i, i + min))) return true
      }
    }
  }
  return false
}

// True se há o mesmo caractere repetido `min` vezes seguidas — ex.: "aaaa", "1111".
function temRepeticao(senha: string, min = 4): boolean {
  let run = 1
  for (let i = 1; i < senha.length; i++) {
    run = senha[i] === senha[i - 1] ? run + 1 : 1
    if (run >= min) return true
  }
  return false
}

function classes(senha: string): number {
  return [MINUSCULA, MAIUSCULA, NUMERO, SIMBOLO].filter(r => r.test(senha)).length
}

/** Valida a FORÇA de uma senha nova. Não lança — devolve os erros para a tela. */
export function validarForcaSenha(senha: string): ResultadoForca {
  const erros: string[] = []
  const s = String(senha ?? '')
  const lower = s.toLowerCase()

  if (s.length < 8) erros.push('Use pelo menos 8 caracteres.')

  const nClasses = classes(s)
  if (nClasses < 3) {
    erros.push('Combine pelo menos 3 tipos: letra minúscula, MAIÚSCULA, número e símbolo.')
  }

  if (OBVIAS.has(lower)) {
    erros.push('Essa senha é muito comum. Escolha algo mais difícil de adivinhar.')
  }
  if (s.length >= 4 && temSequencia(lower)) {
    erros.push('Evite sequências como "1234", "abcd" ou "qwerty".')
  }
  if (temRepeticao(s)) {
    erros.push('Evite repetir o mesmo caractere várias vezes (ex.: "aaaa").')
  }

  const ok = erros.length === 0
  // Força só para o feedback visual — não altera a aprovação (ok manda).
  let forca: ForcaSenha = 'fraca'
  if (ok) forca = s.length >= 12 && nClasses === 4 ? 'forte' : 'media'
  return { ok, erros, forca }
}

const POOL_MIN = 'abcdefghijkmnpqrstuvwxyz'    // sem l/o (confusão visual)
const POOL_MAI = 'ABCDEFGHJKLMNPQRSTUVWXYZ'    // sem I/O
const POOL_NUM = '23456789'                     // sem 0/1
const POOL_SIM = '!@#$%&*?-_'

// Inteiro aleatório em [0, n) por Web Crypto (isomórfico). Rejection sampling para
// não enviesar quando n não divide 2^32.
function randInt(n: number): number {
  const buf = new Uint32Array(1)
  const limite = Math.floor(0x100000000 / n) * n
  let x = 0
  do { globalThis.crypto.getRandomValues(buf); x = buf[0] } while (x >= limite)
  return x % n
}

function pick(pool: string): string {
  return pool[randInt(pool.length)]
}

/**
 * Gera uma senha TEMPORÁRIA forte e aleatória (garante as 4 classes) — substitui
 * a antiga senha previsível. Padrão de 14 caracteres; sempre passa em validarForcaSenha.
 */
export function gerarSenhaForte(tamanho = 14): string {
  const n = Math.max(10, tamanho)
  const todos = POOL_MIN + POOL_MAI + POOL_NUM + POOL_SIM
  const chars = [pick(POOL_MIN), pick(POOL_MAI), pick(POOL_NUM), pick(POOL_SIM)]
  while (chars.length < n) chars.push(pick(todos))
  // Embaralha (Fisher–Yates) para não fixar as classes nas 4 primeiras posições.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
