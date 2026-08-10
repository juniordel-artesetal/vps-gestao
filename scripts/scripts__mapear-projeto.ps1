# scripts/mapear-projeto.ps1
# Gera um snapshot atualizado de TODAS as rotas, páginas e componentes do VPS Gestão
# Uso: .\scripts\mapear-projeto.ps1
# Saída: MAPA_PROJETO.md (commitado no repo, fica sempre atualizado)

$saida = "MAPA_PROJETO.md"
$projeto = $PSScriptRoot | Split-Path -Parent
Set-Location $projeto

$conteudo = @()
$conteudo += "# 🗺️ Mapa do Projeto VPS Gestão"
$conteudo += ""
$conteudo += "_Gerado automaticamente em: $(Get-Date -Format 'dd/MM/yyyy HH:mm')_"
$conteudo += ""

# ── ROTAS DE API ───────────────────────────────────────────────────────────
$conteudo += "## 📡 Rotas de API"
$conteudo += ""
$conteudo += "| Endpoint | Métodos | Arquivo |"
$conteudo += "|---|---|---|"

Get-ChildItem -Path .\app\api -Recurse -Filter "route.ts" | Sort-Object FullName | ForEach-Object {
  $relativo = $_.FullName.Replace("$projeto\app\api\", "").Replace("\route.ts", "").Replace("\", "/")
  $endpoint = "/api/$relativo"
  $caminhoArquivo = $_.FullName.Replace("$projeto\", "").Replace("\", "/")

  # Detecta métodos exportados
  $conteudoArq = Get-Content $_.FullName -Raw
  $metodos = @()
  if ($conteudoArq -match 'export\s+async\s+function\s+GET')    { $metodos += "GET" }
  if ($conteudoArq -match 'export\s+async\s+function\s+POST')   { $metodos += "POST" }
  if ($conteudoArq -match 'export\s+async\s+function\s+PUT')    { $metodos += "PUT" }
  if ($conteudoArq -match 'export\s+async\s+function\s+PATCH')  { $metodos += "PATCH" }
  if ($conteudoArq -match 'export\s+async\s+function\s+DELETE') { $metodos += "DELETE" }
  $metodosStr = $metodos -join ", "

  $conteudo += "| ``$endpoint`` | $metodosStr | ``$caminhoArquivo`` |"
}

# ── PÁGINAS ────────────────────────────────────────────────────────────────
$conteudo += ""
$conteudo += "## 🖼️ Páginas"
$conteudo += ""
$conteudo += "| URL | Arquivo |"
$conteudo += "|---|---|"

Get-ChildItem -Path .\app -Recurse -Filter "page.tsx" -Exclude "node_modules" | Sort-Object FullName | ForEach-Object {
  $relativo = $_.FullName.Replace("$projeto\app", "").Replace("\page.tsx", "").Replace("\", "/")
  if ($relativo -eq "") { $relativo = "/" }
  $caminhoArquivo = $_.FullName.Replace("$projeto\", "").Replace("\", "/")
  $conteudo += "| ``$relativo`` | ``$caminhoArquivo`` |"
}

# ── COMPONENTES ────────────────────────────────────────────────────────────
$conteudo += ""
$conteudo += "## 🧩 Componentes"
$conteudo += ""

Get-ChildItem -Path .\components -Recurse -Filter "*.tsx" | Sort-Object Name | ForEach-Object {
  $conteudo += "- ``components/$($_.Name)``"
}

# ── BIBLIOTECAS ────────────────────────────────────────────────────────────
$conteudo += ""
$conteudo += "## 📚 lib/"
$conteudo += ""

if (Test-Path .\lib) {
  Get-ChildItem -Path .\lib -Recurse -Filter "*.ts" | Sort-Object Name | ForEach-Object {
    $conteudo += "- ``lib/$($_.Name)``"
  }
}

# ── TABELAS DO BANCO (a partir do schema.prisma) ──────────────────────────
$conteudo += ""
$conteudo += "## 🗄️ Tabelas (Prisma Schema)"
$conteudo += ""

if (Test-Path .\prisma\schema.prisma) {
  $schemaTxt = Get-Content .\prisma\schema.prisma -Raw
  $matches = [regex]::Matches($schemaTxt, 'model\s+(\w+)\s*\{')
  foreach ($m in $matches) {
    $conteudo += "- $($m.Groups[1].Value)"
  }
}

# Salvar
$conteudo | Out-File -FilePath $saida -Encoding UTF8

Write-Host ""
Write-Host "✓ Mapa salvo em $saida" -ForegroundColor Green
Write-Host "  Cole o conteudo no chat do Claude antes de iniciar novas alteracoes." -ForegroundColor Cyan
Write-Host ""
