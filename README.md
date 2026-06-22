# newsroom-mcp

Type-safe MCP server for investigative journalism. The sole, validating writer to an investigation's `master-file.json` — enforcing the evidentiary standards that prompt-based editing cannot guarantee.

Companion to [newsroom-extension](https://github.com/ehurrn/newsroom-extension), the Claude Code / Gemini plugin that defines the investigation framework. The plugin teaches an LLM *how* to investigate; this server ensures the resulting evidence record is *structurally correct*.

## Why

An LLM editing `master-file.json` directly will eventually:

- Mark a claim `publishable` without A1/A2 evidence
- Assign a non-existent `DOC-` id to a claim
- Overwrite a `collection_log` entry instead of appending
- Skip the Admiralty grade on a new evidence item

Any of these corrupts the chain of custody that protects the outlet in a libel proceeding. This server makes them impossible.

## Enforced invariants

| Rule | Enforcement |
|---|---|
| Admiralty grade required at intake | `add_evidence` rejects missing `reliability`/`credibility` or custody block |
| Publishable gate | `publishable: true` blocked unless `corroborated` (two independent sources) OR `single-source` with ≥1 A1/A2 item |
| Defamation gate | `defamation_risk: "high"` claim cannot be published without `comment_requested: true` |
| Referential integrity | Every `entity_id` and `evidence_id` reference must exist before write commits |
| Append-only log | `collection_log` entries are never edited or deleted; server owns the monotonic `seq` |
| Atomic writes | Serialize → temp file → `rename()` — a crash mid-write never leaves a partial file |
| Concurrent safety | In-process write queue serializes simultaneous tool calls |

## Installation

Requires Node 18+. No global install needed — use `npx`.

```sh
npx @ehurrn/newsroom-mcp
```

## Setup

Each investigation is a directory with its own `master-file.json`. Point the server at it via `NEWSROOM_WORKSPACE`.

```sh
mkdir -p ~/investigations/city-hall-contracts
cd ~/investigations/city-hall-contracts
git init

# Install the evidence gate pre-commit hook
NEWSROOM_WORKSPACE=. npx @ehurrn/newsroom-mcp init-hook
```

## Connecting to your AI client

### Claude Code

Add to `~/.claude/settings.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "newsroom-mcp": {
      "command": "npx",
      "args": ["@ehurrn/newsroom-mcp"],
      "env": {
        "NEWSROOM_WORKSPACE": "/absolute/path/to/investigation"
      }
    }
  }
}
```

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "newsroom-mcp": {
      "command": "npx",
      "args": ["@ehurrn/newsroom-mcp"],
      "env": {
        "NEWSROOM_WORKSPACE": "/absolute/path/to/investigation"
      }
    }
  }
}
```

### Antigravity / agy

```json
{
  "mcpServers": {
    "newsroom-mcp": {
      "command": "npx",
      "args": ["@ehurrn/newsroom-mcp"],
      "env": {
        "NEWSROOM_WORKSPACE": "/absolute/path/to/investigation"
      }
    }
  }
}
```

Switch investigations by changing `NEWSROOM_WORKSPACE` and relaunching the server.

## Tools

### `init_master_file`
Initialize a new investigation. Fails if `master-file.json` already exists. Seeds `collection_log` entry #1.

```json
{
  "id": "INV-2026-001",
  "title": "City Hall Contracts",
  "central_question": "Did Acme Corp receive preferential treatment?",
  "opened": "2026-06-21",
  "evidence_dir": "evidence/"
}
```

### `read_master_file`
Return the full current state. No arguments.

### `upsert_entity`
Create or update an entity. Omit `id` to create (server assigns the next `ENT-NNN`).

```json
{
  "name": "Acme Corp",
  "type": "company",
  "roles": ["subject"],
  "jurisdictions": ["Delaware", "New York"],
  "identifiers": { "ein": "12-3456789" }
}
```

### `add_evidence`
Add an evidence item. Admiralty grading and a full custody block are required. Returns the assigned `DOC-NNN`.

```json
{
  "title": "Acme Corp 10-K (FY2025)",
  "source_type": "regulatory-filing",
  "reliability": "A",
  "credibility": "1",
  "custody": {
    "obtained_from": "https://sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=...",
    "obtained_date": "2026-06-21",
    "method": "public-registry",
    "hash": "sha256:abc123...",
    "local_path": "evidence/acme-10k-fy2025.pdf",
    "preservation_status": "preserved"
  },
  "summary": "Annual report disclosing related-party transactions with City vendor."
}
```

**Admiralty scale:**

| Reliability | Meaning |
|---|---|
| A | Completely reliable (certified official record) |
| B | Usually reliable |
| C | Fairly reliable |
| D | Not usually reliable |
| E | Unreliable |
| F | Cannot be judged |

| Credibility | Meaning |
|---|---|
| 1 | Confirmed by independent sources |
| 2 | Probably true |
| 3 | Possibly true |
| 4 | Doubtful |
| 5 | Improbable |
| 6 | Cannot be judged |

### `update_claim_status`
Create or update a claim. The publishable gate is enforced at write time — the server computes whether the linked evidence actually supports the flag, rather than trusting the caller.

```json
{
  "text": "Acme Corp received Contract C-2025-44 ($4.2M) without competitive bid, per City procurement records (DOC-001).",
  "entity_ids": ["ENT-001"],
  "evidence_ids": ["DOC-001"],
  "status": "single-source",
  "publishable": true,
  "defamation_risk": "medium"
}
```

### `append_collection_log`
Manually append an audit entry. The log is append-only — entries cannot be edited or deleted.

```json
{
  "actor": "reporter-jeh",
  "action": "comment-requested",
  "refs": ["ENT-001"],
  "notes": "Emailed Acme Corp comms director at press@acmecorp.com at 14:32 EST."
}
```

## Pre-commit hook

The hook scans `working/` and `drafts/` in the investigation workspace for cited `CLM-NNN` IDs and blocks commits where a cited publishable claim lacks qualifying evidence.

```sh
# Install into the current investigation workspace
npx @ehurrn/newsroom-mcp init-hook

# Run manually at any time
npx @ehurrn/newsroom-mcp validate
```

Example gate failure:

```
✗ Evidence gate failed — commit blocked:

  CLM-003: publishable claim has no A1/A2 evidence and status is not 'corroborated'

Fix: update master-file.json via newsroom-mcp tools, or set publishable:false
until evidence meets the A1/A2 or corroborated standard.
```

## Schema

`master-file.json` conforms to the schema defined in [newsroom-extension](https://github.com/ehurrn/newsroom-extension). The vendored copy lives in `schema/master-file.schema.json`. To pull the latest:

```sh
node scripts/sync-schema.mjs /path/to/newsroom-extension
npm run codegen
```

## Development

```sh
npm install          # installs deps and runs codegen
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # tsup → dist/
```

## License

Unlicense
