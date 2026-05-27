CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB        NOT NULL,
    label       VARCHAR(255),
    description TEXT,
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_by  UUID         REFERENCES profiles(id) ON DELETE SET NULL
);

INSERT INTO system_settings (key, value, label, description) VALUES (
    'ocultar_sessoes_direcao',
    'false'::jsonb,
    'Ocultar sessões da direção',
    'Quando activo, utilizadores comuns não vêem as sessões cujo mentor ou responsável pertence à direção ou IT support. Apenas direção e root continuam a ver.'
) ON CONFLICT (key) DO NOTHING;
