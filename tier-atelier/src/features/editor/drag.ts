import type { DragEndEvent } from '@dnd-kit/react';
import { useEditor } from '../../stores/editorStore';
import { itemIdsAt, itemLocation } from './commands';
import { t } from '../../app/messages';
import { h } from '../../app/editingMessages';

export function handleDrop(event: DragEndEvent) {
  const { source, target } = event.operation;
  if (event.canceled || !source || !target) return;
  const { project, dispatch, selectedIds } = useEditor.getState();
  const sourceId = String(source.id);
  const targetId = String(target.id);
  if (source.type === 'tier' && targetId.startsWith('tier:')) {
    const index = project.tiers.findIndex((tier) => tier.id === targetId.slice(5));
    if (index >= 0) dispatch({ type: 'tier.move', id: sourceId, index }, t.moved);
  }
  if (source.type !== 'item') return;
  const multi = selectedIds.length > 1 && selectedIds.includes(sourceId);
  if (targetId.startsWith('zone:')) {
    const id = targetId.slice(5);
    const tierId = id === 'unranked' ? null : id;
    dispatch(multi ? { type: 'items.move', ids: selectedIds, tierId } : { type: 'item.move', id: sourceId, tierId }, multi ? h.moved(selectedIds.length) : t.moved);
  } else if (targetId.startsWith('item:') && targetId.slice(5) !== sourceId) {
    const itemId = targetId.slice(5);
    if (multi && selectedIds.includes(itemId)) return;
    const tierId = itemLocation(project, itemId);
    const index = itemIdsAt(project, tierId).indexOf(itemId);
    dispatch(multi ? { type: 'items.move', ids: selectedIds, tierId, index } : { type: 'item.move', id: sourceId, tierId, index }, multi ? h.moved(selectedIds.length) : t.moved);
  }
}
