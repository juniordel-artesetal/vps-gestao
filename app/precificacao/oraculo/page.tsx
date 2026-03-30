'use client'

import { useState } from 'react'

const MEI_DAS_MENSAL = 75.90
const SIMPLES_ANEXO_II = [
  { faixaMax:180000,  nominal:0.045, deducao:0,      label:'até R$ 180 mil' },
  { faixaMax:360000,  nominal:0.078, deducao:5940,   label:'até R$ 360 mil' },
  { faixaMax:720000,  nominal:0.100, deducao:13860,  label:'até R$ 720 mil' },
  { faixaMax:1800000, nominal:0.112, deducao:22500,  label:'até R$ 1,8 mi'  },
  { faixaMax:3600000, nominal:0.147, deducao:85500,  label:'até R$ 3,6 mi'  },
  { faixaMax:4800000, nominal:0.300, deducao:720000, label:'até R$ 4,8 mi'  },
]
const REPARTICAO = [
  {irpj:0.0550,csll:0.0350,cofins:0.1225,pis:0.0275,cpp:0.4200,icms:0.1400,ipi:0.0500},
  {irpj:0.0551,csll:0.0350,cofins:0.1351,pis:0.0301,cpp:0.4150,icms:0.1300,ipi:0.0497},
  {irpj:0.0535,csll:0.0354,cofins:0.1342,pis:0.0300,cpp:0.4200,icms:0.1273,ipi:0.0496},
  {irpj:0.0535,csll:0.0354,cofins:0.1342,pis:0.0300,cpp:0.4200,icms:0.1273,ipi:0.0496},
  {irpj:0.0625,csll:0.0395,cofins:0.1495,pis:0.0333,cpp:0.4050,icms:0.1202,ipi:0.0500},
  {irpj:0.1300,csll:0.0800,cofins:0.1800,pis:0.0400,cpp:0.3500,icms:0,     ipi:0.1200},
]
const NCMS_PADRAO = [
  {id:'9505',nome:'Artigos de Festa (toppers, enfeites)',        icmsInterno:0.18,ipi:0.15,nota:'ICMS 18% SP. IPI 15%.'},
  {id:'4909',nome:'Convites / Cartões Personalizados',           icmsInterno:0.18,ipi:0.00,nota:'ICMS 18% SP. IPI 0%.'},
  {id:'4911',nome:'Tags, Adesivos, Outros Impressos',            icmsInterno:0.18,ipi:0.00,nota:'ICMS 18% SP. IPI isento.'},
  {id:'4819',nome:'Embalagens Personalizadas (caixinhas)',       icmsInterno:0.18,ipi:0.10,nota:'ICMS 18% SP. IPI 10%.'},
  {id:'6217',nome:'Laços / Acessórios Têxteis',                 icmsInterno:0.12,ipi:0.00,nota:'ICMS 12% SP. IPI 0%.'},
]
const ESTADOS = [
  {uf:'AC',nome:'Acre',icms:0.19},{uf:'AL',nome:'Alagoas',icms:0.19},{uf:'AM',nome:'Amazonas',icms:0.20},
  {uf:'AP',nome:'Amapá',icms:0.18},{uf:'BA',nome:'Bahia',icms:0.205},{uf:'CE',nome:'Ceará',icms:0.20},
  {uf:'DF',nome:'Distrito Federal',icms:0.20},{uf:'ES',nome:'Espírito Santo',icms:0.17},{uf:'GO',nome:'Goiás',icms:0.19},
  {uf:'MA',nome:'Maranhão',icms:0.22},{uf:'MG',nome:'Minas Gerais',icms:0.18},{uf:'MS',nome:'Mato Grosso do Sul',icms:0.17},
  {uf:'MT',nome:'Mato Grosso',icms:0.17},{uf:'PA',nome:'Pará',icms:0.19},{uf:'PB',nome:'Paraíba',icms:0.20},
  {uf:'PE',nome:'Pernambuco',icms:0.205},{uf:'PI',nome:'Piauí',icms:0.21},{uf:'PR',nome:'Paraná',icms:0.19},
  {uf:'RJ',nome:'Rio de Janeiro',icms:0.22},{uf:'RN',nome:'Rio Grande do Norte',icms:0.18},{uf:'RO',nome:'Rondônia',icms:0.195},
  {uf:'RR',nome:'Roraima',icms:0.20},{uf:'RS',nome:'Rio Grande do Sul',icms:0.17},{uf:'SC',nome:'Santa Catarina',icms:0.17},
  {uf:'SE',nome:'Sergipe',icms:0.19},{uf:'SP',nome:'São Paulo',icms:0.18},{uf:'TO',nome:'Tocantins',icms:0.20},
]
const CANAIS = [
  {key:'shopee_ate79',   label:'Shopee (até R$79,99)',    taxa:0.20,fixo:4.00 },
  {key:'shopee_80_99',   label:'Shopee (R$80–R$99,99)',   taxa:0.14,fixo:16.00},
  {key:'shopee_100_199', label:'Shopee (R$100–R$199,99)', taxa:0.14,fixo:20.00},
  {key:'shopee_200',     label:'Shopee (acima R$200)',     taxa:0.14,fixo:26.00},
  {key:'ml_classico',    label:'Mercado Livre Clássico',  taxa:0.12,fixo:0    },
  {key:'ml_premium',     label:'Mercado Livre Premium',   taxa:0.16,fixo:0    },
  {key:'amazon',         label:'Amazon Individual',       taxa:0.12,fixo:2.00 },
  {key:'tiktok',         label:'TikTok Shop',             taxa:0.06,fixo:2.00 },
  {key:'elo7_padrao',    label:'Elo7 Padrão',             taxa:0.18,fixo:3.99 },
  {key:'elo7_maxima',    label:'Elo7 Máxima',             taxa:0.20,fixo:3.99 },
  {key:'magalu',         label:'Magalu',                  taxa:0.10,fixo:0    },
  {key:'direta',         label:'Venda Direta',            taxa:0.03,fixo:0    },
]
const FAIXAS_RECOMENDACAO = [
  { faixaMin:0, faixaMax:81000, label:'Até R$ 81 mil/ano', sublabel:'até R$ 6.750/mês', recomendado:'MEI',
    cor:'text-yellow-700', bg:'bg-yellow-50', border:'border-yellow-300', aliquotaEfetiva:'~0,09%',
    razao:'MEI é o mais econômico nesta faixa. Taxa fixa de R$75,90/mês independente do faturamento.',
    atencao:'Limite estrito de R$81.000/ano. Ultrapassar exige migração imediata para Simples Nacional.', alternativa:null },
  { faixaMin:81000, faixaMax:360000, label:'R$ 81 mil – R$ 360 mil/ano', sublabel:'R$ 6.750 – R$ 30.000/mês',
    recomendado:'Simples Nacional', cor:'text-green-700', bg:'bg-green-50', border:'border-green-300', aliquotaEfetiva:'4,5% – 5,5%',
    razao:'Simples Nacional Faixa 1/2 é ideal. Alíquota efetiva entre 4,5% e 5,5% — muito abaixo do Lucro Presumido (~11%).',
    atencao:'Evite Lucro Presumido nesta faixa — carga efetiva seria ~2x maior.', alternativa:null },
  { faixaMin:360000, faixaMax:720000, label:'R$ 360 mil – R$ 720 mil/ano', sublabel:'R$ 30.000 – R$ 60.000/mês',
    recomendado:'Simples Nacional', cor:'text-green-700', bg:'bg-green-50', border:'border-green-300', aliquotaEfetiva:'6,5% – 8%',
    razao:'Simples ainda vantajoso nas Faixas 2/3. Alíquota efetiva cresce mas permanece abaixo do Lucro Presumido.',
    atencao:'Compare com Lucro Presumido se tiver folha de pagamento reduzida.', alternativa:'Lucro Presumido (se folha salarial < 20% receita)' },
  { faixaMin:720000, faixaMax:1800000, label:'R$ 720 mil – R$ 1,8 mi/ano', sublabel:'R$ 60.000 – R$ 150.000/mês',
    recomendado:'Comparar', cor:'text-orange-700', bg:'bg-orange-50', border:'border-orange-300', aliquotaEfetiva:'8% – 11%',
    razao:'Zona de transição. Simples Faixas 3/4 começa a se aproximar do Lucro Presumido.',
    atencao:'Recomendado contratar contador para simulação personalizada.', alternativa:'Lucro Presumido pode ser equivalente ou melhor' },
  { faixaMin:1800000, faixaMax:4800000, label:'R$ 1,8 mi – R$ 4,8 mi/ano', sublabel:'R$ 150.000 – R$ 400.000/mês',
    recomendado:'Lucro Presumido', cor:'text-blue-700', bg:'bg-blue-50', border:'border-blue-300', aliquotaEfetiva:'11% – 14%',
    razao:'Lucro Presumido tende a ser mais vantajoso. Simples Faixas 5/6 tem alíquota de até 30%.',
    atencao:'Se a margem líquida for baixa (<15%), o Lucro Real pode ser mais interessante.', alternativa:'Lucro Real (se margem líquida < 15%)' },
  { faixaMin:4800000, faixaMax:Infinity, label:'Acima de R$ 4,8 mi/ano', sublabel:'acima de R$ 400.000/mês',
    recomendado:'Lucro Real', cor:'text-purple-700', bg:'bg-purple-50', border:'border-purple-300', aliquotaEfetiva:'Variável',
    razao:'Lucro Real é frequentemente a melhor opção após R$ 4,8 mi. Permite compensar prejuízos e tomar créditos PIS/COFINS.',
    atencao:'Exige contabilidade detalhada. Não recomendado sem estrutura contábil profissional.', alternativa:'Lucro Presumido (se operação simples e margem alta)' },
]

function calcSimples(rbt12:number, receita:number) {
  const idx = Math.max(0, SIMPLES_ANEXO_II.findIndex(f => rbt12 <= f.faixaMax))
  const i = idx === -1 ? 5 : idx
  const f = SIMPLES_ANEXO_II[i]
  const aliq = Math.max((rbt12 * f.nominal - f.deducao) / rbt12, 0)
  return { aliq, das: receita * aliq, idx: i, faixa: f, rep: REPARTICAO[i] }
}
function calcPresumido(receita:number) {
  const irpj=receita*0.08*0.15, csll=receita*0.12*0.09, pis=receita*0.0065, cofins=receita*0.03
  return { irpj, csll, pis, cofins, total: irpj+csll+pis+cofins }
}
function calcReal(receita:number, margem:number) {
  const lucro=receita*margem
  const irpj=Math.max(lucro,0)*0.15, csll=Math.max(lucro,0)*0.09, pis=receita*0.0165, cofins=receita*0.076
  return { irpj, csll, pis, cofins, total: irpj+csll+pis+cofins }
}
function fmt(v:number) { return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function pct(v:number) { return (v*100).toFixed(2)+'%' }
function fmtCNPJ(v:string) { return v.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5') }

function TribLine({label,valor,total,color}:{label:string;valor:number;total:number;color:string}) {
  const w = total > 0 ? Math.min((valor/total)*100,100) : 0
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs text-gray-700 font-mono">{fmt(valor)} <span className="text-gray-400">({pct(total>0?valor/total:0)})</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{width:`${w}%`,backgroundColor:color}}/>
      </div>
    </div>
  )
}

function Slider({label,value,min,max,step,onChange,formatFn,sublabel}:any) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">{label}</span>
        <span className="text-sm font-bold text-orange-600 font-mono">{formatFn(value)}</span>
      </div>
      {sublabel && <p className="text-xs text-gray-400 mb-1">{sublabel}</p>}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full accent-orange-500 cursor-pointer"/>
    </div>
  )
}

export default function OraculoPage() {
  const [receita,       setReceita]       = useState(10000)
  const [rbt12,         setRbt12]         = useState(300000)
  const [lucroEstimado, setLucroEstimado] = useState(0.25)
  const [ncmId,         setNcmId]         = useState('9505')
  const [ncmsLista,     setNcmsLista]     = useState(NCMS_PADRAO)
  const [canalKey,      setCanalKey]      = useState('shopee_ate79')
  const [estadoUF,      setEstadoUF]      = useState('SP')
  const [tab,           setTab]           = useState<'mei'|'simples'|'presumido'|'real'>('simples')
  const [cnpjInput,     setCnpjInput]     = useState('')
  const [cnpjData,      setCnpjData]      = useState<any>(null)
  const [cnpjLoading,   setCnpjLoading]   = useState(false)
  const [cnpjError,     setCnpjError]     = useState('')
  const [ncmBusca,      setNcmBusca]      = useState('')
  const [ncmLoading,    setNcmLoading]    = useState(false)
  const [ncmError,      setNcmError]      = useState('')

  const ncm       = ncmsLista.find(n => n.id === ncmId) ?? ncmsLista[0]
  const canal     = CANAIS.find(c => c.key === canalKey)!
  const estadoSel = ESTADOS.find(e => e.uf === estadoUF) ?? ESTADOS.find(e => e.uf === 'SP')!
  const icmsAliq  = estadoSel.icms
  const icmsValor = receita * icmsAliq
  const canalValor = receita * canal.taxa + canal.fixo

  const simples        = calcSimples(rbt12, receita)
  const dasTotal       = simples.das
  const presumido      = calcPresumido(receita)
  const presumidoTotal = presumido.total + icmsValor
  const real           = calcReal(receita, lucroEstimado)
  const realTotal      = real.total + icmsValor

  const totalMEI = MEI_DAS_MENSAL + canalValor
  const totalS   = dasTotal + canalValor
  const totalP   = presumidoTotal + canalValor
  const totalR   = realTotal + canalValor

  const faixaAtual = FAIXAS_RECOMENDACAO.find(f => rbt12 >= f.faixaMin && rbt12 < f.faixaMax) ?? FAIXAS_RECOMENDACAO[FAIXAS_RECOMENDACAO.length-1]

  async function buscarCNPJ() {
    const cnpj = cnpjInput.replace(/\D/g,'')
    if (cnpj.length !== 14) { setCnpjError('CNPJ deve ter 14 dígitos'); return }
    setCnpjLoading(true); setCnpjError(''); setCnpjData(null)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      if (!res.ok) throw new Error('CNPJ não encontrado')
      setCnpjData(await res.json())
    } catch(e:any) { setCnpjError(e.message || 'Erro ao consultar CNPJ') }
    finally { setCnpjLoading(false) }
  }

  async function buscarNCM() {
    if (!ncmBusca.trim()) return
    setNcmLoading(true); setNcmError('')
    try {
      const res = await fetch('/api/precificacao/ncm', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({produto:ncmBusca})
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      if (data.ncms?.length) {
        setNcmsLista([...data.ncms, ...NCMS_PADRAO.filter((n:any) => !data.ncms.find((p:any) => p.id === n.id))])
        setNcmId(data.ncms[0].id)
      } else { setNcmError(data.mensagem || 'Nenhum NCM encontrado.') }
    } catch(e:any) { setNcmError(e.message || 'Erro ao buscar NCM.') }
    finally { setNcmLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">⚖️ Oráculo Contábil</h1>
        <p className="text-gray-500 text-sm mt-1">
          Simulador de carga tributária por regime e canal. <strong>Caráter orientativo — consulte seu contador.</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* Painel esquerdo — parâmetros */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-4">⚙ Parâmetros</p>
            <Slider label="Receita do mês" value={receita} min={1000} max={100000} step={500} formatFn={fmt} onChange={setReceita}/>
            <Slider label="Faturamento anual (RBT12)" value={rbt12} min={50000} max={4800000} step={10000}
              formatFn={fmt} onChange={setRbt12} sublabel="Para calcular faixa do Simples Nacional"/>
            <Slider label="Margem líquida estimada" value={lucroEstimado} min={0.05} max={0.60} step={0.01}
              formatFn={(v:number) => `${(v*100).toFixed(0)}%`} onChange={setLucroEstimado} sublabel="Para Lucro Real"/>
          </div>

          {/* Canal */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">🛒 Canal de Venda</p>
            {[
              {grupo:'Shopee', filter:(k:string)=>k.startsWith('shopee')},
              {grupo:'Mercado Livre', filter:(k:string)=>k.startsWith('ml')},
              {grupo:'Elo7', filter:(k:string)=>k.startsWith('elo7')},
              {grupo:'Outros', filter:(k:string)=>!k.startsWith('shopee')&&!k.startsWith('ml')&&!k.startsWith('elo7')},
            ].map(g => (
              <div key={g.grupo}>
                <p className="text-xs text-gray-400 font-semibold uppercase mt-3 mb-1">{g.grupo}</p>
                {CANAIS.filter(c => g.filter(c.key)).map(c => (
                  <div key={c.key} onClick={() => setCanalKey(c.key)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border-2 mb-1.5 transition-all ${
                      canalKey===c.key ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                    }`}>
                    <p className={`text-xs font-semibold ${canalKey===c.key?'text-orange-700':'text-gray-700'}`}>{c.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{(c.taxa*100).toFixed(0)}%{c.fixo>0?`+R$${c.fixo.toFixed(0)}`:''}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Estado */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">🗺 Estado do Vendedor</p>
            <select value={estadoUF} onChange={e => setEstadoUF(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {ESTADOS.map(e => <option key={e.uf} value={e.uf}>{e.uf} — {e.nome} ({(e.icms*100).toFixed(1)}%)</option>)}
            </select>
            <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
              ICMS {estadoUF}: {(icmsAliq*100).toFixed(1)}% → {fmt(icmsValor)}/mês
            </div>
          </div>
        </div>

        {/* Painel direito — resultados */}
        <div className="space-y-4">
          {/* Tabs de regime */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-4">📊 Detalhamento por Regime</p>
            <div className="flex gap-2 mb-5 flex-wrap">
              {[
                {key:'mei',       label:'MEI',            cor:'bg-yellow-500 text-white', inativo:'border border-yellow-300 text-yellow-700'},
                {key:'simples',   label:'Simples Nac.',   cor:'bg-green-600 text-white',  inativo:'border border-green-300 text-green-700'},
                {key:'presumido', label:'Lucro Presumido',cor:'bg-blue-600 text-white',   inativo:'border border-blue-300 text-blue-700'},
                {key:'real',      label:'Lucro Real',     cor:'bg-purple-600 text-white', inativo:'border border-purple-300 text-purple-700'},
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tab===t.key ? t.cor : t.inativo+' bg-white hover:opacity-80'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab==='mei' && (
              <div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-xs text-yellow-800">
                  <p className="font-bold">MEI — Microempreendedor Individual</p>
                  <p className="mt-1">Taxa fixa mensal independente do faturamento. Limite: R$ 81.000/ano.</p>
                </div>
                <TribLine label="DAS-MEI (taxa fixa)" valor={MEI_DAS_MENSAL} total={MEI_DAS_MENSAL} color="#f59e0b"/>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">Total DAS-MEI</span>
                  <span className="text-lg font-bold font-mono text-yellow-700">{fmt(MEI_DAS_MENSAL)}</span>
                </div>
              </div>
            )}

            {tab==='simples' && (
              <div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                    Anexo II — Faixa {simples.idx+1}/6 · {simples.faixa.label}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">Alíquota Nominal</span><span className="font-mono">{pct(simples.faixa.nominal)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Parcela a Deduzir</span><span className="font-mono">{fmt(simples.faixa.deducao)}</span></div>
                  <div className="flex justify-between pt-1 border-t border-gray-200">
                    <span className="text-green-700 font-bold">Alíquota Efetiva</span>
                    <span className="font-mono font-bold text-green-700 text-base">{pct(simples.aliq)}</span>
                  </div>
                </div>
                <TribLine label="IRPJ"             valor={dasTotal*simples.rep.irpj}   total={dasTotal} color="#5c9fe0"/>
                <TribLine label="CSLL"             valor={dasTotal*simples.rep.csll}   total={dasTotal} color="#9b7fe8"/>
                <TribLine label="COFINS"           valor={dasTotal*simples.rep.cofins} total={dasTotal} color="#e08c5c"/>
                <TribLine label="PIS/Pasep"        valor={dasTotal*simples.rep.pis}    total={dasTotal} color="#5ce0c8"/>
                <TribLine label="CPP (INSS)"       valor={dasTotal*simples.rep.cpp}    total={dasTotal} color="#c0e05c"/>
                <TribLine label={`ICMS ${estadoUF} (no DAS)`} valor={dasTotal*simples.rep.icms} total={dasTotal} color="#3ecf8e"/>
                <TribLine label="IPI"              valor={dasTotal*simples.rep.ipi}    total={dasTotal} color="#f0c040"/>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">Total DAS</span>
                  <span className="text-lg font-bold font-mono text-green-700">{fmt(dasTotal)}</span>
                </div>
              </div>
            )}

            {tab==='presumido' && (
              <div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs space-y-1">
                  <p className="text-gray-500">IRPJ: 8% presunção × 15% = <span className="text-blue-600 font-bold">1,20%</span> da receita</p>
                  <p className="text-gray-500">CSLL: 12% presunção × 9% = <span className="text-blue-600 font-bold">1,08%</span> da receita</p>
                </div>
                <TribLine label="IRPJ (8% × 15%)" valor={presumido.irpj}   total={presumidoTotal} color="#5c9fe0"/>
                <TribLine label="CSLL (12% × 9%)" valor={presumido.csll}   total={presumidoTotal} color="#9b7fe8"/>
                <TribLine label="PIS (0,65%)"      valor={presumido.pis}    total={presumidoTotal} color="#5ce0c8"/>
                <TribLine label="COFINS (3%)"      valor={presumido.cofins} total={presumidoTotal} color="#e08c5c"/>
                <TribLine label={`ICMS ${estadoUF} (${(icmsAliq*100).toFixed(1)}%)`} valor={icmsValor} total={presumidoTotal} color="#3ecf8e"/>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">Total impostos</span>
                  <span className="text-lg font-bold font-mono text-blue-700">{fmt(presumidoTotal)}</span>
                </div>
              </div>
            )}

            {tab==='real' && (
              <div>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs">
                  <p className="text-gray-500">Lucro estimado: <strong>{fmt(receita*lucroEstimado)}</strong> ({(lucroEstimado*100).toFixed(0)}% da receita)</p>
                  <p className="text-gray-400 mt-1">PIS/COFINS não-cumulativos — possibilidade de créditos sobre insumos.</p>
                </div>
                <TribLine label="IRPJ (15% sobre lucro)"  valor={real.irpj}   total={realTotal} color="#5c9fe0"/>
                <TribLine label="CSLL (9% sobre lucro)"   valor={real.csll}   total={realTotal} color="#9b7fe8"/>
                <TribLine label="PIS (1,65%)"             valor={real.pis}    total={realTotal} color="#5ce0c8"/>
                <TribLine label="COFINS (7,6%)"           valor={real.cofins} total={realTotal} color="#e08c5c"/>
                <TribLine label={`ICMS ${estadoUF} (${(icmsAliq*100).toFixed(1)}%)`} valor={icmsValor} total={realTotal} color="#3ecf8e"/>
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-700">
                  <p className="font-bold mb-1">💡 Créditos PIS/COFINS</p>
                  <p>Você pode tomar créditos sobre insumos (papel, tinta, etc.), reduzindo o imposto real.</p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
                  <span className="text-sm text-gray-600">Total impostos</span>
                  <span className="text-lg font-bold font-mono text-purple-700">{fmt(realTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Resultado final */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-4">🧾 Resultado Final — {canal.label}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-bold text-red-600 mb-1">Comissão canal</p>
                <p className="text-xl font-bold font-mono text-red-600">{fmt(canalValor)}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-bold text-green-700 mb-1">Receita Líquida ({tab.toUpperCase()})</p>
                <p className={`text-xl font-bold font-mono ${receita-(tab==='mei'?totalMEI:tab==='simples'?totalS:tab==='presumido'?totalP:totalR)>=0?'text-green-700':'text-red-600'}`}>
                  {fmt(receita-(tab==='mei'?totalMEI:tab==='simples'?totalS:tab==='presumido'?totalP:totalR))}
                </p>
              </div>
            </div>
            {ncm && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <p className="font-bold">⚖️ NCM {ncmId} — {ncm.nome}</p>
                <p className="mt-1 text-gray-600">{ncm.nota}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 text-center mt-3 italic">Simulação orientativa · Consulte sempre um contador habilitado</p>
          </div>
        </div>
      </div>

      {/* Recomendação por faturamento */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">🎯 Melhor Regime por Volume de Faturamento</p>
            <p className="text-sm text-gray-500 mt-1">Estudo comparativo — orientação geral para planejamento tributário</p>
          </div>
          <div className={`px-4 py-2 rounded-xl border-2 text-center ${faixaAtual.bg} ${faixaAtual.border}`}>
            <p className="text-xs text-gray-500">Sua faixa atual</p>
            <p className={`text-sm font-bold ${faixaAtual.cor}`}>{faixaAtual.recomendado}</p>
            <p className="text-xs text-gray-400">{faixaAtual.sublabel}</p>
          </div>
        </div>
        <div className="space-y-3">
          {FAIXAS_RECOMENDACAO.map((f, i) => {
            const ativa = rbt12 >= f.faixaMin && rbt12 < f.faixaMax
            return (
              <div key={i} className={`rounded-xl border-2 p-4 transition-all ${ativa ? f.border+' '+f.bg+' shadow-sm' : 'border-gray-100 bg-gray-50/30'}`}>
                <div className="flex flex-col md:flex-row md:items-start gap-3">
                  <div className="md:w-48 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      {ativa && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0"/>}
                      <p className={`text-sm font-bold ${ativa ? f.cor : 'text-gray-600'}`}>{f.label}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 ml-4">{f.sublabel}</p>
                    <div className={`mt-2 ml-4 inline-block px-2 py-0.5 rounded-full text-xs font-bold ${ativa ? f.bg+' '+f.cor+' border '+f.border : 'bg-gray-100 text-gray-500'}`}>
                      {f.recomendado}
                    </div>
                    {f.aliquotaEfetiva && (
                      <p className={`text-xs mt-1 ml-4 font-mono ${ativa ? f.cor : 'text-gray-400'}`}>~{f.aliquotaEfetiva}</p>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className={`text-xs leading-relaxed ${ativa ? 'text-gray-700' : 'text-gray-500'}`}>
                      <strong>Por quê:</strong> {f.razao}
                    </p>
                    {f.atencao && <p className={`text-xs ${ativa ? 'text-orange-600' : 'text-gray-400'}`}>⚠️ {f.atencao}</p>}
                    {f.alternativa && <p className={`text-xs ${ativa ? 'text-blue-600' : 'text-gray-400'}`}>🔄 Alternativa: {f.alternativa}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 text-center mt-4 italic">
          Recomendações baseadas em alíquotas vigentes 2025 · Cada caso é único — consulte um contador
        </p>
      </div>

      {/* Ferramentas: CNPJ + NCM */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">🏢 Consulta CNPJ</p>
          <div className="flex gap-2">
            <input value={cnpjInput} onChange={e => setCnpjInput(e.target.value)} placeholder="00.000.000/0000-00"
              maxLength={18} onKeyDown={e => e.key==='Enter' && buscarCNPJ()}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"/>
            <button onClick={buscarCNPJ} disabled={cnpjLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
              {cnpjLoading ? '...' : 'Buscar'}
            </button>
          </div>
          {cnpjError && <p className="text-xs text-red-500 mt-2">{cnpjError}</p>}
          {cnpjData && (
            <div className="mt-3 space-y-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <p className="font-bold text-gray-800 text-sm">{cnpjData.razao_social}</p>
                {cnpjData.nome_fantasia && <p className="text-gray-500">Fantasia: <span className="font-medium text-gray-700">{cnpjData.nome_fantasia}</span></p>}
                <p className="text-gray-500">CNPJ: <span className="font-mono font-medium text-gray-700">{fmtCNPJ(cnpjData.cnpj)}</span></p>
                <p className="text-gray-500">Situação: <span className={`font-bold ${cnpjData.descricao_situacao_cadastral==='ATIVA'?'text-green-600':'text-red-500'}`}>{cnpjData.descricao_situacao_cadastral}</span></p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-3">🔍 Identificar NCM do Produto</p>
          <p className="text-xs text-gray-400 mb-3">Descreva o produto para encontrar o NCM correto.</p>
          <div className="flex gap-2 mb-2">
            <input value={ncmBusca} onChange={e => setNcmBusca(e.target.value)}
              placeholder="Ex: laço cetim, cofrinho papelão..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              onKeyDown={e => e.key==='Enter' && buscarNCM()}/>
            <button onClick={buscarNCM} disabled={ncmLoading||!ncmBusca.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap">
              {ncmLoading ? '...' : 'Buscar'}
            </button>
          </div>
          {ncmError && <p className="text-xs text-red-500 mt-1">{ncmError}</p>}
          {ncmLoading && <div className="bg-orange-50 rounded-lg p-3 text-xs text-orange-600 animate-pulse">🔍 Consultando base tributária...</div>}
          <div className="mt-3 space-y-2">
            {ncmsLista.slice(0,5).map(n => (
              <div key={n.id} onClick={() => setNcmId(n.id)}
                className={`p-2.5 rounded-xl cursor-pointer border-2 transition-all ${ncmId===n.id?'border-green-400 bg-green-50':'border-gray-100 hover:border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold ${ncmId===n.id?'text-green-700':'text-gray-700'}`}>{n.nome}</p>
                  <span className="text-xs font-mono text-gray-400 ml-2 flex-shrink-0">{n.id}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">ICMS: {(n.icmsInterno*100).toFixed(0)}% · IPI: {(n.ipi*100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
          {ncmId && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mt-3">✅ NCM {ncmId} selecionado</p>}
        </div>
      </div>
    </div>
  )
}
