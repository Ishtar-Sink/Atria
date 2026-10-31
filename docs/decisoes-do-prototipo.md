# Decisões do protótipo

Decisões de interface e de regra tomadas na revisão do protótipo da TASK-01 (`prototype/atria-prototype.html`), em 30/10/2026. O protótipo já mostra cada uma funcionando.

Use este documento durante a execução das tarefas da SPEC-001:

- **Antes de executar uma tarefa com tela ou regra citada aqui,** confira a coluna "Tarefas" da decisão. Se a tarefa diz outra coisa, a decisão vale como proposta: pare e pergunte ao usuário qual seguir, citando o ID da decisão (ex.: `PD-31`) e o trecho da tarefa.
- **O protótipo é a referência visual:** abra a tela correspondente e reproduza o comportamento, com os componentes da biblioteca (`packages/ui`).
- **Status:**
  - `aplicada`: está no protótipo, e a tarefa já foi ajustada ou não contradiz nada.
  - `contradiz`: a tarefa diz outra coisa e precisa de decisão na hora.
  - `nova`: a tarefa não trata do assunto, e o que entra é acréscimo.
  - `em aberto`: ainda falta decidir algo.

## Índice

| Área | Decisões |
|---|---|
| Identidade e componentes | PD-01 a PD-17 |
| Layout e navegação | PD-18 a PD-24 |
| Dashboard | PD-25 a PD-31 |
| Tarefas | PD-32 a PD-34 |
| Acervo | PD-35 a PD-40 |
| Projetos | PD-41 a PD-47 |
| Financeiro | PD-48 a PD-58 |

## Identidade e componentes

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-01 | Botões, grupos de botões e seletores usam o raio dos campos (`radius.md`, 12 px). Pill só em badges, chips, barras de progresso e elementos circulares. Vale para todo o Ishtar Sink. Registrada como DEC-001 na memória e no `docs/identidade-ecossistema.md` da organização (sem commit). | TASK-03 | nova |
| PD-02 | Variação `muted` de botão: só texto e ícone, sem fundo, borda ou sombra. Ao passar o mouse, muda só a cor. Dentro de uma raia, usa a cor da raia mais transparente. | TASK-03 | nova |
| PD-03 | Variação `success` de botão: fundo verde claro e ícone verde. No estado ativo (concluída), fica verde cheio e com o ícone claro. | TASK-03 | nova |
| PD-04 | Concluir tarefa nas listas e no dashboard é um botão só com o ícone de check (variação `success`). O nome acessível diz a ação ("Concluir hoje: Alongamento da manhã"). Na página de detalhe, continua um botão com texto. | TASK-03, TASK-21, TASK-24 | nova |
| PD-05 | Links não ganham sublinhado ao passar o mouse: o link comum escurece um pouco e o título de card não muda. | TASK-03 | nova |
| PD-06 | O hover das linhas de lista é leve (40% da cor de hover misturada à superfície), para os badges roxos não se misturarem ao fundo. | TASK-03 | nova |
| PD-07 | Card de lista e de grade inteiro clicável (link esticado no título). Botões e campos dentro do card ficam por cima e mantêm a própria ação. O foco pelo teclado contorna o card inteiro. | TASK-03 | nova |
| PD-08 | Seletor de visualização (lista, grade, estante) só com ícones, com o nome em `title` e em texto para leitor de tela. | TASK-03 | nova |
| PD-09 | Criar um item num módulo com mais de um tipo (Acervo, Financeiro) abre um diálogo centralizado com um cartão por tipo, cada um com ícone e uma linha de descrição. O formulário não tem mais o campo "Tipo". O tipo da aba aberta já vem focado. | TASK-22, TASK-28 | contradiz: a tarefa pode prever o seletor de tipo no formulário |
| PD-10 | Preferência global "Opções do botão de criar: em grade / em lista", em Configurações › Suas preferências. Vale para todo diálogo de escolha de tipo. | TASK-33 | nova |
| PD-11 | Etiquetas como pills: Enter ou vírgula transforma o texto numa pill embaixo do campo, removível pelo "×". Backspace com o campo vazio remove a última. Repetidas não entram, e o texto pendente entra ao sair do campo ou ao salvar. | TASK-03 e todas as telas com etiquetas | contradiz: as tarefas falam em "separadas por vírgula" |
| PD-12 | Seletor de cor: roda de cores (matiz e saturação), controle de luminosidade e campos HEX, RGB e HSL sincronizados, com prévia. Operável pelo teclado: setas laterais mudam a matiz, setas verticais mudam a saturação e Shift aumenta o passo. A cor gravada é um HEX livre, não só um token do tema. | TASK-03, TASK-14, TASK-30 | contradiz: as raias guardam um token de cor |
| PD-13 | Filtros com poucas opções usam chips (botões alternáveis) em vez de dropdown. Ex.: "Todas · Recorrentes · Pontuais". Dropdown só para listas que crescem, como as contas. | TASK-03, TASK-22 | nova |
| PD-14 | Ações do cabeçalho alinhadas à base do bloco do título. No detalhe: "Editar" com ícone de lápis e um botão "⋯ Mais ações" com "Excluir" em vermelho. Ações específicas ("Concluir hoje", "Ver fatura", "Ler") ficam ao lado de "Editar". | TASK-05 e todas as telas de detalhe | contradiz: as tarefas podem prever "Excluir" como botão visível |
| PD-15 | Dados sensíveis do dashboard (valores do Dinheiro, texto do Diário) têm um ícone de olho que esconde o conteúdo trocando por "•••". A escolha fica gravada até ser trocada de novo. | TASK-21, TASK-33 | nova |
| PD-16 | Mensagens de estado calmas, em itálico e texto secundário, sem fundo colorido. Ex.: "Tudo feito por hoje. Aproveite o resto do dia." | TASK-21 | nova |
| PD-17 | Ícones de ação (olho, setas, check) usam a classe `btn-icon` com área mínima de 36 px. | TASK-03 | nova |

## Layout e navegação

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-18 | Conteúdo com largura máxima de 1360 px, centralizado na área à direita da barra lateral. | TASK-05 | nova |
| PD-19 | Telas de formulário: cabeçalho e formulário numa coluna centralizada na largura do formulário (640 px, ou 880 px com capa ou duas colunas). | TASK-05 e todas as telas de formulário | nova |
| PD-20 | Cabeçalho da página fixo abaixo da barra do topo. Ao rolar mais de 48 px, compacta (título de 36 para 24 px, sem subtítulo) e ganha um fundo de desfoque, sem cor escura e sem linha, que ocupa a largura do conteúdo (da sidebar à borda) e some em degradê na parte de baixo. Volta ao normal perto do topo, e em página curta não compacta. O desfoque aparece sempre que o cabeçalho está preso, mesmo sem compactar, para o conteúdo que passa por baixo não ficar ilegível. Sem animação com "reduzir movimento". | TASK-05 | nova |
| PD-21 | "Voltar" acima do título em detalhes e formulários. Leva à última listagem ou ao dashboard de onde a pessoa veio (com aba e filtros). Sem histórico, vai para a listagem do tipo. Na edição, volta ao detalhe. | TASK-05 | nova |
| PD-22 | O título recebe o foco a cada troca de tela, para o leitor de tela anunciar, mas sem contorno visível. | TASK-05 | nova |
| PD-23 | Rodapé da barra lateral com uma linha cinza em cima, foto (ou iniciais sobre o gradiente do id) e nome da pessoa, com um chevron. O clique abre um menu à direita com Configurações, Alternar tema e Sair (em vermelho). "Configurações" sai da navegação principal. | TASK-05, TASK-33 | contradiz: a navegação prevista inclui Configurações |
| PD-24 | Visualização (lista ou grade) lembrada por módulo e, no Acervo, por aba. | TASK-05, TASK-28 | nova |

## Dashboard

Referência: `docs/estudos/dashboard.md`.

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-25 | Duas zonas, cada uma uma pilha de cartões: principal (cerca de 2/3) e lateral (cerca de 1/3). Abaixo de 960 px, uma coluna. O último cartão de cada zona cresce até a altura da outra, e as colunas terminam juntas. | TASK-21 | contradiz: a tarefa prevê a grade de blocos de peso igual |
| PD-26 | Saudação no topo ("Boa tarde, Marina", data longa) com "Como foi o seu dia?" e o botão "Escrever no diário". | TASK-21 | nova |
| PD-27 | Zona principal: "Tarefas de hoje", "Lembretes de hoje" (agrupados em Manhã, Tarde e Noite) e "Próximos dias" (próximos 7 dias, por data). Tarefas e lembretes mostram no máximo 3 itens. Zona lateral: Diário, Dinheiro, Leituras e Metas. | TASK-21 | contradiz: blocos e limites diferentes da tarefa |
| PD-28 | "Tarefas de hoje" inclui as pontuais vencidas e não concluídas. A tarefa some do bloco ao ser concluída, inclusive a ocorrência de hoje de uma diária. Com tudo feito, aparece "Tudo feito por hoje. Aproveite o resto do dia.". O link mostra o total do dia: "Ver todas (2 tarefas hoje)". | TASK-21 | nova |
| PD-29 | Dinheiro: saldo total em tamanho normal, "Nada mais previsto para este mês" ou o previsto até o fim do mês, a "Previsão de novembro" (entradas, contas, sobra e até 5 contas com data e valor) e o saldo por conta recolhido. | TASK-21 | contradiz: a tarefa prevê o saldo em destaque e as próximas movimentações |
| PD-30 | Os blocos não têm botão "Ocultar". A escolha dos blocos visíveis fica em Configurações › Dashboard. | TASK-21, TASK-33 | contradiz: a tarefa prevê o menu "Blocos" no próprio dashboard |
| PD-31 | Bloco novo "Metas": até 3 metas ativas com progresso. | TASK-21 | nova (não está na spec) |

## Tarefas

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-32 | Tarefa recorrente não guarda histórico: só existem ocorrências de hoje em diante, e a conclusão de data passada é recusada. Só a tarefa pontual vencida continua guardada. | TASK-09, TASK-17, TASK-24 | aplicada (tarefas ajustadas e aprovadas em 30/10) |
| PD-33 | A ocorrência de hoje de uma tarefa diária é concluída pelo dashboard, pela listagem e pelo detalhe ("Concluir hoje" / "Reabrir hoje"). O status mostra "Aberta hoje" ou "Feita hoje". | TASK-21, TASK-24 | nova |
| PD-34 | No dashboard, tarefas e lembretes ficam em blocos separados, para não confundir o que se conclui (tarefa) com o que só avisa (lembrete). | TASK-21 | nova |

## Acervo

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-35 | Uma aba por tipo: Livros, Artigos e Vídeos. Dentro da aba, o filtro é o status (Quero ler, Lendo, Lido etc.). | TASK-28 | contradiz: a tarefa prevê uma listagem única com filtro de tipo |
| PD-36 | Capa por upload: área para clicar ou arrastar uma imagem (até 5 MB, só imagem), com "Trocar" e "Remover". Formato 2:3 no livro e 16:9 no artigo e no vídeo. | TASK-13, TASK-28 | contradiz: o livro e o artigo não têm capa na spec (só a miniatura do vídeo, RF-53) |
| PD-37 | Formulário e visão geral com a mesma estrutura: capa à esquerda, campos principais à direita (título, autoria, páginas, status, canal, endereço). No formulário, etiquetas, observações e visibilidade ficam embaixo; na visão geral, ficam no cartão "Registro" da lateral (PD-59). | TASK-28 | nova |
| PD-38 | Estante de livros com a capa em retrato (2:3), em colunas de pelo menos 170 px. Artigos e vídeos com a faixa deitada. Sem capa, gradiente determinístico do id. | TASK-28 | nova |
| PD-39 | No cartão da estante, a barra de progresso e o status ficam no pé, alinhados entre cartões de alturas diferentes. | TASK-28 | nova |
| PD-40 | No histórico de leitura, "Registrar sessão" fica em cima e a lista embaixo. | TASK-28 | nova |

## Projetos

Referência: `docs/estudos/projeto-visao-geral.md`.

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-41 | Abas do projeto: Visão geral (primeira e padrão), Quadro, Conexões e Configurações (última). | TASK-30 | contradiz: a tarefa abre no Quadro |
| PD-42 | Visão geral como dashboard em duas zonas. Principal: Andamento (barra por raia, "4 de 9 cartões prontos"), Próximos prazos (14 dias, vencido em texto neutro) e Em andamento (raias do meio, com checklist e prioridade). Lateral: Sobre, Prioridade alta (só se houver) e Ligações. | TASK-14, TASK-30 | nova |
| PD-43 | "Pronto" é a última raia. | TASK-14, TASK-30 | em aberto: ou cada raia ganha a marcação "conta como concluída" |
| PD-44 | Raia com fundo e borda tingidos na cor dela (cerca de 7% e 22%), sem a faixa no topo. Cabeçalho só com nome e contagem. | TASK-30 | nova |
| PD-45 | "+ Adicionar cartão" é um botão `muted` no pé da raia, na cor dela. Abre o formulário do cartão com a raia escolhida, no lugar do campo com "Adicionar" dentro da raia. | TASK-30 | contradiz: a tarefa prevê o cartão criado só com o título, na raia |
| PD-46 | Cartão com título, descrição (2 linhas), prioridade, etiquetas, prazo, progresso do checklist e tarefa ligada (RN-20). Formulário próprio (`/projects/<id>/cards/new` e `/cards/<id>`), com "Excluir cartão" no menu "Mais ações". Mover entre raias arrastando ou pelo seletor no pé do cartão. | TASK-14, TASK-30 | contradiz: o cartão da spec só tem título; os campos novos precisam de decisão sobre o MVP |
| PD-47 | Configurações › Raias: criar, renomear, trocar a cor (PD-12) e excluir. Para reordenar, arrasta-se pelo puxador (faixa de cor com seis pontinhos): a linha flutua, e as outras abrem espaço enquanto ela passa. Pelo teclado, setas no puxador. O "Gerenciar raia" sai do quadro. | TASK-30 | contradiz: a tarefa prevê o gerenciamento dentro de cada raia |

## Financeiro

| ID | Decisão | Tarefas | Status |
|---|---|---|---|
| PD-48 | Abas: Painel (padrão), Entradas, Saídas, Transferências, Faturas, Contas e Configurações. "Movimentações" vira duas abas, Entradas e Saídas. | TASK-22 | contradiz: a tarefa prevê outras abas e outra ordem |
| PD-49 | Categorias ficam em Configurações do Financeiro, agrupadas em Entradas e Saídas, e cada uma abre na própria página. | TASK-22 | contradiz: a tarefa prevê uma aba Categorias |
| PD-50 | "Novo registro" abre o diálogo de tipo (PD-09) com Entrada, Saída, Transferência, Categoria e Conta. Entrada e Saída abrem o formulário com o tipo marcado e uma categoria do mesmo tipo. | TASK-22 | nova |
| PD-51 | Recorrência: existe só a ocorrência do mês. Ao liquidar, fica uma cópia liquidada, sem recorrência e ligada à original (histórico), e a recorrente vai para o mês seguinte como prevista. A previsão de contas do mês seguinte sai dela. | TASK-07, TASK-22, TASK-21 | contradiz: a TASK-07 materializa as ocorrências até uma data e regenera as futuras (RN-08, CT-21) |
| PD-52 | Filtro de repetição em chips: "Todas · Recorrentes · Pontuais", nas abas Entradas e Saídas. | TASK-22 | nova |
| PD-53 | Valores sem "+" e "−" nas listas do Financeiro: a aba já diz se é entrada ou saída. | TASK-22 | nova |
| PD-54 | Na lista, o valor fica em cima e os selos embaixo dele: status, "Recorrente" e a diferença da liquidação ("Economizou R$ 33,50", "Pagou R$ 25,00 a mais", "Recebeu R$ 80,00 a menos"). Perda em âmbar, nunca em vermelho. | TASK-22 | nova |
| PD-55 | Período global do Financeiro, no cabeçalho, ao lado de "Novo registro", como o seletor de tempo do Datadog. Presets: Este mês (padrão), Mês passado, Próximos 30 dias, Últimos 30 dias, Este ano e Qualquer período, mais um intervalo personalizado (De e Até). Vale para Painel, Entradas, Saídas e Transferências, e continua ao trocar de aba. Some em Contas, Faturas e Configurações. A data usada é a da liquidação, quando liquidada, e a prevista nos outros casos. | TASK-22 | contradiz: a tarefa prevê o período como filtro da listagem de movimentações |
| PD-56 | O filtro "Só previstas" saiu do período. | TASK-22 | em aberto: voltar como chip de status ("Todas · Previstas · Liquidadas")? |
| PD-58 | Painel do Financeiro em duas zonas (`docs/estudos/financeiro-painel.md`). Principal: Fechamento do período (Entradas, Saídas e Sobra prevista, cada um com o realizado e o previsto, e a comparação com o período anterior de mesmo tamanho), "Para onde foi" (saídas por categoria, na cor da categoria, até 6 mais "Outras") e Previsto x realizado. Lateral: Saldo (atual, previsto no fim do período e por conta), Cartões (fatura aberta, vencimento e limite usado), Próximas contas (30 dias) e Economias e perdas. Segue o período global, menos Saldo, Cartões e Próximas contas. | TASK-22, TASK-07 | contradiz: a tarefa prevê os três gráficos de peso igual; a API pode não ter o resumo por categoria, a comparação e o saldo previsto |
| PD-57 | O intervalo personalizado e os campos de data e hora (lembretes e diário, PD-62) usam um calendário próprio, em português e nas cores do tema, no lugar do seletor de data nativo do navegador, que muda em cada sistema. O primeiro clique marca o início e o segundo o fim, e os dias entre eles ficam destacados. As setas movem o foco entre os dias, com o resumo "01/10/2026 – 30/10/2026" embaixo. | TASK-03, TASK-22 e todas as telas com data | nova: decidido em 30/10 usar o mesmo calendário em todos os campos de data (modo de um dia: botão com ícone e a data, ou "Escolher data"; popover com o calendário e os botões "Hoje" e "Limpar"). Campos de data e hora (lembretes, diário) continuam nativos por enquanto. |
| PD-59 | Visão geral dos detalhes em cartões, no mesmo padrão dos dashboards: zona principal com um cartão de dados (título do tipo, barra de progresso quando houver e os campos) e cartões de texto longo ("Descrição", "Anotações", "Texto"); lateral com o cartão "Registro" (etiquetas, recorrência ou data quando couber, visibilidade, criado e atualizado em). No Acervo, a capa fica dentro do cartão de dados, à esquerda dos campos. No Diário, as emoções ganham um cartão próprio na lateral. A liquidação de uma movimentação vira um cartão abaixo dos dados. | TASK-22, TASK-23, TASK-24, TASK-25, TASK-26, TASK-27, TASK-28 | nova |
| PD-60 | A sessão de leitura registra só a quantidade de páginas lidas e a data, sem "da página" e "até a página". As sessões se somam no progresso do livro, e o histórico lista "50 páginas · 26/10/2026". Ao fechar o modo leitura, a oferta de sessão vem preenchida com as páginas avançadas (por exemplo, 22, de 40 a 62) e pode ser corrigida. | TASK-13, TASK-28, TASK-29 | contradiz em parte: o modelo da TASK-13 já tem `pages_read` com `from_page` e `to_page` opcionais, mas a TASK-29 descreve a oferta como "sessão de 40 a 62". Decidir na hora se o leitor ainda envia as páginas de início e fim, sem mostrá-las. |
| PD-61 | Relatórios como catálogo: a página Relatórios lista os relatórios agrupados por módulo (nove no protótipo: Entradas e saídas por mês, Gastos por categoria, Economias e perdas, Páginas lidas, Acervo por status, Emoções no período, Progresso das metas, Tarefas concluídas e abertas, Cartões por raia). Cada um abre uma página com o cabeçalho do relatório, um cartão "Filtros" (período sempre pelo mesmo seletor de intervalo do Financeiro, com os presets e o calendário, mais os filtros do relatório, como conta, categoria, livro, emoção, meta ou projeto) e o botão "Gerar relatório". O resultado só aparece depois de gerar, com "Exportar PDF" no cabeçalho. Os relatórios também são emitidos pelos módulos (botão "Relatórios" no cabeçalho, com o menu dos relatórios do módulo) e pelas entidades (menu "Mais ações" da conta, categoria, livro, meta e projeto, já filtrado pela entidade). O item "Relatórios" da sidebar continua. | TASK-17, TASK-34, TASK-22, TASK-23, TASK-28, TASK-30 | contradiz em parte: a TASK-34 prevê seis relatórios, um por módulo, filtrados só pelo período, e a TASK-17 gera cada relatório só por período. Decidir na hora se os filtros por entidade e os relatórios a mais entram no MVP. |
| PD-62 | Forms com a identidade do Atria e componentes próprios. Todos os forms têm a mesma largura (880 px), numa grade de duas colunas: título, nome, descrição, textos longos, etiquetas, emoções e visibilidade ocupam a linha inteira; os demais campos ficam lado a lado; abaixo de 640 px, uma coluna. As ações ficam à direita, embaixo de uma linha: "Cancelar" (botão sem fundo) à esquerda e "Salvar" (primário) à direita. Os selects viram um seletor próprio (botão com a lista do Atria, setas, Enter, Esc, Home/End e busca por letra), em todo o app. Escolhas obrigatórias com até 3 opções viram um grupo segmentado (Tipo: Saída/Entrada, Status do livro, Repetição) e a visibilidade também (Pessoal/Compartilhada). Data e hora: data pelo calendário próprio e hora em 24 h num campo que aceita "930", "9:30" ou "09:30". Emoções do diário: chips em grade; marcar libera a intensidade de 1 a 5 em pontos. Campos numéricos sem as setas do navegador. | TASK-05 e todas as telas com formulário (TASK-21 a TASK-34) | nova: a TASK-05 define os componentes de base; o seletor próprio, o grupo segmentado, o campo de hora e o seletor de emoções precisam entrar nela ou na tarefa de cada tela. |

## Decisões em aberto

1. **PD-56:** o filtro de previstas volta como chips de status?
2. **PD-31, "deixar para amanhã" e "esconder valores" do estudo do dashboard:** "esconder valores" virou o olho da PD-15; "deixar para amanhã" continua fora.

## Decisões resolvidas em 30/10 (DEC-002)

- **PD-51:** o servidor troca o modelo da TASK-07 pelo da PD-51 (só a ocorrência do mês; ao liquidar, fica uma cópia liquidada ligada à recorrente, que passa para o mês seguinte).
- **PD-43:** cada raia tem a marcação "conta como concluída".
- **PD-46:** os campos novos do cartão entram no MVP (TASK-14 e TASK-30).
- **PD-36:** a capa por upload de livro e artigo entra no MVP (TASK-13).
- **PD-58:** a comparação com o período anterior entra no MVP, e "Para onde foi" leva à aba Saídas filtrada pela categoria.
- **PD-61:** os nove relatórios e os filtros por entidade entram no MVP (TASK-17 e TASK-34).
