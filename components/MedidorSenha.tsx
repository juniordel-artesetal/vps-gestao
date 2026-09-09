'use client'
// Medidor de força de senha — feedback visual da política única (lib/senhaPolicy).
// Mostra a barra de força e a lista de exigências ainda não atendidas, ao vivo.
// Reutilizado no registro, na troca e na redefinição de senha.
import { validarForcaSenha, type ForcaSenha } from '@/lib/senhaPolicy'

const CORES: Record<ForcaSenha, string> = {
  fraca: 'bg-red-400',
  media: 'bg-yellow-400',
  forte: 'bg-green-500',
}
const NIVEL: Record<ForcaSenha, number> = { fraca: 1, media: 2, forte: 3 }
const ROTULO: Record<ForcaSenha, string> = { fraca: 'Fraca', media: 'Boa', forte: 'Forte' }

export default function MedidorSenha({ senha }: { senha: string }) {
  if (!senha) return null
  const { ok, erros, forca } = validarForcaSenha(senha)
  const nivel = NIVEL[forca]

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3].map(n => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full transition-colors ${n <= nivel ? CORES[forca] : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      {ok ? (
        <p className="text-xs text-green-600 dark:text-green-400">✓ Senha {ROTULO[forca].toLowerCase()} — pode continuar</p>
      ) : (
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          {erros.map((e, i) => (
            <li key={i}>• {e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
