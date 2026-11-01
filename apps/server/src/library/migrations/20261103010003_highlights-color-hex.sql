-- Cor do destaque em HEX `#rrggbb` livre (PD-12, RF-19). Cada tom antigo vira o HEX
-- do token do tema claro (RF-20, inferência B), sempre em minúsculas (RN-09). O
-- `NO FORCE` temporário deixa o dono da tabela, que roda a migração, atualizar os
-- destaques de todas as pessoas apesar da RLS.
ALTER TABLE highlights DROP CONSTRAINT highlights_color_check;
ALTER TABLE highlights NO FORCE ROW LEVEL SECURITY;
UPDATE highlights SET color = CASE color
    WHEN 'accent' THEN '#0e7490'
    WHEN 'primary' THEN '#6d28d9'
    WHEN 'success' THEN '#047857'
    WHEN 'warning' THEN '#92400e'
    WHEN 'info' THEN '#0369a1'
    ELSE color
END;
ALTER TABLE highlights FORCE ROW LEVEL SECURITY;
ALTER TABLE highlights ADD CONSTRAINT highlights_color_check CHECK (color ~ '^#[0-9a-f]{6}$');
