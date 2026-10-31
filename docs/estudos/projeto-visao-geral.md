# Estudo: visão geral do projeto como dashboard

Estudo de referências e recomendação para transformar a aba "Visão geral" de um projeto (Projetos, RF-54 a RF-57 da SPEC-001) num pequeno dashboard, feito a partir do protótipo da TASK-01.

## Pergunta

O que a visão geral de um projeto pessoal deve mostrar para responder, num relance, "como está este projeto e o que vem agora?", sem virar um painel de gestão de equipe?

## O que o protótipo faz hoje

- **Ficha de dados:** a aba mostra descrição, cor, número de raias, número de cartões, visibilidade e datas, numa grade de rótulo e valor.
- **Nada sobre o andamento:** não dá para saber quanto já foi feito, o que vence em breve ou o que está parado sem abrir o Quadro e contar.
- **Repete o cabeçalho:** a descrição já aparece no subtítulo da página, e a cor do projeto aparece como um badge sem função.
- **Os cartões já têm dados para isso:** prazo, prioridade, checklist, etiquetas e tarefa ligada (ajuste do protótipo de 30/10).

## Referências

| Ferramenta | O que a visão geral mostra | O que serve para o Atria |
|---|---|---|
| Linear (Project overview) | Descrição, marcos com data-alvo e progresso de cada um, e "atualizações" com um indicador de saúde (no prazo, em risco, fora do prazo) e um texto. | O progresso por etapa e uma nota curta de "como está" escrita pela pessoa. O indicador de saúde é para equipes; num app pessoal, vira um status opcional. |
| Asana (aba Overview e aba Dashboard) | Overview com status do projeto (no prazo, em risco, em espera, concluído), marcos e recursos-chave; Dashboard separado com gráficos de tarefas concluídas e abertas, e burn-up. | Separar "resumo" de "gráficos". No Atria, o resumo é a visão geral e os gráficos ficam em Relatórios, que já existe. |
| Jira (Summary) | Contagens dos últimos 7 dias (concluídos, atualizados, criados), itens que vencem nos próximos 7 dias, distribuição por status, prioridade e responsável, e atividade recente. | A janela de 7 dias e a distribuição por raia. Responsável não se aplica: o projeto é de uma pessoa. |
| GitHub Projects (Insights) | Gráficos atuais (itens por campo) e históricos, como o burn-up de feito x restante. | Uma barra de distribuição por raia é suficiente. Gráfico histórico exige guardar histórico de movimentação, que o MVP não tem. |
| Basecamp (Hill Chart) | Cada lista é um ponto numa colina: subindo, ainda se descobrindo o que fazer; descendo, em execução. A posição é escolhida à mão, de propósito. | A ideia de que progresso não é só contagem: o checklist dos cartões mostra quanto de cada um já foi feito. A colina em si fica fora: pede um gesto manual que o Atria não tem. |
| Estudo do dashboard do Atria (`docs/estudos/dashboard.md`) | Calma: poucos itens por bloco, estado sem alarme, atraso como texto neutro, hierarquia por posição e tamanho. | As mesmas regras valem aqui: nada de vermelho para atraso e no máximo 5 itens por bloco. |

## Recomendação

### 1. Duas zonas, como o dashboard geral

Reaproveitar o layout do dashboard: uma zona principal (cerca de 2/3) e uma lateral (cerca de 1/3), cada uma com uma pilha de cartões. Abaixo de 960 px, uma coluna só.

### 2. Blocos

| Zona | Bloco | Conteúdo | Fonte dos dados |
|---|---|---|---|
| Principal | Andamento | Uma barra empilhada com a distribuição dos cartões por raia, na cor de cada raia, com a legenda "Aguardando 3 · Em progresso 2 · Pronto 4". Embaixo, "4 de 9 cartões prontos" em texto, sem percentual em destaque. | Cartões por `lane_id`. "Pronto" é a última raia. |
| Principal | Próximos prazos | Até 5 cartões com prazo nos próximos 14 dias, por data, com a raia como badge. Prazo passado aparece como "era para 28/10", em texto neutro. | `due_date` dos cartões que não estão na última raia. |
| Principal | Em andamento | Os cartões das raias do meio, com o progresso do checklist ("2/3") e a prioridade, no máximo 5. | Raias que não são a primeira nem a última. |
| Lateral | Sobre | A descrição (só aqui, tirando do subtítulo se for longa), visibilidade e datas de criação e atualização, em texto pequeno. | Campos do projeto. |
| Lateral | Prioridade alta | Contagem e lista curta dos cartões de prioridade alta ainda abertos. Some se não houver nenhum. | `priority = high` fora da última raia. |
| Lateral | Ligações | As tarefas ligadas aos cartões e as conexões do projeto, com link. | `task_id` dos cartões e a aba Conexões. |

### 3. Regras

- **"Pronto" é a última raia:** as raias são personalizáveis, então o protótipo trata a última como "feito". Isso precisa de decisão (ver abaixo).
- **Estado, não alarme:** prazo vencido em texto neutro, sem vermelho e sem contador de atrasos ([project/frontend-14], como no dashboard geral).
- **Vazio sem culpa:** um projeto sem cartões mostra "Nenhum cartão ainda. Comece pelo Quadro." com o botão "Adicionar cartão".
- **Gráficos ficam em Relatórios:** a visão geral não tem burn-up nem histórico; o relatório de Projetos (RF-61) já mostra cartões por raia.
- **Aba padrão:** com a visão geral virando dashboard e indo para a primeira posição das abas, ela passa a ser a aba aberta ao entrar no projeto. O Quadro continua a um clique.

## O que muda na SPEC-001

A SPEC-001 está `planned`, então a spec não muda. As mudanças entram pelas tarefas:

| Tarefa | Mudança | Como |
|---|---|---|
| TASK-01 (protótipo, `in_progress`) | Visão geral em duas zonas com os blocos acima, primeira aba e aba padrão. | Correção dentro do escopo do protótipo. |
| TASK-14 (Contexto projects) | Os cartões ganham prazo, prioridade, descrição, etiquetas, checklist e tarefa ligada, e a API devolve o resumo do projeto. | Skill `adjust-task`, junto com o ajuste dos cartões já feito no protótipo. |
| TASK-30 (Telas de Projetos) | Visão geral como dashboard, quadro com raias coloridas, formulário de cartão e aba Configurações. | Skill `adjust-task`. |

## Decisões em aberto

1. "Pronto" é a última raia, ou cada raia ganha uma marcação "esta raia conta como concluída"?
2. A visão geral passa a ser a aba aberta ao entrar no projeto?
3. Os campos novos dos cartões (prazo, prioridade, checklist, tarefa ligada) entram no MVP pelas TASK-14 e TASK-30, ou vão para uma spec seguinte?

## Fontes

- [Linear: Project overview](https://linear.app/docs/project-overview)
- [Linear: Project milestones](https://linear.app/changelog/project-milestones)
- [Linear: How we built project updates](https://linear.app/blog/how-we-built-project-updates)
- [Asana: Project progress and status updates](https://help.asana.com/s/article/project-progress-and-status-updates)
- [Asana: Dashboards](https://asana.com/resources/dashboards)
- [Jira: Get a summary of your project](https://support.atlassian.com/jira-work-management/docs/get-a-summary-of-your-project)
- [Atlassian Community: Introducing the summary view in Jira software projects](https://community.atlassian.com/t5/Jira-articles/Introducing-the-summary-view-in-Jira-software-projects/ba-p/2883939)
- [GitHub Docs: About insights for projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/viewing-insights-from-your-project/about-insights-for-projects)
- [Basecamp: Hill Charts](https://basecamp.com/hill-charts)
