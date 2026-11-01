-- Ícone da emoção, escolhido de um conjunto fixo; nulo, a tela usa o ícone pela
-- `system_key` ou o neutro (RF-19, CB-09).
ALTER TABLE emotions ADD COLUMN icon TEXT NULL;
