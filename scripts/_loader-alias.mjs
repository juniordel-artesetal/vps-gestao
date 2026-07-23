// Loader de resolução para rodar código de lib/ direto no Node.
//
// Existe porque os scripts de prova precisam exercitar AS FUNÇÕES REAIS da lib
// (garantirCliente, criarCobranca…), não uma réplica delas — uma réplica provaria
// apenas que a réplica funciona. Duas coisas o Node não resolve sozinho:
//   1. o alias "@/..." do tsconfig  → raiz do repo
//   2. imports sem extensão ("./client") → .ts / .tsx / /index.ts
//
// Uso: node --experimental-strip-types --import ./scripts/_loader-alias.mjs script.mjs
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { resolve as resolvePath, dirname } from 'node:path'

const RAIZ = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const EXTENSOES = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx', '/index.js']

function primeiroExistente(base) {
  for (const ext of EXTENSOES) {
    const alvo = base + ext
    if (existsSync(alvo)) return alvo
  }
  return null
}

registerHooks({
  resolve(especificador, contexto, proximo) {
    // "@/lib/prisma" → <raiz>/lib/prisma.ts
    if (especificador.startsWith('@/')) {
      const achado = primeiroExistente(resolvePath(RAIZ, especificador.slice(2)))
      if (achado) return proximo(pathToFileURL(achado).href, contexto)
    }

    // "./client" → <mesma pasta>/client.ts
    if (especificador.startsWith('.') && contexto.parentURL) {
      const base = resolvePath(dirname(fileURLToPath(contexto.parentURL)), especificador)
      const achado = primeiroExistente(base)
      if (achado) return proximo(pathToFileURL(achado).href, contexto)
    }

    return proximo(especificador, contexto)
  },
})
