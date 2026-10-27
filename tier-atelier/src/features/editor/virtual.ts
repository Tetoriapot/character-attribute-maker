export function visibleIndices(count: number, columns: number, rowHeight: number, scrollTop: number, viewportHeight: number, pinned: number[] = []) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 2) * columns;
  const end = Math.min(count, (Math.ceil((scrollTop + viewportHeight) / rowHeight) + 2) * columns);
  return [...new Set([...Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index), ...pinned.filter((index) => index >= 0 && index < count)])].sort((a, b) => a - b);
}
export function nextGridIndex(index: number, key: string, columns: number, count: number, pageRows: number) {
  const target = key === 'ArrowRight' ? index + 1 : key === 'ArrowLeft' ? index - 1 : key === 'ArrowDown' ? index + columns : key === 'ArrowUp' ? index - columns
    : key === 'Home' ? 0 : key === 'End' ? count - 1 : key === 'PageDown' ? index + pageRows * columns : key === 'PageUp' ? index - pageRows * columns : undefined;
  return target === undefined ? undefined : Math.max(0, Math.min(count - 1, target));
}
