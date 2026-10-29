import { useEditor } from '../../stores/editorStore';
import { confirmDrafts } from './useDraft';
import { h } from '../../app/editingMessages';

export const ITEM_DELETE_TARGET = 'delete:items';

export function draggedItemIds(sourceId: string, selectedIds: string[]) {
  return selectedIds.includes(sourceId) ? selectedIds : [sourceId];
}

export function deleteItems(ids: string[]) {
  if (useEditor.getState().busy || !confirmDrafts()) return false;
  if (!useEditor.getState().dispatch({ type: 'items.delete', ids }, h.deleted(ids.length))) return false;
  useEditor.setState((state) => ({ drafts: {}, editEpoch: state.editEpoch + 1 }));
  return true;
}
