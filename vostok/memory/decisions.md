---
type: decision
title: "Decisões"
description: "Decisões estruturantes do projeto e o motivo de cada uma. Consulte antes de decidir algo que afete arquitetura, stack, dados, contratos ou convenções, e quando houver ambiguidade."
updated_at: 2026-11-02T09:46:18Z
---

# Decisões

Decisões estruturantes do projeto e o motivo de cada uma. Consulte antes de decidir algo que afete arquitetura, stack, dados, contratos ou convenções, e quando houver ambiguidade.

Entradas criadas por `vostok memory add` e consultadas por `vostok memory search`. Não carregue este arquivo inteiro.

## DEC-001: Botões com o mesmo raio dos campos

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** identidade-visual, ui, componentes, ishtar-sink, raio
- **Origem:** Pedido do usuário em 2026-10-30, na correção do protótipo da TASK-01 (SPEC-001).
- **Contexto:** Os botões em pill contrastavam com os campos de 12 px no protótipo. Os componentes de `packages/ui` vão virar a biblioteca compartilhada do Ishtar Sink.
- **Decisão:** Botões, grupos de botões e seletores usam `radius.md` (12 px), o mesmo dos campos de formulário. `radius.pill` fica só para badges, chips, barras de progresso e elementos circulares. Vale como padrão do Ishtar Sink.
- **Alternativas descartadas:** Manter botões em pill (contrastam com os campos); usar `radius.sm` (8 px) em botões e campos (mudaria também os campos).
- **Consequências:** Ajustar `docs/identidade-ecossistema.md` de `Ishtar-Sink/.github` (linha "pill para badges e botões redondos" e bloco para colar). Nebula e Translunar migram quando for conveniente; botões em pill passam a ser legado.
- **Substitui:** Nenhuma

## DEC-002: Decisões do protótipo valem também para o servidor

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** prototipo, servidor, financeiro, recorrencia, projetos, acervo, relatorios, mvp
- **Origem:** Decisão do usuário em 2026-10-30, durante a onda 4 da SPEC-001, ao ver as contradições da TASK-07 com o protótipo ("todos são importantes").
- **Contexto:** As tarefas de servidor da SPEC-001 foram detalhadas antes das decisões do protótipo (docs/decisoes-do-prototipo.md) e várias as contradizem: PD-51 (recorrência), PD-55/PD-58 (painel e período do Financeiro), PD-49 (categorias por tipo), PD-12, PD-43 e PD-46 (projetos), PD-36 e PD-60 (acervo), PD-61 (relatórios).
- **Decisão:** O servidor segue as decisões do protótipo já, ajustando spec e tarefas; os subagentes refazem só as partes atingidas. Entram no MVP: capas por upload em livro e artigo (PD-36), campos novos do cartão de projeto (PD-46), comparação com o período anterior e "Para onde foi" (PD-58) e os nove relatórios com filtros por entidade (PD-61). PD-43: cada raia tem a marcação "conta como concluída".
- **Alternativas descartadas:** Deixar a adequação para a TASK-18; levar as PDs para uma spec seguinte ao MVP; "Pronto" como última raia (PD-43).
- **Consequências:** A TASK-14 foi interrompida para ser ajustada. TASK-07, TASK-13, TASK-14 e TASK-17 precisam de ajuste, e a TASK-22 e as telas seguem as PDs. Como a SPEC-001 está planned, o harness não permite ajustá-la (adjust-spec-01); o que exige mudar a spec segue o caminho decidido pelo usuário.
- **Substitui:** Nenhuma

## DEC-003: Recorrência atrasada e tarefa ligada ao cartão

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** financeiro, recorrencia, projetos, cartao, links
- **Origem:** Decisão do usuário em 2026-10-30, no ajuste das tarefas de servidor da SPEC-001 às decisões do protótipo (DEC-002).
- **Contexto:** A PD-51 não dizia o que acontece com a ocorrência do mês não liquidada, e a PD-46 não dizia como gravar a tarefa ligada ao cartão.
- **Decisão:** PD-51: a ocorrência não liquidada continua aberta e fica atrasada até ser liquidada ou pulada; só então a recorrente passa para o mês seguinte. Períodos futuros mostram a previsão calculada pela regra, sem gravar linhas. PD-46: a tarefa ligada ao cartão é uma ligação do contexto links (project_card com task), sem chave entre contextos, e aparece também na aba Conexões.
- **Alternativas descartadas:** Avançar sozinha na virada do mês, deixando uma cópia atrasada; guardar no cartão o id de uma tarefa.
- **Consequências:** TASK-07 troca a materialização até uma data pela ocorrência única com cópia liquidada e projeção virtual; TASK-14 não cria campo de tarefa no cartão e lê a ligação pelo links; TASK-30 mostra a tarefa ligada a partir das ligações.
- **Substitui:** Nenhuma

## DEC-004: Período livre, exclusão da cópia liquidada, relatórios e retomada da leitura

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** financeiro, periodo, recorrencia, relatorios, acervo, leitura
- **Origem:** Decisão do usuário em 2026-10-30, nas pendências dos ajustes das TASK-07, TASK-13 e TASK-17 da SPEC-001 (DEC-002).
- **Contexto:** Os ajustes às decisões do protótipo deixaram quatro pontos sem definição: o preset "Qualquer período" no resumo, a exclusão da cópia liquidada de uma recorrente, os filtros e o período dos relatórios e a retomada da leitura pela sessão.
- **Decisão:** (1) Sem De e Até, o resumo do Financeiro vai da primeira movimentação até hoje, sem comparação com o período anterior. (2) Excluir a última cópia liquidada de uma recorrente reabre aquela ocorrência e reverte o saldo. (3) Os relatórios seguem o protótipo: filtros de tipo (Acervo por status) e de situação (Progresso das metas), e Acervo por status, Progresso das metas, Tarefas concluídas e abertas e Cartões por raia sem período. (4) A página onde a leitura retoma muda só pelo modo leitura; a sessão de leitura não a altera.
- **Alternativas descartadas:** Exigir sempre De e Até; só reverter o saldo ao excluir a cópia; período obrigatório em todos os relatórios e sem os dois filtros; a sessão atualizar a retomada quando avançar.
- **Consequências:** TASK-07 e TASK-17 recebem mais um ajuste; TASK-13 fica como está; TASK-22 e TASK-34 seguem o mesmo.
- **Substitui:** Nenhuma

## DEC-005: Financeiro: edição, desfazer liquidação, cópias e busca

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** financeiro, contrato, liquidacao, recorrencia, busca
- **Origem:** Decisão do usuário em 2026-10-30, no ajuste da TASK-22 às decisões do protótipo (DEC-002).
- **Contexto:** As telas do Financeiro no protótipo editam movimentações, desfazem a liquidação, mostram as cópias liquidadas de uma recorrente e buscam por texto; o contrato da TASK-07 não tinha nada disso.
- **Decisão:** A TASK-07 passa a oferecer: edição de movimentação, desfazer liquidação (revertendo o saldo e, na cópia de recorrente, reabrindo a ocorrência como na DEC-004), listagem das cópias liquidadas de uma recorrente e busca por texto nas listagens.
- **Alternativas descartadas:** Só editar e desfazer; as telas seguirem só o contrato que já existia.
- **Consequências:** A TASK-07 recebe o ajuste 3 durante a reimplementação; a TASK-22 consome os contratos novos.
- **Substitui:** Nenhuma

## DEC-006: Etiquetas em metas e tarefas, visibilidade, telas de auth e recorrência de tarefas

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** metas, tarefas, etiquetas, visibilidade, auth, recorrencia, ui
- **Origem:** Decisão do usuário em 2026-10-30, nas pendências do ajuste das telas da SPEC-001 às decisões do protótipo (DEC-002).
- **Contexto:** O ajuste das telas encontrou diferenças entre o protótipo e as tarefas: etiquetas em Metas e Tarefas sem campo no servidor, o botão de visibilidade acima das abas, telas públicas de auth fora do protótipo e a recorrência de tarefas mais simples no protótipo.
- **Decisão:** (1) Metas e Tarefas ganham etiquetas no servidor (TASK-08 e TASK-09), e Metas o filtro por prazo; as telas usam o campo de etiquetas da base. (2) Sai o botão de alternar visibilidade acima das abas; a visibilidade muda pelo formulário e aparece no cartão Registro. (3) Login, cadastro e redefinir senha usam um cartão estreito (cerca de 400 px) centralizado, com os componentes da base, sem a grade de 880 px. (4) Tarefas recorrentes oferecem a regra completa na tela, com o mesmo editor dos lembretes e do Financeiro.
- **Alternativas descartadas:** Tirar as etiquetas das telas; manter o botão de visibilidade; grade de 880 px nas telas de auth; só Pontual e Diária.
- **Consequências:** TASK-08 e TASK-09 recebem ajuste e reimplementação parcial; TASK-17, TASK-19, TASK-23, TASK-24, TASK-35 e TASK-33 são ajustadas.
- **Substitui:** Nenhuma

## DEC-007: Visual do app idêntico ao protótipo, inclusive o logo

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** identidade-visual, ui, prototipo, logo, frontend
- **Origem:** Pedido do usuário em 2026-10-30, ao abrir a base do frontend (TASK-05) no navegador.
- **Contexto:** A base do frontend saiu com logo, rótulos, links e formulários diferentes do protótipo HTML validado (TASK-01).
- **Decisão:** O app usa o mesmo visual do prototype/atria-prototype.html, incluindo o logo (brand-mark com o SVG de traço e o nome com o gradiente da marca): tokens, tipografia, espaçamentos, componentes e telas seguem o protótipo. Divergência só com motivo registrado.
- **Alternativas descartadas:** Usar o protótipo só como referência de fluxo, com o visual livre da biblioteca.
- **Consequências:** A TASK-05 recebe um ajuste de fidelidade visual (pode alterar packages/theme); as tarefas de tela da onda 7 conferem as telas contra o protótipo.
- **Substitui:** Nenhuma

## DEC-008: Preferência do botão de criar e editor de recorrência na base do frontend

- **Data:** 2026-10-30
- **Status:** ativa
- **Tags:** frontend, componentes, preferencias, recorrencia, onda-7
- **Origem:** Decisão do usuário em 2026-10-30 ("sim, mover"), nas pendências do ajuste das telas da SPEC-001.
- **Contexto:** A preferência "Opções do botão de criar" (PD-10) ficou na TASK-33, mas é lida por telas da mesma onda (TASK-22, TASK-28); e o editor da regra de recorrência estava em três cópias iguais (TASK-22, TASK-24, TASK-25). Tarefas da mesma onda não dividem arquivos.
- **Decisão:** Os dois vão para a base do frontend (TASK-05): a preferência create_layout no preferences-context, e o editor da regra de recorrência como componente de apps/web/src/shared/forms. As telas importam da base. O diálogo de escolha do tipo ao criar (PD-09), usado no Financeiro e no Acervo, vai junto pelo mesmo motivo.
- **Alternativas descartadas:** Manter a preferência na feature de Configurações e uma cópia do editor por tela.
- **Consequências:** TASK-05 recebe o ajuste 5 e a implementação; TASK-22, TASK-24, TASK-25, TASK-28 e TASK-33 passam a importar da base.
- **Substitui:** Nenhuma

## DEC-009: Telas da onda 7: CSS por feature e contratos pelo pacote

- **Data:** 2026-10-31
- **Status:** ativa
- **Tags:** frontend, css, contracts, onda-7, telas, packages-ui
- **Origem:** Escolha do usuário em 2026-10-31, nas perguntas da TASK-22 durante a execução da onda 7 da SPEC-001.
- **Contexto:** As tarefas de tela não listavam `.module.css` em "Mudar" e `apps/web/package.json` não declarava `@atria/contracts`, embora 15 telas usem os tipos da API; o `MenuItem` de `packages/ui` não tem item desabilitado.
- **Decisão:** (1) A TASK-22 é ajustada para declarar `"@atria/contracts": "workspace:*"` em `apps/web/package.json` e rodar `pnpm install`, servindo a todas as telas; as features importam os tipos de `@atria/contracts`. (2) Módulos CSS são permitidos dentro da pasta da própria feature, só com tokens do tema. (3) Ação indisponível de menu sai do menu e a explicação aparece na tela, sem mudar `packages/ui` (ex.: "Excluir" da conta padrão).
- **Alternativas descartadas:** Tipos locais por feature até a TASK-35 (contraria [project/api-02]); só estilo inline (sem media query); acrescentar `disabled` ao `MenuItem` de `packages/ui`.
- **Consequências:** Telas que já usaram tipos locais ou import relativo de `packages/contracts` (TASK-19, 20, 23, 24) devem passar a importar de `@atria/contracts`; a finalização de cada tela confere isso. Módulos CSS fora de "Mudar" dentro da feature não são desvio de escopo.
- **Substitui:** Nenhuma.

## DEC-010: Dias de fora do mês do calendário fiéis ao protótipo

- **Data:** 2026-10-31
- **Status:** ativa
- **Tags:** #frontend #calendario #acessibilidade #prototipo
- **Origem:** Usuário, no chat de 31/10/2026, durante as evidências visuais automáticas da onda 7 (TASK-24 e TASK-25)
- **Contexto:** O axe acusou color-contrast (3,95:1 no claro, mínimo 4,5:1) nos dias de fora do mês do Calendar de packages/ui (.outside com text-muted e opacity 0.7); no protótipo esses dias são ainda mais claros (color-mix de --text-muted a 55%).
- **Decisão:** Os dias de fora do mês seguem o protótipo: color-mix(in srgb, var(--text-muted) 55%, transparent). As evidências visuais excluem só esses dias da regra color-contrast do axe, com o motivo anotado; o resto do calendário continua checado.
- **Alternativas descartadas:** Escurecer os dias de fora do mês até 4,5:1, divergindo do protótipo.
- **Consequências:** Os dias de fora do mês ficam abaixo de 4,5:1 por decisão de fidelidade ao protótipo (DEC-007); os scripts apps/web/scripts/evidence-*.mjs não contam esses nós no color-contrast.
- **Substitui:** nenhuma

## DEC-011: Botão Adicionar cartão da raia mais escuro que o protótipo

- **Data:** 2026-10-31
- **Status:** ativa
- **Tags:** #frontend #projetos #acessibilidade #prototipo
- **Origem:** Usuário, no chat de 31/10/2026, durante as evidências visuais automáticas da TASK-30
- **Contexto:** No protótipo, o botão "+ Adicionar cartão" de cada raia usa a cor da raia a 60% (.lane .btn-muted), que reprova no axe color-contrast nos dois temas.
- **Decisão:** O botão "+ Adicionar cartão" da raia usa color-mix(in srgb, var(--lane) 55%, var(--text)) em apps/web/src/features/projects/projects.module.css e passa no contraste, divergindo de propósito do protótipo (exceção à DEC-007).
- **Alternativas descartadas:** Manter a cor do protótipo e excluir o botão da regra color-contrast, como a DEC-010 faz com o calendário.
- **Consequências:** O botão fica um pouco mais forte que no protótipo; a evidência da TASK-30 não precisa de exceção de contraste.
- **Substitui:** nenhuma

## DEC-012: Topbar em 360 px com a busca numa linha e a trilha embaixo

- **Data:** 2026-10-31
- **Status:** ativa
- **Tags:** #frontend #layout #topbar #prototipo
- **Origem:** Usuário, no chat de 31/10/2026, durante as evidências visuais automáticas da onda 7 (TASK-22)
- **Contexto:** Em 360 px, no protótipo, o campo "Buscar ou criar…" se espreme ao lado da trilha e quebra o texto em 2 ou 3 linhas; no app ele chegava a sobrepor a trilha.
- **Decisão:** Em até 720 px, `.searchTrigger` (apps/web/src/app/layout/app-layout.module.css) tem largura mínima de calc(var(--space) * 34): a busca fica numa linha só e a trilha desce para baixo dela, divergindo de propósito do protótipo (exceção à DEC-007).
- **Alternativas descartadas:** Copiar o protótipo, com a busca estreita quebrando o texto ao lado da trilha.
- **Consequências:** A topbar em 360 px fica mais baixa que a do protótipo (o evidence-shots.mjs da TASK-05 aceita altura menor ou igual) e sem sobreposição.
- **Substitui:** nenhuma

## DEC-013: Hover do botão de sucesso igual ao protótipo

- **Data:** 2026-10-31
- **Status:** ativa
- **Tags:** #frontend #botao #acessibilidade #prototipo
- **Origem:** Usuário, no chat de 31/10/2026, durante as evidências visuais automáticas da TASK-22
- **Contexto:** O hover da variante success do Button de packages/ui tinha 3,99:1 no tema claro; o do protótipo (color-mix de --success 22% com --success-soft, texto --success) tem 3,49:1; o mínimo é 4,5:1.
- **Decisão:** O hover da variante success segue exatamente o protótipo. As evidências visuais capturam o botão em repouso (sem o ponteiro em cima) e não contam o hover dele na regra color-contrast.
- **Alternativas descartadas:** Escurecer só o hover no tema claro até 4,5:1, divergindo do protótipo.
- **Consequências:** O hover do botão de sucesso fica abaixo de 4,5:1 no tema claro por fidelidade ao protótipo (DEC-007), como a DEC-010 no calendário.
- **Substitui:** nenhuma

## DEC-014: SPEC-004: contrato corrigido pelo estudo fica no estudo, não na spec

- **Data:** 2026-11-02
- **Status:** ativa
- **Tags:** financeiro, contrato, descontos, spec
- **Origem:** Decisão do usuário em 2026-11-02, ao concluir a TASK-01 da SPEC-004 (estudo dos descontos).
- **Contexto:** O estudo `docs/estudos/financeiro-descontos.md` corrigiu dois pontos do contrato da SPEC-004: a prévia `POST /api/v1/transactions/settlement-preview` recebe também `expected_gross_amount` e responde com `net_amount`; o total por nome fica em `GET /api/v1/financial-summaries`, não em `/api/v1/finance/summary`. A spec já estava `planned`, e o adjust-spec só aceita `refined` ou `approved`.
- **Decisão:** A spec não é ajustada. As tarefas TASK-02 a TASK-10 seguem o contrato do estudo, e a seção "O que muda no contrato da spec" do estudo é o registro da diferença, que o finalize-spec leva para os documentos finais.
- **Alternativas descartadas:** Voltar a spec para ajuste (impossível com status `planned`); manter o contrato original da spec (a prévia não escalaria a base digitada, e a rota não existe).
- **Consequências:** Quem ler a spec deve conferir o estudo para os dois pontos; a finalização da SPEC-004 cita a diferença.
- **Substitui:** Nenhuma
