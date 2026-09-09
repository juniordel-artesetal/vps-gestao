// Política de Privacidade — página PÚBLICA (https://www.usesoa.com.br/privacy).
// Requisito de LGPD e do questionário TikTok/Shopee. Server component, leitura estática.
// Identidade jurídica real (a mesma do Termo de Parceiras). Texto sem travessões e sem
// a palavra "ERP", conforme padrão do site.
import type { Metadata } from 'next'

const RAZAO_SOCIAL  = 'EDSON JUNIOR SANTOS COSTA DESENVOLVIMENTO DE SOFTWARE LTDA'
const NOME_FANTASIA = 'SOA SOFTWARES'
const CNPJ          = '68.033.068/0001-00'
const DPO_NOME      = 'Edson Junior Santos Costa'
const EMAIL_PRIV    = 'privacidade@usesoa.com.br'
const ATUALIZACAO   = '09/09/2026'

export const metadata: Metadata = {
  title: 'Política de Privacidade — SOA',
  description: 'Como o SOA (Sistema de Organização de Ateliês) coleta, usa e protege seus dados, e quais são os seus direitos sob a LGPD.',
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
const ul = 'list-disc pl-6 space-y-1.5 marker:text-gray-400 dark:marker:text-gray-500'

function Secao({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section id={`s${n}`} className="pt-8 scroll-mt-6">
      <h2 className="flex items-baseline gap-3 text-lg sm:text-xl font-bold text-gray-900 dark:text-white text-balance">
        <span className="text-sm font-bold tabular-nums shrink-0 text-orange-500">{n}</span>
        <span>{titulo}</span>
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <article className="max-w-3xl mx-auto">
        <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">SOA · Sistema de Organização de Ateliês</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white leading-tight text-balance">Política de Privacidade</h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-2xl">
            Como coletamos, usamos e protegemos seus dados, e quais são os seus direitos sob a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>Última atualização <b className="text-gray-700 dark:text-gray-200">{ATUALIZACAO}</b></span>
            <span>Operado por <b className="text-gray-700 dark:text-gray-200">{NOME_FANTASIA}</b> · CNPJ {CNPJ}</span>
          </div>
        </header>

        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-5 py-4 text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
          <p>
            O SOA (Sistema de Organização de Ateliês), operado por <B>{RAZAO_SOCIAL}</B> (nome fantasia <B>{NOME_FANTASIA}</B>), inscrito no CNPJ sob o nº <B>{CNPJ}</B>, respeita a sua privacidade e trata os dados pessoais de acordo com a LGPD. Esta política explica quais dados coletamos, como usamos e quais são os seus direitos.
          </p>
        </div>

        <Secao n={1} titulo="Quem é o controlador">
          <p>O SOA é o controlador dos dados de cadastro e uso da plataforma. Em relação aos dados que a artesã cadastra sobre os clientes dela, o SOA atua como operador, tratando esses dados em nome da artesã.</p>
        </Secao>

        <Secao n={2} titulo="Quais dados coletamos">
          <ul className={ul}>
            <li><B>Cadastro e conta:</B> nome, e-mail, telefone e dados do seu ateliê ou negócio.</li>
            <li><B>Uso da plataforma:</B> informações de produção, produtos, preços, pedidos, financeiro e configurações que você registra.</li>
            <li><B>Dados de clientes inseridos por você:</B> nome, contato e endereço dos seus clientes, quando você os cadastra para gerenciar pedidos.</li>
            <li><B>Integrações de marketplace:</B> quando você conecta uma loja (Shopee, TikTok Shop, Mercado Livre), recebemos dados de pedidos, produtos e da loja, conforme a autorização concedida.</li>
            <li><B>Pagamento:</B> processado por parceiros (por exemplo, plataformas de pagamento). Não armazenamos os dados completos do seu cartão.</li>
            <li><B>Dados técnicos e cookies:</B> informações de acesso e navegação, incluindo cookies essenciais e de medição.</li>
          </ul>
        </Secao>

        <Secao n={3} titulo="Para que usamos os dados e base legal">
          <p>Usamos os dados para fornecer e operar a plataforma, criar e gerenciar sua conta, processar sua assinatura, dar suporte, melhorar o serviço e cumprir obrigações legais. As bases legais incluem a execução do contrato, o cumprimento de obrigação legal, o legítimo interesse e o consentimento, quando aplicável.</p>
        </Secao>

        <Secao n={4} titulo="Compartilhamento">
          <p>Não vendemos seus dados. Compartilhamos apenas com prestadores que viabilizam o serviço (hospedagem, banco de dados, envio de e-mail e pagamento), com marketplaces quando você autoriza a integração, e com autoridades quando exigido por lei. Esses prestadores tratam os dados sob obrigações de confidencialidade e segurança.</p>
        </Secao>

        <Secao n={5} titulo="Cookies">
          <p>Usamos cookies essenciais para o funcionamento da plataforma e cookies de medição para entender o uso e melhorar o serviço. Você pode gerenciar cookies nas configurações do seu navegador.</p>
        </Secao>

        <Secao n={6} titulo="Armazenamento e segurança">
          <p>Os dados são armazenados principalmente no Brasil (banco de dados em São Paulo), e parte do processamento pela nossa infraestrutura de nuvem pode ocorrer nos Estados Unidos. Aplicamos medidas de segurança como criptografia em trânsito (TLS), criptografia em repouso, controle de acesso por privilégio mínimo, senhas protegidas e backups. Nenhum sistema é 100% imune, mas trabalhamos continuamente para proteger seus dados.</p>
        </Secao>

        <Secao n={7} titulo="Por quanto tempo guardamos">
          <p>Guardamos os dados pelo tempo necessário para prestar o serviço e cumprir obrigações legais. Ao encerrar a relação, excluímos ou devolvemos os dados sob nossa responsabilidade, respeitando prazos legais de retenção.</p>
        </Secao>

        <Secao n={8} titulo="Seus direitos (LGPD)">
          <p>Você pode solicitar: confirmação e acesso aos seus dados, correção, anonimização ou exclusão, portabilidade, informação sobre compartilhamento e revogação do consentimento. Para exercer, entre em contato pelo canal abaixo.</p>
        </Secao>

        <Secao n={9} titulo="Encarregado (DPO)">
          <p>Encarregado de Proteção de Dados: <B>{DPO_NOME}</B>. Contato: <a href={`mailto:${EMAIL_PRIV}`} className="text-orange-600 dark:text-orange-400 underline">{EMAIL_PRIV}</a>.</p>
        </Secao>

        <Secao n={10} titulo="Dados de crianças">
          <p>A plataforma é destinada a maiores de 18 anos e não é direcionada a crianças e adolescentes.</p>
        </Secao>

        <Secao n={11} titulo="Alterações">
          <p>Podemos atualizar esta política periodicamente. A data no topo indica a última atualização. Mudanças relevantes serão comunicadas.</p>
        </Secao>

        <Secao n={12} titulo="Contato">
          <p>Dúvidas sobre privacidade: <a href={`mailto:${EMAIL_PRIV}`} className="text-orange-600 dark:text-orange-400 underline">{EMAIL_PRIV}</a>. SOA (Sistema de Organização de Ateliês), {RAZAO_SOCIAL}, CNPJ {CNPJ}.</p>
        </Secao>

        <footer className="mt-10 pt-5 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
          <B>SOA · Política de Privacidade</B> · atualizada em {ATUALIZACAO}. Em conformidade com a LGPD (Lei nº 13.709/2018).
        </footer>
      </article>
    </div>
  )
}
