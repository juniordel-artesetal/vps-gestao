$saida = "MAPA_PROJETO.md"
$projeto = (Get-Location).Path
$conteudo = @()
$conteudo += "# Mapa do Projeto VPS Gestao"
$conteudo += "Gerado em: $(Get-Date -Format ''dd/MM/yyyy HH:mm'')"
$conteudo += ""
$conteudo += "## Rotas de API"

Get-ChildItem -Path .\app\api -Recurse -Filter "route.ts" | Sort-Object FullName | ForEach-Object {
  $relativo = $_.FullName.Replace("$projeto\app\api\", "").Replace("\route.ts", "").Replace("\", "/")
  $arq = $_.FullName.Replace("$projeto\", "").Replace("\", "/")
  $txt = Get-Content -LiteralPath $_.FullName -Raw
  $m = @()
  if ($txt -match ''export\s+async\s+function\s+GET'')    { $m += "GET" }
  if ($txt -match ''export\s+async\s+function\s+POST'')   { $m += "POST" }
  if ($txt -match ''export\s+async\s+function\s+PUT'')    { $m += "PUT" }
  if ($txt -match ''export\s+async\s+function\s+PATCH'')  { $m += "PATCH" }
  if ($txt -match ''export\s+async\s+function\s+DELETE'') { $m += "DELETE" }
  $conteudo += "- /api/$relativo  [$($m -join '', '')]  -> $arq"
}

$conteudo += ""
$conteudo += "## Paginas"
Get-ChildItem -Path .\app -Recurse -Filter "page.tsx" | Where-Object { $_.FullName -notmatch "node_modules" } | Sort-Object FullName | ForEach-Object {
  $rel = $_.FullName.Replace("$projeto\app", "").Replace("\page.tsx", "").Replace("\", "/")
  if ($rel -eq "") { $rel = "/" }
  $arq = $_.FullName.Replace("$projeto\", "").Replace("\", "/")
  $conteudo += "- $rel  -> $arq"
}

$conteudo += ""
$conteudo += "## Componentes"
Get-ChildItem -Path .\components -Filter "*.tsx" | Sort-Object Name | ForEach-Object {
  $conteudo += "- components/$($_.Name)"
}

$conteudo | Out-File -FilePath $saida -Encoding UTF8
Write-Host ""
Write-Host "OK: $saida criado" -ForegroundColor Green
