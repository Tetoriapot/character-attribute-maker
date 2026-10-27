import { p } from '../../app/pwaMessages';
export function updateBlocker(state: { ready: boolean; busy: boolean; draggingId: string | null; drafts: Record<string, true> }) {
  if (!state.ready || state.busy || state.draggingId) return p.operation;
  if (Object.keys(state.drafts).length) return p.drafts;
  return null;
}
