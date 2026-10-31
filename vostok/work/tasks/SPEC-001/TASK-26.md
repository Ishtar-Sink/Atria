---
id: TASK-26
spec: SPEC-001
title: "Telas de Notas"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-43, CT-26]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: eef679de68fb1a17cfcceccf4cf205ee313c1b3ca5fc3f9138c0eb6dd77b2f91
adjustments: 1
adjusted_at: 2026-10-30T21:38:10Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: eef679de68fb1a17cfcceccf4cf205ee313c1b3ca5fc3f9138c0eb6dd77b2f91
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T21:38:10Z
---

# TASK-26: Telas de Notas

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-43, CT-26, RN-21, CB-06, decisões 13 e 16 e os recursos `/notes` e `/search` em "Contratos e interfaces")
- `vostok/work/tasks/SPEC-001/TASK-11.md` (passo das rotas: `GET|POST /notes`, `GET|PATCH|DELETE /notes/{id}`, filtro `visibility`, ordenação por `updated_at` ou `created_at` e o código `note_not_found`)
- `vostok/work/tasks/SPEC-001/TASK-16.md` (busca `GET /search?q=&contexts=`, que procura nas notas descriptografando em memória)
- `prototype/atria-prototype.html` (telas de notas validadas no protótipo; pelas decisões do protótipo, o template `#entity-detail` com "Voltar", "Editar" e "Mais ações", a visão geral da nota em `overviewHTML` (`k === 'note'`, cartão "Texto") e o formulário `KINDS.note` com a grade `.screen-form .form`)
- `docs/decisoes-do-prototipo.md` (linhas PD-11, PD-14, PD-19, PD-59 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-57 não se aplica: a nota não tem campo de data)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam o contexto notes
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes da base: `PageHeader` com "Voltar" e ações, `MenuButton`, `SelectField`, `SegmentedField`, `FormGrid`, `FormActions` e as ligações `FormSelect` e `FormSegmented` de `apps/web/src/shared/forms/form-fields.tsx`)
- `apps/web/src/app` (só leitura: layout e roteador raiz)
- `apps/web/src/shared` (cliente da API, interface otimista, aviso de recusa, `Intl`, estado da listagem na URL, i18n comum e helpers de teste com axe)
- `packages/ui` (lista, cartão, campos, área de texto, seletor, chip de filtro, busca, alternador de visualização, diálogo de confirmação, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de `/notes` e `/search`)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`

### Mudar

- `apps/web/src/features/notes/routes.tsx` (criar): rotas `/notes`, `/notes/new`, `/notes/$noteId` e `/notes/$noteId/edit`, exportadas por `createNotesRoutes` para a TASK-35 registrar.
- `apps/web/src/features/notes/nav.ts` (criar): item "Notas" da sidebar.
- `apps/web/src/features/notes/i18n/pt-br.json` (criar): textos das telas de notas.
- `apps/web/src/features/notes/hooks/use-notes.ts` (criar): listagem por cursor com filtro e ordenação, busca pelo `/search` com o contexto de notas, leitura, criação, edição e exclusão otimistas.
- `apps/web/src/features/notes/hooks/use-notes.test.tsx` (criar): testes da listagem, da busca e das mutações otimistas com reversão (CT-26).
- `apps/web/src/features/notes/screens/notes-screen.tsx` (criar): listagem de notas com filtros, busca e visualização em lista ou grade (RF-43).
- `apps/web/src/features/notes/screens/note-screen.tsx` (criar): tela da nota com o cabeçalho, "Editar" e "Excluir" dentro de "Mais ações" (PD-14), a visão geral em cartões (PD-59) e as abas extras recebidas por `extra_tabs`.
- `apps/web/src/features/notes/screens/note-form-screen.tsx` (criar): criar e editar nota em rota própria (título, texto e visibilidade).
- `apps/web/src/features/notes/screens/notes-screens.test.tsx` (criar): testes das três telas, do ciclo criar, editar e excluir, dos estados e do axe (CT-26).
- `apps/web/src/features/notes/notes.e2e.ts` (criar): fluxo ponta a ponta de CT-26, rodado na TASK-35.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes do cliente da API, do helper de mutação otimista, do aviso de recusa, da formatação `Intl` e do estado da listagem na URL em `apps/web/src/shared`, e os tipos de `@atria/contracts` para `/notes` e `/search`. Use esses nomes nos passos seguintes, sem criar equivalentes.
2. Crie `apps/web/src/features/notes/i18n/pt-br.json` com chaves em `snake_case` agrupadas por tela (`list`, `detail`, `form`, `delete`, `nav`), em tom calmo (ex.: vazio: "Nenhuma nota ainda. Anote o que quiser guardar."; busca sem resultado: "Nenhuma nota com esse texto.").
3. Escreva `hooks/use-notes.test.tsx` e depois `use-notes.ts`:
   - `useNotes(filters)`: `useInfiniteQuery` por cursor sobre `GET /api/v1/notes` com `visibility`, a ordenação (`updated_at` ou `created_at`), `cursor` e `limit`; com `q` preenchido, usa `GET /api/v1/search?q=<texto>&contexts=notes`, porque o conteúdo das notas é criptografado e não há busca no `GET /notes` (decisão 13).
   - `useNote(id)`: `GET /api/v1/notes/{id}`; `note_not_found` vira o estado "nota não encontrada".
   - `useCreateNote`: `POST /api/v1/notes`, não otimista na lista (o id vem do servidor), navega para a nota criada.
   - `useUpdateNote` (`PATCH /api/v1/notes/{id}`) e `useDeleteNote` (`DELETE /api/v1/notes/{id}`): otimistas no cache da lista e da nota, com reversão e aviso quando recusadas (RNF-09). A exclusão tira a nota da lista na hora.
   - Testes `lists notes with visibility and order from the url`, `searches notes through the search endpoint`, `creates a note`, `edits a note optimistically`, `deletes a note optimistically` e `rolls back a delete and warns when refused`.
4. Escreva `screens/notes-screens.test.tsx` (Testing Library, `userEvent` e axe) e depois as telas. Todo teste verifica: cabeçalho com `page-heading` e subtítulo; estados carregando, vazio com texto explicativo e erro com "Tentar de novo"; erros de formulário em `role="alert"`; navegação completa por `userEvent.tab()` com foco visível; zero violações no axe.
5. `notes-screen.tsx` em `/notes`: filtro por visibilidade (pessoal ou compartilhada), ordenação (atualizadas ou criadas por último), busca e visualização em lista ou grade, com os nomes acessíveis "Filtros", "Busca" e "Visualização" (usados pelos e2e da TASK-35), na URL (`?visibility=&sort=&q=&view=`); o filtro de visibilidade e a ordenação, quando lista de opções, usam o `SelectField` da TASK-05, nunca um `<select>` nativo (PD-62); cada nota mostra título, começo do texto e a data de atualização por `Intl`; item sem imagem tem a cor derivada do id. Testes `filters, sorts and searches notes through the url`, `switches between list and grid` e `shows empty, loading and error states`.
6. `note-screen.tsx` em `/notes/$noteId`: cabeçalho com "Voltar", eyebrow "Notas · Nota", título e subtítulo (atualizada em, por `Intl`) e, nas ações (PD-14), "Editar" com o ícone de lápis e o `MenuButton` "⋯ Mais ações" (`aria-label="Mais ações"`) com "Excluir" em tom `danger`, que abre o diálogo de confirmação; ao confirmar, volta para `/notes` já sem a nota; nenhum botão "Excluir" visível fora do menu. A tela recebe a propriedade `extra_tabs` (`{ id, label, render }[]`) e mostra a aba Visão geral seguida delas, para a TASK-35 montar Conexões sem esta feature importar outras. Visão geral (PD-59): zona principal com o cartão "Texto" (o texto com quebras de linha preservadas, ou "Sem texto ainda."); lateral com o cartão "Registro" (Visibilidade, Criado em e Atualizado em, por `Intl`); uma coluna abaixo de 960 px. Nota inexistente mostra o estado "nota não encontrada" com link para a lista.
7. `note-form-screen.tsx` em `/notes/new` e `/notes/$noteId/edit`: `react-hook-form` com `zod` (título obrigatório, texto opcional em área de texto, visibilidade com padrão pessoal), com a base da TASK-05 (PD-19, PD-62): o `PageHeader` com "Voltar" e o formulário numa coluna centralizada na largura do `FormGrid`; título, texto e visibilidade com `data-span="full"`; a visibilidade em `FormSegmented` ("Pessoal" e "Compartilhada"); e o `FormActions` com "Cancelar" (`ghost`, volta à nota na edição e à lista na criação) e "Salvar"; ao salvar, vai para a tela da nota.
8. Nos testes das telas, cubra o ciclo de CT-26 num teste `creates, edits and deletes a note`, e também `asks for confirmation before deleting`, `shows not found for a deleted note`, `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` (nenhum botão "Excluir" fora do menu), `pd59 shows the overview in cards with Texto and Registro`, `pd62 lays the form in the grid with title, text and visibility on the full row` (os três com `data-span="full"`, a visibilidade como `radiogroup`, nenhum `<select>` nativo e "Cancelar" antes de "Salvar") e `pd19 centers the header and the form in the form column`.
9. Crie `apps/web/src/features/notes/nav.ts` exportando `notesNav` com `path: '/notes'`, `label_key: 'notes.nav.title'` e o ícone SVG, no formato de item de navegação de `apps/web/src/shared`.
10. Crie `apps/web/src/features/notes/routes.tsx` exportando `createNotesRoutes(parent: AnyRoute)` com as quatro rotas e o esquema `zod` dos parâmetros de busca da lista. Não altere `apps/web/src/app`.
11. Crie `apps/web/src/features/notes/notes.e2e.ts` com `note is created, edited and deleted`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
12. Rode o bloco de "Verificação" e corrija até passar sem warnings.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente e de hook da feature (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/notes
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/notes/notes.e2e.ts
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/notes --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-62)
! grep -rnE '<select|type="(date|number)"' apps/web/src/features/notes --include=*.tsx
```

### Evidências

- `notes-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/notes --reporter=verbose`
  - Prova: o ciclo da nota (criar, editar, excluir), a listagem com filtros, busca e visualização e a interface otimista passam, com axe sem violações (RF-43, CT-26, RNF-06, RNF-09).
  - Trecho: as linhas `✓` de `creates, edits and deletes a note`, `deletes a note optimistically`, `rolls back a delete and warns when refused`, `searches notes through the search endpoint` e `shows empty, loading and error states`, e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `notes-pd-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/notes --reporter=verbose -t "pd[0-9]"`
  - Prova: as telas seguem as decisões do protótipo: cabeçalho da nota com "Excluir" no "Mais ações", visão geral em cartões, formulário na grade e coluna centralizada (DEC-002, PD-14, PD-19, PD-59, PD-62).
  - Trecho: as linhas `✓` de `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `pd59 shows the overview in cards with Texto and Registro`, `pd62 lays the form in the grid with title, text and visibility on the full row` e `pd19 centers the header and the form in the form column`.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `notes-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/notes/notes.e2e.ts`
  - Prova: o fluxo ponta a ponta de CT-26 está escrito para a TASK-35.
  - Trecho: a linha com `note is created, edited and deleted`.
  - Falha: `No such file or directory` ou saída vazia.
- `notes-telas.png` (manual): prints da lista de notas em lista e em grade, da lista vazia, carregando e com erro, da busca sem resultado, da tela da nota com a visão geral em cartões e o "Mais ações" aberto, do formulário na grade com erro de validação e do diálogo de exclusão, nos temas claro e escuro, em 360 px e em desktop, mais um print com o foco visível pelo teclado no diálogo. Capture com `pnpm --filter @atria/web dev`, montando localmente as rotas de `createNotesRoutes` sem salvar mudança em `apps/web/src/app`.
  - Prova: identidade visual, os dois temas, 360 px e desktop, os estados e o foco por teclado (RNF-06, RNF-08, RNF-10).
  - Trecho: as telas sem rolagem horizontal em 360 px, texto legível nos dois temas e o anel de foco visível no diálogo.
  - Falha: rolagem horizontal em 360 px, cor fora da paleta, estado sem texto, foco invisível ou exclusão sem confirmação.

### Concluída quando

- [ ] Uma nota é criada, editada e excluída, e não aparece mais depois de excluída (RF-43, CT-26).

  > Como comprovar: em `notes-tests.txt`, ver aprovados `creates, edits and deletes a note`, `asks for confirmation before deleting` e `shows not found for a deleted note`.

- [ ] Editar e excluir aparecem na hora e são desfeitos com aviso se o servidor recusar (RNF-09).

  > Como comprovar: em `notes-tests.txt`, ver aprovados `edits a note optimistically`, `deletes a note optimistically` e `rolls back a delete and warns when refused`.

- [ ] A listagem tem filtro, ordenação, busca e visualização na URL, e a busca procura no conteúdo das notas (RF-43).

  > Como comprovar: em `notes-tests.txt`, ver aprovados `filters, sorts and searches notes through the url`, `switches between list and grid` e `searches notes through the search endpoint`.

- [ ] As telas têm estados vazio, carregando e erro, navegam por teclado e não têm violações no axe (RNF-06).

  > Como comprovar: em `notes-tests.txt`, ver aprovado `shows empty, loading and error states` e o resumo sem falhas.

- [ ] As telas funcionam em 360 px e desktop, nos dois temas, só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: abrir os prints de `notes-telas.png` e conferir as telas legíveis nos dois temas e larguras; o último comando da Verificação não encontra cor literal.

- [ ] A tela da nota tem "Editar" com lápis, "Excluir" em vermelho só dentro de "Mais ações" e a visão geral em cartões (Texto e Registro); o formulário usa a grade da base numa coluna centralizada, com a visibilidade em grupo segmentado e as ações à direita (PD-14, PD-19, PD-59, PD-62).

  > Como comprovar: em `notes-pd-tests.txt`, ver aprovados os quatro testes `pd14`, `pd59`, `pd62` e `pd19`; o último comando da Verificação não encontra controle nativo.

- [ ] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `notes-e2e-specs.txt` lista o fluxo.

## Descrição

### Resumo executivo

Entrega as telas de Notas: listar, ler, criar, editar e excluir notas independentes.
A pessoa guarda o que quiser num lugar privado, com a busca procurando também no texto das notas.
Perfil padrão, risco baixo: só cria as telas da própria área sobre um contrato já pronto.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/notes`, com telas sem regra de negócio e hooks do TanStack Query. Formulários com `react-hook-form` e `zod`. A feature exporta `createNotesRoutes` e `notesNav`.

**Componentes.** Lista (`/notes`, com `?visibility=&sort=&q=&view=`), tela da nota (`/notes/$noteId`) e formulário em rota própria (`/notes/new`, `/notes/$noteId/edit`).

**Decisões.**
- Busca da lista pelo `GET /search?q=&contexts=notes` (TASK-16), porque título e texto são criptografados em repouso e o `GET /notes` só filtra por visibilidade e ordena (TASK-11, decisão 13). Descartado: filtrar no cliente as páginas já carregadas, que perderia notas ainda não carregadas.
- Editar e excluir otimistas; criar não, porque o id vem do servidor. Excluir só com diálogo de confirmação.
- Texto simples com quebras de linha preservadas; formatação rica fica fora do MVP.
- As notas de livros e vídeos não aparecem aqui (RN-21): são do Acervo.
- Cabeçalho da nota com "Editar" e "Mais ações" (DEC-002, PD-14): "Excluir" só dentro do menu, em vermelho. Descartado: o botão "Excluir" visível, que a PD-14 tira do cabeçalho.
- Visão geral em cartões (PD-59): "Texto" na zona principal e "Registro" na lateral; a tela recebe `extra_tabs` para a TASK-35 montar Conexões.
- Formulário com a base da TASK-05 (PD-19, PD-62): `FormGrid`, `FormActions` e a visibilidade em `FormSegmented`.

**Riscos.** O formato dos resultados de `/search` (`groups[].items[]` com `id`, `title`, `snippet`, `updated_at`) difere do item de `/notes`; a lista converte os dois para o mesmo item de exibição no hook. A busca devolve no máximo 8 resultados por contexto (TASK-16): com `q`, a lista mostra esses resultados sem paginação e o texto "Mostrando as notas mais próximas da busca".

**Referências.** RF-43; CT-26; RN-21; CB-06; RNF-03, RNF-06, RNF-08, RNF-09, RNF-10; decisão 13 da spec; DEC-002; PD-14, PD-19, PD-59 e PD-62 de `docs/decisoes-do-prototipo.md`.

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta.

### Card

- **Título:** Telas de Notas
- **Tipo:** historia
- **Descrição:** Telas de Notas independentes: listar, ler, criar, editar e excluir, com busca no conteúdo.
- **Critérios de aceite:**
  - [ ] Uma nota é criada, editada e excluída, e some da lista depois de excluída.
  - [ ] Editar e excluir aparecem na hora e são desfeitos com aviso se recusados.
  - [ ] A lista tem filtro, ordenação, busca e visualização na URL.
  - [ ] A nota tem "Editar", "Mais ações" com "Excluir" e a visão geral em cartões, e o formulário segue a grade da base.
  - [ ] Telas acessíveis, com estados vazio, carregando e erro, em 360 px e desktop, nos dois temas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004 e os componentes da TASK-05; PD-14: Editar com lápis e Excluir em danger só no Mais ações; PD-59: visão geral em cartões Texto e Registro, com extra_tabs; PD-62 e PD-19: FormGrid, FormActions, visibilidade em FormSegmented e coluna centralizada, filtros no SelectField; testes pd14, pd59, pd62 e pd19; Verificação sem controles nativos; evidência notes-pd-tests.txt, Concluída quando, Detalhes técnicos e card atualizados; linha test -e da pasta da feature removida da Baseline, que a validação recusa |
