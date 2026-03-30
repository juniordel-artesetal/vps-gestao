# Script para preencher arquivos vazios com export mínimo válido
# Execute na raiz do projeto: .\fix_empty_files.ps1

$files = @(
  "app/api/auth/[...nextauth]/route.ts",
  "app/api/config/campos-pedido/[id]/route.ts",
  "app/api/config/campos/[id]/route.ts",
  "app/api/config/producao/[id]/route.ts",
  "app/api/config/usuarios/[id]/route.ts",
  "app/api/financeiro/categorias/[id]/route.ts",
  "app/api/financeiro/lancamentos/[id]/route.ts",
  "app/api/gestao/conversas/[id]/route.ts",
  "app/api/master/chamados/[id]/route.ts",
  "app/api/master/workspaces/[id]/route.ts",
  "app/api/master/workspaces/[id]/usuarios/[userid]/route.ts",
  "app/api/precificacao/combos/[id]/route.ts",
  "app/api/precificacao/embalagens/[id]/route.ts",
  "app/api/precificacao/materiais/[id]/route.ts",
  "app/api/precificacao/produtos/[id]/copiar/route.ts",
  "app/api/precificacao/produtos/[id]/route.ts",
  "app/api/precificacao/variacoes/[id]/[historico]/route.ts",
  "app/api/precificacao/variacoes/[id]/route.ts",
  "app/api/producao/demandas/[id]/route.ts",
  "app/api/producao/demandas/route.ts",
  "app/api/producao/historico/[pedidoId]/route.ts",
  "app/api/producao/pedidos/[id]/route.ts",
  "app/api/producao/workflow/[pedidoId]/route.ts",
  "app/api/suporte/faq/[id]/route.ts",
  "app/dashboard/pedidos/[id]/page.tsx",
  "app/dashboard/setor/[id]/page.tsx"
)

$routeContent = @"
import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ ok: true }) }
"@

$pageContent = @"
export default function Page() { return null }
"@

foreach ($file in $files) {
  if (Test-Path $file) {
    $size = (Get-Item $file).Length
    if ($size -eq 0) {
      if ($file -like "*.tsx") {
        Set-Content -Path $file -Value $pageContent -Encoding UTF8
      } else {
        Set-Content -Path $file -Value $routeContent -Encoding UTF8
      }
      Write-Host "✓ Preenchido: $file"
    }
  }
}

Write-Host ""
Write-Host "Pronto! Agora rode: git add -A && git commit -m 'fix: fill empty route files' && git push"
