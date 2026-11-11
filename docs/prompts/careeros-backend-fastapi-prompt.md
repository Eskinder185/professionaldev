# CareerOS Backend — Part 1 of 3: PostgreSQL schema, FastAPI service, ATS status sync

Copy everything below the line into a new session.

---

You are a senior Python backend engineer and database designer joining an existing project. Work
inside the repository at `C:\Users\eskew\github\professionaldev`. Read the files named below before
writing code. Do not commit, merge, push, or deploy without my approval.

## The project you are joining

**ProfessionalDev / CareerOS** is a career workspace for job seekers: job tracking, résumé matching,
tailoring, interview practice, a public portfolio, and a Chrome extension (AutoApply Copilot) that
reads job pages and autofills applications.

What already exists (inspect it; don't assume):

- **Frontend:** Vite + React 18 + TypeScript, `react-router-dom` v6, deployed to GitHub Pages at
  `https://eskinder185.github.io/professionaldev/` (base path `/professionaldev/`). It is a static
  site. GitHub Pages cannot reach a server on my home network.
- **Local-first data:** today all career data (applications, résumés, tracker history) lives in the
  browser (`src/features/storage/`, `src/utils/storage.ts`) with a JSON backup/export. The new backend
  is an **opt-in** home-lab service, not a replacement. Nothing may break for someone who never runs it.
- **Existing Java API:** `apps/api/` is a Spring Boot service (PostgreSQL 17, Flyway, OIDC, port 8080)
  for roadmaps and progress. Vite proxies `/api` to it (`vite.config.ts`). Don't modify it and don't
  take its port or `/api` prefix.
- **Skill knowledge already in TypeScript:** the requirement extractor, skill taxonomy with aliases, and
  rule-based matcher live in `src/features/resume/job/` (`taxonomy.ts`, `extractRequirements.ts`,
  `match.ts`). Tracker statuses and "never mark Applied without evidence" rules are in
  `src/features/tracker/` and `src/features/autoapply/`. The backend must use the **same** skill
  vocabulary and status names. Don't invent a second, drifting taxonomy.
- **AI:** local-first AI connections (Ollama, LM Studio, OpenAI-compatible) in `src/features/ai/`.
  Cloud AI is off unless the person explicitly consents. Job text is always treated as untrusted data.
- **Hosting target for the backend:** my Proxmox home lab (an LXC container or VM), PostgreSQL on the
  same LAN, jobs scheduled with cron or a systemd timer.

## Where the new service goes

Create a new, self-contained service at **`apps/careeros-api/`** (Python 3.12, FastAPI, SQLAlchemy 2.x
typed ORM, psycopg 3, Pydantic v2, `pydantic-settings`). Use its own PostgreSQL schema named `careeros`
so it can share a database server with the Java API without touching its tables.

- Default bind: `127.0.0.1:8000`. LAN exposure is an explicit setting.
- Route prefix: `/careeros/v1`. For local development, add a separate Vite proxy entry for
  `/careeros` → `http://127.0.0.1:8000` without changing the existing `/api` entry.
- Configuration only from environment variables or a `.env` file that is gitignored; ship `.env.example`.
- Pin every dependency in `requirements.txt` and state the versions you used.

## What to deliver in THIS response (Part 1)

Build sequentially. This response covers only the backend foundation and the status sync. I'll ask
for the React pieces (role-based portfolio routing, interview simulator chat, skill-gap radar chart)
in Parts 2 and 3. Design the schema now so those parts need no table redesign.

### 1. PostgreSQL schema: `apps/careeros-api/sql/001_init.sql`

A raw SQL script I can run with `psql`, idempotent where practical (`CREATE SCHEMA IF NOT EXISTS`,
`IF NOT EXISTS`), inside one transaction. Use `BIGINT GENERATED ALWAYS AS IDENTITY` keys,
`TIMESTAMPTZ` with defaults, `CHECK` constraints, foreign keys with deliberate `ON DELETE` rules, and
indexes for the queries in Parts 2 and 3. Comment every table.

Cover at least:

- **Application tracking:** `companies`; `applications` (title, company, job URL, normalized URL
  unique, source/ATS platform, location, salary only when the posting states it, job description
  text, current status, applied_at nullable); `application_status_events` (append-only history: from,
  to, observed_at, **source** such as `manual` / `ats_sync` / `extension` / `email`, an evidence
  snippet, confidence). Status values must match the tracker's existing statuses exactly; read them
  from the code and list them in a `CHECK` or lookup table.
- **Skill scoring:** `skills` (canonical name, category, aliases array), seeded from the existing
  TypeScript taxonomy via a small export step you describe (a JSON file generated from `taxonomy.ts`,
  then loaded). `profile_skills` (proficiency 0–5, years, evidence text, last_verified_at).
  `job_requirements` per application (skill, kind = required / preferred / responsibility, the exact
  job-description sentence as evidence, uncertain flag).
- **Portfolio tagging:** `portfolio_items` (type = project / lab / certification / experience, title,
  summary, links, dates, published flag), `role_profiles` (slug such as `aws-datacenter` or
  `react-dev`, title, description, slug format check), `portfolio_item_roles` (many-to-many with a
  relevance weight), and `portfolio_item_skills`.
- **Interview practice (used in Part 2):** `interview_sessions` and `interview_turns` (question,
  answer, rubric, model used, created_at).
- **Sync bookkeeping:** `ats_accounts` (platform, tenant/base URL, username reference) with **no
  password column**. Credentials live outside the database. `sync_runs` (started, finished, outcome,
  counts, error summary) and the link from status events to the run that produced them.

After the SQL, give a short relationship diagram (text) and explain any design choice that isn't
obvious. Also add Alembic configured with this script as the baseline revision, so future changes
are migrations rather than hand edits.

### 2. FastAPI service: `apps/careeros-api/app/main.py` (plus the minimum supporting modules)

`main.py` must run with `uvicorn app.main:app`. Keep it readable. Put settings, the engine/session
factory, ORM models, and Pydantic schemas in small modules (`config.py`, `db.py`, `models.py`,
`schemas.py`) rather than one giant file.

- SQLAlchemy 2.x `Mapped[...]` models matching the SQL exactly (`schema="careeros"`). Don't
  call `create_all` at startup. The schema comes from SQL/Alembic.
- Session-per-request dependency, connection pool settings, `pool_pre_ping`, graceful shutdown.
- `GET /careeros/v1/health`: process up, plus a database check that reports the failure without
  leaking connection strings.
- `GET /careeros/v1/applications`: paginated (`limit` capped, `offset` or cursor), filters for
  status, company, and updated-since; ordered by most recent activity; returns Pydantic response
  models, never ORM objects.
- `GET /careeros/v1/applications/{id}` including its status history.
- **Access control from day one:** private endpoints require a token from settings (header based,
  constant-time compare). CORS allows only `http://localhost:5173`, `http://127.0.0.1:5173`,
  `http://127.0.0.1:4173`, and origins I add in settings. No wildcard with credentials.
- Consistent error shape (`{ "error": { "code", "message" } }`), request logging without bodies or
  personal data, and OpenAPI docs enabled only when a setting allows it.
- `pytest` tests against a disposable PostgreSQL (Testcontainers or a test database from settings):
  health, pagination limits, filters, 401 without a token, and 404 shape.

### 3. Headless ATS status sync: `apps/careeros-api/jobs/sync_ats_status.py`

A Playwright (Python, Chromium, headless) job that checks the status of **my own** submitted
applications on candidate portals and records changes in PostgreSQL through the same SQLAlchemy models.

Hard rules. These keep it safe, legal, and consistent with the rest of CareerOS:

- **My accounts only, read-only.** It logs in, reads status, and logs out. It never submits, edits,
  withdraws, uploads, accepts terms, or clicks anything that changes an application.
- **No evasion.** If it meets a CAPTCHA, a bot check, MFA it can't complete from configured
  credentials, or terms that forbid automated access, it stops for that account, records
  `needs_attention` with a plain reason, and moves on. It doesn't solve, bypass, or retry around them.
  Before building an adapter, check and tell me what that portal's terms say about automated access.
- **Credentials never in code, logs, or the database.** Read them from environment variables or a
  root-only secrets file (mode 600) referenced by `ats_accounts.username_ref`. Persist the browser
  session (Playwright `storage_state`) in a permission-restricted directory so it doesn't log in
  on every run. Treat that file as a secret.
- **Polite by design:** one account at a time, sensible timeouts, a small fixed delay between pages,
  a hard cap on pages per run. Delays are for politeness, not for disguising automation. Use a plain,
  honest user agent.
- **Honest data:** map each portal's wording to the tracker's statuses through an explicit table. If
  the wording is unknown or ambiguous, record it as observed text with low confidence instead of
  guessing. Only write a status event when the status actually changed. Never mark something Applied
  or Offer without text on the page that says so. Store the exact text as evidence.
- **Idempotent and safe to rerun:** each run gets a `sync_runs` row; updates happen in a transaction
  per application; a crash mid-run leaves nothing half-written.

Structure:

- An adapter interface (`login`, `list_applications`, `read_status`, `logout`) with a **Workday**
  adapter (tenant-specific base URL from config; selectors kept in one place and labelled as the part
  most likely to break) and a **Greenhouse** adapter. Greenhouse applicants often have no
  status portal (MyGreenhouse may or may not exist for a given employer), so say plainly what is and
  isn't available, and design a fallback that reads status from forwarded confirmation emails, as
  a separate interface for later.
- Matching portal entries to `applications` rows by normalized job URL first, then by requisition ID,
  then by company + title with a confidence score. Unmatched entries are reported, not created
  silently.
- CLI flags: `--dry-run` (read and report, write nothing), `--account`, `--max-pages`, `--verbose`.
  Exit codes: 0 ok, 1 partial (some accounts need attention), 2 failed.
- Structured logs to stdout (journald friendly) with no personal data beyond application IDs.
- Deployment notes for Proxmox: an LXC/VM setup (`playwright install --with-deps chromium`), a
  dedicated non-root user, a **systemd service + timer** (preferred) and the equivalent crontab line,
  log rotation, and how to run it once by hand.
- Tests: unit tests for the status mapping, URL normalization and matching, plus an adapter test that
  runs against a **local HTML fixture** of a fake portal served by the test. Never use a real employer
  site in tests.

## How to answer

1. First, a short plan: the files you'll create and how they fit the existing repo (mention what you
   read: tracker statuses, taxonomy, Vite proxy, `apps/api`).
2. Then complete files, in full, with paths as headings. No `...`, no "rest omitted", no placeholder
   functions. If something truly needs my input (my Workday tenant URL, for example), use a clearly
   named setting with an example value in `.env.example`.
3. Then exact commands to: create the database role and database, run `001_init.sql`, install
   dependencies, start the API, run tests, run the sync once in dry-run mode.
4. End with **"Verified vs not verified"**: what you actually ran (with real output) and what you
   couldn't run (for example, a real Workday login). Don't claim anything works that you didn't run.

## Constraints that apply to every part

- Don't change the existing frontend, extension, or `apps/api` behaviour in this part beyond the one
  new Vite proxy entry.
- Don't weaken security: no secrets in the repo, no broad CORS, no open endpoints on the LAN by default.
- Don't fabricate data, statuses, or skills; the same honesty rules as the rest of CareerOS apply.
- Keep the public portfolio in mind for Part 2: GitHub Pages can't call my home lab. Make sure the
  portfolio queries can be exported to static JSON at build time (or served by a deliberately public,
  read-only endpoint). Note which you recommend and why, but don't build the React side yet.
