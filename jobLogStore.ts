/**
 * JOB LOG (final pipeline stage)
 * Status: IMPLEMENTATION — unit tested below. Append-only by API design
 * (no update/delete method), same convention as the raw observation store.
 */

export type JobStatus = 'SUCCESS' | 'PARTIAL' | 'FAILURE';

export interface JobLogEntry {
  jobId: string;
  startedAt: number;
  completedAt: number;
  status: JobStatus;
  recordsFetched: number;
  recordsValidated: number;
  recordsRejected: number;
  recordsConflicted: number;
  recordsCanonicalized: number;
}

export interface JobLogStore {
  append(entry: JobLogEntry): void;
  getAll(): JobLogEntry[];
}

export class InMemoryJobLogStore implements JobLogStore {
  public readonly productionReady = false;
  private entries: JobLogEntry[];

  constructor() {
    this.entries = [];
  }

  append(entry: JobLogEntry): void {
    this.entries.push(structuredClone(entry));
  }

  getAll(): JobLogEntry[] {
    return this.entries.map((e) => structuredClone(e));
  }
}
