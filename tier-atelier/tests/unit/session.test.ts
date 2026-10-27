import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as repository from '../../src/data/db';
import { useEditor } from '../../src/stores/editorStore';
import { flushSave, initializeStorage, openProject, newProject } from '../../src/features/storage/session';
import { editProject } from '../../src/features/editor/commands';

beforeEach(async () => {
  useEditor.setState({ ready: false, dirty: false, busy: false, saveError: null, loadError: null });
  await repository.db.delete(); await repository.db.open();
  await initializeStorage();
});
afterEach(async () => {
  vi.restoreAllMocks();
  useEditor.setState({ dirty: false, ready: false });
  await repository.db.delete();
});

it('serializes edits made during an in-flight save and persists the latest snapshot', async () => {
  const original = repository.saveSnapshot;
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const began = new Promise<void>((resolve) => { started = resolve; });
  const spy = vi.spyOn(repository, 'saveSnapshot').mockImplementationOnce(async (...args) => { started(); await gate; return original(...args); });
  useEditor.getState().dispatch({ type: 'project.update', title: '先の変更', description: '' });
  await began;
  useEditor.getState().dispatch({ type: 'project.update', title: '保存中の追加変更', description: '最新' });
  release();
  await flushSave();
  const state = useEditor.getState();
  expect(state.dirty).toBe(false);
  expect(state.saveStatus).toBe('saved');
  expect((await repository.loadProject(state.project.id)).project).toEqual(state.project);
  expect(state.project.title).toBe('保存中の追加変更');
  expect(spy).toHaveBeenCalledTimes(2);
});

it('retains edits on failure, avoids a retry loop, and saves when explicitly retried', async () => {
  const spy = vi.spyOn(repository, 'saveSnapshot').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
  useEditor.getState().dispatch({ type: 'project.update', title: '保存失敗中の編集', description: '' });
  await expect(flushSave()).rejects.toThrow();
  expect(useEditor.getState().project.title).toBe('保存失敗中の編集');
  expect(useEditor.getState().dirty).toBe(true);
  expect(useEditor.getState().saveError).toContain('JSONバックアップ');
  useEditor.getState().dispatch({ type: 'tier.add' });
  await Promise.resolve();
  expect(spy).toHaveBeenCalledTimes(1);
  await flushSave();
  expect(useEditor.getState().dirty).toBe(false);
  expect((await repository.loadProject(useEditor.getState().project.id)).project.tiers).toHaveLength(6);
});

async function installImage() {
  const project = useEditor.getState().project;
  const asset = { id: crypto.randomUUID(), blobKey: crypto.randomUUID(), mimeType: 'image/png' as const, width: 1, height: 1, originalName: '画像.png' };
  const item = { id: crypto.randomUUID(), assetId: asset.id, name: '画像', description: '', tags: [], createdAt: project.createdAt };
  const blob = new Blob(['image'], { type: 'image/png' });
  const next = editProject(project, { type: 'images.add', images: [{ asset, item }] });
  await repository.saveSnapshot(next, 1, [{ id: asset.blobKey, blob, thumbnail: blob }]);
  await openProject(project.id);
  return { item, asset, blob };
}

it('undo restores an image after autosave garbage collection and redo can remove it again', async () => {
  const { item, asset, blob } = await installImage();
  useEditor.getState().dispatch({ type: 'item.delete', id: item.id }); await flushSave();
  expect(await repository.db.blobs.get(asset.blobKey)).toBeUndefined();
  expect(useEditor.getState().records.get(asset.blobKey)?.blob).toEqual(blob);
  useEditor.getState().travel('undo'); await flushSave();
  expect((await repository.loadProject(useEditor.getState().project.id)).blobs).toHaveLength(1);
  expect(useEditor.getState().thumbnails[asset.id]).toMatch(/^blob:/);
  useEditor.getState().travel('redo'); await flushSave();
  expect(await repository.db.blobs.get(asset.blobKey)).toBeUndefined();
  await newProject('別のプロジェクト');
  expect(useEditor.getState().history).toEqual({ past: [], future: [] });
  expect(useEditor.getState().records.size).toBe(0);
});

it('undo during an in-flight deletion persists the recovered image in the next transaction', async () => {
  const { item, asset } = await installImage();
  const original = repository.saveSnapshot;
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const began = new Promise<void>((resolve) => { started = resolve; });
  vi.spyOn(repository, 'saveSnapshot').mockImplementationOnce(async (...args) => { started(); await gate; return original(...args); });
  useEditor.getState().dispatch({ type: 'item.delete', id: item.id }); await began;
  useEditor.getState().travel('undo'); release(); await flushSave();
  expect((await repository.loadProject(useEditor.getState().project.id)).project.items[item.id]).toEqual(item);
  expect(await repository.db.blobs.get(asset.blobKey)).toBeDefined();
  expect(useEditor.getState().dirty).toBe(false);
});

it('keeps a failed image recovery available for retry and emergency backup', async () => {
  const { item, asset } = await installImage();
  useEditor.getState().dispatch({ type: 'item.delete', id: item.id }); await flushSave();
  vi.spyOn(repository, 'saveSnapshot').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
  useEditor.getState().travel('undo'); await expect(flushSave()).rejects.toThrow();
  expect(useEditor.getState().project.items[item.id]).toEqual(item);
  expect(useEditor.getState().records.has(asset.blobKey)).toBe(true);
  await flushSave(); expect(await repository.db.blobs.get(asset.blobKey)).toBeDefined();
});

it('releases removed image memory when the last referring history entry expires', async () => {
  const { item, asset } = await installImage();
  useEditor.getState().dispatch({ type: 'item.delete', id: item.id }); await flushSave();
  useEditor.setState({ busy: false });
  for (let index = 0; index < 100; index++) useEditor.getState().dispatch({ type: 'project.update', title: `変更${index}`, description: '' });
  await flushSave();
  expect(useEditor.getState().records.has(asset.blobKey)).toBe(false);
  expect(useEditor.getState().history.past).toHaveLength(100);
});
