import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createProject } from '../../src/data/defaults';
import { parseProject } from '../../src/data/schemas';
import { migrateProject } from '../../src/data/migrations';
import { editProject, hasValidPlacements } from '../../src/features/editor/commands';
import { themes, rankPresets } from '../../src/features/design/templates';
import { cardKeys, rankKeys, resolveStyle } from '../../src/features/design/settings';
import { appearance } from '../../src/features/design/appearance';
import { AtelierDatabase, deleteProject, loadProject, saveSnapshot } from '../../src/data/db';
import { createBackup, readBackup } from '../../src/features/backup/backup';
import type { PreparedImage } from '../../src/features/assets/images';
import { buildLayout } from '../../src/features/export/layout';
import { defaultExportOptions } from '../../src/features/export/options';

function image(): PreparedImage {
  const id = crypto.randomUUID(), blobKey = crypto.randomUUID();
  const blob = new Blob(['original bytes'], { type: 'image/png' });
  return { asset: { id, blobKey, width: 100, height: 80, mimeType: 'image/png', originalName: '背景 画像.png' }, item: { id: crypto.randomUUID(), assetId: id, name: '画像', description: '説明', tags: ['タグ'], createdAt: new Date().toISOString() }, record: { id: blobKey, blob, thumbnail: blob } };
}

describe('design commands and compatibility', () => {
  it('hides only image captions in output, preserves names and keeps the choice across templates', () => {
    const picture = image();
    let project = editProject(createProject(), { type: 'images.add', images: [picture] });
    project = editProject(project, { type: 'item.add', name: '文字項目', description: '', tags: [] });
    const original = project;
    expect(resolveStyle(project.style).showImageNames).toBe(true);
    project = editProject(project, { type: 'design.update', style: { showImageNames: false } });
    expect(project.items).toEqual(original.items); expect(project.assets).toEqual(original.assets);
    const options = { ...defaultExportOptions, includeUnranked: true };
    const measure = (text: string) => text.length * 10;
    const cards = buildLayout(project, options, measure).rows.at(-1)!.cards;
    expect(cards[0]!.lines).toEqual([]); expect(cards[1]!.lines).toEqual(['文字項目']);
    expect(cards[0]!.height).toBeLessThan(cards[1]!.height);
    for (const scope of ['all', 'cards', 'ranks'] as const) {
      expect(editProject(project, { type: 'design.theme', id: 'cyber', scope }).style.showImageNames).toBe(false);
    }
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(() => parseProject({ ...project, style: { ...project.style, showImageNames: 'false' } })).toThrow();
    const hiddenAll = editProject(project, { type: 'design.update', style: { showItemNames: false } });
    expect(buildLayout(hiddenAll, options, measure).rows.at(-1)!.cards.every((card) => !card.lines.length)).toBe(true);
  });
  it('loads a phase 2 document without rewriting old keys and resolves display defaults', () => {
    const project = createProject();
    expect(migrateProject(project)).toEqual(project);
    expect(resolveStyle(project.style)).toMatchObject({ backgroundMode: 'solid', backgroundAssetId: null, titleSize: 28 });
    expect(parseProject({ ...project, style: { ...project.style, itemSize: 300 } }).style.itemSize).toBe(300);
  });
  it('retains unknown fields when updating design and rejects unsafe or invalid values atomically', () => {
    const project = parseProject({ ...createProject(), extension: true, style: { ...createProject().style, extra: { data: 2 } } });
    const changed = editProject(project, { type: 'design.update', style: { itemSize: 160, backgroundMode: 'gradient' } });
    expect(changed.style).toMatchObject({ extra: { data: 2 }, itemSize: 160 });
    for (const style of [{ itemSize: 0 }, { gap: 41 }, { background: 'url(https://invalid)' }, { titleSize: Infinity }, { backgroundAssetId: 'missing' }]) {
      expect(() => editProject(project, { type: 'design.update', style })).toThrow();
    }
    expect(project.style.itemSize).toBe(76);
  });
  it.each(themes)('$name preserves all ranks, placements, items and assets while honoring locked colors', (theme) => {
    const picture = image();
    let project = editProject(createProject(), { type: 'images.add', images: [picture] });
    project = editProject(project, { type: 'item.move', id: picture.item.id, tierId: project.tiers[0]!.id });
    project = editProject(project, { type: 'tier.lock', id: project.tiers[0]!.id, locked: true });
    const next = editProject(project, { type: 'design.theme', id: theme.id, scope: 'all' });
    expect(next.items).toEqual(project.items); expect(next.assets).toEqual(project.assets);
    expect(next.tiers.map((tier) => [tier.id, tier.name, tier.itemIds])).toEqual(project.tiers.map((tier) => [tier.id, tier.name, tier.itemIds]));
    expect(next.tiers[0]).toEqual(project.tiers[0]); expect(hasValidPlacements(next)).toBe(true);
    expect(parseProject(next)).toEqual(next);
  });
  it.each(['ranks', 'cards'] as const)('limits template style changes to the %s scope', (scope) => {
    const project = createProject();
    const next = editProject(project, { type: 'design.theme', id: 'cyber', scope });
    const allowed: readonly string[] = scope === 'cards' ? cardKeys : rankKeys;
    for (const key of Object.keys(resolveStyle(next.style)) as (keyof typeof next.style)[]) {
      if (!allowed.includes(key)) expect(resolveStyle(next.style)[key]).toEqual(resolveStyle(project.style)[key]);
    }
    if (scope === 'cards') expect(next.tiers).toEqual(project.tiers);
  });
  it('applies rank palettes to any number of tiers without changing names or global style', () => {
    let project = createProject();
    for (let count = 0; count < 3; count++) project = editProject(project, { type: 'tier.add' });
    for (const preset of rankPresets) {
      const next = editProject(project, { type: 'design.ranks', id: preset.id });
      expect(next.tiers).toHaveLength(8); expect(next.style).toEqual(project.style);
      expect(next.tiers.map((tier) => tier.name)).toEqual(project.tiers.map((tier) => tier.name));
    }
  });
  it('updates and clears individual dimensions and respects locked tiers', () => {
    const project = createProject(), tier = project.tiers[0]!;
    const next = editProject(project, { type: 'tier.update', ...tier, minHeight: 200, labelWidth: 140 });
    expect(next.tiers[0]).toMatchObject({ minHeight: 200, labelWidth: 140 });
    expect(editProject(next, { type: 'tier.update', ...tier, labelWidth: null }).tiers[0]?.labelWidth).toBeUndefined();
    const locked = editProject(project, { type: 'tier.lock', id: tier.id, locked: true });
    expect(() => editProject(locked, { type: 'tier.update', ...tier, minHeight: 200 })).toThrow();
  });
  it('validates crop boundaries, keeps source images, and copies crop metadata on duplication', () => {
    const picture = image();
    const project = editProject(createProject(), { type: 'images.add', images: [picture] });
    const cropped = editProject(project, { type: 'item.crop', id: picture.item.id, crop: { x: .2, y: .1, width: .5, height: .8 } });
    expect(cropped.assets).toBe(project.assets);
    const copy = editProject(cropped, { type: 'item.duplicate', id: picture.item.id });
    expect(Object.values(copy.items).map((item) => item.crop)).toEqual([cropped.items[picture.item.id]!.crop, cropped.items[picture.item.id]!.crop]);
    for (const crop of [{ x: .8, y: 0, width: .3, height: 1 }, { x: 0, y: 0, width: 0, height: 1 }]) {
      expect(() => editProject(project, { type: 'item.crop', id: picture.item.id, crop })).toThrow();
      expect(() => parseProject({ ...project, items: { [picture.item.id]: { ...picture.item, crop } } })).toThrow();
    }
    expect(editProject(cropped, { type: 'item.crop', id: picture.item.id, crop: null }).items[picture.item.id]!.crop).toBeNull();
  });
  it('builds all backgrounds and does not put external user strings into image URLs', () => {
    for (const theme of themes) expect(appearance(theme.style).backgroundImage).toBeDefined();
    const style = { ...createProject().style, backgroundMode: 'image' as const };
    expect(appearance(style).backgroundImage).toBe('none');
    expect(appearance(style, 'blob:local-id').backgroundImage).toBe('url("blob:local-id")');
  });
});

describe('background storage and JSON round trip', () => {
  it('preserves shared backgrounds across project deletion and reclaims replaced assets', async () => {
    const database = new AtelierDatabase(`design-${crypto.randomUUID()}`);
    try {
      const first = image(), second = image();
      const project = editProject(createProject(), { type: 'design.background', asset: first.asset });
      await saveSnapshot(project, 0, [first.record], database);
      const duplicate = { ...project, id: crypto.randomUUID() };
      await saveSnapshot(duplicate, 0, [], database);
      const replaced = editProject(project, { type: 'design.background', asset: second.asset });
      await saveSnapshot(replaced, 1, [second.record], database);
      expect(await database.blobs.count()).toBe(2);
      await deleteProject(duplicate.id, 1, database);
      expect(await database.blobs.count()).toBe(1);
      expect((await loadProject(project.id, database)).project.style.backgroundAssetId).toBe(second.asset.id);
      await saveSnapshot(editProject(replaced, { type: 'design.background', asset: null }), 2, [], database);
      expect(await database.blobs.count()).toBe(0);
    } finally { await database.delete(); }
  });
  it('includes the background Blob, appearance and crop and restores them into a new project', async () => {
    const picture = image(), background = image();
    let project = editProject(createProject(), { type: 'images.add', images: [picture] });
    project = editProject(project, { type: 'design.background', asset: background.asset });
    project = editProject(project, { type: 'item.crop', id: picture.item.id, crop: { x: .25, y: 0, width: .75, height: 1 } });
    project = editProject(project, { type: 'design.update', style: { radius: 20, titleDecoration: 'band' } });
    const backup = await createBackup(project, new Map([picture, background].map((entry) => [entry.record.id, entry.record])));
    const restored = await readBackup(new File([backup], '背景付き.json', { type: 'application/json' }), async (blob) => {
      const prepared = image(); prepared.record.blob = blob; return prepared;
    });
    expect(restored.project.id).not.toBe(project.id);
    expect(restored.project.style).toEqual(project.style); expect(restored.project.items).toEqual(project.items);
    expect(restored.blobs).toHaveLength(2);
    expect(await restored.blobs[1]!.blob.text()).toBe('original bytes');
    const invalid = JSON.parse(await backup.text()); invalid.project.style.backgroundAssetId = 'missing';
    await expect(readBackup(new File([JSON.stringify(invalid)], '不正.json'))).rejects.toThrow();
  });
  it('retains an asset still used by the background when its item is deleted', () => {
    const picture = image();
    const project = editProject(createProject(), { type: 'images.add', images: [picture] });
    const shared = parseProject({ ...project, style: { ...project.style, backgroundAssetId: picture.asset.id } });
    const next = editProject(shared, { type: 'item.delete', id: picture.item.id });
    expect(next.assets[picture.asset.id]).toEqual(picture.asset);
    expect(() => parseProject(next)).not.toThrow();
  });
});
