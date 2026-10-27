import { create } from 'zustand';
import { createProject } from '../data/defaults';
import type { Project, Selection } from '../data/types';
import { EditorError, type EditorCommand } from '../features/editor/commands';
import { emptyHistory, recordEdit, travelHistory, type EditHistory } from '../features/editor/history';
import { matchingIds, selectableIds } from '../features/editor/filter';
import { h } from '../app/editingMessages';
import { t } from '../app/messages';
import { storageText as s } from '../app/storageMessages';
import type { ProjectSummary, StoredBlob } from '../data/db';

interface EditorState {
  history: EditHistory;
  editEpoch: number;
  query: string;
  filterTags: string[];
  selectionMode: boolean;
  selectedIds: string[];
  selectionAnchor: string | null;
  zoom: number;
  grid: boolean;
  draggingId: string | null;
  travel: (direction: 'undo' | 'redo') => boolean;
  toggleItem: (id: string, range?: boolean) => void;
  focusAfterOperation: HTMLElement | null;
  drafts: Record<string, true>;
  ready: boolean;
  busy: boolean;
  loadError: string | null;
  saveError: string | null;
  saveStatus: 'loading' | 'saving' | 'saved' | 'failed';
  projects: ProjectSummary[];
  records: Map<string, StoredBlob>;
  thumbnails: Record<string, string>;
  imageErrors: string[];
  progress: string;
  project: Project;
  selection: Selection;
  dirty: boolean;
  error: string | null;
  announcement: string;
  select: (selection: Selection) => void;
  dispatch: (command: EditorCommand, announcement?: string) => boolean;
  clearError: () => void;
}

export const useEditor = create<EditorState>((set) => ({
  history: emptyHistory(), editEpoch: 0, query: '', filterTags: [], selectionMode: false, selectedIds: [], selectionAnchor: null, zoom: 100, grid: false, draggingId: null,
  toggleItem: (id, range = false) => set((state) => {
    if (state.busy || !selectableIds(state.project, [id]).length) return {};
    const visible = selectableIds(state.project, matchingIds(state.project, state.query, state.filterTags));
    const from = state.selectionAnchor ? visible.indexOf(state.selectionAnchor) : -1, to = visible.indexOf(id);
    const selectedIds = range && from >= 0 && to >= 0 ? [...new Set([...state.selectedIds, ...visible.slice(Math.min(from, to), Math.max(from, to) + 1)])]
      : state.selectedIds.includes(id) ? state.selectedIds.filter((key) => key !== id) : [...state.selectedIds, id];
    return { selectedIds, selectionMode: true, selectionAnchor: id };
  }),
  travel: (direction) => {
    let changed = false;
    set((state) => {
      if (state.busy || state.draggingId) return {};
      try {
        const next = travelHistory(state.project, state.history, direction);
        if (next.project === state.project) return {};
        changed = true;
        const current = state.selection;
        const selection = (current.kind === 'tier' && !next.project.tiers.some((tier) => tier.id === current.id)) || (current.kind === 'item' && !next.project.items[current.id]) ? { kind: 'project' as const } : current;
        return { ...next, selection, selectedIds: state.selectedIds.filter((id) => !!next.project.items[id]), dirty: true, editEpoch: state.editEpoch + 1, drafts: {}, error: null, announcement: direction === 'undo' ? h.undone : h.redone };
      } catch { return { error: t.errors.unexpected }; }
    });
    return changed;
  },
  focusAfterOperation: null,
  drafts: {},
  ready: false, busy: false, loadError: null, saveError: null, saveStatus: 'loading', projects: [],
  records: new Map(), thumbnails: {}, imageErrors: [], progress: '',
  project: createProject(), selection: { kind: 'project' }, dirty: false, error: null, announcement: '',
  select: (selection) => set({ selection, error: null, announcement: '' }),
  clearError: () => set({ error: null }),
  dispatch: (command, announcement = t.applied) => {
    let success = true;
    set((state) => {
      if (state.busy) { success = false; return { error: s.busy }; }
      try {
        const { project, history } = recordEdit(state.project, state.history, command);
        const current = state.selection;
        let selection = current;
        if ((current.kind === 'tier' && !project.tiers.some((tier) => tier.id === current.id))
          || (current.kind === 'item' && !project.items[current.id])) selection = { kind: 'project' };
        if (command.type === 'tier.add' || command.type === 'tier.duplicate') {
          const added = project.tiers.find((tier) => !state.project.tiers.some((old) => old.id === tier.id));
          if (added) selection = { kind: 'tier', id: added.id };
        }
        if (command.type === 'item.add' || command.type === 'item.duplicate') {
          const id = Object.keys(project.items).find((id) => !state.project.items[id]);
          if (id) selection = { kind: 'item', id };
        }
        return { project, history, selection, selectedIds: state.selectedIds.filter((id) => !!project.items[id]), dirty: state.dirty || project !== state.project, error: null, announcement };
      } catch (error) {
        success = false;
        return { error: error instanceof EditorError ? error.message : t.errors.unexpected, announcement: '' };
      }
    });
    return success;
  },
}));
