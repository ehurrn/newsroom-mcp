import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { MasterFile } from './types.js';

const EMPTY: MasterFile = {
  investigation: {
    id: '',
    title: '',
    central_question: '',
    opened: '',
    legal_hold: true,
    legal_review_required: true,
  },
  entities: [],
  evidence: [],
  claims: [],
  collection_log: [],
};

type WriteTask = () => void;

/**
 * Single-owner, queue-serialized store for one master-file.json.
 * All writes are atomic (write temp → rename) so a crash mid-write
 * never leaves a partial file.
 */
export class MasterFileStore {
  private readonly filePath: string;
  private queue: Array<() => void> = [];
  private running = false;

  constructor(workspaceDir: string) {
    this.filePath = resolve(workspaceDir, 'master-file.json');
  }

  read(): MasterFile {
    if (!existsSync(this.filePath)) return structuredClone(EMPTY);
    return JSON.parse(readFileSync(this.filePath, 'utf8')) as MasterFile;
  }

  /** Serialize writes; each call returns a promise that resolves after the write commits. */
  write(mutate: (current: MasterFile) => MasterFile): Promise<MasterFile> {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        try {
          const current = this.read();
          const next = mutate(current);
          this.atomicWrite(next);
          resolve(next);
        } catch (err) {
          reject(err);
        }
        this.running = false;
        this.drain();
      });
      this.drain();
    });
  }

  private atomicWrite(data: MasterFile): void {
    const tmp = `${this.filePath}.${randomUUID()}.tmp`;
    const dir = dirname(this.filePath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    renameSync(tmp, this.filePath);
  }

  private drain(): void {
    if (this.running || this.queue.length === 0) return;
    this.running = true;
    const task = this.queue.shift()!;
    task();
  }
}
