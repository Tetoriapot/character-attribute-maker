import { applyPatches, enablePatches, type Patch } from 'immer';
import type { Project } from '../../data/types';
import { editProject, type EditorCommand } from './commands';

enablePatches();
export const HISTORY_LIMIT = 100;
export interface HistoryEntry { patches: Patch[]; inverse: Patch[]; blobKeys: string[] }
export interface EditHistory { past: HistoryEntry[]; future: HistoryEntry[] }
export const emptyHistory = (): EditHistory => ({ past: [], future: [] });

export function recordEdit(project: Project, history: EditHistory, command: EditorCommand) {
  let patches: Patch[] = [], inverse: Patch[] = [];
  const next = editProject(project, command, (forward, backward) => { patches = forward; inverse = backward; });
  if (!patches.length) return { project, history };
  const changedAssets = new Set([...Object.keys(project.assets), ...Object.keys(next.assets)].filter((id) => project.assets[id] !== next.assets[id]));
  const blobKeys = [...new Set([...changedAssets].flatMap((id) => [project.assets[id]?.blobKey, next.assets[id]?.blobKey]).filter((key): key is string => !!key))];
  const entry = { patches, inverse, blobKeys };
  return { project: next, history: { past: [...history.past, entry].slice(-HISTORY_LIMIT), future: [] } };
}

export function travelHistory(project: Project, history: EditHistory, direction: 'undo' | 'redo') {
  const entry = (direction === 'undo' ? history.past : history.future).at(-1);
  if (!entry) return { project, history };
  const next = applyPatches(project, direction === 'undo' ? entry.inverse : entry.patches);
  return {
    project: { ...next, updatedAt: new Date().toISOString() },
    history: direction === 'undo'
      ? { past: history.past.slice(0, -1), future: [...history.future, entry] }
      : { past: [...history.past, entry], future: history.future.slice(0, -1) },
  };
}
export function retainedBlobKeys(project: Project, history: EditHistory) {
  return new Set([...Object.values(project.assets).map((asset) => asset.blobKey), ...history.past.flatMap((entry) => entry.blobKeys), ...history.future.flatMap((entry) => entry.blobKeys)]);
}
