import { produce, type PatchListener } from 'immer';
import { z } from 'zod';
import type { Asset, Crop, ID, Item, Project, Tier, TierStyle } from '../../data/types';
import { createTier } from '../../data/defaults';
import { t } from '../../app/messages';
import { d } from '../../app/designMessages';
import { cropSchema, editedStyleSchema } from '../../data/schemas';
import { cardKeys, rankKeys, type ThemeScope } from '../design/settings';
import { themes, rankPresets } from '../design/templates';

export type EditorCommand =
  | { type: 'project.update'; title: string; description: string }
  | { type: 'tier.add'; afterId?: ID }
  | { type: 'tier.update'; id: ID; name: string; background: string; foreground: string; minHeight?: number; labelWidth?: number | null }
  | { type: 'design.update'; style: Partial<TierStyle> }
  | { type: 'design.theme'; id: string; scope: ThemeScope }
  | { type: 'design.ranks'; id: string }
  | { type: 'design.background'; asset: Asset | null }
  | { type: 'item.crop'; id: ID; crop: Crop | null }
  | { type: 'tier.lock'; id: ID; locked: boolean }
  | { type: 'tier.delete' | 'tier.duplicate'; id: ID }
  | { type: 'tier.move'; id: ID; index: number }
  | { type: 'item.add'; name: string; description: string; tags: string[] }
  | { type: 'images.add'; images: { asset: Asset; item: Item }[] }
  | { type: 'item.update'; id: ID; name: string; description: string; tags: string[] }
  | { type: 'item.delete' | 'item.duplicate'; id: ID }
  | { type: 'item.move'; id: ID; tierId: ID | null; index?: number }
  | { type: 'items.move'; ids: ID[]; tierId: ID | null; index?: number };

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
function releaseAsset(project: Project, id: ID | null | undefined) {
  if (id && project.style.backgroundAssetId !== id && !Object.values(project.items).some((item) => item.assetId === id)) delete project.assets[id];
}

// All placements change in one Immer transaction; a canceled or rejected command keeps the original state.
export function editProject(project: Project, command: EditorCommand, listener?: PatchListener): Project {
  const next = produce(project, (draft) => {
    switch (command.type) {
      case 'design.update': {
        const style = validate(editedStyleSchema, { ...draft.style, ...command.style }, d.invalid);
        if (style.backgroundAssetId && !draft.assets[style.backgroundAssetId]) throw new EditorError(d.invalid);
        // Background references are managed by design.background so old blobs can be reclaimed safely.
        if ((style.backgroundAssetId ?? null) !== (draft.style.backgroundAssetId ?? null)) throw new EditorError(d.invalid);
        draft.style = style;
        break;
      }
      case 'design.theme':
      case 'design.ranks': {
        const preset = (command.type === 'design.theme' ? themes : rankPresets).find((entry) => entry.id === command.id);
        if (!preset) throw new EditorError(d.invalid);
        if (command.type === 'design.ranks' || command.scope !== 'cards') {
          draft.tiers.forEach((tier, index) => {
            if (!tier.locked) { tier.background = preset.colors[index % preset.colors.length]!; tier.foreground = preset.foreground; }
          });
        }
        if (command.type === 'design.theme') {
          const theme = themes.find((entry) => entry.id === command.id)!;
          // Keep the user's image-name preference when changing visual templates.
          const keys = command.scope === 'ranks' ? rankKeys : command.scope === 'cards' ? cardKeys : (Object.keys(theme.style) as (keyof TierStyle)[]).filter((key) => key !== 'backgroundAssetId' && key !== 'showImageNames');
          const patch = Object.fromEntries(keys.map((key) => [key, theme.style[key]]));
          Object.assign(draft.style, patch);
        }
        break;
      }
      case 'design.background': {
        const previous = draft.style.backgroundAssetId;
        if (command.asset) {
          if (draft.assets[command.asset.id]) throw new EditorError(d.invalid);
          draft.assets[command.asset.id] = command.asset;
        }
        draft.style.backgroundAssetId = command.asset?.id ?? null;
        draft.style.backgroundMode = command.asset ? 'image' : 'solid';
        releaseAsset(draft, previous);
        break;
      }
      case 'item.crop': {
        const item = getItem(draft, command.id);
        if (!item.assetId) throw new EditorError(d.cropInvalid);
        item.crop = command.crop === null ? null : { ...item.crop, ...validate(cropSchema, command.crop, d.cropInvalid) };
        break;
      }
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
        if (command.minHeight !== undefined) tier.minHeight = validate(z.number().min(64).max(400), command.minHeight, d.invalid);
        if (command.labelWidth === null) delete tier.labelWidth;
        else if (command.labelWidth !== undefined) tier.labelWidth = validate(z.number().min(48).max(240), command.labelWidth, d.invalid);
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
      case 'images.add': {
        for (const { asset, item } of command.images) {
          if (draft.assets[asset.id] || draft.items[item.id] || item.assetId !== asset.id) throw new EditorError(t.errors.unexpected);
          draft.assets[asset.id] = asset;
          draft.items[item.id] = item;
          draft.unrankedItemIds.push(item.id);
        }
        break;
      }
      case 'item.duplicate': {
        const original = getItem(draft, command.id);
        const item = { ...original, id: crypto.randomUUID(), name: `${original.name.slice(0, 76)}${t.copySuffix}`, createdAt: new Date().toISOString() };
        const ids = itemIdsAt(draft, itemLocation(draft, command.id));
        draft.items[item.id] = item;
        ids.splice(ids.indexOf(command.id) + 1, 0, item.id);
        break;
      }
      case 'item.update': Object.assign(getItem(draft, command.id), details(command)); break;
      case 'item.delete': {
        const assetId = getItem(draft, command.id).assetId;
        const ids = itemIdsAt(draft, itemLocation(draft, command.id));
        ids.splice(ids.indexOf(command.id), 1);
        delete draft.items[command.id];
        releaseAsset(draft, assetId);
        break;
      }
      case 'items.move': {
        const selected = new Set(command.ids);
        if (!selected.size || selected.size !== command.ids.length || command.ids.some((id) => !draft.items[id])) throw new EditorError(t.errors.missing);
        if (command.tierId !== null) ensureUnlocked(getTier(draft, command.tierId));
        for (const tier of draft.tiers) if (tier.itemIds.some((id) => selected.has(id))) ensureUnlocked(tier);
        const ordered = [...draft.tiers.flatMap((tier) => tier.itemIds), ...draft.unrankedItemIds].filter((id) => selected.has(id));
        const target = itemIdsAt(draft, command.tierId);
        const index = clampIndex(command.index ?? target.length, target.length);
        const to = index - target.slice(0, index).filter((id) => selected.has(id)).length;
        const placements = [...draft.tiers.map((tier) => ({ id: tier.id, ids: tier.itemIds })), { id: null, ids: draft.unrankedItemIds }];
        for (const placement of placements) {
          const ids = placement.ids.filter((id) => !selected.has(id));
          if (placement.id === command.tierId) ids.splice(to, 0, ...ordered);
          if (ids.length === placement.ids.length && ids.every((id, index) => id === placement.ids[index])) continue;
          if (placement.id === null) draft.unrankedItemIds = ids;
          else getTier(draft, placement.id).itemIds = ids;
        }
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
  }, listener);
  return next === project ? project : { ...next, updatedAt: new Date().toISOString() };
}

export function hasValidPlacements(project: Project): boolean {
  const ids = [...project.unrankedItemIds, ...project.tiers.flatMap((tier) => tier.itemIds)];
  return new Set(project.tiers.map((tier) => tier.id)).size === project.tiers.length
    && ids.length === Object.keys(project.items).length && new Set(ids).size === ids.length
    && ids.every((id) => Object.hasOwn(project.items, id) && project.items[id]?.id === id);
}
