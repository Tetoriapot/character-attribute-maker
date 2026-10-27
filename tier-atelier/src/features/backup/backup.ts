import { z } from 'zod';
import type { Project } from '../../data/types';
import type { StoredBlob } from '../../data/db';
import { migrateProject } from '../../data/migrations';
import { MAX_IMAGE_BYTES, MAX_PROJECT_BYTES, MiB, prepareImage } from '../assets/images';
import { storageText as s } from '../../app/storageMessages';

const envelopeSchema = z.object({
  format: z.literal('tier-atelier'), backupVersion: z.literal(1), project: z.unknown(),
  blobs: z.array(z.object({ key: z.string().min(1).max(200), mimeType: z.string(), dataBase64: z.string().max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4) })),
});

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: string[] = [];
  for (let start = 0; start < bytes.length; start += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(start, start + 0x8000)));
  return btoa(chunks.join(''));
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  if (!value || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error(s.invalidBackup);
  const decoded = atob(value);
  if (btoa(decoded) !== value) throw new Error(s.invalidBackup);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function createBackup(project: Project, records: Map<string, StoredBlob>): Promise<Blob> {
  const blobs = [];
  for (const key of new Set(Object.values(project.assets).map((asset) => asset.blobKey))) {
    const record = records.get(key);
    if (!record) throw new Error(s.missingBlob);
    blobs.push({ key, mimeType: record.blob.type, dataBase64: await toBase64(record.blob) });
  }
  const result = new Blob([JSON.stringify({ format: 'tier-atelier', backupVersion: 1, project, blobs }, null, 2)], { type: 'application/json' });
  if (result.size > 256 * MiB) throw new Error(s.backupLimit);
  return result;
}

export async function readBackup(file: File, decode = prepareImage): Promise<{ project: Project; blobs: StoredBlob[] }> {
  if (!file.size || file.size > 256 * MiB) throw new Error(s.backupLimit);
  if (!/\.json$/i.test(file.name) || (file.type && !['application/json', 'text/json', 'text/plain'].includes(file.type))) throw new Error(s.invalidJson);
  let value: unknown;
  try { value = JSON.parse(await file.text()); } catch { throw new Error(s.invalidJson); }
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) throw new Error(s.invalidJson);
  const project = structuredClone(migrateProject(parsed.data.project));
  const entries = parsed.data.blobs;
  const required = new Set(Object.values(project.assets).map((asset) => asset.blobKey));
  if (entries.length !== required.size || new Set(entries.map((entry) => entry.key)).size !== entries.length || entries.some((entry) => !required.has(entry.key))) throw new Error(s.missingBlob);
  let bytesTotal = 0;
  const blobs: StoredBlob[] = [];
  for (const entry of entries) {
    const bytes = fromBase64(entry.dataBase64);
    bytesTotal += bytes.length;
    if (bytesTotal > MAX_PROJECT_BYTES) throw new Error(s.projectLimit);
    const prepared = await decode(new Blob([bytes], { type: entry.mimeType }), 'backup', false);
    const assets = Object.values(project.assets).filter((asset) => asset.blobKey === entry.key);
    if (assets.some((asset) => asset.mimeType !== prepared.asset.mimeType || asset.width !== prepared.asset.width || asset.height !== prepared.asset.height)) throw new Error(s.invalidBackup);
    for (const asset of assets) asset.blobKey = prepared.record.id;
    blobs.push(prepared.record);
  }
  // Nested IDs are scoped to the project. Preserve them (and unknown fields); remap only the project and Blob keys.
  project.id = crypto.randomUUID();
  project.createdAt = project.updatedAt = new Date().toISOString();
  return { project, blobs };
}

let lastDownload: string | undefined;
export function downloadBackup(blob: Blob, title: string) {
  if (lastDownload) URL.revokeObjectURL(lastDownload);
  lastDownload = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = lastDownload;
  const filename = Array.from(title).map((character) => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character).join('');
  link.download = `${filename || 'tier-atelier'}.tier.json`;
  link.click();
}
