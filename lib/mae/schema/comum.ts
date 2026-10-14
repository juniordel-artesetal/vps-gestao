// mae-schema — tipos comuns do módulo MAE (docs/mae-spec.md → "Modelo de dados").
// REGRA DE PACOTE: este diretório não importa React, Next nem nada do navegador — é compartilhado
// entre o editor (cliente) e a API (servidor).
import { z } from 'zod'

/** Versão do formato dos documentos (base e tema). Mudou o formato → sobe aqui e migra. */
export const SCHEMA_VERSION = 1

/** Medida em MILÍMETROS (tudo no modelo de dados é mm). */
export const Mm = z.number()
/** Medida em mm que não pode ser negativa (larguras, alturas, sobras). */
export const MmPositivo = z.number().nonnegative()

export const Id = z.string().min(1).max(120)

/**
 * Lote 16 (itens 203/204): NOME = rótulo de tela (camada, parte, peça, grupo, folha, prancheta, tema, base). Um nome
 * comprido (o nome do arquivo inteiro, ~95 letras) era RECUSADO pelo schema — e como o Salvar local, o rascunho e o
 * servidor validam com este mesmo schema, NADA salvava ("Sem conexão" e a janela de salvar em ciclo). Agora o nome
 * é CORTADO no limite: o salvar local, o servidor e o rascunho gravam a saída do parse, já cortada.
 */
const cortar = (max: number) => (s: string) => (s.length > max ? s.slice(0, max).trimEnd() : s)
export const Nome = (max: number) => z.string().transform(cortar(max))
export const NomeObrigatorio = (max: number) => z.string().min(1).transform(cortar(max))

/**
 * Caminho RELATIVO dentro da pasta Biblioteca MAE, sempre com "/" (ex.: "Papéis/stitch/praia.png").
 * Recusa caminho absoluto, ".." e "." — a receita nunca aponta para fora da Biblioteca.
 */
export const CaminhoRelativo = z.string().min(1).max(500).refine(
  p => !/^([a-zA-Z]:|[\\/])/.test(p) && !p.includes('\\') && p.split('/').every(s => s !== '' && s !== '.' && s !== '..'),
  { message: 'Caminho deve ser relativo à Biblioteca MAE, com "/" e sem ".."' },
)

/**
 * Hash SHA-256 do arquivo (hex). Os exemplos da spec vêm abreviados ("9f2c…"), por isso a Sprint 1
 * aceita qualquer texto curto; a Sprint 3 (importação) passa a exigir os 64 caracteres hex.
 */
export const Sha256 = z.string().min(4).max(64)

/** Referência a um arquivo da Biblioteca: caminho relativo + hash (para achar se for movido). */
export const RefArquivo = z.object({ path: CaminhoRelativo, sha256: Sha256 })

export type RefArquivo = z.infer<typeof RefArquivo>
