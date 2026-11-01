---
id: TASK-16
spec: SPEC-002
title: "Formulário de movimentação do Financeiro"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04, TASK-15]
wave: 4
covers: [RF-12, RF-13, RF-14, CT-11, CT-12, CT-13, CB-03, CB-04]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 1a6a699189f9820928e64a7a0b237998688cf370a630b7e7bf76a49489e9052e
adjustments: 1
adjusted_at: 2026-11-01T13:39:58Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: c62a8536e6e3d5055fbdcb50bdba5f3becc334f302d73ce2ee838b82399e7938
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T13:39:58Z
---

# TASK-16: Formulário de movimentação do Financeiro

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Financeiro"; RF-12, RF-13, RF-14; CT-11, CT-12, CT-13; CB-03, CB-04; RN-02, RN-09; FA-02; decisões 3, 4 e 12; "Contratos e interfaces": `MoneyFieldProps` e `system_key` de `GET /categories`)
- `vostok/work/tasks/SPEC-002/TASK-04.md` (o `MoneyField` da `@atria/ui`: props, máscara ao digitar, colar e apagar; o `Button` com carregando visível)
- `vostok/work/tasks/SPEC-002/TASK-15.md` (contrato gerado com `system_key` nas categorias)
- `packages/ui/src/money-field` (criado pela TASK-04: `MoneyFieldProps` exportado)
- `packages/ui/src/index.ts` (exportação de `MoneyField` e `MoneyFieldProps`)
- `docs/decisoes-do-prototipo.md` (PD-62: dinheiro em centavos e os campos da base)
- `apps/web/src/features/finance/screens/transaction-form-screen.tsx` (fns `initialValues`, `TransactionForm`, `submitCreate` e `onSubmit`; o `FormSelect` de `category_id` perto da linha 418)
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx` (bloco `transaction forms`: testes `opens the form with the kind and a category of the same kind`, `creates an expense with expected amount and date` e `creates a monthly recurrence on day 31`; fns `renderFinance` e `lastCall`)
- `apps/web/src/features/finance/test-utils.tsx` (stub da API do Financeiro: categorias, `POST /recurring-transactions` e `Idempotency-Key`)
- `apps/web/src/features/finance/components/money-field.tsx`
- `apps/web/src/features/finance/components/components.test.tsx` (teste `shows visibility as a segmented group defaulting to personal`, que usa o `MoneyField`)
- `apps/web/src/features/finance/lib/money-input.ts` e `apps/web/src/features/finance/lib/money-input.test.ts`
- `apps/web/src/features/finance/hooks/finance-cache.ts` (fn `useIdempotencyKey`)
- `apps/web/src/features/finance/components/finance.module.css` (só leitura: classes `rowText` e `inlineLink`)
- `apps/web/src/features/finance/i18n/pt-br.json` (chaves `transaction_form.*`)
- `apps/web/src/shared/forms/form-fields.tsx` (fn `FormSelect`) e `apps/web/src/shared/forms/form-fields.test.tsx`
- `apps/web/src/shared/toast/toast-store.ts` (fn `pushToast`) e `apps/web/src/shared/format/intl.ts` (fn `formatDate`)
- `apps/web/src/features/finance/components/settlement-card.tsx`, `apps/web/src/features/finance/screens/transfer-form-screen.tsx` e `apps/web/src/features/finance/screens/account-form-screen.tsx` (só leitura: os outros três campos de valor usam o mesmo adaptador `MoneyField`)
- `apps/web/scripts/evidence-finance.mjs` (constante `OUT`, fns `seed`, `category`, `mockApi`, `runScenarios` e `sheet`, cenário `Nova saída com recorrência`, `EVIDENCES`)
- `vostok/rules/project/code-style.md` ([project/code-style-05], [project/code-style-08], [project/code-style-09])
- `vostok/rules/project/api.md` ([project/api-06]: `Idempotency-Key`)

### Mudar

- `apps/web/src/features/finance/screens/transaction-form-screen.tsx` (alterar): categoria começa em "Sem categoria", link "Criar categoria", aviso de sucesso ao salvar com Repetir com a data da primeira ocorrência e volta à lista, e um único envio por clique duplo (RF-12, RF-14, CB-04).
- `apps/web/src/features/finance/screens/transactions-screens.test.tsx` (alterar): testes da categoria vazia, do link de criar, da máscara de valor e do salvar com Repetir.
- `apps/web/src/shared/forms/form-fields.tsx` (alterar): opção vazia (`empty_option`) e texto de estado vazio (`empty_help`) no `FormSelect` (RF-12).
- `apps/web/src/shared/forms/form-fields.test.tsx` (alterar): teste da opção vazia e do estado vazio.
- `apps/web/src/features/finance/components/money-field.tsx` (alterar): o adaptador do `react-hook-form` passa a renderizar o `MoneyField` da `@atria/ui`, com a máscara ao digitar, nos quatro campos de valor (RF-13).
- `apps/web/src/features/finance/components/components.test.tsx` (alterar): o teste do campo de valor confere a máscara.
- `apps/web/src/features/finance/lib/money-input.ts` (remover): a conversão do texto em centavos passa a ser do `MoneyField` da `@atria/ui` e fica sem uso.
- `apps/web/src/features/finance/lib/money-input.test.ts` (remover): testes da função removida, cobertos pelos testes do `MoneyField` da TASK-04.
- `apps/web/src/features/finance/i18n/pt-br.json` (alterar): textos de "Sem categoria", "Criar categoria", do estado vazio e do aviso ao salvar com Repetir (Bugs 7 e 9).
- `apps/web/scripts/evidence-finance.mjs` (alterar): grava as evidências em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-16`) e ganha a evidência `formulario`, em vídeo.

### Passos

1. Leia os arquivos de "Ler". Anote as props de `MoneyFieldProps` exportadas pela TASK-04 em `packages/ui/src/money-field` (contrato da spec: `label`, `value_cents: number | null`, `onChange: (cents: number | null) => void` e `error?`) e as opcionais que existirem entre `locale`, `currency`, `name`, `onBlur`, `help` e `disabled`. Hoje o formulário pré-seleciona `categories[0]`, o `FormSelect` não tem opção vazia, o `MoneyField` local não formata ao digitar e salvar com Repetir renova a chave de idempotência e vai ao detalhe da recorrência.
2. Em `apps/web/src/shared/forms/form-fields.test.tsx`, escreva antes do código `offers an empty option first and explains when there are no options`: um `FormSelect` com `empty_option="Sem categoria"` mostra "Sem categoria" como valor inicial com o campo em `''`, lista "Sem categoria" como a primeira opção e, com `options={[]}` e `empty_help="Nenhuma categoria ainda."`, mostra esse texto como ajuda do campo. Em `apps/web/src/shared/forms/form-fields.tsx`, acrescente ao `FormSelect` as props opcionais `empty_option?: string` (quando presente, `options` recebe na frente `{ value: '', label: empty_option }`) e `empty_help?: string` (vira o `help` quando `options.length === 0`, no lugar do `help` passado). Rode `pnpm --filter @atria/web exec vitest run src/shared/forms` até passar.
3. Em `apps/web/src/features/finance/i18n/pt-br.json`, acrescente depois de `transaction_form.category`: `"transaction_form.no_category": "Sem categoria"`, `"transaction_form.no_categories": "Nenhuma categoria deste tipo ainda."`, `"transaction_form.create_category": "Criar categoria"` e, depois de `transaction_form.repeat`, `"transaction_form.repeat_saved": "Recorrência salva. A primeira ocorrência fica para {date}."`.
4. Em `apps/web/src/features/finance/screens/transactions-screens.test.tsx`, no bloco `transaction forms`, escreva antes do código:
   - ajuste `opens the form with the kind and a category of the same kind`: o campo "Categoria" começa com "Sem categoria" e, aberto, lista "Sem categoria" e "Casa", sem "Salário" (mesmo nome do teste);
   - `starts without category and saves a null category`: salvar uma saída sem tocar em "Categoria" envia `POST /transactions` com `category_id: null` (CT-11, RN-02);
   - `offers only Sem categoria and the create link without categories`: com o stub sem categorias, o campo mostra só "Sem categoria", a ajuda "Nenhuma categoria deste tipo ainda." e o link "Criar categoria" com `href` `/finance/categories/new?kind=expense` (FA-02, CT-11);
   - `masks the amount while typing and pasting`: digitar `14500` em "Valor previsto (R$)" mostra o texto que casa com `/^R\$\s14\.500,00$/` e salva `expected_amount: 1450000`; colar `14500,5` (`user.clear` e `user.paste`) mostra `/^R\$\s14\.500,50$/` e salva `1450050`; apagar tudo mostra o erro de obrigatório e não envia (CT-12, CB-03, RN-09);
   - ajuste `creates a monthly recurrence on day 31`: depois do `POST /recurring-transactions`, aparece o aviso "Recorrência salva. A primeira ocorrência fica para …" com a data formatada da ocorrência aberta da resposta e a localização vai para `/finance/expenses` (mesmo nome do teste);
   - `saves a recurrence only once on a double click`: com a resposta do `POST /recurring-transactions` segurada até o segundo clique, `user.dblClick` em "Salvar" faz um único `POST /recurring-transactions` e o botão fica em carregando até a resposta (CT-13, CB-04).
   Rode `pnpm --filter @atria/web exec vitest run src/features/finance/screens/transactions-screens.test.tsx` e confirme que os novos falham.
5. Em `apps/web/src/features/finance/components/money-field.tsx`, mantenha a exportação `MoneyField` com as props `control`, `name` e `label` (as três usadas pelos quatro campos de valor; `help` e `disabled` não têm uso e saem) e troque o `MoneyInput` local pelo `MoneyField` da `@atria/ui` (importe como `MoneyField as BaseMoneyField`): `label` com o símbolo, como hoje (`${label} (${currencySymbol(currency, locale)})`), `value_cents={field.value ?? null}`, `onChange={field.onChange}`, o `error` traduzido como hoje e, se `MoneyFieldProps` tiver, `name={field.name}`, `onBlur={field.onBlur}`, `locale` e `currency` de `usePreferences()`. Apague `MoneyInput`, os imports de `money-input` e o `useState` que fica sem uso; `currencySymbol` continua.
6. Apague `apps/web/src/features/finance/lib/money-input.ts` e `apps/web/src/features/finance/lib/money-input.test.ts` e confirme com `grep -rn "money-input" apps/web/src` que nada mais os importa.
7. Em `apps/web/src/features/finance/components/components.test.tsx`, no teste `shows visibility as a segmented group defaulting to personal`, troque `expect(money).toHaveValue('12,34')` por `expect(money).toHaveValue(expect.stringMatching(/^R\$\s12,34$/))` e mantenha o nome acessível "Valor (R$)" e as demais asserções (mesmo nome do teste).
8. Em `apps/web/src/features/finance/screens/transaction-form-screen.tsx`:
   - em `initialValues`, no modo `create`, `category_id: ''`; o parâmetro `categories` fica sem uso e sai da assinatura e da chamada;
   - no `FormSelect` de `category_id`, passe `empty_option={t('finance.transaction_form.no_category')}` e `empty_help={t('finance.transaction_form.no_categories')}`, envolva-o num `<div className={styles.rowText}>` e, logo depois dele, `<Link to="/finance/categories/new" search={{ kind }} className={styles.inlineLink}>{t('finance.transaction_form.create_category')}</Link>`;
   - o rótulo de cada categoria continua sendo `item.name`;
   - em `submitCreate`, no ramo `values.repeat`, apague `idempotency.renew()` (a tela sai em seguida e a chave não deve mudar entre dois envios da mesma recorrência), chame `pushToast({ tone: 'success', message_key: 'finance.transaction_form.repeat_saved', params: { date: formatDate(recurrence.open_occurrence?.occurrence_date ?? recurrence.rule.starts_on, locale, 'UTC') } })` (de `../../../shared/toast/toast-store` e `../../../shared/format/intl`) e navegue para `fallback` (`/finance/income` ou `/finance/expenses`);
   - em `onSubmit`, impeça o segundo envio com `const in_flight = useRef(false)` (de `react`) no `TransactionForm`: `if (in_flight.current) return; in_flight.current = true;` no começo e `in_flight.current = false` num `finally`.
   Rode `pnpm --filter @atria/web exec vitest run src/features/finance src/shared/forms` até passar.
9. Em `apps/web/scripts/evidence-finance.mjs`:
   - troque `OUT` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-16');` e atualize o comentário do topo;
   - `runScenarios(browser, base, list = scenarios.filter((sc) => !sc.group))` passa a receber a lista; `telas` continua chamando sem a lista;
   - acrescente a `scenarios` três cenários com `group: 'formulario'` em `/finance/transactions/new?kind=expense` e `combos: ALL`: `Nova saída sem categoria` (o campo "Categoria" mostra "Sem categoria" e o link "Criar categoria" está visível), `valor com máscara` (digita `14500` no valor e confere o texto `R$ 14.500,00`; cola `14500,5` e confere `R$ 14.500,50`) e `salvar com Repetir` (marca "Repetir", preenche o valor, clica duas vezes em "Salvar", confere um único `POST /recurring-transactions` registrado pelo `mockApi`, o aviso "Recorrência salva." visível e a tela de Saídas aberta); no `world` do cenário `Nova saída sem categoria` use também uma variante sem categorias, `Nova saída sem nenhuma categoria`, que confere a ajuda "Nenhuma categoria deste tipo ainda.";
   - registre em `EVIDENCES` a chave `formulario`, que roda `scenarios.filter((sc) => sc.group === 'formulario')` e grava o vídeo `finance-formulario.webm` (contexto à parte com `recordVideo` do Playwright, desktop 1280x800, tema claro, cursor visível no molde do `board-drag` de `evidence-projects.mjs`, salvo com `page.video().saveAs(...)` depois de fechar o contexto, mostrando digitar o valor com a máscara, escolher a categoria e salvar com "Repetir"; as checagens dos dois temas e larguras seguem sem vídeo), e mude a mensagem de uso para "Use telas ou formulario".
10. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-finance.mjs formulario` e `node apps/web/scripts/evidence-finance.mjs telas`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e confira nas linhas `ok` as checagens do campo de categoria, da máscara e do aviso nos dois temas e larguras e abra o vídeo `finance-formulario.webm` para conferir a digitação com máscara, a escolha da categoria e o salvamento com "Repetir".

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance src/shared/forms --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -v 'money-input.test.ts' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance/lib --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep 'money-input.test.ts' | sort` (muda): `money-input.ts` e o teste dele são removidos; a máscara e a conversão passam ao `MoneyField` da `@atria/ui` (TASK-04).
- `grep -rln "money-input" apps/web/src | sort` (muda): os dois arquivos que citam `money-input` deixam de citar (o adaptador) ou são removidos (o teste).
- `pnpm --filter @atria/web exec eslint src/features/finance src/shared/forms --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance src/shared/forms scripts/evidence-finance.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes do Financeiro e dos campos de formulário (Vitest + Testing Library + axe)
# evidência: formulario-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance src/shared/forms --reporter=verbose
# A conversão local do valor foi removida e nada a importa
test ! -e apps/web/src/features/finance/lib/money-input.ts
! grep -rn "money-input" apps/web/src
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/features/finance src/shared/forms --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance src/shared/forms scripts/evidence-finance.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-finance.mjs
```

### Evidências

- `formulario-testes.txt` (automática, da verificação)
  - Prova: o formulário de movimentação começa em "Sem categoria", grava `category_id` nulo, oferece "Criar categoria", formata o valor ao digitar e ao colar gravando centavos, e ao salvar com Repetir cria uma única recorrência, avisa a data da primeira ocorrência e volta à lista (RF-12, RF-13, RF-14, CT-11, CT-12, CT-13, CB-03, CB-04, RN-02, RN-09).
  - Trecho: as linhas `✓` de `offers an empty option first and explains when there are no options`, `opens the form with the kind and a category of the same kind`, `starts without category and saves a null category`, `offers only Sem categoria and the create link without categories`, `masks the amount while typing and pasting`, `creates a monthly recurrence on day 31`, `saves a recurrence only once on a double click` e `shows visibility as a segmented group defaulting to personal`, e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste ou um desses nomes ausente.
- `finance-formulario.webm` (print): `node apps/web/scripts/evidence-finance.mjs formulario`
  - Prova: no formulário montado com a API simulada, o campo de categoria com "Sem categoria" e o link de criar, o valor com máscara e o aviso depois de salvar com Repetir, com um único envio no clique duplo, nos dois temas, em desktop e 360 px (RF-12, RF-13, RF-14, CT-11, CT-12, CT-13, CB-04, RNF-02, RNF-03).
  - Trecho: as linhas `ok` dos cenários `Nova saída sem categoria`, `Nova saída sem nenhuma categoria`, `valor com máscara` e `salvar com Repetir`, `ok ... axe sem violações`, a linha `video:` e a última linha `ok  0 falha(s)`; no vídeo, o cursor visível digitando o valor com a máscara (`R$ 14.500,00`), escolhendo a categoria e salvando com "Repetir", com o aviso de sucesso.
  - Falha: qualquer linha `FALHA` (dois `POST /recurring-transactions`, valor sem máscara, categoria pré-selecionada), `Evidência desconhecida`, a ausência da linha `video:` ou código de saída diferente de 0.

### Concluída quando

- [x] O campo Categoria começa em "Sem categoria", grava a movimentação sem categoria e traz o link "Criar categoria", também quando não há categorias (RF-12, CT-11, RN-02).

  > Como comprovar: em `formulario-testes.txt`, ver aprovados `opens the form with the kind and a category of the same kind`, `starts without category and saves a null category` e `offers only Sem categoria and the create link without categories`; no log do script, os cenários `Nova saída sem categoria` e `Nova saída sem nenhuma categoria` com `ok`; em `finance-formulario.webm`, a categoria escolhida.

- [x] O valor em reais é formatado enquanto se digita e ao colar, e é gravado em centavos; vazio mostra o erro de obrigatório (RF-13, CT-12, CB-03, RN-09).

  > Como comprovar: em `formulario-testes.txt`, ver aprovados `masks the amount while typing and pasting` e `shows visibility as a segmented group defaulting to personal`; no log do script, o cenário `valor com máscara` com `ok`; em `finance-formulario.webm`, o valor digitado ganhando a máscara até `R$ 14.500,00`.

- [x] Salvar com Repetir mostra o aviso com a data da primeira ocorrência, volta à lista e cria uma única recorrência mesmo com clique duplo (RF-14, CT-13, CB-04).

  > Como comprovar: em `formulario-testes.txt`, ver aprovados `creates a monthly recurrence on day 31` e `saves a recurrence only once on a double click`; no log do script, o cenário `salvar com Repetir` com `ok`; em `finance-formulario.webm`, o clique em Salvar com "Repetir" e o aviso de sucesso.

- [x] A conversão local do valor foi removida sem deixar referência, e lint, formatação e tipos passam sem warning.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; ele confere que `money-input.ts` não existe e que nada cita `money-input`.

## Descrição

### Resumo executivo

Corrige o formulário de entradas e saídas: a categoria passa a começar vazia, com a opção de criar uma, e o valor aparece formatado em reais enquanto se digita.
Ao salvar uma movimentação que se repete, a pessoa vê o aviso com a data da primeira ocorrência e volta à lista, e um clique duplo não cria mais recorrências repetidas.
Perfil padrão, risco médio: mexe no fluxo de criar movimentações e nos quatro campos de valor do Financeiro.
Depende do campo de moeda e do botão carregando (TASK-04) e do contrato gerado (TASK-15); desbloqueia o painel e as listas do Financeiro (TASK-17).

### Detalhes técnicos

**Abordagem.** O `FormSelect` da base ganha a opção vazia e o texto de estado vazio, e o formulário passa a começar com `category_id` vazio, enviado como `null` (RN-02), com o link para `/finance/categories/new?kind=...`. O adaptador `MoneyField` do Financeiro, usado pelos quatro campos de valor (movimentação, transferência, limite do cartão e liquidação), passa a renderizar o `MoneyField` da `@atria/ui` (TASK-04), que mascara ao digitar e devolve centavos (RN-09). Ao salvar com Repetir, a tela mostra o aviso com a data da ocorrência aberta da resposta e volta à lista; uma trava por `useRef` impede o segundo envio e a chave de idempotência não é mais renovada antes de sair.

**Causa confirmada.** Nenhuma categoria vinha criada e o campo pré-selecionava a primeira; o campo de valor não formatava ao digitar; salvar com Repetir renovava a chave de idempotência e ia ao detalhe sem aviso, o que permitiu três recorrências iguais no clique repetido (Estado atual "Financeiro").

**Componentes.** `transaction-form-screen.tsx`, `form-fields.tsx`, `money-field.tsx`, `money-input.ts` (removido), `i18n/pt-br.json` do Financeiro, os testes vizinhos e o script de evidência `evidence-finance.mjs`.

**Decisões.**
- Manter `money-field.tsx` como adaptador do `react-hook-form` sobre o campo da `@atria/ui` e remover `money-input.ts`. A spec lista o contrário (remover o adaptador e alterar `money-input.ts`); descartado porque remover o adaptador obrigaria a mudar os outros três formulários com campo de valor, fora do plano desta tarefa, e porque a conversão do texto em centavos passa a ser do campo da `@atria/ui` (inferência D), deixando `money-input.ts` sem uso ([project/code-style-08]).
- O rótulo continua com o símbolo da moeda ("Valor previsto (R$)"), para não mudar os nomes acessíveis usados pelos testes e pelos e2e. Descartado: tirar o símbolo do rótulo.
- Depois de salvar com Repetir, volta à lista do tipo (`/finance/income` ou `/finance/expenses`) com o aviso (resposta 4A). Descartado: ir ao detalhe da recorrência, o comportamento que escondia o resultado.
- Clique duplo barrado na tela e pela mesma chave de idempotência ([project/api-06]); o carregando visível vem do `Button` da TASK-04 (RF-25). Descartado: confiar só no `isSubmitting`, que chega um quadro depois do segundo clique.
- O nome da categoria padrão vem do servidor (`name`); `system_key` (TASK-09/TASK-15) não é usado nesta tela.
- Os textos novos entram no `i18n/pt-br.json` do Financeiro, que a spec liga aos Bugs 7 e 9; a TASK-17 muda o mesmo arquivo depois, em sequência pela dependência.

**Evidências visuais.** O script `apps/web/scripts/evidence-finance.mjs` (TASK-22 da SPEC-001) sobe o Vite com o harness do Financeiro e a API simulada; esta tarefa o faz gravar em `$VOSTOK_EVIDENCE` e cria a evidência `formulario`, em vídeo (`recordVideo` do Playwright, desktop 1280x800, tema claro, cursor visível), separada das `telas`.

**Riscos.** Se o `MoneyField` da TASK-04 tiver props diferentes do contrato da spec, siga o `MoneyFieldProps` exportado. Os testes que digitam valores (`45,90`, `2.000`) dependem da máscara aceitar a digitação; se algum quebrar por formato, ajuste só a asserção do texto exibido, nunca o valor em centavos. No baseline, o print roda com o script antigo, que não conhece `formulario` e sai com código 2.

**Referências.** RF-12, RF-13, RF-14; CT-11, CT-12, CT-13; CB-03, CB-04; RN-02, RN-09; FA-02; decisões 3, 4 e 12; PD-62.

**Arquivos em comum na onda 4.** Nenhum com a TASK-20, a TASK-25 e a TASK-28. `apps/web/src/features/finance/i18n/pt-br.json` e `apps/web/scripts/evidence-finance.mjs` também são mudados pela TASK-17 (onda 5), que depende desta.

### Card

- **Título:** Formulário de movimentação do Financeiro
- **Tipo:** bug
- **Descrição:** O formulário de movimentação começa sem categoria e oferece criar uma, mostra o valor formatado em reais ao digitar e, ao salvar com Repetir, avisa a primeira ocorrência e volta à lista sem duplicar.
- **Critérios de aceite:**
  - [ ] Categoria começa em "Sem categoria" e traz o link "Criar categoria".
  - [ ] O valor aparece como `R$ 14.500,00` ao digitar e é gravado em centavos.
  - [ ] Salvar com Repetir mostra o aviso com a data da primeira ocorrência e volta à lista.
  - [ ] Clique duplo em Salvar cria uma única recorrência.
  - [ ] Telas acessíveis nos dois temas e em 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04, TASK-15

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 7 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | Evidência do formulário passa de prancha PNG para vídeo .webm gravado por recordVideo; passo do script, Evidência (Trecho e Falha) e Como comprovar atualizados |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo; 2 mudança(s) esperada(s) |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-01 | conferência | usuário | print finance-formulario.webm conferido pelo usuário (sha256 f4ccaf0b) |
| 8 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-16/ |
| 9 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Evidência do formulário passa de prancha PNG para vídeo .webm gravado por recordVideo; passo do script, Evidência (Trecho e Falha) e Como comprovar atualizados |
