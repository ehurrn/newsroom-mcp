import { describe, it, expect, beforeEach } from 'vitest';
import { MasterFileStore } from '../src/store.js';
import {
  initMasterFile,
  addEvidence,
  updateClaimStatus,
  appendCollectionLog,
  upsertEntity,
} from '../src/tools.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function tempStore(): { store: MasterFileStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'newsroom-mcp-test-'));
  return { store: new MasterFileStore(dir), dir };
}

const BASE_INIT = {
  id: 'INV-2026-001',
  title: 'Test Investigation',
  central_question: 'Did Acme Corp defraud the city?',
  opened: '2026-06-21',
};

describe('init_master_file', () => {
  it('initializes a fresh workspace', async () => {
    const { store } = tempStore();
    const result = await initMasterFile(store, BASE_INIT);
    expect(result.ok).toBe(true);
    expect(store.read().investigation.id).toBe('INV-2026-001');
  });

  it('refuses to reinitialize', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    await expect(initMasterFile(store, BASE_INIT)).rejects.toThrow('already initialized');
  });
});

describe('add_evidence + publishable gate', () => {
  it('blocks publishable:true with no A1/A2 evidence and single-source status', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    const ent = await upsertEntity(store, { name: 'Acme Corp', type: 'company', roles: ['subject'] });
    const ev = await addEvidence(store, {
      title: 'News article',
      source_type: 'news-secondary',
      reliability: 'C',
      credibility: '3',
      custody: { obtained_from: 'example.com', obtained_date: '2026-06-01', method: 'web-archive' },
    });

    await expect(
      updateClaimStatus(store, {
        text: 'Acme Corp defrauded the city per news-secondary source.',
        entity_ids: [ent.id],
        evidence_ids: [ev.id],
        status: 'single-source',
        publishable: true,
      }),
    ).rejects.toThrow('Publishable requires');
  });

  it('allows publishable:true with A1 evidence and single-source', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    const ent = await upsertEntity(store, { name: 'Acme Corp', type: 'company', roles: ['subject'] });
    const ev = await addEvidence(store, {
      title: 'SEC filing',
      source_type: 'regulatory-filing',
      reliability: 'A',
      credibility: '1',
      custody: { obtained_from: 'sec.gov', obtained_date: '2026-06-01', method: 'public-registry', preservation_status: 'preserved' },
    });

    const result = await updateClaimStatus(store, {
      text: 'Acme Corp filed false disclosures per SEC Form 10-K (DOC-001).',
      entity_ids: [ent.id],
      evidence_ids: [ev.id],
      status: 'single-source',
      publishable: true,
    });
    expect(result.id).toMatch(/^CLM-/);
  });

  it('blocks defamation_risk:high without comment_requested', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    const ent = await upsertEntity(store, { name: 'John Doe', type: 'person', roles: ['subject'] });
    const ev = await addEvidence(store, {
      title: 'SEC filing',
      source_type: 'regulatory-filing',
      reliability: 'A',
      credibility: '1',
      custody: { obtained_from: 'sec.gov', obtained_date: '2026-06-01', method: 'public-registry' },
    });

    await expect(
      updateClaimStatus(store, {
        text: 'John Doe committed fraud.',
        entity_ids: [ent.id],
        evidence_ids: [ev.id],
        status: 'single-source',
        publishable: true,
        defamation_risk: 'high',
        comment_requested: false,
      }),
    ).rejects.toThrow('comment_requested');
  });
});

describe('append_collection_log', () => {
  it('enforces monotonic seq and append-only', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    const { seq: s1 } = await appendCollectionLog(store, { actor: 'test', action: 'collected', notes: 'first' });
    const { seq: s2 } = await appendCollectionLog(store, { actor: 'test', action: 'preserved', notes: 'second' });
    expect(s2).toBe(s1 + 1);
    const log = store.read().collection_log;
    expect(log.length).toBeGreaterThanOrEqual(3); // init + 2
    expect(log.map((e) => e.seq)).toEqual([...log.map((e) => e.seq)].sort((a, b) => a - b));
  });
});

describe('concurrent writes', () => {
  it('serializes concurrent calls without corruption', async () => {
    const { store } = tempStore();
    await initMasterFile(store, BASE_INIT);
    const calls = Array.from({ length: 10 }, (_, i) =>
      appendCollectionLog(store, { actor: `actor-${i}`, action: 'collected', notes: `concurrent ${i}` }),
    );
    await Promise.all(calls);
    const seqs = store.read().collection_log.map((e) => e.seq);
    // All seq values unique and in order
    expect(new Set(seqs).size).toBe(seqs.length);
    const sorted = [...seqs].sort((a, b) => a - b);
    expect(seqs).toEqual(sorted);
  });
});
