-- Migração 017: Adicionar campo horas_previstas à tabela disciplinas
-- Permite definir o total de horas padrão por disciplina (usado como pré-preenchimento
-- ao matricular uma turma numa disciplina).

ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS horas_previstas NUMERIC DEFAULT NULL;

UPDATE disciplinas SET horas_previstas = 64 WHERE nome = 'Clube de RAP';
UPDATE disciplinas SET horas_previstas = 64 WHERE nome = 'Clube de Produção';
UPDATE disciplinas SET horas_previstas = 3  WHERE nome = 'Oficina de Português';
UPDATE disciplinas SET horas_previstas = 0  WHERE nome = 'Label';
