-- Migração 016: Mudar unidade de medida de sessões para horas em turma_disciplinas
-- Em vez de planear por "número de sessões", planeamos por "total de horas".

ALTER TABLE turma_disciplinas RENAME COLUMN sessoes_previstas TO horas_previstas;
