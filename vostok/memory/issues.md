---
type: issue
title: "Problemas"
description: "Problemas já encontrados no projeto, com causa e solução. Consulte ao encontrar um erro, antes da primeira tentativa de correção."
updated_at: 2026-10-31T15:54:06Z
---

# Problemas

Problemas já encontrados no projeto, com causa e solução. Consulte ao encontrar um erro, antes da primeira tentativa de correção.

Entradas criadas por `vostok memory add` e consultadas por `vostok memory search`. Não carregue este arquivo inteiro.

## ISS-001: Lightning CSS apaga backdrop-filter seguido da forma -webkit-

- **Data:** 2026-10-31
- **Status:** resolvido
- **Tags:** css, vite, lightningcss, backdrop-filter, e2e, command-palette
- **Categoria:** build
- **Assinatura:** backdropFilter retorna "none" (e2e: Expected substring: "blur", Received string: "none")
- **Ambiente:** `vite build` (Vite 8, minificação de CSS pelo Lightning CSS) servido pelo preview e testado no Chromium do Playwright.
- **Causa:** Com `backdrop-filter` escrito antes de `-webkit-backdrop-filter` na mesma regra, o Lightning CSS funde as duas e deixa só a prefixada; o Chrome não aplica a forma `-webkit-` e o desfoque some no build (no Vitest/jsdom passa).
- **Solução:** Escrever só `backdrop-filter` (o minificador acrescenta a `-webkit-` pelos alvos) ou pôr a prefixada antes. Regressão em `apps/web/src/features/command-palette/command-palette.test.tsx` lendo o CSS com `?raw`.
