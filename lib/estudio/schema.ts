// SOA Edition — tabelas próprias (aditivas). Binário NUNCA vai para o Neon: arquivo fica no
// Vercel Blob (ou no Google Drive da própria artesã) e aqui só guardamos URL + metadados.
//
// Pré-check no catálogo antes de qualquer DDL: tabelas/colunas que já existem custam UMA
// leitura por cold-start (nada de CREATE/ALTER no caminho comum — regra anti-lock, ver lib/ddlGuard).
import { prisma } from '@/lib/prisma'

const TABELAS: Record<string, string[]> = {
  EstudioAsset: [`
    CREATE TABLE IF NOT EXISTS "EstudioAsset" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "tipo" text NOT NULL,                 -- molde | fonte | gerado | mockup | original
      "nome" text NOT NULL,
      "url" text NOT NULL,                  -- Vercel Blob (ou link do Drive da artesã, tipo 'original')
      "mime" text,
      "tamanhoBytes" bigint NOT NULL DEFAULT 0,
      "pasta" text NOT NULL DEFAULT '',
      "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "pedidoId" text,
      "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- largura/altura px, página em pt, família da fonte...
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioAsset_ws_tipo_idx" ON "EstudioAsset" ("workspaceId","tipo")`,
    `CREATE INDEX IF NOT EXISTS "EstudioAsset_ws_pedido_idx" ON "EstudioAsset" ("workspaceId","pedidoId")`],
  EstudioTemplate: [`
    CREATE TABLE IF NOT EXISTS "EstudioTemplate" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "moldeAssetId" text,
      "config" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { caixas: [...], fundo?, ... }
      "preview" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioTemplate_ws_idx" ON "EstudioTemplate" ("workspaceId")`],
  EstudioJob: [`
    CREATE TABLE IF NOT EXISTS "EstudioJob" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "templateId" text,
      "origem" text NOT NULL,               -- colar | xlsx | pedido | tema
      "totalItens" int NOT NULL DEFAULT 0,
      "formato" text NOT NULL,              -- png | jpg | pdf-individual | pdf-unico | zip
      "regraNome" text,
      "status" text NOT NULL DEFAULT 'pendente',   -- pendente | processando | concluido | erro
      "zipUrl" text,
      "pedidoId" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "concluidoEm" timestamptz
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioJob_ws_idx" ON "EstudioJob" ("workspaceId")`],
  // ── Cota diária por LOGIN (userId) — 1 linha por usuário por dia (fuso de SP).
  EstudioUsoDiario: [`
    CREATE TABLE IF NOT EXISTS "EstudioUsoDiario" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "data" date NOT NULL,
      "geradas" int NOT NULL DEFAULT 0,
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EstudioUsoDiario_user_data_uidx" ON "EstudioUsoDiario" ("userId","data")`],
  // ── Créditos comprados (pacotes de 50). Saldo por login.
  EstudioCredito: [`
    CREATE TABLE IF NOT EXISTS "EstudioCredito" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "saldo" int NOT NULL DEFAULT 0,
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EstudioCredito_user_uidx" ON "EstudioCredito" ("userId")`],
  // ── Extrato (auditoria) de todo movimento de crédito: compra, consumo, devolução, estorno.
  EstudioCreditoMov: [`
    CREATE TABLE IF NOT EXISTS "EstudioCreditoMov" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "delta" int NOT NULL,
      "motivo" text NOT NULL,               -- compra | consumo | devolucao | estorno | ajuste
      "ref" text,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioCreditoMov_user_idx" ON "EstudioCreditoMov" ("userId","createdAt")`],
  // ── Reserva de cota ANTES de gerar; devolve o que não foi gerado (cancelou/falhou).
  EstudioCotaReserva: [`
    CREATE TABLE IF NOT EXISTS "EstudioCotaReserva" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "data" date NOT NULL,
      "doDia" int NOT NULL DEFAULT 0,
      "doCredito" int NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'aberta',   -- aberta | fechada
      "gerados" int,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "fechadaEm" timestamptz
    )`],
  // ── Compra avulsa de pacotes (Asaas). externalReference "EST:<ws>:<user>:<compraId>".
  EstudioCompra: [`
    CREATE TABLE IF NOT EXISTS "EstudioCompra" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "pacotes" int NOT NULL,
      "imagens" int NOT NULL,
      "valor" numeric(12,2) NOT NULL,
      "status" text NOT NULL DEFAULT 'PENDENTE',  -- PENDENTE | PAGA | ESTORNADA | CANCELADA
      "asaasPaymentId" text,
      "invoiceUrl" text,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "pagaEm" timestamptz
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioCompra_user_idx" ON "EstudioCompra" ("userId","createdAt")`],
  // ── Google Drive DA PRÓPRIA ARTESÃ (por login). Tokens cifrados (AES-256-GCM, INTEGRACOES_TOKEN_KEY).
  EstudioDriveConta: [`
    CREATE TABLE IF NOT EXISTS "EstudioDriveConta" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text NOT NULL,
      "tokensCifrados" text NOT NULL,       -- JSON {refresh, access, expira} cifrado inteiro
      "email" text,
      "pastaId" text,
      "conectadoEm" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EstudioDriveConta_user_uidx" ON "EstudioDriveConta" ("userId")`],
  // ── Fase 2: editor de camadas. JSON do Fabric com REFERÊNCIAS de asset (nunca imagem embutida).
  EstudioDesign: [`
    CREATE TABLE IF NOT EXISTS "EstudioDesign" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "userId" text,
      "nome" text NOT NULL,
      "largura" int NOT NULL,
      "altura" int NOT NULL,
      "json" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "assetIds" jsonb NOT NULL DEFAULT '[]'::jsonb,   -- objetos inteligentes usados (para achar "onde é usado")
      "previewUrl" text,                             -- miniatura pequena (data URL JPEG)
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioDesign_ws_idx" ON "EstudioDesign" ("workspaceId","updatedAt")`],
  // ── Kit de marca do workspace (Canva Brand Kit): cores, fontes e logos aplicáveis com 1 clique.
  EstudioBrandKit: [`
    CREATE TABLE IF NOT EXISTS "EstudioBrandKit" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "cores" jsonb NOT NULL DEFAULT '[]'::jsonb,     -- ["#f97316", …]
      "fontes" jsonb NOT NULL DEFAULT '[]'::jsonb,    -- ids de fonte nativa ou "u:<assetId>"
      "logos" jsonb NOT NULL DEFAULT '[]'::jsonb,     -- assetIds (EstudioAsset)
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "EstudioBrandKit_ws_uidx" ON "EstudioBrandKit" ("workspaceId")`],
  // ── Leitura de texto (OCR assistente) por login/dia — limita o custo da visão.
  EstudioOcrUso: [`
    CREATE TABLE IF NOT EXISTS "EstudioOcrUso" (
      "userId" text NOT NULL,
      "data" date NOT NULL,
      "n" int NOT NULL DEFAULT 0,
      PRIMARY KEY ("userId","data")
    )`],
  // ── Ferramentas de IA de imagem (remover fundo, apagar, expandir, ampliar, fundo por tema) por login/dia.
  EstudioIaUso: [`
    CREATE TABLE IF NOT EXISTS "EstudioIaUso" (
      "userId" text NOT NULL,
      "data" date NOT NULL,
      "n" int NOT NULL DEFAULT 0,
      PRIMARY KEY ("userId","data")
    )`],
  // ── Fase 3: produto-mockup reutilizável (foto do produto + recorte + área + luz/sombra). tipo 'caixa' = caixa montada.
  EstudioMockup: [`
    CREATE TABLE IF NOT EXISTS "EstudioMockup" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "tipo" text NOT NULL DEFAULT 'proprio',      -- proprio | biblioteca | caixa
      "fotoAssetId" text,
      "produtoRecortadoAssetId" text,
      "fotoUrl" text,
      "recorteUrl" text,
      "moldeCaixaId" text,
      "areaAplicacao" jsonb,                        -- { tipo: perspectiva|malha, cols, rows, pontos[] } normalizado
      "sombra" jsonb,
      "luz" jsonb,
      "config" jsonb NOT NULL DEFAULT '{}'::jsonb,  -- cor do produto, opacidade, recorte, medidas, laço/pedra/fundo
      "previewUrl" text,
      "aprovadaGlobal" boolean NOT NULL DEFAULT false,   -- acervo curado pelo Master (autoral/licenciado)
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioMockup_ws_idx" ON "EstudioMockup" ("workspaceId","updatedAt")`],
  // ── Cenário reutilizável (fundo + sombra + reflexo + luz + props).
  EstudioCena: [`
    CREATE TABLE IF NOT EXISTS "EstudioCena" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "fundo" jsonb NOT NULL,
      "sombra" jsonb,
      "reflexo" int NOT NULL DEFAULT 0,
      "luz" jsonb,
      "props" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioCena_ws_idx" ON "EstudioCena" ("workspaceId")`],
  // ── Receita do conjunto de fotos do anúncio (tomadas × tamanhos por marketplace).
  EstudioKitListagem: [`
    CREATE TABLE IF NOT EXISTS "EstudioKitListagem" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "tomadas" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "tamanhos" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "config" jsonb NOT NULL DEFAULT '{}'::jsonb,   -- medidas, badge, cenaId
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioKitListagem_ws_idx" ON "EstudioKitListagem" ("workspaceId")`],
  // ── Método Mãe: molde de caixa (die-line) + mapa de faces (frente/laterais/trás/cima) + montagem 3D.
  EstudioMoldeCaixa: [`
    CREATE TABLE IF NOT EXISTS "EstudioMoldeCaixa" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "tipo" text NOT NULL DEFAULT 'proprio',      -- acervo | proprio
      "acervoId" text,
      "dieLineAssetId" text,
      "dieLineUrl" text,
      "largura" int NOT NULL DEFAULT 0,
      "altura" int NOT NULL DEFAULT 0,
      "faces" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "montagem" jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioMoldeCaixa_ws_idx" ON "EstudioMoldeCaixa" ("workspaceId")`],
  // ── Kit de caixas (N moldes trabalhados juntos num tema).
  EstudioKit: [`
    CREATE TABLE IF NOT EXISTS "EstudioKit" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "moldeIds" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioKit_ws_idx" ON "EstudioKit" ("workspaceId")`],
  // ── Templates Especiais (acervo da Naty no Drive da PLATAFORMA): conexão única, tokens cifrados.
  EstudioAcervoConfig: [`
    CREATE TABLE IF NOT EXISTS "EstudioAcervoConfig" (
      "id" text PRIMARY KEY,                        -- 'naty' (linha única)
      "tokensCifrados" text,                        -- JSON {r, a, x} cifrado (INTEGRACOES_TOKEN_KEY)
      "email" text,
      "pastaId" text,
      "atualizadoEm" timestamptz NOT NULL DEFAULT now()
    )`],
  // ── Auditoria de cada sincronização do acervo.
  EstudioAcervoSync: [`
    CREATE TABLE IF NOT EXISTS "EstudioAcervoSync" (
      "id" text PRIMARY KEY,
      "origem" text NOT NULL,                       -- cron | manual
      "executadoEm" timestamptz NOT NULL DEFAULT now(),
      "novos" int NOT NULL DEFAULT 0,
      "atualizados" int NOT NULL DEFAULT 0,
      "iguais" int NOT NULL DEFAULT 0,
      "erros" int NOT NULL DEFAULT 0,
      "detalhes" jsonb NOT NULL DEFAULT '[]'::jsonb
    )`],
  // ── Trilha da curadoria (quem aprovou/reprovou/despublicou, quando) — takedown rápido.
  EstudioAcervoAuditoria: [`
    CREATE TABLE IF NOT EXISTS "EstudioAcervoAuditoria" (
      "id" text PRIMARY KEY,
      "templateId" text NOT NULL,
      "acao" text NOT NULL,
      "por" text NOT NULL,
      "nota" text,
      "em" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioAcervoAuditoria_tpl_idx" ON "EstudioAcervoAuditoria" ("templateId","em")`],
  // ── Aceite do termo de responsabilidade dos Templates Especiais (por login e versão do texto).
  EstudioTermoAceite: [`
    CREATE TABLE IF NOT EXISTS "EstudioTermoAceite" (
      "userId" text NOT NULL,
      "versao" text NOT NULL,
      "workspaceId" text NOT NULL,
      "aceitoEm" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","versao")
    )`],
  EstudioPreset: [`
    CREATE TABLE IF NOT EXISTS "EstudioPreset" (
      "id" text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "nome" text NOT NULL,
      "tipo" text NOT NULL,                 -- acao-lote | tamanho
      "operacoes" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS "EstudioPreset_ws_idx" ON "EstudioPreset" ("workspaceId")`],
}

// Colunas adicionadas depois da criação da tabela (tabelas do módulo, nunca a Workspace).
const COLUNAS: [string, string, string][] = [
  ['EstudioTemplate', 'temaNome', 'text'],                                 // "tema pronto" (Astronauta…)
  ['EstudioAsset', 'userId', 'text'],                                      // quem subiu
  ['EstudioAsset', 'sugeridaGlobal', 'boolean NOT NULL DEFAULT false'],   // fonte sugerida ao acervo
  ['EstudioAsset', 'aprovadaGlobal', 'boolean NOT NULL DEFAULT false'],   // aprovada pelo Master (licença aberta)
  ['EstudioDesign', 'fonteAssetId', 'text'],
  ['EstudioDesign', 'ehModelo', 'boolean NOT NULL DEFAULT false'],             // "Meus templates"                                // design que É a fonte editável de um objeto inteligente
  ['EstudioCotaReserva', 'lote', 'text'],                                  // execução (lote) a que a autorização pertence
  ['EstudioCotaReserva', 'chave', 'text'],                                 // idempotência: reenvio não debita de novo
  // Templates Especiais (acervo da Naty): origem, curadoria e versão por arquivo do Drive
  ['EstudioTemplate', 'origem', "text NOT NULL DEFAULT 'workspace'"],      // workspace | naty
  ['EstudioTemplate', 'status', 'text'],                                   // pendente_curadoria | publicado | reprovado | substituido | despublicado
  ['EstudioTemplate', 'driveFileId', 'text'],
  ['EstudioTemplate', 'driveVersao', 'text'],                              // md5/modifiedTime do Drive (dedup)
  ['EstudioTemplate', 'versao', 'int NOT NULL DEFAULT 1'],
  ['EstudioTemplate', 'semanaNovo', 'text'],                               // semana (AAAA-Www) em que foi publicado
  ['EstudioTemplate', 'publicadoEm', 'timestamptz'],
  ['EstudioTemplate', 'categoria', 'text'],
  ['EstudioTemplate', 'arquivoUrl', 'text'],                               // cópia de trabalho do original no Blob
  ['EstudioTemplate', 'arquivoNome', 'text'],
  ['EstudioTemplate', 'moldeUrl', 'text'],                                 // molde processado (acervo não usa EstudioAsset)
  ['EstudioTemplate', 'processado', 'boolean NOT NULL DEFAULT false'],
  // Caixa 3D: modelo GLB opcional (malhas nomeadas pelo papel da face) + UV por face
  ['EstudioMoldeCaixa', 'model3dUrl', 'text'],
  ['EstudioMoldeCaixa', 'faceUV', 'jsonb'],
]

const INDICES: [string, string][] = [
  ['EstudioCotaReserva_user_chave_uidx', `CREATE UNIQUE INDEX IF NOT EXISTS "EstudioCotaReserva_user_chave_uidx" ON "EstudioCotaReserva" ("userId","chave")`],
  ['EstudioTemplate_origem_status_idx', `CREATE INDEX IF NOT EXISTS "EstudioTemplate_origem_status_idx" ON "EstudioTemplate" ("origem","status")`],
  ['EstudioTemplate_drive_idx', `CREATE INDEX IF NOT EXISTS "EstudioTemplate_drive_idx" ON "EstudioTemplate" ("driveFileId")`],
  ['EstudioCotaReserva_user_lote_idx', `CREATE INDEX IF NOT EXISTS "EstudioCotaReserva_user_lote_idx" ON "EstudioCotaReserva" ("userId","lote")`],
]

let schemaOk = false
export async function ensureEstudioSchema(): Promise<void> {
  if (schemaOk) return
  const nomes = Object.keys(TABELAS)
  const existentes = new Set((await prisma.$queryRawUnsafe<{ t: string }[]>(
    `SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1::text[])`, nomes)).map(r => r.t))
  for (const nome of nomes) {
    if (existentes.has(nome)) continue
    for (const ddl of TABELAS[nome]) await prisma.$executeRawUnsafe(ddl)
  }
  const cols = new Set((await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT table_name || '.' || column_name AS k FROM information_schema.columns
     WHERE table_schema='public' AND table_name = ANY($1::text[])`, [...new Set(COLUNAS.map(c => c[0]))])).map(r => r.k))
  for (const [tabela, coluna, def] of COLUNAS) {
    if (!cols.has(`${tabela}.${coluna}`)) await prisma.$executeRawUnsafe(`ALTER TABLE "${tabela}" ADD COLUMN IF NOT EXISTS "${coluna}" ${def}`)
  }
  const idx = new Set((await prisma.$queryRawUnsafe<{ i: string }[]>(
    `SELECT indexname AS i FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1::text[])`, INDICES.map(x => x[0]))).map(r => r.i))
  for (const [nome, ddl] of INDICES) if (!idx.has(nome)) await prisma.$executeRawUnsafe(ddl)
  schemaOk = true
}
