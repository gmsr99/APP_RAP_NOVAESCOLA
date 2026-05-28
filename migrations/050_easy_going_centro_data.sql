-- Migração de dados: AE Alcanena (id=10) + Arribar (id=8) → Easy Going Centro
-- Os projetos antigos ficam arquivados (não são apagados).

WITH novo_projeto AS (
    INSERT INTO projetos (nome, estado, usar_sub_projetos)
    VALUES ('Easy Going Centro', 'planejamento', TRUE)
    RETURNING id
),
novos_sub AS (
    INSERT INTO sub_projetos (projeto_id, nome)
    SELECT np.id, sub.nome
    FROM novo_projeto np,
         (VALUES ('AE Alcanena'), ('Arribar')) AS sub(nome)
    RETURNING id, nome, projeto_id
),
-- Associar estabelecimentos ao novo projeto mantendo o sub_projeto_id correcto
novas_pe AS (
    INSERT INTO projeto_estabelecimentos (projeto_id, estabelecimento_id, sub_projeto_id)
    SELECT np.id, pe.estabelecimento_id, ns.id
    FROM projeto_estabelecimentos pe
    JOIN novo_projeto np ON TRUE
    JOIN novos_sub ns ON (
        (pe.projeto_id = 10 AND ns.nome = 'AE Alcanena') OR
        (pe.projeto_id = 8  AND ns.nome = 'Arribar')
    )
    WHERE pe.projeto_id IN (8, 10)
    RETURNING *
)
-- Migrar aulas e músicas (fora das CTEs pois UPDATE não retorna para uso interno)
SELECT 'ok' AS step;

-- Migrar aulas
UPDATE aulas
SET projeto_id = (SELECT id FROM projetos WHERE nome = 'Easy Going Centro')
WHERE projeto_id IN (8, 10);

-- Migrar músicas
UPDATE musicas
SET projeto_id = (SELECT id FROM projetos WHERE nome = 'Easy Going Centro')
WHERE projeto_id IN (8, 10);

-- Migrar honorário rates (evitar conflito caso já exista rate no novo projeto)
INSERT INTO user_projeto_rates (user_id, projeto_id, valor_hora)
SELECT upr.user_id,
       (SELECT id FROM projetos WHERE nome = 'Easy Going Centro'),
       upr.valor_hora
FROM user_projeto_rates upr
WHERE upr.projeto_id IN (8, 10)
ON CONFLICT (user_id, projeto_id) DO NOTHING;

-- Arquivar projetos antigos (soft delete)
UPDATE projetos SET estado = 'arquivado' WHERE id IN (8, 10);
