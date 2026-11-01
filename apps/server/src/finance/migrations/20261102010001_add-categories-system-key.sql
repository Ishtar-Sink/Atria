-- Chave estável das categorias padrão, para a tela traduzir o nome por ela; nula
-- nas categorias criadas pela pessoa (RF-11).
ALTER TABLE categories ADD COLUMN system_key TEXT NULL;
