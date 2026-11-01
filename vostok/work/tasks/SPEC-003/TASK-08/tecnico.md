<!-- Escrito na finalização da tarefa. -->

O que foi feito

- `packages/ui/src/autocomplete/autocomplete.tsx` (novo): componente `Autocomplete`, com busca, seleção única e múltipla, operação por teclado e texto de nenhum resultado (RF-21, RNF-05, CB-10). Exporta os tipos `AutocompleteOption`, `AutocompleteSingleProps`, `AutocompleteMultipleProps` e `AutocompleteProps`.
- `packages/ui/src/autocomplete/autocomplete.module.css` (novo): estilos só com tokens. Copia os valores de `select-field.module.css` (campo, lista, opção) e de `tag-field.module.css` (pílulas), para ficar com a mesma altura e bordas do `SelectField`.
- `packages/ui/src/autocomplete/autocomplete.test.tsx` (novo): testes de componente de teclado, mouse, axe, erro, desabilitado e campos ocultos de envio (CT-16, CB-10, RNF-05). Foram escritos antes do componente e confirmados falhando antes da implementação.
- `packages/ui/src/index.ts`: 7 linhas acrescentadas, exportando `Autocomplete` e os tipos.
- `apps/web/src/app/dev/autocomplete-harness.tsx` (novo): página de evidência com duas cenas. `estados` mostra os dois temas lado a lado, com um `SelectField` para comparação. `video` mostra o cenário gravado. O app não importa esse arquivo.
- `apps/web/scripts/evidence-autocomplete.mjs` (novo): uso `node apps/web/scripts/evidence-autocomplete.mjs <webm>`. Sobe o Vite, abre a cena `video`, executa o cenário pelo teclado e pelo mouse com marcador de cursor, confere cada passo, roda axe com a lista aberta e salva o vídeo com `page.video().saveAs()` depois de fechar o contexto.

Como foi feito

- Padrão de combobox editável com listbox da WAI-ARIA. O campo é um `input` com `role="combobox"`; a lista é `role="listbox"`, e a opção ativa é apontada por `aria-activedescendant`. Ids gerados com `useId`, no mesmo formato do `SelectField`.
- Busca por `normalize`: decomposição NFD, remoção de diacríticos, minúsculas e `trim`. Sem texto, mostra todas as opções na ordem recebida.
- Estados: `open`, `query`, `active` e `above`. Com a lista aberta, o texto do campo é `query`; fechado, mostra o rótulo da opção escolhida (seleção única) ou fica vazio (múltipla).
- As opções usam `onMouseDown` com `preventDefault`, para o foco continuar no campo. Posição acima ou abaixo medida em `useLayoutEffect`, como no `SelectField`.
- Fechamento: `pointerdown` em captura no `document` fora da raiz, `resize` da janela, `Tab` e `Escape`. Em todos, o texto volta ao valor anterior. `Escape` faz `preventDefault` e `stopPropagation`, e o teste confirma que o evento não chega a um `onKeyDown` do pai.
- `onBlur` externo é chamado só com a lista fechada.
- Seleção múltipla: as pílulas ficam abaixo do campo, com botão `×` que devolve o foco ao campo. `Backspace` com o campo vazio remove a última escolhida.
- Envio em formulário: `input type="hidden"` com `name`; na seleção única, um campo; na múltipla, um por valor.

Decisões

- Contrato dividido por `multiple`. A especificação (seção "Contratos e interfaces") define `AutocompleteProps<T>` com `value` e `onChange` em uma única união. A implementação usa `AutocompleteSingleProps` (`value: T | null`) e `AutocompleteMultipleProps` (`value: readonly T[]`), para que a tela não precise estreitar `T | T[] | null` e converter tipos em cada uso. Manter a união única foi descartado. Atenção: isto diverge do contrato escrito na spec.
- Busca ignora caixa e acento porque as categorias têm nome livre digitado pela pessoa.
- Dropdown usado só para listas que crescem, conforme a linha PD-13 de `docs/decisoes-do-prototipo.md`.

Verificação

- Baseline coletado: 5 comandos, todos com código de saída 0.
- Testes: passed, sem falhas na Verificação (saída em `validation/tests.out`).
- Regressão: passed, os mesmos 5 comandos do baseline.
- Evidências: passed, 3 evidências gravadas em `TASK-08/evidencias/`, entre elas `autocomplete-estados.png` (sha256 começa com 5a84fca5) e `autocomplete.webm` (sha256 começa com 45e6927f). Ambos foram conferidos pelo usuário.

Pontos de atenção

- `evidence-autocomplete.mjs` fica fora do ESLint, porque o `eslint.config.js` do web ignora `scripts`. A conferência prevista para ele é `node --check` e Prettier.
- O script depende do servidor Vite e da página virtual de `evidence-ui.mjs`, e reaproveita o `CURSOR_MARKER` de `evidence-projects.mjs`. Mudanças nesses arquivos podem quebrar a gravação.
- Os arquivos da pasta `packages/ui/src/autocomplete/` e os dois arquivos de evidência ainda não estão rastreados pelo git, e nada foi commitado.
- O contrato de props divide `value`/`onChange` por `multiple`; quem consumir o componente deve usar a forma correspondente ao modo.
