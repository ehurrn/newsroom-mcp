# MCP Configuration

## Claude Code (`~/.claude/settings.json`)

```json
{
  "mcpServers": {
    "newsroom-mcp": {
      "command": "npx",
      "args": ["newsroom-mcp"],
      "env": {
        "NEWSROOM_WORKSPACE": "/absolute/path/to/investigation"
      }
    }
  }
}
```

Replace `/absolute/path/to/investigation` with the directory containing your `master-file.json`.

## Antigravity / agy (`mcp.json` or inline config)

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

## Cursor (`.cursor/mcp.json`)

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

## Per-investigation setup

Each investigation gets its own workspace directory. Switch investigations by changing `NEWSROOM_WORKSPACE` and relaunching the server.

```sh
# Start a new investigation workspace
mkdir -p ~/investigations/city-hall-contracts
cd ~/investigations/city-hall-contracts
git init

# Install the evidence gate pre-commit hook
NEWSROOM_WORKSPACE=. npx @ehurrn/newsroom-mcp init-hook

# Verify the hook works
npx @ehurrn/newsroom-mcp validate
```

## Available tools

| Tool | Description |
|---|---|
| `init_master_file` | Initialize a new investigation (once per workspace) |
| `read_master_file` | Return the full current state |
| `upsert_entity` | Create/update an entity (person, company, LLC…) |
| `add_evidence` | Add evidence — requires Admiralty grade + chain of custody |
| `update_claim_status` | Create/update a claim — enforces publishable gate |
| `append_collection_log` | Manually append an audit entry (append-only) |
