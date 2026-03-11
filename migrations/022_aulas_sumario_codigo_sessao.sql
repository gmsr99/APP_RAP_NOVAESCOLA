-- Migration 022: Add sumario and codigo_sessao to aulas
-- sumario: text from JSON template (exported to PDF)
-- codigo_sessao: label of the selected template code (for readability, not exported)
-- aulas.objetivos: already exists (exported to PDF as "Objetivos Gerais")
-- aulas.observacoes: already exists (internal notes only, NOT exported to PDF)

ALTER TABLE aulas ADD COLUMN IF NOT EXISTS sumario TEXT;
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS codigo_sessao TEXT;
