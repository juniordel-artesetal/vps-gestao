// Termo e Política do Programa de Parceiras — página PÚBLICA (não gateada por flag: precisa
// abrir a qualquer tempo, é linkada do aceite do cadastro e dos e-mails). Server component,
// só leitura estática. A versão vem de lib/termosParceiras (mesma que o aceite grava).
import type { Metadata } from 'next'
import { TERMO_PARCEIRAS_VERSAO, TERMO_PARCEIRAS_VIGENCIA } from '@/lib/termosParceiras'

export const metadata: Metadata = {
  title: 'Termo do Programa de Parceiras · SOA',
  description: 'Regras do Programa de Parceiras do SOA: comissões, licença de cortesia, divulgação e autorização de uso de imagem e conteúdo.',
}

// ——— blocos reutilizáveis ———
function Clausula({ n, titulo, chave, children }: { n: number; titulo: string; chave?: boolean; children: React.ReactNode }) {
  return (
    <section id={`c${n}`} className="pt-8 scroll-mt-6">
      <h2 className="flex items-baseline gap-3 text-lg sm:text-xl font-bold text-gray-900 dark:text-white text-balance">
        <span className={`text-sm font-bold tabular-nums shrink-0 ${chave ? 'text-amber-600 dark:text-amber-400' : 'text-orange-500'}`}>{n}</span>
        <span className={chave ? 'text-amber-700 dark:text-amber-300' : ''}>{titulo}</span>
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{children}</div>
    </section>
  )
}
function Destaque({ tag, children }: { tag: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-4 space-y-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 m-0">✦ {tag}</p>
      {children}
    </div>
  )
}
const olCls = 'list-decimal pl-6 space-y-2 marker:text-gray-400 dark:marker:text-gray-500 marker:text-sm'
const subCls = 'list-[lower-alpha] pl-6 space-y-1.5 mt-2 marker:text-gray-400'
const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>

export default function TermosParceirasPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <article className="max-w-3xl mx-auto">
        {/* Cabeçalho */}
        <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">SOA · Sistema de Organização de Ateliês</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white leading-tight text-balance">Termo do Programa de Parceiras</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl">
            As regras da nossa parceria — comissões, licença de cortesia, a divulgação combinada e a autorização de uso de imagem e conteúdo. Feito pra ficar tudo claro entre a gente, sem surpresa.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Versão <b className="text-gray-700 dark:text-gray-200">{TERMO_PARCEIRAS_VERSAO}</b></span>
            <span>Vigência a partir de <b className="text-gray-700 dark:text-gray-200">{TERMO_PARCEIRAS_VIGENCIA}</b></span>
            <span>Operado por <b className="text-gray-700 dark:text-gray-200">SOA SOFTWARES</b> · CNPJ 68.033.068/0001-00</span>
          </div>
        </header>

        {/* Preâmbulo */}
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 space-y-2.5">
          <p>
            Este Termo rege a relação entre <B>você (a "Parceira")</B> e o <B>SOA</B>, plataforma de gestão para ateliês e negócios de artesanato, operada por <B>EDSON JUNIOR SANTOS COSTA DESENVOLVIMENTO DE SOFTWARE LTDA</B> (nome fantasia <B>SOA SOFTWARES</B>), microempresa inscrita no CNPJ sob o nº <B>68.033.068/0001-00</B>, com sede na Rua Pais Leme, nº 215, Conj. 1713, Pinheiros, São Paulo/SP, CEP 05424-150 (o "SOA" ou "nós"), acessível em <a href="https://usesoa.com.br" className="text-orange-600 dark:text-orange-400 underline">usesoa.com.br</a>.
          </p>
          <p>
            Ao concluir seu cadastro no Programa de Parceiras e marcar o aceite, você declara que <B>leu, entendeu e concorda</B> com todas as condições abaixo, inclusive as autorizações de divulgação e de uso de imagem e conteúdo. A aceitação é eletrônica e tem plena validade.
          </p>
        </div>

        <Clausula n={1} titulo="Definições">
          <ol className={olCls}>
            <li><B>Parceira</B>: pessoa que aderiu ao Programa de Parceiras, normalmente uma criadora de conteúdo/influenciadora do universo do artesanato, com quem combinamos a divulgação do SOA.</li>
            <li><B>Indicada</B>: pessoa que se cadastra no SOA por meio do link ou cupom da Parceira.</li>
            <li><B>Link de indicação</B>: endereço pessoal da Parceira no formato <code className="text-[13px]">usesoa.com.br/r/{'{cupom}'}</code>, usado para atribuir as indicações a ela.</li>
            <li><B>Comissão</B>: valor devido à Parceira sobre as assinaturas pagas por suas Indicadas, nos termos da Cláusula 5.</li>
            <li><B>Licença de cortesia</B>: acesso gratuito da Parceira ao SOA enquanto durar a parceria, nos termos da Cláusula 6.</li>
            <li><B>Conteúdo</B>: publicações (Stories, Reels, vídeos, fotos, textos) em que a Parceira mostra, cita ou marca o SOA.</li>
          </ol>
        </Clausula>

        <Clausula n={2} titulo="Objeto do Programa">
          <p>O Programa de Parceiras permite que a Parceira <B>indique o SOA</B> para o seu público e receba comissão pelas assinaturas geradas, além de usar o SOA gratuitamente enquanto for parceira. Em contrapartida, a Parceira <B>divulga o SOA de forma espontânea e verdadeira</B> em suas redes, conforme a Cláusula 7. A adesão é voluntária e não gera qualquer vínculo além do previsto aqui.</p>
        </Clausula>

        <Clausula n={3} titulo="Adesão e elegibilidade">
          <ol className={olCls}>
            <li>Podem aderir pessoas maiores de 18 anos, com perfil ativo em redes sociais e conteúdo compatível com o público do SOA (artesanato, ateliês e afins).</li>
            <li>Os dados informados no cadastro (nome, e-mail, WhatsApp, @ do Instagram, dados de recebimento) devem ser <B>verdadeiros e atualizados</B>. Informações falsas podem levar ao encerramento imediato e à perda de comissões.</li>
            <li>A aprovação da parceria é a critério do SOA, que pode recusar ou encerrar adesões que não se enquadrem no espírito do Programa.</li>
          </ol>
        </Clausula>

        <Clausula n={4} titulo="Como funciona a indicação">
          <ol className={olCls}>
            <li>A Parceira recebe um <B>link de indicação exclusivo</B> (<code className="text-[13px]">usesoa.com.br/r/{'{cupom}'}</code>). Quem se cadastra por ele (ou digita o cupom no cadastro) fica vinculado à Parceira.</li>
            <li>Toda Indicada ganha um <B>período de teste gratuito de 30 dias</B> — um benefício a mais para a Parceira oferecer.</li>
            <li>A atribuição da indicação segue o registro do sistema no momento do cadastro da Indicada. Indicações sem vínculo registrado não geram comissão.</li>
          </ol>
        </Clausula>

        <Clausula n={5} titulo="Comissões e pagamento">
          <ol className={olCls}>
            <li>A Parceira faz jus a comissão <B>recorrente</B> sobre cada assinatura paga por suas Indicadas, enquanto a assinatura permanecer ativa e adimplente:
              <ol className={subCls}>
                <li><B>30%</B> sobre o valor do plano mensal;</li>
                <li><B>40%</B> sobre o valor do plano anual.</li>
              </ol>
            </li>
            <li>O pagamento é feito de forma <B>automática, direto na conta da Parceira</B>, por meio de repartição (split) no provedor de pagamentos (Asaas), a cada assinatura paga pela Indicada. Para receber, a Parceira deve cadastrar sua própria conta (walletId) no painel <a href="https://usesoa.com.br/parceira" className="text-orange-600 dark:text-orange-400 underline">usesoa.com.br/parceira</a>. Enquanto não houver conta válida cadastrada, as comissões podem ficar pendentes até a regularização.</li>
            <li>Não há comissão sobre: períodos de teste gratuito, meses não pagos, valores estornados, cancelados, com chargeback ou reembolsados. Se um pagamento que gerou comissão for posteriormente estornado, o valor correspondente pode ser <B>compensado ou descontado</B> de comissões futuras.</li>
            <li>Os valores dos planos e os percentuais podem ser reajustados pelo SOA; a Parceira será avisada, e o novo percentual vale para as competências seguintes.</li>
            <li>Tributos e obrigações fiscais sobre os valores recebidos são de <B>responsabilidade da Parceira</B>. O SOA não retém nem recolhe tributos por ela.</li>
          </ol>
        </Clausula>

        <Clausula n={6} titulo="Licença de cortesia do SOA">
          <ol className={olCls}>
            <li>Enquanto for parceira ativa, a Parceira <B>usa o SOA gratuitamente</B> (licença de cortesia). Trata-se de uma cortesia, e não de um plano contratado — não há cobrança enquanto durar a parceria.</li>
            <li>A cortesia é <B>pessoal e intransferível</B>, vinculada à conta da Parceira, e destinada ao uso real no dia a dia do ateliê dela (é isso que dá autenticidade à divulgação).</li>
            <li>O SOA pode <B>encerrar a cortesia</B> a qualquer tempo — por encerramento da parceria ou por descumprimento deste Termo. Nesse caso, a Parceira terá um <B>período de carência de 14 dias</B> para, se quiser, assinar um plano normalmente e manter o acesso. Seus dados (pedidos, clientes, cálculos) permanecem preservados.</li>
            <li>O encerramento da cortesia <B>não encerra, por si só, a condição de parceira</B>: a Parceira pode continuar indicando e recebendo comissão (Cláusula 5), salvo se a parceria também for encerrada.</li>
          </ol>
        </Clausula>

        <Clausula n={7} titulo="Obrigações da Parceira" chave>
          <Destaque tag="Contrapartida principal">
            <p className="text-gray-700 dark:text-gray-200 m-0">Como contrapartida da licença de cortesia e do programa, a Parceira se compromete a <B>usar o SOA no dia a dia</B> do seu ateliê e a <B>divulgá-lo com naturalidade em suas redes, marcando e mencionando o perfil oficial do SOA (@) nos Stories e Reels</B> em que aparecer usando ou falando do sistema.</p>
            <p className="text-gray-700 dark:text-gray-200 m-0">A marcação/menção é o que permite que a gente acompanhe e <B>reposte o conteúdo</B> (veja a Cláusula 8) — é parte essencial da parceria.</p>
          </Destaque>
          <p>Além disso, a Parceira se compromete a:</p>
          <ol className={olCls}>
            <li>Divulgar o SOA de forma <B>honesta e verdadeira</B>, sem prometer funções ou resultados que o sistema não ofereça, e deixando claro quando se tratar de conteúdo de parceria/publicidade, conforme as regras das plataformas e do CONAR.</li>
            <li>Manter conduta compatível com a imagem do SOA — sem discurso de ódio, conteúdo ilegal, ofensivo, discriminatório ou que exponha terceiros indevidamente.</li>
            <li>Não enviar spam, não comprar seguidores/engajamento para inflar indicações e não induzir cadastros falsos.</li>
            <li>Respeitar as leis aplicáveis e as regras das redes sociais onde publicar.</li>
            <li>Manter seus dados de cadastro e de recebimento atualizados.</li>
            <li>Sem exclusividade: a Parceira pode ter outras parcerias, desde que não conflitem com a divulgação combinada nem induzam confusão com a marca SOA.</li>
          </ol>
        </Clausula>

        <Clausula n={8} titulo="Autorização de uso de imagem, voz, nome e conteúdo" chave>
          <Destaque tag="Autorização de imagem e conteúdo">
            <p className="text-gray-700 dark:text-gray-200 m-0">A Parceira <B>autoriza o SOA</B>, de forma <B>gratuita, não exclusiva e por prazo determinado</B> (durante a parceria e por até <B>24 meses após</B> o seu término), a <B>reproduzir, exibir, repostar, compartilhar, editar e adaptar</B> — no perfil oficial, site, redes sociais, anúncios e materiais de divulgação do SOA — o Conteúdo em que ela marcar ou mencionar o SOA (Stories, Reels, vídeos, fotos e textos), bem como o seu <B>nome, @ de usuária, imagem, voz e depoimentos</B> ali contidos.</p>
            <p className="text-gray-700 dark:text-gray-200 m-0">A autorização abrange <B>todas as mídias</B> (digitais e impressas) e vale para o <B>território nacional e internacional</B>, sem que isso gere qualquer pagamento adicional além das comissões previstas neste Termo.</p>
          </Destaque>
          <ol className={olCls}>
            <li>A Parceira declara ser <B>titular ou detentora dos direitos</B> sobre o Conteúdo que publicar e marcar o SOA, respondendo por eventuais direitos de terceiros que apareçam nele (por exemplo, outras pessoas nas imagens).</li>
            <li>O SOA se compromete a usar o Conteúdo de forma <B>respeitosa</B>, sem distorcer o sentido original, sem associá-lo a conteúdo ofensivo e preservando os créditos à Parceira sempre que possível.</li>
            <li>A Parceira pode <B>revogar</B> esta autorização a qualquer tempo, por escrito (e-mail ao SOA). A revogação tem <B>efeitos para o futuro</B>: o SOA deixa de veicular novos usos em prazo razoável, mas materiais já publicados ou impressos antes da revogação podem permanecer.</li>
            <li>Esta autorização é celebrada em caráter <B>gratuito e irrevogável quanto aos usos já realizados</B>, nos termos do art. 20 do Código Civil e da legislação de direitos de imagem, servindo este aceite como termo de cessão de direito de uso de imagem e conteúdo.</li>
          </ol>
        </Clausula>

        <Clausula n={9} titulo="Proteção de dados (LGPD)">
          <ol className={olCls}>
            <li>O SOA trata os dados pessoais da Parceira (nome, e-mail, WhatsApp, @, dados de recebimento) para <B>operar o Programa</B> — cadastro, pagamento de comissões, comunicação e cumprimento deste Termo —, com base na <B>execução do contrato</B> (art. 7º, V da LGPD). O uso de imagem/conteúdo da Cláusula 8 se apoia no <B>consentimento</B> aqui manifestado.</li>
            <li>Os dados não são vendidos. Podem ser compartilhados com prestadores estritamente necessários (ex.: provedor de pagamento), sob obrigação de confidencialidade.</li>
            <li>A Parceira pode exercer seus direitos de titular (acesso, correção, revogação de consentimento, eliminação, entre outros) pelo e-mail de contato do SOA. A eliminação de dados essenciais pode implicar o encerramento da parceria.</li>
            <li>Os dados são mantidos enquanto durar a parceria e pelos prazos legais aplicáveis após o encerramento.</li>
          </ol>
        </Clausula>

        <Clausula n={10} titulo="Propriedade intelectual">
          <ol className={olCls}>
            <li>A marca, o nome, o logotipo e os materiais do SOA são de sua titularidade. A Parceira pode usá-los <B>apenas para divulgar o SOA</B>, de forma leal, sem alterá-los de modo que desvalorize a marca.</li>
            <li>É vedado registrar marca, domínio, perfil ou usar nome que se confunda com o SOA, ou se apresentar como representante/filial oficial sem autorização escrita.</li>
            <li>O conteúdo criado pela Parceira continua sendo dela; ao SOA cabe apenas a licença de uso da Cláusula 8.</li>
          </ol>
        </Clausula>

        <Clausula n={11} titulo="Boa-fé e condutas vedadas">
          <p>A parceria se baseia em boa-fé. Configuram descumprimento, sujeitando a Parceira à <B>suspensão, perda das comissões relacionadas e encerramento</B>:</p>
          <ol className={olCls}>
            <li>Fraude na indicação — autoindicação, cadastros falsos, uso de dados de terceiros, manipulação de cliques ou pagamentos.</li>
            <li>Divulgação enganosa, prometendo o que o sistema não faz, ou uso da marca para práticas ilícitas.</li>
            <li>Uso da licença de cortesia por terceiros ou para finalidade diversa do uso pessoal.</li>
            <li>Qualquer conduta que prejudique a imagem, a segurança ou os direitos do SOA, de suas usuárias ou de terceiros.</li>
          </ol>
        </Clausula>

        <Clausula n={12} titulo="Vigência e encerramento">
          <ol className={olCls}>
            <li>Este Termo vigora por <B>prazo indeterminado</B>, a partir do aceite.</li>
            <li><B>Qualquer das partes</B> pode encerrar a parceria a qualquer tempo, sem multa, mediante comunicação simples (inclusive por e-mail ou pelo próprio sistema).</li>
            <li>Encerrada a parceria: a licença de cortesia se encerra com a carência de 14 dias (Cláusula 6.3); comissões já apuradas e devidas até a data do encerramento são honradas; deixa de haver comissão sobre pagamentos posteriores ao encerramento.</li>
            <li>As autorizações de uso já concedidas na Cláusula 8 permanecem válidas nos limites ali previstos, mesmo após o encerramento.</li>
          </ol>
        </Clausula>

        <Clausula n={13} titulo="Natureza da relação">
          <p>Este Termo <B>não cria vínculo empregatício, societário, de representação comercial ou de agência</B> entre a Parceira e o SOA. Não há subordinação, jornada, salário nem exclusividade. A Parceira atua de forma autônoma e independente, respondendo por seus próprios custos, tributos e obrigações.</p>
        </Clausula>

        <Clausula n={14} titulo="Responsabilidades e garantias">
          <ol className={olCls}>
            <li>O SOA se empenha para manter a plataforma e os pagamentos funcionando, mas não garante disponibilidade ininterrupta nem resultados de vendas/indicações.</li>
            <li>O SOA não responde por condutas da Parceira perante terceiros nem por conteúdo por ela publicado. A Parceira se responsabiliza por suas publicações e por manter suas contas em conformidade com as leis e regras das plataformas.</li>
            <li>Cada parte responde pelos danos que causar por dolo ou culpa, nos limites da lei.</li>
          </ol>
        </Clausula>

        <Clausula n={15} titulo="Alterações do Termo">
          <p>O SOA pode atualizar este Termo para refletir mudanças no Programa, na legislação ou nas operações. Alterações relevantes serão comunicadas (por e-mail ou no sistema). O <B>uso continuado</B> do Programa após a comunicação vale como aceite da nova versão. Se a Parceira não concordar, pode encerrar a parceria conforme a Cláusula 12.</p>
        </Clausula>

        <Clausula n={16} titulo="Disposições gerais">
          <ol className={olCls}>
            <li>As comunicações entre as partes podem ser feitas por <B>e-mail</B> e pelos canais do sistema, considerando-se válidas as enviadas aos endereços cadastrados.</li>
            <li>A eventual tolerância quanto a qualquer descumprimento não significa renúncia a direitos.</li>
            <li>Se alguma cláusula for considerada inválida, as demais permanecem em vigor.</li>
            <li>Este Termo é regido pelas <B>leis brasileiras</B>. Fica eleito o foro da comarca de <B>São Paulo/SP</B> para dirimir controvérsias, com renúncia a qualquer outro.</li>
          </ol>
        </Clausula>

        {/* Aceite */}
        <div className="mt-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aceite</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
            Ao concluir o cadastro no Programa de Parceiras e marcar a caixa de aceite, a Parceira declara ter lido e concordado com este Termo em sua integralidade — incluindo a <B>obrigação de marcar/mencionar o SOA em Stories e Reels</B> (Cláusula 7) e a <B>autorização de uso de imagem, voz, nome e conteúdo</B> (Cláusula 8). O registro eletrônico do aceite (data, hora e identificação da conta) serve como prova da anuência.
          </p>
        </div>

        <footer className="mt-10 pt-5 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <B>SOA · Programa de Parceiras</B> — Termo v{TERMO_PARCEIRAS_VERSAO}. Dúvidas? Fale com a gente pelo suporte. 💛
        </footer>
      </article>
    </div>
  )
}
