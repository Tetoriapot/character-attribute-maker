import { useEditor } from '../../stores/editorStore';
import { bootstrap, ConflictError, db, deleteProject, listProjects, loadProject, saveSnapshot, type StoredBlob } from '../../data/db';
import { createProject } from '../../data/defaults';
import type { Project } from '../../data/types';
import { editProject, EditorError } from '../editor/commands';
import { MAX_PROJECT_BYTES, prepareImage, totalBytes, validateBatch, type PreparedImage } from '../assets/images';
import { createBackup, downloadBackup, readBackup } from '../backup/backup';
import { storageText as s } from '../../app/storageMessages';

let revision = 0;
let pending = new Map<string, StoredBlob>();
let saving: Promise<void> | undefined;
let initializing: Promise<void> | undefined;
let subscribed = false;
const get = useEditor.getState;
const set = useEditor.setState;

function install(project: Project, nextRevision: number, blobs: StoredBlob[]) {
  const thumbnails: Record<string, string> = {};
  const records = new Map(blobs.map((record) => [record.id, record]));
  for (const asset of Object.values(project.assets)) {
    const record = records.get(asset.blobKey);
    if (record) thumbnails[asset.id] = URL.createObjectURL(record.thumbnail);
  }
  const previous = get().thumbnails;
  revision = nextRevision; pending = new Map();
  set({ project, records, thumbnails, dirty: false, ready: true, loadError: null, saveError: null, saveStatus: 'saved', selection: { kind: 'project' }, error: null, imageErrors: [], progress: '' });
  Object.values(previous).forEach((url) => URL.revokeObjectURL(url));
}

export async function refreshProjects() { set({ projects: await listProjects() }); }

export function initializeStorage(): Promise<void> {
  if (!subscribed) {
    subscribed = true;
    useEditor.subscribe((state, previous) => {
      if (state.project.id === previous.project.id && state.project.assets !== previous.project.assets) {
        const removed = Object.keys(previous.project.assets).filter((id) => !state.project.assets[id]);
        if (removed.length) {
          const records = new Map(state.records), thumbnails = { ...state.thumbnails };
          const keys = new Set(Object.values(state.project.assets).map((asset) => asset.blobKey));
          for (const id of removed) {
            if (thumbnails[id]) URL.revokeObjectURL(thumbnails[id]);
            delete thumbnails[id];
          }
          for (const key of records.keys()) { if (!keys.has(key)) { records.delete(key); pending.delete(key); } }
          set({ records, thumbnails });
        }
      }
      if (state.project !== previous.project && state.ready && state.dirty && !state.busy && !state.saveError) {
        queueMicrotask(() => { void flushSave().catch(() => { /* The save failure is retained in the store. */ }); });
      }
    });
  }
  if (get().ready) return Promise.resolve();
  if (initializing) return initializing;
  set({ loadError: null, saveStatus: 'loading' });
  initializing = (async () => {
    try {
      // A failed automatic open is cached by Dexie; an explicit open retries it.
      await db.open();
      const data = await loadProject(await bootstrap());
      install(data.project, data.revision, data.blobs);
      await refreshProjects();
    } catch { set({ loadError: s.loadError }); }
  })().finally(() => { initializing = undefined; });
  return initializing;
}

export function flushSave(): Promise<void> {
  if (saving) return saving;
  saving = (async () => {
    try {
      for (;;) {
        while (get().dirty) {
          const snapshot = get().project;
          const batch = [...pending.values()];
          set({ saveStatus: 'saving', saveError: null });
          revision = await saveSnapshot(snapshot, revision, batch);
          batch.forEach((record) => pending.delete(record.id));
          // An edit made while IndexedDB was writing must remain dirty and be saved next.
          if (get().project === snapshot) set({ dirty: false });
        }
        await refreshProjects();
        if (!get().dirty) break;
      }
      set({ saveStatus: 'saved', saveError: null });
    } catch (error) {
      set({ saveStatus: 'failed', saveError: error instanceof ConflictError ? s.conflict : s.saveError });
      throw error;
    }
  })().finally(() => { saving = undefined; });
  return saving;
}

async function exclusive(action: () => Promise<void>, requireSaved = true): Promise<boolean> {
  if (get().busy) return false;
  const focusAfterOperation = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  set({ busy: true, error: null, announcement: '', focusAfterOperation });
  try {
    if (requireSaved) await flushSave();
    await action();
    return true;
  } catch (error) {
    set({ error: error instanceof Error && (error instanceof EditorError || Object.values(s).includes(error.message)) ? error.message : s.operationError });
    return false;
  } finally { set({ busy: false, progress: '' }); }
}

async function activate(project: Project, nextRevision: number, blobs: StoredBlob[]) {
  await db.settings.put({ key: 'activeProject', value: project.id });
  install(project, nextRevision, blobs);
  await refreshProjects();
}

export function openProject(id: string) {
  return exclusive(async () => {
    const data = await loadProject(id);
    await activate(data.project, data.revision, data.blobs);
  });
}
export function newProject(title: string) {
  return exclusive(async () => {
    const project = editProject(createProject(), { type: 'project.update', title, description: '' });
    const nextRevision = await saveSnapshot(project, 0, []);
    await activate(project, nextRevision, []);
    set({ announcement: s.created });
  });
}
export function duplicateProject(id: string) {
  return exclusive(async () => {
    const source = await loadProject(id);
    const project = structuredClone(source.project);
    project.id = crypto.randomUUID(); project.title = `${project.title.slice(0, 116)}（複製）`;
    project.createdAt = project.updatedAt = new Date().toISOString();
    const nextRevision = await saveSnapshot(project, 0, []);
    await activate(project, nextRevision, source.blobs);
    set({ announcement: s.duplicated });
  });
}
export function removeProject(id: string, expectedRevision?: number) {
  return exclusive(async () => {
    await deleteProject(id, id === get().project.id ? revision : expectedRevision);
    if (id === get().project.id) {
      const data = await loadProject(await bootstrap());
      await activate(data.project, data.revision, data.blobs);
    } else await refreshProjects();
    set({ announcement: s.deleted });
  });
}

export function addImages(files: File[]) {
  return exclusive(async () => {
    set({ imageErrors: [], progress: s.importing });
    validateBatch(files);
    const prepared: PreparedImage[] = [], errors: string[] = [];
    let bytes = totalBytes(get().records.values());
    for (let index = 0; index < files.length; index++) {
      const file = files[index]!;
      try {
        if (bytes + file.size > MAX_PROJECT_BYTES) throw new Error(s.projectLimit);
        const image = await prepareImage(file, file.name);
        prepared.push(image); bytes += image.record.blob.size;
      } catch (error) { errors.push(`${file.name}: ${error instanceof Error ? error.message : s.invalidImage}`); }
      set({ progress: s.progress(index + 1, files.length) });
    }
    if (prepared.length) {
      const project = editProject(get().project, { type: 'images.add', images: prepared });
      const records = new Map(get().records), thumbnails = { ...get().thumbnails };
      for (const image of prepared) {
        pending.set(image.record.id, image.record); records.set(image.record.id, image.record);
        thumbnails[image.asset.id] = URL.createObjectURL(image.record.thumbnail);
      }
      set({ project, records, thumbnails, dirty: true, announcement: s.imported(prepared.length) });
      // Failure must not discard the validated images or prevent an emergency backup.
      await flushSave().catch(() => undefined);
    }
    set({ imageErrors: errors });
  }, false);
}
export function exportProject() {
  return exclusive(async () => {
    set({ progress: s.exporting });
    const snapshot = get().project;
    downloadBackup(await createBackup(snapshot, get().records), snapshot.title);
    set({ announcement: s.backupDone });
  }, false);
}
export function importProject(file: File) {
  return exclusive(async () => {
    set({ progress: s.restoring });
    const data = await readBackup(file);
    const nextRevision = await saveSnapshot(data.project, 0, data.blobs);
    await activate(data.project, nextRevision, data.blobs);
    set({ announcement: s.restoreDone });
  });
}
