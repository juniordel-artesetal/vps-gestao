-- Método MAE — tabelas no Neon (nomes da spec, docs/mae-spec.md → "Modelo de dados").
-- "conta" = workspace do SOA (o ateliê). Só RECEITAS (JSON) e metadados: nenhuma arte, imagem ou fonte.
-- Rodar UMA vez (script de migração), nunca em runtime (DDL a cada cold start já travou a Workspace).
-- Tudo CREATE ... IF NOT EXISTS: não mexe em nada que já exista.

-- base: um registro por VERSÃO (o tema aponta para uma versão da base)
CREATE TABLE IF NOT EXISTS mae_bases (
  workspace_id  text        NOT NULL,
  id            text        NOT NULL,
  version       integer     NOT NULL,
  nome          text        NOT NULL,
  doc           jsonb       NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id, version)
);

-- tema: um registro por VERSÃO (o pedido aponta para uma versão do tema)
CREATE TABLE IF NOT EXISTS mae_themes (
  workspace_id  text        NOT NULL,
  id            text        NOT NULL,
  version       integer     NOT NULL,
  base_id       text        NOT NULL,
  base_version  integer     NOT NULL,
  nome          text        NOT NULL,
  doc           jsonb       NOT NULL,
  publicado     boolean     NOT NULL DEFAULT false,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, id, version)
);

-- Identidade do Ateliê: nome do arquivo + hash (o arquivo fica na Biblioteca), link do QR, @
CREATE TABLE IF NOT EXISTS mae_identity (
  workspace_id  text        PRIMARY KEY,
  logo_arquivo  text,
  logo_sha256   text,
  logo_aspect   double precision,
  qr_link       text,
  qr_arquivo    text,
  qr_sha256     text,
  arroba        text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- marca de registro (Sprint 9): folha em mm, nome do arquivo, hash, área livre
CREATE TABLE IF NOT EXISTS mae_registration_presets (
  id            text        PRIMARY KEY,
  workspace_id  text        NOT NULL,
  folha_w_mm    double precision NOT NULL,
  folha_h_mm    double precision NOT NULL,
  nome_arquivo  text        NOT NULL,
  sha256        text        NOT NULL,
  area_livre    jsonb,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mae_registration_presets_ws ON mae_registration_presets (workspace_id);

-- presets de efeito: workspace_id = conta da usuária, ou 'naty' (Loja da Naty)
CREATE TABLE IF NOT EXISTS mae_effect_presets (
  id             text        PRIMARY KEY,
  workspace_id   text        NOT NULL,
  nome           text        NOT NULL,
  effects        jsonb       NOT NULL,
  preco_centavos integer,
  gratis         boolean     NOT NULL DEFAULT true,
  publicado      boolean     NOT NULL DEFAULT false,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mae_effect_presets_ws ON mae_effect_presets (workspace_id);

-- vínculo produto/variação do SOA ↔ tema (Sprint 12)
CREATE TABLE IF NOT EXISTS mae_product_theme_links (
  id            text        PRIMARY KEY,
  workspace_id  text        NOT NULL,
  produto_id    text        NOT NULL,
  variacao_id   text,
  theme_id      text        NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mae_product_theme_links_ws ON mae_product_theme_links (workspace_id, produto_id);

-- arte de cada pedido (Sprint 12): só metadados — o arquivo fica no computador
CREATE TABLE IF NOT EXISTS mae_order_arts (
  id            text        PRIMARY KEY,
  workspace_id  text        NOT NULL,
  order_id      text        NOT NULL,
  theme_id      text        NOT NULL,
  theme_version integer     NOT NULL,
  variaveis     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status        text        NOT NULL DEFAULT 'nao_gerada',
  arquivo       text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mae_order_arts_ws ON mae_order_arts (workspace_id, order_id);

-- compras de packs e presets da Loja da Naty (Sprint 12)
CREATE TABLE IF NOT EXISTS mae_purchases (
  id            text        PRIMARY KEY,
  workspace_id  text        NOT NULL,
  item_tipo     text        NOT NULL,
  item_id       text        NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mae_purchases_ws ON mae_purchases (workspace_id);
