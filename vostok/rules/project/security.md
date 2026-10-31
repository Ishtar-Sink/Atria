# Segurança

Define as proteções obrigatórias de um app que guarda dados pessoais e é exposto a outras pessoas.

[project/security-01]: Senhas com hash Argon2id.
[project/security-02]: Sessão em cookie `HttpOnly`, `Secure` e `SameSite`; nenhum token de sessão em `localStorage`.
[project/security-03]: Toda requisição que altera dados é protegida contra CSRF.
[project/security-04]: A autorização é feita no servidor, dentro da própria query (filtrando por dono e compartilhamento), nunca só no frontend.
[project/security-05]: O convite de cadastro é de uso único, expira e é guardado só como hash.
[project/security-06]: O token de recuperação de senha é de uso único e expira rápido; a resposta é a mesma, exista ou não o e-mail.
[project/security-07]: Limite de tentativas com bloqueio progressivo no login, no cadastro e na recuperação de senha.
[project/security-08]: Papéis `admin`, `elevated` e `user`; o papel `elevated` nunca recebe as permissões exclusivas do admin, como gerir convites globais e papéis.
[project/security-09]: Toda entrada é validada na borda, com tipo e limites; queries só parametrizadas.
[project/security-10]: Uploads: tipo checado pelo conteúdo, limite de tamanho, nome gerado pelo servidor e arquivo servido com `nosniff` e `Content-Disposition`.
[project/security-11]: Cabeçalhos de segurança: CSP sem inline, `frame-ancestors 'none'`, `Referrer-Policy`, `X-Content-Type-Options: nosniff` e HSTS quando houver TLS.
[project/security-12]: Segredos só por variável de ambiente ou arquivo, nunca no repositório nem em log.
[project/security-13]: Logs sem conteúdo pessoal (diário, notas, valores, e-mails), só ids.
[project/security-14]: `cargo deny` e `pnpm audit` na CI, sem vulnerabilidade alta ou crítica.
[project/security-15]: Conteúdo rico (notas, diário) é sanitizado ao renderizar.
[project/security-16]: Sem telemetria; o usuário pode exportar todos os seus dados num formato aberto.
[project/security-17]: 2FA por TOTP opcional para todos os usuários e obrigatório para o admin.
[project/security-18]: Diário e notas criptografados em repouso, com a chave do servidor guardada fora do banco.
