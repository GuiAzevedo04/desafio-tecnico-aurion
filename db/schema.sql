-- Idempotent schema, applied by the API on startup (see src/db/schema.js).
--
-- The API validates every request before it reaches the database. The CHECK
-- constraints below are a second line of defense: they keep the data valid even
-- if a bug or a manual SQL session bypasses the API.

CREATE TABLE IF NOT EXISTS ordens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text        NOT NULL,
  descricao     text        NOT NULL,
  status        text        NOT NULL DEFAULT 'aberta',
  solucao       text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ordens_titulo_nao_vazio CHECK (btrim(titulo, E' \t\n\r') <> ''),
  CONSTRAINT ordens_descricao_nao_vazia CHECK (btrim(descricao, E' \t\n\r') <> ''),
  CONSTRAINT ordens_status_valido CHECK (status IN ('aberta', 'em_andamento', 'concluida')),
  -- "IS NOT NULL" is required: a CHECK passes when its expression is NULL, so
  -- comparing a NULL solucao alone would let a concluded order through.
  CONSTRAINT ordens_concluida_exige_solucao CHECK (
    status <> 'concluida' OR (solucao IS NOT NULL AND btrim(solucao, E' \t\n\r') <> '')
  )
);

-- Serves GET /ordens: SELECT ... FROM ordens ORDER BY criado_em, id.
-- Lookups by id (GET, PATCH, DELETE /ordens/:id) already use the primary key index.
CREATE INDEX IF NOT EXISTS ordens_criado_em_id_idx ON ordens (criado_em, id);
