-- CareerOS API: baseline schema (PostgreSQL 15+, tested on 17).
--
-- Run it in one transaction so a failure leaves nothing half-built:
--   psql -v ON_ERROR_STOP=1 --single-transaction -d careeros -f sql/001_init.sql
-- Alembic's baseline revision runs this same file. Do not add BEGIN/COMMIT here.
--
-- Everything lives in its own schema so this can share a database server with other apps
-- (for example the Spring Boot roadmap API, which uses `public`).
--
-- Honesty rules the schema enforces:
--  * status history is append-only and every automated change must carry the portal's exact text;
--  * no passwords or tokens are stored anywhere, only the *name* of a secret kept elsewhere;
--  * skills use the same vocabulary as the website (data/skills.json, generated from taxonomy.ts).

CREATE SCHEMA IF NOT EXISTS careeros;
SET LOCAL search_path TO careeros, public;

-- ---------------------------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION careeros.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION careeros.forbid_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: this table is append-only', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

-- ---------------------------------------------------------------------------------------------
-- Application tracking
-- ---------------------------------------------------------------------------------------------

COMMENT ON SCHEMA careeros IS 'CareerOS home-lab API: applications, skills, portfolio, interview practice, ATS sync.';

CREATE TABLE companies (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name            VARCHAR(200) NOT NULL CHECK (btrim(name) <> ''),
  normalized_name VARCHAR(200) NOT NULL UNIQUE CHECK (normalized_name = lower(normalized_name)),
  website         VARCHAR(500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE companies IS 'Employers. normalized_name is lowercase and trimmed so "Acme Inc." and "acme inc." are one row.';

-- Statuses are exactly the tracker's (src/features/tracker/model.ts STAGES).
CREATE TABLE applications (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id       BIGINT NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  title            VARCHAR(300) NOT NULL CHECK (btrim(title) <> ''),
  job_url          VARCHAR(2000),
  normalized_url   VARCHAR(2000) NOT NULL UNIQUE,
  requisition_id   VARCHAR(120),
  platform         VARCHAR(40) NOT NULL DEFAULT 'other'
                   CHECK (platform IN ('greenhouse', 'lever', 'workday', 'ashby', 'linkedin', 'indeed', 'company_site', 'other')),
  location         VARCHAR(300),
  salary_text      VARCHAR(300),            -- only when the posting itself states it; never estimated
  description      TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'Saved'
                   CHECK (status IN ('Saved', 'Preparing', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn')),
  applied_at       DATE,
  match_score      SMALLINT CHECK (match_score BETWEEN 0 AND 100),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE applications IS 'One row per job. status mirrors the website tracker; change it through a status event, not by hand.';
COMMENT ON COLUMN applications.normalized_url IS 'Lowercased origin+path without query or fragment; the primary way portal entries are matched.';
CREATE INDEX applications_status_idx ON applications (status);
CREATE INDEX applications_company_idx ON applications (company_id);
CREATE INDEX applications_activity_idx ON applications (last_activity_at DESC, id DESC);
CREATE INDEX applications_requisition_idx ON applications (requisition_id) WHERE requisition_id IS NOT NULL;
CREATE TRIGGER applications_touch BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION careeros.touch_updated_at();

-- Portals the sync job may read. There is deliberately no password column: username_ref names an
-- environment variable or an entry in a root-only secrets file.
CREATE TABLE ats_accounts (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform      VARCHAR(40) NOT NULL CHECK (platform IN ('workday', 'greenhouse')),
  label         VARCHAR(120) NOT NULL CHECK (btrim(label) <> ''),
  employer_name VARCHAR(200),               -- shown nowhere on a Workday list, so entries are matched to this employer
  base_url      VARCHAR(500) NOT NULL CHECK (base_url ~ '^https://'),
  username_ref  VARCHAR(120) NOT NULL CHECK (username_ref ~ '^[A-Za-z0-9_.-]+$'),
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Set only by you, after reading that portal's terms on automated access. The sync job refuses to touch an
  -- account while this is NULL. (Workday's general site terms prohibit automated access without consent.)
  automation_acknowledged_at TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, base_url, username_ref)
);
COMMENT ON TABLE ats_accounts IS 'Candidate-portal accounts the sync job reads. No secrets here; username_ref is only the NAME of a secret stored outside the database.';

CREATE TABLE sync_runs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  outcome           VARCHAR(12) NOT NULL DEFAULT 'running' CHECK (outcome IN ('running', 'ok', 'partial', 'failed')),
  dry_run           BOOLEAN NOT NULL DEFAULT FALSE,
  accounts_checked  INTEGER NOT NULL DEFAULT 0 CHECK (accounts_checked >= 0),
  entries_seen      INTEGER NOT NULL DEFAULT 0 CHECK (entries_seen >= 0),
  status_changes    INTEGER NOT NULL DEFAULT 0 CHECK (status_changes >= 0),
  unmatched         INTEGER NOT NULL DEFAULT 0 CHECK (unmatched >= 0),
  error_summary     TEXT,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);
COMMENT ON TABLE sync_runs IS 'One row per run of jobs/sync_ats_status.py, including dry runs.';
CREATE INDEX sync_runs_started_idx ON sync_runs (started_at DESC);

CREATE TABLE sync_run_accounts (
  sync_run_id     BIGINT NOT NULL REFERENCES sync_runs (id) ON DELETE CASCADE,
  ats_account_id  BIGINT NOT NULL REFERENCES ats_accounts (id) ON DELETE CASCADE,
  outcome         VARCHAR(16) NOT NULL CHECK (outcome IN ('ok', 'needs_attention', 'failed', 'skipped')),
  reason          TEXT,
  entries_seen    INTEGER NOT NULL DEFAULT 0 CHECK (entries_seen >= 0),
  PRIMARY KEY (sync_run_id, ats_account_id)
);
COMMENT ON TABLE sync_run_accounts IS 'Per-account result. needs_attention means a human must act (CAPTCHA, MFA, changed login, terms), never something to retry around.';

-- Links a portal's own identifier to one of my applications once it has been matched.
CREATE TABLE ats_application_links (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id  BIGINT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  ats_account_id  BIGINT NOT NULL REFERENCES ats_accounts (id) ON DELETE CASCADE,
  external_id     VARCHAR(200) NOT NULL,
  external_url    VARCHAR(2000),
  matched_by      VARCHAR(20) NOT NULL CHECK (matched_by IN ('url', 'requisition', 'title_company', 'manual')),
  match_confidence NUMERIC(3, 2) NOT NULL CHECK (match_confidence BETWEEN 0 AND 1),
  last_observed_text TEXT,                  -- last wording seen, so an unchanged page never creates a new event
  last_checked_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ats_account_id, external_id)
);
CREATE INDEX ats_links_application_idx ON ats_application_links (application_id);

-- Append-only history. Every automated change keeps the portal's exact wording.
CREATE TABLE application_status_events (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  from_status    VARCHAR(20),
  to_status      VARCHAR(20),               -- NULL when the wording could not be mapped (recorded, not guessed)
  observed_text  TEXT,                      -- the portal's exact words
  source         VARCHAR(20) NOT NULL CHECK (source IN ('manual', 'ats_sync', 'extension', 'email', 'import')),
  confidence     VARCHAR(8) NOT NULL DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
  evidence       TEXT,
  observed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_run_id    BIGINT REFERENCES sync_runs (id) ON DELETE SET NULL,
  CONSTRAINT status_values CHECK (
    (from_status IS NULL OR from_status IN ('Saved', 'Preparing', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'))
    AND (to_status IS NULL OR to_status IN ('Saved', 'Preparing', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'Withdrawn'))
  ),
  -- Anything not typed in by me needs proof. Never "Applied" or "Offer" because a guess said so.
  CONSTRAINT automated_changes_need_evidence CHECK (
    source IN ('manual', 'import') OR (observed_text IS NOT NULL AND btrim(observed_text) <> '')
  ),
  CONSTRAINT unmapped_is_low_confidence CHECK (to_status IS NOT NULL OR confidence = 'low')
);
COMMENT ON TABLE application_status_events IS 'Append-only. UPDATE and DELETE are blocked by trigger. A NULL to_status records wording that could not be mapped, at low confidence.';
CREATE INDEX status_events_application_idx ON application_status_events (application_id, observed_at DESC, id DESC);
CREATE INDEX status_events_run_idx ON application_status_events (sync_run_id) WHERE sync_run_id IS NOT NULL;
CREATE TRIGGER status_events_append_only BEFORE UPDATE OR DELETE ON application_status_events
  FOR EACH ROW EXECUTE FUNCTION careeros.forbid_change();

-- Portal entries that did not match any application. Reported, never silently turned into applications.
CREATE TABLE ats_unmatched_entries (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sync_run_id     BIGINT NOT NULL REFERENCES sync_runs (id) ON DELETE CASCADE,
  ats_account_id  BIGINT NOT NULL REFERENCES ats_accounts (id) ON DELETE CASCADE,
  external_id     VARCHAR(200) NOT NULL,
  title           VARCHAR(300),
  company         VARCHAR(200),
  observed_text   TEXT,
  seen_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ats_unmatched_run_idx ON ats_unmatched_entries (sync_run_id);

-- ---------------------------------------------------------------------------------------------
-- Skills and scoring
-- ---------------------------------------------------------------------------------------------

-- Seeded from data/skills.json (generated from src/features/resume/job/taxonomy.ts).
CREATE TABLE skills (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           VARCHAR(160) NOT NULL CHECK (btrim(name) <> ''),
  category       VARCHAR(120) NOT NULL,
  aliases        TEXT[] NOT NULL DEFAULT '{}',
  case_sensitive BOOLEAN NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE skills IS 'Canonical skill vocabulary, identical to the website taxonomy. Do not add skills here by hand; add them to taxonomy.ts and re-export.';
CREATE UNIQUE INDEX skills_name_lower_idx ON skills (lower(name));
CREATE INDEX skills_category_idx ON skills (category);
CREATE INDEX skills_aliases_idx ON skills USING GIN (aliases);

-- A single master profile today; the table allows more later without redesign.
CREATE TABLE profiles (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL CHECK (btrim(display_name) <> ''),
  is_master    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_one_master_idx ON profiles (is_master) WHERE is_master;

CREATE TABLE profile_skills (
  profile_id       BIGINT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  skill_id         BIGINT NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  proficiency      SMALLINT NOT NULL CHECK (proficiency BETWEEN 0 AND 5),
  years            NUMERIC(4, 1) CHECK (years IS NULL OR years BETWEEN 0 AND 60),
  evidence         TEXT,
  last_verified_at TIMESTAMPTZ,
  PRIMARY KEY (profile_id, skill_id),
  -- A rating of 3 or more must say what it rests on, so the gap radar never shows invented strength.
  CONSTRAINT strong_skill_needs_evidence CHECK (proficiency < 3 OR (evidence IS NOT NULL AND btrim(evidence) <> ''))
);
COMMENT ON TABLE profile_skills IS 'Self-assessed proficiency 0-5 per skill. 0 = none, 5 = expert. Ratings of 3+ require evidence text.';

CREATE TABLE job_requirements (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  skill_id       BIGINT REFERENCES skills (id) ON DELETE SET NULL,
  term           VARCHAR(200) NOT NULL CHECK (btrim(term) <> ''),
  kind           VARCHAR(16) NOT NULL CHECK (kind IN ('required', 'preferred', 'responsibility')),
  evidence       TEXT,                      -- the job-description sentence it came from
  uncertain      BOOLEAN NOT NULL DEFAULT FALSE
);
COMMENT ON TABLE job_requirements IS 'Requirements extracted from a job description. skill_id is NULL when the term is not in the taxonomy; the term is kept either way.';
CREATE UNIQUE INDEX job_requirements_unique_idx ON job_requirements (application_id, lower(term), kind);
CREATE INDEX job_requirements_skill_idx ON job_requirements (skill_id) WHERE skill_id IS NOT NULL;

-- Radar chart (Part 3): one row per scored requirement with the proficiency on the master profile.
CREATE VIEW application_skill_fit AS
SELECT r.application_id,
       r.id            AS requirement_id,
       r.term,
       r.kind,
       r.uncertain,
       s.id            AS skill_id,
       s.category,
       COALESCE(ps.proficiency, 0) AS proficiency,
       (ps.skill_id IS NOT NULL)   AS has_rating
FROM job_requirements r
LEFT JOIN skills s ON s.id = r.skill_id
LEFT JOIN profiles p ON p.is_master
LEFT JOIN profile_skills ps ON ps.profile_id = p.id AND ps.skill_id = r.skill_id;
COMMENT ON VIEW application_skill_fit IS 'Requirement vs master-profile proficiency. has_rating=false means "not rated yet", which is different from a rating of 0.';

-- ---------------------------------------------------------------------------------------------
-- Portfolio tagging
-- ---------------------------------------------------------------------------------------------

CREATE TABLE portfolio_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('project', 'lab', 'certification', 'experience')),
  slug        VARCHAR(120) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  summary     TEXT NOT NULL CHECK (btrim(summary) <> ''),
  issuer      VARCHAR(200),               -- certifications
  url         VARCHAR(500) CHECK (url IS NULL OR url ~ '^https?://'),
  repo_url    VARCHAR(500) CHECK (repo_url IS NULL OR repo_url ~ '^https?://'),
  started_on  DATE,
  ended_on    DATE,
  published   BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);
COMMENT ON TABLE portfolio_items IS 'Projects, networking/home labs, certifications and experience. Only published rows may ever appear on the public portfolio.';
CREATE INDEX portfolio_items_public_idx ON portfolio_items (type, sort_order, id) WHERE published;
CREATE TRIGGER portfolio_items_touch BEFORE UPDATE ON portfolio_items FOR EACH ROW EXECUTE FUNCTION careeros.touch_updated_at();

CREATE TABLE role_profiles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        VARCHAR(80) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
  description TEXT
);
COMMENT ON TABLE role_profiles IS 'Target roles for ?role=<slug> portfolio views, for example aws-datacenter or react-dev.';

CREATE TABLE portfolio_item_roles (
  item_id   BIGINT NOT NULL REFERENCES portfolio_items (id) ON DELETE CASCADE,
  role_id   BIGINT NOT NULL REFERENCES role_profiles (id) ON DELETE CASCADE,
  relevance SMALLINT NOT NULL DEFAULT 3 CHECK (relevance BETWEEN 1 AND 5),
  PRIMARY KEY (item_id, role_id)
);
CREATE INDEX portfolio_item_roles_role_idx ON portfolio_item_roles (role_id, relevance DESC);

CREATE TABLE portfolio_item_skills (
  item_id  BIGINT NOT NULL REFERENCES portfolio_items (id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, skill_id)
);
CREATE INDEX portfolio_item_skills_skill_idx ON portfolio_item_skills (skill_id);

-- ---------------------------------------------------------------------------------------------
-- Interview practice (used by the simulator in Part 2)
-- ---------------------------------------------------------------------------------------------

CREATE TABLE interview_sessions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id  BIGINT REFERENCES applications (id) ON DELETE SET NULL,
  role_profile_id BIGINT REFERENCES role_profiles (id) ON DELETE SET NULL,
  model           VARCHAR(200),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX interview_sessions_application_idx ON interview_sessions (application_id);

CREATE TABLE interview_turns (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id  BIGINT NOT NULL REFERENCES interview_sessions (id) ON DELETE CASCADE,
  turn_index  INTEGER NOT NULL CHECK (turn_index >= 0),
  skill_id    BIGINT REFERENCES skills (id) ON DELETE SET NULL,
  question    TEXT NOT NULL CHECK (btrim(question) <> ''),
  answer      TEXT,
  rubric      JSONB,
  model       VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_index)
);
COMMENT ON TABLE interview_turns IS 'Questions generated for practice, my answers, and an optional scoring rubric. Never shared outside this database.';
