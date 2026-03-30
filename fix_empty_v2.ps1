# Script corrigido usando [System.IO.File]::WriteAllText
# Funciona com arquivos que têm colchetes no caminho

$route = "import { NextResponse } from 'next/server'`nexport async function GET() { return NextResponse.json({ ok: true }) }"
$page  = "export default function Page() { return null }"

$routeFiles = @(
  "app\api\config\campos-pedido\[id]\route.ts",
  "app\api\config\campos\[id]\route.ts",
  "app\api\config\producao\[id]\route.ts",
  "app\api\config\usuarios\[id]\route.ts",
  "app\api\financeiro\categorias\[id]\route.ts",
  "app\api\financeiro\lancamentos\[id]\route.ts",
  "app\api\gestao\conversas\[id]\route.ts",
  "app\api\master\chamados\[id]\route.ts",
  "app\api\master\workspaces\[id]\route.ts",
  "app\api\master\workspaces\[id]\usuarios\[userid]\route.ts",
  "app\api\precificacao\combos\[id]\route.ts",
  "app\api\precificacao\embalagens\[id]\route.ts",
  "app\api\precificacao\materiais\[id]\route.ts",
  "app\api\precificacao\produtos\[id]\copiar\route.ts",
  "app\api\precificacao\produtos\[id]\route.ts",
  "app\api\precificacao\variacoes\[id]\[historico]\route.ts",
  "app\api\precificacao\variacoes\[id]\route.ts",
  "app\api\producao\demandas\[id]\route.ts",
  "app\api\producao\historico\[pedidoId]\route.ts",
  "app\api\producao\pedidos\[id]\route.ts",
  "app\api\producao\workflow\[pedidoId]\route.ts",
  "app\api\suporte\faq\[id]\route.ts"
)

$pageFiles = @(
  "app\dashboard\pedidos\[id]\page.tsx",
  "app\dashboard\setor\[id]\page.tsx"
)

foreach ($f in $routeFiles) {
  $full = "$PWD\$f"
  [System.IO.File]::WriteAllText($full, $route)
  Write-Host "OK: $f"
}

foreach ($f in $pageFiles) {
  $full = "$PWD\$f"
  [System.IO.File]::WriteAllText($full, $page)
  Write-Host "OK: $f"
}

Write-Host ""
Write-Host "Todos preenchidos! Rode agora:"
Write-Host "git add -A && git commit -m 'fix: fill all empty files' && git push"
