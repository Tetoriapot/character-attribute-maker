import { z } from 'zod';
import type { Project } from '../../data/types';
import { migrateProject } from '../../data/migrations';
import { e } from '../../app/exportMessages';

export const MAX_SHARE_URL = 8000;
const envelope = z.object({ format: z.literal('tier-atelier-url'), version: z.literal(1), project: z.unknown() });
export function textOnly(project: Project) { return !Object.keys(project.assets).length && !project.style.backgroundAssetId && Object.values(project.items).every((item) => item.assetId === null); }
export function createShareUrl(project: Project, address: string): string {
  if (!textOnly(project)) throw new Error(e.urlImages);
  const json = JSON.stringify({ format: 'tier-atelier-url', version: 1, project });
  if (json.length > MAX_SHARE_URL) throw new Error(e.urlLimit);
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(address); url.search = ''; url.hash = `tier=${encoded}`;
  if (url.href.length > MAX_SHARE_URL) throw new Error(e.urlLimit);
  return url.href;
}
export function readShareHash(hash: string): Project {
  try {
    if (!hash.startsWith('#tier=') || hash.length > MAX_SHARE_URL) throw new Error();
    const value = hash.slice(6);
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
    const parsed = envelope.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    const project = migrateProject(parsed.project);
    if (!textOnly(project)) throw new Error();
    return project;
  } catch { throw new Error(e.invalidUrl); }
}

let downloadUrl: string | undefined;
export function downloadFile(file: File) {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(file);
  const link = document.createElement('a'); link.href = downloadUrl; link.download = file.name; link.click();
}
export async function shareFile(file: File): Promise<string> {
  try {
    if (!navigator.canShare?.({ files: [file] }) || !navigator.share) { downloadFile(file); return e.fallback; }
    // File preparation happens before this user click, preserving transient activation.
    await navigator.share({ files: [file], title: file.name });
    return e.shareDone;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return e.canceled;
    throw new Error(e.shareError, { cause: error });
  }
}
