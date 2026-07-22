// ─────────────────────────────────────────────────────────────────────────────
// PROVA da copy — nenhum e-mail pode sair com {{buraco}} na cara da artesã.
//
//   node --experimental-strip-types --import ./scripts/_loader-alias.mjs \
//        scripts/provar-copy.mjs            # confere
//   node ... scripts/provar-copy.mjs --ver  # imprime os 11 e-mails renderizados
// ─────────────────────────────────────────────────────────────────────────────
import { PONTOS, LISTA_PONTOS, montarEmail, PARCELADO_ATIVO } from '../lib/assinatura/avisos.ts'
import { renderizar, marcacoesPendentes } from '../lib/assinatura/template.ts'

let falhas = 0
const checar = (n, ok, d = '') => { if (!ok) falhas++; console.log(`  ${ok ? '✅' : '❌'} ${n}${d ? ` — ${d}` : ''}`) }
const VER = process.argv.includes('--ver')

// Tudo o que o job alimenta hoje (espelha montarVariaveis no cron).
const VARS = {
  nome: 'Maria', workspaceNome: 'Ateliê da Maria', linkAssinatura: 'https://usesoa.com.br/assinatura',
  diasRestantes: 3, diasDeCarencia: 7, diasAteCorte: 4,
  planoMensal: '29,90', planoAnual: '240,40', planoParcelado: '23,99',
  valor: '29,90', vencimento: '27/07/2026', invoiceUrl: 'https://asaas.com/i/abc',
  proximoVencimento: '03/08/2027', ehParcelado: false,
  valorParcela: '23,99', numeroParcela: 4, totalParcelas: 12,
}

console.log('\n=== PROVA — copy da régua ===\n')
console.log(`PARCELADO_ATIVO = ${PARCELADO_ATIVO} (12x ${PARCELADO_ATIVO ? 'no ar' : 'ainda não implementado'})\n`)

console.log('[1] Nenhum e-mail sai com marcação não resolvida')
for (const p of LISTA_PONTOS) {
  const { assunto, texto } = montarEmail(p, VARS)
  const buracos = marcacoesPendentes(assunto + texto)
  checar(p.tipo, buracos.length === 0, buracos.join(', '))
}

console.log('\n[2] Toda variável declarada é usada no texto (e vice-versa)')
for (const p of LISTA_PONTOS) {
  const usadas = new Set([...(p.corpo + p.assunto).matchAll(/\{\{[#^]?(\w+)\}\}/g)].map(m => m[1]))
  const comuns = ['nome', 'workspaceNome', 'linkAssinatura', 'temParcelado']
  const declaradasNaoUsadas = p.variaveis.filter(v => !usadas.has(v))
  const usadasNaoDeclaradas = [...usadas].filter(v => !comuns.includes(v) && !p.variaveis.includes(v))
  checar(`${p.tipo}: declaradas ↔ usadas`,
    declaradasNaoUsadas.length === 0 && usadasNaoDeclaradas.length === 0,
    [declaradasNaoUsadas.length ? `declaradas sem uso: ${declaradasNaoUsadas}` : '',
     usadasNaoDeclaradas.length ? `usadas sem declarar: ${usadasNaoDeclaradas}` : ''].filter(Boolean).join(' | '))
}

console.log('\n[3] Princípios da copy')
for (const p of LISTA_PONTOS) {
  const t = (p.corpo + ' ' + p.assunto).toLowerCase()
  const proibidas = ['cancelado', 'bloqueado', 'suspenso', 'inadimplente', 'devedor']
  const achadas = proibidas.filter(x => t.includes(x))
  // "não cancelado" é uso legítimo — o texto do corte reforça que NÃO é cancelamento.
  const ok = achadas.length === 0 || achadas.every(a => t.includes(`não ${a}`) || t.includes(`, não ${a}`))
  checar(`${p.tipo}: sem palavra que assusta`, ok, achadas.join(', '))
}
checar('CORTE fala em "pausado"', PONTOS.CORTE.corpo.toLowerCase().includes('pausado'))
checar('CORTE garante que nada foi apagado', PONTOS.CORTE.corpo.toLowerCase().includes('nada foi apagado'))
checar('INAD_D0 culpa o cartão, não a artesã', PONTOS.INAD_D0.corpo.toLowerCase().includes('limite do cartão'))

console.log('\n[4] O 12x só aparece quando existir')
const d3Sem = montarEmail(PONTOS.TRIAL_D3, VARS).texto
checar('TRIAL_D3 NÃO promete 12x enquanto PARCELADO_ATIVO=false',
  PARCELADO_ATIVO ? d3Sem.includes('12x') : !d3Sem.includes('12x'))
const comParcela = renderizar(PONTOS.TRIAL_D3.corpo, { ...VARS, temParcelado: true })
checar('com a trava ligada, o 12x aparece', comParcela.includes('12x de R$ 23,99'))

console.log('\n[5] Condicional do e-mail 9 (à vista × parcelado)')
// No D-7 a cobrança do próximo ciclo ainda NÃO existe, então `valor` vem do
// valor da ASSINATURA (240,40), não de uma cobrança em aberto.
const anual = { ...VARS, valor: '240,40' }
const aVista = renderizar(PONTOS.RENOV_ANUAL_D7.corpo, { ...anual, ehParcelado: false })
const parcel = renderizar(PONTOS.RENOV_ANUAL_D7.corpo, { ...anual, ehParcelado: true })
checar('à vista mostra o valor anual cheio', aVista.includes('R$ 240,40 à vista') && !aVista.includes('12x'))
checar('parcelado mostra 12x', parcel.includes('12x de R$ 23,99') && !parcel.includes('à vista'))
checar('valor nunca sai vazio no aviso anual', !aVista.includes('R$  '))

console.log('\n[6] Escape de HTML (nome de ateliê com caractere especial)')
const perigoso = renderizar('Olá {{workspaceNome}}', { workspaceNome: 'Ateliê <script>alert(1)</script> & Cia' })
checar('tags são escapadas', !perigoso.includes('<script>') && perigoso.includes('&lt;script&gt;'))
checar('& é escapado', perigoso.includes('&amp;'))

if (VER) {
  console.log('\n\n════════ OS 11 E-MAILS RENDERIZADOS ════════')
  for (const p of LISTA_PONTOS) {
    const { assunto, texto } = montarEmail(p, VARS)
    console.log(`\n────────── ${p.tipo} · ${p.momento} ──────────`)
    console.log(`ASSUNTO: ${assunto}\n`)
    console.log(texto)
  }
}

console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
process.exitCode = falhas === 0 ? 0 : 1
