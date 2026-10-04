// mae-schema — DOCUMENTO DE TRABALHO do editor na Sprint 1: uma base ainda só com pranchetas.
// É um subconjunto válido de DocBase (sem moldes/partes), então nada se perde quando a base crescer.
import { z } from 'zod'
import { SCHEMA_VERSION } from './comum'
import { DocBase } from './base'
import { medidasFolha, type Folha, type Orientacao } from './prancheta'

export const DocTrabalho = DocBase
export type DocTrabalho = z.infer<typeof DocTrabalho>

const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`

/** Documento novo com UMA prancheta vazia (A4 retrato por padrão). */
export function novoDocumento(folha: Folha = 'A4', orientacao: Orientacao = 'retrato', nome = 'Nova base'): DocTrabalho {
  return {
    schemaVersion: SCHEMA_VERSION, type: 'base', id: gid('base'), version: 1, name: nome, units: 'mm',
    smartArt: { overflowMm: 10 },
    artboards: [{ id: gid('ab'), ...medidasFolha(folha, orientacao) }],
    molds: [], parts: [], textSlots: [],
  }
}
