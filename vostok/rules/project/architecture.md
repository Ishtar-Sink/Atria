# Arquitetura

Define a organização do código, os limites entre os módulos e as premissas estruturais do Atria.

[project/architecture-01]: Monorepo com pnpm workspaces e Cargo workspace: `apps/` (web, server) e `packages/` (theme, ui, contratos).
[project/architecture-02]: Backend em DDD: cada área do produto é um contexto delimitado com as camadas `domain`, `application`, `infrastructure` e `interface` (auth, finance, goals, tasks, reminders, notes, journal, library, projects, links, search, reports).
[project/architecture-03]: A camada `domain` não depende de framework, banco nem HTTP; as dependências apontam para dentro.
[project/architecture-04]: Um contexto fala com outro só por serviço de aplicação ou evento de domínio, nunca lendo as tabelas do outro.
[project/architecture-05]: As ligações do "Conecta com" ficam no contexto `links`, genérico e bidirecional (tipo e id dos dois lados); nenhuma entidade guarda chave estrangeira para outra.
[project/architecture-06]: Toda entidade nasce com dono e visibilidade (pessoal ou compartilhada), para preparar a colaboração.
[project/architecture-07]: Frontend organizado por feature (`features/<contexto>`), espelhando os contextos do backend.
[project/architecture-08]: Componentes genéricos ficam em `packages/ui`, sem regra de negócio, prontos para a extração para o Ishtar Sink.
[project/architecture-09]: Tokens visuais em `packages/theme`, como variáveis CSS em `kebab-case` (ex.: `--surface-muted`), com um comentário no topo apontando `Ishtar-Sink/.github` `docs/identidade-ecossistema.md` como origem; nenhum app redeclara cor, raio ou espaço.
[project/architecture-10]: Criar, editar e ver uma entidade acontece numa rota própria; modal só para diálogo de confirmação. A única exceção é a paleta de comandos (Ctrl/Cmd + K), que cria entidades só com os campos mínimos e oferece "abrir para completar" na rota própria.
[project/architecture-11]: Layout com sidebar de navegação e topbar com busca global e breadcrumbs.
[project/architecture-12]: Nenhum serviço externo obrigatório (SaaS, CDN, telemetria): tudo funciona numa rede interna sem internet.
[project/architecture-13]: Microserviço, fila externa ou cache distribuído só entram com uma decisão registrada na memória.
