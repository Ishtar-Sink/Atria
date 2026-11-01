---
id: SPEC-002
title: "Correções do uso real do MVP"
status: implemented
author: "Victor Batalha"
created_at: 2026-10-31T22:15:43Z
updated_at: 2026-11-01T14:41:27Z
tags: []
type: improvement
source: "draft/SPEC-002-correcoes-do-uso-real-do-mvp.md"
refined_at: 2026-11-01T01:30:56Z
adjustments: 0
adjusted_at: null
content_hash: 81c18e2ec35ac357d286ddae3e4e388c6e297a7afbbe72378d38249ceacb9cfa
approved_at: 2026-11-01T01:38:21Z
approved_hash: 81c18e2ec35ac357d286ddae3e4e388c6e297a7afbbe72378d38249ceacb9cfa
---

# Correções do uso real do MVP - Especificação Refinada

Corrige os 30 defeitos e melhorias que o usuário encontrou no primeiro uso real do Atria em produção: proteção das rotas sem sessão, navegação, alinhamentos e espaçamentos, recorrências que somem ou se repetem, retorno visual em ações demoradas, leitor de PDF, emoções do Diário, checklist e quadro de Projetos, sem perder os dados já gravados.

## Objetivo

O MVP da SPEC-001 está em produção, mas o uso real mostrou telas que caem no dashboard sem sessão, itens criados que somem da lista ou aparecem repetidos, ações demoradas sem retorno e várias diferenças visuais em relação ao protótipo. O resultado esperado é o app corrigido nesses 30 pontos, fiel ao protótipo (DEC-007) onde ele decide, e com os dados de produção preservados.

## Estado atual

- **Sessão (Bug 1):** `apps/web/src/app/router.tsx` renderiza o `AppLayout` para toda rota não `bare`, sem `beforeLoad`; o 401 de `GET /api/v1/me` é ignorado (`apps/web/src/shared/session/current-user.ts`) e só o botão Sair leva ao login.
- **Voltar (Bug 2):** as 10 listagens chamam `rememberListLocation` com `location.href` num efeito; o TanStack Router muda a localização antes de a listagem desmontar, então a listagem grava o endereço da página que está abrindo e o `BackLink` (`apps/web/src/shared/navigation/back-link.tsx`) empurra a própria página.
- **Componentes compartilhados:** `PeriodField` mostra sempre o rótulo visível; `ViewSwitcher` aceita opção sem ícone e envolve o ícone num `span` em linha (fica acima do centro); a regra `.filters > * { min-width }` do Financeiro estica o seletor; `TagField` usa 4 px entre campo, etiquetas e ajuda; existem 6 diálogos `<dialog>` feitos à mão com espaçamentos diferentes; o `StickyPageHeader` (52 telas) tem só `backdrop-filter` sem cor, na largura do conteúdo (880 px nos formulários).
- **Painéis (Bugs 10 e 11):** painel do Financeiro e dashboard empilham os cards por coluna e só o último cresce (PD-25, PD-58, igual ao protótipo); a tabela acessível dos gráficos usa `.srOnly` na `table`, e no Firefox o `caption` escapa e aparece solto.
- **Financeiro:** nenhuma categoria é criada (só a Conta principal); o campo de categoria não tem estado vazio e pré-seleciona a primeira; `MoneyField` (`apps/web/src/features/finance/components/money-field.tsx`) não formata enquanto se digita; salvar com Repetir vai ao detalhe da recorrência sem aviso e renova a chave de idempotência, o que permitiu 3 recorrências iguais; "Próximas contas" (`apps/server/src/finance/domain/summary.rs`) só traz saídas, e o painel abre em "Este mês".
- **Lembretes (Bug 13):** com o Web Push desligado na instância, o cartão de notificações esconde o bloco de push sem explicar.
- **Tema (Bug 14):** `useApplyTheme` aplica a preferência "Seguir o sistema" como um valor fixo e o grava no navegador; o botão de tema da barra lateral grava só no navegador.
- **Diário:** a tabela `emotions` não tem ícone; o seletor usa cartões de largura fixa e o nome encosta nos pontos; a linha do tempo tira o cartão e mostra as emoções como etiquetas sem intensidade.
- **Acervo e leitor:** a área de capa tem um botão interno "Escolher imagem"; o envio usa `fetch` sem progresso e o `Button` com `loading` só desabilita, sem sinal visível; o servidor lê o arquivo inteiro e responde 200 sem `Accept-Ranges` e com `no-store`; o 100% do zoom ocupa toda a largura do palco (cerca de 1800 px no desktop); as notas de livros, artigos e vídeos já têm PATCH e DELETE no servidor, mas a tela não oferece; os destaques só têm GET e POST e a tabela `highlights` não tem `deleted_at`.
- **Projetos:** o checklist do cartão é um `textarea` convertido por `parseChecklist`, embora o servidor já guarde itens estruturados; o quadro usa arrastar nativo (não funciona em toque) e cada cartão tem um seletor de raia, cortado pelo `overflow` do quadro.
- **Tarefas:** `RecurrenceRule.time` é obrigatório (`apps/server/src/shared/recurrence.rs`) e o formulário exige horário (ajuste 7 da TASK-35); a lista abre em "Hoje", esconde a pontual de outro dia, e `buildRows` (`apps/web/src/features/tasks/hooks/use-tasks.ts`) cria uma linha por ocorrência em 7 dias e duplica a pontual que vem também de `/tasks/occurrences`.

## Escopo

### Dentro do escopo

- Os 30 itens do rascunho (Bugs 1 a 30), com as decisões das respostas 1A a 8A e as inferências A a M.
- Componentes compartilhados novos na `@atria/ui`: ícones de visualização, diálogo genérico e campo de moeda.
- Três migrações que só acrescentam colunas: `categories.system_key`, `emotions.icon`, `highlights.deleted_at`.
- Mudanças de contrato: `next_occurrence` em `GET /tasks`, `time` opcional na regra de tarefas, PATCH e DELETE de destaques, `icon` nas emoções, envio de arquivos com Range.
- Levantamento das ações demoradas do app como primeira etapa do Bug 20.
- Testes de unidade, de componente e e2e das correções, incluindo um projeto e2e em Firefox para os defeitos vistos no Zen.

### Fora do escopo

- Limpeza dos dados de teste do banco de produção e o deploy (operação, inferência M).
- Compressão de PDF ao salvar (resposta 6A).
- Estado de ocorrência atrasada nas tarefas, como no Financeiro (resposta 5A).
- Mudanças de identidade visual além das apontadas; o protótipo continua sendo a referência (DEC-007), com exceção registrada só para o alinhamento dos cards (resposta 2A).
- Novos itens que o usuário relatar depois do refinamento: entram por ajuste da spec.

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | O sistema deve, ao abrir uma rota autenticada sem sessão (`GET /api/v1/me` com 401), levar ao assistente da primeira vez quando a instância ainda não foi configurada e ao login nos demais casos, sem mostrar a tela autenticada (Bug 1). |
| RF-02 | O sistema deve levar ao login quando uma chamada da API responder 401 durante o uso, preservando o endereço para voltar depois do login (Bug 1). |
| RF-03 | O sistema deve fazer cada listagem guardar o próprio endereço como origem do Voltar, e o `BackLink` nunca deve navegar para a página atual (Bug 2). |
| RF-04 | O `PeriodField` deve, no cabeçalho de página, mostrar o botão de período sem rótulo visível (rótulo só para leitor de tela), alinhado aos botões ao lado (Bug 3). |
| RF-05 | O `ViewSwitcher` deve exigir ícone em todas as opções, mostrar o ícone centralizado no botão, com nome acessível e dica (`title`), e ocupar só a largura das opções (Bugs 4 e 6). |
| RF-06 | A `@atria/ui` deve fornecer os ícones de visualização (lista, grade, estante, tabela, por dia, linha do tempo), usados por todas as telas no lugar das cópias locais (Bugs 4 e 6). |
| RF-07 | A aba Conexões deve agrupar os itens com o seletor segmentado de texto, e não com o `ViewSwitcher` (Bug 4). |
| RF-08 | A barra de filtros de Tarefas deve alinhar todos os campos e o seletor de visualização pela base, sem texto de ajuda sob o campo Etiqueta (Bug 5). |
| RF-09 | O painel do Financeiro e o dashboard devem dispor os cards em linhas pareadas, em que os cards lado a lado têm a mesma altura e topos e bases alinhados (Bugs 10 e 11). |
| RF-10 | Os gráficos devem manter a tabela acessível invisível em todos os navegadores, sem texto solto no card (Bug 10). |
| RF-11 | O sistema deve criar categorias padrão de entrada e de saída para cada pessoa na primeira vez que ela usar o Financeiro (Bug 7). |
| RF-12 | O campo Categoria do formulário de movimentação deve oferecer "Sem categoria", começar sem categoria escolhida e trazer o link "Criar categoria" (Bug 7). |
| RF-13 | O campo de valor em reais deve formatar o valor enquanto se digita (`R$ 14.500,00`) e gravar o mesmo valor em centavos (Bug 8). |
| RF-14 | O formulário de movimentação deve, ao salvar com Repetir, mostrar um aviso de sucesso com a data da primeira ocorrência e voltar à lista (Bug 9). |
| RF-15 | O painel do Financeiro deve mostrar "Próximas movimentações", com entradas e saídas previstas para os próximos 30 dias, incluindo as ocorrências abertas das recorrências (Bug 12). |
| RF-16 | O cartão de notificações de Lembretes deve avisar quando o aviso com o app fechado estiver desligado na instância ou não inscrito no aparelho, com o caminho para ligar, e o link para Configurações › Instância para quem administra (Bug 13). |
| RF-17 | O sistema deve usar a preferência de tema do servidor como fonte única, aplicada ao abrir o app; o botão de tema da barra lateral grava essa preferência, e "Seguir o sistema" acompanha o tema do sistema em tempo real (Bug 14). |
| RF-18 | A aba Instância de Configurações deve separar os grupos em cartões com título e o espaçamento do protótipo, e as demais abas devem seguir o mesmo padrão (Bug 15). |
| RF-19 | O sistema deve mostrar um ícone para cada emoção: as padrão pelo `system_key` e as personalizadas por um ícone escolhido de um conjunto fixo na tela de Emoções (Bug 16). |
| RF-20 | O seletor de emoções do Diário deve mostrar cada emoção como um botão com ícone e nome, sem sobreposição em nomes longos, e a intensidade de 1 a 5 só depois de marcar a emoção (Bug 16). |
| RF-21 | A linha do tempo do Diário deve mostrar cada entrada num cartão, com as emoções com ícone e intensidade (Bug 17). |
| RF-22 | A área de capa deve ser ela mesma o controle de escolha da imagem, por clique, teclado e arrastar, sem botão interno (Melhoria 18). |
| RF-23 | O `TagField` deve ter o espaçamento do protótipo entre o campo, as etiquetas e o texto de ajuda (Bug 19). |
| RF-24 | O sistema deve ter registrado o levantamento das ações demoradas do app (envios, relatórios, exportações e salvamentos lentos) com o padrão aplicado a cada uma (Bug 20). |
| RF-25 | O `Button` em estado de carregando deve mostrar um indicador visível e impedir um segundo clique (Bug 20). |
| RF-26 | Os envios de arquivo do Acervo devem mostrar uma barra de progresso e, ao terminar, um aviso de sucesso (Bug 20). |
| RF-27 | O servidor deve servir os arquivos do Acervo com respostas parciais (`Range` e 206), `Accept-Ranges` e cache privado (Bug 21). |
| RF-28 | O leitor deve mostrar a primeira página do PDF sem baixar o arquivo inteiro (Bug 21). |
| RF-29 | O leitor deve tratar 100% de zoom como a largura de leitura (no máximo cerca de 960 px), com os demais níveis relativos a ela (Bug 21). |
| RF-30 | A `@atria/ui` deve fornecer um diálogo genérico com corpo e rodapé, usado pelos diálogos do app, incluindo o de registrar a sessão de leitura (Bug 22). |
| RF-31 | As abas de notas de livros, artigos e vídeos devem permitir editar e excluir cada nota (Bug 23). |
| RF-32 | O sistema deve permitir excluir um destaque e trocar a cor dele, no servidor e na tela (Bug 23). |
| RF-33 | O formulário de cartão de Projetos deve oferecer o checklist como lista de itens, com caixa de marcação, campo vazio no fim para o próximo item, remoção e reordenação por arrastar pela alça (Melhoria 24). |
| RF-34 | O quadro de Projetos deve mover os cartões entre as raias arrastando, por mouse, toque e teclado, sem seletor de raia na face do cartão (Melhoria 26). |
| RF-35 | O formulário de tarefa deve aceitar tarefa recorrente sem horário (Melhoria 27). |
| RF-36 | O `StickyPageHeader` deve ter fundo tingido com desfoque de ponta a ponta da área da página, como no protótipo, sem deixar o conteúdo aparecer por trás do texto do cabeçalho (Bug 28). |
| RF-37 | O formulário de tarefa deve, ao salvar, mostrar um aviso de sucesso, e a lista de Tarefas deve avisar quando houver tarefas abertas fora do período escolhido, oferecendo trocar o período (Bug 29). |
| RF-38 | A lista de Tarefas deve mostrar uma linha por tarefa recorrente, com a próxima ocorrência em aberto, e uma única linha por tarefa pontual (Bug 30). |

## Requisitos não funcionais

| ID | Requisito | Como verificar |
|---|---|---|
| RNF-01 | Nenhuma migração apaga, renomeia ou reescreve dados; as três só acrescentam colunas que aceitam nulo. | Revisão das migrações e teste que aplica as migrações sobre um banco com dados e confere as contagens antes e depois. |
| RNF-02 | As telas alteradas seguem o protótipo (`prototype/atria-prototype.html`), salvo o alinhamento dos cards (resposta 2A). | Capturas do `apps/web/src/app/visual.e2e.ts` comparadas com o protótipo e revisão visual do usuário. |
| RNF-03 | As telas alteradas não têm violações de acessibilidade, nos temas claro e escuro. | Testes de componente com axe e o e2e de acessibilidade. |
| RNF-04 | As notas do Lighthouse das 11 telas principais continuam em 90 ou mais. | `pnpm --filter @atria/web lighthouse` no CI. |
| RNF-05 | O leitor mostra a primeira página de um PDF de 21 MB em até 3 s na rede local. | e2e que mede o tempo até a primeira página com um PDF de teste grande servido pelo servidor real. |
| RNF-06 | As correções visuais valem no Firefox (o usuário usa o Zen) e no Chromium. | Projeto e2e `firefox` no `playwright.config.ts` rodando os e2e das telas alteradas. |
| RNF-07 | Arrastar no quadro e no checklist funciona com mouse, toque e teclado. | Testes de componente com os sensores de teclado e e2e com toque emulado. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | As categorias padrão são criadas uma única vez por pessoa, como as emoções padrão; excluir uma categoria padrão não a recria. |
| RN-02 | "Sem categoria" grava a movimentação com `category_id` nulo. |
| RN-03 | O envio parcial de arquivos obedece às mesmas regras de dono do envio completo (RN-25 da SPEC-001): quem não é dono recebe 404. |
| RN-04 | Tarefa recorrente sem horário vale o dia inteiro na data da ocorrência; lembretes continuam exigindo horário. |
| RN-05 | Cada ocorrência de tarefa continua sendo concluída separadamente (RN-09 da SPEC-001); a lista mostra a próxima ocorrência não concluída a partir de hoje. |
| RN-06 | A preferência de tema do servidor prevalece sobre o valor guardado no navegador, que serve só para evitar o piscar ao abrir. |
| RN-07 | A intensidade da emoção continua opcional (RF-45 da SPEC-001). |
| RN-08 | Um destaque excluído some do leitor e das listas, mas continua no banco com `deleted_at` preenchido. |
| RN-09 | Dinheiro continua gravado em centavos inteiros (PD-62); a máscara é só de exibição. |

## Fluxos

### Fluxo principal

1. A pessoa abre `https://atria.local` sem sessão numa instância nova e cai no assistente da primeira vez; numa instância configurada, cai no login (RF-01).
2. Depois de entrar, abre o Financeiro e cria uma entrada com Repetir; o campo de valor formata o valor e a categoria oferece as categorias padrão ou "Sem categoria" (RF-11, RF-12, RF-13).
3. Ao salvar, vê o aviso com a data da primeira ocorrência, volta à lista, e a ocorrência aparece em "Próximas movimentações" do painel (RF-14, RF-15).
4. Abre um detalhe e usa o Voltar, que leva à listagem de origem (RF-03).
5. Cria uma tarefa recorrente sem horário e uma pontual para amanhã; ao salvar, vê o aviso; a lista mostra uma linha por tarefa, e a pontual de amanhã é anunciada se o período a esconder (RF-35, RF-37, RF-38).
6. Escreve no Diário escolhendo emoções por ícone e intensidade, e vê a entrada na linha do tempo em cartão (RF-19, RF-20, RF-21).
7. Cadastra um livro com capa e PDF, acompanha a barra de progresso e abre o leitor, que mostra a primeira página logo, em largura de leitura (RF-22, RF-26, RF-28, RF-29).
8. Cria um cartão de projeto com checklist e o move de raia arrastando (RF-33, RF-34).

### Fluxos alternativos

- **FA-01 (passo 1):** a sessão expira durante o uso; a próxima chamada responde 401 e o app leva ao login, voltando ao mesmo endereço depois de entrar (RF-02).
- **FA-02 (passo 2):** a pessoa excluiu todas as categorias; o campo mostra só "Sem categoria" e o link "Criar categoria" (RF-12).
- **FA-03 (passo 7):** o envio falha no meio; a barra para, aparece o aviso de erro e o botão volta a aceitar o envio (RF-26).
- **FA-04 (passo 8):** a pessoa usa teclado ou toque; o cartão é movido com os controles de teclado ou o arrastar por toque da biblioteca (RF-34).
- **FA-05 (passo 5):** a instância está com Web Push desligado; o cartão de notificações de Lembretes explica e, para quem administra, leva a Configurações › Instância (RF-16).

## Casos de borda

| ID | Situação | Comportamento esperado | Requisitos |
|---|---|---|---|
| CB-01 | A instância ainda não foi configurada e a pessoa abre `/finance` diretamente. | Vai para o assistente da primeira vez, sem chamar as APIs do Financeiro. | RF-01 |
| CB-02 | A primeira página aberta depois do login é um detalhe, sem listagem guardada. | O Voltar usa a listagem padrão do módulo (`fallback_to`). | RF-03 |
| CB-03 | A pessoa digita vírgula, apaga tudo ou cola `14500,5` no campo de valor. | O campo mostra `R$ 14.500,50`; vazio grava nada e mostra o erro de obrigatório. | RF-13 |
| CB-04 | Clique duplo em Salvar numa movimentação com Repetir. | Só uma recorrência é criada; o botão fica em carregando até a resposta. | RF-14, RF-25 |
| CB-05 | Uma tarefa recorrente semanal sem ocorrência nos próximos 7 dias. | A linha mostra a próxima ocorrência, vinda de `next_occurrence`, mesmo fora da janela. | RF-38 |
| CB-06 | Uma tarefa recorrente terminou (data de fim passada). | Não aparece entre as abertas; `next_occurrence` é nulo. | RF-38 |
| CB-07 | Navegador que não suporta Web Push. | O cartão diz que o navegador não oferece o aviso com o app fechado, em vez de pedir ao administrador. | RF-16 |
| CB-08 | O sistema muda de claro para escuro com "Seguir o sistema". | O app troca o tema na hora, sem recarregar. | RF-17 |
| CB-09 | Emoção personalizada criada antes da migração, sem ícone. | Mostra um ícone neutro padrão até a pessoa escolher outro. | RF-19 |
| CB-10 | Pedido de `Range` fora do tamanho do arquivo. | O servidor responde 416 com `Content-Range: bytes */<tamanho>`. | RF-27 |
| CB-11 | PDF pequeno, mais estreito que a largura de leitura. | O 100% mostra a página na largura de leitura, sem passar da largura do palco em telas estreitas. | RF-29 |
| CB-12 | Checklist com o campo vazio do fim preenchido só com espaços. | O item não é criado; o campo continua vazio no fim. | RF-33 |
| CB-13 | O cartão é solto na mesma raia em outra posição. | Só a ordem muda, pelo endpoint de mover. | RF-34 |
| CB-14 | Cabeçalho fixo com `prefers-reduced-motion`. | O fundo aparece sem transição. | RF-36 |
| CB-15 | Excluir a nota de um livro enquanto o leitor está aberto em outra aba. | A outra aba deixa de mostrar a nota ao recarregar a lista. | RF-31 |

## Contratos e interfaces

Mudanças na API (`/api/v1`), refletidas em `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`:

```text
GET /tasks
  cada tarefa ganha: "next_occurrence": "2026-11-07" | null
  (recorrente: a próxima data não concluída a partir de hoje; pontual: igual a due_on; terminada: null)

POST /tasks, PATCH /tasks/{id}
  recurrence.rule.time passa a ser opcional só em tarefas ("HH:MM" | ausente)
  lembretes e Financeiro continuam exigindo time

PATCH  /books/{id}/highlights/{highlight_id}       { "color": "accent" | "primary" | "success" | "warning" | "info" }  -> 200
DELETE /books/{id}/highlights/{highlight_id}       -> 204 (exclusão lógica)
PATCH  /articles/{id}/highlights/{highlight_id}    { "color": ... }  -> 200
DELETE /articles/{id}/highlights/{highlight_id}    -> 204

GET /emotions, POST /emotions, PATCH /emotions/{id}
  campo "icon": string | null  (chave de um conjunto fixo de ícones; nulo usa o ícone pelo system_key)

GET /categories
  campo "system_key": string | null  (categorias padrão, traduzidas na tela)

GET /files/{id} (arquivos de capa e PDF do Acervo)
  pedido:   Range: bytes=0-65535
  resposta: 206 Partial Content, Content-Range: bytes 0-65535/21000000, Accept-Ranges: bytes,
            Cache-Control: private, max-age=3600, ETag
  sem Range: 200 com Accept-Ranges: bytes; Range inválido: 416
```

Migrações (só acrescentam colunas):

```sql
-- apps/server/src/finance/migrations/20261102010001_add-categories-system-key.sql
ALTER TABLE categories ADD COLUMN system_key TEXT NULL;
-- apps/server/src/journal/migrations/20261102010002_add-emotions-icon.sql
ALTER TABLE emotions ADD COLUMN icon TEXT NULL;
-- apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql
ALTER TABLE highlights ADD COLUMN deleted_at TIMESTAMPTZ NULL;
```

Componentes da `@atria/ui`:

```ts
// ViewSwitcher: icon passa a ser obrigatório
interface ViewOption { value: string; label: string; icon: ReactNode }

// ícones de visualização
export { ListIcon, GridIcon, ShelfIcon, TableIcon, DayIcon, TimelineIcon } from './icons';

// diálogo genérico
interface DialogProps { open: boolean; title: string; onClose: () => void; children: ReactNode; actions: ReactNode }

// campo de moeda
interface MoneyFieldProps { label: string; value_cents: number | null; onChange: (cents: number | null) => void; error?: string }

// PeriodField no cabeçalho
interface PeriodFieldProps { /* ... */ label_visible?: boolean }  // false: rótulo só para leitor de tela
```

## Componentes afetados

| Caminho | Ação | Motivo |
|---|---|---|
| `apps/web/src/app/router.tsx` | alterar | Proteção das rotas autenticadas (Bug 1). |
| `apps/web/src/shared/session/current-user.ts` | alterar | Expor o estado sem sessão para a proteção (Bug 1). |
| `apps/web/src/shared/api/query-client.ts` | alterar | Levar ao login num 401 durante o uso (Bug 1). |
| `apps/web/src/features/auth/routes.tsx` | alterar | Reaproveitar a checagem de instância configurada e tirar do login quem já tem sessão (Bug 1). |
| `apps/web/src/shared/navigation/back-target.ts` | alterar | Guardar o endereço da própria listagem e ignorar destino igual à página atual (Bug 2). |
| `apps/web/src/shared/navigation/back-link.tsx` | alterar | Não navegar para a página atual (Bug 2). |
| `packages/ui/src/period-field/period-field.tsx` | alterar | Rótulo só para leitor de tela no cabeçalho (Bug 3). |
| `packages/ui/src/period-field/period-field.module.css` | alterar | Alinhamento do botão de período (Bug 3). |
| `apps/web/src/features/finance/components/finance-shell.tsx` | alterar | Usar o período sem rótulo visível (Bug 3). |
| `packages/ui/src/view-switcher/view-switcher.tsx` | alterar | Ícone obrigatório, centralizado e com dica (Bugs 4 e 6). |
| `packages/ui/src/view-switcher/view-switcher.module.css` | alterar | Centralizar o ícone e largura só das opções (Bugs 4 e 6). |
| `packages/ui/src/icons` | criar | Ícones de visualização compartilhados (Bugs 4 e 6). |
| `packages/ui/src/index.ts` | alterar | Exportar ícones, diálogo e campo de moeda novos. |
| `apps/web/src/features/finance/components/list-toolbar.tsx` | alterar | Ícones no seletor das listas do Financeiro (Bug 4). |
| `apps/web/src/features/finance/components/finance.module.css` | alterar | Tirar a largura mínima do seletor e esconder a tabela dos gráficos (Bugs 4 e 10). |
| `apps/web/src/features/tasks/screens/tasks-screen.tsx` | alterar | Ícones, filtros alinhados, aviso de tarefas fora do período e uma linha por tarefa (Bugs 4, 5, 29 e 30). |
| `apps/web/src/features/tasks/screens/tasks-screen.module.css` | alterar | Alinhar os filtros pela base (Bug 5). |
| `apps/web/src/features/reminders/screens/reminders-screen.tsx` | alterar | Ícones no seletor (Bug 4). |
| `apps/web/src/features/journal/journal-list-page.tsx` | alterar | Ícones no seletor e linha do tempo em cartões (Bugs 4 e 17). |
| `apps/web/src/features/journal/journal-list-page.module.css` | alterar | Visual da linha do tempo (Bug 17). |
| `apps/web/src/features/connections/connections-tab.tsx` | alterar | Agrupamento com seletor segmentado de texto (Bug 4). |
| `apps/web/src/features/goals/screens/goals-screen.tsx` | alterar | Usar os ícones compartilhados (Bug 6). |
| `apps/web/src/features/library/shelf-page.tsx` | alterar | Usar os ícones compartilhados (Bug 6). |
| `apps/web/src/features/admin/screens/users-screen.tsx` | alterar | Usar os ícones compartilhados (Bug 6). |
| `apps/web/src/features/notes/screens/notes-screen.tsx` | alterar | Usar os ícones compartilhados (Bug 6). |
| `apps/web/src/features/projects/icons.tsx` | alterar | Tirar as cópias de lista e grade (Bug 6). |
| `apps/web/src/features/projects/projects-list-page.tsx` | alterar | Usar os ícones compartilhados (Bug 6). |
| `apps/web/src/features/finance/components/panel-charts.tsx` | alterar | Tabela acessível dos gráficos sem texto solto (Bug 10). |
| `apps/web/src/features/finance/screens/finance-panel-screen.tsx` | alterar | Linhas pareadas e Próximas movimentações (Bugs 10 e 12). |
| `apps/web/src/features/finance/screens/finance-panel-screen.module.css` | alterar | Grade de linhas pareadas (Bug 10). |
| `apps/web/src/features/dashboard/screens/dashboard-screen.tsx` | alterar | Linhas pareadas no dashboard (Bug 11). |
| `apps/web/src/features/dashboard/components/dashboard.module.css` | alterar | Grade de linhas pareadas (Bug 11). |
| `apps/web/src/features/dashboard/blocks.ts` | alterar | Ordem dos blocos em linhas (Bug 11). |
| `apps/web/src/features/reports/report-result.tsx` | alterar | Mesma correção da tabela acessível dos gráficos (Bug 10). |
| `apps/server/src/finance/migrations/20261102010001_add-categories-system-key.sql` | criar | Chave das categorias padrão (Bug 7). |
| `apps/server/src/finance/application/categories.rs` | alterar | Criar as categorias padrão uma vez por pessoa (Bug 7). |
| `apps/server/src/finance/application/ports.rs` | alterar | Operações de contagem e criação em lote das categorias (Bug 7). |
| `apps/server/src/finance/infrastructure/pg_categories.rs` | alterar | Persistência das categorias padrão (Bug 7). |
| `apps/web/src/features/finance/screens/transaction-form-screen.tsx` | alterar | Sem categoria, link de criar, aviso ao salvar com Repetir (Bugs 7 e 9). |
| `apps/web/src/shared/forms/form-fields.tsx` | alterar | Opção vazia e estado vazio do `FormSelect` (Bug 7). |
| `packages/ui/src/money-field` | criar | Campo de moeda com máscara (Bug 8). |
| `apps/web/src/features/finance/components/money-field.tsx` | remover | Substituído pelo campo de moeda da `@atria/ui` (Bug 8). |
| `apps/web/src/features/finance/lib/money-input.ts` | alterar | Formatação com separador de milhar ao digitar (Bug 8). |
| `apps/server/src/finance/application/summaries.rs` | alterar | Próximas movimentações com entradas e saídas (Bug 12). |
| `apps/server/src/finance/domain/summary.rs` | alterar | Incluir entradas nas próximas movimentações (Bug 12). |
| `apps/web/src/features/finance/i18n/pt-br.json` | alterar | Textos novos do Financeiro (Bugs 7, 9 e 12). |
| `apps/web/src/features/reminders/push/use-web-push.ts` | alterar | Motivo da indisponibilidade do push (Bug 13). |
| `apps/web/src/features/reminders/components/notification-settings-card.tsx` | alterar | Aviso e caminho para ligar o push (Bug 13). |
| `apps/web/src/features/reminders/i18n/pt-br.json` | alterar | Textos do aviso de push (Bug 13). |
| `apps/web/src/app/theme/theme-provider.tsx` | alterar | Modo Seguir o sistema e preferência do servidor (Bug 14). |
| `apps/web/src/app/layout/sidebar.tsx` | alterar | Botão de tema grava a preferência (Bug 14). |
| `apps/web/src/app/providers.tsx` | alterar | Aplicar a preferência de tema ao abrir (Bug 14). |
| `apps/web/src/features/settings/use-user-preferences.ts` | alterar | Aplicar o tema sem gravar valor fixo (Bug 14). |
| `apps/web/src/features/settings/user-preferences-page.tsx` | alterar | Tema e espaçamento das preferências (Bugs 14 e 15). |
| `apps/web/src/features/settings/instance-settings-page.tsx` | alterar | Cartões com título na aba Instância (Bug 15). |
| `apps/web/src/features/settings/settings.module.css` | alterar | Espaçamento das abas de Configurações (Bug 15). |
| `apps/server/src/journal/migrations/20261102010002_add-emotions-icon.sql` | criar | Ícone das emoções personalizadas (Bug 16). |
| `apps/server/src/journal/domain/emotion.rs` | alterar | Campo de ícone da emoção (Bug 16). |
| `apps/server/src/journal/infrastructure/pg_emotion_repository.rs` | alterar | Persistir o ícone (Bug 16). |
| `apps/server/src/journal/interface/dto.rs` | alterar | Ícone nas respostas e pedidos de emoção (Bug 16). |
| `apps/web/src/features/journal/emotion-icons.tsx` | criar | Conjunto fixo de ícones de emoção (Bug 16). |
| `apps/web/src/features/journal/emotion-picker.tsx` | alterar | Seletor com botões, ícone e intensidade depois de marcar (Bug 16). |
| `apps/web/src/features/journal/emotion-picker.module.css` | alterar | Visual do seletor sem sobreposição (Bug 16). |
| `apps/web/src/features/journal/emotions-page.tsx` | alterar | Escolher o ícone da emoção personalizada (Bug 16). |
| `apps/web/src/features/library/cover-upload-field.tsx` | alterar | Área de capa como controle, sem botão interno (Melhoria 18). |
| `apps/web/src/features/library/library.module.css` | alterar | Estados de foco e hover da área de capa (Melhoria 18). |
| `packages/ui/src/tag-field/tag-field.module.css` | alterar | Espaçamento das etiquetas (Bug 19). |
| `packages/ui/src/button/button.tsx` | alterar | Indicador visível de carregando (Bug 20). |
| `packages/ui/src/button/button.module.css` | alterar | Estilo do carregando (Bug 20). |
| `apps/web/src/features/library/use-library-mutations.ts` | alterar | Envio com progresso e aviso de sucesso (Bug 20). |
| `apps/web/src/features/reports/report-page.tsx` | alterar | Padrão de carregando nos relatórios (Bug 20). |
| `apps/server/src/library/interface/files.rs` | alterar | Envio parcial dos arquivos (Bug 21). |
| `apps/server/src/library/interface/mod.rs` | alterar | Cabeçalhos de Range e cache, e rotas de destaque (Bugs 21 e 23). |
| `apps/server/src/storage/local.rs` | alterar | Leitura de um trecho do arquivo (Bug 21). |
| `apps/web/src/features/reader/load-pdf.ts` | alterar | Carregamento em partes do PDF (Bug 21). |
| `apps/web/src/features/reader/pdf-viewer.tsx` | alterar | 100% como largura de leitura (Bug 21). |
| `apps/web/src/features/reader/reader-page.tsx` | alterar | Níveis de zoom relativos à largura de leitura (Bug 21). |
| `packages/ui/src/dialog` | criar | Diálogo genérico com corpo e rodapé (Bug 22). |
| `packages/ui/src/confirm-dialog/confirm-dialog.tsx` | alterar | Montar sobre o diálogo genérico (Bug 22). |
| `apps/web/src/features/reader/session-offer-dialog.tsx` | alterar | Usar o diálogo genérico (Bug 22). |
| `apps/web/src/features/reader/reader.module.css` | alterar | Tirar o espaçamento próprio do diálogo (Bug 22). |
| `apps/web/src/features/finance/components/finance-dialog.tsx` | alterar | Usar o diálogo genérico (Bug 22). |
| `apps/web/src/features/projects/delete-lane-dialog.tsx` | alterar | Usar o diálogo genérico (Bug 22). |
| `apps/web/src/shared/forms/create-type-dialog.tsx` | alterar | Usar o diálogo genérico (Bug 22). |
| `apps/web/src/features/library/use-item-notes.ts` | alterar | Editar e excluir notas (Bug 23). |
| `apps/web/src/features/library/item-notes-tab.tsx` | alterar | Ações de editar e excluir notas (Bug 23). |
| `apps/server/src/library/migrations/20261102010003_add-highlights-deleted-at.sql` | criar | Exclusão lógica dos destaques (Bug 23). |
| `apps/server/src/library/domain/highlight.rs` | alterar | Trocar a cor e excluir o destaque (Bug 23). |
| `apps/server/src/library/application/mod.rs` | alterar | Casos de uso de editar e excluir destaque (Bug 23). |
| `apps/server/src/library/application/ports.rs` | alterar | Operações de destaque no repositório (Bug 23). |
| `apps/server/src/library/infrastructure/pg_item_notes.rs` | alterar | Persistência de editar e excluir destaque (Bug 23). |
| `apps/server/src/library/interface/books.rs` | alterar | Handlers de destaque de livro (Bug 23). |
| `apps/server/src/library/interface/articles.rs` | alterar | Handlers de destaque de artigo (Bug 23). |
| `apps/server/src/library/interface/dto.rs` | alterar | Pedido de troca de cor (Bug 23). |
| `apps/server/src/library/interface/openapi.rs` | alterar | Documentar as rotas novas (Bugs 21 e 23). |
| `apps/web/src/features/reader/use-highlights.ts` | alterar | Editar e excluir destaques (Bug 23). |
| `apps/web/src/features/reader/highlights-tab.tsx` | alterar | Ações nos destaques (Bug 23). |
| `apps/web/package.json` | alterar | Adicionar a biblioteca de arrastar (dnd-kit) (Melhorias 24 e 26). |
| `apps/web/src/features/projects/checklist-field.tsx` | criar | Checklist em lista com arrastar (Melhoria 24). |
| `apps/web/src/features/projects/card-form-page.tsx` | alterar | Usar o checklist novo (Melhoria 24). |
| `apps/web/src/features/projects/use-kanban.ts` | alterar | Tirar a conversão do texto do checklist (Melhoria 24). |
| `apps/web/src/features/projects/kanban-card.tsx` | alterar | Tirar o seletor de raia e arrastar pela biblioteca (Melhoria 26). |
| `apps/web/src/features/projects/kanban-lane.tsx` | alterar | Soltar cartões pela biblioteca (Melhoria 26). |
| `apps/web/src/features/projects/kanban-board-page.tsx` | alterar | Contexto de arrastar do quadro (Melhoria 26). |
| `apps/web/src/features/projects/projects.module.css` | alterar | Estilos de arrastar e alça (Melhorias 24 e 26). |
| `apps/server/src/shared/recurrence.rs` | alterar | Horário opcional na regra, exigido por lembretes e Financeiro (Melhoria 27). |
| `apps/server/src/tasks/interface/dto.rs` | alterar | Regra sem horário e `next_occurrence` (Melhoria 27 e Bug 30). |
| `apps/server/src/tasks/domain/schedule.rs` | alterar | Ocorrência sem horário vale o dia inteiro (Melhoria 27). |
| `apps/server/src/tasks/application/tasks.rs` | alterar | Calcular `next_occurrence` na listagem (Bug 30). |
| `apps/web/src/features/tasks/screens/task-form-screen.tsx` | alterar | Horário opcional e aviso ao salvar (Melhoria 27 e Bug 29). |
| `apps/web/src/features/tasks/hooks/use-tasks.ts` | alterar | Uma linha por tarefa e sem duplicar a pontual (Bug 30). |
| `apps/web/src/features/tasks/components/task-item.tsx` | alterar | Mostrar a próxima ocorrência (Bug 30). |
| `apps/web/src/features/tasks/screens/task-screen.tsx` | alterar | Listar as próximas ocorrências no detalhe (Bug 30). |
| `apps/web/src/shared/layout/sticky-page-header.tsx` | alterar | Fundo de ponta a ponta medido pela área de rolagem (Bug 28). |
| `apps/web/src/shared/layout/sticky-page-header.module.css` | alterar | Fundo tingido com desfoque e máscara do protótipo (Bug 28). |
| `packages/ui/src/page-header/page-header.tsx` | alterar | Estado compacto do cabeçalho (Bug 28). |
| `packages/ui/src/page-header/page-header.module.css` | alterar | Estilos do cabeçalho compacto (Bug 28). |
| `apps/web/src/shared/layout/form-screen.module.css` | alterar | Cabeçalho fixo nos formulários de 880 px (Bugs 9, 16, 25 e 28). |
| `packages/contracts/openapi.json` | alterar | Contrato gerado com as mudanças da API. |
| `packages/contracts/src/schema.ts` | alterar | Tipos gerados a partir do contrato. |
| `apps/web/playwright.config.ts` | alterar | Projeto e2e em Firefox (RNF-06). |

## Premissas e dependências

- A SPEC-001 está finalizada e o Atria roda em produção em `https://atria.local`, com backup diário em `~/backups/atria`.
- O protótipo `prototype/atria-prototype.html` e `docs/decisoes-do-prototipo.md` continuam sendo a referência visual (DEC-007).
- O servidor já tem PATCH e DELETE de notas de livros, artigos e vídeos e de sessões de leitura (`apps/server/src/library/interface/mod.rs`).
- O servidor já guarda o checklist em itens (`project_card_checklist_items`) e já tem o endpoint de mover cartão.
- O dnd-kit é adicionado como dependência do `apps/web` (resposta 7A).
- Publicar as correções em produção segue os Detalhes Técnicos do rascunho (enviar o commit, `docker compose build`, `docker compose up -d`).

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Uma migração quebrar a subida com dados reais. | alto | Migrações só com `ADD COLUMN` nulo, teste sobre banco com dados e backup antes do deploy. |
| Linhas pareadas mudarem o desenho aprovado e desagradarem. | médio | Exceção registrada à PD-25 e revisão visual do usuário antes de concluir. |
| O fundo com desfoque sumir no build, como na ISS-001. | médio | Escrever só `backdrop-filter`, teste que lê o CSS gerado e e2e no Firefox e no Chromium. |
| A proteção de rotas criar laço de redirecionamento entre login e assistente. | alto | Rotas `bare` fora da proteção e teste e2e dos três estados: sem instância, sem sessão e com sessão. |
| O dnd-kit aumentar o bundle além do aviso de 500 kB. | baixo | Carregar o quadro e o formulário de cartão sob demanda e conferir o Lighthouse. |
| Envio parcial expor arquivos de outra pessoa. | alto | Reaproveitar a checagem de dono do envio completo e teste de 404 para quem não é dono. |
| Escopo grande demais para uma spec. | médio | Plano em ondas por área (compartilhados, Financeiro, Tarefas, Acervo e leitor, Diário, Projetos), com tarefas paralelas. |

## Casos de teste

| ID | Cenário | Passos | Resultado esperado | Requisitos |
|---|---|---|---|---|
| CT-01 | Rota autenticada sem sessão | Instância nova; abrir `/` e `/finance` sem cookie. | Vai ao assistente; numa instância configurada, ao login; nenhuma tela autenticada aparece. | RF-01 |
| CT-02 | Sessão expira no uso | Com sessão, apagar a sessão no servidor e navegar. | Vai ao login e, depois de entrar, volta ao endereço anterior. | RF-02 |
| CT-03 | Voltar a partir do detalhe | Abrir a lista de contas, abrir a Conta principal, clicar Voltar. | Volta à lista de contas, nas 10 listagens. | RF-03 |
| CT-04 | Período no cabeçalho | Abrir o Financeiro no desktop. | O botão de período fica alinhado a Relatórios e Novo registro, sem rótulo visível e com nome acessível. | RF-04 |
| CT-05 | Seletor de visualização | Renderizar o `ViewSwitcher` e abrir as 10 telas que o usam. | Só ícones, centralizados, com `title` e `aria-label`; sem largura sobrando; opção sem ícone não compila. | RF-05, RF-06 |
| CT-06 | Agrupamento de Conexões | Abrir a aba Conexões de um item. | O agrupamento usa o seletor segmentado com texto. | RF-07 |
| CT-07 | Filtros de Tarefas | Abrir Tarefas no desktop. | Busca, selects, etiqueta e seletor ficam com a mesma base. | RF-08 |
| CT-08 | Cards pareados | Abrir o painel do Financeiro e o dashboard no desktop, com e sem o card de Cartões. | Cards lado a lado com a mesma altura e topos e bases alinhados. | RF-09 |
| CT-09 | Tabela acessível dos gráficos | Abrir o painel do Financeiro no Firefox. | Nenhum texto do caption aparece; o leitor de tela lê a tabela. | RF-10 |
| CT-10 | Categorias padrão | Primeira abertura do Financeiro por uma pessoa nova; excluir uma padrão e abrir de novo. | As categorias padrão existem uma vez; a excluída não volta. | RF-11 |
| CT-11 | Campo Categoria | Abrir Nova entrada com e sem categorias. | Começa em Sem categoria, grava `category_id` nulo, mostra o link Criar categoria. | RF-12 |
| CT-12 | Máscara de moeda | Digitar 14500 e colar 14500,5 nos 4 campos de valor. | Mostra R$ 14.500,00 e R$ 14.500,50 e grava 1450000 e 1450050 centavos. | RF-13 |
| CT-13 | Salvar com Repetir | Criar entrada com Repetir; clicar Salvar duas vezes rápido. | Uma recorrência criada, aviso com a data da primeira ocorrência e volta à lista. | RF-14 |
| CT-14 | Próximas movimentações | Criar uma entrada recorrente para daqui a 7 dias. | Aparece em Próximas movimentações do painel, como no dashboard. | RF-15 |
| CT-15 | Aviso de push desligado | Com Web Push desligado, abrir Lembretes como pessoa comum e como administrador. | Aparece o aviso; o administrador vê o link para Configurações › Instância. | RF-16 |
| CT-16 | Tema | Escolher claro pelo botão, abrir Configurações; trocar para Seguir o sistema e mudar o tema do sistema. | Abrir Configurações não muda o tema; Seguir o sistema acompanha a mudança na hora. | RF-17 |
| CT-17 | Configurações da instância | Abrir as 4 abas de Configurações. | Grupos em cartões com título e espaçamento do protótipo. | RF-18 |
| CT-18 | Ícones das emoções | Abrir o seletor e a tela de Emoções; criar emoção com ícone. | As padrão têm ícone pela chave; a nova grava e mostra o ícone escolhido. | RF-19 |
| CT-19 | Seletor de emoções | Criar entrada marcando Ansiedade com intensidade 3, a 360 px e 1280 px. | Sem sobreposição; a intensidade aparece só depois de marcar; sem intensidade também grava. | RF-20 |
| CT-20 | Linha do tempo | Abrir o Diário em Linha do tempo com entrada de várias emoções. | Cada entrada num cartão, com ícone e intensidade de cada emoção. | RF-21 |
| CT-21 | Área de capa | Clicar, focar com Tab e Enter, e arrastar imagem na área de capa dos 3 formulários. | A área abre o seletor e aceita o arrasto; não há botão interno. | RF-22 |
| CT-22 | Campo de etiquetas | Adicionar uma etiqueta num formulário. | Etiquetas e ajuda com o espaçamento do protótipo. | RF-23 |
| CT-23 | Levantamento das ações demoradas | Conferir o documento do levantamento na tarefa. | Cada ação demorada listada com o padrão aplicado. | RF-24 |
| CT-24 | Botão carregando | Clicar Salvar numa ação lenta. | Indicador visível, `aria-busy`, segundo clique ignorado. | RF-25 |
| CT-25 | Progresso do envio | Salvar livro com PDF de 21 MB. | Barra de progresso até 100% e aviso de sucesso; falha mostra erro. | RF-26 |
| CT-26 | Envio parcial | Pedir `GET /files/{id}` com `Range: bytes=0-65535`, sem Range e com Range inválido, como dono e como outra pessoa. | 206 com Content-Range; 200 com Accept-Ranges; 416; 404 para quem não é dono. | RF-27 |
| CT-27 | Primeira página rápida | Abrir no leitor um PDF de 21 MB. | A primeira página aparece antes de baixar o arquivo inteiro, em até 3 s na rede local. | RF-28 |
| CT-28 | Zoom 100% | Abrir o leitor a 1920 px e a 360 px. | A 1920 px a página tem até cerca de 960 px; a 360 px cabe na tela. | RF-29 |
| CT-29 | Diálogo genérico | Abrir o diálogo de sessão de leitura e os demais diálogos. | Mesmo espaçamento do protótipo entre conteúdo e ações. | RF-30 |
| CT-30 | Notas do item | Editar e excluir uma nota de livro, de artigo e de vídeo. | A nota muda ou some da lista. | RF-31 |
| CT-31 | Destaques | Trocar a cor e excluir um destaque de livro e de artigo. | A cor muda; o excluído some do leitor e da lista e fica com `deleted_at`. | RF-32 |
| CT-32 | Checklist | Criar cartão com 3 itens por Enter, marcar um, remover um e reordenar pela alça, por mouse e teclado. | O cartão grava os itens na ordem e estado mostrados. | RF-33 |
| CT-33 | Mover cartão | Arrastar cartão entre raias com mouse, toque emulado e teclado. | O cartão muda de raia; a face do cartão não tem seletor. | RF-34 |
| CT-34 | Tarefa sem horário | Criar tarefa recorrente diária sem horário. | Salva; cada ocorrência vale o dia inteiro; lembrete sem horário continua recusado. | RF-35 |
| CT-35 | Cabeçalho fixo | Rolar um formulário e uma lista no Chromium e no Firefox. | Fundo tingido com desfoque na largura toda da área da página; o conteúdo não se mistura ao texto. | RF-36 |
| CT-36 | Tarefa fora do período | Criar tarefa pontual para amanhã com a lista em Hoje. | Aviso de sucesso; a lista avisa que há tarefas em outros dias e troca o período. | RF-37 |
| CT-37 | Uma linha por tarefa | Criar recorrente diária, semanal e uma pontual; abrir a lista em Todas. | Uma linha por tarefa, com a próxima ocorrência; a pontual aparece uma vez. | RF-38 |

## Critérios de aceite

- [ ] CA-01: Sem sessão, nenhuma tela autenticada aparece; o app leva ao assistente ou ao login (RF-01, RF-02).
- [ ] CA-02: O Voltar leva à listagem de origem em todas as telas (RF-03).
- [ ] CA-03: Período, seletores de visualização e filtros de Tarefas ficam alinhados e com ícones compartilhados (RF-04, RF-05, RF-06, RF-07, RF-08).
- [ ] CA-04: Painel do Financeiro e dashboard com cards pareados e sem texto solto (RF-09, RF-10).
- [ ] CA-05: O Financeiro oferece categorias padrão, Sem categoria e máscara de moeda (RF-11, RF-12, RF-13).
- [ ] CA-06: Uma entrada recorrente criada é anunciada e aparece em Próximas movimentações, sem duplicar no clique duplo (RF-14, RF-15).
- [ ] CA-07: Lembretes explica quando o aviso com o app fechado está desligado (RF-16).
- [ ] CA-08: Abrir Configurações não muda o tema, e Seguir o sistema acompanha o sistema (RF-17).
- [ ] CA-09: Configurações, etiquetas e diálogos seguem o espaçamento do protótipo (RF-18, RF-23, RF-30).
- [ ] CA-10: Emoções têm ícone, o seletor não sobrepõe e a linha do tempo mostra cartões com intensidade (RF-19, RF-20, RF-21).
- [ ] CA-11: A área de capa é o controle de escolha, sem botão interno (RF-22).
- [ ] CA-12: Ações demoradas mostram carregando, progresso e aviso, conforme o levantamento (RF-24, RF-25, RF-26).
- [ ] CA-13: O leitor abre a primeira página logo e o 100% usa a largura de leitura (RF-27, RF-28, RF-29).
- [ ] CA-14: Notas e destaques podem ser editados e excluídos (RF-31, RF-32).
- [ ] CA-15: Checklist em lista e quadro com arrastar por mouse, toque e teclado (RF-33, RF-34).
- [ ] CA-16: Tarefas aceitam recorrência sem horário, avisam ao salvar e mostram uma linha por tarefa (RF-35, RF-37, RF-38).
- [ ] CA-17: O cabeçalho fixo tem fundo com desfoque de ponta a ponta e nenhum formulário fica com o texto sobreposto (RF-36).

## Referências

| Tipo | Referência | Uso |
|---|---|---|
| arquivo | `vostok/work/specs/draft/SPEC-002-correcoes-do-uso-real-do-mvp.md` | Os 30 relatos do usuário. |
| arquivo | `vostok/work/.archive/SPEC-001/spec.md` | Regras e contratos do MVP (RF-39, RF-45, RN-09, RN-25). |
| arquivo | `prototype/atria-prototype.html` | Cabeçalho fixo, seletor, barra de filtros, diálogo, área de capa e campo de etiquetas. |
| arquivo | `docs/decisoes-do-prototipo.md` | PD-20 (cabeçalho fixo), PD-25 e PD-58 (cards), PD-62 (dinheiro). |
| arquivo | `apps/web/src/app/router.tsx` | Ausência de proteção das rotas (Bug 1). |
| arquivo | `apps/web/src/shared/navigation/back-target.ts` | Causa do Voltar (Bug 2). |
| arquivo | `apps/web/src/shared/layout/sticky-page-header.module.css` | Fundo do cabeçalho fixo (Bug 28). |
| arquivo | `apps/web/src/features/tasks/hooks/use-tasks.ts` | Linhas por ocorrência e pontual duplicada (Bugs 29 e 30). |
| arquivo | `apps/server/src/shared/recurrence.rs` | Horário obrigatório na regra (Melhoria 27). |
| arquivo | `apps/server/src/finance/domain/forecast.rs` | Projeção da ocorrência aberta (Bugs 9 e 12). |
| arquivo | `apps/server/src/library/interface/mod.rs` | Rotas de arquivos, notas e destaques (Bugs 21 e 23). |
| arquivo | `apps/web/src/features/projects/kanban-card.tsx` | Seletor de raia e arrastar nativo (Melhoria 26). |
| memória | DEC-002, DEC-003, DEC-006, DEC-007 | Protótipo como fonte, recorrência do Financeiro, recorrência de tarefas e fidelidade visual. |
| memória | ISS-001 | Minificador apaga o `backdrop-filter` no build. |
| documentação | Logs do servidor e banco de produção (31/10/2026) | 401 no Bug 1, 3 recorrências no Bug 9, push pulado no Bug 13, tarefa no banco no Bug 29. |

## O que mudou

| # | Assunto | Estado no Original | Estado Refinado |
|---|---|---|---|
| 1 | Tipo | Correção (fix) | improvement, com as melhorias no mesmo documento (resposta 1A). |
| 2 | Hipótese do zoom (Bug 21) | 100% era a escala 1 do PDF | 100% já ajusta à largura do palco; passa a ser a largura de leitura. |
| 3 | Notas do Acervo (Bug 23) | Faltavam editar e excluir no servidor | O servidor já tem; falta a tela, e os destaques precisam de servidor. |
| 4 | Pontual duplicada (Bug 30) | Suposição de ocorrência gravada | Erro de junção na tela, em `buildRows`. |
| 5 | Categorias (Bug 7) | Lista vazia | Categorias padrão criadas uma vez por pessoa (resposta 3A). |
| 6 | Recorrência do Financeiro (Bugs 9 e 12) | Hipótese de entrada invisível | Aviso ao salvar e Próximas movimentações com entradas (resposta 4A). |
| 7 | Recorrência de tarefas (Bug 30) | Como no Financeiro | Uma linha com a próxima ocorrência, sem estado de atrasada (resposta 5A). |
| 8 | Cards (Bugs 10 e 11) | Desalinhados | Linhas pareadas, exceção à PD-25 (resposta 2A). |
| 9 | Critérios de aceite | Vazio | 17 critérios ligados aos requisitos. |

## Registro de decisões

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Tipo improvement, numa spec só | fix com as melhorias em outra spec | resposta 1A |
| 2 | Cards em linhas pareadas, exceção à PD-25 | Manter o protótipo | resposta 2A |
| 3 | Categorias padrão de entrada e saída | Só estado vazio | resposta 3A |
| 4 | Aviso ao salvar e Próximas movimentações | Só o aviso | resposta 4A |
| 5 | Uma linha por tarefa com `next_occurrence` | Estado de atrasada como no Financeiro | resposta 5A |
| 6 | Envio parcial e cache, sem compressão | Compressão ao salvar | resposta 6A |
| 7 | dnd-kit no quadro e no checklist | Arrastar nativo com menu e botões | resposta 7A |
| 8 | Ícone para todas as emoções e seletor novo | Ícone só nas padrão | resposta 8A |
| 9 | Proteção das rotas autenticadas | Tratar o 401 em cada tela | inferência A |
| 10 | Listagem guarda o próprio endereço | Trocar o Voltar pelo histórico do navegador | inferência B |
| 11 | Ícones compartilhados e obrigatórios; Conexões com seletor segmentado | Ícones por tela | inferência C |
| 12 | Máscara ao digitar na `@atria/ui` | Formatar só ao sair do campo | inferência D |
| 13 | Preferência do servidor como fonte do tema | Tema só no navegador | inferência E |
| 14 | Carregando, progresso e aviso; levantamento primeiro | Corrigir só o livro | inferência F |
| 15 | 100% como largura de leitura de cerca de 960 px | Ajuste pela altura da página | inferência G |
| 16 | Destaques com exclusão lógica | Exclusão definitiva | inferência H |
| 17 | Horário opcional só nas tarefas | Horário opcional em todas as regras | inferência I |
| 18 | Cabeçalho com fundo de ponta a ponta resolve os sobrepostos | Corrigir cada formulário | inferência J |
| 19 | Aviso de tarefas fora do período | Mudar o período padrão | inferência K |
| 20 | Diálogo genérico na `@atria/ui` | Corrigir só o diálogo da sessão | inferência L |
| 21 | Limpeza de dados e deploy fora do escopo | Incluir operação na spec | inferência M |

## Pendências

| # | Pendência | Opções em aberto |
|---|---|---|
| - | Nenhuma | - |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
