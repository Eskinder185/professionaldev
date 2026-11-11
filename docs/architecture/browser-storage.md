# Browser Storage and Migration Strategy

## Safety policy

Browser storage contains user-authored drafts, progress, recordings metadata, preferences, and trackers. It is user data, even though it is local to one browser.

Migration rules:

1. Preserve unknown and malformed values by default.
2. Never delete or rename a key without a documented source schema and recovery plan.
3. Back up exact raw values before a destructive transformation.
4. Record a monotonically increasing migration version.
5. Make every migration idempotent so reloads do not repeat it.
6. Test representative historical data and repeated execution.
7. Keep explicit user-requested reset behavior separate from automatic startup migrations.

## Version 1 migration

`src/utils/migrations.ts` replaces the old repeated cleanup. The old code deleted every key beginning with:

- `pd:career:resume:`
- `pd:career:pitch:`
- `pd:speech:`

Version 1 does not delete those keys. On the first run it:

1. Reads the version from `pd:migrations:version`.
2. Copies matching raw key/value pairs to `pd:migrations:backup:v1` if any exist.
3. Leaves every original value untouched.
4. Writes version `1` only after the backup succeeds.
5. Skips all work on subsequent reloads.

Older releases may already have deleted values before this fix; client code cannot reconstruct data that is no longer present. The new backup prevents future migration logic from repeating that design.

## Storage inventory

### localStorage

| Key or namespace | Purpose | Operations |
| --- | --- | --- |
| `pd-theme` | Light/dark preference | Read/write |
| `pd:coach:chat` | Local coach history | Read/write |
| `pd:about:stage3` | About-page stage | Read/write |
| `pd:about:{stage}:check:{version}` | About checklists | Read/write |
| `pd:self:strengths:answers` | Strengths answers | Read/write |
| `pd:self:strengths:last` | Latest strengths result | Read/write |
| `pd:self:strengths:history` | Strengths result history | Read/write |
| `pd:self:values:rank` | Ranked values | Read/write |
| `pd:self:values:notes`, `notes1`, `notes2`, `notes3` | Values notes and compatibility copy | Read/write |
| `pd:self:interests:last` | Interest answers | Read/write |
| `pd:career:star:stories` | STAR story library | Read/write |
| `pd:career:audit:last` | Latest portfolio audit | Read/write |
| `pd:career:audit:history` | Portfolio audit history | Read/write |
| `pd:resources:skills:list` | Skills tracker | Read/write |
| `pd:resources:apps:list` | Application tracker in Resources | Read/write |
| `pd:resources:pomodoro:settings` | Timer settings | Read/write |
| `pd:resources:pomodoro:history` | Focus history | Read/write |
| `pd:resources:certs:path` | Certification path | Read/write; inactive feature |
| `pd:resources:certs:hpw` | Certification hours/week | Read/write; inactive feature |
| `pd:resources:certs:{path}:done` | Certification completion | Read/write; inactive feature |
| `pd:resources:certs:links` | User certification links | Read/write; inactive feature |
| `pd:speech:history` | Recording metadata | Read/export/reset |
| `pd:settings:reducedMotion` | Reduced-motion preference | Read/write |
| `pd:migrations:version` | Current storage schema version | Read/write by migration runner |
| `pd:migrations:backup:v{version}` | Recovery snapshot | Created once by migration runner |
| `pd_values` | Legacy values worksheet | Read/write |
| `pd_strengths_quiz` | Legacy strengths quiz | Write |
| `starBuilder:draft` | STAR builder draft | Read/write |
| `appTracker:items` | Top-level application tracker | Read/write |
| `interviewSim:autoRecord` | Interview recording preference | Read/write |
| Dynamic Behavioral Bank keys | Per-question STAR/CARL drafts | Read/write |

No `sessionStorage` feature data is used. Tests clear sessionStorage only to isolate browser test state.

### IndexedDB

- Database: `pd:speech`
- Version: `1`
- Object store: `blobs`
- Purpose: recorded media blobs
- Destructive operation: `Settings` clears the object store only after the user confirms “Reset all.”

## Explicit import, export, and reset behavior

The Settings page exports keys beginning with `pd:` and referenced video identifiers. It imports `pd:` keys from a chosen JSON file. “Reset all” removes `pd:` localStorage keys and clears recorded blobs after confirmation.

Several older keys do not use the `pd:` prefix and are therefore not included in Settings export/reset. Changing that behavior needs a separate compatibility design; this milestone documents the limitation rather than silently renaming or deleting those keys.

## Tests

- Unit tests verify exact historical values survive, backups preserve malformed raw data, unrelated keys remain untouched, and repeated migration calls do nothing.
- Playwright seeds historical/current data before application startup, reloads the page, and verifies the original values and migration version remain.

## CareerOS backup foundation (November 2026)

Settings → Storage & Privacy exports a version 3 JSON backup containing exact CareerOS localStorage values and records from three IndexedDB databases: legacy speech blobs, Interview Studio recordings, and the new `pd-careeros/records` store. Blob bytes are base64 encoded. A SHA-256 checksum detects incomplete or modified backups. Import verifies the schema, duplicate media keys, owned browser keys, blob encoding, and checksum before showing a restore preview. Restore merges records by key; a same-key record is replaced. A failure triggers a best-effort rollback using an in-memory pre-restore snapshot. Users should retain the original backup until they verify the restored data.

At startup, `mirrorLegacyRecords` copies owned localStorage keys into `pd-careeros/records` and reads them back to verify exact raw values. Legacy localStorage remains the active source for existing features; this copy is a migration checkpoint, not a completed switch of all readers and writers. No source keys are deleted. The version 1 localStorage migration remains independent.

The optional folder picker creates `CareerOS/` with Profiles, Resumes, Cover-Letters, Applications, Interviews, Transcripts, Agent-History, and Backups directories. Export saves a second JSON copy under Backups. Folder handles are held only for the current page session. Browsers without the File System Access API use browser storage and downloaded backups. The current app does not use OPFS; IndexedDB is appropriate for its structured records and recordings, while OPFS would need an explicit document lifecycle before adoption.

Clearing browser site data removes localStorage, IndexedDB, and any browser-managed offline data. It does not remove downloaded or folder backups. The Clear user data control removes owned CareerOS keys and all three known IndexedDB stores after confirmation. Backups can be large when recordings are saved. Backup files are portable plaintext, so users should store them in a location they trust. The checksum checks integrity, not authenticity or encryption.

Version 2 and earlier Settings JSON exports can be imported for their browser records. They had no checksum and did not include recording files, so the import view warns that the original file could not be integrity checked and recordings cannot be recovered from it.

Rollback procedure: keep a downloaded version 3 backup before changing or clearing data. If a restore produces an unexpected result, return to Settings → Storage & Privacy, verify that backup, review the replacement counts, and restore it. The original localStorage keys also remain untouched by the IndexedDB copy, so an incomplete copy does not require recovery.

Known limits: browser storage can be evicted; quota varies by browser; folder permission may need to be granted again; cross-store restore is compensated rather than truly atomic; active structured features still read and write localStorage pending a separately verified cutover. Existing offline caching is outside this storage milestone.
