import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../src/data/defaults';
import { editProject, hasValidPlacements, itemLocation, EditorError } from '../../src/features/editor/commands';
import type { Project } from '../../src/data/types';
import { useEditor } from '../../src/stores/editorStore';

const add = (project: Project, name: string) => editProject(project, { type: 'item.add', name, description: '説明', tags: ['タグ'] });

describe('project and tier editing', () => {
  it('starts with stable unique IDs, explicit order, and no sample items', () => {
    const project = createProject();
    expect(project.schemaVersion).toBe(1);
    expect(project.tiers.map((tier) => tier.name)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(hasValidPlacements(project)).toBe(true);
    expect(project.items).toEqual({});
    expect(new Set([project.id, ...project.tiers.map((tier) => tier.id)]).size).toBe(6);
  });
  it('inserts a tier at a requested position without rewriting existing tiers', () => {
    const original = createProject();
    const project = editProject(original, { type: 'tier.add', afterId: original.tiers[0]!.id });
    expect(project.tiers).toHaveLength(6);
    expect(project.tiers[0]).toBe(original.tiers[0]);
    expect(project.tiers[2]).toBe(original.tiers[1]);
    expect(original.tiers).toHaveLength(5);
  });
  it('duplicates tier settings without duplicating its items', () => {
    let project = add(createProject(), '名前');
    const tier = project.tiers[0]!;
    project = editProject(project, { type: 'item.move', id: project.unrankedItemIds[0]!, tierId: tier.id });
    project = editProject(project, { type: 'tier.duplicate', id: tier.id });
    expect(project.tiers[1]).toMatchObject({ background: tier.background, foreground: tier.foreground, itemIds: [] });
    expect(project.tiers[1]!.id).not.toBe(tier.id);
    expect(hasValidPlacements(project)).toBe(true);
  });
  it('moves every item to the end of unranked when deleting a tier', () => {
    let project = add(add(createProject(), '一'), '二');
    const id = project.unrankedItemIds[0]!;
    project = editProject(project, { type: 'item.move', id, tierId: project.tiers[0]!.id });
    const beforeItems = project.items;
    project = editProject(project, { type: 'tier.delete', id: project.tiers[0]!.id });
    expect(project.unrankedItemIds.at(-1)).toBe(id);
    expect(project.items).toBe(beforeItems);
    expect(hasValidPlacements(project)).toBe(true);
  });
  it('allows deletion of all tiers and adding a tier again', () => {
    let project = createProject();
    for (const tier of project.tiers) project = editProject(project, { type: 'tier.delete', id: tier.id });
    expect(project.tiers).toEqual([]);
    expect(editProject(project, { type: 'tier.add' }).tiers).toHaveLength(1);
  });
  it('renames and recolors a tier without changing its identity', () => {
    const project = createProject();
    const id = project.tiers[0]!.id;
    const next = editProject(project, { type: 'tier.update', id, name: '最も好き', background: '#123456', foreground: '#ffffff' });
    expect(next.tiers[0]).toMatchObject({ id, name: '最も好き', background: '#123456', foreground: '#ffffff' });
    expect(project.tiers[0]!.name).toBe('S');
  });
  it('moves a tier up and down and clamps boundary moves', () => {
    const original = createProject();
    const id = original.tiers[0]!.id;
    const next = editProject(original, { type: 'tier.move', id, index: 999 });
    expect(next.tiers.at(-1)!.id).toBe(id);
    expect(editProject(next, { type: 'tier.move', id, index: -10 }).tiers.map((tier) => tier.id)).toEqual(original.tiers.map((tier) => tier.id));
    expect(editProject(original, { type: 'tier.move', id, index: 0 })).toBe(original);
  });
  it('validates names, title, colors, metadata and non-finite indexes atomically', () => {
    const project = createProject();
    expect(() => editProject(project, { type: 'tier.update', id: project.tiers[0]!.id, name: ' ', background: '#000000', foreground: '#ffffff' })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'tier.update', id: project.tiers[0]!.id, name: 'OK', background: 'red', foreground: '#ffffff' })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'project.update', title: 'a'.repeat(121), description: '' })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'tier.move', id: project.tiers[0]!.id, index: NaN })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'item.add', name: 'OK', description: 'a'.repeat(1001), tags: [] })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'item.add', name: 'OK', description: '', tags: ['a'.repeat(31)] })).toThrow(EditorError);
    expect(project.tiers[0]!.name).toBe('S');
    expect(project.items).toEqual({});
  });
});

describe('item placement and locking', () => {
  it('moves across tiers and reorders within the same tier in both directions', () => {
    let project = add(add(add(createProject(), '一'), '二'), '三');
    const [a, b, c] = project.unrankedItemIds as [string, string, string];
    project = editProject(project, { type: 'item.move', id: a, tierId: null, index: 2 });
    expect(project.unrankedItemIds).toEqual([b, c, a]);
    project = editProject(project, { type: 'item.move', id: a, tierId: null, index: 0 });
    expect(project.unrankedItemIds).toEqual([a, b, c]);
    project = editProject(project, { type: 'item.move', id: a, tierId: project.tiers[0]!.id });
    project = editProject(project, { type: 'item.move', id: a, tierId: project.tiers[1]!.id });
    expect(project.tiers[0]!.itemIds).toEqual([]);
    expect(project.tiers[1]!.itemIds).toEqual([a]);
    expect(hasValidPlacements(project)).toBe(true);
  });
  it('preserves single placement through 200 deterministic moves of 25 items', () => {
    let project = createProject();
    for (let index = 0; index < 25; index++) project = add(project, `項目${index}`);
    const ids = Object.keys(project.items);
    for (let index = 0; index < 200; index++) {
      project = editProject(project, { type: 'item.move', id: ids[(index * 7) % ids.length]!, tierId: index % 6 === 5 ? null : project.tiers[index % 5]!.id, index: index % 8 });
      expect(hasValidPlacements(project)).toBe(true);
    }
  });
  it('rejects a missing destination without removing the original item', () => {
    const project = add(createProject(), '対象');
    const id = project.unrankedItemIds[0]!;
    expect(() => editProject(project, { type: 'item.move', id, tierId: 'missing' })).toThrow(EditorError);
    expect(project.unrankedItemIds).toEqual([id]);
    expect(() => editProject(project, { type: 'item.move', id: 'missing', tierId: null })).toThrow(EditorError);
    expect(hasValidPlacements(project)).toBe(true);
  });
  it('blocks moving items into or out of locked tiers and blocks item edits/deletion', () => {
    let project = add(add(createProject(), '一'), '二');
    const [a, b] = project.unrankedItemIds as [string, string];
    const tierId = project.tiers[0]!.id;
    project = editProject(project, { type: 'item.move', id: a, tierId });
    project = editProject(project, { type: 'tier.lock', id: tierId, locked: true });
    expect(() => editProject(project, { type: 'item.move', id: a, tierId: null })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'item.move', id: b, tierId })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'item.delete', id: a })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'item.update', id: a, name: '変更', description: '', tags: [] })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'tier.delete', id: tierId })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'tier.move', id: tierId, index: 2 })).toThrow(EditorError);
    expect(() => editProject(project, { type: 'tier.update', id: tierId, name: '変更', background: '#ffffff', foreground: '#000000' })).toThrow(EditorError);
    project = editProject(project, { type: 'tier.lock', id: tierId, locked: false });
    expect(itemLocation(editProject(project, { type: 'item.move', id: a, tierId: null }), a)).toBeNull();
  });
  it('edits metadata, deduplicates tags and deletes just the selected item', () => {
    let project = add(add(createProject(), '一'), '二');
    const id = project.unrankedItemIds[0]!;
    project = editProject(project, { type: 'item.update', id, name: ' 編集 ', description: '<script>alert(1)</script>', tags: [' 創作 ', '創作'] });
    expect(project.items[id]).toMatchObject({ name: '編集', tags: ['創作'], assetId: null });
    project = editProject(project, { type: 'item.delete', id });
    expect(project.items[id]).toBeUndefined();
    expect(Object.values(project.items).map((item) => item.name)).toEqual(['二']);
    expect(hasValidPlacements(project)).toBe(true);
  });
});

describe('editor store', () => {
  beforeEach(() => useEditor.setState({ project: createProject(), selection: { kind: 'project' }, dirty: false, error: null, announcement: '' }));
  it('selects added entries and clears selection when deleted', () => {
    useEditor.getState().dispatch({ type: 'tier.add' });
    const selection = useEditor.getState().selection;
    expect(selection.kind).toBe('tier');
    if (selection.kind !== 'tier') throw new Error('selection');
    useEditor.getState().dispatch({ type: 'tier.delete', id: selection.id });
    expect(useEditor.getState().selection).toEqual({ kind: 'project' });
    expect(useEditor.getState().dirty).toBe(true);
  });
  it('keeps data and exposes an actionable error on failed edits', () => {
    const before = useEditor.getState().project;
    expect(useEditor.getState().dispatch({ type: 'item.add', name: ' ', description: '', tags: [] })).toBe(false);
    expect(useEditor.getState().project).toBe(before);
    expect(useEditor.getState().dirty).toBe(false);
    expect(useEditor.getState().error).toContain('名前');
  });
});
