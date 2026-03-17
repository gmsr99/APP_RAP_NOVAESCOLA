-- 024: Adiciona colunas de localização manual aos itens de equipamento
-- Permite que mentores indiquem onde ficou o material após uma sessão.
-- Possibilidades: 'estabelecimento', 'mentor', 'estudio'

ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS localizacao_tipo VARCHAR(50);
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS localizacao_ref_id VARCHAR(255);
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS localizacao_nome VARCHAR(255);
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS localizacao_atualizada_em TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS localizacao_atualizada_por UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Validar que localizacao_tipo só aceita valores válidos
ALTER TABLE kit_itens DROP CONSTRAINT IF EXISTS check_localizacao_tipo;
ALTER TABLE kit_itens ADD CONSTRAINT check_localizacao_tipo
    CHECK (localizacao_tipo IS NULL OR localizacao_tipo IN ('estabelecimento', 'mentor', 'estudio'));

-- Garantir consistência: todos os campos preenchidos ou todos NULL
ALTER TABLE kit_itens DROP CONSTRAINT IF EXISTS check_localizacao_complete;
ALTER TABLE kit_itens ADD CONSTRAINT check_localizacao_complete CHECK (
    (localizacao_tipo IS NULL AND localizacao_ref_id IS NULL AND localizacao_nome IS NULL)
    OR
    (localizacao_tipo IS NOT NULL AND localizacao_ref_id IS NOT NULL AND localizacao_nome IS NOT NULL)
);
