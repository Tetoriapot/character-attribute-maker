import Dexie, { type Table } from 'dexie';
import type { Project } from './types';
import { createProject } from './defaults';
import { migrateProject } from './migrations';
import { storageText as s } from '../app/storageMessages';

export interface StoredBlob { id: string; blob: Blob; thumbnail: Blob }
export interface StoredProject { id: string; updatedAt: string; revision: number; project: Project }
export interface ProjectSummary { id: string; title: string; updatedAt: string; count: number }
export class ConflictError extends Error { constructor() { super(s.conflict); } }
export class AtelierDatabase extends Dexie {
  projects!: Table<StoredProject, string>;
  blobs!: Table<StoredBlob, string>;
  settings!: Table<{ key: string; value: string }, string>;
  constructor(name = 'tier-atelier') {
    super(name);
    this.version(1).stores({ projects: '&id, updatedAt', blobs: '&id', settings: '&key' });
  }
}
export const db = new AtelierDatabase();

export async function bootstrap(database = db): Promise<string> {
  return database.transaction('rw', database.projects, database.settings, async () => {
    const active = await database.settings.get('activeProject');
    if (active && await database.projects.get(active.value)) return active.value;
    const first = await database.projects.orderBy('updatedAt').last();
    if (first) return first.id;
    const project = createProject();
    await database.projects.add({ id: project.id, updatedAt: project.updatedAt, revision: 1, project });
    await database.settings.put({ key: 'activeProject', value: project.id });
    return project.id;
  });
}

export async function loadProject(id: string, database = db) {
  return database.transaction('r', database.projects, database.blobs, async () => {
    const row = await database.projects.get(id);
    if (!row) throw new Error(s.loadError);
    const project = migrateProject(row.project);
    const records = await database.blobs.bulkGet([...new Set(Object.values(project.assets).map((asset) => asset.blobKey))]);
    if (records.some((record) => !record || !(record.blob instanceof Blob) || !(record.thumbnail instanceof Blob) || !record.blob.size || !record.thumbnail.size)) throw new Error(s.missingBlob);
    return { project, revision: row.revision, blobs: records.filter((record): record is StoredBlob => !!record) };
  });
}

export async function listProjects(database = db): Promise<ProjectSummary[]> {
  const rows = await database.projects.orderBy('updatedAt').reverse().toArray();
  return rows.map((row) => ({ id: row.id, title: row.project.title, updatedAt: row.updatedAt, count: Object.keys(row.project.items).length }));
}

// Image decoding and Base64 conversion happen before the transaction, so it cannot auto-commit midway.
export async function saveSnapshot(project: Project, expectedRevision: number, pending: StoredBlob[], database = db, recover: Map<string, StoredBlob> = new Map()): Promise<number> {
  return database.transaction('rw', database.projects, database.blobs, async () => {
    const existing = await database.projects.get(project.id);
    if ((existing?.revision ?? 0) !== expectedRevision) throw new ConflictError();
    for (const record of pending) {
      if (await database.blobs.get(record.id)) throw new Error(s.invalidBackup);
      await database.blobs.add(record);
    }
    for (const key of new Set(Object.values(project.assets).map((asset) => asset.blobKey))) {
      if (!await database.blobs.get(key)) {
        const record = recover.get(key);
        if (!record) throw new Error(s.missingBlob);
        await database.blobs.add(record);
      }
    }
    const revision = expectedRevision + 1;
    await database.projects.put({ id: project.id, project, revision, updatedAt: project.updatedAt });
    const referenced = new Set(Object.values(project.assets).map((asset) => asset.blobKey));
    const removed = Object.values(existing?.project.assets ?? {}).map((asset) => asset.blobKey).filter((key) => !referenced.has(key));
    if (removed.length) {
      const all = await database.projects.toArray();
      const used = new Set(all.flatMap((row) => Object.values(row.project.assets).map((asset) => asset.blobKey)));
      await database.blobs.bulkDelete(removed.filter((key) => !used.has(key)));
    }
    return revision;
  });
}

export async function deleteProject(id: string, expectedRevision: number | undefined, database = db) {
  await database.transaction('rw', database.projects, database.blobs, database.settings, async () => {
    const row = await database.projects.get(id);
    if (!row || (expectedRevision !== undefined && row.revision !== expectedRevision)) throw new ConflictError();
    await database.projects.delete(id);
    const others = await database.projects.toArray();
    const used = new Set(others.flatMap((entry) => Object.values(entry.project.assets).map((asset) => asset.blobKey)));
    const unused = Object.values(row.project.assets).map((asset) => asset.blobKey).filter((key) => !used.has(key));
    await database.blobs.bulkDelete(unused);
    const active = await database.settings.get('activeProject');
    if (active?.value === id) await database.settings.delete('activeProject');
  });
}
