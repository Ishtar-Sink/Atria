# Ações demoradas do Atria

Levantamento do Bug 20 da SPEC-002 (RF-24, inferência F), feito em 01/11/2026 sobre o código de `apps/web/src`. Método: `grep` de `loading={`, de `useFileDownload`, `uploadRaw` e `loadPdf` e de `isFetchingNextPage` nos arquivos `.tsx` e `.ts` fora dos testes, conferindo em cada ação o que a tela mostra hoje.

## Padrão

| Situação | Padrão |
|---|---|
| Espera curta sem medida | Botão em carregando, com indicador visível e `aria-busy`, segundo clique ignorado; `Button` da `@atria/ui` (TASK-04). |
| Conteúdo que carrega | `LoadingState` no lugar do conteúdo e a área com `aria-busy`. |
| Envio de arquivo | Barra de progresso (TASK-21). |
| Fim de uma ação cujo resultado não aparece na tela | Aviso de sucesso por toast. |
| Falha | Mensagem com `role="alert"` no formulário ou toast de erro, e o botão volta a aceitar a ação. |

## Levantamento

| Ação | Tela | Por que demora | Carregando | Progresso | Aviso de sucesso | Erro | Onde é aplicado |
|---|---|---|---|---|---|---|---|
| Salvar formulários (conta, categoria, transferência, meta, livro, artigo, vídeo, diário, projeto, raia, cartão do Kanban, lembrete, nota, tarefa, sessão de leitura) | Formulários de cada módulo | Espera a resposta do servidor | sim (`FormActions` com `loading`) | não se aplica | não se aplica (a tela volta para o item salvo) | sim (`role="alert"` no formulário) | já atende |
| Salvar movimentação com Repetir | Movimentação (formulário) | Cria a recorrência e as cópias no servidor | sim | não se aplica | falta o aviso de que as cópias foram criadas | sim | TASK-16 |
| Liquidar movimentação | Movimentação (detalhe) | Espera o servidor registrar a liquidação | sim | não se aplica | sim (toast) | sim | já atende |
| Desfazer a liquidação | Movimentação (detalhe) | Espera o servidor | sim | não se aplica | sim (toast) | sim | já atende |
| Salvar tarefa | Tarefas (formulário) | Espera o servidor; pode criar recorrência | sim | não se aplica | falta o aviso ao salvar | sim | TASK-28 |
| Enviar capa ou miniatura | Acervo (formulário do item) | Envio de imagem | sim | falta a barra | não se aplica (a capa aparece na tela) | sim | TASK-21 |
| Enviar PDF | Acervo (formulário do item) | Envio de arquivo grande | só o botão | falta a barra | não se aplica (o arquivo aparece no item) | sim | TASK-21 |
| Abrir o PDF no leitor | Leitor | Baixa e processa o documento | sim (`LoadingState`) | falta a primeira página rápida | não se aplica | sim | TASK-23 |
| Registrar a sessão de leitura | Leitor (oferta ao fechar) | Espera o servidor | sim | não se aplica | sim (toast) | sim | já atende |
| Gerar relatório | Relatórios | Consulta e agrega os dados | sim (botão e `LoadingState`) | não se aplica | não se aplica (o resultado aparece na tela) | sim (`ErrorState` com tentar de novo) | TASK-22 (área do resultado marcada como ocupada) |
| Exportar o PDF do relatório | Relatórios | Gera o PDF no servidor | sim | não se aplica | sim (toast "PDF do relatório baixado.") | sim (`role="alert"`) | TASK-22 |
| Exportar meus dados (JSON e CSV) | Exportar meus dados | Reúne todos os dados da pessoa | sim | não se aplica | sim (toast "Arquivo baixado.") | sim (`role="alert"`) | TASK-22 |
| Carregar mais nas listas paginadas | Listagens de Movimentações, Transferências, Metas, Notas, Acervo, Projetos, Usuários e detalhe de conta e de recorrência | Busca a próxima página | sim (botão em carregando) | não se aplica | não se aplica | sim | já atende |
| Entrar, cadastrar, segundo fator e redefinir senha | Entrar, Cadastro, Segundo fator, Esqueci a senha e Redefinir senha | Hash de senha e limite de tentativas no servidor | sim | não se aplica | não se aplica (a tela muda) | sim (`role="alert"`) | já atende |
| Salvar as Configurações da instância | Configurações da instância | Espera o servidor | sim | não se aplica | falta o aviso ao salvar | sim | TASK-24 |
| Criar convite | Novo convite | Gera o convite e o link no servidor | sim | não se aplica | não se aplica (o link aparece na tela) | sim | já atende |
| Excluir raia com cartões | Raia (diálogo de exclusão) | Move ou apaga os cartões | sim | não se aplica | falta o aviso ao excluir | sim | TASK-24 |

## Fora desta spec

Nenhuma: todas as ações levantadas são cobertas pela SPEC-002.
