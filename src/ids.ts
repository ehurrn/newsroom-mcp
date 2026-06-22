import type { MasterFile } from './types.js';

type IdPrefix = 'ENT' | 'DOC' | 'CLM' | 'REL' | 'EVT' | 'GAP' | 'LEAD';
type CollectionKey = 'entities' | 'evidence' | 'claims' | 'relationships' | 'timeline' | 'gaps' | 'leads';

const PREFIX_MAP: Record<IdPrefix, CollectionKey> = {
  ENT: 'entities',
  DOC: 'evidence',
  CLM: 'claims',
  REL: 'relationships',
  EVT: 'timeline',
  GAP: 'gaps',
  LEAD: 'leads',
};

/** Allocate the next sequential ID for a given prefix, e.g. "ENT-004". */
export function nextId(prefix: IdPrefix, data: MasterFile): string {
  const key = PREFIX_MAP[prefix];
  const arr = (data[key] as Array<{ id: string }> | undefined) ?? [];
  const max = arr.reduce((m, item) => {
    const n = parseInt(item.id.replace(`${prefix}-`, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  const width = prefix === 'LEAD' ? 3 : 3;
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}

/** Next monotonic sequence number for the collection_log. */
export function nextSeq(data: MasterFile): number {
  const log = data.collection_log ?? [];
  return log.length === 0 ? 1 : (log[log.length - 1]?.seq ?? 0) + 1;
}
