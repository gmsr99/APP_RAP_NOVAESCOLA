-- Migration 029: Contactos de Estabelecimentos
-- Tabela para armazenar contactos (telefone, email, maps, website) por instituição

CREATE TABLE IF NOT EXISTS contactos_estabelecimento (
    id SERIAL PRIMARY KEY,
    estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('telefone', 'email', 'maps', 'website', 'outro')),
    valor TEXT NOT NULL,
    descricao TEXT  -- ex: "Gonçalo Salema (coordenador projeto)"
);

CREATE INDEX IF NOT EXISTS idx_contactos_estab ON contactos_estabelecimento(estabelecimento_id);
