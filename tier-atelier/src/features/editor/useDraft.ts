import { useEffect, useId } from 'react';
import { useEditor } from '../../stores/editorStore';
import { storageText as s } from '../../app/storageMessages';

export function useDraft(changed: boolean) {
  const id = useId();
  useEffect(() => {
    if (!changed) return;
    useEditor.setState((state) => ({ drafts: { ...state.drafts, [id]: true } }));
    return () => useEditor.setState((state) => {
      const drafts = { ...state.drafts }; delete drafts[id]; return { drafts };
    });
  }, [changed, id]);
}
export function confirmDrafts() {
  return !Object.keys(useEditor.getState().drafts).length || window.confirm(s.draftConfirm);
}
