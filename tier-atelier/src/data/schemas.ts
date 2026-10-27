import { z } from 'zod';
import type { Project } from './types';
import { storageText as s } from '../app/storageMessages';

// IDs remain opaque strings for compatibility. Prototype-sensitive dictionary keys are rejected.
const id = z.string().min(1).max(200).refine((value) => !['__proto__', 'constructor', 'prototype'].includes(value));
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const date = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const name = z.string().trim().min(1).max(80);
const item = z.looseObject({ id, assetId: id.nullable(), name, description: z.string().max(1000), tags: z.array(z.string().min(1).max(30)).max(20), createdAt: date });
const tier = z.looseObject({ id, name, background: color, foreground: color, itemIds: z.array(id), minHeight: z.number().finite().positive().optional(), locked: z.boolean().optional() });
const asset = z.looseObject({ id, blobKey: id, mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']), width: z.number().int().positive().max(8192), height: z.number().int().positive().max(8192), originalName: z.string().min(1).max(1024) });
export const projectSchema = z.looseObject({
  schemaVersion: z.literal(1), id, title: z.string().trim().min(1).max(120), description: z.string().max(1000), createdAt: date, updatedAt: date,
  tiers: z.array(tier), unrankedItemIds: z.array(id), items: z.record(id, item), assets: z.record(id, asset),
  style: z.looseObject({ background: color, fontFamily: z.string().min(1).max(300), labelWidth: z.number().finite().positive(), itemSize: z.number().finite().positive(), gap: z.number().finite().nonnegative(), radius: z.number().finite().nonnegative(), imageFit: z.enum(['cover', 'contain']), showItemNames: z.boolean(), showTitle: z.boolean(), borderColor: color }),
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
    || Object.entries(project.assets).some(([key, value]) => key !== value.id || value.width * value.height > 32_000_000)) throw new Error(s.invalidSchema);
  return project;
}
