-- ================================================================
-- EAS CC — Supabase Schema
-- Run this in the Supabase SQL editor (Project → SQL Editor).
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================= USUARIS =========================
CREATE TABLE IF NOT EXISTS usuaris (
  id TEXT PRIMARY KEY,
  nom TEXT NOT NULL DEFAULT '',
  cognom TEXT NOT NULL DEFAULT '',
  correu TEXT DEFAULT '',
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL DEFAULT '1234',
  rol TEXT NOT NULL DEFAULT 'alumne',  -- 'admin' | 'professor' | 'alumne'
  classe TEXT DEFAULT '',
  moduls TEXT DEFAULT '',              -- comma-separated codes or 'tots'
  pendents TEXT DEFAULT '',            -- comma-separated module codes
  no_matriculat TEXT DEFAULT '',       -- comma-separated module codes
  desdoblaments TEXT DEFAULT '',       -- "modCodi:grup,modCodi:grup"
  reset_request TEXT DEFAULT ''
);

-- ========================= MÒDULS =========================
CREATE TABLE IF NOT EXISTS moduls (
  codi TEXT PRIMARY KEY,
  nom TEXT NOT NULL DEFAULT '',
  curs TEXT NOT NULL DEFAULT ''
);

-- ========================= INDICADORS =========================
CREATE TABLE IF NOT EXISTS indicadors (
  codi TEXT PRIMARY KEY,
  capacitat_id TEXT NOT NULL,
  capacitat TEXT DEFAULT '',
  requisit TEXT DEFAULT '',
  text TEXT DEFAULT '',
  color_cap TEXT DEFAULT '',
  color_ind TEXT DEFAULT ''
);

-- ========================= CATÀLEG ACTIVITATS → INDICADORS =========================
CREATE TABLE IF NOT EXISTS act_ind (
  id SERIAL PRIMARY KEY,
  activitat TEXT NOT NULL,
  indicador_codi TEXT NOT NULL REFERENCES indicadors(codi) ON DELETE CASCADE,
  paraules TEXT DEFAULT '',
  ordre INTEGER DEFAULT 0
);

-- ========================= ACTIVITATS PRÒPIES DEL MÒDUL =========================
CREATE TABLE IF NOT EXISTS module_activitats (
  id SERIAL PRIMARY KEY,
  module_codi TEXT NOT NULL REFERENCES moduls(codi) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  indicador_codi TEXT NOT NULL,
  paraules TEXT DEFAULT ''
);

-- ========================= ORGANITZACIÓ DEL MÒDUL (PROJECTES) =========================
CREATE TABLE IF NOT EXISTS org_projectes (
  id SERIAL PRIMARY KEY,
  module_codi TEXT NOT NULL REFERENCES moduls(codi) ON DELETE CASCADE,
  prof TEXT DEFAULT '',
  num TEXT NOT NULL,
  nom TEXT DEFAULT ''
);

-- ========================= REGISTRES (BLOCS DE VALORACIÓ) =========================
-- seq_id is used as the "startCol" identifier in the frontend (integer, like GAS column index).
CREATE TABLE IF NOT EXISTS registres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_id SERIAL UNIQUE,
  module_codi TEXT NOT NULL,
  classe_letter TEXT NOT NULL,         -- 'A', 'B' or 'C'
  projecte_num TEXT DEFAULT '',
  projecte_nom TEXT DEFAULT '',
  activitat TEXT NOT NULL,
  data_registre TEXT DEFAULT '',
  grup INTEGER DEFAULT NULL,           -- NULL = all, 1 = grup 1, 2 = grup 2
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================= VALORACIONS =========================
CREATE TABLE IF NOT EXISTS valoracions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registre_id UUID NOT NULL REFERENCES registres(id) ON DELETE CASCADE,
  alumne_id TEXT NOT NULL,
  indicador_codi TEXT NOT NULL,
  nota TEXT NOT NULL                   -- '1', '4', '7', '10' or 'NA'
);

-- ========================= ÍNDEXS =========================
CREATE INDEX IF NOT EXISTS idx_usuaris_username     ON usuaris(username);
CREATE INDEX IF NOT EXISTS idx_usuaris_rol          ON usuaris(rol);
CREATE INDEX IF NOT EXISTS idx_usuaris_classe       ON usuaris(classe);
CREATE INDEX IF NOT EXISTS idx_act_ind_activitat    ON act_ind(activitat);
CREATE INDEX IF NOT EXISTS idx_modact_module        ON module_activitats(module_codi);
CREATE INDEX IF NOT EXISTS idx_orgproj_module       ON org_projectes(module_codi);
CREATE INDEX IF NOT EXISTS idx_registres_mod_cls    ON registres(module_codi, classe_letter);
CREATE INDEX IF NOT EXISTS idx_valoracions_reg      ON valoracions(registre_id);
CREATE INDEX IF NOT EXISTS idx_valoracions_alumne   ON valoracions(alumne_id);

-- ========================= ROW LEVEL SECURITY =========================
-- Internal app with anon key: disable RLS so all reads/writes are allowed.
-- For production, replace with proper policies per role.
ALTER TABLE usuaris            DISABLE ROW LEVEL SECURITY;
ALTER TABLE moduls             DISABLE ROW LEVEL SECURITY;
ALTER TABLE indicadors         DISABLE ROW LEVEL SECURITY;
ALTER TABLE act_ind            DISABLE ROW LEVEL SECURITY;
ALTER TABLE module_activitats  DISABLE ROW LEVEL SECURITY;
ALTER TABLE org_projectes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE registres          DISABLE ROW LEVEL SECURITY;
ALTER TABLE valoracions        DISABLE ROW LEVEL SECURITY;
