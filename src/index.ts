#!/usr/bin/env node
/**
 * newsroom-mcp — MCP server entry point.
 *
 * Usage as MCP server (stdio):
 *   NEWSROOM_WORKSPACE=/path/to/investigation npx newsroom-mcp
 *
 * CLI sub-commands:
 *   npx newsroom-mcp validate     # run evidence gate manually
 *   npx newsroom-mcp init-hook    # install pre-commit hook
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { MasterFileStore } from './store.js';
import {
  initMasterFile,
  readMasterFile,
  upsertEntity,
  addEvidence,
  updateClaimStatus,
  appendCollectionLog,
} from './tools.js';

// ---------------------------------------------------------------------------
// CLI sub-commands
// ---------------------------------------------------------------------------
const [, , subcmd] = process.argv;

if (subcmd === 'validate') {
  const mod = await import('./scripts/validate-evidence.js');
  mod.main();
  process.exit(0);
}

if (subcmd === 'init-hook') {
  const { installHook } = await import('./init-hook.js');
  installHook();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const workspace = process.env['NEWSROOM_WORKSPACE'];
if (!workspace) {
  console.error(
    'Error: NEWSROOM_WORKSPACE environment variable is required.\n' +
    'Set it to the absolute path of your investigation workspace directory.\n' +
    'Example: NEWSROOM_WORKSPACE=/Users/me/investigations/city-hall npx newsroom-mcp',
  );
  process.exit(1);
}

const store = new MasterFileStore(workspace);

const server = new Server(
  { name: 'newsroom-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'init_master_file',
      description:
        'Initialize a new master-file.json in the investigation workspace. ' +
        'Fails if a file already exists. Creates the collection_log with entry #1.',
      inputSchema: {
        type: 'object',
        required: ['id', 'title', 'central_question', 'opened'],
        properties: {
          id: { type: 'string', description: 'Investigation ID, e.g. INV-2026-001', pattern: '^INV-[0-9]{4}-[0-9]{3}$' },
          title: { type: 'string' },
          central_question: { type: 'string', description: 'The single falsifiable question this investigation must answer.' },
          opened: { type: 'string', description: 'ISO date, e.g. 2026-06-21' },
          evidence_dir: { type: 'string', description: 'Path to write-once evidence directory, e.g. evidence/' },
        },
      },
    },
    {
      name: 'read_master_file',
      description: 'Return the full current master-file.json as structured data.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'upsert_entity',
      description:
        'Create or update an entity (person, company, LLC, etc.) in the master file. ' +
        'If id is omitted, the server assigns the next ENT-NNN id. ' +
        'Validates against the entity schema before writing.',
      inputSchema: {
        type: 'object',
        required: ['name', 'type', 'roles'],
        properties: {
          id: { type: 'string', description: 'Existing ENT-NNN to update; omit to create.' },
          name: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
          type: { type: 'string', enum: ['person', 'company', 'llc', 'trust', 'nonprofit', 'pac', 'government-body', 'official', 'asset', 'unknown'] },
          roles: { type: 'array', items: { type: 'string', enum: ['subject', 'initiator', 'beneficiary', 'victim', 'witness', 'gatekeeper', 'intermediary', 'nominee', 'associate', 'decision-maker', 'source'] }, minItems: 1 },
          jurisdictions: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
      },
    },
    {
      name: 'add_evidence',
      description:
        'Add a new evidence item. Requires Admiralty reliability (A-F) and credibility (1-6) grades, ' +
        'plus a full chain-of-custody block. Returns the assigned DOC-NNN id.',
      inputSchema: {
        type: 'object',
        required: ['title', 'source_type', 'reliability', 'credibility', 'custody'],
        properties: {
          title: { type: 'string' },
          source_type: { type: 'string', enum: ['official-record', 'court-filing', 'regulatory-filing', 'campaign-finance', 'foia-response', 'corporate-registry', 'property-record', 'ucc-filing', 'news-secondary', 'human-source', 'social-media', 'web-archive', 'dataset', 'physical', 'other'] },
          reliability: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', 'F'], description: 'Admiralty source-reliability: A=completely reliable … F=cannot be judged' },
          credibility: { type: 'string', enum: ['1', '2', '3', '4', '5', '6'], description: 'Admiralty info-credibility: 1=confirmed … 6=cannot be judged' },
          custody: {
            type: 'object',
            required: ['obtained_from', 'obtained_date', 'method'],
            properties: {
              obtained_from: { type: 'string' },
              obtained_date: { type: 'string' },
              method: { type: 'string', enum: ['public-registry', 'foia', 'court-access', 'purchase', 'provided-by-source', 'web-archive', 'field-observation'] },
              hash: { type: 'string' },
              local_path: { type: 'string' },
              archived_url: { type: 'string' },
              preservation_status: { type: 'string', enum: ['preserved', 'pending', 'unpreservable'] },
            },
          },
          summary: { type: 'string' },
        },
      },
    },
    {
      name: 'update_claim_status',
      description:
        'Create a new claim or update an existing one. ' +
        'The publishable gate is enforced: a claim cannot be marked publishable unless ' +
        'status is "corroborated" (two independent sources) OR status is "single-source" ' +
        'with at least one A1/A2-graded evidence item. ' +
        'defamation_risk "high" additionally requires comment_requested: true.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'CLM-NNN to update; omit to create a new claim.' },
          text: { type: 'string', description: 'Claim text in zero-error form: who, what, when, per which document.' },
          entity_ids: { type: 'array', items: { type: 'string' } },
          evidence_ids: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['unconfirmed', 'single-source', 'corroborated', 'contradicted', 'falsified'] },
          publishable: { type: 'boolean' },
          defamation_risk: { type: 'string', enum: ['none', 'low', 'medium', 'high'] },
          comment_requested: { type: 'boolean' },
          log_note: { type: 'string', description: 'Optional note appended to the collection_log entry.' },
        },
      },
    },
    {
      name: 'append_collection_log',
      description:
        'Append a manual audit entry to the collection_log. ' +
        'The log is append-only — existing entries cannot be edited or deleted.',
      inputSchema: {
        type: 'object',
        required: ['actor', 'action', 'notes'],
        properties: {
          actor: { type: 'string' },
          action: { type: 'string', enum: ['collected', 'preserved', 'graded', 'cited-in-draft', 'comment-requested', 'comment-received', 'claim-promoted', 'claim-killed', 'exported', 'published', 'correction', 'log-amendment'] },
          refs: { type: 'array', items: { type: 'string' }, description: 'DOC-/CLM-/ENT-/LEAD- IDs touched by this action.' },
          notes: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    let result: unknown;

    switch (name) {
      case 'init_master_file':
        result = await initMasterFile(store, args as unknown as Parameters<typeof initMasterFile>[1]);
        break;
      case 'read_master_file':
        result = readMasterFile(store);
        break;
      case 'upsert_entity':
        result = await upsertEntity(store, args as unknown as Parameters<typeof upsertEntity>[1]);
        break;
      case 'add_evidence':
        result = await addEvidence(store, args as unknown as Parameters<typeof addEvidence>[1]);
        break;
      case 'update_claim_status':
        result = await updateClaimStatus(store, args as unknown as Parameters<typeof updateClaimStatus>[1]);
        break;
      case 'append_collection_log':
        result = await appendCollectionLog(store, args as unknown as Parameters<typeof appendCollectionLog>[1]);
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: (err as Error).message }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
