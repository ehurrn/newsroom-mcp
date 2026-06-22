import type { MasterFileStore } from './store.js';
import { assertSchemaValid, assertPublishableGate, assertReferentialIntegrity } from './validate.js';
import { nextId, nextSeq } from './ids.js';
import type { MasterFile, Claim, Evidence } from './types.js';

/**
 * Shared post-mutation guard: schema → referential integrity → publishable gates.
 * Called on the *next* state before it's committed.
 */
function assertInvariants(data: MasterFile): void {
  assertSchemaValid(data);
  assertReferentialIntegrity(data);
  for (const claim of data.claims as Claim[]) {
    assertPublishableGate(claim, data.evidence as Evidence[]);
  }
}

// ---------------------------------------------------------------------------
// Tool: init_master_file
// ---------------------------------------------------------------------------

export interface InitMasterFileInput {
  id: string;           // INV-YYYY-NNN
  title: string;
  central_question: string;
  opened: string;       // ISO date
  evidence_dir?: string;
}

export async function initMasterFile(
  store: MasterFileStore,
  input: InitMasterFileInput,
): Promise<{ ok: true; message: string }> {
  const result = await store.write((current) => {
    if (current.investigation.id) {
      throw new Error(
        `master-file.json already initialized as '${current.investigation.id}'. ` +
        `Use the individual upsert tools to modify it.`,
      );
    }
    const next: MasterFile = {
      investigation: {
        id: input.id,
        title: input.title,
        central_question: input.central_question,
        opened: input.opened,
        status: 'open',
        legal_hold: true,
        legal_review_required: true,
        ...(input.evidence_dir ? { evidence_dir: input.evidence_dir } : {}),
      },
      entities: [],
      evidence: [],
      claims: [],
      collection_log: [
        {
          seq: 1,
          timestamp: new Date().toISOString(),
          actor: 'newsroom-mcp',
          action: 'collected',
          refs: [input.id],
          notes: `Investigation initialized: "${input.title}"`,
        },
      ],
    };
    assertInvariants(next);
    return next;
  });
  return { ok: true, message: `Initialized ${result.investigation.id}: "${result.investigation.title}"` };
}

// ---------------------------------------------------------------------------
// Tool: read_master_file
// ---------------------------------------------------------------------------

export function readMasterFile(store: MasterFileStore): MasterFile {
  return store.read();
}

// ---------------------------------------------------------------------------
// Tool: upsert_entity
// ---------------------------------------------------------------------------

export type UpsertEntityInput = Omit<MasterFile['entities'][number], 'id'> & { id?: string };

export async function upsertEntity(
  store: MasterFileStore,
  input: UpsertEntityInput,
): Promise<{ id: string; action: 'created' | 'updated' }> {
  let resultId = '';
  let action: 'created' | 'updated' = 'created';

  await store.write((current) => {
    const existingIdx = input.id
      ? current.entities.findIndex((e: { id: string }) => e.id === input.id)
      : -1;

    const id = input.id ?? nextId('ENT', current);
    resultId = id;

    const entity = { ...input, id } as MasterFile['entities'][number];

    const next = structuredClone(current);
    if (existingIdx >= 0) {
      next.entities[existingIdx] = entity;
      action = 'updated';
    } else {
      next.entities.push(entity);
      action = 'created';
    }

    next.collection_log.push({
      seq: nextSeq(next),
      timestamp: new Date().toISOString(),
      actor: 'newsroom-mcp',
      action: action === 'created' ? 'collected' : 'collected',
      refs: [id],
      notes: `Entity ${action}: ${entity.name} (${entity.type})`,
    });

    assertInvariants(next);
    return next;
  });

  return { id: resultId, action };
}

// ---------------------------------------------------------------------------
// Tool: add_evidence
// ---------------------------------------------------------------------------

export type AddEvidenceInput = Omit<MasterFile['evidence'][number], 'id'>;

export async function addEvidence(
  store: MasterFileStore,
  input: AddEvidenceInput,
): Promise<{ id: string }> {
  let resultId = '';

  await store.write((current) => {
    const id = nextId('DOC', current);
    resultId = id;

    const item = { ...input, id } as MasterFile['evidence'][number];

    const next = structuredClone(current);
    next.evidence.push(item);

    next.collection_log.push({
      seq: nextSeq(next),
      timestamp: new Date().toISOString(),
      actor: 'newsroom-mcp',
      action: 'collected',
      refs: [id],
      notes: `Evidence collected: "${item.title}" [${item.reliability}${item.credibility}] via ${item.custody.method}`,
    });

    assertInvariants(next);
    return next;
  });

  return { id: resultId };
}

// ---------------------------------------------------------------------------
// Tool: update_claim_status
// ---------------------------------------------------------------------------

export interface UpdateClaimStatusInput {
  id?: string;   // if omitted, creates a new claim
  text?: string;
  entity_ids?: string[];
  evidence_ids?: string[];
  status?: MasterFile['claims'][number]['status'];
  publishable?: boolean;
  defamation_risk?: MasterFile['claims'][number]['defamation_risk'];
  comment_requested?: boolean;
  log_note?: string;
}

export async function updateClaimStatus(
  store: MasterFileStore,
  input: UpdateClaimStatusInput,
): Promise<{ id: string; action: 'created' | 'updated' }> {
  let resultId = '';
  let action: 'created' | 'updated' = 'updated';

  await store.write((current) => {
    const next = structuredClone(current);
    let claim: MasterFile['claims'][number] | undefined;

    if (input.id) {
      claim = (next.claims as Claim[]).find((c: Claim) => c.id === input.id);
      if (!claim) throw new Error(`Claim ${input.id} not found`);
    } else {
      if (!input.text || !input.entity_ids || !input.status) {
        throw new Error('Creating a new claim requires text, entity_ids, and status');
      }
      const id = nextId('CLM', current);
      claim = {
        id,
        text: input.text,
        entity_ids: input.entity_ids,
        status: input.status,
      } as MasterFile['claims'][number];
      next.claims.push(claim);
      action = 'created';
    }

    resultId = claim.id;

    if (input.text !== undefined) claim.text = input.text;
    if (input.entity_ids !== undefined) claim.entity_ids = input.entity_ids;
    if (input.evidence_ids !== undefined) claim.evidence_ids = input.evidence_ids;
    if (input.status !== undefined) claim.status = input.status;
    if (input.publishable !== undefined) claim.publishable = input.publishable;
    if (input.defamation_risk !== undefined) claim.defamation_risk = input.defamation_risk;
    if (input.comment_requested !== undefined) claim.comment_requested = input.comment_requested;

    next.collection_log.push({
      seq: nextSeq(next),
      timestamp: new Date().toISOString(),
      actor: 'newsroom-mcp',
      action: claim.publishable ? 'claim-promoted' : 'collected',
      refs: [claim.id, ...(claim.evidence_ids ?? [])],
      notes: input.log_note ?? `Claim ${action}: ${claim.text.slice(0, 80)}`,
    });

    assertInvariants(next);
    return next;
  });

  return { id: resultId, action };
}

// ---------------------------------------------------------------------------
// Tool: append_collection_log (manual audit entry)
// ---------------------------------------------------------------------------

export interface AppendLogInput {
  actor: string;
  action: MasterFile['collection_log'][number]['action'];
  refs?: string[];
  notes: string;
}

export async function appendCollectionLog(
  store: MasterFileStore,
  input: AppendLogInput,
): Promise<{ seq: number }> {
  let seq = 0;

  await store.write((current) => {
    const next = structuredClone(current);
    seq = nextSeq(next);
    next.collection_log.push({
      seq,
      timestamp: new Date().toISOString(),
      actor: input.actor,
      action: input.action,
      refs: input.refs ?? [],
      notes: input.notes,
    });
    assertSchemaValid(next);
    return next;
  });

  return { seq };
}
