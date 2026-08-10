# ══════════════════════════════════════════════════════════════════
# VPS Gestão — Gerador de Mapa de Arquivos
# Execute na raiz do projeto: C:\vps-gestao\
# Uso: .\gerar_mapa.ps1
# ══════════════════════════════════════════════════════════════════

$saida = "MAPA_ARQUIVOS_VPS.md"
$raiz  = Get-Location

# Pastas a ignorar
$ignorar = @('.next', 'node_modules', '.git', 'dist', 'build', '.vercel', 'coverage', '__pycache__')

function Get-Emoji($path) {
    $ext = [System.IO.Path]::GetExtension($path)
    $nome = [System.IO.Path]::GetFileName($path)
    switch -Wildcard ($ext) {
        ".ts"   { return "🟦" }
        ".tsx"  { return "⚛️ " }
        ".css"  { return "🎨" }
        ".json" { return "📋" }
        ".md"   { return "📝" }
        ".sql"  { return "🗄️ " }
        ".env*" { return "🔒" }
        default { return "📄" }
    }
}

function Get-Desc($rel) {
    $r = $rel -replace '\\', '/'
    $map = @{
        # Auth / Core
        "app/layout.tsx"                                      = "Layout raiz — providers (Session, Theme, Pixel)"
        "app/page.tsx"                                        = "Redirect / → /login"
        "app/globals.css"                                     = "Estilos globais + CSS variables"
        "app/login/page.tsx"                                  = "Tela de login"
        "app/register/page.tsx"                               = "Cadastro novo workspace"
        "app/setup/page.tsx"                                  = "Onboarding — escolha de setores"
        "app/modulos/page.tsx"                                = "Hub de módulos por role"
        "app/landing/page.tsx"                                = "Landing page pública"
        "app/landing/layout.tsx"                              = "Layout landing (sem sidebar)"
        # API Auth
        "app/api/auth/[...nextauth]/route.ts"                 = "NextAuth v4 — JWT com workspaceId/role"
        "app/api/hotmart/webhook/route.ts"                    = "⚠️ CRÍTICO — cria workspace na compra"
        "app/api/telegram/bot/route.ts"                       = "Bot Telegram + Gemini Vision"
        # API Produção
        "app/api/producao/pedidos/route.ts"                   = "Listagem + criação de pedidos"
        "app/api/producao/pedidos/[id]/route.ts"              = "Detalhe + edição + exclusão + auditoria"
        "app/api/producao/workflow/route.ts"                  = "⚠️ Iniciar/Concluir/Devolver + lançamento auto"
        "app/api/producao/setores/route.ts"                   = "Listagem setores ativos do workspace"
        "app/api/producao/resumo/route.ts"                    = "Stats painel por status e setor"
        "app/api/producao/historico/[pedidoId]/route.ts"      = "Fluxo visual + PedidoHistorico"
        # API Config
        "app/api/config/geral/route.ts"                       = "Config workspace — moduloEstoque/moduloDemandas"
        "app/api/config/producao/route.ts"                    = "GET setores do workspace"
        "app/api/config/producao/[id]/route.ts"               = "PUT/DELETE setor"
        "app/api/config/campos-pedido/route.ts"               = "Campos personalizados de pedido"
        "app/api/config/freelancers/route.ts"                 = "CRUD freelancers"
        "app/api/config/freelancers/[id]/route.ts"            = "PUT/DELETE freelancer"
        "app/api/config/usuarios/route.ts"                    = "Gestão usuários e roles"
        # API Importação
        "app/api/importacao/pedidos/route.ts"                 = "🐛 BUG ATIVO — importação planilha Shopee/VPS"
        "app/api/importacao/template/route.ts"                = "Template xlsx com campos do workspace"
        # API Financeiro
        "app/api/financeiro/resumo/route.ts"                  = "Dashboard financeiro"
        "app/api/financeiro/lancamentos/route.ts"             = "Lista + criar lançamentos"
        "app/api/financeiro/lancamentos/[id]/route.ts"        = "GET/PUT/DELETE — DELETE usa recorrenciaId"
        "app/api/financeiro/fluxo/route.ts"                   = "Fluxo de caixa"
        "app/api/financeiro/metas/route.ts"                   = "Metas mensais"
        "app/api/financeiro/categorias/route.ts"              = "CRUD categorias"
        # API Precificação
        "app/api/precificacao/materiais/route.ts"             = "CRUD materiais"
        "app/api/precificacao/materiais/[id]/route.ts"        = "PUT/DELETE material"
        "app/api/precificacao/embalagens/route.ts"            = "CRUD embalagens"
        "app/api/precificacao/embalagens/[id]/route.ts"       = "PUT/DELETE embalagem"
        "app/api/precificacao/produtos/route.ts"              = "CRUD produtos"
        "app/api/precificacao/produtos/[id]/route.ts"         = "PUT/DELETE produto"
        "app/api/precificacao/variacoes/route.ts"             = "CRUD variações"
        "app/api/precificacao/variacoes/[id]/route.ts"        = "GET/PUT/DELETE variação"
        "app/api/precificacao/variacoes/[id]/historico/route.ts" = "Histórico de preços"
        "app/api/precificacao/combos/route.ts"                = "CRUD combos"
        "app/api/precificacao/combos/[id]/route.ts"           = "GET/PUT/DELETE combo"
        "app/api/precificacao/calcular/route.ts"              = "Calculadora de preço"
        "app/api/precificacao/config-tributos/route.ts"       = "Regime tributário"
        "app/api/precificacao/ncm/route.ts"                   = "35 NCMs de artesanato"
        # API IA / Gestão
        "app/api/gestao/chat/route.ts"                        = "Gemini 2.5 Flash — dados reais, 150/dia"
        "app/api/gestao/chat/titulo/route.ts"                 = "Gera título automático da conversa"
        "app/api/gestao/contexto/route.ts"                    = "Dados reais injetados no prompt"
        "app/api/gestao/conversas/route.ts"                   = "GET/POST histórico de conversas"
        "app/api/gestao/conversas/[id]/route.ts"              = "GET/PUT/DELETE conversa"
        # API Suporte
        "app/api/suporte/chat/route.ts"                       = "⚠️ Robô Gemini suporte — 17.480 chars"
        "app/api/suporte/chamado/route.ts"                    = "Chamados do workspace"
        "app/api/suporte/feedback/route.ts"                   = "Feedbacks do workspace"
        "app/api/suporte/mensagens/route.ts"                  = "Mensagens de chamados/feedbacks"
        # API Dashboard / Outros
        "app/api/dashboard/resumo/route.ts"                   = "KPIs agregados dashboard geral"
        "app/api/notificacoes/route.ts"                       = "Notificações (atrasos, mínimo estoque)"
        "app/api/demandas/route.ts"                           = "CRUD demandas"
        "app/api/demandas/[id]/route.ts"                      = "PUT/DELETE demanda"
        "app/api/master/dashboard/route.ts"                   = "Stats master admin"
        "app/api/master/workspaces/route.ts"                  = "GET/PUT workspaces"
        "app/api/master/chamados/[id]/route.ts"               = "PUT status chamado (master)"
        "app/api/master/mensagens/route.ts"                   = "Mensagens master ↔ usuária"
        # Pages Produção
        "app/dashboard/page.tsx"                              = "Dashboard Geral — KPIs + gráficos"
        "app/dashboard/painel/page.tsx"                       = "Painel Produção — 5 cards + por setor"
        "app/dashboard/pedidos/page.tsx"                      = "Lista de pedidos — filtros + ações em massa"
        "app/dashboard/pedidos/[id]/page.tsx"                 = "Detalhe/edição pedido"
        "app/dashboard/pedidos/print/page.tsx"                = "Impressão em massa (window.open HTML)"
        "app/dashboard/pedidos/[id]/print/page.tsx"           = "Impressão individual"
        "app/dashboard/setor/[id]/page.tsx"                   = "Fila do setor — Iniciar/Concluir/Devolver"
        "app/dashboard/calendario/page.tsx"                   = "Calendário de envios"
        "app/dashboard/orcamentos/page.tsx"                   = "Orçamentos com link público"
        "app/dashboard/estoque/page.tsx"                      = "Estoque de Produtos (módulo opcional)"
        # Pages Precificação
        "app/precificacao/layout.tsx"                         = "Guard ADMIN + Sidebar precificação"
        "app/precificacao/materiais/page.tsx"                 = "CRUD matérias-primas"
        "app/precificacao/embalagens/page.tsx"                = "CRUD kits de embalagem"
        "app/precificacao/produtos/page.tsx"                  = "CRUD produtos + taxas extras"
        "app/precificacao/combos/page.tsx"                    = "Combos com desconto"
        "app/precificacao/canais/page.tsx"                    = "Grade comparativa por canal"
        "app/precificacao/calcular/page.tsx"                  = "Calculadora de preço"
        "app/precificacao/config-tributos/page.tsx"           = "Regime tributário"
        "app/precificacao/oraculo/page.tsx"                   = "Oráculo contábil IA (NCMs)"
        "app/precificacao/estoque-materiais/page.tsx"         = "Estoque de Materiais (módulo opcional)"
        # Pages Financeiro
        "app/financeiro/layout.tsx"                           = "Guard ADMIN + Sidebar financeiro"
        "app/financeiro/page.tsx"                             = "Dashboard financeiro"
        "app/financeiro/lancamentos/page.tsx"                 = "Lista lançamentos — recorrência, parcelamento"
        "app/financeiro/fluxo/page.tsx"                       = "Fluxo de caixa dia a dia"
        "app/financeiro/metas/page.tsx"                       = "Metas mensais"
        "app/financeiro/categorias/page.tsx"                  = "CRUD categorias"
        # Pages Outros
        "app/gestao/page.tsx"                                 = "Chat IA Gemini com dados reais"
        "app/demandas/page.tsx"                               = "Lista de demandas"
        "app/demandas/historico/page.tsx"                     = "Histórico de demandas"
        "app/suporte/page.tsx"                                = "Central suporte (FAQ, chat, chamados)"
        "app/config/geral/page.tsx"                           = "Config workspace (nome, logo, cor, módulos)"
        "app/config/producao/page.tsx"                        = "CRUD setores de produção"
        "app/config/campos-pedido/page.tsx"                   = "Campos personalizados por pedido"
        "app/config/campos-estoque/page.tsx"                  = "Campos do estoque"
        "app/config/freelancers/page.tsx"                     = "CRUD freelancers"
        "app/config/usuarios/page.tsx"                        = "Gestão usuários e roles"
        "app/master/page.tsx"                                 = "Master Admin"
        "app/master/feedback/page.tsx"                        = "Painel feedbacks (master)"
        # Components / Lib
        "components/Sidebar.tsx"                              = "⚠️ Nav principal — dinâmico por role/módulos"
        "components/ModalImportacao.tsx"                      = "🐛 BUG ATIVO — Modal importação planilha"
        "lib/prisma.ts"                                       = "⚠️ Singleton Prisma — nunca instanciar direto"
        "lib/auth.ts"                                         = "⚠️ authOptions NextAuth — JWT workspaceId/role"
        "lib/alert.ts"                                        = "Alertas críticos via Telegram"
        "lib/versao.ts"                                       = "CHANGELOG — atualizar ao lançar versão"
        "middleware.ts"                                       = "Middleware de autenticação (deprecated → proxy)"
        "next.config.ts"                                      = "Configuração Next.js"
        "tailwind.config.ts"                                  = "Configuração Tailwind v4"
        "prisma/schema.prisma"                                = "⚠️ Schema do banco — não alterar sem migração"
    }
    if ($map.ContainsKey($r)) { return $map[$r] }
    return ""
}

# Cabeçalho
$lines = @()
$lines += "# 🗺️ Mapa Completo de Arquivos — VPS Gestão"
$lines += "**Gerado em:** $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
$lines += "**Versão:** 1.6.0 | **Sistema:** app.vps-gestao.com.br"
$lines += ""
$lines += "> ⚠️ Arquivos marcados com **⚠️** são críticos — qualquer alteração deve ser cirúrgica."
$lines += "> 🐛 Arquivos marcados com **🐛** têm bug ativo em investigação."
$lines += ""
$lines += "---"
$lines += ""

# Percorre a árvore
function Walk-Dir($dir, $indent) {
    $items = Get-ChildItem -Path $dir | Sort-Object { $_.PSIsContainer }, Name
    foreach ($item in $items) {
        if ($ignorar -contains $item.Name) { continue }
        $rel = $item.FullName.Substring($raiz.Path.Length + 1)
        if ($item.PSIsContainer) {
            $lines += ("  " * $indent) + "**📁 $($item.Name)/**"
            Walk-Dir $item.FullName ($indent + 1)
        } else {
            $ext = $item.Extension.ToLower()
            if ($ext -notin @('.ts','.tsx','.css','.json','.md','.sql','.env','.gitignore','.nvmrc')) { continue }
            $emoji = Get-Emoji $item.FullName
            $relSlash = $rel -replace '\\', '/'
            $desc = Get-Desc $relSlash
            if ($desc -ne "") {
                $lines += ("  " * $indent) + "- $emoji ``$($item.Name)`` — $desc"
            } else {
                $lines += ("  " * $indent) + "- $emoji ``$($item.Name)``"
            }
        }
    }
}

Walk-Dir $raiz 0

# Legenda
$lines += ""
$lines += "---"
$lines += ""
$lines += "## 📌 Legenda"
$lines += ""
$lines += "| Ícone | Tipo |"
$lines += "|---|---|"
$lines += "| 🟦 | TypeScript (.ts) |"
$lines += "| ⚛️  | React/TSX (.tsx) |"
$lines += "| 🎨 | CSS |"
$lines += "| 📋 | JSON |"
$lines += "| 📝 | Markdown |"
$lines += "| 🗄️  | SQL |"
$lines += "| ⚠️  | Arquivo crítico — alterar com cuidado |"
$lines += "| 🐛 | Bug ativo em investigação |"

$lines | Out-File -FilePath $saida -Encoding UTF8
Write-Host "✅ Mapa gerado: $saida ($((Get-Item $saida).Length) bytes)"
Write-Host "📁 $(($lines | Where-Object { $_ -like '- *' }).Count) arquivos mapeados"
