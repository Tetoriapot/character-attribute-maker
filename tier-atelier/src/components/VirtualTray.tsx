import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useEditor } from '../stores/editorStore';
import { resolveStyle } from '../features/design/settings';
import { nextGridIndex, visibleIndices } from '../features/editor/virtual';
import { h } from '../app/editingMessages';

export function VirtualTray({ ids, renderItem }: { ids: string[]; renderItem: (id: string) => ReactNode }) {
  const style = useEditor((state) => state.project.style), draggingId = useEditor((state) => state.draggingId);
  const s = resolveStyle(style), gap = Math.min(40, s.gap);
  const ref = useRef<HTMLDivElement>(null), pendingFocus = useRef<string | null>(null);
  const [width, setWidth] = useState(0), [scrollTop, setScrollTop] = useState(0), [focusId, setFocusId] = useState(ids[0] ?? '');
  const cellWidth = Math.max(1, Math.min(200, s.itemSize, width || s.itemSize));
  const columns = Math.max(1, Math.floor((width + gap) / (cellWidth + gap)));
  const cardHeight = cellWidth + (s.showItemNames ? 5 + s.fontSize * 3 : 0), rowHeight = cardHeight + gap;
  const height = Math.min(480, rowHeight * Math.ceil(ids.length / columns));
  const totalHeight = Math.ceil(ids.length / columns) * rowHeight - gap;
  const focusIndex = Math.max(0, ids.indexOf(focusId));
  const indices = visibleIndices(ids.length, columns, rowHeight, Math.min(scrollTop, Math.max(0, totalHeight - height)), height, [focusIndex, ids.indexOf(draggingId ?? '')]);
  useLayoutEffect(() => {
    const element = ref.current; if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth)); observer.observe(element); setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.scrollTop > Math.max(0, totalHeight - height)) element.scrollTop = Math.max(0, totalHeight - height);
    if (pendingFocus.current && element) {
      const cell = Array.from(element.querySelectorAll<HTMLElement>('[data-virtual-id]')).find((node) => node.dataset.virtualId === pendingFocus.current);
      cell?.querySelector<HTMLButtonElement>('.item-select')?.focus({ preventScroll: true }); pendingFocus.current = null;
    }
  });
  return <div className="virtual-tray-shell"><p className="field-hint">{h.virtualHint}</p>
    <div ref={ref} className="virtual-tray" role="region" aria-label={h.tray} style={{ height }} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      onFocusCapture={(event) => { const cell = event.target.closest<HTMLElement>('[data-virtual-id]'); if (cell?.dataset.virtualId) setFocusId(cell.dataset.virtualId); }}
      onKeyDown={(event) => {
        if (draggingId || !(event.target instanceof Element) || !event.target.closest('.item-select')) return;
        const index = nextGridIndex(focusIndex, event.key, columns, ids.length, Math.max(1, Math.floor(height / rowHeight)));
        if (index === undefined) return;
        event.preventDefault();
        const id = ids[index]!; pendingFocus.current = id; setFocusId(id);
        const top = Math.floor(index / columns) * rowHeight;
        if (ref.current) {
          if (top < ref.current.scrollTop) ref.current.scrollTop = top;
          else if (top + cardHeight > ref.current.scrollTop + height) ref.current.scrollTop = top + cardHeight - height;
          setScrollTop(ref.current.scrollTop);
        }
      }}>
      <div role="list" style={{ height: totalHeight, position: 'relative' }}>
        {indices.map((index) => <div role="listitem" aria-posinset={index + 1} aria-setsize={ids.length} data-virtual-id={ids[index]} key={ids[index]} className="virtual-cell" style={{ left: (index % columns) * (cellWidth + gap), top: Math.floor(index / columns) * rowHeight, width: cellWidth, height: cardHeight }}>
          {renderItem(ids[index]!)}
        </div>)}
      </div>
    </div>
    <p className="field-hint">{h.range(Math.min(ids.length, Math.floor(scrollTop / rowHeight) * columns + 1), Math.min(ids.length, Math.ceil((scrollTop + height) / rowHeight) * columns), ids.length)}</p>
  </div>;
}
