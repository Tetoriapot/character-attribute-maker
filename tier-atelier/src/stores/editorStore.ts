import { create } from 'zustand';
import { createProject } from '../data/defaults';
import type { Project, Selection } from '../data/types';
import { editProject, EditorError, type EditorCommand } from '../features/editor/commands';
import { t } from '../app/messages';

interface EditorState {
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
  project: createProject(), selection: { kind: 'project' }, dirty: false, error: null, announcement: '',
  select: (selection) => set({ selection, error: null, announcement: '' }),
  clearError: () => set({ error: null }),
  dispatch: (command, announcement = t.applied) => {
    let success = true;
    set((state) => {
      try {
        const project = editProject(state.project, command);
        const current = state.selection;
        let selection = current;
        if ((current.kind === 'tier' && !project.tiers.some((tier) => tier.id === current.id))
          || (current.kind === 'item' && !project.items[current.id])) selection = { kind: 'project' };
        if (command.type === 'tier.add' || command.type === 'tier.duplicate') {
          const added = project.tiers.find((tier) => !state.project.tiers.some((old) => old.id === tier.id));
          if (added) selection = { kind: 'tier', id: added.id };
        }
        if (command.type === 'item.add') {
          const id = project.unrankedItemIds.at(-1);
          if (id) selection = { kind: 'item', id };
        }
        return { project, selection, dirty: state.dirty || project !== state.project, error: null, announcement };
      } catch (error) {
        success = false;
        return { error: error instanceof EditorError ? error.message : t.errors.unexpected, announcement: '' };
      }
    });
    return success;
  },
}));
