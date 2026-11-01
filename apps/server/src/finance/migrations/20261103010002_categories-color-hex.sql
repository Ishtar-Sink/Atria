-- Cor da categoria em HEX `#rrggbb` livre (PD-12, RF-18). Cada tom antigo vira o HEX
-- do token do tema claro (RF-20, inferência B), sempre em minúsculas (RN-09). O
-- `NO FORCE` temporário deixa o dono da tabela, que roda a migração, atualizar as
-- linhas de todas as pessoas apesar da RLS.
ALTER TABLE categories DROP CONSTRAINT categories_color_check;
ALTER TABLE categories NO FORCE ROW LEVEL SECURITY;
UPDATE categories SET color = CASE color
    WHEN 'primary' THEN '#6d28d9'
    WHEN 'accent' THEN '#0e7490'
    WHEN 'success' THEN '#047857'
    WHEN 'warning' THEN '#92400e'
    WHEN 'danger' THEN '#be123c'
    WHEN 'info' THEN '#0369a1'
    ELSE color
END;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;
ALTER TABLE categories ADD CONSTRAINT categories_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
