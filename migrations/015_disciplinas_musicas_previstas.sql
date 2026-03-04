-- Migração 015: Corrigir musicas_previstas por disciplina
-- A migração 014 definiu DEFAULT 7 para todas as disciplinas existentes.
-- Este script corrige os valores reais por disciplina.

UPDATE disciplinas SET musicas_previstas = 7 WHERE nome = 'Clube de RAP';
UPDATE disciplinas SET musicas_previstas = 7 WHERE nome = 'Clube de Produção';
UPDATE disciplinas SET musicas_previstas = 1 WHERE nome = 'Oficina de Português';
UPDATE disciplinas SET musicas_previstas = 0 WHERE nome = 'Label';
