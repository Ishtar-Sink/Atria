### Baseline

- `pnpm --filter @atria/ui typecheck`
- `pnpm --filter @atria/ui exec eslint src/index.ts --max-warnings 0`
- `pnpm --filter @atria/ui exec prettier --check src/index.ts`
- `pnpm --filter @atria/ui exec vitest run src/select-field src/tag-field --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# evidência: autocomplete-tests.txt
pnpm --filter @atria/ui exec vitest run src/autocomplete --reporter=verbose
pnpm --filter @atria/ui exec vitest run src/select-field src/tag-field
pnpm --filter @atria/ui typecheck
pnpm --filter @atria/ui exec eslint src/autocomplete src/index.ts --max-warnings 0
pnpm --filter @atria/ui exec prettier --check src/autocomplete src/index.ts
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/dev/autocomplete-harness.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/dev/autocomplete-harness.tsx scripts/evidence-autocomplete.mjs
node --check apps/web/scripts/evidence-autocomplete.mjs
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `autocomplete.test.tsx`, inclusive `ct16 chooses several options and keeps the list open` e `cb10 shows the empty text and keeps the previous value`, e nenhuma `×`.

### Evidências

- `autocomplete-tests.txt` (automática, da verificação)
  - Prova: o autocomplete filtra ao digitar sem diferenciar maiúsculas e acentos, escolhe pelas setas e Enter, fecha no Esc sem mudar o valor, mostra o texto de nenhum resultado mantendo o valor anterior, escolhe e remove várias opções na seleção múltipla e não tem violações do axe (RF-21, CT-16, CB-10, RNF-05).
  - Trecho: `✓ src/autocomplete/autocomplete.test.tsx > Autocomplete > ct16 filters the options while typing, ignoring case and accents`, `ct16 picks the active option with the arrow keys and Enter`, `ct16 closes on Escape keeping the previous value`, `cb10 shows the empty text and keeps the previous value`, `ct16 chooses several options and keeps the list open`, `ct16 removes each chosen option` e `has no axe violations`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `autocomplete-estados.png` (print): `node apps/web/scripts/evidence-ui.mjs src/app/dev/autocomplete-harness.tsx "$VOSTOK_EVIDENCE/autocomplete-estados.png" --query=cena=estados`
  - Prova: nos temas claro e escuro, o autocomplete tem a mesma altura e o mesmo visual do seletor ao lado, mostra o valor escolhido, as pílulas da seleção múltipla com o botão de remover, o erro no próprio campo e o estado desabilitado, sem violações do axe (RF-21, CT-16).
  - Trecho: na imagem, os dois painéis com Conta e Categoria alinhados, `Mercado` no campo, as pílulas `Lazer` e `Transporte` com `×`, o erro `Escolha uma categoria.` e o campo desabilitado esmaecido; na saída, `ok    mesma altura do SelectField (light)`, `ok    duas pílulas na seleção múltipla (dark)`, `ok    axe sem violações` e a última `ok  0 falha(s)`.
  - Falha: o campo mais alto ou mais baixo que o seletor, pílulas sem `×`, texto ilegível no tema escuro, uma linha `FALHA` ou a última linha `FALHA  N falha(s)`.
  - Requer: `packages/ui/src/autocomplete/autocomplete.tsx`, `apps/web/src/app/dev/autocomplete-harness.tsx`
- `autocomplete.webm` (print): `node apps/web/scripts/evidence-autocomplete.mjs "$VOSTOK_EVIDENCE/autocomplete.webm"`
  - Prova: no Chromium, em 1280x800 e tema claro, com o cursor visível, a lista filtra ao digitar, as setas e o Enter escolhem, o Esc fecha mantendo o valor, a busca sem resultado mostra "Nenhuma categoria encontrada", e a seleção múltipla escolhe várias opções e remove cada uma pelo × e pelo Backspace (RF-21, CT-16, CB-10, RNF-05).
  - Trecho: as linhas `ok    lista filtra por "sa": Saúde`, `ok    axe sem violações com a lista aberta`, `ok    setas e Enter escolhem Mercado`, `ok    sem resultado mostra "Nenhuma categoria encontrada"`, `ok    Esc fecha e mantém Mercado`, `ok    remove pelo ×`, a linha `video:` e a última `ok  0 falha(s)`; no vídeo, o marcador do cursor, a lista encolhendo a cada letra e as pílulas entrando e saindo.
  - Falha: alguma linha `FALHA`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo a lista sem filtrar, o valor trocado depois do Esc ou o cursor invisível.
  - Requer: `packages/ui/src/autocomplete/autocomplete.tsx`, `apps/web/src/app/dev/autocomplete-harness.tsx`, `apps/web/scripts/evidence-autocomplete.mjs`
