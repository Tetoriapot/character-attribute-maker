import { expect, it } from 'vitest';
import { createProject } from '../../src/data/defaults';
import { editProject, hasValidPlacements, type EditorCommand } from '../../src/features/editor/commands';
import { emptyHistory, HISTORY_LIMIT, recordEdit, retainedBlobKeys, travelHistory } from '../../src/features/editor/history';
import { matchingIds, selectableIds } from '../../src/features/editor/filter';
import { nextGridIndex, visibleIndices } from '../../src/features/editor/virtual';
import { themes, rankPresets } from '../../src/features/design/templates';

function fixture() {
  let project = createProject();
  for (const name of ['Ａｌｐｈａ', 'Beta', 'Gamma', 'Delta']) project = editProject(project, { type: 'item.add', name, description: '日本語 説明', tags: name === 'Beta' ? ['赤'] : ['赤', '青'] });
  return project;
}
const content = <T extends { updatedAt: string }>(project: T) => ({ ...project, updatedAt: '' });

it('round-trips all editing commands with stable IDs, placements and unknown keys', () => {
  const project = Object.assign(fixture(), { extension: { retained: 'unknown' } });
  const item = project.unrankedItemIds[0]!, tier = project.tiers[0]!;
  const asset = { id: crypto.randomUUID(), blobKey: crypto.randomUUID(), mimeType: 'image/png' as const, width: 10, height: 10, originalName: '画像.png' };
  const imageId = crypto.randomUUID();
  const commands: EditorCommand[] = [
    { type: 'project.update', title: '変更', description: '説明' }, { type: 'tier.add' },
    { type: 'item.add', name: '追加項目', description: '追加説明', tags: ['新規'] },
    { type: 'tier.update', id: tier.id, name: '最上位', background: '#123456', foreground: '#ffffff', minHeight: 140, labelWidth: 120 },
    { type: 'tier.duplicate', id: tier.id }, { type: 'tier.move', id: tier.id, index: 2 },
    { type: 'item.update', id: item, name: '編集済み', description: '変更', tags: ['緑'] },
    { type: 'item.duplicate', id: item }, { type: 'item.move', id: item, tierId: tier.id },
    { type: 'items.move', ids: project.unrankedItemIds.slice(1, 3), tierId: tier.id },
    { type: 'tier.lock', id: tier.id, locked: true }, { type: 'tier.lock', id: tier.id, locked: false },
    { type: 'tier.delete', id: tier.id }, { type: 'item.delete', id: item },
    { type: 'images.add', images: [{ asset, item: { id: imageId, assetId: asset.id, name: '画像', description: '', tags: [], createdAt: project.createdAt } }] },
    { type: 'item.crop', id: imageId, crop: { x: 0, y: 0, width: .5, height: 1 } },
    { type: 'design.update', style: { itemSize: 100, gap: 20 } },
    { type: 'design.update', style: { showImageNames: false } },
    { type: 'design.theme', id: themes[1]!.id, scope: 'all' },
    { type: 'design.ranks', id: rankPresets[1]!.id },
    { type: 'design.background', asset: { ...asset, id: crypto.randomUUID(), blobKey: crypto.randomUUID() } },
    { type: 'design.background', asset: null },
  ];
  let state: ReturnType<typeof recordEdit> = { project, history: emptyHistory() }; const snapshots = [state.project];
  for (const command of commands) { state = recordEdit(state.project, state.history, command); snapshots.push(state.project); expect(hasValidPlacements(state.project)).toBe(true); }
  for (const snapshot of snapshots.slice(0, -1).reverse()) { state = travelHistory(state.project, state.history, 'undo'); expect(content(state.project)).toEqual(content(snapshot)); }
  for (const snapshot of snapshots.slice(1)) { state = travelHistory(state.project, state.history, 'redo'); expect(content(state.project)).toEqual(content(snapshot)); }
  expect(state.project).toMatchObject({ extension: { retained: 'unknown' } });
});

it('caps history at 100, ignores no-op/rejected edits and clears redo after a new edit', () => {
  let state = { project: createProject(), history: emptyHistory() };
  for (let index = 0; index < 105; index++) state = recordEdit(state.project, state.history, { type: 'project.update', title: `変更${index}`, description: '' });
  expect(state.history.past).toHaveLength(HISTORY_LIMIT);
  expect(recordEdit(state.project, state.history, { type: 'tier.move', id: state.project.tiers[0]!.id, index: 0 }).history).toBe(state.history);
  expect(() => recordEdit(state.project, state.history, { type: 'project.update', title: '', description: '' })).toThrow();
  for (let index = 0; index < 100; index++) state = travelHistory(state.project, state.history, 'undo');
  expect(state.project.title).toBe('変更4');
  expect(travelHistory(state.project, state.history, 'undo').project).toBe(state.project);
  state = recordEdit(state.project, state.history, { type: 'tier.add' });
  expect(state.history.future).toEqual([]);
});

it('retains only referenced image keys through undo/redo and releases pruned history', () => {
  const asset = { id: crypto.randomUUID(), blobKey: crypto.randomUUID(), mimeType: 'image/png' as const, width: 10, height: 10, originalName: '背景.png' };
  let state = recordEdit(createProject(), emptyHistory(), { type: 'design.background', asset });
  state = travelHistory(state.project, state.history, 'undo');
  expect(retainedBlobKeys(state.project, state.history).has(asset.blobKey)).toBe(true);
  expect(JSON.stringify(state.history)).not.toContain('dataBase64');
  state = recordEdit(state.project, state.history, { type: 'tier.add' });
  expect(retainedBlobKeys(state.project, state.history).size).toBe(0);
  state = recordEdit(state.project, state.history, { type: 'design.background', asset });
  state = recordEdit(state.project, state.history, { type: 'design.background', asset: null });
  for (let index = 0; index < 100; index++) state = recordEdit(state.project, state.history, { type: 'project.update', title: `変更${index}`, description: '' });
  expect(retainedBlobKeys(state.project, state.history).size).toBe(0);
});

it('bulk moves preserve display order, hidden items and single placement; same placement is a no-op', () => {
  let project = fixture(); const [a, b, c, d] = project.unrankedItemIds as [string, string, string, string];
  project = editProject(project, { type: 'items.move', ids: [c, a], tierId: project.tiers[0]!.id });
  expect(project.tiers[0]!.itemIds).toEqual([a, c]); expect(project.unrankedItemIds).toEqual([b, d]);
  project = editProject(project, { type: 'items.move', ids: [b, c], tierId: null, index: 1 });
  expect(project.unrankedItemIds).toEqual([c, b, d]); expect(hasValidPlacements(project)).toBe(true);
  expect(editProject(project, { type: 'items.move', ids: [b, c], tierId: null, index: 0 })).toBe(project);
  expect(() => editProject(project, { type: 'items.move', ids: [a, a], tierId: null })).toThrow();
  expect(() => editProject(project, { type: 'items.move', ids: [a, 'missing'], tierId: null })).toThrow();
});

it('bulk moves atomically reject locked sources and destinations', () => {
  let project = fixture(); const [a, b] = project.unrankedItemIds as [string, string]; const tierId = project.tiers[0]!.id;
  project = editProject(project, { type: 'item.move', id: a, tierId });
  project = editProject(project, { type: 'tier.lock', id: tierId, locked: true });
  expect(() => editProject(project, { type: 'items.move', ids: [a, b], tierId: null })).toThrow();
  expect(() => editProject(project, { type: 'items.move', ids: [b], tierId })).toThrow();
  expect(project.tiers[0]!.itemIds).toEqual([a]); expect(project.unrankedItemIds[0]).toBe(b);
  expect(selectableIds(project, [a, b])).toEqual([b]);
});

it('search normalizes full-width text, combines query words and tags, and preserves placement order', () => {
  const project = fixture(), [a, b, c, d] = project.unrankedItemIds;
  expect(matchingIds(project, 'alpha 説明', ['赤', '青'])).toEqual([a]);
  expect(matchingIds(project, '日本語', ['青'])).toEqual([a, c, d]);
  expect(matchingIds(project, 'beta', ['赤'])).toEqual([b]);
  expect(matchingIds(project, 'beta', ['青'])).toEqual([]);
  expect(matchingIds(project, '存在しない', [])).toEqual([]);
});

it('virtual windows stay bounded for 5000 items and pin focused/dragged items', () => {
  for (const top of [0, 5000, 60000]) {
    const indices = visibleIndices(5000, 6, 120, top, 480, [0, 4999]);
    expect(indices.length).toBeLessThanOrEqual(56); expect(indices).toContain(0); expect(indices).toContain(4999);
    expect(indices.every((index) => index >= 0 && index < 5000)).toBe(true);
  }
  expect(visibleIndices(0, 1, 120, 0, 480)).toEqual([]);
  expect(nextGridIndex(3, 'ArrowDown', 6, 5000, 4)).toBe(9);
  expect(nextGridIndex(3, 'PageDown', 6, 5000, 4)).toBe(27);
  expect(nextGridIndex(3, 'End', 6, 5000, 4)).toBe(4999);
  expect(nextGridIndex(0, 'ArrowLeft', 6, 5000, 4)).toBe(0);
  expect(nextGridIndex(4999, 'ArrowRight', 6, 5000, 4)).toBe(4999);
  expect(nextGridIndex(3, 'Enter', 6, 5000, 4)).toBeUndefined();
});
