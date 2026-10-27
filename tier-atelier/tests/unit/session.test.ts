import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as repository from '../../src/data/db';
import { useEditor } from '../../src/stores/editorStore';
import { flushSave, initializeStorage } from '../../src/features/storage/session';

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
