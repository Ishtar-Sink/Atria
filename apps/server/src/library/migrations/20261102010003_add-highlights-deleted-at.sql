-- Exclusão lógica do destaque: o excluído sai do leitor e das listas, mas a linha
-- fica no banco (RN-08).
ALTER TABLE highlights ADD COLUMN deleted_at TIMESTAMPTZ NULL;
