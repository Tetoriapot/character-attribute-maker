import type { Asset, Item } from '../../data/types';
import type { StoredBlob } from '../../data/db';
import { storageText as s } from '../../app/storageMessages';

export const MiB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * MiB;
export const MAX_PROJECT_BYTES = 128 * MiB;
const extensions: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
export interface PreparedImage { asset: Asset; item: Item; record: StoredBlob }

// Read dimensions before decoding, so compressed images with excessive pixel counts are rejected early.
export function inspectImage(bytes: Uint8Array): { mimeType: string; width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  let mimeType = '', width = 0, height = 0;
  if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 8) === 'PNG\r\n\x1a\n' && ascii(12, 16) === 'IHDR') {
    mimeType = 'image/png'; width = view.getUint32(16); height = view.getUint32(20);
  } else if (bytes.length >= 10 && ['GIF87a', 'GIF89a'].includes(ascii(0, 6))) {
    mimeType = 'image/gif'; width = view.getUint16(6, true); height = view.getUint16(8, true);
  } else if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    mimeType = 'image/webp';
    for (let p = 12; p + 8 <= bytes.length;) {
      const kind = ascii(p, p + 4), size = view.getUint32(p + 4, true), d = p + 8;
      if (d + size > bytes.length) throw new Error(s.invalidImage);
      if (kind === 'VP8X' && size >= 10) {
        width = 1 + bytes[d + 4]! + bytes[d + 5]! * 256 + bytes[d + 6]! * 65536;
        height = 1 + bytes[d + 7]! + bytes[d + 8]! * 256 + bytes[d + 9]! * 65536; break;
      }
      if (kind === 'VP8 ' && size >= 10) { width = view.getUint16(d + 6, true) & 0x3fff; height = view.getUint16(d + 8, true) & 0x3fff; break; }
      if (kind === 'VP8L' && size >= 5 && bytes[d] === 0x2f) {
        const bits = view.getUint32(d + 1, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; break;
      }
      p = d + size + (size % 2);
    }
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    mimeType = 'image/jpeg';
    let p = 2;
    while (p + 3 < bytes.length) {
      if (bytes[p++] !== 0xff) break;
      while (bytes[p] === 0xff) p++;
      const marker = bytes[p++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker !== undefined && marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > bytes.length) break;
      const length = view.getUint16(p);
      if (length < 2 || p + length > bytes.length) break;
      if (marker !== undefined && [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        height = view.getUint16(p + 3); width = view.getUint16(p + 5); break;
      }
      p += length;
    }
  }
  if (!mimeType || !width || !height) throw new Error(s.invalidImage);
  if (width > 8192 || height > 8192 || width * height > 32_000_000) throw new Error(s.imageSize);
  return { mimeType, width, height };
}

export async function prepareImage(blob: Blob, originalName: string, checkExtension = true): Promise<PreparedImage> {
  if (!blob.size) throw new Error(s.emptyFile);
  if (blob.size > MAX_IMAGE_BYTES) throw new Error(s.imageSize);
  const info = inspectImage(new Uint8Array(await blob.arrayBuffer()));
  const extension = originalName.split('.').at(-1)?.toLowerCase() ?? '';
  if ((blob.type && blob.type !== info.mimeType) || (checkExtension && extensions[extension] !== info.mimeType)) throw new Error(s.imageFormat);
  const normalized = blob.slice(0, blob.size, info.mimeType);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(normalized); } catch { throw new Error(s.invalidImage); }
  let thumbnail: Blob;
  try {
    // JPEG EXIF orientation can swap the dimensions returned by the decoder.
    if (bitmap.width * bitmap.height !== info.width * info.height) throw new Error(s.invalidImage);
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error(s.invalidImage);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    thumbnail = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error(s.invalidImage)), 'image/png'));
  } finally { bitmap.close(); }
  const id = crypto.randomUUID(), blobKey = crypto.randomUUID();
  return {
    asset: { id, blobKey, ...info, originalName: originalName.slice(0, 1024) },
    item: { id: crypto.randomUUID(), assetId: id, name: originalName.replace(/\.[^.]+$/, '').trim().slice(0, 80) || s.imageType, description: '', tags: [], createdAt: new Date().toISOString() },
    record: { id: blobKey, blob: normalized, thumbnail },
  };
}

export function validateBatch(files: File[]) {
  if (files.length > 100 || files.reduce((sum, file) => sum + file.size, 0) > 100 * MiB) throw new Error(s.batchLimit);
}

export function totalBytes(records: Iterable<StoredBlob>) {
  let total = 0;
  for (const record of records) total += record.blob.size;
  return total;
}
