# Autohospedagem

Define o que garante que qualquer pessoa consiga hospedar o Atria para uso pessoal ou numa rede interna.

[project/self-hosting-01]: Imagem Docker oficial, que roda sem root, e um `docker-compose.yml` de referência com o app e o PostgreSQL.
[project/self-hosting-02]: O servidor entrega o frontend já compilado: um único processo além do banco.
[project/self-hosting-03]: Toda configuração por variáveis `ATRIA_`, com padrões seguros e documentados, e um `.env.example` no repositório.
[project/self-hosting-04]: Funciona atrás de proxy reverso com TLS terminado fora, com um exemplo de configuração em `deploy/`; cabeçalhos `X-Forwarded-*` só são aceitos de proxies configurados.
[project/self-hosting-05]: Endpoint `/healthz` e logs estruturados em JSON, com nível configurável.
[project/self-hosting-06]: Migrações aplicadas na subida do servidor ou por um comando dedicado; atualizar a versão nunca perde dados.
[project/self-hosting-07]: Backup e restauração documentados, cobrindo o banco e os arquivos.
