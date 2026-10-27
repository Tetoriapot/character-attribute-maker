import { z } from 'zod';
import { e } from '../../app/exportMessages';

export const exportOptionsSchema = z.object({
  format: z.enum(['png', 'jpeg', 'webp']), width: z.number().int().min(320).max(2400), scale: z.number().min(.1).max(4),
  transparent: z.boolean(), includeTitle: z.boolean(), includeUnranked: z.boolean(),
});
export type ExportOptions = z.infer<typeof exportOptionsSchema>;
export const defaultExportOptions: ExportOptions = { format: 'png', width: 960, scale: 1, transparent: false, includeTitle: true, includeUnranked: false };
export function parseOptions(value: unknown): ExportOptions {
  const result = exportOptionsSchema.safeParse(value);
  if (!result.success) throw new Error(e.invalid);
  return { ...result.data, transparent: result.data.format !== 'jpeg' && result.data.transparent };
}
export const MAX_SIDE = 8192, MAX_PIXELS = 16_000_000;
export function outputSize(width: number, height: number, scale: number) {
  const w = Math.ceil(width * scale), h = Math.ceil(height * scale);
  if (!Number.isFinite(w + h) || w < 1 || h < 1 || w > MAX_SIDE || h > MAX_SIDE || w * h > MAX_PIXELS) throw new Error(e.limit);
  return { width: w, height: h };
}
export function safeFilename(title: string, extension: string) {
  const safe = Array.from(title).map((char) => char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? '_' : char).join('').replace(/[. ]+$/g, '');
  return `${safe || 'tier-atelier'}.${extension}`;
}
