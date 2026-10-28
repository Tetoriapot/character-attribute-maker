import { z } from 'zod';
import type { Project } from './types';
import { storageText as s } from '../app/storageMessages';
import { MIN_LABEL_WIDTH, MAX_LABEL_WIDTH } from '../features/design/labelWidth';

// IDs remain opaque strings for compatibility. Prototype-sensitive dictionary keys are rejected.
const id = z.string().min(1).max(200).refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const name = z.string().trim().min(1).max(80);
export const cropSchema = z.looseObject({ x: z.number().min(0).max(.99), y: z.number().min(0).max(.99), width: z.number().min(.01).max(1), height: z.number().min(.01).max(1) }).refine((c) => c.x + c.width <= 1.000001 && c.y + c.height <= 1.000001);
const item = z.looseObject({ id, assetId: id.nullable(), name, description: z.string().max(1000), tags: z.array(z.string().min(1).max(30)).max(20), createdAt: date, crop: cropSchema.nullable().optional() });
export const labelSizingSchema = z.object({ labelWidthMode: z.enum(['auto', 'manual']), labelWidth: z.number().min(MIN_LABEL_WIDTH).max(MAX_LABEL_WIDTH) });
const tier = z.looseObject({ id, name, background: color, foreground: color, itemIds: z.array(id), minHeight: z.number().finite().positive().optional(), labelWidth: labelSizingSchema.shape.labelWidth.optional(), locked: z.boolean().optional() });
const asset = z.looseObject({ id, blobKey: id, mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']), width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192), originalName: z.string().min(1).max(1024) });
export const styleSchema = z.looseObject({
  background: color, fontFamily: z.string().min(1).max(300), labelWidth: z.number().finite().positive(), itemSize: z.number().finite().positive(), gap: z.number().finite().nonnegative(), radius: z.number().finite().nonnegative(), imageFit: z.enum(['cover', 'contain']), showItemNames: z.boolean(), showTitle: z.boolean(), borderColor: color,
  backgroundMode: z.enum(['solid', 'gradient', 'pattern', 'image']).optional(), backgroundAssetId: id.nullable().optional(), backgroundSecondary: color.optional(),
  gradientAngle: z.number().min(0).max(360).optional(), pattern: z.enum(['dots', 'grid', 'stripes']).optional(), textColor: color.optional(),
  fontSize: z.number().min(10).max(32).optional(), labelFontSize: z.number().min(12).max(64).optional(), padding: z.number().min(0).max(48).optional(),
  rowGap: z.number().min(0).max(32).optional(), borderWidth: z.number().min(0).max(8).optional(), borderStyle: z.enum(['solid', 'dashed', 'double']).optional(),
  cardBackground: color.optional(), cardTextColor: color.optional(), shadow: z.enum(['none', 'soft', 'hard']).optional(), titleSize: z.number().min(16).max(64).optional(),
  titleAlign: z.enum(['left', 'center', 'right']).optional(), titleDecoration: z.enum(['none', 'line', 'band']).optional(),
  showImageNames: z.boolean().optional(),
  labelWidthMode: labelSizingSchema.shape.labelWidthMode.optional(),
});
// Older documents keep their previously valid size values. Newly edited values use the UI limits.
export const editedStyleSchema = styleSchema.extend({ labelWidth: labelSizingSchema.shape.labelWidth, itemSize: z.number().min(40).max(200), gap: z.number().min(0).max(40), radius: z.number().min(0).max(40) });
export const projectSchema = z.looseObject({
  schemaVersion: z.literal(1), id, title: z.string().trim().min(1).max(120), description: z.string().max(1000), createdAt: date, updatedAt: date,
  tiers: z.array(tier), unrankedItemIds: z.array(id), items: z.record(id, item), assets: z.record(id, asset),
  style: styleSchema,
});

export function parseProject(value: unknown): Project {
  const result = projectSchema.safeParse(value);
  if (!result.success) throw new Error(s.invalidSchema);
  const project = result.data;
  const placements = [...project.unrankedItemIds, ...project.tiers.flatMap((entry) => entry.itemIds)];
  if (new Set(project.tiers.map((entry) => entry.id)).size !== project.tiers.length
    || project.tiers.some((tier) => tier.id === 'unranked' || Object.hasOwn(project.items, tier.id))
    || placements.length !== Object.keys(project.items).length || new Set(placements).size !== placements.length
    || placements.some((key) => !Object.hasOwn(project.items, key))
    || Object.entries(project.items).some(([key, value]) => key !== value.id || (value.assetId !== null && !Object.hasOwn(project.assets, value.assetId)))
    || (project.style.backgroundAssetId != null && !Object.hasOwn(project.assets, project.style.backgroundAssetId))
    || Object.values(project.items).some((item) => item.crop && item.assetId === null)
    || Object.entries(project.assets).some(([key, value]) => key !== value.id || value.width * value.height > 32_000_000)) throw new Error(s.invalidSchema);
  return project;
}
