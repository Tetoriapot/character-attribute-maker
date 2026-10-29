import { expect, it } from 'vitest';
import { createProject } from '../../src/data/defaults';
import { editProject, hasValidPlacements } from '../../src/features/editor/commands';
import { emptyHistory, recordEdit, retainedBlobKeys, travelHistory } from '../../src/features/editor/history';
import { draggedItemIds } from '../../src/features/editor/deletion';

function fixture() {
  let project = createProject();
  for (let index = 0; index < 4; index++) project = editProject(project, { type: 'item.add', name: `項目${index}`, description: '説明', tags: ['タグ'] });
  project = editProject(project, { type: 'items.move', ids: project.unrankedItemIds.slice(0, 2), tierId: project.tiers[0]!.id });
  return project;
}
const content = <T extends { updatedAt: string }>(project: T) => ({ ...project, updatedAt: '' });

it('bulk deletion keeps remaining order, metadata and IDs and is a single undo/redo operation', () => {
  const project = fixture(), ids = [project.tiers[0]!.itemIds[0]!, project.unrankedItemIds[1]!];
  const state = recordEdit(project, emptyHistory(), { type: 'items.delete', ids });
  expect(state.history.past).toHaveLength(1);
  expect(state.project.tiers[0]!.itemIds).toEqual(project.tiers[0]!.itemIds.slice(1));
  expect(state.project.unrankedItemIds).toEqual(project.unrankedItemIds.slice(0, 1));
  expect(Object.values(state.project.items).map((item) => item.name)).toEqual(['項目1', '項目2']);
  expect(hasValidPlacements(state.project)).toBe(true);
  const undone = travelHistory(state.project, state.history, 'undo');
  expect(content(undone.project)).toEqual(content(project));
  expect(content(travelHistory(undone.project, undone.history, 'redo').project)).toEqual(content(state.project));
});

it('rejects empty, duplicate, missing and locked IDs atomically without history changes', () => {
  let project = fixture(); project = editProject(project, { type: 'tier.lock', id: project.tiers[0]!.id, locked: true });
  const id = project.unrankedItemIds[0]!, history = emptyHistory(), before = JSON.stringify(project);
  for (const ids of [[], [id, id], [id, 'missing'], [id, '__proto__'], [id, project.tiers[0]!.itemIds[0]!]]) {
    expect(() => recordEdit(project, history, { type: 'items.delete', ids })).toThrow();
    expect(JSON.stringify(project)).toBe(before); expect(history.past).toEqual([]);
  }
});

it('releases only unused assets and retains deleted image blobs for undo', () => {
  const base = createProject();
  const asset = { id: crypto.randomUUID(), blobKey: crypto.randomUUID(), mimeType: 'image/png' as const, width: 1, height: 1, originalName: '画像.png' };
  const id = crypto.randomUUID();
  let project = editProject(base, { type: 'images.add', images: [{ asset, item: { id, assetId: asset.id, name: '画像', description: '説明', tags: ['タグ'], createdAt: base.createdAt } }] });
  project = editProject(project, { type: 'item.duplicate', id });
  const partial = editProject(project, { type: 'items.delete', ids: [id] });
  expect(partial.assets[asset.id]).toEqual(asset);
  const state = recordEdit(project, emptyHistory(), { type: 'items.delete', ids: project.unrankedItemIds });
  expect(state.project.assets).toEqual({}); expect(retainedBlobKeys(state.project, state.history).has(asset.blobKey)).toBe(true);
  expect(content(travelHistory(state.project, state.history, 'undo').project)).toEqual(content(project));
  const background = { ...project, style: { ...project.style, backgroundAssetId: asset.id, backgroundMode: 'image' as const } };
  expect(editProject(background, { type: 'items.delete', ids: project.unrankedItemIds }).assets[asset.id]).toEqual(asset);
});

it('drags selected items together but does not delete the selection when dragging another item', () => {
  expect(draggedItemIds('a', ['a', 'b'])).toEqual(['a', 'b']);
  expect(draggedItemIds('c', ['a', 'b'])).toEqual(['c']);
  expect(draggedItemIds('c', [])).toEqual(['c']);
});
