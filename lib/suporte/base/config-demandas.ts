import type { EntradaConhecimento } from '../tipos'

// Base de conhecimento RICA — Configurações, Demandas (freelancers) e Onboarding/Suporte.
// Escrita para artesãs LEIGAS: linguagem de amiga, passo a passo devagar, sem jargão.
// Fonte: telas reais do SOA (app/config/*, app/demandas/*, app/suporte, app/modulos, app/setup).

export const ENTRADAS: EntradaConhecimento[] = [

  // ═══════════════════════════════════════════════════════════════
  //  MÓDULO PESSOAL (add-on pago, privado por usuária)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'modulo-pessoal',
    modulo: 'Config',
    tela: 'Módulo Pessoal',
    caminho: 'Módulos → Pessoal',
    palavrasChave: 'módulo pessoal, meu pessoal, finanças pessoais, minhas contas pessoais, separar dinheiro pessoal do ateliê, tarefas pessoais, notas pessoais, quanto custa o pessoal, preço do módulo pessoal, r$5,90, add-on, assistente telegram, bot telegram pessoal, ativar pessoal, caixinhas, guardar dinheiro, privado, só meu',
    conteudo:
      '📍 ONDE FICA\nNo menu de Módulos aparece o card "Pessoal". Se você ainda não ativou, ele leva pra tela de ativação (Módulos → Pessoal → Ativar). É um add-on OPCIONAL e só a administradora (dona) vê/ativa.\n\n' +
      '💡 O QUE É\nÉ um espaço SÓ SEU, separado do ateliê, pra organizar a sua vida pessoal — ninguém da equipe vê. Tem: finanças pessoais completas (contas, lançamentos, caixinhas com metas, dashboard e relatório em PDF), tarefas e notas particulares (com imagens), e um assistente no Telegram onde você registra gastos/tarefas/notas por mensagem e recebe avisos de vencimento. Tudo privado, ligado à SUA conta.\n\n' +
      '💵 QUANTO CUSTA\nR$ 5,90 por mês — um add-on à parte da assinatura do ateliê. A cobrança é pelo Asaas (cartão/pix). Você pode cancelar quando quiser.\n\n' +
      '👣 COMO ATIVAR\n1. Menu → Módulos → card "Pessoal" (ou o aviso de novidade) → "Conhecer e ativar".\n2. Confirme o CPF e o pagamento de R$ 5,90/mês.\n3. Pronto: o "Pessoal" abre com as suas finanças, tarefas e notas.\n\n' +
      '💬 EXEMPLO SOFIA\n"O Módulo Pessoal é um cantinho só seu, querida — as SUAS finanças, tarefas e notas, longe das do ateliê e totalmente privadas. Dá até pra lançar gasto pelo Telegram! É um opcional de R$ 5,90 por mês; se quiser conhecer, vá em Módulos → Pessoal. E fica tranquila: cancela quando quiser."',
    faq: [
      { pergunta: 'O que é o Módulo Pessoal e quanto custa?', resposta: 'É um espaço só seu, separado do ateliê, pra cuidar da sua vida pessoal com privacidade: finanças pessoais (contas, lançamentos, caixinhas com metas, dashboard e relatório em PDF), tarefas e notas particulares, e um assistente no Telegram pra registrar gastos e receber avisos. Ninguém da sua equipe vê — é ligado à sua conta. Custa R$ 5,90 por mês, é um add-on opcional (à parte da assinatura do ateliê), e só a administradora ativa. Pra conhecer: Módulos → Pessoal. Cancela quando quiser.' },
      { pergunta: 'O Módulo Pessoal se mistura com o financeiro do ateliê?', resposta: 'Não, e essa é a graça dele! O Pessoal é totalmente separado: as contas, lançamentos e caixinhas de lá são SÓ seus e não aparecem no financeiro do ateliê (nem o contrário). É pra você organizar a sua vida pessoal sem embolar com o dinheiro do negócio. E é privado: mesmo que você tenha funcionárias no sistema, elas não veem o seu Pessoal.' },
      { pergunta: 'Paguei o Módulo Pessoal (pix ou boleto) e ele não liberou. O que faço?', resposta: 'Assim que o pagamento é confirmado, o Módulo Pessoal ativa AUTOMATICAMENTE — no pix costuma ser em minutos; no boleto, quando ele compensa (pode levar 1 a 2 dias úteis). Então, se você pagou por boleto há pouco, pode ser só a compensação bancária: aguarde a confirmação. MAS se o pagamento já consta como pago (pix confirmado, ou boleto compensado) e mesmo assim o Pessoal continua bloqueado, NÃO é pra ficar esperando — isso é um problema que a gente resolve na hora. Me chama aqui pelo suporte com o e-mail da sua conta e a data do pagamento que a equipe libera o acesso rapidinho. Você não perde o que pagou. 💛' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · MINHA ASSINATURA (status, cancelamento self-service)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-assinatura-cancelar',
    modulo: 'Config',
    tela: 'Minha Assinatura',
    caminho: 'Módulos → Configurações → Minha Assinatura',
    palavrasChave: 'cancelar assinatura, cancelar minha assinatura, quero cancelar, como cancelo, encerrar assinatura, parar de pagar, cancelar plano, não quero mais, desativar conta, cancelamento, sair do soa, reembolso, estorno, parar cobrança, asaas, minha assinatura, meu plano, status da assinatura, próximo vencimento, mudar de ideia, reativar',
    conteudo:
      '📍 ONDE FICA\nNo menu, Configurações → "Minha Assinatura". Lá aparece a seção "Minha Assinatura" com seu plano, valor e vencimento — e, logo abaixo, a opção "Cancelar assinatura". Só a administradora (dona) da conta consegue cancelar.\n\n' +
      '💡 COMO CANCELAR (passo a passo)\n1. Abra Configurações → Minha Assinatura.\n2. Na seção "Minha Assinatura", clique em "Cancelar assinatura".\n3. Aparece uma confirmação explicando o que acontece. Se tiver certeza, clique em "Sim, cancelar". (Mudou de ideia? Clique em "Continuar assinante".)\n4. Pronto: cancelamos a cobrança no provedor (Asaas) na hora — NÃO vem mais nenhuma cobrança.\n\n' +
      '🧮 O QUE ACONTECE\n- Você continua com acesso até o FIM DO PERÍODO que já pagou (esse ciclo já está pago; seria injusto cortar antes). Depois disso o acesso encerra.\n- No teste grátis, o acesso encerra na hora (nada foi cobrado).\n- SEUS DADOS FICAM SALVOS. Se quiser voltar, é só reativar pela mesma tela, do jeitinho que estava.\n- Você recebe um e-mail confirmando o cancelamento.\n\n' +
      '⚠️ IMPORTANTE\n- Reembolso não é automático pelo botão (ele só cancela as próximas cobranças). Se você tem direito (ex.: dentro do prazo de arrependimento), fale com o suporte.\n- Se a sua assinatura é gerida pela Hotmart (contas antigas), o cancelamento é feito lá na Hotmart — a tela avisa.\n\n' +
      '💬 EXEMPLO SOFIA\n"Sem problema, querida! Pra cancelar é em Configurações → Minha Assinatura; na seção \'Minha Assinatura\' tem a opção \'Cancelar assinatura\'. Você confirma e pronto, não vem mais cobrança. E fica tranquila: continua usando até o fim do período que já pagou, e nada dos seus dados é apagado. Se um dia quiser voltar, é só reativar. 🧡"',
    faq: [
      { pergunta: 'Como eu cancelo a minha assinatura?', resposta: 'É simples e você mesma faz, sem abrir chamado: vá em Configurações → Minha Assinatura. Ali aparece a seção "Minha Assinatura" com seu plano, valor e vencimento — e logo abaixo a opção "Cancelar assinatura". Clique nela, aparece uma confirmação, e você clica em "Sim, cancelar". A gente cancela a cobrança no provedor na hora e não vem mais nenhuma cobrança. Você continua com acesso até o fim do período que já está pago, e seus dados ficam salvos caso queira voltar. Só a administradora (dona) da conta consegue cancelar.' },
      { pergunta: 'Se eu cancelar, perco tudo na hora?', resposta: 'Não! Você continua com acesso até o fim do período que já pagou — se pagou o mês e cancela no dia 10, usa até o fim daquele ciclo. Depois disso o acesso encerra, mas seus dados NÃO são apagados: ficam guardados, e se você reativar mais pra frente encontra tudo como deixou. (No teste grátis é diferente: como nada foi cobrado, o acesso encerra na hora.)' },
      { pergunta: 'Cancelei — tenho direito a reembolso?', resposta: 'O botão de cancelar só encerra as próximas cobranças; ele não devolve dinheiro automaticamente. Reembolso é avaliado caso a caso (por exemplo, se você está dentro do prazo de arrependimento). Se acha que tem direito, fale com o suporte que a gente resolve com você.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · GERAL (dados, tema, módulos, orçamentos)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-geral',
    modulo: 'Config',
    tela: 'Configurações Gerais',
    caminho: 'Módulos → Configurações → Geral',
    palavrasChave: 'configuracoes gerais, dados do atelie, nome da loja, nome do negocio, logo, logomarca, subir logo, cor do sistema, tema, cor primaria, mudar cor, personalizar, whatsapp, instagram, email de contato, telefone, cidade, estado, cnpj, cpf, segmento, perfil incompleto, completar perfil, politicas de orcamento, dados do orcamento, formas de pagamento no orcamento, lgpd, receber novidades, marketing, salvar configuracoes',
    conteudo:
      '📍 ONDE FICA\nNo menu de Módulos, clique em "Configurações" (engrenagem cinza). Você cai direto na aba Geral. Essa tela é só da dona/administradora — quem entra como operadora não vê.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nPense nesta tela como a "identidade" do seu ateliê dentro do sistema. É aqui que você diz o nome do seu negócio, coloca sua logo, escolhe a cor que vai pintar o sistema inteiro, guarda seu WhatsApp e Instagram e liga ou desliga os módulos (as partes do sistema que você usa). É como arrumar a fachada e a vitrine da sua lojinha: uma vez bem-feito, aparece bonito pra todo mundo.\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha à mão: a imagem da sua logo (JPG ou PNG, no máximo 2MB), seu Instagram, seu WhatsApp e um e-mail de contato. Não precisa preencher tudo de uma vez — só o que tem asterisco vermelho (*) é obrigatório.\n\n' +
      '👣 PASSO A PASSO\n1. Logo: no primeiro quadro, clique em "Enviar logo" e escolha o arquivo no seu computador ou celular. Ela aparece na barra lateral e na tela de entrada. Para tirar, clique em "Remover".\n2. Dados do negócio: preencha "Nome do Ateliê" (ex.: Ateliê da Maria), "Nome da Proprietária" (seu nome completo) e escolha o "Segmento" (o tipo do seu artesanato — laços, biscuit, costura...). O segmento é obrigatório porque ele personaliza sugestões pra você.\n3. Complete @Instagram, WhatsApp e e-mail de contato (os três com asterisco).\n4. Canais e links (opcional): Telegram, link da loja, CNPJ/CPF, cidade, estado. Quanto mais preencher, melhores dicas você recebe.\n5. Módulos do sistema: ligue ou desligue cada parte com a chavinha laranja (veja a explicação separada em "Módulos do sistema").\n6. Configurações de Orçamentos: escreva uma vez suas políticas (forma de pagamento, prazo, PIX) e elas aparecem no rodapé de TODOS os orçamentos que você enviar.\n7. Tema de cores: clique numa das cores prontas (Laranja, Roxo, Verde...) ou escolha uma cor sua no seletor. O sistema muda de cor na hora, só de olhar.\n8. Marque se aceita receber novidades (LGPD) e clique no botão grande "Salvar configurações" lá embaixo.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO sistema guarda tudo isso ligado ao seu ateliê (seu "espaço" próprio). A logo vira parte da imagem. A cor escolhida repinta os botões e detalhes na hora, sem recarregar. As políticas de orçamento ficam salvas e são coladas automaticamente no fim de cada orçamento. Se faltar algum campo obrigatório, aparece a etiqueta "Complete seu perfil" no topo; com tudo preenchido, vira "Perfil completo" em verde.\n\n' +
      '⚠️ ERROS COMUNS\n- Esquecer de clicar em "Salvar configurações" no fim: se sair sem salvar, perde o que digitou. A cor muda na hora só pra você ver, mas só fica salva depois do botão.\n- Logo pesada demais: acima de 2MB o sistema avisa. Use uma imagem menor.\n- Não escolher o segmento: sem ele o botão reclama, pois é o que personaliza o sistema.\n- Confundir esta tela com a página da Loja Virtual: aqui é a identidade geral; a vitrine de vendas fica em outra configuração.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia faz laços e acabou de entrar no sistema. Ela sobe a logo do "Laços da Sofia", escolhe o segmento "Laços e Tiaras", põe o @ do Instagram e o WhatsApp, clica na cor Rosa (o sistema fica rosa na hora, ela adora), escreve nas políticas "PIX (11) 99999-9999 · 50% na aprovação, 50% na entrega" e salva. Pronto: agora todo orçamento que ela mandar já sai com esses dados no rodapé, sem ela digitar de novo.',
    faq: [
      { pergunta: 'Como eu troco a cor do sistema?', resposta: 'Vá em Configurações → Geral e desça até o quadro "Tema de cores". Clique em uma das cores prontas (Laranja, Roxo, Ciano, Verde, Âmbar, Vermelho, Rosa ou Carvão) e o sistema muda de cor na mesma hora pra você ver como fica. Se quiser uma cor bem específica, clique no quadradinho colorido à esquerda e escolha no seletor, ou digite o código dela (ex.: #f97316). Importante: a cor muda na tela só pra você conferir, mas só fica salva de verdade depois que você clica no botão grande "Salvar configurações" no fim da página. Se sair sem salvar, ela volta ao que era.' },
      { pergunta: 'Subi a logo mas ela não aparece, e agora?', resposta: 'Primeiro confira o tamanho: a logo precisa ter no máximo 2MB. Se for maior, o sistema mostra o aviso "Logo deve ter no máximo 2MB" e não carrega. Reduza a imagem (tire uma foto menor ou use uma versão comprimida) e tente de novo em "Enviar logo". Depois de aparecer a pré-visualização no quadradinho, não esqueça de clicar em "Salvar configurações" no fim. A logo aparece na barra lateral do menu e na tela de login. Se quiser trocar, é só clicar em "Trocar logo"; para tirar, em "Remover".' },
      { pergunta: 'O que é o "Segmento" e por que é obrigatório?', resposta: 'O segmento é o tipo do seu artesanato: laços, biscuit, costura, sublimação, MDF, festas e por aí vai. Ele é obrigatório porque o sistema usa essa informação pra te dar sugestões que combinam com o seu trabalho — por exemplo, campos e setores de produção já pensados pro seu ramo. Escolha o que mais se parece com o que você faz. Se o seu não estiver na lista, escolha "Personalizado". Sem escolher, o botão de salvar avisa que falta essa informação.' },
      { pergunta: 'O que é aquele campo de "Configurações de Orçamentos"?', resposta: 'É um espaço onde você escreve uma vez só as informações que devem aparecer em TODOS os orçamentos que enviar às clientes: sua chave PIX, dados bancários, forma de pagamento (ex.: 50% na aprovação e 50% na entrega), prazo e regras de alteração. O que você digitar aqui aparece automaticamente no rodapé de cada orçamento, antes do botão de aprovação. Assim você não precisa digitar tudo de novo a cada orçamento. Se deixar em branco, nada é exibido.' },
      { pergunta: 'Por que aparece "Complete seu perfil" no topo?', resposta: 'Essa etiqueta laranja aparece quando ainda falta preencher algum dado importante do seu negócio (como nome, Instagram, WhatsApp, e-mail ou segmento). Quando você preenche tudo e salva, ela vira "Perfil completo" em verde. Não impede você de usar o sistema, mas ter o perfil completo ajuda o sistema a te conhecer melhor e a te enviar conteúdos mais úteis.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · MÓDULOS DO SISTEMA
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-modulos-ligar-desligar',
    modulo: 'Config',
    tela: 'Módulos do sistema (em Configurações Gerais)',
    caminho: 'Módulos → Configurações → Geral → Módulos do sistema',
    palavrasChave: 'ligar modulo, desligar modulo, ativar modulo, habilitar, chavinha, chave, sumiu do menu, nao aparece no menu, liberar estoque, ativar loja, ativar demandas, freelancer, trabalhos de freelancer, clientes crm, tarefas kanban, assistente de compras ia, marketplace shopee, numeros do marketplace, funcao nao aparece, como habilito, onde ligo',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Geral. Desça até o quadro "Módulos do sistema" (engrenagem). É só da administradora.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nO SOA tem várias partes (módulos), mas você não precisa usar todas. Este quadro é como um painel de interruptores da casa: você acende só as luzes dos cômodos que usa. Cada chavinha liga ou desliga uma parte do sistema. Quando você desliga um módulo, ele some do menu e deixa a tela mais limpa; quando liga, ele aparece pra você usar.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense no que faz sentido pro seu momento. Não tem problema ligar hoje e desligar amanhã — nada é apagado, só fica escondido. Só a administradora consegue mexer aqui.\n\n' +
      '👣 PASSO A PASSO\n1. Encontre o módulo desejado na lista.\n2. Clique na chavinha à direita: laranja/deslizada pra direita = ligado; cinza/pra esquerda = desligado.\n3. Ligue apenas o que usa. As opções são:\n   - Estoque de Produtos: controle do que você tem pronto pra pronta entrega.\n   - Trabalhos de Freelancer: gerenciar quem produz pra você por fora (as Demandas).\n   - Clientes (CRM): cadastro de clientes com contatos, endereços e histórico.\n   - Minha Loja: sua loja virtual (vitrine, carrinho, pagamento).\n   - Tarefas: quadros estilo Kanban pra organizar tarefas em colunas.\n   - Assistente de Compras (IA): pesquisa a faixa de preço de mercado de um material.\n   - Números do Marketplace (Shopee): previsão de recebimento e margem por pedido (esse salva na hora, não precisa do botão).\n4. Depois de ligar/desligar os módulos, clique em "Salvar configurações" no fim da página (menos o do Marketplace, que já salva sozinho).\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada chavinha guarda um "sim/não" ligado ao seu ateliê. O menu lê esses valores e mostra só o que está ligado. Desligar não apaga NADA do que você já cadastrou — os dados continuam guardados e voltam a aparecer quando você religar. O módulo Clientes já vem ligado por padrão; os outros começam desligados.\n\n' +
      '⚠️ ERROS COMUNS\n- "Sumiu o menu de Freelancers / da Loja / do Estoque": provavelmente o módulo está desligado. Volte aqui e ligue a chavinha.\n- Ligar tudo de uma vez e se perder: ligue aos poucos, conforme for precisando.\n- Esquecer de salvar: exceto o Marketplace, os módulos só valem depois do "Salvar configurações".\n- Operadora não encontra a tela: só a administradora liga e desliga módulos.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia começou só com pedidos. Depois de um tempo, passou a mandar laços pra uma costureira ajudar. Ela vai em Configurações → Geral, liga a chavinha "Trabalhos de Freelancer", salva, e pronto: agora aparece o menu de Demandas pra ela controlar os trabalhos. Quando abriu a loja online, ligou também "Minha Loja".',
    faq: [
      { pergunta: 'Uma função sumiu do menu. Como faço ela voltar?', resposta: 'Quase sempre é porque o módulo dela está desligado. Vá em Módulos → Configurações → Geral e desça até "Módulos do sistema". Procure o nome (Estoque, Trabalhos de Freelancer, Clientes, Minha Loja, Tarefas...) e clique na chavinha pra deixá-la laranja (ligada). Depois clique em "Salvar configurações" no fim. A função volta pro menu na hora. Lembre: desligar um módulo nunca apaga seus dados, só esconde a parte do menu.' },
      { pergunta: 'Se eu desligar um módulo, perco o que já cadastrei?', resposta: 'Não, pode ficar tranquila. Desligar um módulo só o esconde do menu — tudo o que você cadastrou continua guardado. Quando religar a chavinha, seus dados aparecem de novo exatamente como estavam. É seguro ligar e desligar quantas vezes quiser.' },
      { pergunta: 'O que é o módulo "Números do Marketplace (Shopee)"?', resposta: 'É uma ajuda pra quem vende na Shopee: mostra a previsão de quando o dinheiro cai (repasse), as taxas e a margem real de cada pedido. Ele aparece dentro do menu Financeiro e NÃO cria lançamentos sozinho — é só pra você enxergar os números. Quando você liga essa chavinha, pode ajustar os "Dias para repasse". Diferente dos outros, esse salva na hora que você mexe, sem precisar do botão "Salvar configurações".' },
      { pergunta: 'Quem pode ligar e desligar os módulos?', resposta: 'Apenas a administradora (a dona da conta ou quem ela definiu como ADMIN). Delegadoras e operadoras não veem essa tela. Isso evita que alguém desligue uma parte importante sem querer.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · PRODUÇÃO (setores) — PONTOS CRÍTICOS
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-producao-setores',
    modulo: 'Config',
    tela: 'Configurar Produção (setores e campos)',
    caminho: 'Módulos → Configurações → Produção',
    palavrasChave: 'setores, etapas de producao, fases, fluxo de producao, criar setor, adicionar setor, renomear setor, editar setor, reordenar setor, arrastar setor, ordem dos setores, excluir setor, apagar setor, remover setor, setor de expedicao, marcar expedicao, pedido enviado, pedido preso em concluido, ativar setor, inativar setor, template de setores, campos do setor, campo customizado, pedidos presos, mover pedidos',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Produção. Aparece a lista dos seus setores, cada um com botões à direita.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nSetores são as etapas pelas quais um pedido passa até ficar pronto, na ordem que você trabalha. É como as estações de uma linha de montagem: Pedido → Produção → Embalagem → Expedição. Cada pedido caminha de um setor pro próximo. Aqui você monta essa "esteira" do seu jeito: cria etapas, muda a ordem, renomeia e escolhe qual delas, ao ser concluída, significa que o pedido foi ENVIADO.\n\n' +
      '✅ ANTES DE COMEÇAR\nSe você é nova, o sistema oferece templates prontos por tipo de artesanato — comece por um deles e ajuste. Antes de EXCLUIR qualquer setor, pense: tem pedido dentro dele agora? Se tiver, não exclua ainda (leia os erros comuns). Renomear é sempre seguro.\n\n' +
      '👣 PASSO A PASSO\n1. Criar: no campo "Nome do novo setor" digite o nome (ex.: Pintura) e clique em "+ Setor". Ele entra no fim da esteira.\n2. Renomear (SEGURO): dê um duplo clique no nome do setor, digite o novo nome e aperte Enter. Nenhum pedido se perde ao renomear.\n3. Reordenar: arraste o setor pela alcinha (os pontinhos à esquerda) pra cima ou pra baixo, ou use as setinhas. A nova ordem salva sozinha.\n4. Ativar/Inativar: clique no selo "Ativo/Inativo". Inativo some do fluxo do dia a dia mas guarda o histórico.\n5. Marcar Expedição: clique no selo "Expedição?" do setor que representa o envio. Ele fica roxo escrito "Expedição". Só UM setor pode ser o de expedição.\n6. Campos do setor: clique no setor pra abri-lo e adicione campos extras (ex.: Cor do tecido, Temperatura) com "Adicionar campo".\n7. Excluir (CUIDADO): clique na lixeirinha. Confirme só se tiver certeza.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada pedido "mora" em um setor por vez. Quando você conclui o pedido no setor marcado como Expedição, o sistema entende que ele saiu e muda o status pra ENVIADO automaticamente. Por isso o sistema exige que você marque qual setor faz esse papel: qualquer setor com a palavra "expedi" no nome (Expedição, Expedido) tende a fazer esse papel, mas o certo é marcar o selo roxo. Sem nenhum setor de expedição definido, os pedidos concluídos ficam "presos" em Concluído e não viram Enviado.\n\n' +
      '⚠️ ERROS COMUNS\n- NUNCA exclua um setor que tem pedidos dentro. Se fizer isso, esses pedidos ficam presos, sem etapa, difíceis de achar. O certo é primeiro MOVER os pedidos pra outro setor e só então excluir o vazio.\n- Excluir ou desmarcar o setor de Expedição sem marcar outro: os próximos pedidos concluídos travam em "Concluído" e não viram Enviado. O sistema até avisa em amarelo quando não há expedição definida.\n- Achar que renomear é perigoso: não é. Renomear é totalmente seguro, os pedidos continuam no lugar.\n- Ter dois setores de envio: só um pode ser o de expedição; ao marcar um novo, o anterior é desmarcado sozinho.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia montou: Pedido → Produção → Embalagem → Expedição. Ela clicou em "Expedição?" no último setor, que ficou roxo. Agora, quando ela conclui um laço na Expedição, ele vira Enviado sozinho. Um dia ela quis apagar o setor "Produção", mas tinha 8 pedidos lá dentro. Em vez de excluir, ela primeiro moveu os 8 pedidos pra "Embalagem" e, só depois, com o setor vazio, apagou. Nenhum pedido se perdeu.',
    faq: [
      { pergunta: 'Posso excluir um setor que tem pedidos dentro?', resposta: 'Não, é o maior cuidado desta tela. Se você excluir um setor que ainda tem pedidos, esses pedidos ficam PRESOS — sem etapa nenhuma — e ficam muito difíceis de encontrar e tocar pra frente. O jeito certo é: primeiro abra a produção, mova todos os pedidos daquele setor para outro setor, e só quando o setor estiver vazio use a lixeirinha pra excluir. Se só quer parar de usar o setor sem apagar, prefira deixá-lo "Inativo": ele some do dia a dia mas guarda o histórico com segurança.' },
      { pergunta: 'Renomear um setor bagunça meus pedidos?', resposta: 'Não, pode renomear tranquila. Renomear só troca o nome que aparece — todos os pedidos continuam exatamente no lugar. Dê um duplo clique no nome do setor, digite o novo nome e aperte Enter. É a operação mais segura da tela. Use isso sempre que quiser ajustar um nome sem risco.' },
      { pergunta: 'Meus pedidos concluídos não estão virando "Enviado". Por quê?', resposta: 'Isso acontece quando você não tem nenhum setor marcado como Expedição, ou marcou e depois desmarcou. É o setor de expedição que, ao concluir o pedido nele, muda o status pra ENVIADO automaticamente. Solução: na tela de Produção, encontre o setor que representa o envio (geralmente o último, tipo "Expedição") e clique no selo "Expedição?" — ele fica roxo escrito "Expedição". Só pode existir um por vez. Quando não há nenhum, o sistema mostra um aviso amarelo no topo lembrando você de marcar.' },
      { pergunta: 'O que significa marcar um setor como "Expedição"?', resposta: 'Significa dizer ao sistema: "quando um pedido for concluído NESTE setor, considere que ele saiu do ateliê". Aí o pedido muda sozinho para o status Enviado. Serve pra você não precisar marcar cada pedido como enviado na mão. Qualquer setor com "expedi" no nome costuma ser esse, mas o que vale mesmo é o selo roxo "Expedição". Importante: só um setor pode ter esse papel; ao marcar outro, o anterior é desmarcado automaticamente.' },
      { pergunta: 'Como mudo a ordem dos setores?', resposta: 'Você pode arrastar: segure o setor pela alcinha (os pontinhos à esquerda) e solte na posição desejada, pra cima ou pra baixo. A nova ordem é salva sozinha, sem botão. A ordem importa porque é o caminho que o pedido percorre — do primeiro setor até o de expedição.' },
      { pergunta: 'Diferença entre "Inativar" e "Excluir" um setor?', resposta: 'Inativar apenas esconde o setor do fluxo do dia a dia, mas guarda todo o histórico e é 100% reversível — é a opção segura quando você só quer parar de usar. Excluir apaga o setor de vez (e seus campos configurados) e é definitivo; só faça isso com o setor vazio, sem pedidos dentro. Na dúvida, inative.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · CAMPOS DO PEDIDO
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-campos-pedido',
    modulo: 'Config',
    tela: 'Campos do Pedido',
    caminho: 'Módulos → Configurações → Campos do Pedido',
    palavrasChave: 'campos do pedido, campo personalizado, criar campo, adicionar informacao no pedido, tema, cor, nome da crianca, tamanho, tipo de campo, texto, numero, data, lista, checkbox, cor, imagem, anexar arte, foto do pedido, usar como filtro, usar na massa, acao em massa, campos fixos, campos sugeridos, atalhos, ordenar campos, editar campo, remover campo',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Campos do Pedido. Só a administradora acessa.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nCada pedido já vem com informações fixas (nome da cliente, produto, quantidade, valor...). Mas cada artesanato tem detalhes próprios: o tema da festa, a cor do laço, o nome da criança na caneca. Esta tela deixa você criar esses campos extras, pra que apareçam na hora de cadastrar cada pedido. É como personalizar sua caderneta de pedidos com as colunas que VOCÊ usa.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense: que pergunta você sempre faz pra cliente e anota à parte? Isso vira um campo. Veja também os "campos sugeridos" no fim da tela — são atalhos prontos pra ganhar tempo.\n\n' +
      '👣 PASSO A PASSO\n1. Criar um campo: clique em "Novo campo" (botão laranja no topo). Dê um nome (ex.: Tema, Cor, Nome da criança).\n2. Escolha o tipo: Texto livre (escrever), Número, Data, Lista (opções pra escolher), Checkbox (sim/não), Cor, ou Imagem (anexar a arte de cada pedido).\n3. Se escolher Lista, digite as opções separadas por vírgula (ex.: Pequeno, Médio, Grande). Se for Texto ou Número, pode pôr um Placeholder (texto de exemplo).\n4. Marque "Usar como filtro" (pra depois filtrar pedidos por esse campo) e "Usar em ação em massa" (pra alterar vários de uma vez). Clique em "Criar campo".\n5. Atalhos: no quadro "campos sugeridos", clique num chip com "+" pra adicionar um campo pronto na hora.\n6. Reordenar: arraste os campos pela alcinha pra mudar a ordem em que aparecem.\n7. Editar: clique no lapisinho pra mudar nome, tipo e opções. Ativar/Inativar pelo selo verde. Lixeirinha pra remover.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs campos fixos (Nome da Cliente, Produto, Quantidade, Valor, Data, Responsável, Prioridade, Canal...) estão sempre presentes e não podem ser apagados. Os campos que você cria são "personalizados": aparecem no formulário de cada pedido. Campos do tipo Imagem servem pra anexar a arte ou referência (limite de 1MB por imagem) e não entram como filtro nem em ações em massa. A ordem que você define é a ordem em que eles aparecem.\n\n' +
      '⚠️ ERROS COMUNS\n- Criar campo do tipo errado: se é pra escolher entre opções, use Lista, não Texto — assim ninguém digita de um jeito diferente.\n- Esquecer de preencher as opções da Lista: sem opções, o campo fica vazio pra escolher.\n- Remover um campo achando que só some da tela: ao remover, o histórico daquele campo também se vai. Se só quer parar de usar, prefira Inativar.\n- Esperar que o campo Imagem apareça nos filtros: ele não aparece, é só pra anexar arte.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia sempre pergunta o "Tema" da festa e a "Cor" do laço. Ela cria o campo "Tema" (Texto livre) e o campo "Cor" (Lista: Rosa, Azul, Vermelho, Dourado). Cria também um campo "Arte" do tipo Imagem pra anexar a referência que a cliente mandou. Agora, ao cadastrar cada pedido, esses três campos aparecem prontinhos — e ela consegue filtrar depois todos os pedidos "Rosa".',
    faq: [
      { pergunta: 'Qual a diferença entre os tipos de campo (Texto, Lista, Número...)?', resposta: 'Cada tipo serve pra um tipo de informação. Texto livre: pra escrever qualquer coisa (ex.: um recado). Número: só números (ex.: peso). Data: pra escolher um dia no calendário. Lista: você define opções fixas e a pessoa escolhe uma (ex.: Pequeno/Médio/Grande) — ótimo pra padronizar. Checkbox: um sim ou não (ex.: "com brilho?"). Cor: pra escolher uma cor. Imagem: pra anexar a arte ou foto de referência do pedido (até 1MB). Dica: quando as respostas são sempre as mesmas, use Lista, assim ninguém escreve de um jeito diferente e você consegue filtrar depois.' },
      { pergunta: 'Para que servem os botões "Filtro" e "Massa" em cada campo?', resposta: '"Filtro" (azul) deixa você usar aquele campo pra filtrar seus pedidos depois — por exemplo, ver só os pedidos com Cor "Rosa". "Massa" (roxo) permite mudar aquele campo em vários pedidos de uma vez (ação em massa), poupando tempo. Você liga ou desliga cada um clicando no botão. Campos do tipo Imagem não têm essas opções, pois são só pra anexar arquivo.' },
      { pergunta: 'Como anexo a arte que a cliente mandou em cada pedido?', resposta: 'Crie um campo do tipo Imagem: clique em "Novo campo", dê um nome (ex.: Arte ou Referência) e escolha o tipo "Imagem". Na hora de cadastrar cada pedido, vai aparecer a opção de anexar a imagem daquele pedido. O limite é 1MB por imagem (baixa resolução, o suficiente pra visualizar). Esse campo não aparece nos filtros nem nas ações em massa — é só pra guardar a arte.' },
      { pergunta: 'Posso apagar os campos fixos como "Valor" ou "Nome da Cliente"?', resposta: 'Não. Os campos fixos (Nome da Cliente, ID Pedido, Produto, Quantidade, Valor, Datas, Responsável, Prioridade, Canal, entre outros) estão sempre presentes porque o sistema precisa deles pra funcionar. Você só cria, edita e remove os campos personalizados — os extras que você mesma inventa.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · CAMPOS DO ESTOQUE
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-campos-estoque',
    modulo: 'Config',
    tela: 'Campos do Estoque',
    caminho: 'Módulos → Configurações → Campos do Estoque',
    palavrasChave: 'campos do estoque, campo extra estoque, localizacao na prateleira, corredor, deposito, lote, validade, codigo de barras, codigo interno, peso, fornecedor padrao, prazo de reposicao, campo personalizado estoque, tipo texto numero data lista sim nao, campo obrigatorio, sugestoes de campo, ordenar campos estoque, campos fixos precificacao',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Campos do Estoque. Só a administradora acessa. (Precisa do módulo Estoque ligado.)\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nSeus produtos em estoque já vêm com informações da Precificação (nome, SKU, custo, preço, saldo...). Mas talvez você queira anotar coisas próprias: em qual prateleira o produto está, o lote, a validade, o código de barras. Esta tela cria esses campos extras pros produtos do estoque. É como colar etiquetas de organização nas suas prateleiras.\n\n' +
      '✅ ANTES DE COMEÇAR\nVeja os "campos sugeridos" agrupados por tema (Armazenamento, Produção, Controle, Fornecedor) — são atalhos prontos. Pense no que te ajuda a achar e controlar seus produtos mais rápido.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Novo campo".\n2. Dê um nome (ex.: Localização, Lote, Fornecedor).\n3. Escolha o tipo: Texto livre, Número, Data, Lista, ou Sim/Não.\n4. Se for Lista, digite as opções separadas por vírgula (ex.: Principal, Secundário, Externo). Se for Texto ou Número, pode pôr um Placeholder de exemplo.\n5. Marque "Campo obrigatório" se ele sempre precisa ser preenchido. Clique em "Criar campo".\n6. Atalhos: clique nos chips sugeridos (ex.: "Localização na prateleira", "Validade", "Código de barras") pra adicionar na hora.\n7. Ordenar: use as setinhas pra cima/baixo pra mudar a ordem. Ativar/Inativar pelo selo. Lixeirinha pra remover.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs campos fixos (Produto, SKU, Canal de Venda, Variação, Tipo, Custo Total, Preço de Venda, Saldo em Estoque, Estoque Mínimo, Última Movimentação) vêm automaticamente da Precificação e sempre aparecem. Os campos que você cria aqui aparecem como colunas/informações extras em cada produto do estoque. Se você remove um campo, os valores já preenchidos nele também são removidos.\n\n' +
      '⚠️ ERROS COMUNS\n- Marcar como obrigatório um campo que nem sempre se aplica: aí o sistema vai cobrar preenchimento sempre. Só marque obrigatório o que realmente é essencial.\n- Remover um campo e esperar recuperar os valores: ao remover, os dados preenchidos nele somem junto. Se está em dúvida, Inative.\n- Criar um campo que já existe entre os sugeridos: use o atalho, é mais rápido.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia vende laços prontos a pronta entrega e vive procurando onde guardou cada modelo. Ela adiciona o campo sugerido "Localização na prateleira" (Texto) e cria uma Lista "Depósito" com as opções Principal e Em casa. Agora cada produto do estoque mostra onde está, e ela encontra tudo num instante.',
    faq: [
      { pergunta: 'Qual a diferença entre os campos fixos e os que eu crio no estoque?', resposta: 'Os campos fixos (Produto, SKU, Canal de Venda, Variação, Tipo, Custo Total, Preço de Venda, Saldo em Estoque, Estoque Mínimo e Última Movimentação) vêm prontos da Precificação e são preenchidos automaticamente quando você vincula um produto ao estoque — não dá pra apagá-los. Já os campos que você cria nesta tela são extras seus, como localização na prateleira, lote ou validade, e servem pra organizar do seu jeito.' },
      { pergunta: 'O que acontece se eu remover um campo do estoque?', resposta: 'Ao remover um campo, além dele sumir da tela, todos os valores que já tinham sido preenchidos nele nos produtos também são apagados. O sistema até avisa isso antes de confirmar. Por isso, se você só quer parar de usar o campo por enquanto, prefira deixá-lo Inativo (pelo selo) em vez de excluir — assim os dados ficam guardados.' },
      { pergunta: 'Como uso os campos sugeridos?', resposta: 'No fim da tela há um quadro "Atalhos — campos sugeridos para estoque", organizados por tema: Armazenamento (prateleira, corredor, depósito), Produção (lote, data de produção, validade), Controle (código interno, código de barras, peso) e Fornecedor (fornecedor padrão, prazo de reposição). Basta clicar no chip com "+" e o campo já é criado com o tipo certo. É a forma mais rápida de montar seu estoque.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · EXPEDIÇÃO (leitura QR / barras / OCR)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-expedicao-leitura',
    modulo: 'Config',
    tela: 'Expedição — Leitura de pedidos',
    caminho: 'Módulos → Configurações → Expedição',
    palavrasChave: 'expedicao, ler pedido, leitura por camera, qr code, codigo de barras, ocr, ler etiqueta, escanear pedido, bipar pedido, leitor, camera, foto da etiqueta, shopee etiqueta, ler numero do pedido, campos do popup, campo em destaque, estrela destaque, ativar leitura, metodo de leitura, tipo de codigo, etiqueta propria, criar qr do pedido',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Expedição.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nNa hora de despachar os pedidos, em vez de procurar um por um na lista, você aponta a câmera do celular pra etiqueta e o pedido aparece na tela em destaque — como o caixa do mercado que bipa o produto e mostra o preço. Esta tela liga essa "leitura por câmera" e deixa você escolher como ler (QR, código de barras ou foto do número) e o que aparece no pop-up.\n\n' +
      '✅ ANTES DE COMEÇAR\nDecida como você vai etiquetar seus pedidos: com etiqueta própria (que traz QR ou código de barras gerados pelo sistema) ou lendo a etiqueta que vem de fora, tipo a da Shopee. Isso ajuda a escolher o método certo.\n\n' +
      '👣 PASSO A PASSO\n1. Ligue "Ativar consulta por leitura" (o quadradinho no topo). Isso faz aparecer o botão "Ler pedido" na expedição.\n2. Como ler o pedido: escolha entre Foto (OCR) — lê o número "Pedido:" impresso na etiqueta de fora, com mira guiada; Cód. de barras — lê o código da sua etiqueta própria; QR-Code — lê o QR da sua etiqueta própria; ou Todos — mostra os três no leitor. A digitação manual está sempre disponível.\n3. Código na etiqueta: escolha o que imprimir na SUA etiqueta — QR-Code, Código de barras ou Ambos. O leitor reconhece qualquer um.\n4. Campos do pop-up: marque quais informações aparecem quando você lê um pedido (número, cliente, produto, setor atual, endereço...). Clique na estrelinha (⭐) do campo que deve aparecer GRANDE, em destaque.\n5. Clique em "Salvar configuração".\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nQuando ativado, o sistema imprime o código escolhido nas etiquetas e passa a mostrar o botão de leitura. A câmera lê o código (QR ou barras) da sua etiqueta própria — esse é o caminho mais confiável — ou, no modo Foto (OCR), tenta ler o número impresso na etiqueta externa e pede sua confirmação, já que fotos podem errar. O campo marcado com a estrela é o que aparece em letra grande no pop-up (normalmente o número do pedido), pra você conferir rápido.\n\n' +
      '⚠️ ERROS COMUNS\n- Esperar que o OCR (foto) acerte sempre: ele lê o número impresso, mas pode confundir; por isso sempre pede confirmação. Pra máxima confiança, use QR ou código de barras da etiqueta própria.\n- Não marcar nenhum campo em destaque: escolha um com a estrela pra ter a informação principal grande.\n- Esquecer de salvar: sem clicar em "Salvar configuração", nada vale.\n- Ativar a leitura mas não imprimir o código na etiqueta: escolha o tipo de código pra ele sair na etiqueta.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia despacha 30 laços por dia e cansou de procurar na lista. Ela ativa a leitura, escolhe imprimir "QR-Code" nas etiquetas próprias, marca os campos Nº do pedido, Cliente e Produto no pop-up e põe a estrela no "Nº do pedido". Agora ela cola a etiqueta, aponta a câmera, e o pedido aparece com o número gigante na tela — confere e despacha em segundos.',
    faq: [
      { pergunta: 'Qual método de leitura é o mais confiável?', resposta: 'Ler o QR-Code ou o código de barras da sua etiqueta própria (a que o sistema gera com o "Criar QR do pedido") é o caminho mais confiável, porque o código é feito exatamente pro sistema entender. O modo Foto (OCR), que lê o número impresso na etiqueta de fora (como a da Shopee), é útil quando você não tem etiqueta própria, mas pode errar a leitura — por isso ele sempre pede sua confirmação antes. Se puder, prefira QR ou barras.' },
      { pergunta: 'Para que serve a estrelinha nos campos do pop-up?', resposta: 'A estrela (⭐) marca qual informação aparece GRANDE, em destaque, quando você lê um pedido. Normalmente você coloca no "Nº do pedido", pra bater o olho e conferir na hora. Os outros campos marcados aparecem menores, abaixo. Só um campo pode ter o destaque por vez, e ele precisa estar entre os campos marcados pra aparecer.' },
      { pergunta: 'Ativei a leitura mas não aparece o botão "Ler pedido". O que faço?', resposta: 'Confira se você realmente ligou o "Ativar consulta por leitura" no topo e clicou em "Salvar configuração" no fim. É essa ativação que faz o botão "Ler pedido" surgir na tela de expedição (e imprime o código na etiqueta). Sem salvar, a configuração não vale. Depois de salvar, vá até a expedição pra usar o leitor.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · FLUXOS DE PRODUÇÃO
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-fluxos',
    modulo: 'Config',
    tela: 'Fluxos de Produção',
    caminho: 'Módulos → Configurações → Fluxos',
    palavrasChave: 'fluxos de producao, modelo de fluxo, caminho do pedido, tipos de produto, fluxo por produto, criar fluxo, editar fluxo, excluir fluxo, montar sequencia de setores, ordem dos setores no fluxo, emoji do fluxo, sublimacao biscuit, varios fluxos, produtos diferentes etapas diferentes',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Fluxos. Só a administradora acessa.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nNem todo produto passa pelas mesmas etapas. Um laço talvez faça Produção → Embalagem; já uma peça de biscuit faz Modelagem → Secagem → Pintura → Verniz. Fluxos são "receitas de caminho": você monta uma sequência de setores pra cada tipo de produto. Assim, cada produto segue só as etapas que fazem sentido pra ele. É como ter roteiros diferentes pra produtos diferentes.\n\n' +
      '✅ ANTES DE COMEÇAR\nOs setores precisam já existir (você cria em Configurações → Produção). No fluxo você só escolhe QUAIS setores entram e em QUAL ordem.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Novo fluxo".\n2. Escolha um emoji (opcional, ajuda a reconhecer) e digite o Nome do fluxo (ex.: Sublimação, Biscuit).\n3. Em "Setores deste fluxo", marque as caixinhas dos setores que fazem parte. Conforme marca, eles aparecem numerados na ordem escolhida.\n4. Reordene: arraste os setores selecionados (pela alcinha) pra definir a sequência certa. O número mostra a ordem.\n5. Clique em "Criar fluxo".\n6. Para editar depois, clique no lapisinho do fluxo; pra ver as etapas, clique no fluxo pra expandir; pra apagar, a lixeirinha.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada fluxo guarda uma lista de setores em ordem. Os pedidos que usam aquele fluxo seguem exatamente essa sequência de etapas. Excluir um fluxo não afeta os pedidos que já existem — eles continuam do jeito que estavam; o fluxo é só o modelo pra novos.\n\n' +
      '⚠️ ERROS COMUNS\n- Tentar montar um fluxo sem ter setores criados: crie os setores antes, em Configurações → Produção.\n- Esquecer de reordenar: marcar os setores não basta; confira se a ordem (os números) está na sequência real do trabalho.\n- Criar fluxos demais e se confundir: comece com um ou dois, só pros produtos que realmente têm caminhos diferentes.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia começou só com laços, mas passou a fazer também topos de bolo em biscuit. Como as etapas são bem diferentes, ela cria dois fluxos: "🎀 Laços" (Produção → Embalagem → Expedição) e "🎨 Biscuit" (Modelagem → Secagem → Pintura → Verniz → Embalagem → Expedição). Agora cada tipo de pedido segue seu próprio caminho, sem misturar etapas que não existem.',
    faq: [
      { pergunta: 'Qual a diferença entre "Fluxos" e "Setores"?', resposta: 'Setores (em Configurações → Produção) são as etapas soltas que existem no seu ateliê, tipo peças de Lego: Corte, Pintura, Embalagem, Expedição. Fluxos são as montagens dessas peças em uma ordem, pra cada tipo de produto: um roteiro que diz "este produto passa por estas etapas, nesta sequência". Você primeiro cria os setores e depois monta os fluxos escolhendo quais setores entram e em qual ordem.' },
      { pergunta: 'Se eu excluir um fluxo, perco os pedidos que estavam nele?', resposta: 'Não. Excluir um fluxo não afeta os pedidos que já existem — eles continuam onde estavam. O fluxo é apenas o modelo de caminho usado pra novos pedidos. Ainda assim, o sistema pede confirmação antes de excluir, pra evitar remoção sem querer.' },
      { pergunta: 'Por que preciso de mais de um fluxo?', resposta: 'Você só precisa se fizer produtos com etapas bem diferentes. Se tudo o que você faz passa pelas mesmas fases, um fluxo só resolve. Mas se, por exemplo, você faz laços (poucas etapas) e peças de biscuit (muitas etapas, com secagem e verniz), vale ter um fluxo pra cada, pra que cada produto siga só as etapas que fazem sentido pra ele.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · FREELANCERS (cadastro + histórico)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-freelancers',
    modulo: 'Config',
    tela: 'Freelancers (cadastro)',
    caminho: 'Módulos → Configurações → Freelancers',
    palavrasChave: 'freelancer, freela, costureira, ajudante, terceirizada, quem produz pra mim, cadastrar freelancer, nova freelancer, editar freelancer, pix da freelancer, telefone whatsapp freelancer, especialidade, observacoes, historico da freelancer, quanto ja paguei, quanto devo, desativar freelancer, ativar, excluir freelancer, trabalhos vinculados',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Freelancers. (Precisa do módulo Trabalhos de Freelancer ligado.)\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nFreelancers são as pessoas que produzem pra você por fora — a costureira, a ajudante, quem pinta os biscuits. Aqui você guarda a agendinha delas: nome, WhatsApp, chave PIX (pra pagar) e especialidade. Depois, ao mandar trabalhos (Demandas), você escolhe a freelancer certa daqui. E consegue ver o histórico: quanto já pagou e quanto ainda deve a cada uma.\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha o nome (obrigatório), e se tiver, o WhatsApp e a chave PIX de cada freelancer — o PIX facilita muito na hora de pagar.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Nova freelancer".\n2. Preencha o Nome (único obrigatório).\n3. Opcional: Telefone/WhatsApp, PIX (CPF, e-mail ou telefone), Especialidade (ex.: Laços, Costura) e Observações (notas internas).\n4. Clique em "Cadastrar".\n5. Editar: clique no lapisinho. Desativar/Ativar: clique no olhinho (a freelancer some das listas ativas mas fica no histórico). Excluir: a lixeirinha.\n6. Ver histórico: clique em "Histórico" no cartão da freelancer. Abre uma janela com quantos trabalhos, itens, quanto está a receber e quanto já foi pago, além das abas de trabalhos e pedidos vinculados. Dá pra filtrar por período (De/Até).\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada freelancer fica ligada aos trabalhos (demandas) que você criou pra ela. O histórico soma os valores: os pagos entram como "Total pago" e os não pagos como "A receber". Por isso, uma freelancer com trabalhos vinculados não pode ser excluída — o sistema protege o histórico. Nesse caso, desative em vez de excluir.\n\n' +
      '⚠️ ERROS COMUNS\n- Tentar excluir uma freelancer com trabalhos: o sistema não deixa, pra não perder o histórico. Use "Desativar".\n- Não cadastrar o PIX: dá pra cadastrar sem, mas o PIX aparece na hora de pagar e agiliza muito.\n- Confundir "Desativar" com "Excluir": desativar é reversível e guarda tudo; excluir é definitivo (e só é possível sem trabalhos vinculados).\n- Operadora tentando cadastrar: geralmente cadastrar/editar/excluir é da administradora; outras podem ver e consultar o histórico.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia manda laços pra Dona Cida costurar. Ela cadastra "Cida" com o WhatsApp, o PIX (o CPF dela) e a especialidade "Laços". Semanas depois, Sofia abre o histórico da Cida e vê: 40 itens produzidos, R$ 120 já pagos e R$ 45 a receber. Na hora de pagar, o PIX da Cida já aparece prontinho pra copiar.',
    faq: [
      { pergunta: 'Não consigo excluir uma freelancer. Por quê?', resposta: 'Isso acontece quando ela tem trabalhos (demandas) vinculados. O sistema bloqueia a exclusão de propósito, pra não apagar o histórico de pagamentos e produção dela — você mostraria a mensagem "Não é possível excluir — há trabalhos vinculados". A solução é Desativar a freelancer (clicando no olhinho): ela sai das listas ativas, mas todo o histórico fica guardado e você pode reativá-la quando quiser. Excluir de vez só é possível pra freelancers sem nenhum trabalho.' },
      { pergunta: 'Como vejo quanto já paguei e quanto devo a uma freelancer?', resposta: 'No cartão da freelancer, clique no botão "Histórico". Abre uma janela com quatro números no topo: quantos trabalhos, total de itens, quanto está "A receber" (ainda não pago) e quanto é o "Total pago". Você ainda pode filtrar por período (campos De e Até) pra ver, por exemplo, só o mês passado. Há também abas separando os trabalhos e os pedidos vinculados a ela, e o PIX dela aparece destacado pra facilitar o pagamento.' },
      { pergunta: 'O que coloco no campo "Especialidade"?', resposta: 'É só uma etiqueta pra você lembrar no que aquela pessoa é boa ou o que ela costuma fazer: Laços, Costura, Pintura, Arte, Impressão... Não é obrigatório, mas ajuda a escolher a freelancer certa na hora de mandar um trabalho. Aparece em destaque no cartão dela.' },
      { pergunta: 'Qual a diferença entre esta tela e o menu de Demandas/Trabalhos?', resposta: 'Aqui (Configurações → Freelancers) você cuida do CADASTRO das pessoas: nome, contato, PIX, especialidade — a agendinha. No menu de Trabalhos de Freelancer (Demandas) você MANDA e controla os trabalhos: o que cada uma vai produzir, quantas peças, por quanto e se já foi pago. Uma coisa alimenta a outra: você cadastra a pessoa aqui e depois escolhe ela ao criar um trabalho.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · USUÁRIAS (perfis)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-usuarios-perfis',
    modulo: 'Config',
    tela: 'Usuárias do Ateliê',
    caminho: 'Módulos → Configurações → Usuárias',
    palavrasChave: 'usuarias, usuarios, convidar usuaria, adicionar pessoa, dar acesso, nova usuaria, perfil de acesso, permissao, nivel de acesso, administradora, delegadora, operadora, role, senha inicial, gerar senha, redefinir senha, resetar senha, primeiro acesso, trocar senha no primeiro login, setores da operadora, vincular setor, desativar usuaria, excluir usuaria, ultimo login, quem acessou',
    conteudo:
      '📍 ONDE FICA\nMódulos → Configurações → Usuárias. Só a administradora acessa.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nSe você trabalha com mais gente (ajudantes, sócia, funcionárias), pode dar a cada uma o seu próprio acesso ao sistema, com senha própria — em vez de todas usarem o mesmo login. E você escolhe até onde cada uma pode ir: quem manda em tudo, quem cuida da produção e do financeiro, e quem só executa a produção. É como dar cópias de chaves diferentes: a chave-mestra pra você, e chaves de cômodos específicos pras outras.\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha o nome e o e-mail de quem você vai convidar. Decida o nível de acesso dela (perfil). Os perfis são FIXOS — você escolhe um dos três, não dá pra inventar permissões novas.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Nova Usuária".\n2. Preencha Nome completo e E-mail (o e-mail é o login dela).\n3. Escolha o Nível de acesso entre os três perfis (veja abaixo).\n4. Se escolher Operadora, aparece a lista de setores: marque quais setores ela pode atender. Deixar tudo desmarcado = ela vê pedidos em qualquer setor onde for a responsável.\n5. Defina a Senha inicial (mínimo 6 caracteres) ou clique no botão de gerar senha aleatória. Anote pra passar pra ela.\n6. Clique em "Criar usuária". Ela entra com essa senha e o sistema pede pra ela criar uma senha própria no primeiro acesso.\n7. Para editar depois: clique no lápis. Dá pra trocar o perfil, redefinir a senha dela, e ativar/inativar (bloquear o login).\n\n' +
      'OS TRÊS PERFIS (FIXOS):\n- Administradora: acesso total a todos os módulos. É a dona/gestora.\n- Delegadora: Produção + Financeiro, mas SEM Precificação. Boa pra uma sócia que ajuda a tocar o dia a dia mas não mexe nos custos/preços.\n- Operadora: apenas as operações de produção. Boa pra quem só executa as etapas.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada usuária tem e-mail, senha própria (guardada de forma criptografada) e um perfil que define o que ela vê. No primeiro acesso, o sistema marca "aguardando 1º acesso" e obriga a pessoa a criar a própria senha. A tela mostra o último login e o horário de cada uma. Operadoras podem ser amarradas a setores específicos, pra verem só os pedidos daquele setor. Por segurança, você não pode excluir a si mesma nem o único administrador ativo.\n\n' +
      '⚠️ ERROS COMUNS\n- Dar perfil de Administradora pra todo mundo: aí todas mexem em tudo, inclusive preços e custos. Dê o perfil mínimo que a pessoa precisa.\n- Esquecer de anotar a senha inicial: anote e passe pra pessoa; ela troca no primeiro acesso.\n- Tentar excluir a si mesma ou o único admin: o sistema bloqueia, pra você não ficar trancada pra fora.\n- Achar que dá pra criar um perfil personalizado: não dá; os três perfis são fixos. Escolha o mais próximo.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia contratou a Bia pra ajudar só na produção dos laços. Ela cria a usuária "Bia" como Operadora, marca só o setor "Produção" e gera uma senha. A Bia entra, cria a senha dela e passa a ver apenas os laços na etapa de Produção — sem acesso a preços, financeiro ou configurações. Já a sócia da Sofia entra como Delegadora, ajudando na produção e no financeiro, mas sem ver a Precificação.',
    faq: [
      { pergunta: 'Quais são os perfis de acesso e o que cada um pode fazer?', resposta: 'São três perfis fixos. Administradora: acesso total a tudo — é a dona ou gestora, mexe em módulos, preços, financeiro, configurações. Delegadora: acessa Produção e Financeiro, mas NÃO acessa a Precificação (não vê nem mexe em custos e preços) — ideal pra uma sócia de confiança que toca o dia a dia. Operadora: só as operações de produção, ideal pra quem executa as etapas do trabalho, sem ver dinheiro nem configurações. Você não pode criar perfis novos; escolhe um desses três ao cadastrar ou editar a usuária.' },
      { pergunta: 'Como redefino a senha de uma funcionária que esqueceu?', resposta: 'Vá em Configurações → Usuárias, clique no lápis (editar) da pessoa e use o campo "Redefinir senha (opcional)". Digite uma nova senha ou clique no botão de gerar uma aleatória, e salve. Passe essa senha pra ela — no próximo acesso o sistema pede pra ela criar a própria senha de novo. Você só consegue redefinir a senha de OUTRAS pessoas, não a sua por aqui (a sua você troca pela tela de trocar senha).' },
      { pergunta: 'O que significa amarrar uma Operadora a setores?', resposta: 'Ao criar ou editar uma Operadora, aparece a lista de setores do seu ateliê. Marcando alguns, você limita a operadora a ver os pedidos apenas daqueles setores onde ela trabalha. Se você deixar tudo desmarcado, ela vê os pedidos de qualquer setor em que for a responsável. Isso ajuda quem só cuida de uma etapa específica a não se perder no meio de todos os pedidos.' },
      { pergunta: 'Por que não consigo me excluir ou excluir a única administradora?', resposta: 'É uma trava de segurança. Se você pudesse excluir a si mesma ou o último administrador ativo, o ateliê ficaria sem ninguém com acesso total — trancado pra fora das configurações. Por isso o sistema esconde o botão de excluir nesses casos. Se precisar trocar de administradora, primeiro promova outra pessoa a Administradora e depois faça a alteração.' },
      { pergunta: 'O que quer dizer a etiqueta "aguardando 1º acesso"?', resposta: 'Significa que você já criou a usuária, mas ela ainda não entrou pela primeira vez. Quando ela entrar com a senha inicial que você definiu, o sistema pede que ela crie a própria senha pessoal, e a etiqueta some. Enquanto estiver "aguardando 1º acesso", é sinal de que a pessoa ainda não começou a usar.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  CONFIG · TROCAR SENHA (própria)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'config-trocar-senha',
    modulo: 'Config',
    tela: 'Criar nova senha',
    caminho: 'Trocar senha (primeiro acesso ou link de troca)',
    palavrasChave: 'trocar senha, mudar minha senha, criar nova senha, alterar senha, senha propria, primeiro acesso, senha fraca, forca da senha, confirmar senha, senhas nao coincidem, minimo 6 caracteres, esqueci minha senha, redefinir minha senha',
    conteudo:
      '📍 ONDE FICA\nA tela "Criar nova senha" aparece sozinha no seu primeiro acesso (quando você entrou com uma senha inicial). Também é pra onde você vai quando precisa definir uma senha pessoal.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ onde você troca a senha genérica que recebeu por uma senha só sua, que ninguém mais sabe. Como trocar a fechadura provisória por uma definitiva, com a sua chave.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense numa senha de pelo menos 6 caracteres, fácil de você lembrar e difícil de outra pessoa adivinhar. Evite datas óbvias.\n\n' +
      '👣 PASSO A PASSO\n1. No campo "Nova senha", digite a senha desejada (mínimo 6 caracteres). Uma barrinha mostra se ela está Fraca, Boa ou Forte.\n2. No campo "Confirmar senha", digite a MESMA senha de novo. Aparece "✓ Senhas coincidem" em verde quando batem.\n3. Se quiser conferir o que digitou, clique no olhinho pra mostrar/esconder.\n4. Clique em "Salvar senha e entrar". O sistema salva, faz você sair e entrar de novo já com a nova senha.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA senha é guardada de forma criptografada — nem o sistema mostra ela de volta. Por isso, depois de trocar, você é levada pra tela de entrada pra logar com a senha nova. A barrinha de força é só uma dica visual pra te ajudar a escolher algo mais seguro.\n\n' +
      '⚠️ ERROS COMUNS\n- Senha com menos de 6 caracteres: o sistema avisa e não deixa salvar.\n- Digitar diferente nos dois campos: aparece "As senhas não coincidem"; corrija até ficarem iguais.\n- Escolher uma senha fraca demais: funciona, mas prefira uma Boa ou Forte pra proteger seus dados.\n\n' +
      '💬 EXEMPLO SOFIA\nA Bia, ajudante da Sofia, entrou pela primeira vez com a senha que a Sofia passou. O sistema pediu pra ela criar a própria senha. Ela digitou uma senha de 8 letras, confirmou (apareceu o verdinho "Senhas coincidem"), clicou em salvar e entrou de novo já com a senha dela. Agora só a Bia sabe a senha dela.',
    faq: [
      { pergunta: 'Por que o sistema está me pedindo pra criar uma nova senha?', resposta: 'Isso acontece no seu primeiro acesso, quando você entrou com uma senha inicial que outra pessoa (a administradora) definiu pra você. Por segurança, o sistema pede que você crie uma senha pessoal, que só você conhece. Depois de criar, você entra normalmente com a sua senha nova.' },
      { pergunta: 'Aparece "As senhas não coincidem", o que fazer?', resposta: 'Isso quer dizer que o que você digitou no campo "Nova senha" está diferente do que digitou em "Confirmar senha". Clique no olhinho pra ver o que escreveu em cada campo, apague e digite a mesma senha nos dois. Quando ficarem iguais, aparece "✓ Senhas coincidem" em verde e o botão de salvar libera.' },
      { pergunta: 'Qual senha é considerada boa?', resposta: 'O mínimo é 6 caracteres. A barrinha embaixo do campo mostra a força: quanto mais longa e variada (letras e números), mais forte. Evite senhas muito curtas ou datas óbvias como seu aniversário. Uma senha "Boa" ou "Forte" protege melhor os dados do seu ateliê.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  DEMANDAS · LISTA DE TRABALHOS
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'demandas-trabalhos',
    modulo: 'Demandas',
    tela: 'Trabalhos de Freelancer',
    caminho: 'Módulos → Trabalhos de Freelancer',
    palavrasChave: 'demandas, trabalhos de freelancer, mandar trabalho, novo trabalho, criar demanda, terceirizar producao, quantas pecas, valor por peca, itens do trabalho, pagar freelancer, marcar como pago, registrar pagamento no financeiro, status pendente em producao produzido pago, acao em massa, pagar varios, filtrar trabalhos, a pagar, total pago, pedido vinculado, excluir trabalho',
    conteudo:
      '📍 ONDE FICA\nMódulos → Trabalhos de Freelancer. (Precisa do módulo ligado.) A tela é escura, em formato de planilha.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o controle da produção que você manda pra fora. Cada linha é um trabalho: qual freelancer, o que produzir, quantas peças, por quanto a peça, e em que pé está (pendente, em produção, produzido, pago). No topo, quatro números te dizem quantos trabalhos, quantas peças, quanto você ainda tem a pagar e quanto já pagou. É a sua planilha de "quem está fazendo o quê e quanto eu devo".\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha a freelancer já cadastrada (em Configurações → Freelancers). Se você usa "Preços por peça", eles aparecem prontos ao montar o trabalho. Pra registrar pagamento, tenha uma categoria de despesa no Financeiro.\n\n' +
      '👣 PASSO A PASSO\n1. Criar: clique em "Novo Trabalho". Escolha a Freelancer. Adicione os Produtos: pra cada um, o nome (ou escolha de um preço cadastrado), a Quantidade e o R$/peça — o subtotal calcula sozinho. Clique em "Adicionar produto" pra incluir mais itens. Opcional: pedido vinculado e observações. Clique em "Criar trabalho".\n2. Acompanhar: use a busca e os filtros (status, freelancer) pra achar o que quer.\n3. Mudar status: selecione as caixinhas das linhas, escolha uma ação na barra laranja (Em produção, Produzido, Pago) e clique em "Aplicar". Ou use os botõezinhos de cada linha.\n4. Pagar: clique no cartãozinho de pagar (ou escolha "Marcar como Pago" na ação em massa). Abre a janela pra escolher a Categoria Financeira e confirmar o valor. Ao confirmar, cria automaticamente uma despesa no Financeiro.\n5. Editar/Excluir: pelos ícones de lápis e X na linha (só antes de pagar, e só administradora).\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada trabalho pode ter vários itens; o total é a soma dos subtotais (quantidade × valor da peça). Enquanto não pago, o valor conta em "A pagar"; ao marcar como Pago, ele entra em "Total pago" e um lançamento de despesa nasce no Financeiro, na categoria que você escolher — assim seu caixa fica certo, sem digitar duas vezes. Os números do topo mudam conforme os filtros que você aplica.\n\n' +
      '⚠️ ERROS COMUNS\n- Marcar como Pago sem escolher a categoria financeira: o sistema pede a categoria; se você ainda não tem categorias de despesa, cadastre uma no Financeiro antes.\n- Achar que "Pago" é só um selo: não é — ele cria de verdade uma despesa no Financeiro. Marque como pago só quando realmente pagou.\n- Não cadastrar a freelancer antes: sem freelancer na lista, não dá pra criar o trabalho.\n- Esquecer que operadora não cria/paga: essas ações costumam ser da administradora.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia manda 50 laços pra Cida costurar a R$ 2,00 cada. Ela clica em "Novo Trabalho", escolhe a Cida, digita "Laço modelo A", quantidade 50, R$ 2,00 — o total R$ 100,00 aparece. Cria o trabalho. Quando a Cida entrega e Sofia paga por PIX, ela seleciona a linha, clica em pagar, escolhe a categoria "Mão de obra" e confirma. Na mesma hora, uma despesa de R$ 100 aparece no Financeiro, e o trabalho vira "Pago".',
    faq: [
      { pergunta: 'Como registro que paguei uma freelancer?', resposta: 'Na tela de Trabalhos, encontre a linha do trabalho e clique no ícone de pagar (o cartãozinho), ou selecione várias linhas e escolha "Marcar como Pago" na barra de ações em massa. Abre uma janela onde você escolhe a Categoria Financeira (ex.: Mão de obra) e confirma o valor pago. Ao clicar em "Confirmar pagamento", o trabalho vira "Pago" E o sistema cria automaticamente uma despesa no seu Financeiro, com esse valor e categoria. Ou seja, você não precisa lançar o gasto de novo à mão — já entra no caixa.' },
      { pergunta: 'Posso pagar vários trabalhos de uma vez?', resposta: 'Sim. Marque as caixinhas das linhas que quer pagar; aparece uma barra laranja mostrando quantos você selecionou e o valor total. Escolha "Marcar como Pago" e clique em "Aplicar". A janela de pagamento abre e, ao confirmar a categoria, todos os selecionados viram Pago de uma vez, cada um gerando sua despesa no Financeiro. A mesma barra também serve pra marcar vários como "Em produção" ou "Produzido" de uma vez.' },
      { pergunta: 'Como coloco vários produtos no mesmo trabalho?', resposta: 'Ao criar um "Novo Trabalho", depois de escolher a freelancer, você vê a área de Produtos. Preencha o primeiro (nome, quantidade e R$/peça) e clique em "Adicionar produto" pra abrir uma nova linha, quantas vezes precisar. Cada item mostra seu subtotal, e o total do trabalho aparece somando tudo. Se você tem preços cadastrados em "Preços por peça", pode escolher direto de uma listinha em vez de digitar o valor.' },
      { pergunta: 'O que significam os status Pendente, Em produção, Produzido e Pago?', resposta: 'É o caminho do trabalho: Pendente (acabou de ser criado, a freelancer ainda não começou), Em produção (ela está fazendo), Produzido (ficou pronto, mas você ainda não pagou) e Pago (você já pagou — e nesse momento entra a despesa no Financeiro). Você muda o status pelos botões da linha ou pela ação em massa, conforme o trabalho avança.' },
      { pergunta: 'Cadastrei o valor errado num trabalho. Como corrijo?', resposta: 'Se o trabalho ainda NÃO foi marcado como Pago, clique no lápis (editar) na linha dele e ajuste os produtos, quantidades e valores. Depois de pago, ele já virou despesa no Financeiro, então a correção envolve também o lançamento financeiro — nesse caso, o ideal é conferir com atenção antes de confirmar o pagamento. Editar e excluir são ações da administradora.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  DEMANDAS · HISTÓRICO
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'demandas-historico',
    modulo: 'Demandas',
    tela: 'Histórico de Trabalhos',
    caminho: 'Módulos → Trabalhos de Freelancer → Histórico',
    palavrasChave: 'historico de trabalhos, historico de demandas, todos os trabalhos, filtrar por periodo, filtrar por freelancer, filtrar por status, quanto paguei no mes, relatorio de freelancers, total pago periodo, a pagar periodo, itens produzidos, buscar trabalho antigo, ver trabalhos passados',
    conteudo:
      '📍 ONDE FICA\nMódulos → Trabalhos de Freelancer → Histórico (tela clara, também em formato de planilha).\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o livro-caixa dos trabalhos: TODOS os trabalhos que você já mandou pra freelancers, do começo ao fim. Serve pra consultar o passado e responder perguntas como "quanto paguei em março?", "quantas peças a Cida fez?", "quanto ainda devo no total?". É só consulta — aqui você não cria nem edita, só olha e filtra.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense no recorte que você quer ver: um período (De/Até), uma freelancer específica, um status, ou uma palavra pra buscar.\n\n' +
      '👣 PASSO A PASSO\n1. Use a busca pra achar por freelancer, descrição ou pedido.\n2. Filtre por freelancer no seletor "Todas as freelancers".\n3. Filtre por status (Pendente, Em produção, Produzido, Pago).\n4. Escolha o período nos campos De e Até.\n5. Os quatro números no topo se ajustam ao filtro: total de trabalhos, itens, "A pagar" e "Pago" naquele recorte.\n6. No rodapé da tabela aparecem os totais do filtro. Clique em "Limpar" pra tirar todos os filtros.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA tela pega todos os trabalhos e aplica os filtros na hora, ali no seu recorte. Os totais somam só o que está aparecendo: os pagos entram em "Pago" e os não pagos em "A pagar". Assim, mudando o período, você vê o resumo daquele mês ou semana automaticamente.\n\n' +
      '⚠️ ERROS COMUNS\n- Achar que dá pra editar aqui: não dá; pra criar, pagar ou mudar status, use a tela principal de Trabalhos.\n- Esquecer um filtro ligado e achar que "sumiram" trabalhos: se aparece pouca coisa, clique em "Limpar" pra ver tudo de novo.\n- Confundir "A pagar" com "Pago": o laranja é o que você ainda deve; o verde é o que já saiu.\n\n' +
      '💬 EXEMPLO SOFIA\nNo fim do mês, Sofia quer saber quanto gastou com freelancers. Ela abre o Histórico, põe De 01/06 e Até 30/06, e o topo mostra: 12 trabalhos, 180 itens, R$ 0 a pagar e R$ 360 pago. Depois filtra só pela Cida e vê que R$ 200 daquele total foram pra ela. Tudo sem abrir planilha nenhuma.',
    faq: [
      { pergunta: 'Qual a diferença entre "Trabalhos" e "Histórico de Trabalhos"?', resposta: 'Na tela de Trabalhos você trabalha de verdade: cria trabalhos novos, muda status, paga, edita e exclui. O Histórico é só pra consultar o passado — ele mostra todos os trabalhos com filtros por período, freelancer e status, e soma os totais do recorte, mas não deixa alterar nada. Pense no Histórico como o extrato e na tela de Trabalhos como a conta onde você mexe.' },
      { pergunta: 'Como vejo quanto gastei com freelancers em um mês específico?', resposta: 'Abra o Histórico e preencha os campos De e Até com o começo e o fim do mês. Os quatro números no topo se ajustam ao período: veja o "Pago" (verde) pra saber quanto já saiu e o "A pagar" (laranja) pra saber quanto ainda deve daquele período. Se quiser afinar, filtre também por uma freelancer específica. Pra voltar a ver tudo, clique em "Limpar".' },
      { pergunta: 'Não estou achando um trabalho antigo. O que pode ser?', resposta: 'Provavelmente tem algum filtro ligado escondendo ele. Clique em "Limpar" pra remover todos os filtros (busca, freelancer, status e período) e a lista completa volta. Depois, use a busca digitando o nome da freelancer, a descrição do produto ou o número do pedido pra localizar mais rápido.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  DEMANDAS · FREELANCERS (atalho dentro de Demandas)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'demandas-freelancers-lista',
    modulo: 'Demandas',
    tela: 'Freelancers (dentro de Trabalhos)',
    caminho: 'Módulos → Trabalhos de Freelancer → Freelancers',
    palavrasChave: 'freelancers no menu de trabalhos, lista de freelancers, cadastrar freelancer rapido, novo freelancer, ativar desativar freelancer, editar freelancer, excluir freelancer, pix telefone especialidade, atalho freelancers demandas',
    conteudo:
      '📍 ONDE FICA\nMódulos → Trabalhos de Freelancer → Freelancers (atalho a partir da tela de Trabalhos).\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a mesma agendinha de freelancers, num acesso rápido de dentro do menu de Trabalhos — pra você cadastrar ou ajustar uma pessoa sem sair pro menu de Configurações. Cada cartão mostra a inicial do nome, especialidade, WhatsApp e PIX.\n\n' +
      '✅ ANTES DE COMEÇAR\nNome é obrigatório; WhatsApp e PIX são opcionais mas ajudam muito. No topo aparece quantos freelancers estão ativos e inativos.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Novo Freelancer".\n2. Preencha Nome (obrigatório), Especialidade, Telefone/WhatsApp, Chave PIX e Observações.\n3. Clique em "Cadastrar".\n4. Ativar/Desativar: clique na chavinha (verde = ativo). Editar: lapisinho. Excluir: lixeirinha.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nÉ a mesma lista de freelancers usada nos trabalhos — o que você cadastra aqui aparece na hora de criar uma demanda, e vice-versa. Desativar tira das listas ativas mas mantém o histórico. Excluir aqui avisa que trabalhos vinculados não serão afetados.\n\n' +
      '⚠️ ERROS COMUNS\n- Cadastrar a mesma pessoa duas vezes: confira a lista antes de criar.\n- Excluir em vez de desativar: se ela ainda produz de vez em quando, desative; assim é fácil reativar depois.\n- Esquecer o PIX: sem ele, na hora de pagar você vai ter que procurar a chave por fora.\n\n' +
      '💬 EXEMPLO SOFIA\nEnquanto criava um trabalho, Sofia percebeu que a nova ajudante, Rê, ainda não estava cadastrada. Ela clicou em "Freelancers" ali mesmo, cadastrou a Rê com WhatsApp e PIX em 30 segundos, voltou e já escolheu ela no trabalho.',
    faq: [
      { pergunta: 'Essa lista de freelancers é diferente da que fica em Configurações?', resposta: 'Não, é a mesma lista, só acessada por um atalho dentro do menu de Trabalhos de Freelancer. O que você cadastra em um lugar aparece no outro. A vantagem é praticidade: se você está montando um trabalho e falta cadastrar alguém, resolve ali mesmo sem navegar até as Configurações.' },
      { pergunta: 'Desativei um freelancer sem querer, e agora?', resposta: 'Sem problema, é reversível. Clique na chavinha dele de novo pra reativar (ela fica verde quando ativo). Desativar só tira a pessoa das listas ativas, sem apagar nada; o histórico e os dados continuam guardados.' },
      { pergunta: 'Se eu excluir um freelancer aqui, os trabalhos dele somem?', resposta: 'Não. Ao excluir, o sistema avisa que os trabalhos vinculados não serão afetados — o histórico dos trabalhos continua. Ainda assim, se a pessoa tiver trabalhos ligados, o mais seguro é desativar em vez de excluir, pra manter tudo organizado e poder consultar depois.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  DEMANDAS · PREÇOS POR PEÇA
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'demandas-precos',
    modulo: 'Demandas',
    tela: 'Preços por peça',
    caminho: 'Módulos → Trabalhos de Freelancer → Preços por peça',
    palavrasChave: 'precos por peca, valor por peca, tabela de precos freelancer, quanto pago por peca, cadastrar preco, preco geral, preco por freelancer, reutilizar preco, ativar desativar preco, editar preco, excluir preco, preco padrao freelancer',
    conteudo:
      '📍 ONDE FICA\nMódulos → Trabalhos de Freelancer → Preços por peça (tela escura).\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a sua tabelinha de "quanto eu pago por cada peça". Você cadastra uma vez o valor que paga por um tipo de peça (ex.: laço modelo A = R$ 2,00) e, na hora de criar um trabalho, é só escolher da lista em vez de digitar o valor toda vez. Economiza tempo e evita errar o preço.\n\n' +
      '✅ ANTES DE COMEÇAR\nDecida se o preço vale pra todas as freelancers (Geral) ou só pra uma específica. Você pode ter os dois: um preço geral e um valor diferente combinado com uma pessoa.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Novo preço".\n2. Digite o Produto (ex.: Laço modelo A, Cofrinho personalizado).\n3. Informe o Valor por peça (R$).\n4. Em Freelancer, deixe "Geral — vale para todos" ou escolha uma pessoa pra um valor específico dela.\n5. Clique em "Cadastrar".\n6. Ativar/Inativar pelo selo; editar pelo lápis; excluir pela lixeirinha.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs preços cadastrados aparecem numa listinha ao montar um trabalho: os "Geral" valem pra qualquer freelancer, e os específicos aparecem quando você escolhe aquela freelancer. Ao escolher um preço, o nome do produto e o valor já entram preenchidos no trabalho — você ainda pode mudar na mão se aquele caso for diferente. Só os preços ativos aparecem como sugestão.\n\n' +
      '⚠️ ERROS COMUNS\n- Cadastrar tudo como preço de uma freelancer só, quando na verdade vale pra todas: use "Geral" pra reaproveitar com qualquer pessoa.\n- Desativar um preço e estranhar que sumiu das sugestões: preços inativos não aparecem na hora de criar o trabalho; reative se precisar.\n- Achar que o preço trava o valor: não trava — ele só preenche pra agilizar; você pode ajustar no trabalho.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia sempre paga R$ 2,00 pelo laço modelo A e R$ 3,50 pelo modelo B. Ela cadastra os dois como "Geral". Agora, toda vez que cria um trabalho, escolhe da lista e o valor já vem certo — sem digitar de novo nem correr o risco de errar. Pra Cida, que cobra um pouquinho a mais no modelo B, ela cadastra um preço específico só pra Cida.',
    faq: [
      { pergunta: 'Para que servem os "Preços por peça"?', resposta: 'Servem pra você não digitar o valor toda vez que cria um trabalho. Você cadastra uma vez quanto paga por cada tipo de peça, e depois, ao montar um trabalho, escolhe da listinha — o produto e o valor já entram preenchidos. É um jeito de padronizar seus pagamentos e ganhar tempo. Você ainda pode alterar o valor manualmente naquele trabalho, se for um caso diferente.' },
      { pergunta: 'Qual a diferença entre preço "Geral" e por freelancer?', resposta: 'Um preço "Geral — vale para todos" aparece como sugestão pra qualquer freelancer que você escolher no trabalho. Já um preço com uma freelancer específica só aparece quando você seleciona aquela pessoa. Use o Geral pra valores padrão que valem pra todo mundo, e o específico quando combinou um valor diferente com uma freelancer em particular.' },
      { pergunta: 'Cadastrei um preço mas ele não aparece ao criar o trabalho. Por quê?', resposta: 'Duas causas comuns: ou o preço está Inativo (só os ativos aparecem como sugestão — reative pelo selo), ou ele é específico de outra freelancer, diferente da que você escolheu no trabalho. Confira se o preço está ativo e se é "Geral" ou da freelancer certa.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  DEMANDAS · CONFIGURAÇÃO DE PAGAMENTO (por produto/variação)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'demandas-config-pagamento',
    modulo: 'Demandas',
    tela: 'Configuração de Pagamento',
    caminho: 'Módulos → Trabalhos de Freelancer → Configuração de Pagamento',
    palavrasChave: 'configuracao de pagamento, valor por item por produto, quanto paga freelancer por produto, definir valor freelancer, variacao, canal de venda, custo total, salvar valor por item, preenche automatico no trabalho, precificacao produtos freelancer, valor padrao por produto',
    conteudo:
      '📍 ONDE FICA\nMódulos → Trabalhos de Freelancer → Configuração de Pagamento.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ parecida com "Preços por peça", mas ligada aos seus produtos da Precificação. Aqui você abre a lista dos seus produtos (com canal, variação e custo) e, ao lado de cada um, define quanto a freelancer ganha por item daquele produto. Depois, ao criar um trabalho pra esse produto, o valor já vem preenchido sozinho. É afinar o pagamento produto por produto.\n\n' +
      '✅ ANTES DE COMEÇAR\nSeus produtos precisam estar cadastrados na Precificação (é de lá que vem a lista). Tenha em mente quanto quer pagar por item de cada produto.\n\n' +
      '👣 PASSO A PASSO\n1. Use a busca pra achar por produto, SKU ou canal.\n2. Na linha do produto, veja o Custo total (só informativo) e o campo "R$ por item (freelancer)".\n3. Digite o valor que você paga por item daquele produto.\n4. Clique em "Salvar" (ou aperte Enter no campo). Aparece "✓ Salvo" em verde.\n5. Repita pros outros produtos. O botão de recarregar (no topo) atualiza a lista.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada produto (com sua variação e canal) guarda um valor por item pro freelancer. Quando você cria um trabalho pra aquele produto, o sistema já preenche esse valor automaticamente — e você ainda pode alterar na hora se aquele caso for diferente. O custo total mostrado é só pra te ajudar a decidir um valor justo; ele não é o que a freelancer recebe.\n\n' +
      '⚠️ ERROS COMUNS\n- Confundir o "Custo total" com o valor da freelancer: o custo é referência; o que a freelancer recebe é o que você digita em "R$ por item".\n- Digitar o valor e esquecer de salvar: clique em "Salvar" ou aperte Enter até aparecer o "✓ Salvo".\n- Não achar um produto: confira se ele está ativo na Precificação; a lista vem de lá.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia paga valores diferentes conforme o laço. No laço grande, que dá mais trabalho, ela define R$ 3,00 por item; no pequeno, R$ 1,50. Ela busca cada produto, digita o valor, aperta Enter e vê o "✓ Salvo". Agora, quando cria um trabalho pra qualquer um desses laços, o valor certo já aparece sozinho.',
    faq: [
      { pergunta: 'Qual a diferença entre "Configuração de Pagamento" e "Preços por peça"?', resposta: 'As duas servem pra preencher o valor automaticamente ao criar um trabalho, mas partem de lugares diferentes. "Preços por peça" é uma tabelinha livre, onde você escreve o nome do produto do seu jeito. A "Configuração de Pagamento" usa a lista real dos seus produtos da Precificação (com canal, variação e custo), e você define o valor por item ao lado de cada produto já cadastrado. Use a Configuração de Pagamento quando quiser amarrar o valor aos produtos que você já tem precificados.' },
      { pergunta: 'O "Custo total" que aparece é o que eu pago pra freelancer?', resposta: 'Não. O Custo total é só uma informação de referência, vinda da Precificação, pra te ajudar a decidir um valor justo. O que a freelancer efetivamente recebe é o que você digita no campo "R$ por item (freelancer)". São coisas diferentes: um é o custo do produto, o outro é o pagamento da mão de obra.' },
      { pergunta: 'Digitei o valor mas não sei se salvou. Como confirmo?', resposta: 'Depois de digitar o valor no campo, clique no botão "Salvar" da linha (ou simplesmente aperte Enter dentro do campo). Quando salva, aparece "✓ Salvo" em verde no lugar do botão, e o campo fica com uma borda verdinha por um instante. Se não apareceu, é porque ainda não foi salvo — clique de novo.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  SUPORTE · CENTRAL DE SUPORTE
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'suporte-central',
    modulo: 'Suporte',
    tela: 'Central de Suporte',
    caminho: 'Módulos → Suporte',
    palavrasChave: 'suporte, central de suporte, ajuda, tirar duvida, perguntas frequentes, faq, falar com ia, assistente, chat de ajuda, abrir chamado, protocolo, enviar feedback, reportar bug, sugestao, melhoria, telegram, atendimento humano, meus chamados, acompanhar chamado, print de tela, anexar imagem, reabrir chamado, resposta da equipe',
    conteudo:
      '📍 ONDE FICA\nMódulos → Suporte. No topo, os botões "Abrir Chamado" e "Feedback"; abaixo, um banner do Telegram e três abas: Perguntas Frequentes, Falar com IA e Meus Chamados.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o seu ponto de ajuda dentro do sistema. Tem quatro caminhos, do mais rápido ao mais humano: procurar nas Perguntas Frequentes, conversar com a assistente pra resolver na hora, falar com a equipe pelo Telegram, ou abrir um chamado/feedback pra equipe te responder. É como ter um balcão de atendimento sempre aberto.\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha à mão, se puder, um print da tela do problema (ajuda muito a equipe entender) e seu WhatsApp pra retorno.\n\n' +
      '👣 PASSO A PASSO\n1. Perguntas Frequentes: digite sua dúvida na busca ou escolha uma categoria; clique numa pergunta pra abrir a resposta. Se não achar, clique em "Perguntar para a IA".\n2. Falar com IA: digite sua dúvida e receba o passo a passo na hora. Dá pra anexar uma imagem pelo clipe. Se não resolver, aparecem os botões de Telegram e de abrir chamado.\n3. Abrir Chamado: clique no botão laranja. Informe seu WhatsApp (pra agilizar), descreva o problema e, se quiser, anexe um print (até 3MB). Ao enviar, você recebe um número de Protocolo. A equipe responde no seu e-mail.\n4. Feedback: clique em "Feedback", escolha o tipo (🐛 Bug, ✨ Melhoria, 💡 Sugestão), dê um título, descreva, informe o WhatsApp e envie. Também gera protocolo.\n5. Meus Chamados: acompanhe seus chamados e feedbacks, veja a resposta da equipe e troque mensagens (mini chat) em cada um.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA busca das Perguntas Frequentes filtra por categoria e texto. A assistente responde na hora, passo a passo, e guarda a conversa pra, se você abrir um chamado, enviar a última resposta junto e ajudar a equipe. Chamados e feedbacks ganham um protocolo e ficam salvos no seu histórico com um status (Aberto, Em atendimento/análise, Resolvido/Concluído). Se você mandar uma nova mensagem num item já resolvido, ele reabre automaticamente pra equipe olhar de novo.\n\n' +
      '⚠️ ERROS COMUNS\n- Abrir chamado sem WhatsApp: é obrigatório pra agilizar o atendimento.\n- Esquecer de anotar o protocolo: guarde-o pra acompanhar em "Meus Chamados".\n- Print pesado demais: no chamado o limite é 3MB; no chat, 2MB.\n- Achar que ninguém respondeu: confira a aba "Meus Chamados" e o seu e-mail — a resposta da equipe aparece lá, e você pode responder pelo mini chat.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia não conseguia salvar um produto. Primeiro perguntou pra assistente, que deu um passo a passo, mas o botão continuava sem funcionar. Aí ela clicou em "Abrir Chamado", pôs o WhatsApp, descreveu o problema e anexou um print da tela. Recebeu o protocolo. No dia seguinte, viu em "Meus Chamados" a resposta da equipe, respondeu pelo mini chat com uma dúvida a mais, e o chamado reabriu sozinho pra equipe continuar.',
    faq: [
      { pergunta: 'Qual a diferença entre falar com a IA, abrir chamado e o Telegram?', resposta: 'São três velocidades de ajuda. A assistente (Falar com IA) responde na hora, a qualquer momento, com o passo a passo — ótima pra dúvidas de "como faço tal coisa". O Telegram te leva pra um atendimento humano da equipe, com resposta em até 24h úteis. Abrir Chamado registra o seu problema com protocolo e a equipe responde pelo seu e-mail — bom pra problemas que precisam de análise, ainda mais se você anexar um print. Comece pela IA ou pela FAQ; se não resolver, use Telegram ou chamado.' },
      { pergunta: 'Como abro um chamado e acompanho a resposta?', resposta: 'Clique em "Abrir Chamado" no topo da Central de Suporte. Informe seu WhatsApp (obrigatório, pra agilizar), descreva o problema com detalhes e, se puder, anexe um print da tela (até 3MB). Ao enviar, você recebe um número de Protocolo — anote. A equipe responde no seu e-mail, e você também acompanha tudo na aba "Meus Chamados", onde vê o status (Aberto, Em atendimento, Resolvido), a resposta da equipe e pode trocar mensagens pelo mini chat de cada chamado.' },
      { pergunta: 'Qual a diferença entre Chamado e Feedback?', resposta: 'Um Chamado é pra quando você precisa de ajuda com um problema ou dúvida — a equipe te responde pra resolver. O Feedback é pra você contar algo sobre o sistema: um Bug (🐛 algo com defeito), uma Melhoria (✨ algo que dá pra deixar melhor) ou uma Sugestão (💡 uma ideia nova). Os dois geram protocolo e retorno pela equipe, mas o chamado é sobre resolver a sua situação e o feedback é sobre melhorar o sistema pra todo mundo.' },
      { pergunta: 'Meu chamado foi marcado como resolvido mas ainda tenho dúvida. E agora?', resposta: 'É só escrever uma nova mensagem no mini chat daquele chamado, dentro da aba "Meus Chamados". Ao enviar, o chamado reabre automaticamente e volta pra fila da equipe — o próprio sistema avisa: "Enviar mensagem reabre o chamado automaticamente". O mesmo vale pros feedbacks concluídos. Assim você não precisa abrir tudo de novo do zero.' },
      { pergunta: 'Preciso mandar um print pra explicar melhor. Como faço?', resposta: 'Em vários lugares você pode anexar imagem. No Abrir Chamado e no Feedback, há um espaço "Print de tela" — clique e escolha a imagem (PNG, JPG ou WEBP, até 3MB). No chat com a IA, use o ícone de clipe ao lado do campo de escrever (até 2MB). E no mini chat de um chamado, o iconezinho de imagem anexa um print (até 2MB). Mandar print ajuda muito a equipe a entender o que está acontecendo.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  PRIMEIROS PASSOS · HUB DE MÓDULOS
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'primeiros-passos-hub-modulos',
    modulo: 'Primeiros passos',
    tela: 'Hub de Módulos (tela inicial)',
    caminho: 'Módulos (tela inicial após o login)',
    palavrasChave: 'tela inicial, pagina inicial, hub, menu principal, modulos, onde fica cada coisa, producao, precificacao, financeiro, analise do negocio, calendario, orcamentos, clientes, fornecedores, minha loja, tarefas, configuracoes, sair, logout, novidades, oportunidades, banner, em breve',
    conteudo:
      '📍 ONDE FICA\nÉ a primeira tela que aparece depois que você entra (faz login). Fica no endereço de Módulos.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o "hall de entrada" do sistema: um painel com todos os módulos (as áreas) em cartões, pra você clicar e ir pra onde quer. Também traz novidades do artesanato, oportunidades/descontos e, às vezes, um banner. É o seu ponto de partida pra tudo.\n\n' +
      '✅ ANTES DE COMEÇAR\nOs cartões que você vê dependem do seu perfil (administradora vê tudo; delegadora e operadora veem menos) e dos módulos que estão ligados nas Configurações. Se um cartão não aparece, provavelmente o módulo está desligado ou seu perfil não tem acesso.\n\n' +
      '👣 PASSO A PASSO\n1. Clique no cartão do que você quer usar. Os principais: Produção (pedidos e trabalhos), Precificação (materiais, produtos, custos), Financeiro (entradas, saídas, caixa), Análise do Negócio (conversa com a assistente sobre seus números), Calendário, Orçamentos, Clientes, Fornecedores, Minha Loja, Tarefas e Configurações.\n2. Cartões escritos "Em breve" (ex.: Nota Fiscal, Marketplaces) ainda não estão disponíveis — são um aperitivo do que vem.\n3. Na coluna lateral, veja "Novidades do Artesanato" e "Oportunidades e Descontos".\n4. Pra sair da conta, clique em "Sair" no canto superior.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA tela monta os cartões conforme o seu perfil e os módulos ligados. Se o seu ateliê ainda não tem setores de produção configurados, o sistema te leva automaticamente pra tela de configuração inicial (Setup) antes de liberar o hub. As novidades e oportunidades vêm de avisos do sistema.\n\n' +
      '⚠️ ERROS COMUNS\n- Não achar um módulo: confira se ele está ligado em Configurações → Geral → Módulos, e se o seu perfil tem acesso a ele.\n- Clicar num cartão "Em breve" e nada abrir: é esperado; ele ainda não está pronto.\n- Confundir "Produção" (o dia a dia dos pedidos) com "Configurações" (onde se ajustam setores e campos).\n\n' +
      '💬 EXEMPLO SOFIA\nSofia entra e cai no hub. Ela clica em "Produção" pra ver os pedidos do dia, depois volta e vai em "Financeiro" pra conferir o caixa. Vê na lateral uma novidade sobre uma feira de artesanato e um desconto num fornecedor. No fim do dia, clica em "Sair".',
    faq: [
      { pergunta: 'Um módulo que eu usava sumiu da tela inicial. O que houve?', resposta: 'Duas causas possíveis. Primeira: o módulo foi desligado em Configurações → Geral → Módulos — a administradora pode religar a chavinha. Segunda: o seu perfil de acesso não inclui aquele módulo (por exemplo, operadoras e delegadoras veem menos cartões que a administradora). Confira as duas coisas. Nenhum dado é perdido quando um módulo some do menu.' },
      { pergunta: 'O que são os cartões escritos "Em breve"?', resposta: 'São módulos que ainda estão sendo preparados e ainda não podem ser usados, como Emissão de Nota Fiscal e Integração com Marketplaces. Eles aparecem meio apagados, só pra você saber que estão chegando. Clicar neles não abre nada por enquanto.' },
      { pergunta: 'Fui direto pra uma tela de configuração inicial em vez do menu. Por quê?', resposta: 'Isso acontece quando o seu ateliê ainda não tem os setores de produção configurados. O sistema te leva primeiro pra tela de configuração inicial (o Setup), pra você montar as etapas do seu trabalho. Depois de concluir, você passa a cair normalmente no hub de módulos.' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  //  PRIMEIROS PASSOS · SETUP (onboarding)
  // ═══════════════════════════════════════════════════════════════
  {
    slug: 'primeiros-passos-setup-inicial',
    modulo: 'Primeiros passos',
    tela: 'Configuração inicial (Setup)',
    caminho: 'Tela de boas-vindas (primeiro acesso, antes de usar o sistema)',
    palavrasChave: 'primeiro acesso, comecar a usar, configuracao inicial, setup, onboarding, escolher tipo de negocio, segmento, template de setores, montar setores, etapas iniciais, bem vindo, comecar do zero, personalizado, arrastar setores, reordenar, adicionar setor, finalizar configuracao',
    conteudo:
      '📍 ONDE FICA\nAparece sozinha no primeiro acesso, na tela de boas-vindas "Bem-vindo ao SOA!", antes de o sistema liberar o resto.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o passo zero: o sistema pergunta que tipo de artesanato você faz pra já montar pra você as etapas de produção (setores) daquele ramo. Em vez de começar com a tela vazia, você sai daqui com uma esteira pronta, que pode ajustar. É como comprar um móvel já pré-montado: vem quase pronto, você só afina.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense no seu tipo principal de trabalho. Se ele não estiver na lista, existe a opção "Personalizado", pra montar tudo do zero.\n\n' +
      '👣 PASSO A PASSO\n1. Na grade de opções, clique no tipo do seu negócio (Laços e Tiaras, Biscuit, Sublimação, Costura, Festas, Resina...). Cada um vem com um conjunto de setores sugeridos.\n2. Apareceu a lista de setores do template. Edite: arraste pra reordenar, use as setinhas ↑↓, ou clique no × pra remover um que você não usa.\n3. Pra incluir uma etapa sua, digite o nome no campo de baixo e clique em "+ Adicionar".\n4. Se escolheu "Personalizado", a lista começa vazia — adicione seus setores um a um.\n5. Quando a esteira estiver do seu jeito, clique em "Começar a usar o SOA". Pronto: seus setores estão criados e você vai pro hub.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nAo finalizar, o sistema cria de verdade os setores que você montou, na ordem definida, e guarda o segmento escolhido. É isso que faz o hub liberar depois. Se o seu ateliê já tem setores configurados, essa tela nem aparece — ela é só pro começo. Você pode continuar ajustando os setores depois em Configurações → Produção.\n\n' +
      '⚠️ ERROS COMUNS\n- Tentar avançar sem escolher o tipo do negócio ou com a lista de setores vazia: o sistema pede pra escolher o segmento e ter pelo menos um setor.\n- Achar que a escolha aqui é definitiva: não é; tudo pode ser ajustado depois em Configurações → Produção (renomear, reordenar, adicionar, marcar expedição).\n- Deixar de lado a etapa de Expedição: o último setor costuma ser o de envio; você marca qual é o de expedição depois, na configuração de Produção.\n\n' +
      '💬 EXEMPLO SOFIA\nNo primeiro acesso, Sofia vê a tela de boas-vindas. Ela clica em "Laços e Tiaras" e aparecem setores prontos: Pedido, Arte, Produção, Controle de Qualidade, Embalagem, Expedição. Ela acha que não usa "Controle de Qualidade", clica no × pra tirar, arruma a ordem e clica em "Começar a usar o SOA". Em segundos, sua produção já está montada e ela começa a cadastrar pedidos.',
    faq: [
      { pergunta: 'Escolhi o tipo de negócio errado no começo. Dá pra mudar?', resposta: 'Sim, sem preocupação. Tudo o que é montado no Setup pode ser ajustado depois em Configurações → Produção: você renomeia setores, muda a ordem, adiciona novos, remove os que não usa e marca qual é o de expedição. O segmento também pode ser trocado em Configurações → Geral. O Setup é só um ponto de partida pra você não começar do zero.' },
      { pergunta: 'Meu tipo de artesanato não está na lista. O que faço?', resposta: 'Escolha a opção "Personalizado" (a última, com a engrenagem). Ela começa com a lista de setores vazia e deixa você montar suas próprias etapas do zero: digite o nome de cada setor no campo e clique em "+ Adicionar", quantas etapas precisar, e reordene arrastando. Assim o sistema fica com a cara exata do seu trabalho.' },
      { pergunta: 'Não consigo clicar em "Começar a usar o SOA". Por quê?', resposta: 'O botão só libera quando você escolheu um tipo de negócio E tem pelo menos um setor na lista. Se estiver travado, confira: você clicou num dos cartões de segmento? A lista de setores tem ao menos uma etapa? Se escolheu "Personalizado", precisa adicionar pelo menos um setor antes de finalizar.' },
    ],
  },

]
