import type { EntradaConhecimento } from '../tipos'

// Base RICA de conhecimento — módulos Clientes, Tarefas e Assistente de Compras.
// Escrita para artesãs LEIGAS: professora paciente, zero jargão, tom de amiga com substância.
// Cada conteudo tem 8 seções: ONDE FICA · O QUE É · ANTES DE COMEÇAR · PASSO A PASSO ·
// COMO FUNCIONA POR TRÁS · ERROS COMUNS · SE LIGA COM · EXEMPLO SOFIA.

export const ENTRADAS: EntradaConhecimento[] = [
  // ═══════════════════════════════ CLIENTES ═══════════════════════════════
  {
    slug: 'clientes-lista',
    modulo: 'Clientes',
    tela: 'Lista de Clientes',
    caminho: 'Menu → Clientes → Clientes',
    palavrasChave: 'clientes, minha lista de clientes, onde vejo meus clientes, procurar cliente, buscar pelo nome, achar telefone da cliente, achar email, filtrar ativos, filtrar inativos, ordenar por nome, ordenar por valor, quem compra mais, cliente que mais gastou, importado, quantos pedidos cada cliente fez, total de clientes, paginacao, proxima pagina, cliente sumido, nao acho a fulana',
    conteudo:
      '📍 ONDE FICA\nNo menu do lado, clique em "Clientes" e depois em "Clientes". É a tela principal, a primeira coisa que abre. No topo tem dois cartõezinhos (Total de clientes e Ativos), embaixo a barra de busca e a lista com todo mundo cadastrado.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nPense nesta tela como a sua velha agenda de contatos, só que muito mais esperta. Além de guardar nome, telefone e e-mail de cada cliente, ela já te conta, do lado de cada pessoa, quantos pedidos ela já fez com você e quanto dinheiro ela já gastou no total. É a sua caderneta de fregueses digital: num piscar de olhos você sabe quem é cliente antigo, quem gasta mais e quem some faz tempo.\n\n' +
      '✅ ANTES DE COMEÇAR\nO menu "Clientes" só aparece se o módulo estiver ligado (isso se faz em Config → Geral → Módulos). Se você é dona do ateliê (perfil ADMIN) já enxerga tudo; se você é uma ajudante/operadora, o sistema te leva para outra tela, porque essa área é da administração. Não precisa cadastrar ninguém antes: dá para começar do zero.\n\n' +
      '👣 PASSO A PASSO\n1. Olhe os dois cartões no topo: "Total de clientes" (quantas pessoas você tem cadastradas) e "Ativos" (quantas estão em uso, sem contar as que você guardou/arquivou).\n2. Na caixa de busca (a lupa), digite o que quiser: um pedaço do nome, um e-mail ou um número de telefone. A lista vai se filtrando sozinha enquanto você digita — não precisa apertar Enter. Para limpar, clique no X do lado.\n3. No seletor "Todos", escolha se quer ver Todos, só os Ativos ou só os Inativos.\n4. No seletor de ordenação, escolha a ordem: Nome A→Z, Nome Z→A, Mais pedidos (SOA), Mais pedidos (importados), Maior valor ou Mais recentes.\n5. Cada linha é um cliente. Clicando no NOME, você abre a ficha completa dela. Do lado direito de cada linha tem um lápis (editar rapidinho) e uma lixeira (excluir).\n6. Lá embaixo, os botões "Anterior" e "Próxima" viram as páginas — a lista mostra 30 clientes por vez.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs números de "Pedidos" e "Total" ao lado de cada cliente não são digitados por você: o sistema soma sozinho os pedidos que estão amarrados àquela pessoa. Existe uma diferença importante: "Pedidos" (em cinza) são os pedidos registrados aqui dentro do sistema; já "importados" (em amarelinho) são pedidos que vieram de uma planilha antiga, quando você migrou seus dados. Eles ficam separados de propósito, para o retrato antigo não se misturar com o que está acontecendo agora. A busca vasculha nome, e-mail, telefone e também os contatos extras. Como a lista mostra 30 por vez, mudar a busca, o filtro ou a ordem sempre te joga de volta para a página 1.\n\n' +
      '⚠️ ERROS COMUNS\n- "Sumiu o menu Clientes": o módulo foi desligado em Config → Geral, ou você entrou com um usuário de ajudante (operadora).\n- "Cadastrei a cliente e ela não aparece": confira se o filtro não está em "Inativos", ou se a busca não ficou com alguma letra digitada.\n- Confundir "Pedidos" (cinza, do sistema) com "importados" (amarelo, da planilha antiga). São coisas diferentes e por isso não somam juntas.\n- Achar que a lista acabou quando ela só está mostrando a primeira página de 30 — role até o fim e use "Próxima".\n\n' +
      '🔗 SE LIGA COM\nClientes conversa com quase tudo: quando você cria um Pedido na Produção e escolhe a cliente, aquele pedido entra no histórico dela automaticamente. No Financeiro, os lançamentos amarrados a uma cliente aparecem na ficha dela. Nas Tarefas, cada card pode apontar para uma cliente. E no Assistente de Compras nada é pessoal — ali os dados são anônimos.\n\n' +
      '💬 EXEMPLO SOFIA\nSofia faz lembrancinhas e já perdeu a conta de quantas encomendas fez para a Dona Marta. Ela abre Clientes → Clientes, digita "Marta" na lupa e, na hora, vê que a Dona Marta já fez 8 pedidos e gastou R$ 640,00 no total. Sofia pensa: "Nossa, ela é cliente fiel!". Clica no nome, vê o histórico completo e decide mandar um mimo de agradecimento na próxima entrega.',
    faq: [
      {
        pergunta: 'Qual a diferença entre "Pedidos" e "importados" que aparecem do lado do cliente?',
        resposta:
          'São duas contagens diferentes de propósito. "Pedidos" (o número em cinza) conta as encomendas que você registrou aqui dentro do sistema, no dia a dia. Já "importados" (o número amarelinho) conta pedidos antigos que vieram junto quando você trouxe seus dados de uma planilha para cá — é um retrato do passado, uma foto da sua vida antes do sistema. O sistema mantém os dois separados para não bagunçar: assim você sabe exatamente o que aconteceu aqui dentro e o que é herança da planilha antiga. Se a cliente nunca teve importação, o número amarelo simplesmente não aparece.',
      },
      {
        pergunta: 'Sumiu um cliente que eu tinha certeza que cadastrei. Para onde foi?',
        resposta:
          'Na imensa maioria das vezes é uma de três coisas, e todas têm solução fácil. Primeira: o seletor de status pode estar em "Ativos" e a cliente foi inativada (arquivada) em algum momento — mude para "Todos" ou "Inativos" e ela reaparece. Segunda: pode ter sobrado alguma letra na caixa de busca filtrando a lista — clique no X para limpar. Terceira: você pode estar olhando só a primeira página; a lista mostra 30 por vez, então clique em "Próxima" lá embaixo. Se mesmo assim não achar, tente buscar por parte do telefone ou do e-mail, porque a busca também procura nesses campos.',
      },
      {
        pergunta: 'Como eu descubro quem são meus melhores clientes?',
        resposta:
          'Use o seletor de ordenação no alto da lista. Escolha "Maior valor" para ver primeiro quem já gastou mais dinheiro com você no total, ou "Mais pedidos (SOA)" para ver quem comprou mais vezes. A lista se reorganiza na hora, colocando essas pessoas no topo. Se quiser uma visão ainda mais bonita, com ranking e gráfico, entre em Clientes → Visão Geral, que traz um painel dedicado aos seus melhores clientes.',
      },
      {
        pergunta: 'A lista só mostra alguns clientes. Cadê o resto?',
        resposta:
          'A tela mostra 30 clientes por página para não ficar pesada e lenta. Se você tem mais que isso, os demais estão nas próximas páginas — é só rolar até o fim da lista e clicar em "Próxima". O rodapé te avisa em qual página você está e quantas existem no total (por exemplo "página 1 de 4"). Se você quiser encurtar a lista para achar alguém específico, o jeito mais rápido é digitar o nome na busca.',
      },
      {
        pergunta: 'Digitei um cliente novo no pedido e ele não apareceu na lista de clientes. Por quê?',
        resposta:
          'Agora aparece, querida! Quando você lança um pedido e digita um nome de cliente que ainda não existe (sem escolher um da listinha), o sistema cria esse cliente sozinho e já amarra o pedido a ele — então ele passa a aparecer na sua lista de Clientes e o pedido entra no histórico de compras dele. Se o nome digitado for igualzinho a um cliente que você já tem, o sistema reaproveita o cadastro existente em vez de criar um repetido. Só uma dica: como esse cadastro automático nasce só com o nome, vale abrir a ficha depois para completar telefone, e-mail e endereço. Obs.: pedidos que você lançou ANTES dessa melhoria podem ter ficado só com o nome escrito, sem virar cadastro — esses você cria/vincula na mão pela tela de Clientes.',
      },
    ],
  },
  {
    slug: 'clientes-cadastrar',
    modulo: 'Clientes',
    tela: 'Cadastrar / editar cliente',
    caminho: 'Menu → Clientes → Clientes → botão "Novo cliente" (ou o lápis)',
    palavrasChave: 'novo cliente, cadastrar cliente, adicionar pessoa, colocar cliente novo, botao novo cliente, editar cliente, mudar telefone, corrigir email, cpf, cnpj, documento, origem do cliente, de onde veio, indicacao, instagram, contato adicional, mais de um telefone, endereco de entrega, cep, marcar principal, observacoes, anotacao sobre a cliente, salvar cadastro',
    conteudo:
      '📍 ONDE FICA\nNa tela Clientes → Clientes, clique no botão laranja "Novo cliente" (canto superior direito). Para MEXER em alguém que já existe, clique no lápis do lado da pessoa na lista. Nos dois casos abre uma janelinha (um formulário) por cima da tela.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a fichinha de cadastro da cliente — como aquele cartãozinho que a gente preenchia à mão para cada freguês, mas aqui ele guarda muito mais: além de nome e telefone, dá para anotar vários contatos (o WhatsApp da pessoa, o Instagram, o e-mail), vários endereços (casa, trabalho) e observações particulares suas. Quanto mais completo, mais o sistema te ajuda depois.\n\n' +
      '✅ ANTES DE COMEÇAR\nTenha em mãos pelo menos o nome da pessoa — é o único campo obrigatório. Todo o resto é opcional e você pode completar depois. Se for cadastrar MUITAS pessoas de uma vez (de uma lista antiga), não faça uma por uma: use a "Importar planilha", que é bem mais rápido.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Novo cliente". A janela abre com o título "Novo cliente".\n2. No campo "Nome *", digite o nome da pessoa. O asterisco (*) quer dizer que é obrigatório — sem ele o sistema não deixa salvar.\n3. Opcional: "Documento (CPF/CNPJ)" para nota fiscal, e "Origem" (de onde a cliente veio: indicação, Instagram, feira...). A origem ajuda depois a saber quais canais te trazem mais gente.\n4. Opcional: "E-mail" e "Telefone" principais.\n5. Em "Contatos adicionais", se a pessoa tem mais de um jeito de falar com você, clique em "+ Contato". Escolha o tipo (telefone, whatsapp, email, instagram, outro), digite o valor e, se quiser, marque a bolinha "principal" para dizer qual é o preferido. O lixinho vermelho apaga um contato.\n6. Em "Endereços", clique em "+ Endereço" para anotar onde entregar. Dê um apelido (Casa, Trabalho), preencha CEP, cidade, UF, rua, número, bairro e complemento. Marque um como "principal".\n7. Em "Observações", escreva qualquer recadinho seu (ex.: prefere retirar à tarde, alérgica a purpurina, sempre pede embrulho de presente).\n8. Clique em "Salvar". Se for cadastro novo, o sistema já te leva direto para a ficha completa da pessoa.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nQuando você marca um contato ou endereço como "principal", o sistema desmarca automaticamente os outros — só pode existir UM principal de cada tipo, porque é ele que aparece em primeiro lugar nas listas e nos pedidos. Ao salvar um cliente novo, o sistema gera um código interno único para aquela pessoa (você não vê, mas é assim que ele amarra os pedidos e o financeiro a ela depois). Ao editar, ele só atualiza os campos que mudaram.\n\n' +
      '⚠️ ERROS COMUNS\n- Clicar em "Salvar" com o nome vazio: aparece o aviso "Nome é obrigatório" e ele não salva. Preencha o nome.\n- Adicionar dois contatos ou dois endereços e marcar os dois como "principal": não dá, o sistema só deixa um. Escolha o mais importante.\n- Cadastrar a mesma pessoa duas vezes sem querer. Antes de criar, dê uma busca rápida pelo nome ou telefone para ver se ela já não está lá.\n- Fechar a janela no X sem salvar e achar que salvou. Se você não clicou em "Salvar", nada foi guardado.\n\n' +
      '🔗 SE LIGA COM\nOs dados que você põe aqui reaparecem em vários lugares: o telefone e o e-mail viram atalhos para falar com a cliente; a origem alimenta o gráfico "Clientes por origem" na Visão Geral; os endereços são usados na hora de combinar entrega. Quando essa cliente fizer um pedido na Produção ou pela Loja Virtual, o pedido gruda no cadastro dela.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia atendeu uma moça nova pelo Instagram. Ela clica em "Novo cliente", digita "Juliana Alves", marca a Origem como "Instagram", e em "+ Contato" coloca o @ do Instagram dela e o WhatsApp, marcando o WhatsApp como principal. Em Observações escreve: "gosta de tons pastéis". Salva. Da próxima vez que a Juliana chamar, a Sofia já sabe onde encontrá-la e do que ela gosta — atendimento de gente grande, sem depender da memória.',
    faq: [
      {
        pergunta: 'Preciso preencher o CPF e o endereço da cliente para salvar?',
        resposta:
          'Não, de jeito nenhum. O ÚNICO campo obrigatório é o Nome (por isso ele tem o asterisco *). Todo o resto — documento, e-mail, telefone, contatos extras, endereços e observações — é totalmente opcional. Você pode salvar só com o nome e ir completando conforme for conhecendo melhor a pessoa ou conforme precisar. Por exemplo, só peça o CPF quando for realmente emitir nota fiscal; só preencha endereço quando for combinar uma entrega.',
      },
      {
        pergunta: 'O que significa marcar um contato ou endereço como "principal"?',
        resposta:
          '"Principal" é o seu preferido, o padrão. Se a cliente te passou três telefones, você marca como principal aquele em que ela realmente atende. Esse é o que vai aparecer primeiro nas listas e o que o sistema usa por padrão nos pedidos. Só pode existir um principal por vez — quando você marca um novo como principal, o sistema desmarca sozinho o anterior. Serve para você nunca ficar na dúvida sobre qual número usar.',
      },
      {
        pergunta: 'Para que serve o campo "Origem"?',
        resposta:
          'A origem responde à pergunta "de onde essa cliente veio?" — foi indicação de amiga, achou você no Instagram, comprou numa feira, veio da Loja Virtual? Preencher isso parece bobagem, mas com o tempo vira ouro: na tela Clientes → Visão Geral existe um gráfico "Clientes por origem" que te mostra quais canais te trazem mais gente. Assim você descobre onde vale a pena investir sua energia de divulgação. Se não souber a origem de alguém, pode deixar em branco.',
      },
      {
        pergunta: 'Como eu edito um cliente que já cadastrei?',
        resposta:
          'Há dois caminhos. O mais rápido, para uma correçãozinha: na lista de clientes, clique no ícone de lápis do lado da pessoa — abre a mesma janelinha, já preenchida, e você conserta o que precisar e salva. O caminho completo: clique no NOME da cliente para abrir a ficha inteira dela, onde além dos dados você mexe em contatos, endereços, vê o histórico de pedidos e o resumo. Nos dois casos, lembre de clicar em "Salvar" no final, senão a mudança não gruda.',
      },
    ],
  },
  {
    slug: 'clientes-massa',
    modulo: 'Clientes',
    tela: 'Ações em massa (ativar, inativar, excluir vários)',
    caminho: 'Menu → Clientes → Clientes → caixinhas de seleção',
    palavrasChave: 'selecionar varios clientes, marcar todos, caixinha de selecao, fazer de uma vez, ativar em lote, inativar varios, arquivar clientes, apagar varios clientes, excluir muitos, limpar lista, tirar clientes inativos, acao em massa, marcar todos da pagina',
    conteudo:
      '📍 ONDE FICA\nNa tela Clientes → Clientes, do lado esquerdo de CADA cliente na lista tem uma caixinha de seleção (quadradinho). Logo acima da lista tem também a opção "Selecionar todos desta página". Quando você marca alguém, surge uma barra laranja no topo com os botões de ação.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o jeito de fazer a mesma coisa com várias pessoas de uma vez só, sem repetir o trabalho cliente por cliente. Imagine que você quer arquivar 20 clientes que não compram há anos: em vez de abrir uma por uma, você marca as 20 caixinhas e resolve tudo num clique. Serve para Ativar, Inativar (arquivar) ou Excluir vários de uma vez.\n\n' +
      '✅ ANTES DE COMEÇAR\nEntenda bem a diferença entre Inativar e Excluir antes de mexer, porque uma é reversível e a outra não. Inativar é como guardar a ficha numa gaveta: some das listas ativas mas fica tudo salvo e dá para reativar depois. Excluir é rasgar a ficha: é DEFINITIVO. Na dúvida, prefira sempre Inativar.\n\n' +
      '👣 PASSO A PASSO\n1. Marque a caixinha de cada cliente que você quer. Ou, para pegar todos da tela, marque "Selecionar todos desta página".\n2. Assim que marcar o primeiro, aparece uma barra laranja no topo dizendo quantos você selecionou (ex.: "5 selecionado(s)").\n3. Nessa barra, escolha a ação: "Ativar" (verde), "Inativar" (amarelo) ou "Excluir" (vermelho).\n4. O sistema pede uma confirmação, mostrando quantos serão afetados. Leia com atenção e confirme.\n5. Se mudar de ideia antes de confirmar, clique em "Limpar" na barra para desmarcar todo mundo.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\n"Selecionar todos desta página" marca só os 30 que estão à vista naquela página — não marca a base inteira. Se você trocar de página, mudar a busca ou o filtro, a seleção é limpa automaticamente (medida de segurança, para você não excluir sem querer gente que nem estava vendo). Ponto MUITO importante sobre o Excluir: ele apaga o cadastro da pessoa, mas NÃO apaga os pedidos dela — os pedidos apenas ficam "soltos" (desvinculados), sem dono. O histórico de vendas não é destruído.\n\n' +
      '⚠️ ERROS COMUNS\n- Achar que "Selecionar todos desta página" pega a base toda. Pega só a página atual (30). Para muitos, faça página por página.\n- Usar Excluir quando queria só arquivar. Excluir é definitivo e não tem desfazer. Se a intenção é sumir da lista mas manter os dados, use Inativar.\n- Marcar vários, trocar de página, e não achar mais a seleção. Ao trocar de página a seleção zera de propósito.\n- Confirmar sem ler quantos serão afetados. Sempre confira o número na mensagem de confirmação.\n\n' +
      '🔗 SE LIGA COM\nClientes inativados somem das listas ativas mas continuam existindo — os pedidos e o financeiro deles ficam intactos. Se depois você reativar, tudo volta como estava. Por isso a Inativação é a ferramenta ideal para "limpar" a visão sem perder história.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia percebeu que sua lista estava cheia de gente que comprou uma vez, há três anos, e nunca mais voltou. Ela não quer perder esses contatos, só quer a lista mais limpa no dia a dia. Então ela filtra, marca as caixinhas dessas pessoas, clica em "Inativar" e confirma. Pronto: a lista ativa dela ficou enxuta, mas se um dia a Dona Cleide daquela lista voltar a comprar, é só reativar e todo o histórico está lá, intacto.',
    faq: [
      {
        pergunta: 'Se eu Excluir um cliente, eu perco os pedidos que ele fez?',
        resposta:
          'Não. Esta é a parte que mais tranquiliza: excluir o cadastro da pessoa NÃO apaga os pedidos dela. O que acontece é que os pedidos ficam "desvinculados", ou seja, sem dono associado — eles continuam existindo no seu histórico de vendas, com os valores e tudo, só que não apontam mais para aquela ficha de cliente. Mesmo assim, o Excluir é uma ação DEFINITIVA e não pode ser desfeita: a ficha da pessoa, com contatos e endereços, essa sim some. Por isso, se a sua intenção é só tirar da lista do dia a dia, use Inativar em vez de Excluir.',
      },
      {
        pergunta: 'Qual a diferença entre Inativar e Excluir?',
        resposta:
          'Pense assim: Inativar é guardar a ficha numa gaveta; Excluir é rasgar a ficha. Quando você Inativa, a pessoa some das listas de clientes ativos, mas absolutamente tudo é preservado — dados, contatos, endereços, histórico de pedidos, financeiro — e você pode reativá-la a qualquer momento, voltando tudo ao normal. Quando você Exclui, o cadastro é apagado de forma DEFINITIVA, sem botão de desfazer (os pedidos ficam soltos, mas a ficha some). Regra de bolso: na dúvida, sempre Inativar. Só Exclua o que você tem certeza absoluta que foi cadastro errado ou duplicado.',
      },
      {
        pergunta: 'Marquei "Selecionar todos desta página" mas quero marcar a base inteira. Como faço?',
        resposta:
          'A opção "Selecionar todos desta página" faz exatamente o que o nome diz: marca só os 30 clientes que estão aparecendo naquela página específica, não a base inteira. Isso é proposital, uma proteção para você não aplicar uma ação em gente que nem está vendo. Se você precisa aplicar a mesma ação em muitos clientes que estão em várias páginas, terá que fazer página por página: marque todos desta, aplique a ação, e depois vá para a próxima página. Lembre que ao trocar de página a seleção é limpa, então aplique a ação ANTES de virar a página.',
      },
    ],
  },
  {
    slug: 'clientes-importar',
    modulo: 'Clientes',
    tela: 'Importar clientes de planilha',
    caminho: 'Menu → Clientes → Clientes → botão "Importar planilha"',
    palavrasChave: 'importar clientes, subir planilha, trazer lista antiga, migrar clientes, excel, xlsx, csv, modelo de planilha, baixar modelo, colar minha lista, muitos clientes de uma vez, mapear colunas, minha planilha e diferente, clientes repetidos, duplicados, nao duplicar, importar contatos, passar da agenda para o sistema',
    conteudo:
      '📍 ONDE FICA\nNa tela Clientes → Clientes, no topo à direita, o botão "Importar planilha" (com um ícone de seta para cima). Ao clicar, abre uma janela que te guia passo a passo.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a mudança de casa dos seus contatos: se você tem sua lista de clientes numa planilha do Excel, num caderno digitado ou num arquivo antigo, esta ferramenta traz todo mundo de uma vez para dentro do sistema, sem você digitar um por um. Aceita arquivos .xlsx, .xls e .csv e importa até 2000 clientes por vez. É o jeito certo de começar quando você já tem uma clientela.\n\n' +
      '✅ ANTES DE COMEÇAR\nO ideal é organizar a planilha antes. O sistema oferece um "modelo" pronto para baixar, com as colunas certas — se você copiar seus dados para dentro desse modelo, a importação fica perfeita. Mas fique tranquila: mesmo que sua planilha tenha colunas com nomes diferentes, um ajudante inteligente tenta adivinhar qual coluna é qual, e você confere antes.\n\n' +
      '👣 PASSO A PASSO\n1. Clique em "Importar planilha".\n2. Clique em "Baixar modelo". Ele salva uma planilha exemplo com as colunas que o sistema entende: Nome, Email, Telefone, Cidade, Último pedido, Status, Total de pedidos, Finalizados e Em aberto.\n3. Cole seus dados dentro desse modelo (ou prepare o seu arquivo do seu jeito).\n4. Arraste o arquivo para a janela (ou clique para escolher no computador).\n5. O sistema mostra qual coluna sua ele entendeu como cada campo. Confira esse "mapeamento". Se ele errou alguma, ajuste. Depois clique em "Continuar".\n6. Aparece uma PRÉVIA: quantos clientes são novos e quantos já existem no seu sistema. Revise.\n7. Clique em "Importar". Pronto — todo mundo entra na sua lista.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO sistema é espertinho para não criar gente repetida: ele compara cada linha da sua planilha com quem você já tem, olhando o e-mail (ou, se não houver e-mail, a combinação de nome + telefone). Quem já existe não vira cópia duplicada. As colunas de pedidos antigos (Total de pedidos, Finalizados, Em aberto, Último pedido) entram como "histórico importado" — aquele retrato do passado que fica guardado separadinho das vendas novas que você fizer aqui. Só o Nome é realmente obrigatório em cada linha; linhas sem nome são ignoradas. Cidades escritas como "Campinas-SP" são separadas sozinhas em cidade e estado.\n\n' +
      '⚠️ ERROS COMUNS\n- Esperar que o histórico importado se some com os pedidos novos. Não soma: ele fica num quadro à parte, chamado "Histórico importado", justamente para o retrato antigo não bagunçar as contas de agora.\n- Planilha com a primeira linha sem ser cabeçalho. A primeira linha precisa ser o nome das colunas (Nome, Email...).\n- Achar que vai duplicar tudo. Não vai: o sistema detecta repetidos por e-mail ou nome+telefone.\n- Deixar linhas sem nome. Elas são puladas, porque nome é obrigatório.\n- Tentar importar mais de 2000 de uma vez. Divida em partes.\n\n' +
      '🔗 SE LIGA COM\nDepois de importar, cada cliente entra na lista normal e você pode editar, adicionar contatos, etc. O "histórico importado" aparece na aba Resumo da ficha da pessoa, num bloco amarelinho, sempre separado das "Métricas do SOA (ao vivo)" que vêm dos pedidos feitos aqui dentro. Clientes importados ganham a origem "importacao" e ficam marcados com uma etiqueta "importado" na lista.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia usava uma planilha do Excel para anotar suas 150 clientes. Migrar tudo à mão seria um pesadelo. Ela clica em "Importar planilha", baixa o modelo, cola os dados dela, e sobe o arquivo. O sistema avisa: "140 novos, 10 já existentes". Ela confere, clica em "Importar", e em segundos as 150 clientes estão dentro do sistema, com o histórico antigo delas preservado. O que levaria uma tarde inteira levou dois minutos.',
    faq: [
      {
        pergunta: 'Minha planilha tem colunas com nomes diferentes do modelo. Vai dar problema?',
        resposta:
          'Não precisa entrar em pânico. Embora o ideal seja usar o modelo pronto (é o caminho mais garantido), o sistema tem um ajudante que tenta adivinhar qual coluna sua corresponde a qual campo — por exemplo, ele entende que sua coluna "Nome do freguês" é o Nome, e "Fone" é o Telefone. Depois de subir o arquivo, ele te mostra esse "mapeamento" (o de-para) para você conferir. Se ele acertou tudo, é só continuar; se errou alguma, você ajusta ali mesmo antes de importar. Ou seja: você sempre tem a última palavra antes de qualquer coisa entrar.',
      },
      {
        pergunta: 'Se eu importar de novo, vou duplicar meus clientes?',
        resposta:
          'O sistema foi feito justamente para evitar isso. Antes de criar qualquer cliente, ele compara cada linha da planilha com quem você já tem cadastrado: primeiro pelo e-mail e, quando não há e-mail, pela combinação de nome + telefone. Quem já existe é reconhecido e não vira cópia. Inclusive, na tela de prévia (antes de você confirmar), ele já te diz quantos são "novos" e quantos são "já existentes", para você saber exatamente o que vai acontecer. Então pode importar com tranquilidade — a chance de duplicar por engano é bem pequena.',
      },
      {
        pergunta: 'Os pedidos antigos da minha planilha vão virar pedidos de verdade no sistema?',
        resposta:
          'Não exatamente, e isso é de propósito. As colunas de pedidos da planilha (Total de pedidos, Finalizados, Em aberto, Último pedido) entram como "histórico importado" — que é um retrato, uma foto do passado da cliente. Esse retrato fica guardado num bloco separado, amarelinho, na aba Resumo da ficha dela. Ele NÃO se mistura com os pedidos novos que você registrar aqui dentro (as chamadas "Métricas do SOA ao vivo"). Assim você tem duas informações claras e separadas: o que a pessoa já fazia antes de você usar o sistema, e o que ela faz agora. Se misturasse, suas contas de faturamento ficariam erradas.',
      },
      {
        pergunta: 'Quantos clientes posso importar de uma vez?',
        resposta:
          'Até 2000 clientes por importação. Se a sua lista for maior que isso, o caminho é dividir em partes: importe as primeiras 2000, e depois faça uma segunda importação com o restante. Como o sistema não duplica (ele reconhece quem já existe), não tem problema fazer várias importações — as pessoas que já entraram na primeira leva não serão criadas de novo na segunda.',
      },
    ],
  },
  {
    slug: 'clientes-ficha',
    modulo: 'Clientes',
    tela: 'Ficha do cliente (Dados, Contatos, Endereços, Histórico, Resumo)',
    caminho: 'Menu → Clientes → Clientes → clicar no nome do cliente',
    palavrasChave: 'ficha do cliente, abrir cliente, pagina da cliente, ver tudo da cliente, abas do cliente, dados, contatos, enderecos, historico de pedidos, quanto ela ja comprou, ticket medio, valor total gasto, primeiro pedido, ultimo pedido, tags, etiqueta vip, atacado, financeiro da cliente, quanto ela deve, quanto ela pagou, resumo',
    conteudo:
      '📍 ONDE FICA\nClique no NOME de qualquer cliente na lista (Clientes → Clientes). Abre a página inteira dela, com abas no topo: Dados, Contatos, Endereços, Histórico e Resumo. Os botões "Salvar" (laranja) e "Inativar" ficam no alto à direita.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o dossiê completo da cliente — tudo o que o sistema sabe sobre ela num lugar só, organizado em abinhas como as divisórias de um fichário. De um lado os dados de cadastro, de outro os jeitos de contato, os endereços, a lista de tudo que ela já comprou e um resumo com os números importantes (quanto gastou, quantas vezes comprou, ticket médio). É aqui que você conhece a cliente de verdade antes de atendê-la.\n\n' +
      '✅ ANTES DE COMEÇAR\nQualquer mudança que você fizer nos Dados, Contatos ou Endereços só é guardada quando você clica em "Salvar" (lá em cima). As abas Histórico e Resumo são só de leitura — não tem o que salvar ali, elas se preenchem sozinhas com base nos pedidos.\n\n' +
      '👣 PASSO A PASSO\n1. Aba "Dados": edite nome, documento, origem, e-mail, telefone. Use o campo "Tags" para colar etiquetas livres separadas por vírgula (ex.: vip, atacado, madrinha). A caixinha "Cliente ativo" liga/desliga a pessoa das listas ativas.\n2. Aba "Contatos": clique em "Adicionar contato" para incluir telefones, WhatsApp, Instagram, e-mail. Marque um como principal. O lixinho remove.\n3. Aba "Endereços": "Adicionar endereço", preencha os campos e marque um como principal.\n4. Aba "Histórico": tabela com todos os pedidos dela — número, produto, status, valor e data. Só leitura.\n5. Aba "Resumo": os números-chave. Total de pedidos, valor total, ticket médio, primeiro e último pedido. Se ela veio de importação, aparece o bloco amarelo "Histórico importado". Se tiver contas amarradas a ela, aparece o bloco verde "Financeiro do cliente".\n6. Ao terminar de editar, clique em "Salvar". Para arquivar, use "Inativar".\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs números da aba Resumo são calculados na hora, somando os pedidos reais amarrados à cliente: o "valor total" é a soma de tudo, o "ticket médio" é esse total dividido pela quantidade de pedidos (quanto ela gasta, em média, por compra). O bloco "Métricas do SOA (ao vivo)" vem SEMPRE dos pedidos registrados aqui dentro. Já o "Histórico importado" (amarelo) é o retrato da planilha antiga, e os dois nunca se misturam. O bloco "Financeiro do cliente" só aparece se existirem lançamentos financeiros ligados àquela pessoa — ele mostra quanto ela já pagou (recebido) e quanto ainda está em aberto.\n\n' +
      '⚠️ ERROS COMUNS\n- Editar os Dados e sair sem clicar em "Salvar": as mudanças se perdem. O botão fica no alto à direita.\n- Procurar um botão de salvar nas abas Histórico e Resumo: não existe, elas são só de leitura e se atualizam sozinhas.\n- Estranhar que o "valor total" da aba Resumo seja diferente do histórico importado. São fontes diferentes de propósito (vendas de agora x retrato antigo).\n- Confundir "Tags" com contatos. Tags são só rótulos livres para organizar (vip, atacado); não são telefones nem e-mails.\n\n' +
      '🔗 SE LIGA COM\nA aba Histórico se enche automaticamente com os pedidos que você cria na Produção e pela Loja Virtual escolhendo essa cliente. O bloco Financeiro puxa dos lançamentos do módulo Financeiro que estão amarrados a ela. As Tags que você criar aqui podem ajudar você a lembrar rapidinho o perfil de cada uma. E nas Tarefas, um card pode apontar para esta cliente.\n\n' +
      '💬 EXEMPLO SOFIA\nAntes de ligar para a Dona Marta combinar uma encomenda grande, a Sofia abre a ficha dela. Na aba Resumo, vê que a Dona Marta tem ticket médio de R$ 80 e já são 8 pedidos — cliente de peso. Na aba Financeiro, nota que não há nada em aberto (ela sempre paga em dia). Na aba Dados, a tag "atacado" lembra a Sofia de oferecer o preço de quantidade. Com tudo isso na tela, a Sofia liga já sabendo como conduzir a conversa.',
    faq: [
      {
        pergunta: 'O que é o "ticket médio" que aparece no Resumo?',
        resposta:
          'Ticket médio é quanto a cliente gasta, em média, cada vez que compra com você. O sistema calcula dividindo o valor total que ela já gastou pela quantidade de pedidos que ela fez. Por exemplo: se a Dona Marta gastou R$ 640 no total ao longo de 8 pedidos, o ticket médio dela é R$ 80 — ou seja, cada compra dela gira em torno de 80 reais. Esse número é ótimo para você decidir estratégia: uma cliente de ticket alto merece atenção especial e ofertas de produtos mais caros; uma de ticket baixo pode ser incentivada a levar um pouquinho mais.',
      },
      {
        pergunta: 'Por que tem dois blocos de números diferentes no Resumo?',
        resposta:
          'Porque eles contam histórias diferentes. O bloco "Métricas do SOA (ao vivo)" mostra os pedidos que a cliente fez aqui dentro do sistema, no seu dia a dia atual — é o retrato do presente, sempre atualizado. Já o bloco amarelo "Histórico importado" só aparece se essa cliente veio de uma planilha antiga, e mostra o retrato do passado dela (quantos pedidos ela já fazia antes de você usar o sistema). Os dois são mantidos separados de propósito: se somassem, suas contas de faturamento ficariam infladas e erradas. Assim você enxerga com clareza o que é herança da planilha e o que é venda de verdade feita agora.',
      },
      {
        pergunta: 'Para que servem as Tags na aba Dados?',
        resposta:
          'Tags são etiquetas livres, palavrinhas que você inventa para classificar suas clientes do seu jeito. Você digita separando por vírgula, por exemplo: "vip, atacado, madrinha, presente". Elas não têm regra nem função automática — são um bilhetinho para você mesma lembrar do perfil da pessoa num relance. Uma cliente marcada como "atacado" te lembra de oferecer preço de quantidade; uma "vip" merece um mimo. Use as palavras que fizerem sentido para o seu negócio.',
      },
      {
        pergunta: 'Editei o telefone da cliente mas não mudou. O que aconteceu?',
        resposta:
          'Quase certamente você esqueceu de clicar em "Salvar". Na ficha do cliente, as mudanças que você faz nas abas Dados, Contatos e Endereços só ficam gravadas quando você clica no botão "Salvar", que fica lá no alto, à direita da tela (o botão laranja). Se você editou o campo e simplesmente saiu da página ou trocou de aba sem salvar, a alteração se perdeu. Faça de novo a correção e, desta vez, clique em "Salvar" antes de sair — vai aparecer uma confirmação de que o cliente foi salvo.',
      },
    ],
  },
  {
    slug: 'clientes-visao-geral',
    modulo: 'Clientes',
    tela: 'Visão Geral (relatório de clientes)',
    caminho: 'Menu → Clientes → Visão Geral',
    palavrasChave: 'visao geral clientes, relatorio de clientes, painel, dashboard, resumo geral, quantos clientes tenho, quantos ativos, novos no mes, total em vendas, ticket medio geral, ranking, melhores clientes, top clientes, quem gasta mais, clientes por origem, de onde vem meus clientes, exportar csv, baixar relatorio, planilha de clientes',
    conteudo:
      '📍 ONDE FICA\nMenu → Clientes → Visão Geral. É a segunda opção dentro de Clientes. Abre um painel com cartões coloridos no topo e dois quadros embaixo (ranking e origens).\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a fotografia do seu conjunto de clientes — em vez de olhar pessoa por pessoa, aqui você vê o todo: quantas clientes tem, quantas são ativas, quantas chegaram esse mês, quanto você já vendeu no total e qual o ticket médio geral. Também mostra o ranking das que mais gastam e de onde a sua clientela vem. É o painel para você ter noção da saúde do seu negócio de relacionamento.\n\n' +
      '✅ ANTES DE COMEÇAR\nEsta tela é só de leitura — você não cadastra nada aqui, só consulta. Os números ganham vida conforme você cadastra clientes e registra pedidos: no comecinho, com pouca coisa lançada, os quadros podem aparecer vazios ("Sem dados ainda") — é normal.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Clientes → Visão Geral.\n2. Leia os cartões do topo: Total de clientes, Ativos, Novos no mês, Pedidos vinculados, Total em vendas, Ticket médio geral e Inativos.\n3. No quadro "Top clientes por valor", veja o ranking das que mais gastaram. Cada linha é clicável — clique para pular direto para a ficha da pessoa.\n4. No quadro "Clientes por origem", veja de onde sua clientela veio, em barras (Instagram, indicação, feira...).\n5. Se quiser levar os dados para fora, clique em "Exportar relatório (CSV)" no topo. Baixa um arquivo que abre no Excel.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada cartão é uma conta feita na hora sobre toda a sua base: "Novos no mês" conta quem foi cadastrado dentro do mês corrente; "Total em vendas" soma o valor de todos os pedidos vinculados a clientes; "Ticket médio geral" é esse total dividido pela quantidade de pedidos. O ranking ordena as clientes pelo valor total gasto. O gráfico de origens agrupa as clientes por aquele campo "Origem" que você preencheu no cadastro — por isso preencher a origem vale a pena. O botão de exportar monta um arquivo CSV (planilha) com nome, origem, se está ativo, quantidade de pedidos e valor total de cada cliente.\n\n' +
      '⚠️ ERROS COMUNS\n- Estranhar quadros vazios logo no início. Sem clientes e pedidos suficientes, aparece "Sem dados ainda" — vai preenchendo conforme você usa.\n- Esperar editar algo aqui. É painel de consulta; para mexer numa cliente, clique nela e vá para a ficha.\n- O gráfico de origem quase vazio porque quase ninguém tem origem preenchida. Preencha a origem nos cadastros para esse gráfico ficar útil.\n- Abrir o CSV e achar os acentos estranhos. Ele abre certinho no Excel; se ver caracteres esquisitos, é só configuração de codificação do programa.\n\n' +
      '🔗 SE LIGA COM\nOs números aqui bebem direto do cadastro de Clientes (o campo Origem, o status ativo/inativo) e dos Pedidos vinculados (Produção e Loja). Ou seja, quanto mais caprichado o cadastro e mais pedidos amarrados às pessoas certas, mais fiel fica este painel. O CSV exportado é ótimo para levar para o contador ou para fazer uma análise mais pessoal na sua própria planilha.\n\n' +
      '💬 EXEMPLO SOFIA\nNo fim do mês, a Sofia abre Clientes → Visão Geral para "tomar o pulso" do negócio. Vê que ganhou 12 clientes novos no mês e que o ticket médio geral subiu para R$ 65. No gráfico de origens, descobre que 70% da clientela nova veio do Instagram — sinal de que os Reels dela estão dando certo. No ranking, relembra suas 10 melhores clientes e resolve mandar um cupom de agradecimento para elas. Em cinco minutos, ela entendeu o mês inteiro.',
    faq: [
      {
        pergunta: 'Os quadros da Visão Geral estão vazios dizendo "Sem dados ainda". Está com defeito?',
        resposta:
          'Não, está tudo certo — é só que ainda não há informação suficiente para desenhar os quadros. A Visão Geral se alimenta dos seus clientes cadastrados e dos pedidos vinculados a eles. Se você acabou de começar, ou cadastrou poucas pessoas, ou ainda não registrou pedidos amarrados a clientes, os quadros de ranking e de origem não têm o que mostrar e exibem "Sem dados ainda". Conforme você for usando o sistema no dia a dia — cadastrando clientes, preenchendo a origem deles e registrando pedidos — esses quadros vão se preenchendo naturalmente e ficando cada vez mais ricos.',
      },
      {
        pergunta: 'Para que serve o botão "Exportar relatório (CSV)"?',
        resposta:
          'Ele baixa para o seu computador um arquivo com a lista completa dos seus clientes, no formato CSV, que abre no Excel, no Google Planilhas ou em qualquer programa de planilha. Nele vêm o nome, a origem, se o cliente está ativo, quantos pedidos fez e o valor total de cada um. Serve para quando você quer trabalhar os dados por fora do sistema — por exemplo, montar uma lista para o contador, preparar um mala-direta, ou fazer suas próprias contas e gráficos do seu jeito. É a ponte entre o sistema e a sua planilha pessoal.',
      },
      {
        pergunta: 'O gráfico "Clientes por origem" está quase vazio. Por quê?',
        resposta:
          'Esse gráfico agrupa suas clientes pelo campo "Origem" que você (ou a importação) preencheu no cadastro de cada uma. Se a maioria das suas clientes está sem origem definida, o gráfico não tem como classificá-las e fica pobre. A solução é simples e vale muito a pena a longo prazo: sempre que cadastrar ou atender alguém, preencha de onde ela veio (Instagram, indicação, feira, Loja Virtual...). Com o tempo, esse gráfico vira uma bússola poderosa, mostrando quais canais realmente trazem clientes para você — e onde vale a pena investir sua energia de divulgação.',
      },
    ],
  },
  {
    slug: 'clientes-ativar-modulo',
    modulo: 'Clientes',
    tela: 'Ligar / desligar o módulo Clientes',
    caminho: 'Menu → Config → Geral → Módulos',
    palavrasChave: 'ativar clientes, ligar modulo clientes, habilitar clientes, sumiu o menu clientes, nao tenho clientes no menu, liberar clientes, onde ligo o modulo, permissao, operadora nao ve clientes',
    conteudo:
      '📍 ONDE FICA\nMenu → Config → Geral. Role até a seção "Módulos" e procure a chavinha (interruptor) do módulo Clientes.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nO sistema é montado por módulos — como cômodos de uma casa que você abre conforme precisa. O módulo Clientes é o cômodo do relacionamento (lista, fichas, importação, visão geral). Se ele estiver desligado, o menu "Clientes" nem aparece. Ligar é acender a luz desse cômodo.\n\n' +
      '✅ ANTES DE COMEÇAR\nSó quem é dona/administradora (perfil ADMIN) pode ligar e desligar módulos. Ajudantes (operadoras) não têm acesso a esta configuração — e, mesmo com o módulo ligado, a área de Clientes é reservada à administração.\n\n' +
      '👣 PASSO A PASSO\n1. Abra Config → Geral.\n2. Encontre a seção "Módulos".\n3. Ache a linha do módulo Clientes e clique na chavinha para deixá-la laranja (ligada).\n4. Salve as configurações.\n5. O menu "Clientes" aparece na barra lateral. Pronto.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA chavinha guarda um sim/não no cadastro do seu ateliê (workspace). O menu lateral consulta esse sim/não para decidir se mostra ou esconde a opção Clientes. Como cada ateliê tem a sua configuração, ligar aqui não afeta ninguém além de você. Desligar não apaga os clientes — só esconde o menu; se religar, tudo volta como estava.\n\n' +
      '⚠️ ERROS COMUNS\n- "Não acho o menu Clientes": provavelmente o módulo está desligado, ou você entrou como operadora.\n- Desligar achando que apaga os dados. Não apaga nada, só esconde.\n- Esperar a operadora ver a tela de Clientes. Essa área é da administração.\n\n' +
      '🔗 SE LIGA COM\nÉ na mesma seção "Módulos" que você liga também Tarefas e Assistente de Compras. Todos os três módulos deste guia moram ali, cada um com sua chavinha. Ligar Clientes é o primeiro passo para depois amarrar pedidos, tarefas e financeiro às pessoas.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia é nova no sistema e ficou aflita: "Cadê a parte de clientes?". Ela abre Config → Geral, vê a seção Módulos e percebe que a chavinha de Clientes estava cinza (desligada). Clica, ela fica laranja, salva — e o menu Clientes surge na hora. Alívio: não estava quebrado, só apagado.',
    faq: [
      {
        pergunta: 'Sumiu (ou nunca apareceu) o menu Clientes. Como resolvo?',
        resposta:
          'São duas causas possíveis. A primeira e mais comum: o módulo Clientes está desligado. Vá em Config → Geral, encontre a seção "Módulos", e ligue a chavinha do Clientes (ela fica laranja quando ligada), depois salve — o menu aparece na hora. A segunda causa: você pode estar usando um login de ajudante (operadora), e a área de Clientes é reservada à dona/administradora do ateliê. Nesse caso, quem precisa acessar deve entrar com o perfil de administração. Se você é a dona e mesmo ligando o módulo o menu não vem, faça logout e login de novo para atualizar a tela.',
      },
      {
        pergunta: 'Se eu desligar o módulo Clientes, perco todos os meus cadastros?',
        resposta:
          'Não, fique tranquila. Desligar a chavinha do módulo apenas ESCONDE o menu Clientes da sua tela — é como fechar a porta de um cômodo, não como demolir o cômodo. Todos os seus clientes, contatos, endereços e históricos continuam guardados e intactos. No momento em que você religar o módulo, tudo reaparece exatamente como estava. Portanto, se você desligou por engano ou por teste, é só ligar de novo que nada foi perdido.',
      },
    ],
  },

  // ═══════════════════════════════ TAREFAS ═══════════════════════════════
  {
    slug: 'tarefas-visao-geral',
    modulo: 'Tarefas',
    tela: 'Tarefas · Visão Geral',
    caminho: 'Menu → Tarefas → Visão Geral',
    palavrasChave: 'visao geral tarefas, painel de tarefas, resumo das tarefas, quantas tarefas tenho, prazos vencidos, tarefas atrasadas, prazo proximo, tarefas urgentes, tarefas por status, tarefas por coluna, tarefas por responsavel, quem esta com mais tarefa, dashboard tarefas, escolher periodo, ultimos 30 dias',
    conteudo:
      '📍 ONDE FICA\nMenu → Tarefas → Visão Geral. É o painel de abertura do módulo de Tarefas. No topo tem quatro cartões grandes, embaixo dois quadros (por status e por responsável) e, se houver atrasos, uma lista vermelha de tarefas atrasadas.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o painel de controle da sua produção de trabalho. Enquanto os quadros (Kanban) mostram tarefa por tarefa, esta tela mostra o cenário geral: quantas tarefas existem, quantas estão atrasadas, quantas vencem logo e quantas são urgentes. Serve para você bater o olho de manhã e saber onde está o fogo — o que precisa de atenção HOJE.\n\n' +
      '✅ ANTES DE COMEÇAR\nEsta tela é só de leitura e depende de você já ter quadros e tarefas criados. Se você ainda não montou nenhum quadro, ela vai aparecer vazia — comece criando um quadro em Tarefas → Quadros. É uma tela da administração; ajudantes (operadoras) são redirecionadas.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Tarefas → Visão Geral.\n2. No seletor à direita, escolha o período (Últimos 7 dias, 30, 90 dias ou 1 ano). Ele muda a conta de "novas no período".\n3. Leia os quatro cartões: Total de tarefas, Prazos vencidos (as atrasadas), Prazo próximo (vencem nos próximos 7 dias) e Urgentes (as marcadas com prioridade urgente).\n4. No quadro "Tarefas por status (coluna)", veja quantas estão em cada etapa (ex.: A fazer, Fazendo, Pronto), em barrinhas.\n5. No quadro "Por responsável", veja quantas tarefas estão no colo de cada pessoa da equipe.\n6. Se houver o quadro vermelho "Tarefas atrasadas", clique em qualquer uma para ir direto ao quadro onde ela está e resolvê-la.\n7. Clique no atalho "Ir para os quadros →" quando quiser trabalhar as tarefas.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs números são calculados na hora sobre todas as suas tarefas. "Prazos vencidos" conta tarefas cujo prazo já passou e que não foram concluídas. "Prazo próximo" olha os próximos 7 dias. "Urgentes" conta as que você marcou com prioridade urgente. O quadro por coluna respeita as cores que você deu a cada coluna nos seus quadros. O período do seletor afeta principalmente a contagem de "novas no período" — as demais métricas refletem a situação atual.\n\n' +
      '⚠️ ERROS COMUNS\n- Tela vazia porque você ainda não criou quadros nem tarefas. Comece em Tarefas → Quadros.\n- Confundir "Prazo próximo" (o que vence em breve) com "Prazos vencidos" (o que já passou). Um é alerta amarelo, o outro é vermelho.\n- Achar que o seletor de período muda tudo. Ele mexe principalmente no "novas no período"; atrasados e urgentes são a situação de agora.\n- Operadora tentando abrir e sendo redirecionada. É tela da administração.\n\n' +
      '🔗 SE LIGA COM\nEsta visão bebe de tudo que está nos seus Quadros (Tarefas → Quadros). Cada tarefa atrasada aqui te leva, com um clique, para dentro do quadro dela. As colunas e cores que aparecem nos quadrinhos são as mesmas que você configurou nos seus quadros. As prioridades (urgente, alta...) vêm do detalhe de cada card.\n\n' +
      '💬 EXEMPLO SOFIA\nToda segunda de manhã, a Sofia abre Tarefas → Visão Geral com o café na mão. Vê "3 Prazos vencidos" em vermelho e um pisca no coração: são três encomendas atrasadas. Ela clica na primeira da lista vermelha, cai direto no quadro, e reorganiza a semana. Também nota que a ajudante dela está com 12 tarefas e ela mesma com só 4 — hora de reequilibrar. Em dois minutos, a semana inteira ganhou um plano.',
    faq: [
      {
        pergunta: 'Qual a diferença entre "Prazos vencidos", "Prazo próximo" e "Urgentes"?',
        resposta:
          'São três alertas diferentes, e vale entender cada um. "Prazos vencidos" (o cartão vermelho) são as tarefas cujo prazo JÁ passou e que ainda não foram concluídas — é o fogo que precisa apagar. "Prazo próximo" (o cartão amarelo) são as que ainda não venceram, mas vencem nos próximos 7 dias — é o aviso para você se preparar e não deixar virar atraso. "Urgentes" conta as tarefas que você marcou manualmente com a prioridade "urgente" no detalhe do card, independentemente de prazo — são as que você decidiu que são importantes. Uma tarefa pode aparecer em mais de um cartão ao mesmo tempo (por exemplo, ser urgente E estar vencida).',
      },
      {
        pergunta: 'A tela de Visão Geral está vazia. O que fazer?',
        resposta:
          'Isso acontece quando você ainda não tem quadros e tarefas criados — a Visão Geral é um resumo do que existe nos seus quadros, então, sem nada lá, ela não tem o que resumir. O caminho é começar pela base: vá em Tarefas → Quadros, crie o seu primeiro quadro (por exemplo, "Produção da Semana"), e dentro dele crie algumas tarefas. Assim que houver tarefas com prazos e responsáveis, a Visão Geral se preenche automaticamente com os cartões e gráficos. Ou seja, a Visão Geral é a segunda parada; a primeira é montar seus quadros.',
      },
      {
        pergunta: 'Para que serve o seletor de período (7 dias, 30 dias...)?',
        resposta:
          'Esse seletor ajusta a janela de tempo que a tela considera para a contagem de tarefas "novas no período" — ou seja, quantas tarefas foram criadas nos últimos 7, 30, 90 dias ou no último ano. Ele é útil para você ter noção do seu ritmo de trabalho: se você criou muitas tarefas nos últimos 7 dias, a demanda está aquecida. Vale saber que os outros alertas, como "prazos vencidos" e "urgentes", refletem a situação atual do seu trabalho, não a janela escolhida — eles mostram o que está pegando fogo agora, independentemente do período.',
      },
    ],
  },
  {
    slug: 'tarefas-quadros',
    modulo: 'Tarefas',
    tela: 'Quadros (lista de quadros)',
    caminho: 'Menu → Tarefas → Quadros',
    palavrasChave: 'quadros, meus quadros, criar quadro, novo quadro, quadro kanban, board, organizar tarefas, projeto, cor do quadro, renomear quadro, excluir quadro, apagar quadro, quantas tarefas no quadro, abrir quadro',
    conteudo:
      '📍 ONDE FICA\nMenu → Tarefas → Quadros. Mostra todos os seus quadros como cartõezinhos coloridos numa grade. O botão laranja "Novo quadro" fica no topo à direita.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nUm quadro é como um grande painel de cortiça na parede do ateliê, onde você prende os bilhetinhos das coisas a fazer. Cada quadro é um assunto ou projeto seu: pode ter um chamado "Produção da Semana", outro "Encomendas de Natal", outro "Ideias e Redes Sociais". Esta tela é a estante que guarda todos esses painéis — você cria, dá nome e cor, e entra em cada um para trabalhar.\n\n' +
      '✅ ANTES DE COMEÇAR\nPense em como você quer separar seus assuntos. Não precisa de muitos quadros — comece com um ou dois. Você pode criar, renomear e apagar quadros quando quiser. É uma área da administração; ajudantes (operadoras) não acessam.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Tarefas → Quadros.\n2. Clique em "Novo quadro".\n3. Na janelinha, digite o nome do quadro (ex.: "Produção da Semana").\n4. Escolha uma cor clicando numa das bolinhas — é só para você reconhecer o quadro de relance.\n5. Clique em "Criar quadro".\n6. O quadro aparece como um cartão. Clique nele para entrar e começar a montar as colunas e tarefas.\n7. Passando o mouse sobre um quadro, aparecem "Editar" (mudar nome/cor) e "Excluir".\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada cartão mostra o nome, a cor e quantas tarefas aquele quadro tem no total (ex.: "8 tarefas"). Ao criar um quadro, o sistema já o deixa pronto para receber colunas e cards. A cor é puramente visual — não muda nenhuma regra, só ajuda seu olho a achar o quadro certo rápido. Excluir um quadro apaga junto TODAS as tarefas dentro dele, por isso o sistema pede confirmação.\n\n' +
      '⚠️ ERROS COMUNS\n- Excluir um quadro achando que só some da lista. Excluir apaga o quadro E todas as tarefas dentro dele, de forma definitiva. Tenha certeza antes de confirmar.\n- Criar quadros demais e se perder. Menos é mais: poucos quadros bem organizados funcionam melhor.\n- Tentar arrastar cards nesta tela. Aqui você só gerencia os quadros; para mexer nas tarefas, entre no quadro.\n- Não achar os botões Editar/Excluir. Eles só aparecem quando você passa o mouse por cima do cartão do quadro.\n\n' +
      '🔗 SE LIGA COM\nCada quadro que você abre leva para a tela do Kanban (o quadro em si, com colunas e cards). O total de tarefas de todos os quadros alimenta a Visão Geral de Tarefas. As tarefas que você criar aqui dentro podem se ligar a Clientes (apontando de quem é a encomenda) e a Pedidos/Pagamentos por meio dos Vínculos no card.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia decide organizar a cabeça. Cria dois quadros: um azul chamado "Produção da Semana" e um rosa chamado "Encomendas de Natal". Assim, o corre-corre do dia a dia fica separado do projeto grande de fim de ano. Bate o olho na estante de quadros e já sabe onde está cada coisa — a cor azul é o agora, a rosa é o Natal.',
    faq: [
      {
        pergunta: 'O que é um "quadro" exatamente?',
        resposta:
          'Um quadro é um painel de organização para um assunto ou projeto seu — a metáfora perfeita é aquele painel de cortiça onde a gente prende bilhetinhos com tachinhas. Dentro de cada quadro você cria colunas (as etapas, tipo "A fazer", "Fazendo", "Pronto") e, dentro das colunas, os cards (as tarefas em si). Você pode ter quantos quadros quiser, cada um para um tema: um para a produção da semana, um para as encomendas de uma data especial, um para ideias de conteúdo. Separar em quadros mantém cada assunto no seu lugar, sem misturar o corre-corre diário com os projetos maiores.',
      },
      {
        pergunta: 'Se eu excluir um quadro, o que acontece com as tarefas dele?',
        resposta:
          'Elas são apagadas junto, de forma definitiva. Excluir um quadro não é só tirá-lo da estante — é jogar fora o painel inteiro com todos os bilhetinhos presos nele. Por isso o sistema sempre pede uma confirmação antes, avisando que vai excluir o quadro E todas as suas tarefas. Se você só quer parar de usar um quadro mas tem tarefas ali que ainda importam, o mais seguro é primeiro mover ou concluir essas tarefas, ou simplesmente deixar o quadro de lado sem excluí-lo. Só exclua quando tiver certeza de que nada ali dentro é mais necessário.',
      },
      {
        pergunta: 'Para que serve a cor do quadro?',
        resposta:
          'A cor é apenas visual, uma ajuda para o seu olho. Ela não muda nenhuma regra nem função — serve só para você reconhecer cada quadro rapidamente na estante e nos outros lugares onde ele aparece (como no calendário e na lista de atividades, onde a bolinha colorida indica de qual quadro veio a tarefa). Escolha cores que façam sentido para você: por exemplo, vermelho para o que é mais urgente, verde para ideias tranquilas, azul para o dia a dia. É uma forma de dar identidade e facilitar a leitura rápida.',
      },
    ],
  },
  {
    slug: 'tarefas-quadro-kanban',
    modulo: 'Tarefas',
    tela: 'Quadro (Kanban: colunas e cards)',
    caminho: 'Menu → Tarefas → Quadros → clicar num quadro',
    palavrasChave: 'quadro kanban, colunas, arrastar tarefa, mover card, mudar de coluna, a fazer fazendo pronto, criar coluna, nova coluna, renomear coluna, excluir coluna, nova tarefa, criar card, buscar tarefa no quadro, filtrar por prioridade, filtrar por responsavel, filtrar por etiqueta, ordem das tarefas',
    conteudo:
      '📍 ONDE FICA\nEntre num quadro (Tarefas → Quadros → clique no quadro). Abre o Kanban: colunas lado a lado, cada uma com seus cards (as tarefas). No topo tem o nome do quadro, uma busca e três filtros (Prioridade, Responsável, Etiqueta).\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o painel de cortiça em ação. As colunas são as etapas do trabalho (por exemplo: A fazer → Fazendo → Pronto) e os cards são as tarefas, os bilhetinhos. A mágica é arrastar: quando uma tarefa avança, você pega o card e o solta na coluna seguinte. De relance você vê o que falta fazer, o que está em andamento e o que já ficou pronto. É o coração do módulo de Tarefas.\n\n' +
      '✅ ANTES DE COMEÇAR\nO quadro começa vazio; você monta as colunas do jeito que o seu trabalho funciona. Pense nas etapas naturais de uma encomenda sua. No celular, para arrastar um card, segure o dedo nele um instante antes de mover (isso evita mover sem querer ao rolar a tela).\n\n' +
      '👣 PASSO A PASSO\n1. Para criar as etapas: clique em "+ Coluna" (à direita das colunas) e dê um nome (ex.: "A fazer").\n2. Para criar uma tarefa: numa coluna, clique em "Nova tarefa", digite o título e confirme. O card aparece na coluna.\n3. Para avançar uma tarefa: clique e arraste o card para outra coluna, soltando onde quiser. A nova posição é guardada sozinha.\n4. Para reordenar dentro da mesma coluna: arraste o card para cima ou para baixo.\n5. Para abrir os detalhes de uma tarefa: clique nela (abre a janela de detalhe, com prazo, responsável, checklist etc.).\n6. Para renomear uma coluna: clique no nome dela. Para excluir uma coluna: clique no lixinho no topo dela.\n7. Use a busca (lupa) para achar uma tarefa pelo título ou nome do cliente, e os seletores Prioridade/Responsável/Etiqueta para filtrar o que aparece.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada card mostra sinais rápidos: uma bolinha colorida de prioridade, o nome do cliente e do responsável, o prazo (em vermelho se já venceu), etiquetas coloridas, e contadores de anexos, comentários e itens de checklist (ex.: "3/5" itens feitos). Quando você arrasta, o sistema salva na hora tanto a coluna nova quanto a ordem. Os filtros NÃO apagam nada — apenas escondem temporariamente os cards que não batem, para você focar; limpando o filtro, todos voltam. A busca olha o título da tarefa e o nome do cliente vinculado.\n\n' +
      '⚠️ ERROS COMUNS\n- No celular, tentar arrastar sem segurar primeiro. Segure o dedo no card um instante antes de mover.\n- Achar que o filtro apagou tarefas. Ele só esconde; limpe os filtros (deixe em branco) e tudo reaparece.\n- Excluir uma coluna cheia de tarefas. O sistema avisa quando a coluna tem cards; mova as tarefas antes se elas importam.\n- Criar uma tarefa na coluna errada. Sem problema: é só arrastá-la para a coluna certa.\n- Esquecer de criar colunas e não conseguir criar tarefas. Primeiro as colunas (etapas), depois os cards.\n\n' +
      '🔗 SE LIGA COM\nCada card se abre no Detalhe da tarefa, onde você amarra a tarefa a um Cliente e a um responsável (usuário da equipe), e cria Vínculos com Pedidos e Pagamentos. Mover cards e criar tarefas alimenta a Visão Geral, o Calendário, as Minhas Tarefas e o feed de Atividades. As etiquetas e responsáveis dos filtros vêm do que você configurou nos detalhes.\n\n' +
      '💬 EXEMPLO SOFIA\nNo quadro "Produção da Semana", a Sofia montou três colunas: A fazer, Fazendo, Pronto. Cada encomenda é um card. A do casamento da Bia começa em "A fazer"; quando a Sofia senta para bordar, ela arrasta o card para "Fazendo"; quando embala, arrasta para "Pronto". Num olhar, ela e a ajudante sabem exatamente em que pé está cada trabalho — sem precisar perguntar nada uma à outra.',
    faq: [
      {
        pergunta: 'Como eu movo uma tarefa de uma coluna para outra?',
        resposta:
          'É só arrastar. No computador, clique e segure o card com o mouse, arraste até a coluna desejada e solte onde quiser — pode até escolher a posição exata dentro da nova coluna. No celular ou tablet, tem um detalhe importante: segure o dedo no card por um instantinho antes de começar a arrastar. Esse pequeno atraso existe de propósito, para o sistema saber que você quer MOVER o card e não apenas rolar a tela. Assim que você solta, a nova posição é salva automaticamente — não precisa clicar em nenhum botão de salvar.',
      },
      {
        pergunta: 'Usei os filtros e várias tarefas sumiram. Eu perdi elas?',
        resposta:
          'Não, não perdeu nada — os filtros apenas escondem temporariamente. Quando você escolhe, por exemplo, filtrar por um responsável ou por uma prioridade, o quadro passa a mostrar SÓ os cards que batem com aquele critério, para você conseguir focar no que interessa naquele momento. As outras tarefas continuam lá, sãs e salvas, apenas fora de vista. Para trazer todo mundo de volta, é só limpar os filtros: deixe os seletores de Prioridade, Responsável e Etiqueta em branco (na opção vazia) e apague o que estiver na busca. Tudo reaparece na hora.',
      },
      {
        pergunta: 'Como crio as colunas do meu quadro?',
        resposta:
          'As colunas são as etapas do seu trabalho, e você as monta do jeito que o seu processo funciona. Num quadro aberto, clique no botão "+ Coluna" (que fica à direita das colunas existentes) e dê um nome — por exemplo, "A fazer", "Fazendo", "Pronto", ou o que fizer sentido para você ("Aguardando material", "Bordando", "Embalando", "Entregue"). Você pode criar quantas colunas quiser, renomeá-las depois clicando no nome, e reorganizar seu fluxo com o tempo. A dica é espelhar as fases reais de uma encomenda sua, para que arrastar o card de uma coluna para a próxima signifique, de verdade, o trabalho avançando.',
      },
      {
        pergunta: 'Consigo achar uma tarefa específica no meio de muitos cards?',
        resposta:
          'Consegue, de duas formas. A mais direta é a busca (a caixinha com a lupa no topo do quadro): digite parte do título da tarefa ou o nome do cliente vinculado a ela, e o quadro mostra só o que combina. A outra forma são os filtros ao lado da busca: você pode filtrar por Prioridade (mostrar só as urgentes, por exemplo), por Responsável (só as suas, ou só as da sua ajudante) ou por Etiqueta (só as marcadas com determinada cor/assunto). Dá para combinar busca e filtros ao mesmo tempo para afunilar bem. Lembre de limpar tudo depois para ver o quadro completo de novo.',
      },
    ],
  },
  {
    slug: 'tarefas-detalhe-card',
    modulo: 'Tarefas',
    tela: 'Detalhe da tarefa (card)',
    caminho: 'Menu → Tarefas → Quadros → quadro → clicar num card',
    palavrasChave: 'detalhe da tarefa, abrir card, prioridade, prazo, data de entrega, responsavel pela tarefa, atribuir tarefa, vincular cliente, etiqueta, criar etiqueta, checklist, lista de itens, marcar item feito, anexar foto, anexar arte, imagem na tarefa, vinculo com pedido, vinculo com pagamento, comentario, mencionar pessoa arroba, historico da tarefa, excluir tarefa, descricao',
    conteudo:
      '📍 ONDE FICA\nDentro de um quadro, clique em qualquer card (tarefa). Abre uma janela grande com todos os detalhes: campos no topo, e mais abaixo etiquetas, descrição, checklists, anexos, vínculos, comentários e histórico. Setas ← → (ou os botõezinhos no topo) pulam para a tarefa anterior/seguinte da mesma coluna.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nSe o card no quadro é a capa do bilhetinho, este detalhe é o verso com tudo escrito. É onde a tarefa ganha vida: você define para quando é (prazo), quem faz (responsável), de qual cliente é, cria uma listinha de subtarefas (checklist), cola as fotos das artes, amarra a tarefa ao pedido e ao pagamento, e conversa com a equipe em comentários. Tudo sobre aquele trabalho num lugar só.\n\n' +
      '✅ ANTES DE COMEÇAR\nQuase tudo aqui salva sozinho na hora em que você mexe — não fique procurando um botão "salvar" para cada campo. Para amarrar um responsável, é preciso que a pessoa exista como usuário da equipe; para amarrar um cliente, ele precisa estar cadastrado em Clientes.\n\n' +
      '👣 PASSO A PASSO\n1. Título: clique no título no topo para reescrevê-lo.\n2. Prioridade: escolha Baixa, Normal, Alta ou Urgente. A bolinha colorida do card muda conforme.\n3. Prazo: clique no campo de data e escolha o dia de entrega. Se a data passar sem concluir, o card mostra o prazo em vermelho.\n4. Cliente: escolha de quem é a encomenda (lista dos seus clientes).\n5. Responsável: escolha quem vai fazer (pessoas da sua equipe).\n6. Etiquetas: clique em "Gerenciar" para marcar etiquetas existentes ou criar uma nova (dá nome e ganha cor). Servem para agrupar tarefas por assunto.\n7. Descrição: escreva os detalhes do trabalho.\n8. Checklists: clique em "+ Checklist" para criar uma lista de itens (subtarefas). Adicione itens, marque a caixinha quando cada um ficar pronto — uma barrinha verde mostra o progresso.\n9. Artes/imagens: clique em "Anexar" para subir fotos (referências, artes). Elas ficam em miniaturas.\n10. Vínculos: clique em "+ Pedido" ou "+ Pagamento" para ligar a tarefa a um pedido da Produção ou a um lançamento do Financeiro.\n11. Comentários: escreva um recado e clique em "Enviar". Use @ para mencionar alguém da equipe (ela é avisada).\n12. Histórico: no fim, o registro automático de tudo que aconteceu com a tarefa.\n13. Para apagar a tarefa: botão "Excluir" no rodapé. Para trocar de tarefa sem fechar: setas ← → do teclado ou os botões no topo.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nCada alteração (prioridade, prazo, cliente, responsável, etiqueta, checklist) é gravada no instante em que você faz — por isso não há um botão salvar geral. As fotos anexadas são reduzidas de tamanho automaticamente antes de subir, para não pesar. Quando você menciona alguém com @ num comentário, o sistema identifica a pessoa e a notifica. O Histórico é escrito sozinho pelo sistema: cada vez que a tarefa é criada, movida, editada, comentada ou etiquetada, fica um registro com quem fez e quando. As setas ← → navegam entre os cards da mesma coluna, respeitando o filtro ativo.\n\n' +
      '⚠️ ERROS COMUNS\n- Procurar um botão "salvar" para cada campo. Não existe: salva sozinho ao mexer.\n- Marcar um prazo e achar que o sistema faz a tarefa sozinha. O prazo é um lembrete/alerta; quem executa é você.\n- Usar @ com o nome errado no comentário. Escolha a pessoa na listinha que aparece ao digitar @, para a menção funcionar.\n- Anexar uma imagem enorme e achar que vai travar. O sistema encolhe a foto automaticamente.\n- Excluir a tarefa quando só queria fechar a janela. "Excluir" (no rodapé) apaga de vez; para só sair, use "Fechar" ou o X.\n\n' +
      '🔗 SE LIGA COM\nO campo Cliente puxa a sua lista de Clientes — e a tarefa passa a aparecer ligada àquela pessoa. O Responsável vem dos usuários da equipe (Config → Usuários), e as tarefas atribuídas a alguém aparecem em Minhas Tarefas dela. Os Vínculos conectam a tarefa a Pedidos (Produção) e Pagamentos (Financeiro), com link direto. Prazos alimentam o Calendário; toda ação alimenta o feed de Atividades.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia abre o card "Buquê da Bia". Marca prioridade Alta, prazo para sexta, cliente "Bia Souza", responsável "eu mesma". Cria um checklist com "comprar fitas", "bordar nome", "montar", "embalar" e vai marcando conforme faz — a barrinha verde enche e dá gostinho de progresso. Anexa a foto da inspiração que a Bia mandou. Vincula ao pedido nº 152. E deixa um comentário "@Ana confere se temos fita off-white" para a ajudante. Toda a encomenda, do começo ao fim, cabe nesse card.',
    faq: [
      {
        pergunta: 'Preciso salvar depois de mudar o prazo, o responsável ou a prioridade?',
        resposta:
          'Não precisa, e é aqui que muita gente se confunde. No detalhe da tarefa, cada campo salva sozinho no exato momento em que você mexe: assim que você escolhe o prazo no calendário, ou seleciona o responsável, ou muda a prioridade, aquilo já ficou gravado. Não existe (e você não vai achar) um botão "salvar" geral para esses campos — o sistema guarda tudo automaticamente e por isso a alteração já aparece no card do quadro na hora. Isso deixa o uso mais leve e rápido: você mexe e segue a vida, sem medo de perder.',
      },
      {
        pergunta: 'O que é o checklist e para que serve?',
        resposta:
          'O checklist é uma listinha de subtarefas dentro da tarefa — as etapas menores de um trabalho maior. Por exemplo, na tarefa "Buquê da Bia", o checklist pode ter: "comprar fitas", "bordar nome", "montar", "embalar". Você cria clicando em "+ Checklist", adiciona cada item, e vai marcando a caixinha conforme conclui. Uma barrinha verde mostra o progresso (por exemplo, 2 de 4 feitos = metade cheia). Serve para você quebrar um trabalho grande em passinhos e ter a satisfação (e o controle) de ir riscando cada um. Uma mesma tarefa pode ter até vários checklists, se você quiser separar por frentes.',
      },
      {
        pergunta: 'Como funciona mencionar alguém com @ nos comentários?',
        resposta:
          'Os comentários são o bate-papo da equipe dentro daquela tarefa. Quando você quer chamar a atenção de uma pessoa específica, digite @ no comentário e comece a escrever o nome dela — vai aparecer uma listinha para você clicar e escolher a pessoa certa. Ao enviar o comentário, essa pessoa é notificada de que foi mencionada, então ela sabe que precisa olhar aquilo. É perfeito para pedir uma conferência ("@Ana confere se temos fita off-white") ou passar uma orientação para a ajudante, sem precisar mandar mensagem por fora do sistema. O importante é escolher o nome na lista que aparece, e não só digitar de cabeça, para a menção realmente avisar a pessoa.',
      },
      {
        pergunta: 'Anexei fotos na tarefa. Elas vão pesar ou ocupar muito espaço?',
        resposta:
          'Não se preocupe com isso. Quando você anexa uma foto (uma arte, uma referência que a cliente mandou), o sistema automaticamente reduz o tamanho dela antes de guardar — ela fica leve o suficiente para carregar rápido, mas ainda nítida para você ver o que importa. As imagens aparecem como miniaturas no card, e você pode anexar várias. Serve muito para manter tudo da encomenda junto: a inspiração, o modelo aprovado, a paleta de cores. Se quiser remover uma foto depois, é só passar o mouse por cima dela e clicar no X.',
      },
      {
        pergunta: 'Para que serve vincular a tarefa a um Pedido ou Pagamento?',
        resposta:
          'Os Vínculos são pontes que ligam a tarefa às outras partes do sistema. Ao clicar em "+ Pedido", você amarra aquela tarefa a um pedido específico da Produção — assim, de dentro da tarefa você chega ao pedido com um clique, e vice-versa, sem ficar procurando. Ao clicar em "+ Pagamento", você liga a um lançamento do Financeiro, útil para lembrar se aquela encomenda já foi paga. É o que faz a tarefa parar de ser um bilhetinho solto e virar parte da história completa daquela venda: o pedido, o dinheiro e o trabalho a fazer, todos conectados. Você busca o pedido ou pagamento pelo nome/número e clica para vincular.',
      },
    ],
  },
  {
    slug: 'tarefas-minhas',
    modulo: 'Tarefas',
    tela: 'Minhas Tarefas',
    caminho: 'Menu → Tarefas → Minhas',
    palavrasChave: 'minhas tarefas, o que eu tenho pra fazer, tarefas atribuidas a mim, minhas pendencias, tarefas que sao minhas, filtrar minhas por prioridade, minha lista pessoal, o que e meu, tarefas do meu nome',
    conteudo:
      '📍 ONDE FICA\nMenu → Tarefas → Minhas. Mostra uma lista simples e direta, sem colunas: só as tarefas em que VOCÊ é a responsável, de todos os quadros juntos.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a sua lista pessoal de afazeres. Enquanto o quadro mostra o trabalho de todo mundo espalhado em colunas, esta tela filtra e junta só o que está no SEU colo, venha de qual quadro vier. É a resposta rápida para a pergunta "o que eu preciso fazer?" — sem distração, sem o que é dos outros.\n\n' +
      '✅ ANTES DE COMEÇAR\nPara uma tarefa aparecer aqui, ela precisa ter você marcada como responsável no detalhe do card. Se a sua lista está vazia, provavelmente ninguém atribuiu tarefas a você (ou você não se atribuiu).\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Tarefas → Minhas.\n2. Veja a lista das suas tarefas. Cada linha mostra o título, de qual quadro e coluna a tarefa é, o cliente (se houver) e o prazo.\n3. Prazos já vencidos aparecem em vermelho — priorize esses.\n4. Use o seletor "Prioridade" no topo para ver só as urgentes, ou só as altas, etc.\n5. Clique em qualquer tarefa para ir direto ao quadro dela e trabalhá-la.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO sistema junta, de todos os seus quadros, apenas as tarefas cujo responsável é você (o seu usuário). A bolinha colorida do lado indica a prioridade; a bolinha ao lado do nome do quadro é a cor daquele quadro. O prazo em vermelho é calculado comparando a data de entrega com o dia de hoje. O filtro de prioridade só afina o que está na tela, sem mexer nas tarefas.\n\n' +
      '⚠️ ERROS COMUNS\n- Lista vazia porque nenhuma tarefa tem você como responsável. Peça para atribuírem, ou marque-se responsável nos cards.\n- Achar que aqui você vê tudo do ateliê. Não: esta tela é só o SEU. Para o todo, use os Quadros ou a Visão Geral.\n- Ignorar os prazos em vermelho. Eles são os atrasados — merecem prioridade.\n\n' +
      '🔗 SE LIGA COM\nO que enche esta lista é o campo "Responsável" que você (ou sua chefe) definiu no Detalhe de cada tarefa. Clicar numa linha te leva ao Quadro dela. É a mesma informação que aparece resumida na Visão Geral, no quadro "Por responsável", só que aqui focada em você.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia divide o trabalho com a ajudante Ana. Toda manhã, a Ana abre Tarefas → Minhas e vê só o que é dela: "bordar toalha da Cléo", "cortar feltro do kit escolar". Não precisa vasculhar os quadros nem se perder no que é da Sofia. Ela filtra por "Urgente", ataca primeiro o que tem prazo vermelho, e vai clicando em cada tarefa para trabalhar. Foco total no que importa para ela.',
    faq: [
      {
        pergunta: 'Minha lista de "Minhas Tarefas" está vazia. Está com erro?',
        resposta:
          'Provavelmente não é erro — é que nenhuma tarefa está atribuída a você no momento. Esta tela mostra exclusivamente as tarefas em que o seu usuário está marcado como "Responsável" no detalhe do card. Se ninguém definiu você como responsável de nada (ou você mesma não se atribuiu), não há o que listar. A solução: abra os quadros, encontre as tarefas que são suas, clique em cada uma e, no campo "Responsável", selecione o seu nome. A partir daí elas passam a aparecer aqui, reunidas num lugar só. Se você é a única pessoa do ateliê, vale o hábito de se marcar como responsável para usar esta lista como sua agenda pessoal.',
      },
      {
        pergunta: 'Qual a diferença entre "Minhas Tarefas" e abrir os Quadros?',
        resposta:
          'É uma diferença de foco. Nos Quadros você vê TODAS as tarefas, de todo mundo, organizadas em colunas — é a visão do trabalho inteiro do ateliê, boa para planejar e enxergar o processo. Já "Minhas Tarefas" é um recorte pessoal: pega, de todos os quadros de uma vez, apenas o que está no seu colo, e mostra numa lista limpa, sem colunas nem o que é dos outros. Use os Quadros quando quiser gerenciar e mover o trabalho; use Minhas Tarefas quando quiser simplesmente saber "o que EU tenho para fazer hoje" e sair executando, sem distração.',
      },
    ],
  },
  {
    slug: 'tarefas-calendario',
    modulo: 'Tarefas',
    tela: 'Calendário de Tarefas',
    caminho: 'Menu → Tarefas → Calendário',
    palavrasChave: 'calendario de tarefas, agenda, ver por data, tarefas do mes, o que vence em cada dia, prazos no calendario, quando entrega cada coisa, visao mensal, mudar de mes, dia de hoje, entregas do dia',
    conteudo:
      '📍 ONDE FICA\nMenu → Tarefas → Calendário. Mostra o mês inteiro em formato de calendário (as semanas em linhas, os dias em quadradinhos), com as tarefas aparecendo nos dias dos seus prazos.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a sua agenda de parede, mas montada sozinha a partir dos prazos das tarefas. Em vez de listas, você vê o mês espalhado e, em cada dia, os trabalhos que vencem ali. Ótimo para enxergar a distribuição do mês: onde tem folga, onde tem acúmulo, e não deixar duas entregas grandes caírem no mesmo dia sem você perceber.\n\n' +
      '✅ ANTES DE COMEÇAR\nSó aparecem no calendário as tarefas que TÊM um prazo definido. Tarefas sem data marcada não têm onde cair no calendário — se você quer que algo apareça aqui, defina o prazo dela no detalhe do card.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Tarefas → Calendário.\n2. O mês atual aparece; o dia de hoje vem destacado em laranja.\n3. Cada tarefa surge como uma tarjinha colorida no dia do seu prazo (a cor é a do quadro de onde ela vem).\n4. Se um dia tiver muitas tarefas, ele mostra algumas e um "+2" indicando quantas mais existem.\n5. Clique numa tarjinha para pular direto ao quadro daquela tarefa.\n6. Use as setas ‹ › ao lado do nome do mês para avançar ou voltar meses.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO calendário lê o prazo de cada tarefa e a coloca no dia certo. A cor de cada tarjinha vem do quadro de origem, para você reconhecer de qual projeto é. Cada quadradinho de dia cabe umas poucas tarjinhas à vista; havendo mais, aparece o contador "+N". As setas apenas trocam o mês exibido, sem alterar nada nas tarefas.\n\n' +
      '⚠️ ERROS COMUNS\n- Uma tarefa não aparece no calendário: quase sempre é porque ela não tem prazo definido. Coloque a data no detalhe do card.\n- Achar que dá para arrastar as tarefas no calendário. Aqui é só visualização; para mudar prazo, abra a tarefa e mude a data.\n- Ver "+3" e achar que é erro. É só o aviso de que há mais 3 tarefas naquele dia do que cabem à vista — clique para investigar no quadro.\n\n' +
      '🔗 SE LIGA COM\nTudo aqui vem do campo Prazo que você define no Detalhe da tarefa. As cores vêm dos seus Quadros. Clicar numa tarjinha leva ao Quadro correspondente. É a mesma informação de prazos que a Visão Geral resume em "prazo próximo" e "vencidos", só que espalhada visualmente pelos dias.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia abre o Calendário e leva um susto: no dia 20 tem QUATRO entregas empilhadas (quatro tarjinhas e um "+1"). Ela percebe que aceitou encomendas demais para a mesma data. Ainda dá tempo: ela clica em duas delas, entra nas tarefas e negocia novos prazos com as clientes, redistribuindo pelo mês. O calendário evitou um apuro que ela só veria em cima da hora.',
    faq: [
      {
        pergunta: 'Uma tarefa não aparece no calendário. Por quê?',
        resposta:
          'Porque, quase com certeza, ela não tem um prazo (data de entrega) definido. O calendário só consegue posicionar uma tarefa se ela tiver uma data — é a data que diz em qual quadradinho do mês ela deve cair. Tarefas sem prazo existem normalmente nos quadros, mas simplesmente não têm lugar no calendário. Se você quer que determinada tarefa apareça aqui, abra o card dela no quadro e preencha o campo "Prazo" com o dia desejado. Assim que salvar (e ele salva sozinho), a tarefa surge no calendário, na data escolhida, com a cor do quadro dela.',
      },
      {
        pergunta: 'O que significa aquele "+2" (ou "+3") em alguns dias?',
        resposta:
          'Significa que naquele dia há mais tarefas do que cabem à vista no quadradinho. Cada dia mostra só algumas tarjinhas para não ficar poluído; quando existem mais, o sistema resume o excedente com um "+2", "+3", etc. — ou seja, "além destas que você está vendo, há mais 2 (ou 3) tarefas com prazo neste dia". É um ótimo sinal de alerta de acúmulo: um dia com "+4" é um dia sobrecarregado. Para ver quais são todas elas, clique nas tarjinhas para ir aos quadros, ou reveja seus prazos e considere redistribuir a carga daquele dia.',
      },
    ],
  },
  {
    slug: 'tarefas-atividades',
    modulo: 'Tarefas',
    tela: 'Atividades (feed)',
    caminho: 'Menu → Tarefas → Atividades',
    palavrasChave: 'atividades, feed de tarefas, historico geral, o que mudou nas tarefas, quem mexeu no que, quem fez o que, ultimas acoes, linha do tempo, registro de mudancas, quem criou tarefa, quem moveu card, quem comentou',
    conteudo:
      '📍 ONDE FICA\nMenu → Tarefas → Atividades. Mostra uma linha do tempo (feed) das últimas coisas que aconteceram nas tarefas de todos os quadros, a mais recente no topo.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o diário de bordo do módulo de Tarefas. Cada linha conta uma coisinha que alguém fez: criou uma tarefa, moveu um card, comentou, colocou uma etiqueta. Serve para você, especialmente quando trabalha com ajudantes, saber o que andou acontecendo sem precisar abrir quadro por quadro — é o "o que rolou por aqui" num relance.\n\n' +
      '✅ ANTES DE COMEÇAR\nEste feed se escreve sozinho conforme você e a equipe usam as tarefas; você não digita nada aqui. Se estiver vazio, é porque ainda houve pouca movimentação nas tarefas.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Tarefas → Atividades.\n2. Leia de cima para baixo — o mais recente fica no topo.\n3. Cada linha traz um ícone do tipo de ação (✨ criada, 🔀 movida, ✏️ editada, 💬 comentário, 🏷️ etiqueta, ☑️ checklist, 🔗 vínculo), quem fez, o que fez e em qual tarefa, com data e hora.\n4. Clique numa linha para ir direto ao quadro da tarefa envolvida.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nToda vez que uma tarefa é criada, movida, editada, comentada, etiquetada, tem checklist mexido ou ganha um vínculo, o sistema registra automaticamente esse evento com o nome de quem fez e o horário. O feed simplesmente lista esses registros em ordem, do mais novo para o mais antigo. É o mesmo tipo de registro que também aparece dentro de cada card, na parte "Histórico" — só que aqui reunido de todas as tarefas.\n\n' +
      '⚠️ ERROS COMUNS\n- Esperar editar ou desfazer algo pelo feed. Ele é só um registro de leitura; para mudar algo, vá à tarefa.\n- Feed vazio e achar que quebrou. Significa apenas que houve pouca atividade recente nas tarefas.\n- Confundir com o histórico de UMA tarefa. Este junta o de TODAS; o histórico dentro do card é só daquela.\n\n' +
      '🔗 SE LIGA COM\nCada evento aqui nasce de uma ação feita nos Quadros e nos Detalhes das tarefas. Clicar leva ao Quadro. É a versão geral do "Histórico" que você vê no rodapé de cada card. Junto com Minhas Tarefas e o Calendário, forma as visões auxiliares que ajudam a acompanhar o trabalho da equipe.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia passou o dia numa feira e, à noite, quer saber o que a ajudante Ana adiantou. Abre Tarefas → Atividades e lê a linha do tempo: "Ana moveu \'toalha da Cléo\' para Pronto", "Ana comentou em \'kit escolar\'", "Ana criou \'lembrança da creche\'". Em dez segundos, a Sofia se atualizou do dia inteiro sem ligar para ninguém nem abrir cada quadro. Transparência sem cobrança.',
    faq: [
      {
        pergunta: 'Qual a diferença entre esta tela de Atividades e o "Histórico" que tem dentro de cada tarefa?',
        resposta:
          'A informação é do mesmo tipo, mas o alcance é diferente. O "Histórico" que aparece no rodapé do detalhe de uma tarefa mostra o que aconteceu SÓ com aquela tarefa específica — a vida daquele card. Já a tela de Atividades reúne, num único feed, os acontecimentos de TODAS as tarefas de todos os quadros, misturados em ordem de tempo. Pense assim: o histórico do card é o diário de uma pessoa; as Atividades são o jornal do ateliê inteiro. Use o histórico do card quando quiser entender uma tarefa; use as Atividades quando quiser um panorama geral do que a equipe andou fazendo.',
      },
      {
        pergunta: 'Posso desfazer alguma coisa pelo feed de Atividades?',
        resposta:
          'Não — o feed de Atividades é apenas um registro para leitura, uma testemunha do que aconteceu, e não um lugar de ação. Ele te conta que "fulana moveu tal card" ou "criou tal tarefa", mas não tem botões para reverter isso ali mesmo. Se você viu no feed algo que quer mudar ou corrigir, o caminho é clicar na linha correspondente: isso te leva direto ao quadro e à tarefa envolvida, e é lá, na própria tarefa, que você faz a alteração (mover de volta, editar, apagar um comentário, etc.). O feed serve para descobrir e localizar; a correção se faz na origem.',
      },
    ],
  },

  // ═══════════════════════ ASSISTENTE DE COMPRAS ═══════════════════════
  {
    slug: 'assistente-pesquisar-preco',
    modulo: 'Assistente de Compras',
    tela: 'Pesquisar preço de mercado',
    caminho: 'Menu → Assistente de Compras (Pesquisa de Preço)',
    palavrasChave: 'assistente de compras, pesquisa de preco, quanto custa um material, preco de mercado, faixa de preco, quanto pagar por, cola branca feltro fita, estou pagando caro, esta caro ou barato, preco medio, menor preco, dados da comunidade, anonimo, dados insuficientes, confiabilidade, quantas fontes, ver o preco justo',
    conteudo:
      '📍 ONDE FICA\nMenu → Assistente de Compras. Abre uma tela com uma frase de boas-vindas, uma caixa de busca grande ("Ex: cola branca, feltro, fita de cetim...") e o botão "Pesquisar".\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ a sua consultora de compras de bolso. Você digita um material e ela te diz a faixa de preço que a comunidade de artesãs costuma pagar por ele — o menor, o médio e uma faixa sugerida. Serve para você nunca mais comprar no escuro: antes de fechar com um fornecedor, você confere se o preço dele está dentro do normal, alto ou uma pechincha. É como perguntar para centenas de colegas "quanto vocês pagam nisso?" de uma vez.\n\n' +
      '✅ ANTES DE COMEÇAR\nUm ponto de ouro para você entender e confiar: todos os preços aqui são ANÔNIMOS e AGREGADOS. O sistema nunca mostra quanto uma artesã específica pagou — ele junta os dados de muitas e mostra só a média do grupo. E o contrário também vale: o que você cadastra dos seus materiais entra nessa média coletiva de forma anônima, ajudando as colegas, sem ninguém saber que foi você. É uma vaquinha de informação.\n\n' +
      '👣 PASSO A PASSO\n1. Entre em Assistente de Compras.\n2. Na caixa de busca, digite o material do jeito mais simples (ex.: "feltro", "cola quente", "fita de cetim").\n3. Clique em "Pesquisar" (ou aperte Enter).\n4. Se houver dados suficientes, aparece o resultado: o nome do material, uma etiqueta de Confiabilidade (baixa, média ou alta), e a "Faixa sugerida de mercado" em destaque laranja.\n5. Logo abaixo, três números: Menor (o preço mais em conta encontrado), Médio (a média) e Fontes (de quantas origens veio a informação).\n6. Pode aparecer também uma "Análise" com um resuminho e uma dica de compra, um gráfico de evolução do preço, e a seção "Onde comprar".\n7. Se aparecer "Dados insuficientes", é porque ainda há poucas informações sobre aquele material — tente um termo mais comum ou volte outro dia.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO sistema reúne os preços daquele material vindos de várias artesãs e calcula a média e a faixa, sempre de forma agregada (nunca individual). A etiqueta de "Confiabilidade" indica o quão robusta é a amostra: quanto mais artesãs e mais registros, maior a confiabilidade (alta é mais segura que baixa). O número de "Fontes" te diz de quantas origens diferentes veio o dado. Se a amostra for pequena demais para ser honesta, ele prefere dizer "Dados insuficientes" a te dar um número furado — é uma questão de só te mostrar informação em que dá para confiar. A cobertura melhora com o tempo, conforme mais gente cadastra materiais.\n\n' +
      '⚠️ ERROS COMUNS\n- Buscar termos muito específicos ou com marca ("cola tal modelo 500ml roxa") e receber "dados insuficientes". Prefira o nome genérico ("cola branca").\n- Achar que o sistema mostra o preço de uma loja/pessoa específica. Não: é sempre média anônima de muitas fontes.\n- Estranhar "Dados insuficientes" e achar que é falha. É honestidade: ele só fala quando tem amostra suficiente.\n- Tratar a faixa como preço fixo. É uma referência do que a maioria paga, não uma tabela oficial.\n\n' +
      '🔗 SE LIGA COM\nOs seus materiais cadastrados na Precificação são a matéria-prima deste assistente por dois caminhos: eles alimentam (anonimamente) a média da comunidade, e servem de base para a comparação "Meus preços vs mercado". Deste resultado você pode ainda "Seguir" o material (para ser avisada quando o preço cair) e ver "Onde comprar".\n\n' +
      '💬 EXEMPLO SOFIA\nUm fornecedor ofereceu feltro para a Sofia a R$ 12 a folha e ela ficou na dúvida: é caro? Ela abre o Assistente de Compras, digita "feltro" e vê: faixa de mercado entre R$ 6 e R$ 9, média R$ 7,50, confiabilidade alta, 30 fontes. Na hora ela percebe que os R$ 12 estão bem acima do normal. Volta ao fornecedor com argumento para pechinchar, ou procura outro. Economia real, por causa de um dado que ela não tinha antes.',
    faq: [
      {
        pergunta: 'De onde vêm esses preços? É de alguma loja específica?',
        resposta:
          'Não é de uma loja nem de uma pessoa específica — e essa é a beleza da ferramenta. Os preços vêm da comunidade de artesãs que usam o sistema: cada uma cadastra seus materiais com os valores que paga, e o Assistente junta tudo de forma ANÔNIMA e AGREGADA, mostrando a média do grupo. Ou seja, é como se centenas de colegas dividissem com você quanto costumam pagar em cada material, sem que ninguém saiba quem falou o quê. Nunca aparece o preço individual de ninguém — nem o seu para as outras, nem o das outras para você. É uma informação coletiva, construída por todas, para ajudar todas.',
      },
      {
        pergunta: 'Pesquisei um material e apareceu "Dados insuficientes". O que faço?',
        resposta:
          'Isso quer dizer que ainda não há registros suficientes daquele material na comunidade para gerar um número confiável — e o sistema prefere ser honesto e dizer isso, em vez de te dar um preço furado, baseado em uma ou duas informações soltas. Não é uma falha, é cuidado com você. O que fazer: primeiro, tente um termo mais genérico e comum — em vez de "cola tal marca 500ml", busque só "cola branca"; materiais populares têm mais dados. Segundo, volte a pesquisar dias depois: a cobertura melhora o tempo todo, conforme mais artesãs cadastram seus materiais. Quanto mais gente usa, mais rica e certeira a base fica para todas.',
      },
      {
        pergunta: 'O que significa a "Confiabilidade" (baixa, média, alta)?',
        resposta:
          'A Confiabilidade é o quanto você pode confiar naquele resultado, e depende do tamanho da amostra por trás dele. Confiabilidade "alta" significa que muitas artesãs e muitos registros formaram aquela faixa de preço — é um número robusto, em que dá para se apoiar com segurança. "Média" é razoável, serve de referência, mas com um pouco mais de cautela. "Baixa" quer dizer que a amostra ainda é pequena; o número te dá uma ideia, mas pode variar bastante conforme mais dados chegarem. Pense como numa pesquisa de opinião: ouvir 500 pessoas dá um resultado mais confiável do que ouvir 5. Use a confiabilidade para saber o peso que dá para cada resposta.',
      },
      {
        pergunta: 'A minha busca influencia os preços? O que eu vejo é meu preço?',
        resposta:
          'Não, o que você vê nunca é o seu preço isolado — é sempre a média anônima da comunidade. Seus materiais cadastrados na Precificação até contribuem para essa média coletiva (de forma anônima, misturados aos de todo mundo), mas o resultado da pesquisa não é um espelho do que VOCÊ paga. Para comparar especificamente os SEUS preços com o mercado, existe outra ferramenta dentro desta mesma tela: o botão "Ver meus preços vs mercado", que pega os seus materiais e mostra em quais você está pagando acima ou abaixo da média. A pesquisa por termo é para conhecer o mercado em geral; a comparação é para olhar para dentro de casa.',
      },
    ],
  },
  {
    slug: 'assistente-meus-precos-vs-mercado',
    modulo: 'Assistente de Compras',
    tela: 'Meus preços vs mercado (comparação)',
    caminho: 'Menu → Assistente de Compras → "Ver meus preços vs mercado"',
    palavrasChave: 'meus precos vs mercado, comparar meus materiais, estou pagando caro em que, onde economizar, onde eu pago acima, onde eu compro bem, comparacao com mercado, meus materiais caros, quanto acima do mercado, economia, revisar fornecedores, meus precos',
    conteudo:
      '📍 ONDE FICA\nNa tela do Assistente de Compras, logo abaixo da busca, o link "📊 Ver meus preços vs mercado". Ao clicar, abre um quadro comparando os SEUS materiais com a média da comunidade. Para voltar à busca, clique em "← Voltar à busca".\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ o raio-x das suas compras. Em vez de você pesquisar material por material, esta ferramenta pega de uma vez os materiais que você cadastrou e compara cada um com o preço de mercado, apontando onde você está pagando ACIMA da média — ou seja, onde dá para economizar. É a colega experiente olhando sua lista de compras e dizendo "menina, nesse aqui você está pagando caro".\n\n' +
      '✅ ANTES DE COMEÇAR\nPara a comparação funcionar, você precisa ter materiais cadastrados na Precificação, com preço preenchido. E, para cada material, precisa existir amostra suficiente na comunidade — materiais raros podem ficar de fora da comparação por falta de dados. Assim como no resto do assistente, tudo é anônimo e agregado.\n\n' +
      '👣 PASSO A PASSO\n1. No Assistente de Compras, clique em "Ver meus preços vs mercado".\n2. Aguarde o sistema comparar (ele avisa quantos materiais foram comparados).\n3. Veja a lista "Onde você pode economizar": cada linha traz o material, quanto VOCÊ paga, quanto é a média do MERCADO e, à direita, quanto por cento acima você está (ex.: "+18%").\n4. Se você não estiver pagando acima em nada, aparece uma mensagem comemorando isso.\n5. No fim, pode aparecer uma linha verde dizendo em quantos materiais você já compra BEM (abaixo do mercado) — um parabéns.\n6. Clique em "← Voltar à busca" para sair da comparação.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nO sistema pega os seus materiais com preço cadastrado, dá uma prioridade aos mais caros (onde há maior potencial de economia) e, para cada um, busca a média anônima da comunidade. Onde houver amostra suficiente, ele calcula a diferença percentual entre o seu preço e o médio. Materiais em que você paga bem acima entram na lista de economia, ordenados pelo tamanho da economia possível. Materiais sem dados suficientes na comunidade são simplesmente pulados — não dá para comparar às cegas. Nada disso expõe você nem ninguém: são só médias.\n\n' +
      '⚠️ ERROS COMUNS\n- Quadro vazio ou poucos itens porque você tem poucos materiais cadastrados (ou sem preço). Cadastre-os na Precificação com valores.\n- Achar que a ausência de um material na lista é erro. Pode ser que falte amostra na comunidade para ele, ou que você já compre bem — nos dois casos ele não entra na lista de "economizar".\n- Ler "+20%" como valor em reais. É porcentagem: quanto acima do mercado você está.\n- Esperar que ele compre mais barato para você. Ele aponta onde economizar; a negociação com fornecedor é com você.\n\n' +
      '🔗 SE LIGA COM\nEsta ferramenta bebe direto dos materiais que você cadastra na Precificação (nome e preço). Quanto mais completo e atualizado o seu cadastro de materiais lá, mais útil e certeira fica esta comparação. Os resultados usam a mesma base anônima da comunidade que alimenta a pesquisa de preço por termo.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia clica em "Ver meus preços vs mercado" e o quadro aponta: "Fita de cetim — Você: R$ 5,00 · Mercado: R$ 3,20 · +56%". Ela arregala os olhos: está pagando mais que o dobro numa fita que usa toda semana! Descobre que o problema é comprar em pouca quantidade na papelaria da esquina. Passa a comprar por atacado num fornecedor da faixa de mercado e economiza todo mês, sem cortar qualidade — só parando de pagar caro.',
    faq: [
      {
        pergunta: 'A comparação está vazia ou com pouquíssimos itens. Por quê?',
        resposta:
          'Há dois motivos comuns. O primeiro: você tem poucos materiais cadastrados na Precificação, ou os que tem estão sem preço preenchido — e a comparação só funciona com materiais que têm um valor cadastrado, pois é esse valor que ela confronta com o mercado. A solução é ir à Precificação e cadastrar seus materiais com os preços que você paga. O segundo motivo: mesmo que você tenha vários materiais, alguns podem não ter amostra suficiente na comunidade para uma comparação honesta, e esses são pulados. Conforme você cadastra mais materiais e a comunidade cresce, a comparação vai ficando mais completa e reveladora.',
      },
      {
        pergunta: 'O que significa aquele número tipo "+18%" na lateral?',
        resposta:
          'É a porcentagem acima do mercado que você está pagando naquele material — não é valor em reais, é o quanto a mais em relação à média. Por exemplo, "+18%" quer dizer que o seu preço está 18% mais caro do que a média que a comunidade paga por aquele mesmo material. Quanto maior esse número, maior a diferença e, portanto, maior a sua oportunidade de economizar ali. A lista costuma vir ordenada colocando primeiro os materiais onde a economia possível é maior, para você atacar o que mais pesa no seu bolso. Materiais onde você paga IGUAL ou ABAIXO do mercado não entram nessa lista de economia (eles aparecem, no fim, como um "parabéns, você compra bem").',
      },
      {
        pergunta: 'O assistente vai comprar mais barato para mim?',
        resposta:
          'Não — ele é um consultor, não um comprador. O que ele faz é abrir os seus olhos: mostrar, com clareza e com base na média da comunidade, em quais materiais você está pagando acima do que a maioria paga. A partir daí, a ação é sua: renegociar com o fornecedor atual usando esse dado como argumento, procurar outro fornecedor, ou passar a comprar em quantidade para baixar o preço. Pense nele como aquela amiga que já pesquisou tudo e te avisa "olha, nesse aqui dá para pagar menos" — a decisão e a negociação continuam nas suas mãos, mas agora você negocia informada, e não no escuro.',
      },
    ],
  },
  {
    slug: 'assistente-seguir-material',
    modulo: 'Assistente de Compras',
    tela: 'Seguir material (alerta de preço)',
    caminho: 'Menu → Assistente de Compras → resultado → "Seguir preço deste material"',
    palavrasChave: 'seguir material, seguir preco, alerta de preco, me avisa quando baixar, aviso quando o preco cair, monitorar material, acompanhar preco, notificacao de queda, parar de seguir, deixar de acompanhar, avise quando ficar barato',
    conteudo:
      '📍 ONDE FICA\nDepois de pesquisar um material (com dados suficientes), no quadro do resultado aparece o botão "🔔 Seguir preço deste material". É ali que você começa a acompanhar aquele material.\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nÉ um vigia que trabalha por você. Em vez de você ficar pesquisando o mesmo material toda semana para ver se baixou, você clica em "Seguir" uma vez e o sistema fica de olho. Quando o preço de mercado daquele material cair, ele te avisa. Perfeito para materiais caros que você não precisa comprar com urgência: você espera o melhor momento sem esforço.\n\n' +
      '✅ ANTES DE COMEÇAR\nSó dá para seguir materiais que tenham dados suficientes (os que mostraram resultado, e não "dados insuficientes"). Você pode seguir vários materiais diferentes. Seguir não compra nada nem compromete nada — é só um aviso.\n\n' +
      '👣 PASSO A PASSO\n1. Pesquise o material no Assistente de Compras.\n2. No quadro do resultado, clique em "🔔 Seguir preço deste material".\n3. O botão muda para "🔔 Seguindo — avisamos quando o preço cair", confirmando que deu certo.\n4. Pronto: pode fechar. O sistema passa a acompanhar aquele material por você.\n5. Para deixar de seguir depois, é só desativar o acompanhamento daquele material.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nAo seguir, o sistema guarda que você tem interesse naquele material e, por padrão, monitora quedas de preço. Conforme ele constrói o histórico de preços do material dia após dia, ele compara a tendência; quando identifica uma queda, dispara o aviso para você. Se você seguir um material que já estava na sua lista, ele só atualiza o acompanhamento, sem duplicar. É um acompanhamento anônimo e coletivo, como o resto do assistente — baseado na média da comunidade, não em uma loja específica.\n\n' +
      '⚠️ ERROS COMUNS\n- Tentar seguir um material que deu "dados insuficientes". Sem dados suficientes não há o que acompanhar; espere a base crescer.\n- Achar que "Seguir" reserva ou compra o material. Não: é apenas um alerta de preço, sem compromisso.\n- Seguir e esperar aviso no mesmo dia. O aviso vem quando o preço realmente cair, o que pode levar tempo — é para materiais sem pressa.\n- Seguir o mesmo material várias vezes achando que reforça. Seguir de novo só atualiza; não precisa repetir.\n\n' +
      '🔗 SE LIGA COM\nO "Seguir" nasce do resultado da pesquisa de preço, então depende da mesma base anônima da comunidade. Faz par com a seção "Onde comprar" (quando o preço cair, você já sabe onde procurar) e com a comparação "Meus preços vs mercado" (que aponta onde vale a pena esperar uma baixa).\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia quer comprar uma máquina de tags de feltro, mas o preço está salgado e não tem pressa. Ela pesquisa o material, clica em "Seguir preço deste material" e esquece o assunto. Semanas depois, o sistema a avisa que o preço caiu. Ela aproveita a baixa e compra na hora certa, pagando bem menos do que pagaria se tivesse comprado por impulso lá atrás. O vigia trabalhou por ela.',
    faq: [
      {
        pergunta: 'Seguir um material me obriga a comprar ou reserva o preço?',
        resposta:
          'De jeito nenhum. Seguir é só ligar um alerta — um vigia que te avisa quando o preço daquele material cair. Não reserva nada, não compra nada, não te compromete com fornecedor nenhum e não custa nada. É simplesmente você dizendo ao sistema "fica de olho nisso para mim, me avisa se abaixar". Você continua totalmente livre para comprar ou não quando o aviso chegar. É a ferramenta ideal para aqueles materiais mais caros que você quer, mas não precisa com urgência: em vez de comprar por impulso, você espera pacientemente o melhor momento, e deixa o sistema vigiar por você.',
      },
      {
        pergunta: 'Segui um material e não recebi aviso nenhum. Está funcionando?',
        resposta:
          'Provavelmente sim — só que o aviso só chega quando o preço realmente cair, e isso pode levar dias ou semanas, porque depende do movimento do mercado. Seguir um material não gera um aviso imediato; ele gera um aviso FUTURO, no momento em que o sistema perceber uma queda no preço médio daquele material. Por isso essa ferramenta é feita para materiais sem pressa: você segue e esquece, confiando que será avisada quando valer a pena. Se você confirmou que o botão mudou para "Seguindo", está tudo certo — agora é só aguardar. Se precisa do material já, não espere o alerta: pesquise o preço atual e compre.',
      },
    ],
  },
  {
    slug: 'assistente-onde-comprar',
    modulo: 'Assistente de Compras',
    tela: 'Onde comprar (fornecedores e patrocinados)',
    caminho: 'Menu → Assistente de Compras → resultado → seção "Onde comprar"',
    palavrasChave: 'onde comprar, fornecedores, lojas, onde acho barato, quem vende, comprar material, indicacao de fornecedor, patrocinado, anuncio, loja parceira, link da loja, preco por fornecedor, onde as artesas compram',
    conteudo:
      '📍 ONDE FICA\nNo resultado de uma pesquisa de preço (com dados suficientes), role até a seção "🏪 Onde comprar". Ali aparecem fornecedores e, às vezes, lojas marcadas como "Patrocinado".\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nDepois de saber quanto um material deveria custar, a pergunta natural é "e onde eu compro?". Esta seção responde: mostra fornecedores citados pela comunidade para aquele material (com o preço médio que costumam praticar) e, quando há, lojas parceiras patrocinadas, com link direto. É a ponte entre descobrir o preço justo e efetivamente achar onde comprar.\n\n' +
      '✅ ANTES DE COMEÇAR\nA lista de fornecedores da comunidade depende de haver registros suficientes — para materiais mais raros, pode ainda não ter fornecedor listado. As lojas "Patrocinado" são parcerias identificadas claramente como tal, para você saber que ali há uma indicação comercial (transparência total).\n\n' +
      '👣 PASSO A PASSO\n1. Pesquise o material e veja o resultado.\n2. Role até "Onde comprar".\n3. As lojas com selo "Patrocinado" aparecem em destaque (fundo laranja) com link — clique para abrir a loja num nova aba.\n4. Abaixo, os fornecedores da comunidade: cada linha mostra o nome do fornecedor, quantos registros a comunidade tem dele e o preço médio praticado.\n5. Se não houver fornecedores suficientes ainda, aparece um aviso de que a base ainda está crescendo para aquele material.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nOs fornecedores da comunidade são reunidos a partir de onde as artesãs registram ter comprado aquele material, com a média de preço de cada um — sempre de forma agregada e anônima (você vê o fornecedor e a média, nunca quem comprou). As lojas "Patrocinado" são selecionadas por combinarem com o material pesquisado e são sinalizadas abertamente como patrocínio; clicar nelas leva ao site do parceiro. A ordem e o destaque dos patrocinados são definidos nas parcerias — mas o selo "Patrocinado" está sempre à vista, para não confundir indicação da comunidade com anúncio.\n\n' +
      '⚠️ ERROS COMUNS\n- Não ver fornecedor nenhum para um material raro. É falta de registros na comunidade; a base melhora com o tempo.\n- Confundir loja "Patrocinado" com a média da comunidade. O selo laranja "Patrocinado" indica que é um parceiro comercial, não um dado neutro.\n- Achar que o preço do fornecedor é uma cotação fechada para você. É a média que a comunidade registrou; confirme o valor atual direto com a loja.\n- Esperar que clicar já compre. O link só abre o site do fornecedor; a compra é feita lá, por você.\n\n' +
      '🔗 SE LIGA COM\nEsta seção fecha o ciclo do assistente: você pesquisa o preço (faixa de mercado), compara com o seu (Meus preços vs mercado), pode Seguir para esperar baixar, e aqui descobre Onde comprar. Tudo bebe da mesma base anônima e agregada da comunidade — nada aqui expõe uma artesã individual.\n\n' +
      '💬 EXEMPLO SOFIA\nA Sofia descobriu que paga caro no feltro e agora quer um fornecedor melhor. Na seção "Onde comprar", vê dois fornecedores citados pela comunidade, com preços na faixa boa, e uma loja parceira com selo "Patrocinado" e link. Ela clica no link, abre a loja, confere que o preço bate com a faixa de mercado, e faz o pedido por lá. Saiu da pesquisa direto para a solução, sem ficar caçando fornecedor no escuro.',
    faq: [
      {
        pergunta: 'O que significa o selo "Patrocinado" em algumas lojas?',
        resposta:
          'O selo "Patrocinado" (aquele destaque laranja) indica, com toda a transparência, que aquela loja é uma parceira comercial — ou seja, é uma indicação paga, um anúncio, e não um dado neutro colhido da comunidade. O sistema deixa isso sempre à vista de propósito, para você nunca confundir uma indicação da comunidade (que é a média anônima do que as artesãs pagam) com uma loja que está ali por parceria. Isso não quer dizer que a loja patrocinada seja ruim — muitas vezes é ótima e tem bons preços — mas é justo que você saiba a diferença ao decidir. Clicar nela abre o site do parceiro para você conferir e, se quiser, comprar.',
      },
      {
        pergunta: 'Não apareceu nenhum fornecedor para o material que pesquisei. E agora?',
        resposta:
          'Significa que a comunidade ainda não tem registros suficientes de onde comprar aquele material específico — geralmente acontece com materiais mais raros ou menos usados. Não é um defeito, é só a base ainda crescendo. Algumas saídas: tente pesquisar um nome mais genérico do material (às vezes o mesmo item aparece com outro termo que tem mais registros); confira se ao menos a faixa de preço apareceu, para você já ir negociar com fornecedores que você conhece munida do valor justo; e volte outro dia, porque a seção "Onde comprar" vai ficando mais rica conforme mais artesãs registram suas compras. Quanto mais a comunidade usa, melhor para todas.',
      },
      {
        pergunta: 'O preço que aparece do fornecedor é uma cotação garantida para mim?',
        resposta:
          'Não é uma cotação fechada nem uma promessa de preço — é a média que a comunidade registrou ter pago naquele fornecedor. Serve como uma excelente referência para você saber o que esperar e comparar, mas o preço real do dia pode variar (por promoções, quantidade, frete, época do ano). Por isso, ao escolher um fornecedor pela seção "Onde comprar", trate o valor mostrado como um bom ponto de partida e confirme o preço atual diretamente com a loja antes de fechar. É a mesma lógica de todo o assistente: ele te dá a informação da comunidade para você chegar informada, mas a negociação e a confirmação final são sempre suas.',
      },
    ],
  },
  {
    slug: 'assistente-ativar-modulo',
    modulo: 'Assistente de Compras',
    tela: 'Ligar / desligar o Assistente de Compras',
    caminho: 'Menu → Config → Geral → Módulos',
    palavrasChave: 'ativar assistente de compras, ligar pesquisa de preco, habilitar assistente, sumiu assistente de compras, nao tenho pesquisa de preco, liberar assistente, modulo nao ativado, onde ligo o assistente',
    conteudo:
      '📍 ONDE FICA\nMenu → Config → Geral. Role até a seção "Módulos" e ache a chavinha "Assistente de Compras (IA)".\n\n' +
      '💡 O QUE É E PRA QUE SERVE\nO Assistente de Compras é um módulo — um cômodo do sistema que você abre quando quiser. Ligar a chavinha faz o menu do assistente aparecer e libera a pesquisa de preços, a comparação e o resto. Se estiver desligado, o menu não aparece e o assistente responde "Módulo não ativado".\n\n' +
      '✅ ANTES DE COMEÇAR\nSó a dona/administradora (perfil ADMIN) liga módulos. Ligar aqui não expõe seus dados: a sua participação na base da comunidade é sempre anônima e agregada.\n\n' +
      '👣 PASSO A PASSO\n1. Abra Config → Geral.\n2. Vá até a seção "Módulos".\n3. Ache "Assistente de Compras (IA)" e clique na chavinha para deixá-la laranja (ligada).\n4. Salve as configurações.\n5. O menu do Assistente de Compras aparece e a pesquisa de preços passa a funcionar.\n\n' +
      '🧮 COMO FUNCIONA POR TRÁS\nA chavinha guarda um sim/não no cadastro do seu ateliê. Enquanto estiver "não", tanto o menu some quanto as buscas são bloqueadas com o aviso "Módulo não ativado" — é a mesma tranca vista por dois lados. Ligando, tudo se abre. Cada ateliê tem a sua configuração, independente das outras.\n\n' +
      '⚠️ ERROS COMUNS\n- "Não acho o Assistente de Compras": o módulo está desligado, ou você entrou sem ser administradora.\n- Receber "Módulo não ativado" ao pesquisar: mesma causa — ligue a chavinha em Config → Geral.\n- Achar que ligar expõe seus preços. Sua contribuição à comunidade é sempre anônima e agregada.\n\n' +
      '🔗 SE LIGA COM\nÉ na mesma seção "Módulos" que ficam as chavinhas de Clientes e Tarefas. Depois de ligar o Assistente, ele passa a usar os seus materiais da Precificação para a comparação "Meus preços vs mercado".\n\n' +
      '💬 EXEMPLO SOFIA\nUma amiga contou para a Sofia sobre a pesquisa de preços, mas ela não achava a opção no menu. A Sofia abre Config → Geral, vê a seção Módulos e percebe que o "Assistente de Compras (IA)" estava com a chavinha cinza. Clica, fica laranja, salva — e o assistente aparece. Minutos depois, ela já estava conferindo se pagava caro no feltro.',
    faq: [
      {
        pergunta: 'Ao pesquisar aparece "Módulo não ativado". Como resolvo?',
        resposta:
          'Essa mensagem quer dizer que o Assistente de Compras está desligado para o seu ateliê. A solução é ligá-lo: vá em Config → Geral, encontre a seção "Módulos", ache a chavinha "Assistente de Compras (IA)" e clique nela para ficar laranja (ligada), depois salve. Feito isso, o menu do assistente aparece e as pesquisas passam a funcionar normalmente. Lembre que só quem tem perfil de administradora (a dona do ateliê) consegue ligar módulos — se você é uma ajudante, peça para a responsável ativar. E fique tranquila: ativar não expõe nada seu, sua contribuição para a base da comunidade é sempre anônima.',
      },
      {
        pergunta: 'Ligar o Assistente de Compras vai mostrar meus preços para outras pessoas?',
        resposta:
          'Não. Ligar o módulo apenas abre a ferramenta para você usar — pesquisar preços, comparar, seguir materiais. A sua participação na base da comunidade é sempre ANÔNIMA e AGREGADA: os preços dos seus materiais podem entrar na média coletiva, mas misturados aos de todas as outras artesãs, sem nunca mostrar que aquele valor específico foi seu. Ninguém vê o seu preço individual, assim como você nunca vê o preço individual de outra artesã — só médias do grupo. Então pode ligar com tranquilidade: você ganha o acesso à sabedoria coletiva sem abrir mão da sua privacidade.',
      },
    ],
  },
]
