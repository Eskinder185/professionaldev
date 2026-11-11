# CareerOS API (home-lab service)

An **opt-in** FastAPI + PostgreSQL service for application tracking, skill scoring, portfolio tagging,
interview practice, and a read-only job-portal status sync. The website stays local-first and works
without it. It is separate from `apps/api` (the Spring Boot roadmap service): own folder, own schema
(`careeros`), own port (8000), own route prefix (`/careeros/v1`).

```
sql/001_init.sql        the schema (single source of truth for the baseline)
alembic/                migrations; revision 0001 runs the SQL file
app/                    FastAPI app: config, db, models, schemas, security, main, routes_lab, llm, interview, skillfit, portfolio
data/skills.json        the website's skill vocabulary, generated from src/features/resume/job/taxonomy.ts
scripts/                export_taxonomy.mjs (TS -> JSON), load_skills.py, import_portfolio.py, export_portfolio.py
jobs/                   sync_ats_status.py + ats/ adapters (Workday, Greenhouse), matching, status mapping
tests/                  pytest (API, schema constraints, sync logic, sync job against a local fake portal)
deploy/                 systemd units, cron line, logrotate
```

Python 3.11+ (built and tested on 3.11.9). Dependency versions are pinned in `requirements.txt`.

## Relationships

```
companies 1─* applications 1─* application_status_events (append-only; trigger blocks UPDATE/DELETE)
                  │ 1─* job_requirements *─1 skills 1─* profile_skills *─1 profiles
                  │ 1─* ats_application_links *─1 ats_accounts 1─* sync_run_accounts *─1 sync_runs
                  │                                          └─* ats_unmatched_entries *─1 sync_runs
                  └ 1─* interview_sessions 1─* interview_turns
portfolio_items *─* role_profiles   (portfolio_item_roles.relevance 1-5)
portfolio_items *─* skills          (portfolio_item_skills)
view application_skill_fit: job_requirements joined to the master profile (for the radar chart)
```

Design choices that aren't obvious:

- **Honesty is enforced by the database.** Automated status events must carry the portal's exact wording; wording that couldn't be mapped is stored with `to_status = NULL` at low confidence; history can't be edited; a self-rating of 3+ needs evidence text.
- **No secrets in the database.** `ats_accounts.username_ref` is the *name* of a secret kept in the environment. There is no password column (a test asserts it).
- **`automation_acknowledged_at`** must be set by you before the sync touches an account. See "Terms" below.
- **`has_rating`** in the skill-fit view separates "not rated yet" from "rated 0", so the radar chart never invents strength or weakness.
- **Skills** use the website's taxonomy, so the API, the résumé matcher and the extension agree on vocabulary. Re-run the export and loader when `taxonomy.ts` changes.

## Local setup (Windows PowerShell)

```powershell
cd apps\careeros-api
py -3.11 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt
.\.venv\Scripts\python -m playwright install chromium

# 1. Database and role (run as a PostgreSQL superuser)
psql -U postgres -c "CREATE ROLE careeros LOGIN PASSWORD 'choose-a-password'"
psql -U postgres -c "CREATE DATABASE careeros OWNER careeros"

# 2. Schema: either the SQL file (single transaction)...
psql -U careeros -d careeros -v ON_ERROR_STOP=1 --single-transaction -f sql\001_init.sql
#    ...or Alembic (same result, and tracks future migrations). Use one, not both.
copy .env.example .env     # then edit the two required values
.\.venv\Scripts\python -m alembic upgrade head

# 3. Skills (idempotent)
node --experimental-strip-types scripts\export_taxonomy.mjs   # only if taxonomy.ts changed
.\.venv\Scripts\python -m scripts.load_skills

# 4. Run
.\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If you used the SQL file for step 2 and want Alembic to manage it later: `python -m alembic stamp head`.

Call it: `Invoke-RestMethod http://127.0.0.1:8000/careeros/v1/health`, and for private routes add
`-Headers @{ Authorization = "Bearer <CAREEROS_API_TOKEN>" }`.

For `npm run dev` on the website, Vite proxies `/careeros` to `127.0.0.1:8000` (set `CAREEROS_API_PORT` to change).

## Tests

```powershell
# An empty database whose name ends in _test. Its careeros schema is DROPPED and rebuilt on each run.
psql -U postgres -c "CREATE DATABASE careeros_test OWNER careeros"
$env:CAREEROS_TEST_DATABASE_URL = "postgresql+psycopg://careeros:choose-a-password@127.0.0.1:5432/careeros_test"
.\.venv\Scripts\python -m pytest -q
```

Without that variable the database tests skip. The job tests launch real Chromium against a local fake portal
(`tests/fake_portal.py`); no real employer site is ever contacted.

## ATS status sync

```powershell
python -m jobs.sync_ats_status --dry-run -v    # read and report; writes nothing, not even a saved login
python -m jobs.sync_ats_status                 # real run
python -m jobs.sync_ats_status --account 2 --max-pages 2
python -m jobs.sync_ats_status --sign-out      # also sign out and delete the saved session
```

Exit codes: `0` ok, `1` partial (some accounts need attention or failed), `2` failed (everything failed).

Add an account (no password anywhere in the database):

```sql
INSERT INTO careeros.ats_accounts (platform, label, employer_name, base_url, username_ref)
VALUES ('workday', 'Acme (Workday)', 'Acme Inc.', 'https://acme.wd5.myworkdayjobs.com/en-US/External', 'workday-acme');
-- Only after you have read that portal's terms on automated access:
UPDATE careeros.ats_accounts SET automation_acknowledged_at = now() WHERE label = 'Acme (Workday)';
```

Then provide the credentials through the environment for `username_ref = workday-acme`:
`CAREEROS_SECRET_WORKDAY_ACME_USERNAME` and `CAREEROS_SECRET_WORKDAY_ACME_PASSWORD`.

What it does and refuses to do:

- Reads only. It never submits, edits, withdraws, uploads, or accepts anything (tests assert the fake portal's withdraw/submit endpoints are never reached).
- On a CAPTCHA, bot check, verification-code prompt, or new terms it stops for that account with `needs_attention` and a plain reason. It does not solve, bypass, or retry. A rejected login is tried **once** (repeated bad logins can lock accounts).
- One account at a time, a 1.5 s pause between pages and accounts, a page cap, and an honest user agent (`CareerOSStatusSync/0.1 …`, overridable with `CAREEROS_SYNC_USER_AGENT`). The pauses are politeness, not disguise.
- Maps wording through the explicit table in `jobs/ats/status_mapping.py`. Unknown wording becomes a low-confidence observation with no status change. A portal saying "Under review" never pulls an application back from Interview; "Offer" requires high confidence and a fuzzy title+company match can never produce one.
- Matches entries by normalised job URL, then requisition ID, then exact company plus a very close title that clearly beats the runner-up. Anything else is stored in `ats_unmatched_entries`; no application is ever created for it.
- Re-running is safe: an unchanged portal text creates no new event. Each application is updated in its own transaction.
- Reuses a saved browser session (`CAREEROS_SESSION_DIR`, mode 700, files mode 600) so it doesn't log in every run. Treat those files as secrets.

### Terms (read before enabling an account)

- **Workday:** Workday's general website terms say you may not use automated software or scripts to access the site, or scrape it, without Workday's consent ([End User Agreement](https://workday.com/en-us/legal/end-user-agreement.html), [Online Terms of Service](https://workday.com/en-us/legal/site-terms.html)). I could not confirm whether they govern an employer's candidate site, which may carry its own terms. Open the "Terms" link in that site's footer and decide. Employers can also forbid automation in their own terms.
- **Greenhouse:** I did not find candidate-side terms covering automated access either way. Read Greenhouse's Terms of Service and Privacy Policy and the employer's.
- This is not legal advice. If a portal's terms forbid automated access, do not enable the account; check the status by hand or use the email fallback.

### What may not work, plainly

- **Selectors are unverified against any live portal.** `jobs/ats/workday.py` and `greenhouse.py` follow common conventions, are tested only against the local fixture, and keep every selector in one `SELECTORS` block because that is what will need adjusting on first real use.
- **Greenhouse** is employer software; whether you have a status page depends on the employer, and MyGreenhouse sign-in has been reported to use an emailed one-time code, which the job treats as `needs_attention` and will not automate. For employers with no portal, `jobs/ats/email_fallback.py` defines the interface for reading forwarded status emails (not implemented yet).

## Endpoints

Private routes need `Authorization: Bearer <CAREEROS_API_TOKEN>`. Everything is under `/careeros/v1`.

| Route | Purpose |
| --- | --- |
| `GET /health` | public; process and database check |
| `GET /applications`, `GET /applications/{id}` | list (filters, pagination) and detail with status history |
| `PUT /applications/{id}/requirements` | replace a job's saved requirements (term, kind, evidence); skills are matched by name or alias |
| `GET /applications/{id}/skill-fit` | radar data: the job's skills against your master-profile ratings |
| `POST /interview/sessions`, `POST /interview/sessions/{id}/turns/{n}/answer`, `GET /interview/sessions/{id}` | the technical-screen simulator |
| `GET /public/roles`, `GET /public/portfolio?role=<slug>` | published-only portfolio; **404 unless `CAREEROS_PUBLIC_PORTFOLIO=true`**, rate-limited |

### Getting your data in

```powershell
# Your portfolio, role targets and skill ratings (copy data/portfolio.example.json, replace it with true entries).
# A file marked "example": true is refused. Unknown skill names fail the whole import, and nothing is half-saved.
.\.venv\Scripts\python -m scripts.import_portfolio data\portfolio.json

# A job's requirements, for example from the website's extractor:
Invoke-RestMethod -Method Put -Uri http://127.0.0.1:8000/careeros/v1/applications/1/requirements `
  -Headers @{ Authorization = "Bearer $env:CAREEROS_API_TOKEN" } -ContentType "application/json" `
  -Body '{"requirements":[{"term":"Linux","kind":"required","evidence":"Strong knowledge of Linux"}]}'
```

### Interview simulator

`POST /interview/sessions {application_id, style: general|cysa|aws, question_count}` picks skills from the job's
saved requirements (required before preferred, your weakest or unrated skills first, one strong skill mixed in for
longer sessions), tells the model your self-rated level for each, and asks it for original scenario questions.
Answering a question returns feedback and the next question; the model's "a good answer covers" list is revealed only
after you answer.

- The model is any OpenAI-compatible server (LiteLLM, Ollama `/v1`, LM Studio): `CAREEROS_LLM_BASE_URL`, `CAREEROS_LLM_MODEL`, optional `CAREEROS_LLM_API_KEY`. A host that is not loopback or a private LAN address is refused unless `CAREEROS_LLM_ALLOW_REMOTE=true`, because job text and your skill levels are sent to it.
- Job text and your answers are fenced as data in the prompt, and the model is told never to follow instructions inside them.
- Questions are validated: they must be about skills that are really in this job's requirements, with a real scenario; anything else is dropped, and if none survive you get a clear error rather than made-up content. Feedback with an out-of-range score or the wrong shape is not shown.
- If the model is down, the answer is **not** saved, so you can retry. The questions are original practice scenarios *in the style of* performance-based exam items; they are not real exam questions.

### Skill-gap radar

The posting doesn't state a proficiency level, so the chart's targets are an **assumption** (required 4/5, preferred 3/5), and the
response says so. A skill you haven't rated is "not rated", never a measured zero.

### Public portfolio

Preferred: export published rows to static files and commit them, so GitHub Pages never needs your lab:

```powershell
.\.venv\Scripts\python -m scripts.export_portfolio     # writes ..\..\public\portfolio\{index,all,<role>}.json
```

The site's `/portfolio?role=aws-datacenter` page reads those files, and uses the live endpoint only if an API address has been
set on the connection card (and falls back to the files if it is down).

## Website pages (in this repo's `src/features/homelab/`)

| Route | What it does |
| --- | --- |
| `/portfolio?role=<slug>` | published projects, labs, certifications and experience for one role, most relevant first |
| `/lab/interview` | chat interface for the technical-screen simulator |
| `/lab/skill-gap`, `/lab/skill-gap/:id` | Recharts radar of required skills against your ratings, plus an accessible table |

The two private pages ask for the API address and token on the page. The address is saved on this device; the token only for the
current tab. Note that a page served over `https://` can't call a plain `http://` LAN address (the browser blocks mixed content),
except to `localhost`; use `npm run dev`, a local preview, or put the API behind an HTTPS reverse proxy.

## Deploying on Proxmox (LXC or VM, Debian/Ubuntu)

```bash
sudo apt install -y python3-venv postgresql-client git
sudo useradd --system --create-home --home-dir /opt/careeros --shell /usr/sbin/nologin careeros
sudo -u careeros git clone <your repo> /opt/careeros            # or rsync apps/careeros-api and data
cd /opt/careeros/apps/careeros-api
sudo -u careeros python3 -m venv .venv && sudo -u careeros .venv/bin/pip install -r requirements.txt
sudo PLAYWRIGHT_BROWSERS_PATH=/opt/careeros/ms-playwright .venv/bin/playwright install --with-deps chromium
sudo chown -R careeros:careeros /opt/careeros/ms-playwright

sudo install -d -m 755 /etc/careeros
sudo install -m 600 /dev/null /etc/careeros/api.env      # CAREEROS_DATABASE_URL=..., CAREEROS_API_TOKEN=...
sudo install -m 600 /dev/null /etc/careeros/portals.env  # CAREEROS_SECRET_..._USERNAME / _PASSWORD
sudo nano /etc/careeros/api.env /etc/careeros/portals.env

sudo -u careeros bash -c 'set -a; . /etc/careeros/api.env; set +a; .venv/bin/alembic upgrade head && .venv/bin/python -m scripts.load_skills'

sudo cp deploy/careeros-api.service deploy/careeros-sync.service deploy/careeros-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now careeros-api.service careeros-sync.timer
```

Run the sync once by hand (dry run first), as the service user with the same environment:

```bash
sudo -u careeros bash -c 'set -a; . /etc/careeros/api.env; . /etc/careeros/portals.env; set +a; cd /opt/careeros/apps/careeros-api && CAREEROS_SESSION_DIR=/var/lib/careeros/sessions .venv/bin/python -m jobs.sync_ats_status --dry-run -v'
sudo systemctl start careeros-sync.service && journalctl -u careeros-sync -n 50 --no-pager
systemctl list-timers careeros-sync.timer
```

Prefer the **systemd timer**. If you want cron instead, use `deploy/crontab.example` and `deploy/logrotate-careeros`.
The API binds to `127.0.0.1`. To reach it from another machine on your LAN, put a reverse proxy with TLS in front
rather than binding `0.0.0.0`, and keep the bearer token.

## Public portfolio (Part 2 note)

GitHub Pages is static and cannot reach a server on your home network. Recommended: **export the published portfolio
to static JSON at build time** (a script that reads only `published = TRUE` rows and writes one file per role slug),
and have the React route filter that JSON. It needs no public endpoint, nothing private is reachable from the
internet, and the site keeps working when the lab is offline. A deliberately public, read-only endpoint behind a
reverse proxy is the alternative if you want edits to appear without a rebuild; it would need rate limiting and
must serve published rows only. The schema supports both.
