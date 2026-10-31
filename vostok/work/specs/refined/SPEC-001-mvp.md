---
id: SPEC-001
title: "MVP"
status: planned
author: "Victor Batalha"
created_at: 2026-10-27T22:14:28Z
updated_at: 2026-10-30T14:35:13Z
tags: []
type: feature
source: "draft/SPEC-001-mvp.md"
refined_at: 2026-10-30T12:58:48Z
adjustments: 2
adjusted_at: 2026-10-30T13:38:05Z
content_hash: f67ea5ac15805db2fe74bd3bdf41a28802f6cce45606856ad1ee7babbdf29141
approved_at: 2026-10-30T13:41:08Z
approved_hash: f67ea5ac15805db2fe74bd3bdf41a28802f6cce45606856ad1ee7babbdf29141
---

# MVP - Especificação Refinada

Entrega o MVP completo do Atria, o hub pessoal do ecossistema Ishtar Sink. São todos os módulos (Dashboard, Financeiro, Metas, Tarefas, Lembretes, Notas, Diário, Acervo, Projetos, Configurações e Relatórios), ligados entre si nos dois sentidos, com busca global, paleta de comandos, autenticação por convite e autohospedagem. A primeira tarefa é um protótipo HTML autocontido que valida o layout e as interações, e todas as outras tarefas dependem dele.

## Objetivo

As pessoas precisam se organizar sem a pressão da maximização da produtividade: finanças, tarefas, leituras, projetos e sentimentos num lugar só, ligados entre si e pensados para trazer calma. O resultado é uma aplicação web autohospedável, segura para dados pessoais e compartilhável com amigos. A interface é validada antes num protótipo HTML com dados em memória.

## Escopo

### Dentro do escopo

- Protótipo HTML autocontido com todos os módulos, a paleta de comandos, filtros, visualizações, cadastros e edições, com dados em memória (primeira tarefa).
- Fundação: monorepo (`apps/web`, `apps/server`, `packages/theme`, `packages/ui`), tema do ecossistema, layout com sidebar e topbar.
- Usuários: assistente de primeira execução, cadastro por convite de uso único, login, recuperação de senha, papéis `admin`, `elevated` e `user`, 2FA TOTP.
- Ligações bidirecionais entre entidades ("Conecta com"), com aba "Conexões" em cada entidade.
- Busca global com escolha de contextos e paleta de comandos (Ctrl/Cmd + K) com busca e criação rápida.
- Dashboard geral.
- Financeiro: contas, conta padrão, cartão de crédito com fatura e parcelas, entradas, saídas, transferências, categorias, recorrências, liquidação, economia e perda, dashboard próprio.
- Metas com marcos opcionais.
- Tarefas, inclusive recorrentes.
- Lembretes recorrentes com notificação no navegador e Web Push opcional.
- Notas.
- Diário com emoções.
- Acervo: livros (progresso por registro de páginas, notas em histórico, PDF opcional), artigos (PDF opcional) e vídeos.
- Modo leitura de PDF de livros e artigos: leitor em tela própria, retomada da última página, registro da sessão ao fechar, notas a partir de trechos e destaques com cor.
- Projetos em lista e grade, com Kanban de raias customizáveis.
- Configurações do usuário e da instância.
- Relatórios em HTML interativo e PDF para Financeiro, Leitura, Diário, Metas, Tarefas e Projetos.
- Visibilidade pessoal ou compartilhada em toda entidade, como marcação.
- Exportação dos dados do usuário em formato aberto.
- Autohospedagem: imagem Docker, `docker-compose.yml` de referência, configuração por variáveis `ATRIA_`.

### Fora do escopo

- Recursos de IA (citados no rascunho como futuros).
- Colaboração entre usuários: a marcação "compartilhada" não dá acesso a ninguém no MVP.
- Várias moedas por usuário.
- Busca automática de metadados de livros por ISBN.
- Modo leitura de EPUB e de outros formatos além de PDF.
- PWA instalável e app nativo.
- Extração de `packages/ui` e `packages/theme` para um pacote da organização.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | O protótipo HTML deve ser um único arquivo autocontido, que abre no navegador sem servidor, com todos os módulos navegáveis e dados em memória. |
| RF-02 | O protótipo HTML deve permitir cadastrar, editar, filtrar, buscar e trocar o modo de visualização das entidades de todos os módulos. |
| RF-03 | O sistema deve abrir um assistente de primeira execução numa instância sem usuários, que cria a conta admin sem convite. |
| RF-04 | O sistema deve permitir o cadastro só com um convite de uso único, válido enquanto o admin mantiver o convite obrigatório. |
| RF-05 | O sistema deve permitir que o admin desligue a exigência de convite para cadastro. |
| RF-06 | O sistema deve permitir login com e-mail e senha, e com o código TOTP quando a pessoa tiver ativado o 2FA. |
| RF-07 | O sistema deve permitir que cada usuário ative o 2FA por TOTP, e exigir a ativação para o admin. |
| RF-08 | O sistema deve enviar o link de redefinição de senha por e-mail quando houver SMTP configurado. |
| RF-09 | O sistema deve permitir que o admin gere um link de redefinição de senha de uso único para um usuário. |
| RF-10 | O sistema deve permitir que o admin conceda e retire o papel `elevated`. |
| RF-11 | O papel `elevated` deve permitir gerar convites de cadastro. |
| RF-12 | O papel `elevated` deve permitir ver a lista de usuários e desativar ou reativar contas com o papel `user`. |
| RF-13 | O papel `elevated` deve permitir ver o estado da instância: versão, espaço usado e saúde. |
| RF-14 | O sistema deve mostrar uma sidebar com a navegação dos módulos e uma topbar com o gatilho da busca, os breadcrumbs e as informações da tela. |
| RF-15 | O sistema deve abrir a paleta de comandos com Ctrl + K (Windows e Linux) ou Cmd + K (macOS) e com um clique no campo de busca da topbar, borrando o fundo. |
| RF-16 | A paleta de comandos deve buscar em todas as entidades ou nos contextos escolhidos pela pessoa. |
| RF-17 | A paleta de comandos deve criar uma entidade só com os campos mínimos e oferecer "abrir para completar", que leva à tela própria da entidade. |
| RF-18 | O sistema deve permitir ligar qualquer entidade a outra e mostrar a ligação nos dois lados. |
| RF-19 | Toda entidade deve ter uma aba "Conexões" com filtro, busca, agrupamento e categorização das ligações. |
| RF-20 | Toda tela de listagem deve ter filtros, busca e modos de visualização. |
| RF-21 | Toda entidade deve poder ser marcada como pessoal ou compartilhada. |
| RF-22 | O Dashboard deve mostrar o saldo total, as próximas movimentações, as tarefas e lembretes do dia, as leituras em andamento e a última entrada do diário. |
| RF-23 | O Dashboard deve permitir ocultar e mostrar cada bloco. |
| RF-24 | O Financeiro deve permitir cadastrar, renomear e excluir contas. |
| RF-25 | O sistema deve criar a conta padrão "Conta principal" para cada usuário. |
| RF-26 | O Financeiro deve permitir cadastrar um cartão de crédito como conta, com limite, dia de fechamento e dia de vencimento. |
| RF-27 | O Financeiro deve permitir registrar entradas e saídas com valor previsto, data prevista, conta e categoria. |
| RF-28 | O Financeiro deve permitir registrar uma compra parcelada no cartão, gerando uma movimentação por parcela na fatura correspondente. |
| RF-29 | O Financeiro deve permitir registrar transferências entre contas. |
| RF-30 | O Financeiro deve permitir cadastrar, renomear e excluir categorias de movimentação. |
| RF-31 | O Financeiro deve permitir criar movimentações recorrentes. |
| RF-32 | O Financeiro deve permitir liquidar uma movimentação com o valor efetivo e a data efetiva. |
| RF-33 | O Financeiro deve calcular e mostrar a economia, o ganho ou a perda de cada movimentação liquidada, na conta e nos relatórios. |
| RF-34 | O Financeiro deve mostrar a fatura do cartão por período e permitir pagá-la. |
| RF-35 | O Financeiro deve ter um dashboard próprio, com saldo por conta, previsto x realizado do mês, economias e perdas. |
| RF-36 | Metas deve permitir cadastrar uma meta com título, descrição, prazo opcional e status. |
| RF-37 | Metas deve permitir cadastrar marcos e calcular o progresso pela porcentagem de marcos concluídos. |
| RF-38 | Tarefas deve permitir cadastrar, concluir e reabrir tarefas pontuais. |
| RF-39 | Tarefas deve permitir criar tarefas recorrentes, com cada ocorrência concluída separadamente. |
| RF-40 | Lembretes deve permitir cadastrar lembretes pontuais e recorrentes com data e hora. |
| RF-41 | O sistema deve notificar os lembretes no navegador com o Atria aberto em alguma aba. |
| RF-42 | O sistema deve enviar os lembretes por Web Push quando o admin tiver ligado o recurso e a pessoa tiver dado permissão. |
| RF-43 | Notas deve permitir cadastrar, editar e excluir notas independentes. |
| RF-44 | O Diário deve permitir registrar várias entradas por dia, cada uma com data, hora e texto. |
| RF-45 | O Diário deve permitir marcar uma ou mais emoções em cada entrada, com intensidade opcional. |
| RF-46 | O Diário deve permitir editar a lista de emoções do usuário. |
| RF-47 | O Acervo deve permitir cadastrar livros com título, capa, autor, editora, número de páginas e tags. |
| RF-48 | O Acervo deve permitir registrar páginas lidas por sessão, com observação, e editar ou excluir cada registro. |
| RF-49 | O Acervo deve mostrar a barra de progresso do livro na estante e na tela do livro. |
| RF-50 | O Acervo deve mostrar o histórico de leitura e o histórico de notas do livro em abas separadas. |
| RF-51 | O Acervo deve permitir anexar o PDF do livro, de forma opcional. |
| RF-52 | O Acervo deve permitir cadastrar artigos com título, URL, autor, fonte, tags, status de leitura e notas em histórico. |
| RF-53 | O Acervo deve permitir cadastrar vídeos com URL, miniatura e notas em histórico, mostrando a miniatura na vitrine. |
| RF-54 | Projetos deve listar os projetos em lista e em grade. |
| RF-55 | Projetos deve abrir cada projeto num Kanban com as raias padrão Aguardando, Em progresso e Pronto. |
| RF-56 | Projetos deve permitir criar, renomear, reordenar, colorir e excluir raias. |
| RF-57 | Projetos deve permitir criar cartões próprios do projeto e movê-los entre as raias. |
| RF-58 | Configurações deve permitir que o usuário ajuste tema, idioma, fuso horário, moeda e o atalho da paleta. |
| RF-59 | Configurações deve permitir que a pessoa escolha os contextos padrão da busca. |
| RF-60 | Configurações deve permitir que o admin ajuste a instância: convite obrigatório, papéis, Web Push e SMTP. |
| RF-61 | Relatórios deve gerar os relatórios de Financeiro, Leitura, Diário, Metas, Tarefas e Projetos em HTML interativo. |
| RF-62 | Relatórios deve exportar cada relatório em PDF com a identidade visual do ecossistema. |
| RF-63 | O sistema deve exportar todos os dados do usuário em JSON e CSV. |
| RF-64 | O Acervo deve permitir anexar o PDF do artigo, de forma opcional. |
| RF-65 | O modo leitura deve abrir o PDF do livro ou do artigo numa tela própria, sem sidebar nem topbar, com zoom, navegação por página e tema claro ou escuro. |
| RF-66 | O modo leitura deve retomar a leitura na última página lida do livro ou do artigo. |
| RF-67 | O modo leitura deve oferecer, ao fechar o PDF de um livro, o registro da sessão de leitura com o intervalo de páginas já preenchido. |
| RF-68 | O modo leitura deve criar uma nota no histórico de notas do livro ou do artigo a partir de um trecho selecionado, com a página citada e um comentário opcional. |
| RF-69 | O modo leitura deve permitir destacar trechos do PDF com cor e listar os destaques numa aba "Destaques" do livro ou do artigo. |
| RF-70 | O modo leitura deve ter um botão para baixar o PDF. |

## Requisitos não funcionais

| ID | Requisito | Como verificar |
|---|---|---|
| RNF-01 | Segurança: senhas em Argon2id, sessão em cookie `HttpOnly`, `Secure` e `SameSite`, CSRF em mutações e cabeçalhos conforme [project/security-*]. | Testes de integração dos endpoints de autenticação e inspeção dos cabeçalhos da resposta. |
| RNF-02 | Isolamento: nenhum usuário lê nem altera dados de outro, nem o admin. | Testes de autorização por endpoint, com resposta 404 (TST-03), e Row Level Security ativa. |
| RNF-03 | Privacidade: diário e notas criptografados em repouso, com a chave fora do banco. | Teste que lê a tabela direto no PostgreSQL e não encontra o texto em claro. |
| RNF-04 | Desempenho: a paleta mostra os resultados em até 300 ms para um usuário com 10 mil entidades. | Teste de carga com dados gerados, medindo o tempo da busca. |
| RNF-05 | Qualidade da interface: Lighthouse com pelo menos 90 em desempenho, acessibilidade e boas práticas nas telas principais. | Lighthouse CI na pipeline. |
| RNF-06 | Acessibilidade: WCAG AA, tudo navegável por teclado, sem violações no axe. | axe nos testes de componente e ponta a ponta. |
| RNF-07 | Autohospedagem: funciona sem internet, com só o app e o PostgreSQL, atrás de proxy reverso. | Subir o `docker-compose.yml` numa rede sem saída para a internet e rodar os testes ponta a ponta. |
| RNF-08 | Responsividade: funcional a partir de 360 px de largura. | Testes ponta a ponta em 360 px, 480 px, 720 px e desktop. |
| RNF-09 | Interface otimista: as mutações aparecem na hora e são desfeitas, com aviso, se o servidor recusar. | Teste de componente simulando a recusa do servidor. |
| RNF-10 | Tema: claro como padrão e escuro como alternativa, com os tokens vigentes do ecossistema. | Teste visual nos dois temas e conferência do contraste. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | O saldo de uma conta só muda quando uma movimentação é liquidada. |
| RN-02 | Numa saída liquidada, pagar menos que o previsto é economia, e pagar mais é perda. |
| RN-03 | Numa entrada liquidada, receber mais que o previsto é ganho, e receber menos é perda. |
| RN-04 | A conta padrão de cada usuário pode ser renomeada e nunca pode ser excluída. |
| RN-05 | Uma transferência não conta como entrada nem como saída nos totais e relatórios. |
| RN-06 | Pagar a fatura do cartão é uma transferência da conta de origem para o cartão, que liquida as movimentações daquela fatura. |
| RN-07 | Uma compra no cartão entra na fatura do período em que foi feita, conforme o dia de fechamento. |
| RN-08 | Mudar a regra de uma recorrência afeta só as ocorrências futuras não liquidadas e não concluídas. |
| RN-09 | Cada ocorrência de uma recorrência é liquidada ou concluída separadamente. |
| RN-10 | Uma ligação entre duas entidades aparece nos dois lados, e removê-la de um lado remove dos dois. |
| RN-11 | Um convite só pode ser usado uma vez e deixa de valer depois do prazo de expiração. |
| RN-12 | O papel `elevated` nunca concede papéis nem altera as configurações da instância. |
| RN-13 | O admin nunca vê o conteúdo de outros usuários, só a conta e os papéis deles. |
| RN-14 | O progresso de um livro é a soma das páginas registradas sobre o número total de páginas, limitado a 100%. |
| RN-15 | O progresso de uma meta com marcos é a porcentagem de marcos concluídos. Sem marcos, vale o status. |
| RN-16 | Um projeto precisa ter pelo menos uma raia. |
| RN-17 | No MVP, a marcação "compartilhada" não dá acesso a outros usuários. |
| RN-18 | Cada usuário tem uma moeda, BRL por padrão. |
| RN-19 | Uma tarefa se conclui. Um lembrete só avisa e não tem conclusão. |
| RN-20 | Os cartões do Kanban são próprios do projeto, separados das Tarefas, e podem se ligar a elas. |
| RN-21 | As notas de livros e vídeos são registros do próprio item e não aparecem em Notas. |
| RN-22 | O artigo continua só com status de leitura: a última página lida serve só para retomar a leitura, sem barra de progresso. |
| RN-23 | A sessão de leitura oferecida ao fechar o leitor só entra no histórico e no progresso do livro depois de a pessoa confirmar. |
| RN-24 | A nota criada a partir de um trecho guarda o trecho e a página. O comentário da pessoa é opcional. |
| RN-25 | O PDF é servido só ao dono do livro ou do artigo. |

## Fluxos

### Fluxo principal

1. O admin sobe a instância com o `docker-compose.yml` e acessa o Atria pela primeira vez.
2. O assistente de primeira execução cria a conta admin e pede a ativação do 2FA.
3. O admin gera um convite e envia o link a um amigo.
4. O amigo abre o link, cria a conta e o sistema cria a "Conta principal" dele.
5. O usuário cadastra uma saída recorrente de aluguel e liquida o mês com o valor efetivo.
6. O sistema atualiza o saldo e registra a economia ou a perda da liquidação.
7. O usuário aperta Ctrl/Cmd + K, digita "nota" e cria uma nota rápida pela paleta.
8. O usuário abre a nota por "abrir para completar" e a liga a uma meta.
9. O usuário escreve uma entrada no Diário, marca a emoção "ansiedade" e a liga à saída do aluguel.
10. A meta, a nota, a saída e a entrada do diário mostram a ligação na aba "Conexões".
11. O usuário gera o relatório do Diário e exporta em PDF.

### Fluxos alternativos

- FA-01 (passo 2): numa instância com usuários, o assistente não aparece e o acesso vai para o login.
- FA-02 (passo 3): com o convite obrigatório desligado, o amigo se cadastra direto pela tela de cadastro.
- FA-03 (passo 4): com o convite expirado ou já usado, o cadastro é recusado com a mensagem de convite inválido.
- FA-04 (passo 5): se o servidor recusar a liquidação, a interface desfaz a mudança otimista e avisa o usuário.
- FA-05 (passo 7): sem "abrir para completar", a nota fica salva só com os campos mínimos.
- FA-06 (login): quem esqueceu a senha recebe o link por e-mail, se houver SMTP, ou pede ao admin um link gerado.

## Casos de borda

| ID | Situação | Comportamento esperado | Requisitos |
|---|---|---|---|
| CB-01 | Tentativa de excluir a conta padrão. | A exclusão é recusada e a interface oferece renomear. | RF-24, RF-25 |
| CB-02 | Recorrência mensal no dia 31 num mês de 30 dias ou em fevereiro. | A ocorrência cai no último dia do mês. | RF-31, RF-39, RF-40 |
| CB-03 | Recorrência anual em 29/02 num ano não bissexto. | A ocorrência cai em 28/02. | RF-31, RF-39, RF-40 |
| CB-04 | Lembrete às 02:30 num dia de mudança de horário de verão. | O lembrete dispara uma vez, no horário local equivalente. | RF-40, RF-41 |
| CB-05 | Registro de páginas que passa do total do livro. | O registro é aceito e o progresso para em 100%. | RF-48, RF-49 |
| CB-06 | Exclusão de uma entidade com ligações. | As ligações são removidas dos dois lados. | RF-18 |
| CB-07 | Exclusão de uma raia com cartões. | O sistema pede para escolher a raia de destino dos cartões. | RF-56 |
| CB-08 | Exclusão da última raia do projeto. | A exclusão é recusada. | RF-56 |
| CB-09 | Envio duplicado da mesma movimentação. | O `Idempotency-Key` impede a duplicação. | RF-27 |
| CB-10 | Compra parcelada feita depois do fechamento da fatura. | A primeira parcela entra na fatura seguinte. | RF-28, RF-34 |
| CB-11 | Recuperação de senha de um e-mail que não existe. | A resposta é a mesma de um e-mail existente. | RF-08 |
| CB-12 | Vídeo cadastrado sem internet. | A miniatura não é buscada e o usuário pode enviá-la à mão. | RF-53 |
| CB-13 | Paleta aberta com o foco num campo de texto. | O atalho abre a paleta mesmo assim. | RF-15 |
| CB-14 | Notificações negadas pelo navegador. | O lembrete aparece só dentro do app, sem novo pedido de permissão. | RF-41, RF-42 |
| CB-15 | Exclusão de uma categoria em uso. | O sistema pede uma categoria de destino para as movimentações. | RF-30 |
| CB-16 | PDF corrompido ou protegido por senha. | O leitor mostra uma mensagem de erro e mantém o botão de baixar. | RF-65, RF-70 |
| CB-17 | Leitor fechado sem avançar além da página inicial. | O registro de sessão não é oferecido. | RF-67 |
| CB-18 | Leitor fechado numa página anterior à de abertura. | O registro de sessão não é oferecido, e a última página lida passa a ser a de fechamento. | RF-66, RF-67 |
| CB-19 | PDF trocado depois de haver destaques. | Os destaques do arquivo antigo são mantidos na aba, marcados como de outro arquivo. | RF-69 |
| CB-20 | Trecho selecionado numa página sem texto (PDF escaneado). | A nota é criada só com a página citada e o comentário. | RF-68 |

## Contratos e interfaces

Variáveis de ambiente do servidor:

```bash
ATRIA_DATABASE_URL=postgres://atria:atria@db:5432/atria
ATRIA_BIND_ADDRESS=0.0.0.0:8080
ATRIA_PUBLIC_URL=https://atria.example.com
ATRIA_ENCRYPTION_KEY_FILE=/run/secrets/atria_key
ATRIA_STORAGE_PATH=/data/files
ATRIA_TRUSTED_PROXIES=10.0.0.0/8
ATRIA_LOG_LEVEL=info
ATRIA_SMTP_HOST=
ATRIA_SMTP_PORT=587
ATRIA_SMTP_USER=
ATRIA_SMTP_PASSWORD_FILE=
ATRIA_SMTP_FROM=
ATRIA_WEB_PUSH_VAPID_KEY_FILE=
```

Recursos da API REST, sob `/api/v1`:

```text
POST   /setup                        assistente de primeira execução
POST   /auth/sign-up                 cadastro (com invite_token)
POST   /auth/sign-in                 login (com totp_code opcional)
POST   /auth/sign-out
POST   /auth/password-resets         pede o link de redefinição
PUT    /auth/password-resets/{token} redefine a senha
POST   /auth/totp                    ativa o 2FA
GET    /admin/users                  admin e elevated
PATCH  /admin/users/{id}             papel e ativação
POST   /admin/invites                admin e elevated
POST   /admin/password-resets        admin gera o link
GET    /admin/instance               estado da instância
PATCH  /admin/instance/settings      admin
GET    /search?q=&contexts=          busca global e paleta
GET|POST          /links             ligações (source_type, source_id, target_type, target_id)
DELETE            /links/{id}
GET|POST          /accounts
GET|PATCH|DELETE  /accounts/{id}
GET|POST          /categories
GET|POST          /transactions
POST              /transactions/{id}/settlement
GET|POST          /transfers
GET               /credit-cards/{id}/statements
POST              /credit-cards/{id}/statements/{period}/payment
GET|POST          /goals, /goals/{id}/milestones
GET|POST          /tasks
POST              /tasks/{id}/completion
GET|POST          /reminders
GET|POST          /notes
GET|POST          /journal-entries
GET|POST          /emotions
GET|POST          /books, /books/{id}/reading-sessions, /books/{id}/book-notes
GET|POST          /articles
GET|POST          /videos
GET|POST          /projects, /projects/{id}/lanes, /projects/{id}/cards
GET               /reports/{report}?from=&to=&format=html|pdf
GET               /exports?format=json|csv
GET               /files/{id}                         PDF e imagens, só para o dono
GET|PUT           /books/{id}/reading-position         última página lida
GET|PUT           /articles/{id}/reading-position
GET|POST          /books/{id}/highlights, /articles/{id}/highlights
GET|POST          /articles/{id}/article-notes
GET               /healthz
```

Campos comuns de toda entidade (JSON em `snake_case`):

```json
{
  "id": "0192f0c8-7a1b-7c3e-9a4d-1f2e3d4c5b6a",
  "owner_id": "0192f0c8-0000-7000-8000-000000000001",
  "visibility": "personal | shared",
  "created_at": "2026-10-30T12:00:00Z",
  "updated_at": "2026-10-30T12:00:00Z"
}
```

Movimentação financeira:

```json
{
  "kind": "income | expense",
  "account_id": "uuid",
  "category_id": "uuid | null",
  "expected_amount": 150000,
  "expected_date": "2026-11-05",
  "settled_amount": 145000,
  "settled_at": "2026-11-03",
  "difference_amount": -5000,
  "difference_kind": "saving | gain | loss | null",
  "currency": "BRL",
  "recurrence_id": "uuid | null",
  "installment": { "number": 1, "total": 10 }
}
```

Regra de recorrência (tarefas, lembretes e movimentações):

```json
{
  "frequency": "daily | weekly | monthly | yearly",
  "interval": 1,
  "weekdays": ["mon", "wed"],
  "month_day": 31,
  "time": "08:00",
  "timezone": "America/Sao_Paulo",
  "starts_on": "2026-11-01",
  "ends_on": null
}
```

Rotas do modo leitura no frontend e destaque:

```text
/library/books/{id}/read
/library/articles/{id}/read
```

```json
{
  "file_id": "uuid",
  "page": 42,
  "color": "accent | primary | success | warning | info",
  "text": "trecho destacado",
  "rects": [{ "x": 0.12, "y": 0.40, "width": 0.60, "height": 0.03 }]
}
```

Paleta de comandos:

```text
Atalho padrão: Ctrl + K (Windows e Linux), Cmd + K (macOS), configurável
Prefixos: ">" só ações, "#" só tags; texto livre busca em tudo
Teclas: setas navegam, Enter abre, Esc fecha
```

## Componentes afetados

| Caminho | Ação | Motivo |
|---|---|---|
| `prototype/atria-prototype.html` | criar | Protótipo HTML autocontido da primeira tarefa. |
| `package.json` | criar | Raiz do workspace pnpm. |
| `pnpm-workspace.yaml` | criar | Declaração dos pacotes JS do monorepo. |
| `Cargo.toml` | criar | Raiz do Cargo workspace. |
| `packages/theme` | criar | Tokens do ecossistema como variáveis CSS e fontes. |
| `packages/ui` | criar | Biblioteca de componentes genéricos. |
| `packages/contracts` | criar | Tipos TypeScript gerados do OpenAPI do servidor. Ponto de integração: regenerado depois de cada contexto. |
| `.github/workflows/ci.yml` | criar | CI com lint, typecheck, testes, auditoria de dependências e Lighthouse CI. |
| `lighthouserc.json` | criar | Telas e notas mínimas do Lighthouse CI. |
| `apps/server/Cargo.toml` | criar | Crate `atria-server`. |
| `apps/server/src/main.rs` | criar | Inicialização, configuração `ATRIA_` e execução das migrações dos contextos. Ponto de integração. |
| `apps/server/src/http` | criar | Servidor axum, middlewares de segurança, sessão, CSRF, `/healthz` e registro das rotas de cada contexto. Ponto de integração. |
| `apps/server/src/shared` | criar | Núcleo comum: erros `problem+json`, ids UUID v7, relógio injetável, dinheiro, recorrência, criptografia e visibilidade. |
| `apps/server/src/storage` | criar | Armazenamento de arquivos local com interface compatível com S3. |
| `apps/server/src/auth` | criar | Contexto de usuários, assistente, convites, sessões, 2FA, redefinição de senha, papéis, preferências e configurações da instância. |
| `apps/server/src/finance` | criar | Contexto de contas, cartão, movimentações, parcelas, transferências, categorias, recorrência e liquidação. |
| `apps/server/src/goals` | criar | Contexto de metas e marcos. |
| `apps/server/src/tasks` | criar | Contexto de tarefas pontuais e recorrentes. |
| `apps/server/src/reminders` | criar | Contexto de lembretes, notificações e Web Push. |
| `apps/server/src/notes` | criar | Contexto de notas, com conteúdo criptografado. |
| `apps/server/src/journal` | criar | Contexto do diário e das emoções, com conteúdo criptografado. |
| `apps/server/src/library` | criar | Contexto de livros, artigos, vídeos, sessões de leitura, notas de item, posição de leitura e destaques. |
| `apps/server/src/projects` | criar | Contexto de projetos, raias e cartões. |
| `apps/server/src/links` | criar | Contexto das ligações bidirecionais entre entidades. |
| `apps/server/src/search` | criar | Contexto da busca global, com `tsvector` e busca em memória do diário e das notas. |
| `apps/server/src/reports` | criar | Contexto dos relatórios HTML e PDF e da exportação JSON e CSV. |
| `apps/web/package.json` | criar | Pacote `@atria/web`. |
| `apps/web/vite.config.ts` | criar | Configuração do Vite. |
| `apps/web/index.html` | criar | Página de entrada com `data-theme`. |
| `apps/web/src/main.tsx` | criar | Inicialização do React, do TanStack Router e do TanStack Query. |
| `apps/web/src/app` | criar | Rotas, layout com sidebar e topbar, tema e registro da navegação de cada feature. Ponto de integração. |
| `apps/web/src/shared` | criar | Cliente da API, interface otimista, formatação `Intl` e i18n comum. |
| `apps/web/src/features/auth` | criar | Telas de assistente, login, cadastro por convite, 2FA e redefinição de senha. |
| `apps/web/src/features/admin` | criar | Telas de usuários, convites, papéis e estado da instância. |
| `apps/web/src/features/dashboard` | criar | Dashboard geral com blocos ocultáveis. |
| `apps/web/src/features/finance` | criar | Telas do Financeiro e do dashboard financeiro. |
| `apps/web/src/features/goals` | criar | Telas de metas e marcos. |
| `apps/web/src/features/tasks` | criar | Telas de tarefas. |
| `apps/web/src/features/reminders` | criar | Telas de lembretes e permissão de notificações. |
| `apps/web/src/features/notes` | criar | Telas de notas. |
| `apps/web/src/features/journal` | criar | Telas do diário e das emoções. |
| `apps/web/src/features/library` | criar | Estante, artigos, vídeos e históricos. |
| `apps/web/src/features/reader` | criar | Modo leitura de PDF com `pdf.js`, notas de trecho e destaques. |
| `apps/web/src/features/projects` | criar | Lista, grade e Kanban de projetos. |
| `apps/web/src/features/connections` | criar | Aba "Conexões" usada por todas as entidades. |
| `apps/web/src/features/command-palette` | criar | Paleta de comandos com busca e criação rápida. |
| `apps/web/src/features/settings` | criar | Preferências do usuário e configurações da instância. |
| `apps/web/src/features/reports` | criar | Relatórios interativos, exportação em PDF e exportação de dados. |
| `Dockerfile` | criar | Imagem oficial sem root. |
| `docker-compose.yml` | criar | Instalação de referência com o app e o PostgreSQL. |
| `.env.example` | criar | Exemplo das variáveis `ATRIA_`. |
| `deploy/caddyfile-atria` | criar | Exemplo de proxy reverso com TLS. |
| `LICENSE` | criar | Licença AGPL-3.0. |
| `docs/self-hosting.md` | criar | Instalação, backup e restauração. |
| `docs/glossario.md` | criar | Glossário pt-br ↔ en dos termos do domínio. |

## Premissas e dependências

- O protótipo HTML é a primeira tarefa e todas as outras dependem dele. As decisões de layout e interação validadas nele valem para a implementação.
- Os tokens e as fontes vêm do documento de identidade do Ishtar Sink, com o painel do Translunar como referência visual.
- A regra [project/architecture-10] ganha uma exceção para a criação rápida pela paleta de comandos, a ser gravada pela skill `adjust-rules`.
- A regra [project/database-06] passa a excluir o diário e as notas do índice `tsvector`, a ser gravada pela skill `adjust-rules`.
- Web Push depende do serviço de push do navegador e por isso é opcional, ligado pelo admin ([project/architecture-12]).
- A miniatura de vídeo por oEmbed depende de internet. Sem ela, o envio é manual.
- O servidor de e-mail é opcional. Sem ele, a recuperação de senha depende do admin.
- O modo leitura usa o `pdf.js`, empacotado no próprio app, sem CDN ([project/architecture-12]).

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Escopo grande para uma única spec. | alto | Plano com tarefas pequenas e paralelas por módulo, todas atrás do protótipo validado. |
| Busca no diário e nas notas criptografados fica lenta com muito volume. | médio | Descriptografia só dos dados da própria pessoa, com medição no RNF-04 e revisão se passar do limite. |
| Recorrências erradas em fuso, fim de mês e horário de verão. | alto | Fuso de origem gravado na regra e testes dos casos de borda (TST-08). |
| Cálculo de fatura e parcelas do cartão com erro. | alto | Regras RN-06 e RN-07 cobertas por testes unitários do domínio. |
| Perda da chave de criptografia torna diário e notas ilegíveis. | alto | A documentação de autohospedagem inclui a chave no procedimento de backup. |
| Web Push indisponível na rede interna. | baixo | Notificação dentro do app como padrão, e Web Push opcional. |
| PDF grande deixa o leitor lento ou pesa no Lighthouse. | médio | Carregar o `pdf.js` só na rota do modo leitura e renderizar as páginas sob demanda. |

## Casos de teste

| ID | Cenário | Passos | Resultado esperado | Requisitos |
|---|---|---|---|---|
| CT-01 | Protótipo abre sem servidor | Abrir `prototype/atria-prototype.html` direto do disco e navegar por todos os módulos. | Todas as telas abrem com dados em memória, sem requisição de rede. | RF-01 |
| CT-02 | Protótipo cadastra e edita | No protótipo, criar, editar, filtrar, buscar e trocar a visualização em cada módulo. | As mudanças aparecem na hora e os filtros e a busca respondem. | RF-02 |
| CT-03 | Primeira execução | Subir uma instância vazia e acessar. | O assistente cria o admin e depois não aparece mais. | RF-03 |
| CT-04 | Cadastro com convite | Gerar convite, cadastrar com ele, tentar reutilizar. | O primeiro cadastro funciona e o segundo é recusado. | RF-04, RF-11 |
| CT-05 | Convite opcional | O admin desliga o convite e uma pessoa se cadastra sem ele. | O cadastro funciona. | RF-05 |
| CT-06 | Login com 2FA | Ativar TOTP, sair, entrar sem código e com código. | Sem código é recusado, com código entra. | RF-06, RF-07 |
| CT-07 | 2FA obrigatório para admin | Concluir o assistente sem ativar o 2FA. | O admin não acessa a instância até ativar. | RF-07 |
| CT-08 | Recuperação por e-mail | Com SMTP de teste, pedir redefinição para um e-mail existente e outro inexistente. | O e-mail chega só para o existente e as duas respostas são iguais. | RF-08 |
| CT-09 | Recuperação pelo admin | O admin gera o link, o usuário redefine e tenta usar de novo. | A redefinição funciona uma única vez. | RF-09 |
| CT-10 | Papéis | O admin concede `elevated`. O elevated gera convite, lista e desativa um `user`, vê o estado da instância e tenta alterar as configurações da instância. | Tudo funciona, menos a alteração da instância, que é recusada. | RF-10, RF-11, RF-12, RF-13 |
| CT-11 | Layout | Abrir qualquer tela autenticada em desktop e em 360 px. | Sidebar e topbar aparecem com navegação, gatilho de busca e breadcrumbs. | RF-14 |
| CT-12 | Paleta de comandos | Apertar Ctrl/Cmd + K com o foco num campo, buscar com e sem contextos, criar uma nota rápida e usar "abrir para completar". | O fundo fica borrado, os resultados respeitam os contextos, a nota é criada e a tela própria abre. | RF-15, RF-16, RF-17 |
| CT-13 | Ligações bidirecionais | Ligar uma nota a uma meta, filtrar e agrupar a aba "Conexões", remover a ligação pela meta. | A ligação aparece nos dois lados e some dos dois. | RF-18, RF-19 |
| CT-14 | Listagens | Em cada módulo, usar filtro, busca e cada modo de visualização. | A listagem responde a cada controle e o estado fica na URL. | RF-20 |
| CT-15 | Visibilidade | Marcar uma entidade como compartilhada e acessar com outro usuário. | A marcação fica gravada e o outro usuário recebe 404. | RF-21 |
| CT-16 | Dashboard | Com dados de todos os módulos, abrir o Dashboard e ocultar um bloco. | Os blocos mostram os dados e o oculto não volta depois de recarregar. | RF-22, RF-23 |
| CT-17 | Contas | Criar, renomear e excluir uma conta, e tentar excluir a conta padrão. | A conta comum é excluída e a padrão é recusada. | RF-24, RF-25 |
| CT-18 | Liquidação com economia e perda | Liquidar uma saída abaixo do previsto, uma saída acima e uma entrada acima e outra abaixo. | O saldo muda só na liquidação e a diferença é economia, perda, ganho e perda, respectivamente. | RF-27, RF-32, RF-33 |
| CT-19 | Cartão e parcelas | Criar cartão, registrar compra em 3 parcelas antes e depois do fechamento, pagar a fatura. | As parcelas caem nas faturas certas e o pagamento liquida a fatura como transferência. | RF-26, RF-28, RF-34 |
| CT-20 | Transferência e categorias | Transferir entre contas, criar e excluir uma categoria em uso. | A transferência não entra nos totais e a exclusão pede a categoria de destino. | RF-29, RF-30 |
| CT-21 | Recorrência financeira | Criar o aluguel mensal no dia 31, mudar o valor a partir do 3º mês. | As ocorrências caem no último dia em meses curtos e só as futuras mudam. | RF-31 |
| CT-22 | Dashboard financeiro | Abrir o dashboard do Financeiro com movimentações do mês. | Saldo por conta, previsto x realizado, economias e perdas batem com os dados. | RF-35 |
| CT-23 | Metas | Criar meta com prazo, acrescentar 4 marcos e concluir 1. | O progresso mostra 25%. | RF-36, RF-37 |
| CT-24 | Tarefas | Criar tarefa pontual, concluir e reabrir. Criar tarefa diária e concluir a ocorrência de hoje. | A pontual muda de estado e só a ocorrência de hoje fica concluída. | RF-38, RF-39 |
| CT-25 | Lembretes | Criar lembrete recorrente para daqui a 1 minuto, com a aba aberta e depois com Web Push ligado e a aba fechada. | A notificação aparece nos dois casos. | RF-40, RF-41, RF-42 |
| CT-26 | Notas | Criar, editar e excluir uma nota. | A nota segue o ciclo e não aparece mais depois de excluída. | RF-43 |
| CT-27 | Diário | Registrar duas entradas no mesmo dia com emoções e intensidade, e criar uma emoção nova. | As duas entradas ficam com data, hora e emoções, e a nova emoção aparece na lista. | RF-44, RF-45, RF-46 |
| CT-28 | Livros | Cadastrar livro de 200 páginas, registrar 20 e 30 páginas, editar o primeiro registro para 25, anexar PDF e acrescentar nota. | O progresso mostra 27,5% na estante e na tela, os históricos ficam nas abas e o PDF baixa. | RF-47, RF-48, RF-49, RF-50, RF-51 |
| CT-29 | Artigos e vídeos | Cadastrar artigo com status e nota, cadastrar vídeo do YouTube com nota. | O artigo fica com status e histórico, e o vídeo mostra a miniatura na vitrine. | RF-52, RF-53 |
| CT-30 | Projetos e Kanban | Ver projetos em lista e grade, abrir um, criar raia colorida, reordenar, criar cartão e mover. | As raias padrão existem, a nova aparece na ordem e o cartão muda de raia. | RF-54, RF-55, RF-56, RF-57 |
| CT-31 | Configurações do usuário | Mudar tema, idioma, fuso, moeda, atalho da paleta e contextos padrão da busca. | Cada preferência vale na hora e depois de recarregar. | RF-58, RF-59 |
| CT-32 | Configurações da instância | O admin liga o Web Push, configura o SMTP e desliga o convite. | As configurações passam a valer para todos. | RF-60 |
| CT-33 | Relatórios | Gerar cada relatório num período, interagir no HTML e exportar em PDF. | O HTML filtra e o PDF sai com a identidade visual. | RF-61, RF-62 |
| CT-34 | Exportação | Exportar os dados em JSON e CSV. | Os arquivos contêm todas as entidades do usuário e nada de outros. | RF-63 |
| CT-35 | Leitor de PDF | Anexar PDF a um livro e a um artigo, abrir o modo leitura, usar zoom, navegar, trocar o tema, fechar na página 12 e reabrir. | O leitor abre sem sidebar nem topbar e reabre na página 12, nos dois itens. | RF-64, RF-65, RF-66 |
| CT-36 | Registro da sessão ao fechar | Abrir o PDF do livro na página 40, ir até a 62, fechar e confirmar o registro. Repetir sem confirmar. | O registro vem preenchido com 40 a 62 e entra no histórico e no progresso só quando confirmado. | RF-67 |
| CT-37 | Nota a partir de trecho | Selecionar um trecho e criar nota com e sem comentário. | As duas notas entram no histórico com o trecho e a página, e uma delas com o comentário. | RF-68 |
| CT-38 | Destaques e download | Destacar dois trechos com cores diferentes, abrir a aba "Destaques" e baixar o PDF pelo leitor. | Os destaques aparecem no PDF e na aba, e o arquivo baixa. | RF-69, RF-70 |

## Critérios de aceite

- [ ] CA-01: O protótipo HTML abre sem servidor e permite cadastrar, editar, filtrar, buscar e visualizar todos os módulos com dados em memória (RF-01, RF-02).
- [ ] CA-02: A instância cria o admin pelo assistente, aceita cadastro só por convite de uso único quando exigido e permite desligar essa exigência (RF-03, RF-04, RF-05).
- [ ] CA-03: O login exige o TOTP de quem ativou o 2FA, e o admin só acessa com o 2FA ativo (RF-06, RF-07).
- [ ] CA-04: A senha é redefinida por e-mail com SMTP ou por link de uso único gerado pelo admin (RF-08, RF-09).
- [ ] CA-05: O papel `elevated` gera convites, gere contas `user` e vê o estado da instância, sem alterar papéis nem configurações da instância (RF-10, RF-11, RF-12, RF-13).
- [ ] CA-06: Toda tela autenticada tem sidebar e topbar, e a paleta abre por Ctrl/Cmd + K e pela topbar, busca por contextos e cria entidades rápidas (RF-14, RF-15, RF-16, RF-17).
- [ ] CA-07: Toda entidade se liga a outra nos dois sentidos, tem a aba "Conexões", a marcação de visibilidade e listagens com filtros, busca e visualizações (RF-18, RF-19, RF-20, RF-21).
- [ ] CA-08: O Dashboard mostra os blocos de todos os módulos e lembra os blocos ocultos (RF-22, RF-23).
- [ ] CA-09: O Financeiro gere contas, conta padrão, cartão, movimentações, parcelas, transferências, categorias e recorrências, e só muda o saldo na liquidação, com economia, ganho e perda calculados (RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33).
- [ ] CA-10: O Financeiro mostra e paga a fatura do cartão e tem dashboard próprio com valores que batem com as movimentações (RF-34, RF-35).
- [ ] CA-11: Metas calcula o progresso pelos marcos concluídos (RF-36, RF-37).
- [ ] CA-12: Tarefas e Lembretes funcionam pontuais e recorrentes, e os lembretes notificam no navegador e por Web Push quando ligado (RF-38, RF-39, RF-40, RF-41, RF-42).
- [ ] CA-13: Notas e Diário funcionam, com várias entradas por dia, emoções com intensidade e lista de emoções editável (RF-43, RF-44, RF-45, RF-46).
- [ ] CA-14: O Acervo cadastra livros com progresso por registro de páginas, históricos de leitura e de notas e PDF opcional, além de artigos e vídeos com miniatura (RF-47, RF-48, RF-49, RF-50, RF-51, RF-52, RF-53).
- [ ] CA-15: Projetos aparece em lista e grade, com Kanban de raias padrão customizáveis e cartões móveis (RF-54, RF-55, RF-56, RF-57).
- [ ] CA-16: As configurações do usuário e da instância passam a valer na hora e depois de recarregar (RF-58, RF-59, RF-60).
- [ ] CA-17: Os relatórios saem em HTML interativo e em PDF com a identidade visual, e a exportação traz todos os dados do usuário em JSON e CSV (RF-61, RF-62, RF-63).
- [ ] CA-18: O modo leitura abre o PDF de livros e artigos numa tela própria, retoma a última página, oferece o registro da sessão do livro ao fechar, cria notas a partir de trechos com comentário opcional, guarda destaques com cor e permite baixar o arquivo (RF-64, RF-65, RF-66, RF-67, RF-68, RF-69, RF-70).

## Referências

| Tipo | Referência | Uso |
|---|---|---|
| arquivo | `vostok/work/specs/draft/SPEC-001-mvp.md` | Rascunho de origem. |
| arquivo | `vostok/rules/project/` | Regras do projeto gravadas pelo init-harness, usadas como restrições. |
| documentação | `Ishtar-Sink/.github` `docs/identidade-ecossistema.md` | Paleta, tipografia, motion, tema e licença do ecossistema. |
| arquivo | `../translunar/src/translunar/panel/static/tokens.css` | Referência visual dos tokens como variáveis CSS. |
| arquivo | `../translunar/src/translunar/panel/static/index.html` | Referência da sidebar, do cabeçalho de página e do tema. |
| arquivo | `../translunar/deploy/caddyfile-translunar` | Referência do exemplo de proxy reverso. |
| arquivo | `../nebula/package.json` | Referência da estrutura do monorepo com pnpm e Cargo. |
| memória | `vostok memory search all` | Sem entradas: nenhuma decisão anterior. |

## O que mudou

| # | Assunto | Estado no Original | Estado Refinado |
|---|---|---|---|
| 1 | Escopo da spec | Todos os recursos descritos, com só o protótipo como critério de aceite. | MVP completo, com o protótipo como primeira tarefa e dependência de todas as outras. |
| 2 | Paleta de comandos | Não existia. | Ctrl/Cmd + K com fundo borrado, busca e criação rápida, unificada com a busca da topbar. |
| 3 | Tarefas x Lembretes | Tarefas incluíam lembretes pontuais. | Tarefa se conclui e lembrete só avisa. |
| 4 | Notas do acervo | Ambíguo em relação a Notas. | Registros próprios do livro ou vídeo. |
| 5 | Kanban | Só as raias. | Cartões próprios do projeto, ligáveis a Tarefas. |
| 6 | Diário | Sentimentos em texto. | Emoções estruturadas com intensidade e lista editável. |
| 7 | Financeiro | Contas, movimentações, recorrência, liquidação, economia e perda. | Acrescenta cartão com fatura e parcelas, transferências e categorias. |
| 8 | Metas | Só ligações. | Campos simples e marcos com progresso. |
| 9 | Acesso elevado | Sem definição. | Convites, gestão de contas `user` e estado da instância. |
| 10 | Recuperação de senha | Sem canal definido. | SMTP opcional e link gerado pelo admin. |
| 11 | Notificações | No navegador. | Com a aba aberta e Web Push opcional. |
| 12 | Busca | Contextos a serem indexados. | Escolha dos contextos na hora de buscar, com padrão nas configurações. |
| 13 | Diário e notas criptografados | Sem definição. | Criptografados em repouso, com busca descriptografando em memória. |
| 14 | Relatórios | HTML e PDF, sem lista. | Financeiro, Leitura, Diário, Metas, Tarefas e Projetos. |
| 15 | Critérios de aceite | Um critério, do protótipo. | 18 critérios verificáveis cobrindo todos os requisitos. |
| 16 | Modo leitura | Só um campo opcional para o PDF do livro. | PDF também no artigo e leitor próprio com retomada, registro de sessão, notas de trecho, destaques e download. |
| 17 | Componentes afetados | Sem componentes. | Um caminho por contexto do servidor e por feature do frontend, com os pontos de integração compartilhados marcados, para o plano rodar os módulos em paralelo. |

## Registro de decisões

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | A SPEC-001 cobre o MVP inteiro, com o protótipo HTML como primeira tarefa e dependência das outras. | Protótipo e fundação na SPEC-001, módulos em specs próprias. | Resposta do usuário (1B). |
| 2 | Todos os módulos entram no MVP, inclusive Relatórios. | Relatórios numa spec própria. | Resposta do usuário (2A). |
| 3 | Tarefa se conclui, lembrete só avisa, e uma tarefa pode ter lembrete ligado. | Lembrete como tarefa com notificação. | Resposta do usuário (3A). |
| 4 | Notas de livros e vídeos são registros do próprio item. | Notas comuns ligadas ao item. | Resposta do usuário (4A). |
| 5 | Cartões do Kanban são itens próprios do projeto. | Cartão como Tarefa. | Resposta do usuário (5B). |
| 6 | Emoções de uma lista editável, com intensidade opcional. | Escala fixa de humor ou só texto. | Resposta do usuário (6A). |
| 7 | Financeiro com transferências, categorias e cartão de crédito. | Várias moedas. | Resposta do usuário (7ABC). |
| 8 | Metas simples com marcos opcionais. | Valor financeiro alvo. | Resposta do usuário (8AB). |
| 9 | Elevado gera convites, gere contas `user` e vê o estado da instância. | Elevado com menos permissões. | Resposta do usuário (9ABC). |
| 10 | SMTP opcional e link de redefinição gerado pelo admin. | SMTP obrigatório. | Resposta do usuário (10A e C). |
| 11 | Notificação com a aba aberta e Web Push opcional. | Só com a aba aberta, ou Web Push sempre. | Resposta do usuário (11A). |
| 12 | Os contextos da busca são escolhidos na hora de buscar e tudo é indexado. | Contextos excluídos do índice. | Resposta do usuário (12A). |
| 13 | Diário e notas criptografados, com busca em memória e fora do `tsvector`. | Índice cego, ou conteúdo em claro. | Resposta do usuário (13A). |
| 14 | Relatórios em todo módulo com dado ao longo do tempo. | Só alguns módulos. | Resposta do usuário (14). |
| 15 | Criação rápida na paleta, como exceção da [project/architecture-10]. | Paleta só leva à tela de criação. | Resposta do usuário (2ª rodada, 2A). |
| 16 | A busca da topbar e a paleta são a mesma busca. | Tela de resultados separada. | Resposta do usuário (2ª rodada, 3A). |
| 17 | Economia, ganho e perda pela diferença entre o valor previsto e o efetivo. | Cálculo por data de pagamento. | Inferência A. |
| 18 | Recorrência como regra que gera ocorrências individuais e muda só as futuras. | Ocorrências sem regra. | Inferência B. |
| 19 | Conta padrão "Conta principal" por usuário. | Conta padrão por instância. | Inferência C. |
| 20 | Uma moeda por usuário, BRL por padrão. | Moeda única da instância. | Inferência D. |
| 21 | Dashboard com blocos que podem ser ocultados. | Dashboard fixo. | Inferência E. |
| 22 | Dashboard financeiro com saldo por conta, previsto x realizado, economias e perdas. | Sem dashboard próprio. | Inferência F. |
| 23 | Configurações do usuário e da instância separadas. | Uma tela só. | Inferência G. |
| 24 | Assistente de primeira execução cria o admin. | Admin por variável de ambiente. | Inferência H. |
| 25 | O admin não vê o conteúdo de outros usuários. | Admin com acesso total. | Inferência I. |
| 26 | "Compartilhada" é só marcação no MVP. | Compartilhamento com acesso. | Inferência J. |
| 27 | Ligação removida de um lado some dos dois. | Ligações independentes por lado. | Inferência K. |
| 28 | Várias entradas de diário por dia. | Uma entrada por dia. | Inferência L. |
| 29 | Artigos com status de leitura, sem registro de páginas. | Artigos com progresso por páginas. | Inferência M. |
| 30 | Miniatura de vídeo por oEmbed, com envio manual. | Só envio manual. | Inferência N. |
| 31 | Livros cadastrados à mão, sem busca por ISBN. | Busca por ISBN. | Inferência O. |
| 32 | App web responsivo, sem PWA nem app nativo. | PWA no MVP. | Inferência P. |
| 33 | Protótipo com tokens, dois temas e regras de frontend. | Protótipo sem identidade. | Inferência Q. |
| 34 | Paleta abre em qualquer tela, também com foco num campo. | Só fora de campos. | Inferência R. |
| 35 | Fundo borrado com `backdrop-filter`, sem animação para movimento reduzido. | Fundo só escurecido. | Inferência S. |
| 36 | Paleta como `role="dialog"`, com foco preso e navegação por setas. | Lista sem navegação por teclado. | Inferência T. |
| 37 | Paleta vazia mostra recentes e ações de criar. | Paleta vazia sem conteúdo. | Inferência U. |
| 38 | Prefixos `>` e `#` na paleta. | Sem prefixos. | Inferência V. |
| 39 | Dica do atalho na topbar e atalho configurável. | Atalho fixo. | Inferência W. |
| 40 | O protótipo inclui a paleta funcionando. | Paleta só na implementação. | Inferência X. |
| 41 | Todas as tarefas dependem do protótipo validado. | Tarefas independentes do protótipo. | Inferência Y. |
| 42 | Cartão de crédito como tipo de conta, com fatura paga por transferência. | Cartão como categoria. | Inferência AA. |
| 43 | Um relatório por módulo com dado ao longo do tempo. | Lista menor. | Inferência AB. |
| 44 | O modo leitura tem leitor em tela própria, registro da sessão ao fechar, notas a partir de trechos com comentário opcional e destaques com cor. | Leitor só para exibir o PDF. | Ajuste 1, resposta 1ABCD. |
| 45 | O artigo continua só com status, e a última página serve para retomar a leitura. | Barra de progresso ou registro de sessões no artigo. | Ajuste 1, resposta 2A. |
| 46 | O PDF abre no modo leitura, com botão para baixar. | Leitor sem download. | Ajuste 1, resposta 3A. |
| 47 | O artigo ganha o anexo de PDF opcional. | Modo leitura só para livros. | Ajuste 1, inferência A. |
| 48 | O leitor usa o `pdf.js` empacotado no app. | Leitor por CDN ou nativo do navegador. | Ajuste 1, inferência B. |
| 49 | O modo leitura é uma rota própria. | Leitor em modal. | Ajuste 1, inferência C. |
| 50 | O PDF é servido só ao dono, pela rota de arquivos com autorização. | Arquivo por URL pública. | Ajuste 1, inferência D. |
| 51 | Só PDF no MVP. | EPUB e outros formatos. | Ajuste 1, inferência E. |
| 52 | O protótipo HTML mostra o modo leitura com um PDF de exemplo embutido. | Modo leitura fora do protótipo. | Ajuste 1, inferência F. |
| 53 | Componentes detalhados por contexto do servidor (`apps/server/src/<contexto>`) e por feature do frontend (`apps/web/src/features/<feature>`). | Pastas inteiras `apps/server` e `apps/web`. | Ajuste 2. |
| 54 | Os pontos de integração compartilhados são só `apps/server/src/main.rs`, `apps/server/src/http`, `apps/web/src/app` e `packages/contracts`, e o plano os sequencia. | Cada contexto registrando rotas no próprio arquivo, sem ponto central. | Ajuste 2, inferência A. |
| 55 | Cada contexto guarda as próprias migrações em `apps/server/src/<contexto>/migrations`, aplicadas em ordem pelo `main.rs`. | Uma pasta única `apps/server/migrations` compartilhada por todas as tarefas. | Ajuste 2, inferência B. |
| 56 | Testes ficam dentro do contexto ou da feature (unitários, de integração e ponta a ponta `*.e2e.ts`), sem pasta de testes compartilhada. | Pastas `tests/` e `e2e/` únicas. | Ajuste 2, inferência C. |
| 57 | As traduções ficam em cada feature (`apps/web/src/features/<feature>/i18n/pt-br.json`), com as comuns em `apps/web/src/shared`. | Um arquivo de tradução único. | Ajuste 2, inferência D. |
| 58 | Preferências do usuário e configurações da instância ficam no contexto `auth` do servidor, mantendo a lista de [project/architecture-02]. | Um contexto `settings` novo no servidor. | Ajuste 2, inferência E. |
| 59 | O Dashboard e o modo leitura não têm contexto próprio no servidor: usam os endpoints dos outros contextos. | Contexto `dashboard` no servidor. | Ajuste 2, inferência F. |
| 60 | A CI (`.github/workflows/ci.yml`) e o `lighthouserc.json` entram como componentes, por [project/development-methodology-06] e [project/testing-11]. | CI fora da spec. | Ajuste 2, inferência G. |

## Pendências

| # | Pendência | Opções em aberto |
|---|---|---|
| - | - | - |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | modo leitura de PDF: novos RF-64 a RF-70, RN-22 a RN-25, CB-16 a CB-20, CT-35 a CT-38 e CA-18; escopo, contratos, premissas e riscos atualizados; EPUB fora do escopo |
| 2 | 2026-10-30 | agente | componentes afetados detalhados por contexto do servidor e por feature do frontend, com pontos de integração marcados; packages/contracts, CI e lighthouserc.json acrescentados; decisões 53 a 60 |
