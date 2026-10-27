import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AtelierDatabase, bootstrap, ConflictError, deleteProject, loadProject, saveSnapshot, type StoredBlob } from '../../src/data/db';
import { createProject } from '../../src/data/defaults';
import { migrateProject } from '../../src/data/migrations';
import { parseProject } from '../../src/data/schemas';
import { editProject, hasValidPlacements } from '../../src/features/editor/commands';
import { createBackup, fromBase64, readBackup } from '../../src/features/backup/backup';
import { inspectImage, MiB, prepareImage, validateBatch, type PreparedImage } from '../../src/features/assets/images';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
function sample(): PreparedImage {
  const id = crypto.randomUUID(), key = crypto.randomUUID();
  return {
    asset: { id, blobKey: key, mimeType: 'image/png', width: 1, height: 1, originalName: '日本語 画像.png' },
    item: { id: crypto.randomUUID(), assetId: id, name: '日本語 画像', description: '説明', tags: ['日本語'], createdAt: new Date().toISOString() },
    record: { id: key, blob: new Blob([png], { type: 'image/png' }), thumbnail: new Blob([png], { type: 'image/png' }) },
  };
}
const decoder = vi.fn(async (blob: Blob) => {
  const image = sample();
  image.record.blob = blob;
  Object.assign(image.asset, inspectImage(new Uint8Array(await blob.arrayBuffer())));
  return image;
});
const jsonFile = (value: unknown) => new File([JSON.stringify(value)], '日本語 バックアップ.json', { type: 'application/json' });

describe('IndexedDB transactions and shared images', () => {
  let database: AtelierDatabase;
  beforeEach(() => { database = new AtelierDatabase(`test-${crypto.randomUUID()}`); });
  afterEach(async () => { await database.delete(); vi.restoreAllMocks(); });
  it('initializes once, reloads complete project data, and preserves unknown fields', async () => {
    const id = await bootstrap(database);
    expect(await bootstrap(database)).toBe(id);
    const original = await loadProject(id, database);
    const project = parseProject({ ...original.project, extension: { label: '保存対象' } });
    project.title = '保存後の名前';
    await saveSnapshot(project, 1, [], database);
    database.close(); await database.open();
    const restored = await loadProject(id, database);
    expect(restored.project).toEqual(project);
    expect(restored.revision).toBe(2);
  });
  it('atomically stores 25 image items and Blob bytes, then reloads them', async () => {
    const images = Array.from({ length: 25 }, sample);
    const project = editProject(createProject(), { type: 'images.add', images });
    await saveSnapshot(project, 0, images.map((image) => image.record), database);
    database.close(); await database.open();
    const loaded = await loadProject(project.id, database);
    expect(loaded.project).toEqual(project);
    expect(loaded.blobs).toHaveLength(25);
    expect(new Uint8Array(await loaded.blobs[0]!.blob.arrayBuffer())).toEqual(png);
    expect(hasValidPlacements(loaded.project)).toBe(true);
  });
  it('rejects stale writes and deletion without overwriting the current revision', async () => {
    const project = createProject();
    await saveSnapshot(project, 0, [], database);
    await saveSnapshot({ ...project, title: '別タブ' }, 1, [], database);
    await expect(saveSnapshot({ ...project, title: '古い編集' }, 1, [], database)).rejects.toBeInstanceOf(ConflictError);
    await expect(deleteProject(project.id, 1, database)).rejects.toBeInstanceOf(ConflictError);
    expect((await loadProject(project.id, database)).project.title).toBe('別タブ');
  });
  it('rolls back new Blobs if the project write runs out of quota', async () => {
    const image = sample();
    const project = editProject(createProject(), { type: 'images.add', images: [image] });
    vi.spyOn(database.projects, 'put').mockRejectedValueOnce(new DOMException('full', 'QuotaExceededError'));
    await expect(saveSnapshot(project, 0, [image.record], database)).rejects.toThrow();
    expect(await database.projects.count()).toBe(0);
    expect(await database.blobs.count()).toBe(0);
    await saveSnapshot(project, 0, [image.record], database);
    expect((await loadProject(project.id, database)).blobs).toHaveLength(1);
  });
  it('deletes a shared Blob only after its last project reference is removed', async () => {
    const image = sample();
    const first = editProject(createProject(), { type: 'images.add', images: [image] });
    const second = { ...first, id: crypto.randomUUID() };
    await saveSnapshot(first, 0, [image.record], database);
    await saveSnapshot(second, 0, [], database);
    await deleteProject(first.id, 1, database);
    expect((await loadProject(second.id, database)).blobs).toHaveLength(1);
    await deleteProject(second.id, 1, database);
    expect(await database.blobs.count()).toBe(0);
  });
  it('duplicates an item by sharing its asset and keeps it until the last item is deleted', async () => {
    const image = sample();
    let project = editProject(createProject(), { type: 'images.add', images: [image] });
    project = editProject(project, { type: 'item.duplicate', id: image.item.id });
    expect(Object.values(project.items).map((item) => item.assetId)).toEqual([image.asset.id, image.asset.id]);
    await saveSnapshot(project, 0, [image.record], database);
    project = editProject(project, { type: 'item.delete', id: image.item.id });
    expect(Object.keys(project.assets)).toHaveLength(1);
    await saveSnapshot(project, 1, [], database);
    project = editProject(project, { type: 'item.delete', id: project.unrankedItemIds[0]! });
    await saveSnapshot(project, 2, [], database);
    expect(Object.keys(project.assets)).toHaveLength(0);
    expect(await database.blobs.count()).toBe(0);
  });
  it('rejects a missing image reference and rolls back the whole restore', async () => {
    const image = sample();
    const project = editProject(createProject(), { type: 'images.add', images: [image] });
    await expect(saveSnapshot(project, 0, [], database)).rejects.toThrow('画像データ');
    expect(await database.projects.count()).toBe(0);
  });
});

describe('schema and backup validation', () => {
  it('preserves unknown project, tier, item and style keys across a JSON round trip', async () => {
    const image = sample();
    const source = editProject(createProject(), { type: 'images.add', images: [image] });
    const project = parseProject({ ...source, future: { value: 7 }, tiers: source.tiers.map((tier) => ({ ...tier, extra: '保持' })), items: { [image.item.id]: { ...image.item, extra: [1, 2] } }, style: { ...source.style, custom: '保持' } });
    const backup = await createBackup(project, new Map([[image.record.id, image.record]]));
    const restored = await readBackup(new File([backup], '復元.json'), decoder);
    const expected = structuredClone(project);
    expected.id = restored.project.id; expected.createdAt = restored.project.createdAt; expected.updatedAt = restored.project.updatedAt;
    expected.assets[image.asset.id]!.blobKey = restored.project.assets[image.asset.id]!.blobKey;
    expect(restored.project).toEqual(expected);
    expect(restored.project.id).not.toBe(project.id);
    expect(restored.project.assets[image.asset.id]!.blobKey).not.toBe(image.record.id);
    expect(new Uint8Array(await restored.blobs[0]!.blob.arrayBuffer())).toEqual(png);
  });
  it('supports an empty project backup', async () => {
    const backup = await createBackup(createProject(), new Map<string, StoredBlob>());
    expect((await readBackup(new File([backup], '空.json'), decoder)).blobs).toEqual([]);
  });
  it('rejects malformed input, missing keys, unsupported schema, duplicate and dangling placements', () => {
    const project = createProject();
    expect(() => migrateProject({ ...project, schemaVersion: 99 })).toThrow('schemaVersion');
    expect(() => parseProject({ ...project, tiers: [project.tiers[0], project.tiers[0]] })).toThrow();
    expect(() => parseProject({ ...project, tiers: [{ ...project.tiers[0], id: 'unranked' }] })).toThrow();
    expect(() => parseProject({ ...project, items: undefined })).toThrow();
    expect(() => parseProject({ ...project, unrankedItemIds: ['missing'] })).toThrow();
    const withItem = editProject(project, { type: 'item.add', name: '対象', description: '', tags: [] });
    expect(() => parseProject({ ...withItem, unrankedItemIds: [...withItem.unrankedItemIds, ...withItem.unrankedItemIds] })).toThrow();
    expect(() => parseProject({ ...withItem, items: { different: Object.values(withItem.items)[0] } })).toThrow();
  });
  it('rejects empty, corrupt, mismatched MIME and oversized JSON files', async () => {
    await expect(readBackup(new File([], '空.json'))).rejects.toThrow('256MiB');
    await expect(readBackup(new File(['{'], '壊れた.json'))).rejects.toThrow('JSON');
    await expect(readBackup(new File(['{}'], '誤り.png'))).rejects.toThrow('JSON');
    await expect(readBackup(new File(['{}'], '誤り.json', { type: 'image/png' }))).rejects.toThrow('JSON');
    const oversized = new File(['{}'], '巨大.json');
    Object.defineProperty(oversized, 'size', { value: 256 * MiB + 1 });
    await expect(readBackup(oversized)).rejects.toThrow('256MiB');
  });
  it('rejects missing/duplicate blobs, invalid Base64 and forged dimensions', async () => {
    const image = sample(), project = editProject(createProject(), { type: 'images.add', images: [image] });
    const backup = JSON.parse(await (await createBackup(project, new Map([[image.record.id, image.record]]))).text());
    await expect(readBackup(jsonFile({ ...backup, blobs: [] }), decoder)).rejects.toThrow();
    await expect(readBackup(jsonFile({ ...backup, blobs: [...backup.blobs, ...backup.blobs] }), decoder)).rejects.toThrow();
    await expect(readBackup(jsonFile({ ...backup, blobs: [{ ...backup.blobs[0], dataBase64: '%%%=' }] }), decoder)).rejects.toThrow();
    backup.project.assets[image.asset.id].width = 2;
    await expect(readBackup(jsonFile(backup), decoder)).rejects.toThrow('寸法');
    expect(() => fromBase64('AB==')).toThrow();
  });
});

describe('image validation before browser decoding', () => {
  it('recognizes PNG headers and rejects invalid or excessive dimensions', () => {
    expect(inspectImage(png)).toEqual({ mimeType: 'image/png', width: 1, height: 1 });
    expect(() => inspectImage(new Uint8Array([1, 2, 3]))).toThrow();
    const oversized = png.slice(); new DataView(oversized.buffer).setUint32(16, 9000);
    expect(() => inspectImage(oversized)).toThrow('寸法');
    new DataView(oversized.buffer).setUint32(16, 6000); new DataView(oversized.buffer).setUint32(20, 6000);
    expect(() => inspectImage(oversized)).toThrow('寸法');
  });
  it('rejects empty images, extension/MIME mismatches and oversized files', async () => {
    await expect(prepareImage(new Blob([]), 'empty.png')).rejects.toThrow('空');
    await expect(prepareImage(new Blob([png], { type: 'image/jpeg' }), 'a.png')).rejects.toThrow('一致');
    await expect(prepareImage(new Blob([png], { type: 'image/png' }), 'a.svg')).rejects.toThrow('一致');
    const large = new Blob([png]); Object.defineProperty(large, 'size', { value: 20 * MiB + 1 });
    await expect(prepareImage(large, 'large.png')).rejects.toThrow('上限');
  });
  it('enforces per-batch count and size limits', () => {
    expect(() => validateBatch(Array.from({ length: 101 }, () => new File([png], 'a.png')))).toThrow('100枚');
    const file = new File([png], 'a.png'); Object.defineProperty(file, 'size', { value: 101 * MiB });
    expect(() => validateBatch([file])).toThrow('100MiB');
  });
  it('decodes multi-megabyte Base64 without a recursive regular expression', () => {
    const encoded = 'AAAA'.repeat(MiB);
    expect(fromBase64(encoded)).toHaveLength(3 * MiB);
  });
});
