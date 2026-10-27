import { produce } from 'immer';
import { z } from 'zod';
import type { ID, Item, Project, Tier } from '../../data/types';
import { createTier } from '../../data/defaults';
import { t } from '../../app/messages';

export type EditorCommand =
  | { type: 'project.update'; title: string; description: string }
  | { type: 'tier.add'; afterId?: ID }
  | { type: 'tier.update'; id: ID; name: string; background: string; foreground: string }
  | { type: 'tier.lock'; id: ID; locked: boolean }
  | { type: 'tier.delete' | 'tier.duplicate'; id: ID }
  | { type: 'tier.move'; id: ID; index: number }
  | { type: 'item.add'; name: string; description: string; tags: string[] }
  | { type: 'item.update'; id: ID; name: string; description: string; tags: string[] }
  | { type: 'item.delete'; id: ID }
  | { type: 'item.move'; id: ID; tierId: ID | null; index?: number };

export class EditorError extends Error {}
const nameSchema = z.string().trim().min(1).max(80);
const titleSchema = z.string().trim().min(1).max(120);
const colorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);
function validate<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new EditorError(message);
  return result.data;
}
function details(command: { name: string; description: string; tags: string[] }) {
  return {
    name: validate(nameSchema, command.name, t.errors.name),
    description: validate(z.string().max(1000), command.description, t.errors.description),
    tags: [...new Set(validate(z.array(z.string().trim().min(1).max(30)).max(20), command.tags, t.errors.tags))],
  };
}
function getTier(project: Project, id: ID): Tier {
  const tier = project.tiers.find((entry) => entry.id === id);
  if (!tier) throw new EditorError(t.errors.missing);
  return tier;
}
function ensureUnlocked(tier?: Tier) {
  if (tier?.locked) throw new EditorError(t.errors.locked);
}
export function itemLocation(project: Project, id: ID): ID | null {
  return project.tiers.find((tier) => tier.itemIds.includes(id))?.id ?? null;
}
function getItem(project: Project, id: ID): Item {
  const item = project.items[id];
  if (!item) throw new EditorError(t.errors.missing);
  const tierId = itemLocation(project, id);
  ensureUnlocked(tierId ? getTier(project, tierId) : undefined);
  return item;
}
export function itemIdsAt(project: Project, tierId: ID | null): ID[] {
  return tierId === null ? project.unrankedItemIds : getTier(project, tierId).itemIds;
}
function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index)) throw new EditorError(t.errors.invalidMove);
  return Math.max(0, Math.min(Math.trunc(index), length));
}

// All placements change in one Immer transaction; a canceled or rejected command keeps the original state.
export function editProject(project: Project, command: EditorCommand): Project {
  const next = produce(project, (draft) => {
    switch (command.type) {
      case 'project.update':
        draft.title = validate(titleSchema, command.title, t.errors.title);
        draft.description = validate(z.string().max(1000), command.description, t.errors.description);
        break;
      case 'tier.add': {
        const index = command.afterId ? draft.tiers.indexOf(getTier(draft, command.afterId)) + 1 : draft.tiers.length;
        draft.tiers.splice(index, 0, createTier());
        break;
      }
      case 'tier.update': {
        const tier = getTier(draft, command.id);
        ensureUnlocked(tier);
        tier.name = validate(nameSchema, command.name, t.errors.name);
        tier.background = validate(colorSchema, command.background, t.errors.color);
        tier.foreground = validate(colorSchema, command.foreground, t.errors.color);
        break;
      }
      case 'tier.lock': getTier(draft, command.id).locked = command.locked; break;
      case 'tier.delete': {
        const tier = getTier(draft, command.id);
        ensureUnlocked(tier);
        draft.unrankedItemIds.push(...tier.itemIds);
        draft.tiers.splice(draft.tiers.indexOf(tier), 1);
        break;
      }
      case 'tier.duplicate': {
        const tier = getTier(draft, command.id);
        draft.tiers.splice(draft.tiers.indexOf(tier) + 1, 0, {
          ...tier, id: crypto.randomUUID(), name: `${tier.name.slice(0, 76)}${t.copySuffix}`, itemIds: [],
        });
        break;
      }
      case 'tier.move': {
        const tier = getTier(draft, command.id);
        ensureUnlocked(tier);
        const from = draft.tiers.indexOf(tier);
        const to = clampIndex(command.index, draft.tiers.length - 1);
        if (from === to) return;
        draft.tiers.splice(from, 1);
        draft.tiers.splice(to, 0, tier);
        break;
      }
      case 'item.add': {
        const item: Item = { ...details(command), id: crypto.randomUUID(), assetId: null, createdAt: new Date().toISOString() };
        draft.items[item.id] = item;
        draft.unrankedItemIds.push(item.id);
        break;
      }
      case 'item.update': Object.assign(getItem(draft, command.id), details(command)); break;
      case 'item.delete': {
        getItem(draft, command.id);
        const ids = itemIdsAt(draft, itemLocation(draft, command.id));
        ids.splice(ids.indexOf(command.id), 1);
        delete draft.items[command.id];
        break;
      }
      case 'item.move': {
        getItem(draft, command.id);
        if (command.tierId !== null) ensureUnlocked(getTier(draft, command.tierId));
        const source = itemIdsAt(draft, itemLocation(draft, command.id));
        const destination = itemIdsAt(draft, command.tierId);
        const from = source.indexOf(command.id);
        const to = clampIndex(command.index ?? destination.length, destination.length - (source === destination ? 1 : 0));
        if (source === destination && from === to) return;
        source.splice(from, 1);
        destination.splice(to, 0, command.id);
        break;
      }
    }
  });
  return next === project ? project : { ...next, updatedAt: new Date().toISOString() };
}

export function hasValidPlacements(project: Project): boolean {
  const ids = [...project.unrankedItemIds, ...project.tiers.flatMap((tier) => tier.itemIds)];
  return new Set(project.tiers.map((tier) => tier.id)).size === project.tiers.length
    && ids.length === Object.keys(project.items).length && new Set(ids).size === ids.length
    && ids.every((id) => Object.hasOwn(project.items, id) && project.items[id]?.id === id);
}
