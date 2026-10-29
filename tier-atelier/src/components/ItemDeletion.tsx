import { useState } from 'react';
import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { useEditor } from '../stores/editorStore';
import { deleteItems, draggedItemIds, ITEM_DELETE_TARGET } from '../features/editor/deletion';
import { matchingIds } from '../features/editor/filter';
import { h } from '../app/editingMessages';
import { t } from '../app/messages';
import { Icon } from './Icon';
import { Dialog } from './Dialog';

export function ItemDeleteTarget() {
  const draggingId = useEditor((state) => state.draggingId), selectedIds = useEditor((state) => state.selectedIds);
  const project = useEditor((state) => state.project), busy = useEditor((state) => state.busy);
  const query = useEditor((state) => state.query), tags = useEditor((state) => state.filterTags);
  const active = !!draggingId && !!project.items[draggingId] && !busy;
  const { ref, isDropTarget } = useDroppable({ id: ITEM_DELETE_TARGET, accept: 'item', disabled: !active, collisionPriority: 3 });
  const ids = active ? draggedItemIds(draggingId, selectedIds) : [];
  const visible = new Set(active ? matchingIds(project, query, tags) : []);
  const hidden = ids.filter((id) => !visible.has(id)).length;
  return <div ref={ref} hidden={!active} className={`item-delete-target ${isDropTarget ? 'delete-over' : ''}`} role="region" aria-label={h.deleteArea}>
    <Icon name="trash" size={24} /><div role="status"><strong>{h.dropDelete(ids.length)}</strong><p>{hidden ? h.deleteHidden(hidden) : h.deleteUndo}</p></div>
  </div>;
}

export function DragPreview() {
  const { source, target } = useDragOperation();
  const project = useEditor((state) => state.project), selectedIds = useEditor((state) => state.selectedIds);
  if (!source || target?.id === ITEM_DELETE_TARGET) return null;
  const id = String(source.id), count = source.type === 'item' ? draggedItemIds(id, selectedIds).length : 0;
  return <div className="drag-preview" aria-hidden="true">{count > 1 ? h.draggingItems(count) : project.items[id]?.name ?? project.tiers.find((tier) => tier.id === id)?.name}</div>;
}

export function DeleteItemsButton() {
  const selectedIds = useEditor((state) => state.selectedIds), busy = useEditor((state) => state.busy);
  const project = useEditor((state) => state.project), query = useEditor((state) => state.query), tags = useEditor((state) => state.filterTags);
  const error = useEditor((state) => state.error);
  const [ids, setIds] = useState<string[] | null>(null);
  const visible = new Set(ids ? matchingIds(project, query, tags) : []);
  const hidden = ids?.filter((id) => !visible.has(id)).length ?? 0;
  return <><button className="button secondary destructive" disabled={busy || !selectedIds.length} onClick={() => { useEditor.getState().clearError(); setIds([...selectedIds]); }}><Icon name="trash" />{h.deleteSelected}</button>
    {ids && <Dialog title={h.deleteTitle(ids.length)} onClose={() => setIds(null)} closeDisabled={busy}>
      <p>{h.deleteUndo}</p>{hidden > 0 && <p>{h.deleteHidden(hidden)}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={() => setIds(null)}>{t.cancel}</button><button className="button danger" disabled={busy} onClick={() => { if (deleteItems(ids)) setIds(null); }}>{t.confirmDelete}</button></div>
    </Dialog>}
  </>;
}
