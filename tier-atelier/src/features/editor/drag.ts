import type { DragEndEvent } from '@dnd-kit/react';
import { useEditor } from '../../stores/editorStore';
import { itemIdsAt, itemLocation } from './commands';
import { t } from '../../app/messages';

export function handleDrop(event: DragEndEvent) {
  const { source, target } = event.operation;
  if (event.canceled || !source || !target) return;
  const { project, dispatch } = useEditor.getState();
  const sourceId = String(source.id);
  const targetId = String(target.id);
  if (source.type === 'tier' && targetId.startsWith('tier:')) {
    const index = project.tiers.findIndex((tier) => tier.id === targetId.slice(5));
    if (index >= 0) dispatch({ type: 'tier.move', id: sourceId, index }, t.moved);
  }
  if (source.type !== 'item') return;
  if (targetId.startsWith('zone:')) {
    const id = targetId.slice(5);
    dispatch({ type: 'item.move', id: sourceId, tierId: id === 'unranked' ? null : id }, t.moved);
  } else if (targetId.startsWith('item:') && targetId.slice(5) !== sourceId) {
    const itemId = targetId.slice(5);
    const tierId = itemLocation(project, itemId);
    dispatch({ type: 'item.move', id: sourceId, tierId, index: itemIdsAt(project, tierId).indexOf(itemId) }, t.moved);
  }
}
