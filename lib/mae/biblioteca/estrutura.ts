// Biblioteca MAE — estrutura de pastas criada automaticamente na primeira vez (docs/mae-spec.md → Arquitetura).

export const PASTAS_BIBLIOTECA = [
  'Bases', 'Temas', 'Papéis', 'Elementos', 'Apliques',
  'Identidade', 'Marcas de registro', 'Packs Naty', 'Exportações', 'Backups',
] as const

/** Cria as pastas que faltarem (idempotente: rodar de novo não duplica nem apaga nada). */
export async function criarEstrutura(raiz: FileSystemDirectoryHandle): Promise<string[]> {
  for (const nome of PASTAS_BIBLIOTECA) await raiz.getDirectoryHandle(nome, { create: true })
  return [...PASTAS_BIBLIOTECA]
}
